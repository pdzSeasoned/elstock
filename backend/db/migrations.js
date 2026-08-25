const db = require('./database');

// Hjälp: kolla om en migration redan körts
function hasRun(name) {
  const row = db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name);
  return !!row;
}

function markRun(name) {
  db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
}

function migrate() {
  console.log('[DB] Running migrations...');

  // Migration 0: Skapa migrations-tabellen själv (alltid först)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration 1: Bas-tabeller
  if (!hasRun('001_base_tables')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        telegram_chat_id TEXT,
        telegram_user TEXT,
        push_enabled INTEGER DEFAULT 1,
        notify_low_stock INTEGER DEFAULT 1,
        color TEXT DEFAULT '#f5a623',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'car',
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        e_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT DEFAULT 'st',
        barcode TEXT,
        category_id INTEGER,
        category TEXT,
        image_url TEXT,
        brand TEXT,
        attributes TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity REAL NOT NULL DEFAULT 0,
        min_quantity REAL NOT NULL DEFAULT 2,
        UNIQUE(warehouse_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'checkout',
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        customer_name TEXT,
        customer_address TEXT,
        work_order TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        e_number TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'st'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_number TEXT,
        name TEXT NOT NULL,
        customer_name TEXT,
        company TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        notes TEXT,
        parent_id INTEGER REFERENCES customers(id),
        location_type TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT,
        customer_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT DEFAULT (datetime('now')),
        archived_at TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS job_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL DEFAULT 'note',
        content TEXT,
        image_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS job_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        e_number TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'st',
        added_by INTEGER REFERENCES users(id),
        added_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT,
        all_day INTEGER DEFAULT 0,
        type TEXT DEFAULT 'booking',
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        color TEXT DEFAULT '#f5a623',
        reminder_minutes INTEGER DEFAULT 60,
        reminder_sent INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES categories(id),
        filters TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        serial_number TEXT,
        description TEXT,
        purchase_date TEXT,
        warranty_until TEXT,
        status TEXT DEFAULT 'available',
        location TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS equipment_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        assigned_at TEXT DEFAULT (datetime('now')),
        returned_at TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS equipment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT,
        start_time TEXT DEFAULT (datetime('now')),
        end_time TEXT,
        distance_km REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trip_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        recorded_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_locations (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        lat REAL,
        lng REAL,
        accuracy REAL,
        tracker_id TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    markRun('001_base_tables');
    console.log('[DB] Migration 001_base_tables complete');
  }

  // Migration 2: Extra kolumner som lagts till över tid
  if (!hasRun('002_extra_columns')) {
    try { db.exec("ALTER TABLE products ADD COLUMN brand TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE products ADD COLUMN attributes TEXT DEFAULT '{}'"); } catch(e) {}
    try { db.exec("ALTER TABLE warehouses ADD COLUMN owner_user_id INTEGER"); } catch(e) {}
    try { db.exec("ALTER TABLE warehouses ADD COLUMN is_shared INTEGER DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE jobs ADD COLUMN customer_id INTEGER REFERENCES customers(id)"); } catch(e) {}
    try { db.exec("ALTER TABLE jobs ADD COLUMN is_shared INTEGER DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE jobs ADD COLUMN shared_with TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE jobs ADD COLUMN deadline TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN tracker_id TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN owntracks_user TEXT"); } catch(e) {}
    markRun('002_extra_columns');
    console.log('[DB] Migration 002_extra_columns complete');
  }

  // Migration 3: Index för prestanda
  if (!hasRun('003_performance_indexes')) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(warehouse_id, quantity, min_quantity);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_warehouse ON transactions(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_e_number ON products(e_number);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_datetime);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder ON calendar_events(reminder_sent, start_datetime);
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_customers_parent ON customers(parent_id);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_job_entries_job ON job_entries(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_materials_job ON job_materials(job_id);
      CREATE INDEX IF NOT EXISTS idx_trip_points_trip ON trip_points(trip_id);
      CREATE INDEX IF NOT EXISTS idx_equipment_assignments_eq ON equipment_assignments(equipment_id);
    `);
    markRun('003_performance_indexes');
    console.log('[DB] Migration 003_performance_indexes complete');
  }

  // Migration 4: Extra tabeller
  if (!hasRun('004_extra_tables')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customer_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customer_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#f5a623',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customer_tag_links (
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (customer_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS customer_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        type TEXT NOT NULL,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS photo_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS global_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        folder_id INTEGER REFERENCES photo_folders(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        caption TEXT,
        taken_by INTEGER REFERENCES users(id),
        taken_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS job_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS job_tag_links (
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (job_id, tag_id)
      );
    `);
    markRun('004_extra_tables');
    console.log('[DB] Migration 004_extra_tables complete');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Migration 5: Tema-inställning per användare
  // ═══════════════════════════════════════════════════════════════════════
  if (!hasRun('005_user_theme')) {
    try { db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'"); } catch(e) {}
    markRun('005_user_theme');
    console.log('[DB] Migration 005_user_theme complete');
  }

  console.log('[DB] Migrations complete');
}

module.exports = { migrate };
