const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const asyncHandler = require('../middleware/asyncHandler');
const { calendarEventSchema } = require('../schemas/validation');
const { sendTelegram, sendPushToAll } = require('../notifications');

router.use(auth);

// Ensure calendar tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT,
    all_day INTEGER DEFAULT 0,
    type TEXT DEFAULT 'booking',
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#f5a623',
    reminder_minutes INTEGER DEFAULT 60,
    reminder_sent INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Also add deadline column to jobs if not exists
const jobCols = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name);
if (!jobCols.includes('deadline')) {
  db.exec("ALTER TABLE jobs ADD COLUMN deadline TEXT");
  console.log('[DB] Added deadline to jobs');
}

// GET EVENTS
router.get('/events', asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  let sql = `
    SELECT e.*, u.display_name as created_by_name,
    j.customer_name as job_customer, j.order_number as job_order
    FROM calendar_events e
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN jobs j ON j.id = e.job_id
    WHERE 1=1
  `;
  const params = [];
  if (from) { sql += ' AND e.start_datetime >= ?'; params.push(from); }
  if (to) { sql += ' AND e.start_datetime <= ?'; params.push(to); }
  sql += ' ORDER BY e.start_datetime ASC';
  const events = db.prepare(sql).all(...params);

  let jobSql = `
    SELECT j.id, j.customer_name, j.order_number, j.deadline, j.address
    FROM jobs j WHERE j.deadline IS NOT NULL AND j.status = 'active'
  `;
  const jobParams = [];
  if (from) { jobSql += ' AND j.deadline >= ?'; jobParams.push(from.substring(0,10)); }
  if (to) { jobSql += ' AND j.deadline <= ?'; jobParams.push(to.substring(0,10)); }
  const jobDeadlines = db.prepare(jobSql).all(...jobParams);

  const deadlineEvents = jobDeadlines.map(j => ({
    id: `job_${j.id}`,
    title: `⏰ ${j.customer_name}${j.order_number ? ` (${j.order_number})` : ''}`,
    description: j.address || '',
    start_datetime: j.deadline + 'T00:00:00',
    all_day: 1,
    type: 'deadline',
    job_id: j.id,
    color: '#f87171',
    is_job_deadline: true
  }));

  res.json([...events, ...deadlineEvents]);
}));

// CREATE EVENT
router.post('/events', asyncHandler(async (req, res) => {
  const data = calendarEventSchema.parse(req.body);
  const result = db.prepare(`
    INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, type, job_id, color, reminder_minutes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(data.title, data.description, data.start_datetime, data.end_datetime || null, data.all_day ? 1 : 0, data.type, data.job_id || null, data.color, data.reminder_minutes, req.user.id);
  res.json({ id: result.lastInsertRowid });
}));

// UPDATE EVENT
router.put('/events/:id', asyncHandler(async (req, res) => {
  const data = calendarEventSchema.parse(req.body);
  db.prepare(`
    UPDATE calendar_events SET title=?, description=?, start_datetime=?, end_datetime=?, all_day=?, color=?, reminder_minutes=?, reminder_sent=0
    WHERE id=?
  `).run(data.title, data.description, data.start_datetime, data.end_datetime || null, data.all_day ? 1 : 0, data.color, data.reminder_minutes, req.params.id);
  res.json({ success: true });
}));

// DELETE EVENT
router.delete('/events/:id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM calendar_events WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

// UPDATE JOB DEADLINE
router.post('/jobs/:id/deadline', asyncHandler(async (req, res) => {
  const { deadline } = req.body;
  db.prepare('UPDATE jobs SET deadline=? WHERE id=?').run(deadline || null, req.params.id);
  res.json({ success: true });
}));

// CHECK REMINDERS
router.post('/check-reminders', asyncHandler(async (req, res) => {
  const events = db.prepare(`
    SELECT * FROM calendar_events
    WHERE reminder_sent = 0
    AND all_day = 0
    AND datetime(start_datetime, '-' || reminder_minutes || ' minutes') <= datetime('now')
    AND start_datetime > datetime('now', '-1 hour')
  `).all();

  let sent = 0;
  for (const event of events) {
    const startTime = new Date(event.start_datetime).toLocaleString('sv-SE', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
    const msg = `🔔 **ElStock Påminnelse**\n\n **${event.title}**\n${event.description ? event.description + '\n' : ''}⏰ Startar: ${startTime}`;

    await sendTelegram(msg).catch(()=>{});
    await sendPushToAll({
      title: `⏰ Påminnelse: ${event.title}`,
      body: `Startar ${startTime}`,
      icon: '/icons/icon-192.png',
      data: { url: '/' }
    }).catch(()=>{});

    db.prepare('UPDATE calendar_events SET reminder_sent=1 WHERE id=?').run(event.id);
    sent++;
  }

  res.json({ checked: events.length, sent });
}));

module.exports = router;
