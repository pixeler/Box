import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9228;
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-glass';
mkdirSync('scratch/verify', { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((resolve, reject) => pending.set(i, { resolve, reject })); };
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const shot = async (name, clip) => { const r = await send('Page.captureScreenshot', { format: 'png', clip: clip ? { ...clip, scale: 1 } : undefined }); writeFileSync(`scratch/verify/${name}.png`, Buffer.from(r.data, 'base64')); };

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1494, height: 1026, deviceScaleFactor: 1, mobile: false, screenWidth: 1494, screenHeight: 1026 });
  await send('Page.navigate', { url: 'http://127.0.0.1:5180/' });
  await sleep(3000);
  await evaluate(`localStorage.setItem('second_brain_theme','default-dark'); localStorage.setItem('second_brain_glass_background','true'); true`);
  await send('Page.reload');
  await sleep(4000);
  const info = await evaluate(`(() => {
    const card = document.querySelector('#app-main');
    const img = document.querySelector('#figma-glass-card-filter feImage');
    const disp = document.querySelector('#figma-glass-card-filter feDisplacementMap');
    const rect = card.getBoundingClientRect();
    return {
      card: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      backdrop: getComputedStyle(card).backdropFilter || getComputedStyle(card).webkitBackdropFilter,
      hrefHead: img?.getAttribute('href')?.slice(0, 40),
      hrefLen: img?.getAttribute('href')?.length,
      scale: disp?.getAttribute('scale'),
      imageLoaded: img ? img.href?.baseVal?.length > 100 : false,
    };
  })()`);
  console.log(JSON.stringify(info));
  await shot('glass-probe-before', { x: 380, y: 110, width: 220, height: 360 });

  await evaluate(`(() => {
    document.querySelectorAll('#figma-glass-card-filter feDisplacementMap').forEach((el, i) => el.setAttribute('scale', String(300 - i * 120)));
  })()`);
  await sleep(500);
  await shot('glass-probe-after', { x: 380, y: 110, width: 220, height: 360 });

  // Replace the filter pipeline with a hard color shift: if the backdrop turns
  // red, SVG url() filters are honoured by backdrop-filter in this Chrome.
  await evaluate(`(() => {
    const filter = document.querySelector('#figma-glass-card-filter');
    filter.innerHTML = '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>';
  })()`);
  await sleep(500);
  await shot('glass-probe-red-filter', { x: 380, y: 110, width: 220, height: 360 });

  await evaluate(`document.querySelector('#app-main').style.backdropFilter = 'blur(2px) saturate(180%)'; document.querySelector('#app-main').style.webkitBackdropFilter = 'blur(2px) saturate(180%)';`);
  await sleep(500);
  await shot('glass-probe-blur-only', { x: 380, y: 110, width: 220, height: 360 });
} catch (e) { console.error(e); }
finally { chrome.kill(); }
