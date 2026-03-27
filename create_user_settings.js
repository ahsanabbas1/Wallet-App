const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

async function setupSettings() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected. Creating user_settings table...');

    // 1. Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_settings (
        user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Created user_settings table.');

    // 2. Enable RLS
    await client.query(`ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;`);
    console.log('Enabled RLS.');

    // 3. Create RLS Policies
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can select own settings') THEN
          CREATE POLICY "Users can select own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can insert own settings') THEN
          CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can update own settings') THEN
          CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
        END IF;
      END $$;
    `);
    console.log('Created RLS policies.');

    console.log('\nSuccess! user_settings table is ready.');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupSettings();
