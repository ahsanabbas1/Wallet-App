const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';
const BACKUP_SCHEMA = 'walletapp_db';

async function backupSchema() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Backing up public schema to "${BACKUP_SCHEMA}"...\n`);

    // 1. Create backup schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${BACKUP_SCHEMA}"`);
    console.log(`Schema "${BACKUP_SCHEMA}" created (or already exists).`);

    // 2. Get all table names from public schema
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (tables.length === 0) {
      console.log('No tables found in public schema.');
      return;
    }

    console.log(`\nFound ${tables.length} tables to backup:\n`);

    for (const { tablename } of tables) {
      try {
        // Drop the backup table if it exists (fresh backup)
        await client.query(`DROP TABLE IF EXISTS "${BACKUP_SCHEMA}"."${tablename}" CASCADE`);

        // Create backup table with data using CREATE TABLE AS
        await client.query(`
          CREATE TABLE "${BACKUP_SCHEMA}"."${tablename}" AS 
          SELECT * FROM public."${tablename}"
        `);

        // Get row count
        const { rows: countRows } = await client.query(
          `SELECT COUNT(*) as cnt FROM "${BACKUP_SCHEMA}"."${tablename}"`
        );
        console.log(`  ✓ ${tablename} — ${countRows[0].cnt} rows backed up`);
      } catch (tableErr) {
        console.error(`  ✗ ${tablename} — Error: ${tableErr.message}`);
      }
    }

    // 3. Grant permissions
    await client.query(`GRANT USAGE ON SCHEMA "${BACKUP_SCHEMA}" TO postgres`);

    const timestamp = new Date().toISOString();
    console.log(`\n✅ Backup complete at ${timestamp}`);
    console.log(`   Schema: "${BACKUP_SCHEMA}"`);
    console.log(`\nNote: This is a data-only backup (no constraints/indexes).`);
    console.log(`The backup schema is NOT used by the app — it's for reference only.`);
    console.log(`To restore, you would copy data back from "${BACKUP_SCHEMA}" to "public".`);

  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backupSchema();
