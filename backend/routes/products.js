const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { productSchema } = require('../schemas/validation');

router.use(auth);

router.get('/', asyncHandler(async (req, res) => {
  const { q, category_id, brand } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (e_number LIKE ? OR name LIKE ? OR barcode = ?)'; params.push(`%${q}%`, `%${q}%`, q); }
  if (category_id) { sql += ' AND (category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))'; params.push(category_id, category_id); }
  if (brand) { sql += ' AND brand = ?'; params.push(brand); }
  sql += ' ORDER BY name LIMIT 500';
  res.json(db.prepare(sql).all(...params));
}));

router.get('/barcode/:code', asyncHandler(async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE barcode = ? OR e_number = ?').get(req.params.code, req.params.code);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
}));

router.get('/meta/categories', asyncHandler(async (req, res) => {
  const cats = db.prepare('SELECT DISTINCT category_id, category FROM products WHERE category_id IS NOT NULL ORDER BY category').all();
  res.json(cats);
}));

router.get('/meta/brands', asyncHandler(async (req, res) => {
  const brands = db.prepare('SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand').all();
  res.json(brands.map(b => b.brand));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const stock = db.prepare(`
    SELECT i.quantity, i.min_quantity, w.id as warehouse_id, w.name as warehouse_name, w.type as warehouse_type
    FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.product_id = ?
  `).all(req.params.id);
  try { p.attributes = JSON.parse(p.attributes || '{}'); } catch(e) { p.attributes = {}; }
  res.json({ ...p, stock });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO products (e_number, name, description, unit, barcode, category_id, category, image_url, brand, attributes) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(data.e_number.trim(), data.name, data.description, data.unit, data.barcode, data.category_id, data.category, data.image_url, data.brand, JSON.stringify(data.attributes));
  res.json({ id: result.lastInsertRowid, e_number: data.e_number, name: data.name });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  db.prepare(
    'UPDATE products SET e_number=?,name=?,description=?,unit=?,barcode=?,category_id=?,category=?,image_url=?,brand=?,attributes=? WHERE id=?'
  ).run(data.e_number.trim(), data.name, data.description, data.unit, data.barcode, data.category_id, data.category, data.image_url, data.brand, JSON.stringify(data.attributes), req.params.id);
  res.json({ success: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as c FROM transaction_items WHERE product_id = ?').get(req.params.id);
  if (used.c > 0) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(req.params.id);
    db.prepare("UPDATE products SET e_number = e_number || ? WHERE id = ?").run('_del'+req.params.id, req.params.id);
    return res.json({ success: true });
  }
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
