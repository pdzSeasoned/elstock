const config = require('../config');

function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Zod-valideringsfel
  if (err.name === 'ZodError') {
    const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return res.status(400).json({ error: 'Valideringsfel', details: issues });
  }

  // SQLite UNIQUE constraint
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Värdet finns redan i databasen' });
  }

  // SQLite foreign key
  if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({ error: 'Relaterad data saknas (foreign key)' });
  }

  // Generiskt — i produktion: dölj detaljer (kan innehålla filsökvägar,
  // SQL-fragment eller annat internt som inte ska nå klienten)
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? (err.message || 'Internal server error') : 'Ett internt fel uppstod',
    ...(isDev && { stack: err.stack })
  });
}

module.exports = errorHandler;
