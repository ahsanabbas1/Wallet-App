const fetch = require('node-fetch');

async function test() {
  const response = await fetch('https://wallet-app-ten-sooty.vercel.app/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "hi", context: "", history: [] })
  });
  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Response:', text);
}
test();
