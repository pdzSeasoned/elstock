const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const webpush = require('web-push');

// VAPID keys — generate once with: node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@elstock.local';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

router.use(auth);

// Get public VAPID key for client subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// Save push subscription
router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    db.prepare('INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)').run(
      req.user.id, endpoint, keys.p256dh, keys.auth
    );
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Unsubscribe
router.delete('/subscribe', (req, res) => {
  const { endpoint } = req.body;
  db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id, endpoint);
  res.json({ success: true });
});

// Send test notification
router.post('/test', (req, res) => {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id=?').all(req.user.id);
  if (subs.length === 0) return res.status(400).json({ error: 'No subscriptions found' });
  
  sendPushToUser(req.user.id, {
    title: 'ElStock — Test',
    body: 'Push-notiser fungerar! 🎉',
    icon: '/icons/icon-192.png'
  });
  res.json({ success: true, sent_to: subs.length });
});

// Internal function to send push to user
async function sendPushToUser(user_id, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id=?').all(user_id);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        JSON.stringify(payload)
      );
    } catch(e) {
      if (e.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(sub.id);
      }
    }
  }
}

// Send low stock push to all users
async function sendLowStockNotification(items) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const users = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all();
  for (const u of users) {
    await sendPushToUser(u.user_id, {
      title: 'ElStock — Lågt lager!',
      body: `${items.length} artikel${items.length > 1 ? 'ar' : ''} behöver fyllas på: ${items.slice(0,3).map(i=>i.name).join(', ')}${items.length > 3 ? '...' : ''}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: '/inventory' }
    });
  }
}

module.exports = router;
module.exports.sendLowStockNotification = sendLowStockNotification;
