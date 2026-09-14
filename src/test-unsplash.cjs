const https = require('https');

function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, length: data.length, sample: data.slice(0, 100) });
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('1. Testing allorigins:');
  const r1 = await testUrl('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://unsplash.com/napi/search/photos?query=iran&per_page=3'));
  console.log(r1);

  console.log('2. Testing corsproxy.io:');
  const r2 = await testUrl('https://corsproxy.io/?' + encodeURIComponent('https://unsplash.com/napi/search/photos?query=iran&per_page=3'));
  console.log(r2);
}

run();
