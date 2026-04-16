async function check() {
  try {
    const res = await fetch('https://www.google.com');
    console.log('Connectivity OK:', res.status);
  } catch (e) {
    console.error('Connectivity FAILED:', e.message);
  }
}
check();
