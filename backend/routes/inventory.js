const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { sendLowStockNotification } = require('../push');

router.use(auth);

// Set/update inventory item in a warehouse
router.post('/set', (req, res) => {
  const { warehouse_id, product_id, quantity, min_quantity } = req.body;
  const existing = db.prepare('SELECT id FROM inventory WHERE warehouse_id=? AND product_id=?').get(warehouse_id, product_id);
  if (existing) {
    db.prepare('UPDATE inventory SET quantity=?, min_quantity=? WHERE warehouse_id=? AND product_id=?').run(quantity, min_quantity ?? 2, warehouse_id, product_id);
  } else {
    db.prepare('INSERT INTO inventory (warehouse_id, product_id, quantity, min_quantity) VALUES (?, ?, ?, ?)').run(warehouse_id, product_id, quantity, min_quantity ?? 2);
  }
  res.json({ success: true });
});

// Add product to warehouse (if not exists) with 0 stock
router.post('/add-product', (req, res) => {
  const { warehouse_id, product_id, min_quantity } = req.body;
  try {
    db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity, min_quantity) VALUES (?, ?, 0, ?)').run(warehouse_id, product_id, min_quantity ?? 2);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove product from warehouse
router.delete('/:warehouse_id/:product_id', (req, res) => {
  db.prepare('DELETE FROM inventory WHERE warehouse_id=? AND product_id=?').run(req.params.warehouse_id, req.params.product_id);
  res.json({ success: true });
});

// Restock — add quantity (filling up from big warehouse)
router.post('/restock', (req, res) => {
  const { warehouse_id, items } = req.body;
  // items: [{ product_id, quantity }]
  const updateStmt = db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE warehouse_id=? AND product_id=?');
  
  const restock = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.quantity, warehouse_id, item.product_id);
    }
  });
  restock(items);

  // Log as restock transaction
  const txResult = db.prepare('INSERT INTO transactions (type, warehouse_id, user_id, notes) VALUES (?, ?, ?, ?)').run('restock', warehouse_id, req.user.id, req.body.notes || '');
  const insertItem = db.prepare('INSERT INTO transaction_items (transaction_id, product_id, e_number, product_name, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)');
  for (const item of items) {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
    if (p) insertItem.run(txResult.lastInsertRowid, item.product_id, p.e_number, p.name, item.quantity, p.unit);
  }

  res.json({ success: true, transaction_id: txResult.lastInsertRowid });
});

// Get low stock items across all warehouses (or specific one)
router.get('/low-stock', (req, res) => {
  const { warehouse_id } = req.query;
  let sql = `
    SELECT i.quantity, i.min_quantity, p.e_number, p.name, p.unit, p.category,
           w.id as warehouse_id, w.name as warehouse_name, w.type as warehouse_type
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN warehouses w ON w.id = i.warehouse_id
    WHERE i.quantity <= i.min_quantity
  `;
  const params = [];
  if (warehouse_id) { sql += ' AND i.warehouse_id = ?'; params.push(warehouse_id); }
  sql += ' ORDER BY w.name, p.name';
  res.json(db.prepare(sql).all(...params));
});

// Update min_quantity (alert threshold)
router.post('/threshold', (req, res) => {
  const { warehouse_id, product_id, min_quantity } = req.body;
  db.prepare('UPDATE inventory SET min_quantity=? WHERE warehouse_id=? AND product_id=?').run(min_quantity, warehouse_id, product_id);
  res.json({ success: true });
});

module.exports = router;
