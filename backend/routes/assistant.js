const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const config = require('../config');
const { assistantChatSchema, assistantActionSchema } = require('../schemas/validation');

router.use(auth);

// Get context snapshot
router.get('/context', (req, res) => {
  try {
    const warehouses = db.prepare('SELECT * FROM warehouses ORDER BY name').all();
    const inventory = db.prepare(`
      SELECT w.name as warehouse, p.name, p.e_number, p.unit, p.category, i.quantity, i.min_quantity
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN warehouses w ON w.id = i.warehouse_id
      ORDER BY w.name, p.name
    `).all();
    const lowStock = inventory.filter(i => i.quantity <= i.min_quantity);
    const activeJobs = db.prepare(`
      SELECT j.id, j.order_number, j.customer_name, j.address, j.description, j.deadline
      FROM jobs j WHERE j.status='active'
      AND (j.created_by=? OR j.is_shared=1 OR j.owner_user_id IS NULL)
      ORDER BY j.created_at DESC LIMIT 20
    `).all(req.user.id);

    const today = new Date().toISOString().substring(0,10);
    const todayEvents = db.prepare(`
      SELECT title, start_datetime, end_datetime, description
      FROM calendar_events
      WHERE start_datetime LIKE ? ORDER BY start_datetime
    `).all(`${today}%`);

    const weekEvents = db.prepare(`
      SELECT title, start_datetime, description, all_day
      FROM calendar_events
      WHERE date(start_datetime) BETWEEN date('now') AND date('now','+7 days')
      ORDER BY start_datetime LIMIT 10
    `).all();

    res.json({ warehouses, inventory, lowStock, activeJobs, todayEvents, weekEvents });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// groq chat proxy - with timeout and warm model
router.post('/chat', async (req, res) => {
  if (!config.groqApiKey) {
    return res.status(503).json({ error: 'Groq API-nyckel är inte konfigurerad' });
  }
  try {
    const { message, system } = assistantChatSchema.parse(req.body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json();
    res.json({ text: data.choices?.[0]?.message?.content || 'Inget svar' });
  } catch(e) {
    if (e.name === 'ZodError') {
      const issues = e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({ error: 'Valideringsfel', details: issues });
    }
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Groq API svarade inte inom 15 sekunder' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Create calendar event via assistant
router.post('/action', async (req, res) => {
  try {
    const { action, params } = assistantActionSchema.parse(req.body);
    let result = {};
    switch(action) {
      case 'create_calendar_event':
        const evResult = db.prepare(`
          INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, type, color, reminder_minutes, created_by)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).run(params.title, params.description||'', params.start_datetime, params.end_datetime||null, params.all_day?1:0, 'booking', '#60a5fa', params.reminder_minutes||60, req.user.id);
        result = { success: true, id: evResult.lastInsertRowid, message: `Händelse "${params.title}" skapad i kalendern` };
        break;

      case 'add_to_cart':
        const product = db.prepare('SELECT * FROM products WHERE e_number=? OR name LIKE ?').get(params.e_number||'', `%${params.name||''}%`);
        if (!product) return res.json({ success: false, message: 'Produkten hittades inte' });
        result = { success: true, product, quantity: params.quantity||1 };
        break;

      case 'add_job_note':
        const job = db.prepare("SELECT * FROM jobs WHERE id=? OR (customer_name LIKE ? AND status='active')").get(params.job_id||0, `%${params.customer||''}%`);
        if (!job) return res.json({ success: false, message: 'Jobbet hittades inte' });
        db.prepare('INSERT INTO job_entries (job_id, user_id, type, content) VALUES (?,?,?,?)').run(job.id, req.user.id, 'note', params.note);
        result = { success: true, message: `Anteckning tillagd på ${job.customer_name}` };
        break;

      default:
        result = { success: false, message: 'Okänd åtgärd' };
    }
    res.json(result);
  } catch(e) {
    if (e.name === 'ZodError') {
      const issues = e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({ error: 'Valideringsfel', details: issues });
    }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
