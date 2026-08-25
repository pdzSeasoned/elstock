const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

const DB_PATH = config.dbPath;

const db = new Database(DB_PATH);

// WAL mode för bättre prestanda och mindre låsning
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // bra prestanda, acceptabel säkerhet

console.log('[DB] Connected:', DB_PATH);

module.exports = db;
