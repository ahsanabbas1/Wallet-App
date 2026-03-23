const { Client } = require('pg');

const connectionString = 'postgresql://postgres:0OAh9mYKzifPPTJ5@db.iiqsbbsnjylgvrckwfiy.supabase.co:5432/postgres';
const SCHEMA = 'WalletApp_Finance_Database';

async function seed() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Setting search path to ${SCHEMA}...`);
    await client.query(`SET search_path TO "${SCHEMA}", public, auth`);

    const userId = '00000000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO users (id, name, email) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
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
      console.log(`Category ${cat.name}: ${id}`);
    }

    const transactions = [
      { title: 'Grocery Store', amount: 156.00, type: 'expense', category: 'Grocery', date: '2024-10-24' },
      { title: 'Fuel Station', amount: 45.00, type: 'expense', category: 'Fuel', date: '2024-10-24' },
      { title: 'Freelance Project', amount: 2500.00, type: 'income', category: 'Freelance', date: '2024-10-24' },
      { title: 'Netflix', amount: 15.00, type: 'expense', category: 'Entertainment', date: '2024-10-23' },
    ];

    for (const tx of transactions) {
      await client.query(`
        INSERT INTO transactions (user_id, category_id, amount, type, title, date) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, categoryMap[tx.category], tx.amount, tx.type, tx.title, tx.date]);
    }
    console.log('Transactions OK');

    const budgets = [
      { category: 'Dining Out', amount: 500.00, period: '2024-07' },
      { category: 'Utilities', amount: 150.00, period: '2024-07' },
      { category: 'Transport', amount: 200.00, period: '2024-07' },
    ];

    for (const b of budgets) {
      await client.query(`
        INSERT INTO budgets (user_id, category_id, total_amount, period) 
        VALUES ($1, $2, $3, $4)
      `, [userId, categoryMap[b.category], b.amount, b.period]);
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
      `, [userId, g.title, g.target, g.saved, g.icon, g.color]);
    }
    console.log('Goals OK');

    console.log('Seeding completed successfully in custom schema!');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
