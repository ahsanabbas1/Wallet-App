// const fetch = require('node-fetch'); // Using global fetch
require('dotenv').config();

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA = 'public';

async function test() {
  console.log(`Testing URL: ${URL}`);
  console.log(`Schema: ${SCHEMA}`);
  
  try {
    const res = await fetch(`${URL}/rest/v1/categories?select=*`, {
      method: 'GET',
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Accept-Profile': SCHEMA
      }
    });
    
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

test();
