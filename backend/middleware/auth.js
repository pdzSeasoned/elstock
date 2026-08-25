const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_SECRET = config.jwtSecret;

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Samma sak som auth(), men accepterar även token som ?token=-query-parameter.
// Behövs enbart för <img>/<a>-taggar som inte kan skicka en Authorization-
// header (t.ex. bilder i /uploads) — använd ALDRIG detta för vanliga
// API-anrop, bara för statiska filresurser.
function authOrQuery(req, res, next) {
  const header = req.headers.authorization;
  const token = (header && header.startsWith('Bearer ')) ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = auth;
module.exports.adminOnly = adminOnly;
module.exports.authOrQuery = authOrQuery;
module.exports.JWT_SECRET = JWT_SECRET;
