const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { warehouseSchema } = require('../schemas/validation');

router.use(auth);

// List all warehouses
router.get('/', asyncHandler(async (req, res) => {
  const warehouses = db.prepare(`
    SELECT w.*, u.display_name as created_by_name,
    (SELECT COUNT(*) FROM inventory i WHERE i.warehouse_id = w.id) as product_count,
    (SELECT COUNT(*) FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.warehouse_id = w.id AND i.quantity <= i.min_quantity) as low_stock_count
    FROM warehouses w
    LEFT JOIN users u ON u.id = w.created_by
    ORDER BY w.name
  `).all();
  res.json(warehouses);
}));

// Get single warehouse with inventory
router.get('/:id', asyncHandler(async (req, res) => {
  const wh = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  const inventory = db.prepare(`
    SELECT i.*, p.e_number, p.name, p.description, p.unit, p.barcode, p.category, p.image_url, p.brand
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.warehouse_id = ?
    ORDER BY p.category, p.name
  `).all(req.params.id);

  res.json({ ...wh, inventory });
}));

// Create warehouse
router.post('/', asyncHandler(async (req, res) => {
  const data = warehouseSchema.parse(req.body);
  const result = db.prepare('INSERT INTO warehouses (name, type, description, created_by) VALUES (?, ?, ?, ?)').run(
    data.name, data.type, data.description, req.user.id
  );
  res.json({ id: result.lastInsertRowid, name: data.name, type: data.type, description: data.description });
}));

// Update warehouse
router.put('/:id', asyncHandler(async (req, res) => {
  const data = warehouseSchema.parse(req.body);
  db.prepare('UPDATE warehouses SET name=?, type=?, description=? WHERE id=?').run(data.name, data.type, data.description, req.params.id);
  res.json({ success: true });
}));

// Delete warehouse
router.delete('/:id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
