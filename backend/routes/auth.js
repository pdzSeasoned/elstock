const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const auth = require('../middleware/auth');
const config = require('../config');
const asyncHandler = require('../middleware/asyncHandler');
const { loginSchema, registerSchema, changePasswordSchema } = require('../schemas/validation');

const JWT_SECRET = config.jwtSecret;
const ADMIN_KEY = config.adminKey;

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, display_name: user.display_name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      theme: user.theme || 'dark'
    }
  });
}));

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  let role = 'user';
  if (userCount === 0) {
    // Första kontot i systemet blir automatiskt admin — ingen nyckel krävs.
    role = 'admin';
  } else {
    // Admin-nyckeln avgör bara OM man får registrera sig, aldrig VILKEN roll
    // man får. Uppgradering till admin sker enbart via en redan inloggad
    // admin (PUT /users/:id) — aldrig vid självregistrering.
    if (data.admin_key !== ADMIN_KEY) return res.status(403).json({ error: 'Admin key required' });
  }
  const hash = bcrypt.hashSync(data.password, 12);
  const result = db.prepare('INSERT INTO users (username, password_hash, display_name, role, theme) VALUES (?, ?, ?, ?, ?)').run(
    data.username.toLowerCase().trim(), hash, data.display_name, role, 'dark'
  );
  res.json({ success: true, id: result.lastInsertRowid });
}));

// Change password
router.post('/change-password', auth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) return res.status(401).json({ error: 'Current password incorrect' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 12), req.user.id);
  res.json({ success: true });
}));

// Get all users (admin only)
router.get('/users', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, username, display_name, role, theme, created_at FROM users ORDER BY display_name').all();
  res.json(users);
}));

// Update user (admin only)
router.put('/users/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { display_name, role, password, theme } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET display_name=?, role=?, theme=?, password_hash=? WHERE id=?').run(display_name, role, theme || 'dark', hash, req.params.id);
  } else {
    db.prepare('UPDATE users SET display_name=?, role=?, theme=? WHERE id=?').run(display_name, role, theme || 'dark', req.params.id);
  }
  res.json({ success: true });
}));

// Delete user (admin only)
router.delete('/users/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// Reset password (admin only)
router.post('/users/:id/reset-password', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password too short' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(new_password, 12), req.params.id);
  res.json({ success: true });
}));

// Förnya token
router.post('/refresh', auth, asyncHandler(async (req, res) => {
  // Hämta FÄRSK data från databasen — lita aldrig på role/display_name från
  // den gamla token, annars slår rolländringar inte igenom förrän token
  // löper ut naturligt (upp till 30 dagar).
  const user = db.prepare('SELECT username, display_name, role, theme FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  const newToken = jwt.sign(
    { id: req.user.id, username: user.username, role: user.role, display_name: user.display_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token: newToken, theme: user.theme || 'dark' });
}));

module.exports = router;
