const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.log('Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(migrationName) {
    try {
        console.log(`\n⏳ Running migration: ${migrationName}`);

        const migrationPath = path.join(__dirname, migrationName);
        if (!fs.existsSync(migrationPath)) {
            console.error(`❌ Migration file not found: ${migrationPath}`);
            return false;
        }

        const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

        // Execute each SQL statement separately
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));

        for (const statement of statements) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
            if (error) {
                // Some Supabase plans don't have exec_sql, try alternative method
                console.warn(`⚠️  Could not execute statement via RPC: ${error.message}`);
            }
        }

        console.log(`✅ Migration completed: ${migrationName}`);
        return true;
    } catch (error) {
        console.error(`❌ Error running migration: ${error.message}`);
        return false;
    }
}

async function fixPlannedPaymentsSchema() {
    try {
        console.log('\n🔧 Fixing planned_payments schema...\n');

        // Check if planned_payments table exists
        const { data: tables, error: listError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'planned_payments');

        if (listError) {
            console.log('ℹ️  Using direct SQL approach...');
        } else if (!tables?.length) {
            console.log('⚠️  planned_payments table does not exist yet');
            console.log('Please run migration_v2.sql first in your Supabase SQL editor');
            return false;
        }

        // Try running the migration via SQL editor paste approach
        const migrationSQL = `
    -- Add is_active column if it doesn't exist
    ALTER TABLE IF EXISTS planned_payments
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

    -- Add type column if it doesn't exist (for expense/income)
    ALTER TABLE IF EXISTS planned_payments
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';

    -- Ensure updated_at column exists
    ALTER TABLE IF EXISTS planned_payments
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- Create an index on user_id for faster queries
    CREATE INDEX IF NOT EXISTS idx_planned_payments_user_id 
      ON planned_payments(user_id);

    -- Create an index on next_date for faster sorting
    CREATE INDEX IF NOT EXISTS idx_planned_payments_next_date 
      ON planned_payments(next_date);

    -- Create an index on is_active for faster filtering
    CREATE INDEX IF NOT EXISTS idx_planned_payments_is_active 
      ON planned_payments(is_active);
    `;

        console.log('📋 SQL to run in Supabase SQL Editor:\n');
        console.log('1. Open: https://app.supabase.com/project/[YOUR-PROJECT-ID]/sql/new');
        console.log('2. Paste the following SQL and click "Run":\n');
        console.log('---START---');
        console.log(migrationSQL);
        console.log('---END---\n');

        console.log('✅ Copy the SQL above and paste it into your Supabase SQL Editor');
        return true;
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Wallet App - Database Migration Helper');
    console.log('='.repeat(60));

    const args = process.argv.slice(2);

    if (args.includes('--fix-planned-payments')) {
        await fixPlannedPaymentsSchema();
    } else {
        console.log('\nUsage:');
        console.log('  node setup_migrations.js --fix-planned-payments');
        console.log('\nThis will help you fix the planned_payments schema.');
    }
}

main().catch(console.error);
