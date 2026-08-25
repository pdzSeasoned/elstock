const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const asyncHandler = require('../middleware/asyncHandler');
const { customerSchema } = require('../schemas/validation');

router.use(auth);

// Auto-generate next customer number
function nextCustomerNumber(parentId = null) {
  if (parentId) {
    const parent = db.prepare('SELECT customer_number FROM customers WHERE id=?').get(parentId);
    const existingCount = db.prepare('SELECT COUNT(*) as c FROM customers WHERE parent_id=?').get(parentId).c;
    return `${parent.customer_number}-${existingCount + 1}`;
  }
  const last = db.prepare("SELECT customer_number FROM customers WHERE parent_id IS NULL ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'K-0001';
  const num = parseInt(last.customer_number.replace(/\D/g,'')) || 0;
  return `K-${String(num + 1).padStart(4, '0')}`;
}

function getLevel(id) {
  const c = db.prepare('SELECT parent_id FROM customers WHERE id=?').get(id);
  if (!c || !c.parent_id) return 0;
  const p = db.prepare('SELECT parent_id FROM customers WHERE id=?').get(c.parent_id);
  if (!p || !p.parent_id) return 1;
  return 2;
}

// LIST / SEARCH
router.get('/', asyncHandler(async (req, res) => {
  const { q, parent_id } = req.query;
  let sql = `
    SELECT c.*,
    (SELECT COUNT(*) FROM customers sub WHERE sub.parent_id = c.id) as child_count,
    (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id) as job_count,
    (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id AND j.status = 'active') as active_jobs
    FROM customers c WHERE 1=1
  `;
  const params = [];

  if (parent_id) {
    sql += ' AND c.parent_id = ?';
    params.push(parent_id);
  } else if (!q) {
    sql += ' AND c.parent_id IS NULL';
  }

  if (q) {
    sql += ' AND (c.name LIKE ? OR c.company LIKE ? OR c.customer_number LIKE ? OR c.phone LIKE ? OR c.address LIKE ? OR c.city LIKE ?)';
    params.push(...Array(6).fill(`%${q}%`));
  }

  sql += ' ORDER BY c.name ASC';
  res.json(db.prepare(sql).all(...params));
}));

// GET SINGLE
router.get('/:id', asyncHandler(async (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Not found' });

  const children = db.prepare(`
    SELECT c.*,
    (SELECT COUNT(*) FROM customers sub WHERE sub.parent_id = c.id) as child_count,
    (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id) as job_count,
    (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id AND j.status = 'active') as active_jobs
    FROM customers c WHERE c.parent_id = ? ORDER BY c.name ASC
  `).all(req.params.id);

  const parent = customer.parent_id
    ? db.prepare('SELECT id, name, customer_number, parent_id FROM customers WHERE id=?').get(customer.parent_id)
    : null;

  const grandparent = parent?.parent_id
    ? db.prepare('SELECT id, name, customer_number FROM customers WHERE id=?').get(parent.parent_id)
    : null;

  const jobs = db.prepare(`
    SELECT j.id, j.order_number, j.customer_name, j.description, j.status, j.deadline, j.created_at, j.address
    FROM jobs j WHERE j.customer_id = ? ORDER BY j.created_at DESC
  `).all(req.params.id);

  const photos = db.prepare(`
    SELECT gp.* FROM global_photos gp
    WHERE gp.customer_id = ?
    ORDER BY gp.created_at DESC LIMIT 20
  `).all(req.params.id);

  const level = getLevel(req.params.id);

  res.json({ ...customer, children, parent, grandparent, jobs, photos, level });
}));

// CREATE
router.post('/', asyncHandler(async (req, res) => {
  const data = customerSchema.parse(req.body);
  const num = data.customer_number || nextCustomerNumber(data.parent_id || null);
  const result = db.prepare(
    'INSERT INTO customers (customer_number, name, customer_name, company, phone, email, address, city, notes, parent_id, location_type, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(num, data.name, data.name, data.company, data.phone, data.email, data.address, data.city, data.notes, data.parent_id || null, data.location_type || null, req.user.id);
  res.json({ id: result.lastInsertRowid, customer_number: num, name: data.name });
}));

// UPDATE
router.put('/:id', asyncHandler(async (req, res) => {
  const data = customerSchema.parse(req.body);
  db.prepare('UPDATE customers SET name=?, company=?, phone=?, email=?, address=?, city=?, notes=?, location_type=?, updated_at=datetime("now") WHERE id=?').run(
    data.name, data.company, data.phone, data.email, data.address, data.city, data.notes, data.location_type || null, req.params.id
  );
  res.json({ success: true });
}));

// DELETE (admin only)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  function deleteRecursive(id) {
    const children = db.prepare('SELECT id FROM customers WHERE parent_id=?').all(id);
    for (const child of children) deleteRecursive(child.id);
    db.prepare('UPDATE jobs SET customer_id=NULL WHERE customer_id=?').run(id);
    db.prepare('DELETE FROM customers WHERE id=?').run(id);
  }
  deleteRecursive(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
