const router = require('express').Router();
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const db = require('../db/database');

router.use(auth);

router.get('/', (req, res) => {
  const equipment = db.prepare(`
    SELECT e.id, e.name, e.description, e.icon,
           ea.user_id, ea.assigned_at, ea.notes,
           ea.at_warehouse,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE u.display_name END as display_name,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE u.username END as username,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE u.color END as color,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE ul.lat END as lat,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE ul.lng END as lng,
           CASE WHEN ea.at_warehouse=1 THEN NULL ELSE ul.updated_at END as location_updated
    FROM equipment e
    LEFT JOIN equipment_assignments ea ON ea.equipment_id = e.id
    LEFT JOIN users u ON u.id = ea.user_id
    LEFT JOIN user_locations ul ON ul.user_id = ea.user_id
    ORDER BY e.name
  `).all();

  const geoLat = parseFloat(db.prepare("SELECT value FROM settings WHERE key='geo_lat'").get()?.value);
  const geoLng = parseFloat(db.prepare("SELECT value FROM settings WHERE key='geo_lng'").get()?.value);
  const geoName = db.prepare("SELECT value FROM settings WHERE key='geo_name'").get()?.value || 'Centrallagret';

  const result = equipment.map(e => {
    if (e.at_warehouse === 1 && !isNaN(geoLat)) {
      return { ...e, lat: geoLat, lng: geoLng, display_name: geoName, location_updated: new Date().toISOString() };
    }
    return e;
  });

  res.json(result);
});

router.post('/', adminOnly, (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Namn kravs' });
  const result = db.prepare('INSERT INTO equipment (name, description, icon, created_by) VALUES (?,?,?,?)').run(name, description||'', icon||'🔧', req.user.id);
  res.json({ id: result.lastInsertRowid, name, description, icon });
});

router.put('/:id', adminOnly, (req, res) => {
  const { name, description, icon } = req.body;
  db.prepare('UPDATE equipment SET name=?, description=?, icon=? WHERE id=?').run(name, description||'', icon||'🔧', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM equipment WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/assign', adminOnly, (req, res) => {
  const { user_id, at_warehouse } = req.body;
  db.prepare('DELETE FROM equipment_assignments WHERE equipment_id=?').run(req.params.id);
  if (user_id) {
    db.prepare('INSERT INTO equipment_assignments (equipment_id, user_id, notes, assigned_by, at_warehouse) VALUES (?,?,?,?,0)').run(
      req.params.id, user_id, '', req.user.id, 0
    );
    db.prepare('INSERT INTO equipment_history (equipment_id, user_id, action) VALUES (?,?,?)').run(req.params.id, user_id, 'assigned');
  } else if (at_warehouse) {
    db.prepare('INSERT INTO equipment_assignments (equipment_id, user_id, notes, assigned_by, at_warehouse) VALUES (?,?,?,?,1)').run(
      req.params.id, req.user.id, 'warehouse', req.user.id, 1
    );
    db.prepare('INSERT INTO equipment_history (equipment_id, user_id, action) VALUES (?,?,?)').run(req.params.id, req.user.id, 'returned_to_warehouse');
  }
  res.json({ success: true });
});

router.get('/users/list', (req, res) => {
  const users = db.prepare('SELECT id, display_name, username, color FROM users ORDER BY display_name').all();
  res.json(users);
});

router.post('/:id/take', (req, res) => {
  const equip = db.prepare('SELECT * FROM equipment WHERE id=?').get(req.params.id);
  if (!equip) return res.status(404).json({ error: 'Hittades inte' });
  db.prepare('DELETE FROM equipment_assignments WHERE equipment_id=?').run(req.params.id);
  db.prepare('INSERT INTO equipment_assignments (equipment_id, user_id, notes, assigned_by, at_warehouse) VALUES (?,?,?,?,0)').run(
    req.params.id, req.user.id, '', req.user.id
  );
  db.prepare('INSERT INTO equipment_history (equipment_id, user_id, action) VALUES (?,?,?)').run(req.params.id, req.user.id, 'taken');
  res.json({ success: true });
});

router.post('/:id/return', (req, res) => {
  db.prepare('DELETE FROM equipment_assignments WHERE equipment_id=?').run(req.params.id);
  db.prepare('INSERT INTO equipment_assignments (equipment_id, user_id, notes, assigned_by, at_warehouse) VALUES (?,?,?,?,1)').run(
    req.params.id, req.user.id, 'warehouse', req.user.id
  );
  db.prepare('INSERT INTO equipment_history (equipment_id, user_id, action) VALUES (?,?,?)').run(req.params.id, req.user.id, 'returned');
  res.json({ success: true });
});

// Hämta historik för en utrustning
router.get('/:id/history', (req, res) => {
  const history = db.prepare(`
    SELECT eh.*, u.display_name, u.username
    FROM equipment_history eh
    LEFT JOIN users u ON u.id = eh.user_id
    WHERE eh.equipment_id = ?
    ORDER BY eh.created_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(history);
});

module.exports = router;