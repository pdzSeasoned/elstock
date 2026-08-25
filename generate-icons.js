#!/usr/bin/env node
// Quick icon generator — run once: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function makeIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  // Background
  ctx.fillStyle = '#0d0d14';
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();
  // Bolt
  ctx.fillStyle = '#f5a623';
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', size / 2, size / 2);
  return c.toBuffer('image/png');
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), makeIcon(size));
  console.log(`Generated icon-${size}.png`);
}
