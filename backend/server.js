require('dotenv').config();
require('./db/migrations').migrate();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { authOrQuery } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
const PORT = config.port;
const UPLOAD_DIR = config.uploadDir;

app.use(cors({ origin: config.corsOrigin }));
// OBS: uploads.js tillåter base64-bilder upp till 20MB rådata. Base64 gör
// payloaden ~33% större, så gränsen här måste vara högre än så, annars
// avvisas stora uppladdningar redan här (som ett generiskt 413-fel) innan
// uploads.js egen, tydligare felmeddelande-kontroll ens hinner köra.
app.use(express.json({ limit: '27mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/auth/login', rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: 'Too many attempts. Försök igen om 15 minuter.' } 
}));
app.use('/api/auth/register', rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: 'Too many attempts. Försök igen om 15 minuter.' } 
}));

app.use('/uploads', authOrQuery, express.static(UPLOAD_DIR));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/push', require('./routes/notifications'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/user-settings', require('./routes/user-settings'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/geofence', require('./routes/geofence'));

// Health check — MÅSTE registreras före den generella '*'-routen nedan,
// annars fångar wildcarden allt (inklusive /health) och det här blir
// oåtkomlig, död kod.
app.get('/health', (req, res) => {
  try {
    const db = require('./db/database');
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch(e) {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

const frontendPath = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Check reminders every 5 minutes
setInterval(async () => {
  try {
    const db = require('./db/database');
    const { sendTelegram, sendPushToAll } = require('./notifications');
    const events = db.prepare(`
      SELECT * FROM calendar_events
      WHERE reminder_sent = 0 AND all_day = 0
      AND reminder_minutes > 0
      AND datetime(start_datetime, '-' || reminder_minutes || ' minutes') <= datetime('now', 'localtime')
      AND datetime(start_datetime) > datetime('now', 'localtime', '-2 hours')
    `).all();
    for (const event of events) {
      const startTime = new Date(event.start_datetime).toLocaleString('sv-SE', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
      await sendTelegram(`🔔 **ElStock Påminnelse**\n\n **${event.title}**\n${event.description||''}\n⏰ Startar: ${startTime}`).catch(()=>{});
      await sendPushToAll({title:`⏰ ${event.title}`,body:`Startar ${startTime}`,icon:'/icons/icon-192.png'}).catch(()=>{});
      db.prepare('UPDATE calendar_events SET reminder_sent=1 WHERE id=?').run(event.id);
      console.log('[Reminder] Sent for:', event.title);
    }
  } catch(e) { console.error('[Reminder] Error:', e.message); }
}, 5 * 60 * 1000);

// CENTRAL ERROR HANDLER — MÅSTE vara sist!
app.use(errorHandler);

app.listen(PORT, () => console.log(`\n⚡ ElStock running on http://localhost:${PORT}\n`));
