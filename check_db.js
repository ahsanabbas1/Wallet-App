const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';
const SCHEMA = 'public';

async function check() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if schema exists
    const schemaRes = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`, [SCHEMA]);
    if (schemaRes.rows.length === 0) {
      console.log(`Schema '${SCHEMA}' does NOT exist.`);
    } else {
      console.log(`Schema '${SCHEMA}' exists.`);
    }

    // List tables in the schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `, [SCHEMA]);
    
    console.log(`Tables in '${SCHEMA}':`, tablesRes.rows.map(r => r.table_name).join(', '));

    // Check row counts
    for (const table of tablesRes.rows.map(r => r.table_name)) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${SCHEMA}"."${table}"`);
      console.log(`Table '${table}': ${countRes.rows[0].count} records.`);
    }

  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await client.end();
  }
}

check();
