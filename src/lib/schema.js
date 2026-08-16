async function ensureColumn(db, table, column, definition) {
  const columns = await db.getAllAsync(`PRAGMA table_info(${table})`);
  if (!columns?.some?.(col => col.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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
      id                    TEXT PRIMARY KEY,
      user_id               TEXT NOT NULL,
      account_id            TEXT,
      type                  TEXT,
      person_name           TEXT,
      total_amount          REAL,
      date                  TEXT,
      notes                 TEXT,
      is_settled            INTEGER DEFAULT 0,
      is_multi_installment  INTEGER DEFAULT 0,
      repayment_type        TEXT DEFAULT 'single',
      due_date              TEXT,
      num_installments      INTEGER,
      installment_interval  TEXT,
      created_at            TEXT
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id          TEXT PRIMARY KEY,
      loan_id     TEXT NOT NULL,
      amount      REAL,
      date        TEXT,
      due_date    TEXT,
      notes       TEXT,
      is_paid     INTEGER DEFAULT 0,
      created_at  TEXT
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

  // Notifications: add is_archived column (existing databases)
  await ensureColumn(db, 'notifications', 'is_archived', 'INTEGER DEFAULT 0');

  // Accounts table (Feature 4 — bank/wallet account management)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      bank_name    TEXT,
      account_name TEXT NOT NULL,
      account_type TEXT DEFAULT 'savings',
      balance      REAL DEFAULT 0,
      color        TEXT DEFAULT '#4f5ff7',
      icon         TEXT DEFAULT 'Wallet',
      is_active    INTEGER DEFAULT 1,
      created_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id, is_active);
  `);

  // Balance history table (Feature: Net Worth Tracking — one snapshot row per user per day)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS balance_history (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      date          TEXT NOT NULL,
      total_balance REAL DEFAULT 0,
      created_at    TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_history_user_date ON balance_history(user_id, date);
  `);

  // Budget transfers table (Feature: transfer between budget heads)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS budget_transfers (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      from_budget_id TEXT NOT NULL,
      to_budget_id   TEXT NOT NULL,
      amount        REAL NOT NULL,
      is_permanent  INTEGER DEFAULT 0,
      period        TEXT,
      created_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_budget_transfers_user ON budget_transfers(user_id, period);
  `);

  // Chat messages table (AI Assistant conversation history)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at);
  `);

  // Khums tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS khums_years (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      year_label     TEXT,
      year_start     TEXT NOT NULL,
      year_end       TEXT NOT NULL,
      income_auto    REAL DEFAULT 0,
      income_extra   REAL DEFAULT 0,
      income_exempt  REAL DEFAULT 0,
      expenses_auto  REAL DEFAULT 0,
      expenses_total REAL DEFAULT 0,
      surplus        REAL DEFAULT 0,
      khums_due      REAL DEFAULT 0,
      sahm_imam      REAL DEFAULT 0,
      sahm_sadat     REAL DEFAULT 0,
      paid_imam      REAL DEFAULT 0,
      paid_sadat     REAL DEFAULT 0,
      status         TEXT DEFAULT 'open',
      notes          TEXT,
      created_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS khums_expenses (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      khums_year_id  TEXT NOT NULL,
      category       TEXT,
      amount         REAL,
      description    TEXT,
      created_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS khums_payments (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      khums_year_id  TEXT NOT NULL,
      recipient_type TEXT,
      recipient_name TEXT,
      amount         REAL,
      date           TEXT,
      notes          TEXT,
      created_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_khums_years_user    ON khums_years(user_id);
    CREATE INDEX IF NOT EXISTS idx_khums_expenses_year ON khums_expenses(khums_year_id);
    CREATE INDEX IF NOT EXISTS idx_khums_payments_year ON khums_payments(khums_year_id);

    CREATE TABLE IF NOT EXISTS khums_history (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount       REAL NOT NULL,
      notes        TEXT,
      created_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_khums_history_user ON khums_history(user_id, payment_date);
  `);

  // Add account_id to transactions (idempotent)
  try {
    await ensureColumn(db, 'transactions', 'account_id', 'TEXT');
  } catch (_) { }

  // Add receipt_uri to transactions (idempotent)
  try {
    await ensureColumn(db, 'transactions', 'receipt_uri', 'TEXT');
  } catch (_) { }

  // Add madhab to users (idempotent)
  try {
    await ensureColumn(db, 'users', 'madhab', "TEXT DEFAULT 'sunni'");
  } catch (_) { }

  // Add expenses_auto to khums_years (idempotent)
  try {
    await ensureColumn(db, 'khums_years', 'expenses_auto', 'REAL DEFAULT 0');
  } catch (_) { }

  // Add income_receivable (loans given / outstanding receivables) to khums_years (idempotent)
  try {
    await ensureColumn(db, 'khums_years', 'income_receivable', 'REAL DEFAULT 0');
  } catch (_) { }

  // Add account_id to planned_payments (idempotent)
  try {
    await ensureColumn(db, 'planned_payments', 'account_id', 'TEXT');
  } catch (_) { }

  // Mark loan-generated transactions so they're excluded from income/expense totals
  try {
    await ensureColumn(db, 'transactions', 'is_loan', 'INTEGER DEFAULT 0');
  } catch (_) { }

  // Loan enhancements: account selection, multi-installment, due dates
  try { await ensureColumn(db, 'loans', 'account_id', 'TEXT'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'due_date', 'TEXT'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'is_multi_installment', 'INTEGER DEFAULT 0'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'repayment_type', "TEXT DEFAULT 'single'"); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'num_installments', 'INTEGER'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'installment_interval', 'TEXT'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'installment_amount', 'REAL'); } catch (_) { }
  try { await ensureColumn(db, 'loans', 'define_by', "TEXT DEFAULT 'count'"); } catch (_) { }
  try { await ensureColumn(db, 'loan_payments', 'due_date', 'TEXT'); } catch (_) { }
  try { await ensureColumn(db, 'loan_payments', 'is_paid', 'INTEGER DEFAULT 0'); } catch (_) { }
  try { await ensureColumn(db, 'loan_payments', 'transaction_id', 'TEXT'); } catch (_) { }

  // Savings Goals: archive support + notes field
  try { await ensureColumn(db, 'savings_goals', 'is_archived', 'INTEGER DEFAULT 0'); } catch (_) { }
  try { await ensureColumn(db, 'savings_goals', 'notes', 'TEXT'); } catch (_) { }

  // Warranties: archive support + 7-day notification tracking
  try { await ensureColumn(db, 'warranties', 'is_archived', 'INTEGER DEFAULT 0'); } catch (_) { }
  try { await ensureColumn(db, 'warranties', 'is_notified_7day', 'INTEGER DEFAULT 0'); } catch (_) { }

  // What's New: track the last app version the user has seen
  try { await ensureColumn(db, 'users', 'last_seen_version', 'TEXT'); } catch (_) { }

  await seedDefaultCategories(db);
  await seedMissingCategories(db);
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const DEFAULT_CATEGORIES = [
  {
    name: 'Food & Drink', color: '#FF5722', icon: 'Utensils', type: 'expense',
    subs: [
      { name: 'Groceries', icon: 'ShoppingCart' },
      { name: 'Restaurants & Fast Food', icon: 'Pizza' },
      { name: 'Bar & Cafe', icon: 'Coffee' },
      { name: 'Street Food', icon: 'Store' },
    ]
  },
  {
    name: 'Transportation', color: '#03A9F4', icon: 'Car', type: 'expense',
    subs: [
      { name: 'Public Transport', icon: 'Bus' },
      { name: 'Taxi & Ride-share', icon: 'Smartphone' },
      { name: 'Fuel', icon: 'Fuel' },
      { name: 'Car Maintenance', icon: 'Wrench' },
      { name: 'Parking & Tolls', icon: 'MapPin' },
    ]
  },
  {
    name: 'Housing & Utilities', color: '#FFC107', icon: 'Home', type: 'expense',
    subs: [
      { name: 'Rent & Mortgage', icon: 'Key' },
      { name: 'Electricity & Gas', icon: 'Zap' },
      { name: 'Water', icon: 'Droplets' },
      { name: 'Internet & TV', icon: 'Wifi' },
      { name: 'Home Maintenance', icon: 'Hammer' },
    ]
  },
  {
    name: 'Entertainment', color: '#9C27B0', icon: 'Tv', type: 'expense',
    subs: [
      { name: 'Movies & Concerts', icon: 'Ticket' },
      { name: 'Streaming Services', icon: 'PlayCircle' },
      { name: 'Gaming', icon: 'Gamepad2' },
      { name: 'Hobbies', icon: 'Palette' },
    ]
  },
  {
    name: 'Shopping', color: '#795548', icon: 'ShoppingBag', type: 'expense',
    subs: [
      { name: 'Clothing & Shoes', icon: 'Shirt' },
      { name: 'Electronics', icon: 'Cpu' },
      { name: 'Home & Garden', icon: 'Leaf' },
      { name: 'Gifts & Donations', icon: 'Gift' },
    ]
  },
  {
    name: 'Health & Personal', color: '#E91E63', icon: 'HeartPulse', type: 'expense',
    subs: [
      { name: 'Medical & Pharmacy', icon: 'Pill' },
      { name: 'Personal Care', icon: 'Sparkles' },
      { name: 'Fitness & Sports', icon: 'Dumbbell' },
    ]
  },
  {
    name: 'Financial', color: '#607D8B', icon: 'Banknote', type: 'expense',
    subs: [
      { name: 'Insurance', icon: 'ShieldCheck' },
      { name: 'Taxes', icon: 'FileText' },
      { name: 'Bank Fees & Interest', icon: 'CreditCard' },
    ]
  },
  {
    name: 'Employment', color: '#4CAF50', icon: 'Briefcase', type: 'income',
    subs: [
      { name: 'Salary', icon: 'Wallet' },
      { name: 'Bonus', icon: 'TrendingUp' },
      { name: 'Overtime', icon: 'Clock' },
    ]
  },
  {
    name: 'Business & Freelance', color: '#8BC34A', icon: 'Monitor', type: 'income',
    subs: [
      { name: 'Sales', icon: 'Tag' },
      { name: 'Service Revenue', icon: 'UserCheck' },
      { name: 'Consulting', icon: 'MessageCircle' },
    ]
  },
  {
    name: 'Investments', color: '#009688', icon: 'LineChart', type: 'income',
    subs: [
      { name: 'Dividends', icon: 'PieChart' },
      { name: 'Interest', icon: 'Percent' },
    ]
  },
  {
    name: 'Other Income', color: '#CDDC39', icon: 'PlusCircle', type: 'income',
    subs: [
      { name: 'Gifts', icon: 'Gift' },
      { name: 'Refunds', icon: 'Undo' },
      { name: 'Selling Assets', icon: 'DollarSign' },
    ]
  },
];

async function seedMissingCategories(db) {
  const now = new Date().toISOString();
  const sql = 'INSERT INTO categories (id, user_id, parent_id, name, icon, color, type, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)';

  const newParents = [
    {
      name: 'Education', color: '#8B5CF6', icon: 'GraduationCap', type: 'expense',
      subs: ['Tuition', 'Books & Stationery', 'Online Courses', 'School Fees', 'Exam Fees', 'University Semester Fee', 'Skill Development']
    },
    {
      name: 'Travel', color: '#0EA5E9', icon: 'Plane', type: 'expense',
      subs: ['Flights', 'Hotels & Stays', 'Travel Insurance', 'Visa & Passport', 'Travel Meals', 'Local Sightseeing', 'Car Rental']
    },
    {
      name: 'Personal Care', color: '#EC4899', icon: 'Sparkles', type: 'expense',
      subs: [
        'Haircut & Salon', 'Cosmetics & Makeup', 'Skincare & Creams', 'Spa & Massage', 
        'Toiletries & Hygiene', 'Shaving & Grooming', 'Perfumes & Deodorants', 'Nail Care', 
        'Oral Care', 'Soaps & Body Wash', 'Shampoo & Conditioner', 'Waxing & Threading'
      ]
    },
    {
      name: 'Kids & Family', color: '#F97316', icon: 'Baby', type: 'expense',
      subs: [
        'Childcare & Daycare', 'Baby Supplies & Formula', 'School Activities', 'Toys & Games', 
        'Baby Food', 'Diapers & Wipes', 'Pocket Money', 'Kids Clothing', 'School Uniform', 
        'School Bus Fare', 'Kids Vaccinations', 'Birthday Parties'
      ]
    },
    {
      name: 'Subscriptions', color: '#6366F1', icon: 'Repeat', type: 'expense',
      subs: ['Apps & Software', 'Newspapers & Magazines', 'Cloud Storage', 'Membership Fees', 'Streaming (Netflix/Spotify)', 'SaaS Subscriptions']
    },
    {
      name: 'Charity & Zakat', color: '#10B981', icon: 'Heart', type: 'expense',
      subs: ['Zakat', 'Sadaqah', 'NGO Donations', 'Food Aid', 'Mosque Donation', 'Fitrana', 'Kafarah', 'Helping the Needy']
    },
    {
      name: 'Rental Income', color: '#14B8A6', icon: 'Building2', type: 'income',
      subs: ['Residential Rent', 'Commercial Rent', 'Shop Rent', 'Parking Space Rent', 'Equipment Lease']
    },
    {
      name: 'Side Income', color: '#F59E0B', icon: 'Zap', type: 'income',
      subs: ['Reselling', 'Content Creation', 'Tutoring', 'Commission', 'Affiliate Marketing', 'Ad Revenue']
    },
    {
      name: 'Pets', color: '#F97316', icon: 'PawPrint', type: 'expense',
      subs: [
        'Vet & Medicine', 'Pet Food & Treats', 'Pet Accessories', 'Pet Grooming', 
        'Pet Toys', 'Pet Training', 'Pet Boarding & Sitting', 'Litter & Cleaning', 'Pet Adoption'
      ]
    },
    {
      name: 'Events & Celebrations', color: '#EC4899', icon: 'PartyPopper', type: 'expense',
      subs: ['Wedding', 'Birthday Party', 'Religious Event', 'Anniversary', 'Graduation', 'Holiday Gifts', 'Family Get-together']
    },
    {
      name: 'Repairs & Maintenance', color: '#78716C', icon: 'Wrench', type: 'expense',
      subs: ['Home Repair', 'Appliance Repair', 'Plumbing', 'Electrical Work', 'AC Service / Repair', 'Painting & Renovation', 'Carpenter Services']
    },
  ];

  for (const cat of newParents) {
    const existing = await db.getFirstAsync(
      'SELECT id FROM categories WHERE name = ? AND parent_id IS NULL', [cat.name]
    );
    if (existing) continue;
    const parentId = uuid();
    await db.runAsync(sql, [parentId, null, cat.name, cat.icon, cat.color, cat.type, now]);
    for (const subName of cat.subs) {
      await db.runAsync(sql, [uuid(), parentId, subName, 'Dot', cat.color, cat.type, now]);
    }
  }

  const extraSubs = [
    { parentName: 'Food & Drink', subs: ['Takeaway', 'Bakery', 'Coffee & Tea', 'Home Cooking', 'Juice Bar', 'Snacks', 'Ice Cream', 'Protein Shakes', 'Fruits & Vegetables', 'Milk & Dairy', 'Meat & Seafood', 'Mineral Water', 'Spices & Condiments', 'Food Delivery Apps'] },
    { parentName: 'Transportation', subs: ['Car Wash', 'Driving License', 'Vehicle Tax', 'Bike & Motorcycle', 'Rickshaw / Local Transport', 'Tyre Repair / Puncher', 'Bike Maintenance'] },
    { parentName: 'Housing & Utilities', subs: ['Mobile Phone Bill', 'Security & CCTV', 'Furniture', 'Pest Control', 'Cleaning Supplies', 'Maid / Cook Salary', 'LPG Gas Cylinder', 'Garbage Collection Fee', 'Society Maintenance', 'Generator Fuel', 'Laundry & Dry Cleaning'] },
    { parentName: 'Entertainment', subs: ['Sports Events', 'Books & Reading', 'Board Games', 'Amusement Park', 'Theme Park', 'Photography', 'Arcade', 'Weekend Outing', 'Movie Tickets', 'Video Games'] },
    { parentName: 'Shopping', subs: ['Accessories', 'Luxury Items', 'Online Shopping', 'Bags & Wallets', 'Clothing & Apparel', 'Kitchenware & Utensils', 'Gifts & Souvenirs', 'Superstore Shopping'] },
    { parentName: 'Health & Personal', subs: ['Dental', 'Eye Care', 'Mental Health', 'Vitamins', 'Blood Tests', 'Hospital Visit', 'Vaccination', 'Lab Tests', 'Doctor Consultation'] },
    { parentName: 'Financial', subs: ['Investment', 'Savings Transfer', 'Credit Card', 'Bank Charges', 'ATM Withdrawal', 'Money Transfer', 'Taxes & Duties', 'Mobile Wallet Transfer', 'Crypto Purchases'] },
    { parentName: 'Employment', subs: ['Part-time Job', 'Freelance Payment', 'Salary Bonus', 'Overtime Allowance'] },
    { parentName: 'Other Income', subs: ['Cashback', 'Government Benefits', 'Insurance Claim', 'Prize Money', 'Refund', 'Interest', 'Crypto Earnings', 'Gifts & Eidi'] },
  ];

  for (const { parentName, subs } of extraSubs) {
    const parent = await db.getFirstAsync(
      'SELECT id, color, type FROM categories WHERE name = ? AND parent_id IS NULL', [parentName]
    );
    if (!parent) continue;
    for (const subName of subs) {
      const exists = await db.getFirstAsync(
        'SELECT id FROM categories WHERE name = ? AND parent_id = ?', [subName, parent.id]
      );
      if (!exists) {
        await db.runAsync(sql, [uuid(), parent.id, subName, 'Dot', parent.color, parent.type, now]);
      }
    }
  }
}

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
