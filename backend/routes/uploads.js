const router = require('express').Router();
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const config = require('../config');

const UPLOAD_DIR = config.uploadDir;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.use(auth);

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

// Avgör faktisk filtyp från de första bytesen ("magic bytes") i stället för
// att lita på mime_type som klienten skickar med. En användare kan annars
// döpa vilken fil som helst (t.ex. HTML med <script>) till "image/png" och
// få den sparad och serverad från /uploads/ som om den vore en bild.
// Denna endpoint heter "product-image" och ska därför bara acceptera
// riktiga bilder — pdf/docx/xlsx hör inte hemma här.
function detectImageExt(buffer) {
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
      buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return 'gif';
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

// Upload product image (base64 från frontend)
router.post('/product-image', (req, res) => {
  const { image_data } = req.body;
  if (!image_data) return res.status(400).json({ error: 'No image data' });

  const base64 = image_data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Tom fil' });
  }
  if (buffer.length > MAX_BYTES) {
    return res.status(400).json({ error: 'Fil för stor (max 20MB)' });
  }

  const ext = detectImageExt(buffer);
  if (!ext) {
    return res.status(400).json({
      error: 'Ogiltigt filformat. Endast PNG, JPG, GIF och WEBP tillåts.',
    });
  }

  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

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
