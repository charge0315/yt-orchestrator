const axios = require('axios');

async function check(url) {
  try {
    const res = await axios.get(url, { timeout: 5000, validateStatus: () => true });
    console.log('URL:', url);
    console.log('Status:', res.status);
    console.log('Body:', typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data);
  } catch (e) {
    console.error('URL:', url);
    console.error('Error message:', e.message);
    if (e.code) console.error('Error code:', e.code);
    if (e.response) {
      console.error('Response status:', e.response.status);
      try { console.error('Response data:', JSON.stringify(e.response.data)); } catch(_) { console.error('Response data (raw):', e.response.data); }
    }
  }
  console.log('\n----\n');
}

async function main() {
  const base = 'http://localhost:3000';
  await check(`${base}/api/ytmusic/playlists`);
  await check(`${base}/api/artists`);
  await check(`${base}/api/playlists`);
  await check(`${base}/api/health`);
}

main();
