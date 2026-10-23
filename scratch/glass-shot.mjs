import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9224;
const URL = 'http://127.0.0.1:5181/';
const profile = 'C:/Users/Pixel/Documents/antigravity/friendly-curie/scratch/chrome-profile-glass';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
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
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result?.value;
  }
}

async function shot(cdp, name) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`scratch/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('saved', name);
}

try {
  await waitDevtools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1494,
    height: 1026,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1494,
    screenHeight: 1026,
  });

  await cdp.send('Page.navigate', { url: URL });
  await sleep(3500);
  console.log(await cdp.evaluate(`(() => {
    localStorage.setItem('second_brain_wallpaper', 'wafer-sky');
    localStorage.setItem('second_brain_glass_background', 'true');
    localStorage.setItem('second_brain_glass_opacity', '0.2');
    return 'seeded';
  })()`));

  await cdp.send('Page.reload');
  await sleep(4500);
  console.log(await cdp.evaluate(`(() => {
    const el = document.getElementById('app-main');
    const cs = el ? getComputedStyle(el) : null;
    return { cls: el?.className.slice(-20), bf: cs?.backdropFilter, size: el ? [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] : null };
  })()`));
  await shot(cdp, 'glass-desktop');

  // Dark mode variant
  await cdp.evaluate(`localStorage.setItem('second_brain_theme', 'dark'); true`);
  await cdp.send('Page.reload');
  await sleep(4500);
  await shot(cdp, 'glass-desktop-dark');

  ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
} catch (err) {
  console.error(err);
} finally {
  chrome.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
