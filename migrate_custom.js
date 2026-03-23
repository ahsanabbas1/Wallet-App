const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:0OAh9mYKzifPPTJ5@db.iiqsbbsnjylgvrckwfiy.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    const sqlPath = path.join(__dirname, 'schema_custom.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing custom schema migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
