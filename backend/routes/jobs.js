const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const asyncHandler = require('../middleware/asyncHandler');
const { jobSchema, jobEntrySchema, jobMaterialSchema } = require('../schemas/validation');

router.use(auth);

// Ensure jobs tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS job_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT DEFAULT (datetime('now')),
    archived_at TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS job_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'note',
    content TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS job_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    e_number TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'st',
    added_by INTEGER REFERENCES users(id),
    added_at TEXT DEFAULT (datetime('now'))
  );
`);

// LIST JOBS
router.get('/', asyncHandler(async (req, res) => {
  const { status = 'active', q } = req.query;
  let sql = `
    SELECT j.*, u.display_name as created_by_name,
    (SELECT COUNT(*) FROM job_entries e WHERE e.job_id = j.id) as entry_count,
    (SELECT COUNT(*) FROM job_materials m WHERE m.job_id = j.id) as material_count
    FROM jobs j
    LEFT JOIN users u ON u.id = j.created_by
    WHERE j.status = ?
  `;
  const params = [status];

  if (req.user.role !== 'admin') {
    sql += ` AND (j.created_by = ? OR j.is_shared = 1 OR j.shared_with LIKE ?)`;
    params.push(req.user.id, `%${req.user.id}%`);
  }

  if (q) {
    sql += ' AND (j.customer_name LIKE ? OR j.address LIKE ? OR j.order_number LIKE ? OR j.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY j.created_at DESC';
  res.json(db.prepare(sql).all(...params));
}));

// GET SINGLE JOB
router.get('/:id', asyncHandler(async (req, res) => {
  const job = db.prepare(`
    SELECT j.*, u.display_name as created_by_name
    FROM jobs j LEFT JOIN users u ON u.id = j.created_by
    WHERE j.id = ?
  `).get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const entries = db.prepare(`
    SELECT e.*, u.display_name as user_name
    FROM job_entries e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.job_id = ? ORDER BY e.created_at ASC
  `).all(req.params.id);

  const materials = db.prepare(`
    SELECT m.*, u.display_name as added_by_name
    FROM job_materials m LEFT JOIN users u ON u.id = m.added_by
    WHERE m.job_id = ? ORDER BY m.added_at ASC
  `).all(req.params.id);

  res.json({ ...job, entries, materials });
}));

// CREATE JOB
router.post('/', asyncHandler(async (req, res) => {
  const data = jobSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO jobs (order_number, customer_name, phone, address, description, customer_id, is_shared, created_by) VALUES (?,?,?,?,?,?,?,?)'
  ).run(data.order_number, data.customer_name, data.phone, data.address, data.description, data.customer_id || null, data.is_shared ? 1 : 0, req.user.id);

  db.prepare('INSERT INTO job_entries (job_id, user_id, type, content) VALUES (?,?,?,?)').run(
    result.lastInsertRowid, req.user.id, 'created', `Jobb skapat av ${req.user.display_name}`
  );
  res.json({ id: result.lastInsertRowid });
}));

// UPDATE JOB
router.put('/:id', asyncHandler(async (req, res) => {
  const data = jobSchema.parse(req.body);
  db.prepare('UPDATE jobs SET order_number=?, customer_name=?, phone=?, address=?, description=?, deadline=? WHERE id=?').run(
    data.order_number, data.customer_name, data.phone, data.address, data.description, req.body.deadline || null, req.params.id
  );
  res.json({ success: true });
}));

// ARCHIVE / RESTORE
router.post('/:id/archive', asyncHandler(async (req, res) => {
  db.prepare("UPDATE jobs SET status='archived', archived_at=datetime('now') WHERE id=?").run(req.params.id);
  db.prepare('INSERT INTO job_entries (job_id, user_id, type, content) VALUES (?,?,?,?)').run(
    req.params.id, req.user.id, 'archived', `Jobb arkiverat av ${req.user.display_name}`
  );
  res.json({ success: true });
}));

router.post('/:id/restore', asyncHandler(async (req, res) => {
  db.prepare("UPDATE jobs SET status='active', archived_at=NULL WHERE id=?").run(req.params.id);
  db.prepare('INSERT INTO job_entries (job_id, user_id, type, content) VALUES (?,?,?,?)').run(
    req.params.id, req.user.id, 'restored', `Jobb återöppnat av ${req.user.display_name}`
  );
  res.json({ success: true });
}));

// DELETE JOB (admin only)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM jobs WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

// ADD ENTRY (note/photo)
router.post('/:id/entries', asyncHandler(async (req, res) => {
  const data = jobEntrySchema.parse(req.body);
  let image_url = null;

  if (data.image_data) {
    const { randomUUID } = require('crypto');
    const path = require('path');
    const fs = require('fs');
    const config = require('../config');
    const UPLOAD_DIR = config.uploadDir;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = data.mime_type === 'image/png' ? 'png' : 'jpg';
    const filename = `job_${randomUUID()}.${ext}`;
    const base64 = data.image_data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(base64, 'base64'));
    image_url = `/uploads/${filename}`;
  }

  const result = db.prepare(
    'INSERT INTO job_entries (job_id, user_id, type, content, image_url) VALUES (?,?,?,?,?)'
  ).run(req.params.id, req.user.id, data.type, data.content, image_url);

  const entry = db.prepare(`
    SELECT e.*, u.display_name as user_name
    FROM job_entries e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.id = ?
  `).get(result.lastInsertRowid);

  res.json(entry);
}));

// DELETE ENTRY
router.delete('/:id/entries/:entry_id', asyncHandler(async (req, res) => {
  const entry = db.prepare('SELECT * FROM job_entries WHERE id=?').get(req.params.entry_id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  if (entry.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM job_entries WHERE id=?').run(req.params.entry_id);
  res.json({ success: true });
}));

// MATERIALS
router.post('/:id/materials', asyncHandler(async (req, res) => {
  const data = jobMaterialSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO job_materials (job_id, product_id, e_number, product_name, quantity, unit, added_by) VALUES (?,?,?,?,?,?,?)'
  ).run(req.params.id, data.product_id || null, data.e_number, data.product_name, data.quantity, data.unit, req.user.id);
  res.json({ id: result.lastInsertRowid });
}));

router.delete('/:id/materials/:mat_id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM job_materials WHERE id=? AND job_id=?').run(req.params.mat_id, req.params.id);
  res.json({ success: true });
}));

// JOB BOOKINGS
router.get('/:id/bookings', asyncHandler(async (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, u.display_name as created_by_name
    FROM job_bookings b LEFT JOIN users u ON u.id = b.created_by
    WHERE b.job_id = ? ORDER BY b.start_datetime ASC
  `).all(req.params.id);
  res.json(bookings);
}));

router.post('/:id/bookings', asyncHandler(async (req, res) => {
  const { title, start_datetime, end_datetime, notes } = req.body;
  if (!title || !start_datetime) return res.status(400).json({ error: 'Titel och starttid krävs' });
  const result = db.prepare(
    'INSERT INTO job_bookings (job_id, title, start_datetime, end_datetime, notes, created_by) VALUES (?,?,?,?,?,?)'
  ).run(req.params.id, title, start_datetime, end_datetime || null, notes || '', req.user.id);

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    db.prepare(`INSERT INTO calendar_events (title, description, start_datetime, end_datetime, all_day, type, job_id, color, reminder_minutes, created_by)
      VALUES (?,?,?,?,0,'booking',?,?,60,?)`).run(
      `${job.customer_name}${job.order_number?' ('+job.order_number+')':''} — ${title}`,
      notes || '', start_datetime, end_datetime || null, req.params.id, '#60a5fa', req.user.id
    );
  } catch(e) {}

  res.json({ id: result.lastInsertRowid });
}));

router.delete('/:id/bookings/:bid', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM job_bookings WHERE id=? AND job_id=?').run(req.params.bid, req.params.id);
  res.json({ success: true });
}));

// SHARE JOB
router.post('/:id/share', asyncHandler(async (req, res) => {
  const { is_shared, shared_with } = req.body;
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (job.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE jobs SET is_shared=?, shared_with=? WHERE id=?').run(
    is_shared ? 1 : 0, JSON.stringify(shared_with || []), req.params.id
  );
  res.json({ success: true });
}));

module.exports = router;
