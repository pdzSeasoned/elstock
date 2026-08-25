const router = require('express').Router();
const db = require('../db/database');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { checkoutSchema } = require('../schemas/validation');
const fs = require('fs');
const path = require('path');

router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════
// HJÄLPFUNKTION: Hitta en font som stöder svenska tecken (åäö)
// ═══════════════════════════════════════════════════════════════════════════

// 1. Försök lokal font i projektet (mest pålitligt)
const LOCAL_FONT_DIR = path.join(__dirname, '../../assets/fonts');
const LOCAL_FONT = path.join(LOCAL_FONT_DIR, 'NotoSans-Regular.ttf');

// 2. Fallback till systemfonter om lokal saknas
const SYSTEM_FONTS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
];

function resolveFont() {
  // Prioritet 1: Lokal font i projektet
  if (fs.existsSync(LOCAL_FONT)) {
    return { regular: LOCAL_FONT, bold: LOCAL_FONT, source: 'lokal' };
  }

  // Prioritet 2: Systemfont
  const regular = SYSTEM_FONTS.find(p => fs.existsSync(p) && !p.toLowerCase().includes('bold'));
  const bold = SYSTEM_FONTS.find(p => fs.existsSync(p));

  if (regular) {
    return { regular, bold: bold || regular, source: 'system' };
  }

  // Prioritet 3: PDFKit-standard (åäö fungerar INTE)
  return { regular: null, bold: null, source: 'fallback' };
}

const FONT = resolveFont();

if (FONT.source === 'fallback') {
  console.warn('[PDF] ⚠️  Ingen Unicode-font hittad. Svenska tecken (åäö) blir konstiga i PDF.');
  console.warn('[PDF]    Lösning: Kopiera NotoSans-Regular.ttf till backend/assets/fonts/');
} else {
  console.log(`[PDF] ✅ Använder ${FONT.source}-font: ${path.basename(FONT.regular)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════════════════════
router.post('/checkout', asyncHandler(async (req, res) => {
  const data = checkoutSchema.parse(req.body);

  const stockCheck = db.prepare('SELECT quantity FROM inventory WHERE warehouse_id=? AND product_id=?');
  for (const item of data.items) {
    const inv = stockCheck.get(data.warehouse_id, item.product_id);
    if (!inv) return res.status(400).json({ error: `Product ${item.product_id} not in this warehouse` });
    if (inv.quantity < item.quantity) {
      const p = db.prepare('SELECT name FROM products WHERE id=?').get(item.product_id);
      return res.status(400).json({ error: `Not enough stock for ${p?.name}. Available: ${inv.quantity}` });
    }
  }

  const checkout = db.transaction(() => {
    const tx = db.prepare('INSERT INTO transactions (type, warehouse_id, user_id, customer_name, customer_address, work_order, notes) VALUES (?,?,?,?,?,?,?)').run(
      'checkout', data.warehouse_id, req.user.id, data.customer_name, data.customer_address, data.work_order, data.notes
    );
    const insertItem = db.prepare('INSERT INTO transaction_items (transaction_id, product_id, e_number, product_name, quantity, unit) VALUES (?,?,?,?,?,?)');
    const deduct = db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id=? AND product_id=?');
    const receiptItems = [];
    for (const item of data.items) {
      const p = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
      insertItem.run(tx.lastInsertRowid, item.product_id, p.e_number, p.name, item.quantity, p.unit);
      deduct.run(item.quantity, data.warehouse_id, item.product_id);
      receiptItems.push({ e_number: p.e_number, name: p.name, quantity: item.quantity, unit: p.unit });
    }
    return { transaction_id: tx.lastInsertRowid, items: receiptItems };
  });

  const result = checkout();
  const tx = db.prepare('SELECT * FROM transactions WHERE id=?').get(result.transaction_id);
  const wh = db.prepare('SELECT * FROM warehouses WHERE id=?').get(data.warehouse_id);

  const safeProductIds = data.items.map(i => Number(i.product_id)).filter(id => Number.isInteger(id) && id > 0);

  let lowStock = [];
  if (safeProductIds.length > 0) {
    const placeholders = safeProductIds.map(() => '?').join(',');
    lowStock = db.prepare(`
      SELECT p.name, i.quantity, i.min_quantity
      FROM inventory i JOIN products p ON p.id = i.product_id
      WHERE i.warehouse_id=? AND i.quantity <= i.min_quantity
      AND i.product_id IN (${placeholders})
    `).all(data.warehouse_id, ...safeProductIds);
  }

  const { notifyLowStock } = require('../notifications');
  if (lowStock.length > 0) notifyLowStock(lowStock, wh.name).catch(()=>{});

  res.json({
    success: true,
    transaction_id: result.transaction_id,
    receipt: {
      id: result.transaction_id,
      date: tx.created_at,
      warehouse: wh.name,
      user: req.user.display_name,
      customer_name: data.customer_name,
      customer_address: data.customer_address,
      work_order: data.work_order,
      items: result.items,
    },
    low_stock_warnings: lowStock
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════════════════
router.get('/history', asyncHandler(async (req, res) => {
  const { warehouse_id, limit=50, offset=0, type } = req.query;
  let sql = `SELECT t.*, u.display_name as user_name, w.name as warehouse_name
    FROM transactions t JOIN users u ON u.id=t.user_id JOIN warehouses w ON w.id=t.warehouse_id WHERE 1=1`;
  const params = [];

  if (req.user.role !== 'admin') { sql += ' AND t.user_id=?'; params.push(req.user.id); }
  if (warehouse_id) { sql += ' AND t.warehouse_id=?'; params.push(warehouse_id); }
  if (type) { sql += ' AND t.type=?'; params.push(type); }
  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const txs = db.prepare(sql).all(...params);
  const getItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id=?');
  res.json(txs.map(tx => ({ ...tx, items: getItems.all(tx.id) })));
}));

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE RECEIPT
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:id', asyncHandler(async (req, res) => {
  const tx = db.prepare(`SELECT t.*, u.display_name as user_name, w.name as warehouse_name
    FROM transactions t JOIN users u ON u.id=t.user_id JOIN warehouses w ON w.id=t.warehouse_id WHERE t.id=?`).get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && tx.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id=?').all(tx.id);
  res.json({ ...tx, items });
}));

// ═══════════════════════════════════════════════════════════════════════════
// DELETE TRANSACTION (admin only)
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const tx = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });

  if (tx.type === 'checkout') {
    const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id=?').all(tx.id);
    const restore = db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE warehouse_id=? AND product_id=?');
    db.transaction(() => {
      for (const item of items) restore.run(item.quantity, tx.warehouse_id, item.product_id);
      db.prepare('DELETE FROM transaction_items WHERE transaction_id=?').run(tx.id);
      db.prepare('DELETE FROM transactions WHERE id=?').run(tx.id);
    })();
  } else {
    db.prepare('DELETE FROM transaction_items WHERE transaction_id=?').run(tx.id);
    db.prepare('DELETE FROM transactions WHERE id=?').run(tx.id);
  }
  res.json({ success: true, stock_restored: tx.type === 'checkout' });
}));

// ═══════════════════════════════════════════════════════════════════════════
// GENERERA PDF FÖR KVITTO — MED SVENSKA TECKEN (åäö)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:id/pdf', auth, asyncHandler(async (req, res) => {
  const tx = db.prepare(
    `SELECT t.*, w.name as warehouse_name, u.display_name as user_name 
     FROM transactions t 
     JOIN warehouses w ON w.id=t.warehouse_id 
     JOIN users u ON u.id=t.user_id 
     WHERE t.id=?`
  ).get(req.params.id);

  if (!tx) return res.status(404).json({ error: 'Kvitto hittades inte' });
  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id=?').all(req.params.id);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kvitto-${tx.id}.pdf"`);
  doc.pipe(res);

  // Välj font — lokal eller system, fallback till Helvetica
  const hasUnicode = FONT.regular !== null;
  const fontBold   = hasUnicode ? 'CustomBold'   : 'Helvetica-Bold';
  const fontRegular = hasUnicode ? 'CustomRegular' : 'Helvetica';

  if (hasUnicode) {
    doc.registerFont('CustomRegular', FONT.regular);
    doc.registerFont('CustomBold', FONT.bold);
  }

  // ── Header ──
  doc.fontSize(24).font(fontBold).text('ElStock', { align: 'center' });
  doc.fontSize(12).font(fontRegular).text('Kvitto', { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Metadata ──
  doc.fontSize(11).font(fontRegular);
  doc.text(`Kvitto #${tx.id}`, { continued: true })
     .text(new Date(tx.created_at).toLocaleString('sv-SE'), { align: 'right' });
  doc.text(`Lager: ${tx.warehouse_name}`, { continued: true })
     .text(`Tekniker: ${tx.user_name}`, { align: 'right' });

  if (tx.customer_name) doc.text(`Kund: ${tx.customer_name}`);
  if (tx.customer_address) doc.text(`Adress: ${tx.customer_address}`);
  if (tx.work_order) doc.text(`AO-nr: ${tx.work_order}`);
  if (tx.notes) doc.text(`Anteckning: ${tx.notes}`);

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Tabellhuvud ──
  doc.font(fontBold).text('E-nummer', 50, doc.y, { width: 120 });
  doc.text('Artikel', 170, doc.y - doc.currentLineHeight(), { width: 260 });
  doc.text('Antal', 430, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
  doc.text('Enhet', 490, doc.y - doc.currentLineHeight(), { width: 55, align: 'right' });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  // ── Tabellrader ──
  doc.font(fontRegular);
  for (const item of items) {
    const y = doc.y;
    doc.text(item.e_number, 50, y, { width: 120 });
    doc.text(item.product_name, 170, y, { width: 260 });
    doc.text(String(item.quantity), 430, y, { width: 60, align: 'right' });
    doc.text(item.unit, 490, y, { width: 55, align: 'right' });
    doc.moveDown(0.8);
  }

  // ── Footer ──
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('gray').text(`ElStock · Kvitto #${tx.id}`, { align: 'center' });

  doc.end();
}));

module.exports = router;
