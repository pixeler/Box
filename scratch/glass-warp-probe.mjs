import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9229;
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-warp';
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

async function injectMap(radialStrength, rimStrength, centerPow, rimRatio, scales = [168, 100, 32]) {
  return evaluate(`(() => {
    const W = 282, H = 460;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const hw = W / 2, hh = H / 2;
    const radius = 16;
    const rim = Math.min(hw, hh) * ${rimRatio};
    const rr = (px, py) => {
      const qx = Math.abs(px) - hw + radius;
      const qy = Math.abs(py) - hh + radius;
      return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const px = x + 0.5 - hw, py = y + 0.5 - hh;
        const inside = -rr(px, py);
        if (inside <= 0) { d[i] = d[i+1] = 128; d[i+2] = 255; d[i+3] = 0; continue; }
        const ex = px / hw, ey = py / hh;
        const rn = Math.min(1, Math.hypot(ex, ey));
        let nx = -ex * Math.pow(rn, ${centerPow}) * ${radialStrength};
        let ny = -ey * Math.pow(rn, ${centerPow}) * ${radialStrength};
        if (inside < rim) {
          const eps = 0.75;
          const gx = rr(px + eps, py) - rr(px - eps, py);
          const gy = rr(px, py + eps) - rr(px, py - eps);
          const len = Math.hypot(gx, gy) || 1;
          const t = inside / rim;
          const bell = Math.sin(t * Math.PI);
          nx += -(gx / len) * bell * ${rimStrength};
          ny += -(gy / len) * bell * ${rimStrength};
        }
        d[i] = Math.max(0, Math.min(255, Math.round(128 + nx * 127)));
        d[i+1] = Math.max(0, Math.min(255, Math.round(128 + ny * 127)));
        d[i+2] = 255;
        d[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL();
    document.querySelector('#figma-glass-card-filter feImage').setAttribute('href', url);
    const scales = ${JSON.stringify(scales)};
    document.querySelectorAll('#figma-glass-card-filter feDisplacementMap').forEach((el, i) => el.setAttribute('scale', String(scales[i])));
    return { url: url.slice(0, 30), len: url.length };
  })()`);
}

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1494, height: 1026, deviceScaleFactor: 1, mobile: false, screenWidth: 1494, screenHeight: 1026 });
  await send('Page.navigate', { url: 'http://127.0.0.1:5180/' });
  await sleep(3000);
  await evaluate(`localStorage.setItem('second_brain_theme','default-dark'); localStorage.setItem('second_brain_glass_background','true'); true`);
  await send('Page.reload');
  await sleep(4000);

  const rect = await evaluate(`(() => { const r = document.querySelector('#app-main').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  rect.width = rect.w; rect.height = rect.h; delete rect.w; delete rect.h; console.log('rect', rect);
  await shot('warp-baseline', rect);

  console.log(await injectMap(0.22, 1.25, 2.2, 0.115, [138, 98, 58]));
  await sleep(500);
  await shot('warp-d', rect);

  console.log(await injectMap(0.32, 1.05, 2.2, 0.1, [132, 100, 62]));
  await sleep(500);
  await shot('warp-e', rect);
} catch (e) { console.error(e); }
finally { chrome.kill(); }
