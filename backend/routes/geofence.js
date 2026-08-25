const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const db = require('../db/database');
const { sendTelegram } = require('../notifications');
const config = require('../config');

// ── HELPERS ───────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row?.value;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run(key, String(value));
}

async function buildShoppingList() {
  const lowStock = db.prepare(`
    SELECT i.quantity, i.min_quantity, p.e_number, p.name, p.unit, p.category,
    w.name as warehouse_name
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN warehouses w ON w.id = i.warehouse_id
    WHERE i.quantity <= i.min_quantity
    ORDER BY w.name, p.category, p.name
  `).all();
  return lowStock;
}

async function sendShoppingListTelegram(items, locationName) {
  if (items.length === 0) {
    await sendTelegram(`✅ **ElStock — Du är vid ${locationName}!**\n\nAllt är i lager, inget behöver fyllas på just nu. 👍`);
    return;
  }

  const grouped = {};
  for (const item of items) {
    if (!grouped[item.warehouse_name]) grouped[item.warehouse_name] = [];
    grouped[item.warehouse_name].push(item);
  }

  let msg = `🏭 **ElStock — Du är vid ${locationName}!**\n`;
  msg += ` _Fyll på följande artiklar:_\n\n`;

  for (const [wh, whItems] of Object.entries(grouped)) {
    msg += ` **📦 ${wh}**\n`;
    for (const item of whItems) {
      const needed = Math.ceil(item.min_quantity * 3 - item.quantity);
      const emoji = item.quantity === 0 ? '🔴' : '🟡';
      msg += `${emoji} ${item.name}\n`;
      msg += " E-nr: `" + item.e_number + "` · Saldo: " + item.quantity + " " + item.unit;
      if (needed > 0) msg += " · Ta: ~" + needed + " " + item.unit;
      msg += '\n';
    }
    msg += '\n';
  }
  msg += ` _Totalt ${items.length} artikel${items.length>1?'ar':''} behöver fyllas på_ `;
  await sendTelegram(msg);
}

// ── OWNTRACKS / LOCATIVE WEBHOOK ──────────────────────────────────────────────
// Denna endpoint kan inte kräva Bearer-JWT (OwnTracks/Locative stödjer inte
// det), så den skyddas istället av en delad hemlighet i URL:en. Är
// OWNTRACKS_SECRET inte satt i .env stängs endpointen av helt (fail closed)
// istället för att köra oskyddad.
function verifyOwntracksSecret(req, res) {
  if (!config.owntracksSecret) {
    res.status(503).json({ error: 'OwnTracks-webhooken är inte konfigurerad (OWNTRACKS_SECRET saknas i .env)' });
    return false;
  }
  const provided = Buffer.from(String(req.params.secret || ''));
  const expected = Buffer.from(String(config.owntracksSecret));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    res.status(403).json({ error: 'Ogiltig hemlighet' });
    return false;
  }
  return true;
}

router.post('/owntracks/:secret', async (req, res) => {
  if (!verifyOwntracksSecret(req, res)) return;
  console.log('[Geofence] Incoming body:', JSON.stringify(req.body));
  try {
    const body = req.body;
    const lat = parseFloat(body.lat || body.latitude);
    const lon = parseFloat(body.lon || body.longitude || body.lng);
    const tid = body.tid || body.device || body.id || null;
    const _type = body._type || 'location';

    if (_type !== 'location' && _type !== 'enter' && _type !== 'leave') return res.json([]);
    if (isNaN(lat) || isNaN(lon)) {
      console.log('[Geofence] Invalid coordinates, skipping');
      return res.json([]);
    }

    const geoLat = parseFloat(getSetting('geo_lat'));
    const geoLng = parseFloat(getSetting('geo_lng'));
    const geoRadius = parseInt(getSetting('geo_radius') || '200');
    const geoEnabled = getSetting('geo_enabled') === 'true';
    const geoName = getSetting('geo_name') || 'Centralförrådet';

    if (!geoEnabled || isNaN(geoLat) || isNaN(geoLng)) return res.json([]);

    const dist = haversine(lat, lon, geoLat, geoLng);
    const wasHere = getSetting('geo_was_here') === 'true';
    const lastNotif = parseInt(getSetting('geo_last_notif') || '0');
    const now = Date.now();

    console.log(`[Geofence] Distance: ${Math.round(dist)}m, wasHere: ${wasHere}, tracker: ${tid}`);

    // Spara position per användare
    let dbUser = null;
    try {
      const username = body.username || body.user || null;
      if (username) dbUser = db.prepare('SELECT id FROM users WHERE username=? OR owntracks_user=?').get(username, username);
      if (!dbUser && tid) dbUser = db.prepare('SELECT id FROM users WHERE tracker_id=?').get(tid);

      if (!dbUser) {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Basic ')) {
          const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
          const authUsername = decoded.split(':')[0];
          if (authUsername) dbUser = db.prepare('SELECT id FROM users WHERE username=?').get(authUsername);
        }
      }

      if (dbUser) {
        db.prepare("INSERT OR REPLACE INTO user_locations (user_id, lat, lng, accuracy, tracker_id, updated_at) VALUES (?,?,?,?,?,datetime('now'))").run(
          dbUser.id, lat, lon, body.acc || body.accuracy || null, tid
        );
        console.log(`[Geofence] Saved position for user_id: ${dbUser.id}`);

        try {
          const activeTrip = db.prepare("SELECT id FROM trips WHERE user_id=? AND status='active'").get(dbUser.id);
          if (activeTrip) {
            db.prepare('INSERT INTO trip_points (trip_id, lat, lng) VALUES (?,?,?)').run(activeTrip.id, lat, lon);
            const points = db.prepare('SELECT lat, lng FROM trip_points WHERE trip_id=? ORDER BY recorded_at').all(activeTrip.id);
            let distance = 0;
            for (let i = 1; i < points.length; i++) {
              distance += haversineKm(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
            }
            db.prepare('UPDATE trips SET distance_km=? WHERE id=?').run(Math.round(distance*10)/10, activeTrip.id);
            console.log(`[Geofence] Trip ${activeTrip.id} updated: ${Math.round(distance*10)/10} km`);
          }
        } catch(e) { console.error('[Geofence] Trip track error:', e.message); }

      } else {
        console.log('[Geofence] Could not match user');
      }
    } catch(e) { console.error('[Geofence] Location save error:', e.message); }

    // Geofence-logik
    if (dist <= geoRadius) {
      if (!wasHere || (now - lastNotif) > 2 * 60 * 60 * 1000) {
        setSetting('geo_was_here', 'true');
        setSetting('geo_last_notif', String(now));
        const items = await buildShoppingList();
        await sendShoppingListTelegram(items, geoName);
        console.log(`[Geofence] Arrived at ${geoName}, sent shopping list (${items.length} items)`);
      }
    } else {
      if (wasHere) {
        setSetting('geo_was_here', 'false');
        console.log(`[Geofence] Left ${geoName}`);
      }
    }

    res.json([]);
  } catch(e) {
    console.error('[Geofence] Error:', e);
    res.json([]);
  }
});

// ── SETTINGS (authenticated) ───────────────────────────────────────────────────
router.get('/settings', auth, (req, res) => {
  res.json({
    lat: parseFloat(getSetting('geo_lat')) || null,
    lng: parseFloat(getSetting('geo_lng')) || null,
    radius: parseInt(getSetting('geo_radius')) || 200,
    enabled: getSetting('geo_enabled') === 'true',
    name: getSetting('geo_name') || 'Centralförrådet',
    owntracks_url: config.owntracksSecret
      ? `${config.corsOrigin}/api/geofence/owntracks/${config.owntracksSecret}`
      : `${config.corsOrigin}/api/geofence/owntracks/<sätt OWNTRACKS_SECRET i .env>`
  });
});

router.post('/settings', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { lat, lng, radius, enabled, name } = req.body;
  setSetting('geo_lat', lat);
  setSetting('geo_lng', lng);
  setSetting('geo_radius', radius || 200);
  setSetting('geo_enabled', enabled !== false ? 'true' : 'false');
  setSetting('geo_name', name || 'Centralförrådet');
  res.json({ success: true });
});

router.post('/arrived', auth, async (req, res) => {
  const geoName = getSetting('geo_name') || 'Centralförrådet';
  const items = await buildShoppingList();
  await sendShoppingListTelegram(items, geoName);
  res.json({ success: true, items: items.length });
});

router.get('/locations', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const locations = db.prepare(`
    SELECT ul.user_id, ul.lat, ul.lng, ul.accuracy, ul.updated_at,
    u.display_name, u.username, u.color
    FROM user_locations ul
    JOIN users u ON u.id = ul.user_id
    ORDER BY ul.updated_at DESC
  `).all();
  res.json(locations);
});

module.exports = router;
