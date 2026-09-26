const http = require('http');
const https = require('https');
const fs = require('fs');

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 10808;
const TARGET_HOST = 'dl.google.com';
const TARGET_PATH = '/android/repository/commandlinetools-win-11076708_latest.zip';
const DEST = 'C:/Android/temp/cmdline-tools.zip';

const req = http.request({
  host: PROXY_HOST,
  port: PROXY_PORT,
  method: 'CONNECT',
  path: `${TARGET_HOST}:443`,
});

req.on('connect', (res, socket) => {
  if (res.statusCode !== 200) {
    console.error('Proxy CONNECT error:', res.statusCode);
    process.exit(1);
  }

  const fileStream = fs.createWriteStream(DEST);

  const getReq = https.get(
    {
      host: TARGET_HOST,
      path: TARGET_PATH,
      socket: socket,
      agent: false,
    },
    (getResponse) => {
      if (getResponse.statusCode !== 200) {
        console.error('HTTP error:', getResponse.statusCode);
        process.exit(1);
      }

      const totalBytes = parseInt(getResponse.headers['content-length'] || '0', 10);
      let downloaded = 0;

      getResponse.on('data', (chunk) => {
        downloaded += chunk.length;
        const pct = totalBytes ? ((downloaded / totalBytes) * 100).toFixed(1) : '?';
        process.stdout.write(`\rDownloading: ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB (${pct}%)`);
      });

      getResponse.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log('\nDownload complete!');
      });
    }
  );

  getReq.on('error', (err) => {
    console.error('\nGet error:', err);
    process.exit(1);
  });
});

req.on('error', (err) => {
  console.error('Proxy error:', err);
  process.exit(1);
});

req.end();
