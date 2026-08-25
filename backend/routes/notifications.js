const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const { sendTestNotification, sendPushToUser } = require('../notifications');
const webpush = require('web-push');
const config = require('../config');

const VAPID_PUBLIC = config.vapid.publicKey;
const VAPID_PRIVATE = config.vapid.privateKey;
const VAPID_EMAIL = config.vapid.email;
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

router.use(auth);

router.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    db.prepare('INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?,?,?,?)').run(req.user.id, endpoint, keys.p256dh, keys.auth);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subscribe', (req, res) => {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id, req.body.endpoint);
  res.json({ success: true });
});

router.post('/test', async (req, res) => {
  try {
    await sendTestNotification(req.user.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get notification settings (admin only)
router.get('/settings', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json({
    email_enabled: !!config.smtp.host && !!config.smtp.notifyEmail,
    email_to: config.smtp.notifyEmail || '',
    telegram_enabled: !!config.telegram.botToken && !!config.telegram.chatId,
    telegram_chat_id: config.telegram.chatId || '',
    push_enabled: !!VAPID_PUBLIC
  });
});

module.exports = router;
