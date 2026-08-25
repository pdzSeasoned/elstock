const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');

router.use(auth);

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Auto-radera resor äldre än 6 månader
try {
  db.prepare("DELETE FROM trips WHERE started_at < datetime('now', '-6 months')").run();
} catch(e) {}

// Hämta resor
router.get('/', (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const query = isAdmin
    ? `SELECT t.*, u.display_name, u.username, j.customer_name as job_customer
       FROM trips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN jobs j ON j.id = t.job_id
       ORDER BY t.started_at DESC LIMIT 200`
    : `SELECT t.*, u.display_name, u.username, j.customer_name as job_customer
       FROM trips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN jobs j ON j.id = t.job_id
       WHERE t.user_id = ?
       ORDER BY t.started_at DESC LIMIT 200`;
  const trips = isAdmin ? db.prepare(query).all() : db.prepare(query).all(req.user.id);
  res.json(trips);
});

// Kolla aktiv resa
router.get('/active', (req, res) => {
  const active = db.prepare(`
    SELECT t.*, j.customer_name as job_customer
    FROM trips t LEFT JOIN jobs j ON j.id=t.job_id
    WHERE t.user_id=? AND t.status='active'
  `).get(req.user.id);
  res.json(active || null);
});

// Exportera som CSV
router.get('/export/csv', (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { from, to, user_id } = req.query;
  let query = `SELECT t.*, u.display_name, j.customer_name as job_customer
    FROM trips t JOIN users u ON u.id=t.user_id LEFT JOIN jobs j ON j.id=t.job_id
    WHERE t.status='ended'`;
  const params = [];
  if (!isAdmin) { query += ' AND t.user_id=?'; params.push(req.user.id); }
  else if (user_id) { query += ' AND t.user_id=?'; params.push(user_id); }
  if (from) { query += ' AND date(t.started_at) >= ?'; params.push(from); }
  if (to) { query += ' AND date(t.started_at) <= ?'; params.push(to); }
  query += ' ORDER BY t.started_at DESC';
  const trips = db.prepare(query).all(...params);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="farddagbok.csv"');
  res.write('\uFEFF');
  res.write('Datum,Tekniker,Start,Slut,Sträcka (km),Jobb,Anteckningar\n');
  for (const t of trips) {
    const date = t.started_at?.substring(0,10) || '';
    const start = t.started_at?.substring(11,16) || '';
    const end = t.ended_at?.substring(11,16) || '';
    const km = t.distance_km || 0;
    const job = (t.job_customer || '').replace(/,/g,' ');
    const notes = (t.notes || '').replace(/,/g,' ').replace(/\n/g,' ');
    res.write(`${date},${t.display_name},${start},${end},${km},"${job}","${notes}"\n`);
  }
  res.end();
});

// Starta resa
router.post('/start', (req, res) => {
  const { lat, lng, job_id, notes } = req.body;
  const active = db.prepare("SELECT id FROM trips WHERE user_id=? AND status='active'").get(req.user.id);
  if (active) {
    db.prepare("UPDATE trips SET status='ended', ended_at=datetime('now') WHERE id=?").run(active.id);
  }
  const result = db.prepare(
    'INSERT INTO trips (user_id, job_id, start_lat, start_lng, notes, status) VALUES (?,?,?,?,?,?)'
  ).run(req.user.id, job_id||null, lat||null, lng||null, notes||'', 'active');
  if (lat && lng) {
    db.prepare('INSERT INTO trip_points (trip_id, lat, lng) VALUES (?,?,?)').run(result.lastInsertRowid, lat, lng);
  }
  res.json({ success: true, trip_id: result.lastInsertRowid });
});

// Stoppa resa
router.post('/:id/stop', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Resa hittades inte' });
  const { lat, lng, notes } = req.body;

  const points = db.prepare('SELECT lat, lng FROM trip_points WHERE trip_id=? ORDER BY recorded_at').all(req.params.id);
  if (lat && lng) {
    db.prepare('INSERT INTO trip_points (trip_id, lat, lng) VALUES (?,?,?)').run(req.params.id, lat, lng);
    points.push({ lat, lng });
  }

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }

  db.prepare(`UPDATE trips SET status='ended', ended_at=datetime('now'), end_lat=?, end_lng=?, distance_km=?, notes=COALESCE(NULLIF(?,''), notes) WHERE id=?`)
    .run(lat||null, lng||null, Math.round(distance*10)/10, notes||'', req.params.id);

  res.json({ success: true, distance_km: Math.round(distance*10)/10 });
});

// Spåra position under aktiv resa
router.post('/track', (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.json({ success: false });
  const active = db.prepare("SELECT id FROM trips WHERE user_id=? AND status='active'").get(req.user.id);
  if (!active) return res.json({ success: false });

  db.prepare('INSERT INTO trip_points (trip_id, lat, lng) VALUES (?,?,?)').run(active.id, lat, lng);

  const points = db.prepare('SELECT lat, lng FROM trip_points WHERE trip_id=? ORDER BY recorded_at').all(active.id);
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversine(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }
  db.prepare('UPDATE trips SET distance_km=? WHERE id=?').run(Math.round(distance*10)/10, active.id);
  res.json({ success: true });
});

// Hämta punkter för en resa
router.get('/:id/points', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id=?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Hittades inte' });
  if (trip.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Ej tillåtet' });
  const points = db.prepare('SELECT lat, lng, recorded_at FROM trip_points WHERE trip_id=? ORDER BY recorded_at').all(req.params.id);
  res.json(points);
});

// Ta bort resa
router.delete('/:id', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id=?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Hittades inte' });
  if (trip.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Ej tillåtet' });
  db.prepare('DELETE FROM trips WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
