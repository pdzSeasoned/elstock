// backend/config.js
//
// Central konfiguration för elstock. Läser allt från miljövariabler (.env)
// så att inga hemligheter behöver hårdkodas eller committas till git.
//
// OBS: Denna fil är trygg att committa till repot – den innehåller inga
// hemligheter, bara *namnen* på vilka env-variabler som används och
// vettiga default-värden för lokal utveckling. De faktiska hemligheterna
// bor i din .env-fil, som ALDRIG ska committas (se .gitignore).

require('dotenv').config();

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[config] Miljövariabeln ${name} saknas. Sätt den i din .env-fil innan du startar servern i produktion.`
    );
  }

  // I utveckling tillåter vi en fallback så man kan komma igång snabbt,
  // men vi varnar högt så man inte glömmer sätta ett riktigt värde.
  console.warn(
    `[config] VARNING: ${name} är inte satt i .env – använder osäker utvecklings-fallback. Sätt aldrig detta i produktion.`
  );
  return devFallback;
}

const config = {
  // Serverinställningar
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Databas & uploads
  dbPath: process.env.DB_PATH || './data/elstock.db',
  uploadDir: process.env.UPLOAD_DIR || './data/uploads',

  // Autentisering
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  adminKey: process.env.ADMIN_KEY || null, // krävs för att registrera första admin-kontot

  // OwnTracks-webhook (geofence.js) – lämnas tom = endpointen stängs av (fail closed)
  owntracksSecret: process.env.OWNTRACKS_SECRET || '',

  // Groq (AI-assistenten i routes/assistant.js)
  groqApiKey: process.env.GROQ_API_KEY || '',

  // E-post (SMTP) för notifikationer
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    notifyEmail: process.env.SMTP_NOTIFY_EMAIL || '',
  },

  // Telegram-notifikationer
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Web push (VAPID-nycklar för push-notiser i webbläsaren)
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    email: process.env.VAPID_EMAIL || 'mailto:admin@example.com',
  },
};

module.exports = config;
