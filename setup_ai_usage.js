const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

const schemaSQL = `
-- AI Usage Tracking
CREATE TABLE IF NOT EXISTS ai_usage (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    usage_date DATE DEFAULT CURRENT_DATE,
    request_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);

-- Grant permissions
GRANT ALL ON TABLE ai_usage TO anon, authenticated, service_role;
`;

async function setup() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Setting up AI Usage schema...');
    await client.query(schemaSQL);
    console.log('AI Usage table created successfully!');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
