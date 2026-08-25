const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');

// ── PUBLIC (authenticated) ────────────────────────────────────────────────────

// Get all categories with filters (for catalog)
router.get('/', auth, (req, res) => {
  const cats = db.prepare(`
    SELECT c.*, p.name as parent_name
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name
  `).all();

  const result = cats.map(cat => {
    const filters = db.prepare('SELECT id, category_id, filter_id, label, filter_values, sort_order FROM category_filters WHERE category_id=? ORDER BY sort_order').all(cat.id);
    const brands = db.prepare('SELECT name FROM brands ORDER BY sort_order, name').all().map(b => b.name);
    return {
      ...cat,
      filters: [
        ...filters.map(f => ({ id: f.filter_id, label: f.label, values: JSON.parse(f.filter_values) })),
        { id: 'brand', label: 'Märke', values: brands }
      ]
    };
  });
  res.json(result);
});

// Get brands
router.get('/brands', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM brands ORDER BY sort_order, name').all());
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// Create category
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, icon, parent_id, slug } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  // Auto-generate slug
  const autoSlug = slug || name.toLowerCase()
    .replace(/å/g,'a').replace(/ä/g,'a').replace(/ö/g,'o')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories WHERE parent_id IS ?').get(parent_id||null)?.m || 0;

  try {
    const result = db.prepare('INSERT INTO categories (slug, name, icon, parent_id, sort_order) VALUES (?,?,?,?,?)').run(
      autoSlug, name, icon||'📦', parent_id||null, maxOrder+1
    );
    res.json({ id: result.lastInsertRowid, slug: autoSlug, name });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists, try a different name' });
    res.status(500).json({ error: e.message });
  }
});

// Update category
router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, icon, parent_id } = req.body;
  db.prepare('UPDATE categories SET name=?, icon=?, parent_id=? WHERE id=?').run(
    name, icon||'📦', parent_id||null, req.params.id
  );
  res.json({ success: true });
});

// Delete category
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  // Move products to uncategorized
  db.prepare('UPDATE products SET category_id=NULL, category=NULL WHERE category_id=?').run(req.params.id);
  // Move subcategories to top level
  db.prepare('UPDATE categories SET parent_id=NULL WHERE parent_id=?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── FILTERS ───────────────────────────────────────────────────────────────────

// Get filters for a category
router.get('/:id/filters', auth, (req, res) => {
  const filters = db.prepare('SELECT id, category_id, filter_id, label, filter_values, sort_order FROM category_filters WHERE category_id=? ORDER BY sort_order').all(req.params.id);
  res.json(filters.map(f => ({ ...f, values: JSON.parse(f.filter_values) })));
});

// Save all filters for a category (replace)
router.put('/:id/filters', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { filters } = req.body; // [{ filter_id, label, values: [] }]
  db.transaction(() => {
    db.prepare('DELETE FROM category_filters WHERE category_id=?').run(req.params.id);
    const ins = db.prepare('INSERT INTO category_filters (category_id, filter_id, label, filter_values, sort_order) VALUES (?,?,?,?,?)');
    (filters||[]).forEach((f,i) => ins.run(req.params.id, f.filter_id, f.label, JSON.stringify(f.values||[]), i));
  })();
  res.json({ success: true });
});

// ── BRANDS ────────────────────────────────────────────────────────────────────

router.post('/brands', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM brands').get()?.m || 0;
    const result = db.prepare('INSERT INTO brands (name, sort_order) VALUES (?,?)').run(name.trim(), maxOrder+1);
    res.json({ id: result.lastInsertRowid, name });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Brand already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/brands/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('UPDATE brands SET name=? WHERE id=?').run(req.body.name, req.params.id);
  res.json({ success: true });
});

router.delete('/brands/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM brands WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
