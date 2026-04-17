const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

const categories = [
  // --- EXPENSES ---
  { 
    name: 'Food & Drink', color: '#FF5722', icon: 'Utensils', type: 'expense',
    subs: [
      { name: 'Groceries', icon: 'ShoppingCart' },
      { name: 'Restaurants & Fast Food', icon: 'Pizza' },
      { name: 'Bar & Cafe', icon: 'Coffee' },
      { name: 'Street Food', icon: 'Store' }
    ]
  },
  {
    name: 'Transportation', color: '#03A9F4', icon: 'Car', type: 'expense',
    subs: [
      { name: 'Public Transport', icon: 'Bus' },
      { name: 'Taxi & Ride-share', icon: 'Smartphone' },
      { name: 'Fuel', icon: 'Fuel' },
      { name: 'Car Maintenance', icon: 'Wrench' },
      { name: 'Parking & Tolls', icon: 'MapPin' }
    ]
  },
  {
    name: 'Housing & Utilities', color: '#FFC107', icon: 'Home', type: 'expense',
    subs: [
      { name: 'Rent & Mortgage', icon: 'Key' },
      { name: 'Electricity & Gas', icon: 'Zap' },
      { name: 'Water', icon: 'Droplets' },
      { name: 'Internet & TV', icon: 'Wifi' },
      { name: 'Home Maintenance', icon: 'Hammer' }
    ]
  },
  {
    name: 'Entertainment', color: '#9C27B0', icon: 'Tv', type: 'expense',
    subs: [
      { name: 'Movies & Concerts', icon: 'Ticket' },
      { name: 'Streaming Services', icon: 'PlayCircle' },
      { name: 'Gaming', icon: 'Gamepad2' },
      { name: 'Hobbies', icon: 'Palette' }
    ]
  },
  {
    name: 'Shopping', color: '#795548', icon: 'ShoppingBag', type: 'expense',
    subs: [
      { name: 'Clothing & Shoes', icon: 'Shirt' },
      { name: 'Electronics', icon: 'Cpu' },
      { name: 'Home & Garden', icon: 'Leaf' },
      { name: 'Gifts & Donations', icon: 'Gift' }
    ]
  },
  {
    name: 'Health & Personal', color: '#E91E63', icon: 'HeartPulse', type: 'expense',
    subs: [
      { name: 'Medical & Pharmacy', icon: 'Pill' },
      { name: 'Personal Care', icon: 'Sparkles' },
      { name: 'Fitness & Sports', icon: 'Dumbbell' }
    ]
  },
  {
    name: 'Financial', color: '#607D8B', icon: 'Banknote', type: 'expense',
    subs: [
      { name: 'Insurance', icon: 'ShieldCheck' },
      { name: 'Taxes', icon: 'FileText' },
      { name: 'Bank Fees & Interest', icon: 'CreditCard' }
    ]
  },
  
  // --- INCOME ---
  {
    name: 'Employment', color: '#4CAF50', icon: 'Briefcase', type: 'income',
    subs: [
      { name: 'Salary', icon: 'Wallet' },
      { name: 'Bonus', icon: 'TrendingUp' },
      { name: 'Overtime', icon: 'Clock' }
    ]
  },
  {
    name: 'Business & Freelance', color: '#8BC34A', icon: 'Monitor', type: 'income',
    subs: [
      { name: 'Sales', icon: 'Tag' },
      { name: 'Service Revenue', icon: 'UserCheck' },
      { name: 'Consulting', icon: 'MessageCircle' }
    ]
  },
  {
    name: 'Investments', color: '#009688', icon: 'LineChart', type: 'income',
    subs: [
      { name: 'Dividends', icon: 'PieChart' },
      { name: 'Interest', icon: 'Percent' },
      { name: 'Rental Income', icon: 'Home' }
    ]
  },
  {
    name: 'Other Income', color: '#CDDC39', icon: 'PlusCircle', type: 'income',
    subs: [
      { name: 'Gifts', icon: 'Gift' },
      { name: 'Refunds', icon: 'Undo' },
      { name: 'Selling Assets', icon: 'DollarSign' }
    ]
  }
];

async function migrate() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Starting Categorical Hierarchy Migration...');

    // 1. Add parent_id column if it doesn't exist
    console.log('Adding parent_id column...');
    await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE CASCADE;
    `);

    // 2. Clear existing shared categories to avoid duplicates (user_id IS NULL)
    console.log('Cleaning up old shared categories...');
    await client.query('DELETE FROM categories WHERE user_id IS NULL');

    // 3. Insert new hierarchy
    for (const main of categories) {
      console.log(`Inserting Broad Category: ${main.name}`);
      const res = await client.query(`
        INSERT INTO categories (name, color, icon, type, user_id)
        VALUES ($1, $2, $3, $4, NULL)
        RETURNING id
      `, [main.name, main.color, main.icon, main.type]);
      
      const parentId = res.rows[0].id;

      for (const sub of main.subs) {
        process.stdout.write(`  -> Sub-category: ${sub.name}... `);
        await client.query(`
          INSERT INTO categories (name, color, icon, type, user_id, parent_id)
          VALUES ($1, $2, $3, $4, NULL, $5)
        `, [sub.name, main.color, sub.icon, main.type, parentId]);
        console.log('Done');
      }
    }

    console.log('\nMigration successful! Your database now has a broad hierarchical category system.');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
