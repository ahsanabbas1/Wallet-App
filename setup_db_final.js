const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';
const SCHEMA = 'public';

const schemaSQL = `
CREATE SCHEMA IF NOT EXISTS "${SCHEMA}";

SET search_path TO "${SCHEMA}", public, auth;

-- Wallet App Database Schema (from schema.sql)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Changed from auth.uid() for testing if needed, or keep auth.uid() if running in Supabase
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    type TEXT CHECK (type IN ('expense', 'income', 'both')),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL NOT NULL,
    type TEXT CHECK (type IN ('expense', 'income')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    total_amount DECIMAL NOT NULL,
    period TEXT NOT NULL, -- e.g., '2024-07'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Savings Goals table
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    target_amount DECIMAL NOT NULL,
    saved_amount DECIMAL DEFAULT 0,
    icon TEXT,
    color TEXT,
    target_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared Budgets table
CREATE TABLE IF NOT EXISTS shared_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    target_amount DECIMAL NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared Budget Members table
CREATE TABLE IF NOT EXISTS shared_budget_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_budget_id UUID REFERENCES shared_budgets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('Owner', 'Admin', 'Contributor')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty Cards table
CREATE TABLE IF NOT EXISTS loyalty_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    provider_name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shopping List table
CREATE TABLE IF NOT EXISTS shopping_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    item_name TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions for Supabase API (PostgREST)
GRANT USAGE ON SCHEMA "${SCHEMA}" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "${SCHEMA}" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "${SCHEMA}" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "${SCHEMA}" GRANT ALL ON TABLES TO anon, authenticated, service_role;
`;

async function setup() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Setting up schema ${SCHEMA}...`);
    await client.query(schemaSQL);
    console.log('Schema and tables created successfully!');

    // Seeding (using a fixed dummy UUID for testing)
    const userId = '00000000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO users (id, name, email) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [userId, 'Alex Rivera', 'alex@example.com']);
    console.log('User OK');

    const categories = [
      { name: 'Dining Out', color: '#FF5722', icon: 'Utensils', type: 'expense' },
      { name: 'Utilities', color: '#FFC107', icon: 'Zap', type: 'expense' },
      { name: 'Transport', color: '#03A9F4', icon: 'Car', type: 'expense' },
      { name: 'Grocery', color: '#FF9800', icon: 'ShoppingCart', type: 'expense' },
      { name: 'Fuel', color: '#03A9F4', icon: 'Fuel', type: 'expense' },
      { name: 'Freelance', color: '#4CAF50', icon: 'Briefcase', type: 'income' },
      { name: 'Entertainment', color: '#F44336', icon: 'Tv', type: 'expense' },
    ];

    const categoryMap = {};
    for (const cat of categories) {
      const res = await client.query(`
        INSERT INTO categories (name, color, icon, type, user_id) 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [cat.name, cat.color, cat.icon, cat.type, userId]);
      
      let id = res.rows[0]?.id;
      if (!id) {
        const existing = await client.query('SELECT id FROM categories WHERE name = $1 AND user_id = $2', [cat.name, userId]);
        id = existing.rows[0].id;
      }
      categoryMap[cat.name] = id;
    }
    console.log('Categories OK');

    const budgets = [
      { category: 'Dining Out', amount: 500.00, period: '2024-07' },
      { category: 'Utilities', amount: 150.00, period: '2024-07' },
      { category: 'Transport', amount: 200.00, period: '2024-07' },
    ];

    for (const b of budgets) {
      if (categoryMap[b.category]) {
        await client.query(`
          INSERT INTO budgets (user_id, category_id, total_amount, period) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [userId, categoryMap[b.category], b.amount, b.period]);
      }
    }
    console.log('Budgets OK');

    const goals = [
      { title: 'New Car', target: 20000.00, saved: 15000.00, icon: 'Car', color: '#2196F3' },
      { title: 'Emergency Fund', target: 10000.00, saved: 4000.00, icon: 'Wallet', color: '#4CAF50' },
      { title: 'Europe Trip', target: 5000.00, saved: 500.00, icon: 'Plane', color: '#9C27B0' },
    ];

    for (const g of goals) {
      await client.query(`
        INSERT INTO savings_goals (user_id, title, target_amount, saved_amount, icon, color) 
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [userId, g.title, g.target, g.saved, g.icon, g.color]);
    }
    console.log('Goals OK');

    console.log(`Database setup complete for ${SCHEMA}!`);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
