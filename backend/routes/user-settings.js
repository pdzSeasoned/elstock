const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db/database');
const bcrypt = require('bcryptjs');

router.use(auth);

// ── GET USER PROFILE ──────────────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const u = db.prepare('SELECT id, username, display_name, role, telegram_chat_id, telegram_user, push_enabled, notify_low_stock, color, theme FROM users WHERE id=?').get(req.user.id);
  res.json(u);
});

// ── UPDATE OWN PROFILE ────────────────────────────────────────────────────────
router.put('/profile', (req, res) => {
  const { display_name, telegram_chat_id, telegram_user, push_enabled, notify_low_stock, color, theme } = req.body;
  db.prepare('UPDATE users SET display_name=?, telegram_chat_id=?, telegram_user=?, push_enabled=?, notify_low_stock=?, color=?, theme=? WHERE id=?').run(
    display_name || req.user.display_name,
    telegram_chat_id || null,
    telegram_user || null,
    push_enabled !== false ? 1 : 0,
    notify_low_stock !== false ? 1 : 0,
    color || '#f5a623',
    theme || 'dark',
    req.user.id
  );
  res.json({ success: true });
});

// ── ADMIN: GET ALL USERS WITH SETTINGS ────────────────────────────────────────
router.get('/all', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, username, display_name, role, telegram_chat_id, telegram_user, push_enabled, notify_low_stock, color, theme, created_at FROM users ORDER BY display_name').all();

  // Get warehouse assignments per user
  const warehouses = db.prepare('SELECT id, name, type, owner_user_id, is_shared FROM warehouses ORDER BY name').all();

  res.json({ users, warehouses });
});

// ── ADMIN: UPDATE USER SETTINGS ───────────────────────────────────────────────
router.put('/user/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { display_name, role, telegram_chat_id, telegram_user, push_enabled, notify_low_stock, color, theme, password } = req.body;

  if (password && password.length >= 6) {
    // KRITISK: Salt höjt från 10 till 12
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET display_name=?, role=?, telegram_chat_id=?, telegram_user=?, push_enabled=?, notify_low_stock=?, color=?, theme=?, password_hash=? WHERE id=?').run(
      display_name, role, telegram_chat_id||null, telegram_user||null, push_enabled?1:0, notify_low_stock?1:0, color||'#f5a623', theme||'dark', hash, req.params.id
    );
  } else {
    db.prepare('UPDATE users SET display_name=?, role=?, telegram_chat_id=?, telegram_user=?, push_enabled=?, notify_low_stock=?, color=?, theme=? WHERE id=?').run(
      display_name, role, telegram_chat_id||null, telegram_user||null, push_enabled?1:0, notify_low_stock?1:0, color||'#f5a623', theme||'dark', req.params.id
    );
  }
  res.json({ success: true });
});

// ── ASSIGN WAREHOUSE TO USER ──────────────────────────────────────────────────
router.post('/warehouse-assignment', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { warehouse_id, owner_user_id, is_shared } = req.body;
  db.prepare('UPDATE warehouses SET owner_user_id=?, is_shared=? WHERE id=?').run(
    owner_user_id || null, is_shared ? 1 : 0, warehouse_id
  );
  res.json({ success: true });
});

// ── GET PERMISSIONS SUMMARY ───────────────────────────────────────────────────
router.get('/permissions', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const users = db.prepare('SELECT id, username, display_name, role, color, theme FROM users').all();
  const warehouses = db.prepare('SELECT id, name, type, owner_user_id, is_shared FROM warehouses').all();

  res.json({
    users,
    warehouses,
    permission_model: {
      jobs: 'private_default_shareable',
      calendar: 'private_default_shareable',
      inventory: 'per_warehouse_ownership',
      notifications: 'per_user_telegram'
    }
  });
});

module.exports = router;
