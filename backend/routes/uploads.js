const router = require('express').Router();
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const config = require('../config');

const UPLOAD_DIR = config.uploadDir;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.use(auth);

// Upload product image (base64 from frontend)
router.post('/product-image', (req, res) => {
  const { image_data, mime_type } = req.body;
  if (!image_data) return res.status(400).json({ error: 'No image data' });

  const extMap = {
    'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  const ext = extMap[mime_type] || 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const base64 = image_data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length > 20 * 1024 * 1024) return res.status(400).json({ error: 'Fil för stor (max 20MB)' });

  fs.writeFileSync(filepath, buffer);
  res.json({ url: `/uploads/${filename}` });
});

// Delete product image
router.delete('/product-image/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.resolve(UPLOAD_DIR, filename);

  if (!filepath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ success: true });
});

module.exports = router;
