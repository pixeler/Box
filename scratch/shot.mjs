import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9223;
const URL = 'http://localhost:5178/';
const profile = 'C:/Users/Pixel/Documents/antigravity/friendly-curie/scratch/chrome-profile-shot';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('DevTools not ready');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function openPage(width, height, mobile, name) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await cdp.send('Page.navigate', { url: URL });
  await sleep(3500);
  // Click calendar tab
  const click = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = [...document.querySelectorAll('button')];
      const b = buttons.find(x => (x.textContent || '').trim().includes('تقویم'));
      if (b) { b.click(); return 'clicked'; }
      return 'not found';
    })()`,
    returnByValue: true,
  });
  console.log(name, click.result.value);
  await sleep(1800);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`scratch/calendar-${name}.png`, Buffer.from(shot.data, 'base64'));

  // click mode buttons and capture
  const modes = [
    ['روز', 'day'],
    ['ماه', 'month'],
    ['سال', 'year'],
    ['هفته', 'week'],
  ];
  for (const [label, slug] of modes) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = [...document.querySelectorAll('header button')];
        const b = buttons.find(x => (x.textContent || '').trim() === ${JSON.stringify(label)});
        if (b) { b.click(); return 'clicked'; }
        return 'not found';
      })()`,
      returnByValue: true,
    });
    await sleep(900);
    const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`scratch/calendar-${name}-${slug}.png`, Buffer.from(s.data, 'base64'));
  }
  ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
}

try {
  await waitDevtools();
  await openPage(1494, 1026, false, 'desktop');
  await openPage(390, 844, true, 'mobile');
} catch (err) {
  console.error(err);
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
