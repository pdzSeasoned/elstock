// ElStock — Notifications (Push + Email + Telegram)
const db = require('./db/database');
const config = require('./config');

// ── PUSH ──────────────────────────────────────────────────────────────────────
async function sendPushToUser(user_id, payload) {
  const VAPID_PUBLIC = config.vapid.publicKey;
  const VAPID_PRIVATE = config.vapid.privateKey;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const webpush = require('web-push');
  webpush.setVapidDetails(config.vapid.email, VAPID_PUBLIC, VAPID_PRIVATE);
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id=?').all(user_id);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        JSON.stringify(payload)
      );
    } catch(e) {
      if (e.statusCode === 410) db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(sub.id);
    }
  }
}

async function sendPushToAll(payload) {
  const users = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all();
  for (const u of users) await sendPushToUser(u.user_id, payload);
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
async function sendEmail(subject, html) {
  const host = config.smtp.host;
  const port = config.smtp.port;
  const user = config.smtp.user;
  const pass = config.smtp.pass;
  const from = config.smtp.from;
  const to = config.smtp.notifyEmail;
  if (!host || !to) return;

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host, port: parseInt(port||587),
    secure: parseInt(port||587) === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: false }
  });

  await transporter.sendMail({ from, to, subject, html });
}

// ── TELEGRAM ──────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  const token = config.telegram.botToken;
  const chatId = config.telegram.chatId;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  });
}

// ── COMBINED LOW STOCK NOTIFICATION ───────────────────────────────────────────
async function notifyLowStock(items, warehouseName, warehouseId) {
  const count = items.length;
  const itemList = items.slice(0,5).map(i => `${i.name} (${i.quantity} kvar)`).join(', ');
  const more = count > 5 ? ` +${count-5} till` : '';

  let targetUsers = [];
  if (warehouseId) {
    const wh = db.prepare('SELECT owner_user_id, is_shared FROM warehouses WHERE id=?').get(warehouseId);
    if (wh?.owner_user_id) {
      const owner = db.prepare('SELECT * FROM users WHERE id=? AND notify_low_stock=1').get(wh.owner_user_id);
      if (owner) targetUsers = [owner];
    }
    if (!targetUsers.length || wh?.is_shared) {
      targetUsers = db.prepare('SELECT * FROM users WHERE notify_low_stock=1').all();
    }
  } else {
    targetUsers = db.prepare('SELECT * FROM users WHERE notify_low_stock=1').all();
  }

  const tgList = items.map(i => `• ${i.name} — **${i.quantity}** kvar (min ${i.min_quantity})`).join('\n');
  const msg = `⚠️ **ElStock — Lågt lager (${warehouseName})**\n\n${tgList}`;

  for (const user of targetUsers) {
    if (user.push_enabled !== 0) {
      await sendPushToUser(user.id, {
        title: `⚠️ ElStock — Lågt lager (${warehouseName})`,
        body: `${count} artikel${count>1?'ar':''} behöver fyllas på: ${itemList}${more}`,
        icon: '/icons/icon-192.png',
        data: { url: '/' }
      }).catch(()=>{});
    }
    if (user.telegram_chat_id) {
      await sendTelegramTo(user.telegram_chat_id, msg).catch(()=>{});
    }
  }

  const rows = items.map(i => `${i.name}${i.e_number||''}${i.quantity}${i.min_quantity}`).join('');
  await sendEmail(
    `⚠️ ElStock — Lågt lager i ${warehouseName}`,
    `<h2>Lågt lager — ${warehouseName}</h2><table><tr><th>Artikel</th><th>E-nr</th><th>Saldo</th><th>Min</th></tr>${rows}</table>`
  ).catch(()=>{});
}

async function sendTelegramTo(chatId, message) {
  const token = config.telegram.botToken;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  });
}

// ── MANUAL TEST ───────────────────────────────────────────────────────────────
async function sendTestNotification(user_id) {
  await sendPushToUser(user_id, {
    title: 'ElStock — Test ✓',
    body: 'Push-notiser fungerar!',
    icon: '/icons/icon-192.png'
  });
  await sendEmail('ElStock — Test', '<h2>E-post notiser fungerar!</h2>').catch(()=>{});
  await sendTelegram('✅ **ElStock** — Telegram-notiser fungerar!').catch(()=>{});
}

module.exports = { notifyLowStock, sendPushToUser, sendPushToAll, sendEmail, sendTelegram, sendTelegramTo, sendTestNotification };
