export async function runMigrations(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id                    TEXT PRIMARY KEY,
      name                  TEXT,
      email                 TEXT,
      avatar_url            TEXT,
      currency              TEXT DEFAULT 'PKR',
      theme                 TEXT DEFAULT 'dark',
      notifications_enabled INTEGER DEFAULT 1,
      language              TEXT DEFAULT 'en',
      notification_prefs    TEXT,
      cash_adjustment       REAL DEFAULT 0,
      created_at            TEXT,
      updated_at            TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id    TEXT PRIMARY KEY,
      settings   TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      parent_id  TEXT,
      name       TEXT NOT NULL,
      icon       TEXT,
      color      TEXT,
      type       TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      category_id TEXT,
      amount      REAL NOT NULL,
      type        TEXT NOT NULL,
      title       TEXT,
      description TEXT,
      date        TEXT,
      created_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      category_id TEXT,
      total_amount REAL,
      period      TEXT,
      created_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      title        TEXT,
      target_amount REAL,
      saved_amount  REAL DEFAULT 0,
      icon         TEXT,
      color        TEXT,
      start_date   TEXT,
      target_date  TEXT,
      repeat_basis TEXT,
      repeat_value INTEGER,
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS loans (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      type         TEXT,
      person_name  TEXT,
      total_amount REAL,
      date         TEXT,
      notes        TEXT,
      is_settled   INTEGER DEFAULT 0,
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id         TEXT PRIMARY KEY,
      loan_id    TEXT NOT NULL,
      amount     REAL,
      date       TEXT,
      notes      TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS planned_payments (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT,
      amount      REAL,
      type        TEXT DEFAULT 'expense',
      frequency   TEXT,
      next_date   TEXT,
      category_id TEXT,
      description TEXT,
      is_active   INTEGER DEFAULT 1,
      start_date  TEXT,
      end_date    TEXT,
      created_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      type       TEXT,
      title      TEXT,
      body       TEXT,
      data       TEXT,
      dedup_key  TEXT,
      is_read    INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at  TEXT,
      updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id           TEXT PRIMARY KEY,
      list_id      TEXT NOT NULL,
      name         TEXT,
      description  TEXT,
      quantity     REAL,
      price        REAL,
      is_completed INTEGER DEFAULT 0,
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS warranties (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      name          TEXT,
      purchase_date TEXT,
      expiry_date   TEXT,
      color         TEXT,
      is_notified   INTEGER DEFAULT 0,
      created_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user_date      ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_cats_user         ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_user      ON budgets(user_id);
    CREATE INDEX IF NOT EXISTS idx_goals_user        ON savings_goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_loans_user        ON loans(user_id);
    CREATE INDEX IF NOT EXISTS idx_loan_pay_loan     ON loan_payments(loan_id, date);
    CREATE INDEX IF NOT EXISTS idx_planned_user      ON planned_payments(user_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_lists_user        ON shopping_lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_list        ON shopping_items(list_id);
    CREATE INDEX IF NOT EXISTS idx_warranties_user   ON warranties(user_id);
  `);

  await seedDefaultCategories(db);
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const DEFAULT_CATEGORIES = [
  { name: 'Food & Drink', color: '#FF5722', icon: 'Utensils', type: 'expense',
    subs: [
      { name: 'Groceries', icon: 'ShoppingCart' },
      { name: 'Restaurants & Fast Food', icon: 'Pizza' },
      { name: 'Bar & Cafe', icon: 'Coffee' },
      { name: 'Street Food', icon: 'Store' },
    ]},
  { name: 'Transportation', color: '#03A9F4', icon: 'Car', type: 'expense',
    subs: [
      { name: 'Public Transport', icon: 'Bus' },
      { name: 'Taxi & Ride-share', icon: 'Smartphone' },
      { name: 'Fuel', icon: 'Fuel' },
      { name: 'Car Maintenance', icon: 'Wrench' },
      { name: 'Parking & Tolls', icon: 'MapPin' },
    ]},
  { name: 'Housing & Utilities', color: '#FFC107', icon: 'Home', type: 'expense',
    subs: [
      { name: 'Rent & Mortgage', icon: 'Key' },
      { name: 'Electricity & Gas', icon: 'Zap' },
      { name: 'Water', icon: 'Droplets' },
      { name: 'Internet & TV', icon: 'Wifi' },
      { name: 'Home Maintenance', icon: 'Hammer' },
    ]},
  { name: 'Entertainment', color: '#9C27B0', icon: 'Tv', type: 'expense',
    subs: [
      { name: 'Movies & Concerts', icon: 'Ticket' },
      { name: 'Streaming Services', icon: 'PlayCircle' },
      { name: 'Gaming', icon: 'Gamepad2' },
      { name: 'Hobbies', icon: 'Palette' },
    ]},
  { name: 'Shopping', color: '#795548', icon: 'ShoppingBag', type: 'expense',
    subs: [
      { name: 'Clothing & Shoes', icon: 'Shirt' },
      { name: 'Electronics', icon: 'Cpu' },
      { name: 'Home & Garden', icon: 'Leaf' },
      { name: 'Gifts & Donations', icon: 'Gift' },
    ]},
  { name: 'Health & Personal', color: '#E91E63', icon: 'HeartPulse', type: 'expense',
    subs: [
      { name: 'Medical & Pharmacy', icon: 'Pill' },
      { name: 'Personal Care', icon: 'Sparkles' },
      { name: 'Fitness & Sports', icon: 'Dumbbell' },
    ]},
  { name: 'Financial', color: '#607D8B', icon: 'Banknote', type: 'expense',
    subs: [
      { name: 'Insurance', icon: 'ShieldCheck' },
      { name: 'Taxes', icon: 'FileText' },
      { name: 'Bank Fees & Interest', icon: 'CreditCard' },
    ]},
  { name: 'Employment', color: '#4CAF50', icon: 'Briefcase', type: 'income',
    subs: [
      { name: 'Salary', icon: 'Wallet' },
      { name: 'Bonus', icon: 'TrendingUp' },
      { name: 'Overtime', icon: 'Clock' },
    ]},
  { name: 'Business & Freelance', color: '#8BC34A', icon: 'Monitor', type: 'income',
    subs: [
      { name: 'Sales', icon: 'Tag' },
      { name: 'Service Revenue', icon: 'UserCheck' },
      { name: 'Consulting', icon: 'MessageCircle' },
    ]},
  { name: 'Investments', color: '#009688', icon: 'LineChart', type: 'income',
    subs: [
      { name: 'Dividends', icon: 'PieChart' },
      { name: 'Interest', icon: 'Percent' },
      { name: 'Rental Income', icon: 'Home' },
    ]},
  { name: 'Other Income', color: '#CDDC39', icon: 'PlusCircle', type: 'income',
    subs: [
      { name: 'Gifts', icon: 'Gift' },
      { name: 'Refunds', icon: 'Undo' },
      { name: 'Selling Assets', icon: 'DollarSign' },
    ]},
];

async function seedDefaultCategories(db) {
  const row = await db.getFirstAsync('SELECT COUNT(*) as count FROM categories');
  if (row.count > 0) return;

  const now = new Date().toISOString();
  const sql = 'INSERT INTO categories (id, user_id, parent_id, name, icon, color, type, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)';

  for (const cat of DEFAULT_CATEGORIES) {
    const parentId = uuid();
    await db.runAsync(sql, [parentId, null, cat.name, cat.icon, cat.color, cat.type, now]);
    for (const sub of (cat.subs || [])) {
      await db.runAsync(sql, [uuid(), parentId, sub.name, sub.icon, cat.color, cat.type, now]);
    }
  }
}
