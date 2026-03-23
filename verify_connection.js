require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;
const SUPABASE_SCHEMA = process.env.EXPO_PUBLIC_SUPABASE_SCHEMA || 'public';

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: SUPABASE_SCHEMA }
});

async function verify() {
  console.log(`Verifying connection to schema: ${SUPABASE_SCHEMA}...`);
  
  const tables = ['users', 'categories', 'transactions', 'budgets', 'savings_goals'];
  
  for (const table of tables) {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      console.log(`Table '${table}': ${count} records found.`);
    }
  }
}

verify();
