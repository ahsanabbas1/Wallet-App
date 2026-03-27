const { Client } = require('pg');
const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Running migration for savings_goals...');
    
    await client.query(`
      ALTER TABLE savings_goals 
      ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS repeat_basis TEXT DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS repeat_value INTEGER DEFAULT 0;
    `);
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
