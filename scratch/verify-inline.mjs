import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9224;
const URL = 'http://localhost:5179/';
const profile = 'C:/Users/Pixel/Documents/antigravity/friendly-curie/scratch/chrome-profile-verify';

mkdirSync('scratch/verify', { recursive: true });

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

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'evaluate failed');
  }
  return result.result.value;
}

async function shot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`scratch/verify/${name}.png`, Buffer.from(result.data, 'base64'));
}

async function openPage(width, height, mobile, label) {
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
  await sleep(4000);

  await evaluate(cdp, `(() => {
    const buttons = [...document.querySelectorAll('button, [role="button"]')];
    const b = buttons.find(x => (x.textContent || '').trim().includes('تقویم') && x.getBoundingClientRect().width > 0);
    if (b) { b.click(); return 'clicked'; }
    return 'not found';
  })()`);
  await sleep(1800);

  const info = await evaluate(cdp, `(() => {
    const header = document.querySelector('header');
    const h1 = header?.querySelector('h1');
    const subtitle = header?.querySelector('h1')?.parentElement?.parentElement?.querySelector('p');
    const actionButtons = [...(header?.querySelectorAll(':scope > div > div:last-child button') || [])];
    return {
      title: h1?.textContent?.trim(),
      subtitle: subtitle?.textContent?.trim(),
      headerText: header?.innerText?.slice(0, 300),
      actions: actionButtons.map((b) => ({
        label: b.getAttribute('aria-label') || b.textContent?.trim(),
        left: Math.round(b.getBoundingClientRect().left),
        right: Math.round(b.getBoundingClientRect().right),
      })),
      visibleAdds: [...document.querySelectorAll('button[aria-label^="افزودن کار برای"]')]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .slice(0, 8)
        .map((b) => ({ label: b.getAttribute('aria-label'), top: Math.round(b.getBoundingClientRect().top) })),
    };
  })()`);
  console.log(label, JSON.stringify(info, null, 2));
  await shot(cdp, `${label}-week`);

  // Open the first visible week-cell inline composer.
  const clicked = await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button[aria-label^="افزودن کار برای"]')]
      .find((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().height > 0);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'week add click:', clicked);
  await sleep(900);
  await shot(cdp, `${label}-week-inline`);
  const inline = await evaluate(cdp, `(() => {
    const composer = document.querySelector('textarea[placeholder^="چی کاره"]')?.closest('div.rounded-2xl');
    const rect = composer?.getBoundingClientRect();
    const close = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('بستن'));
    return {
      composer: rect ? { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) } : null,
      closeVisible: close ? close.getBoundingClientRect().width > 0 : false,
      addRows: [...document.querySelectorAll('button[aria-label^="افزودن کار برای"]')].filter((b) => b.getBoundingClientRect().width > 0).length,
    };
  })()`);
  console.log(label, 'inline:', JSON.stringify(inline));

  // Type and submit to confirm the composer stays open for the next task.
  await evaluate(cdp, `document.querySelector('textarea[placeholder^="چی کاره"]')?.focus()`);
  await cdp.send('Input.insertText', { text: 'خرید نان برای صبحانه' });
  await sleep(400);
  const submitted = await evaluate(cdp, `(() => {
    const composer = document.querySelector('textarea[placeholder^="چی کاره"]')?.closest('div.rounded-2xl');
    const btn = composer?.querySelector('button[type="submit"]');
    if (!btn) return 'missing';
    btn.click();
    return 'clicked';
  })()`);
  console.log(label, 'submit click:', submitted);
  await sleep(1600);
  await shot(cdp, `${label}-week-inline-after-submit`);
  const afterSubmit = await evaluate(cdp, `(() => ({
    composerStillOpen: Boolean(document.querySelector('textarea[placeholder^="چی کاره"]')),
    titleValue: document.querySelector('textarea[placeholder^="چی کاره"]')?.value,
    bodyHasTask: document.body.innerText.includes('خرید نان برای صبحانه'),
  }))()`);
  console.log(label, 'after submit:', JSON.stringify(afterSubmit));

  // Close the inline composer.
  await evaluate(cdp, `(() => {
    const setter = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('بستن') && b.getBoundingClientRect().width > 0);
    setter?.click();
  })()`);
  await sleep(400);

  if (!mobile) {
    // Centered desktop modal from the header add action.
    await evaluate(cdp, `(() => {
      const b = document.querySelector('button[aria-label="افزودن کار"]');
      b?.click();
    })()`);
    await sleep(700);
    await shot(cdp, `${label}-modal`);
    const modal = await evaluate(cdp, `(() => {
      const panel = document.querySelector('[data-open]');
      const rect = panel?.getBoundingClientRect();
      return rect ? {
        top: Math.round(rect.top), left: Math.round(rect.left),
        width: Math.round(rect.width), height: Math.round(rect.height),
        viewport: { width: innerWidth, height: innerHeight },
        centeredX: Math.abs((rect.left + rect.width / 2) - innerWidth / 2) < 4,
        centeredY: Math.abs((rect.top + rect.height / 2) - innerHeight / 2) < 8,
      } : null;
    })()`);
    console.log(label, 'modal rect:', JSON.stringify(modal));
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(700);
  }

  // Day view inline composer from a section add.
  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => (x.textContent || '').trim() === 'روز');
    b?.click();
  })()`);
  await sleep(900);
  await shot(cdp, `${label}-day`);
  const dayClick = await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button[title^="افزودن کار به"]')]
      .find((x) => x.getBoundingClientRect().width > 0);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'day add click:', dayClick);
  await sleep(800);
  await shot(cdp, `${label}-day-inline`);
  console.log(label, 'day inline open:', await evaluate(cdp, `Boolean(document.querySelector('textarea[placeholder^="چی کاره"]'))`));

  // Move to another day so the "امروز" action appears, then capture the header.
  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => (x.textContent || '').trim() === 'هفته');
    b?.click();
  })()`);
  await sleep(700);
  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => (x.getAttribute('aria-label') || '').includes('بعد'));
    b?.click();
  })()`);
  await sleep(700);
  const otherWeek = await evaluate(cdp, `(() => {
    const header = document.querySelector('header');
    const today = [...header.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'امروز');
    return { title: header.querySelector('h1')?.textContent?.trim(), subtitle: header.querySelector('h1')?.parentElement?.parentElement?.querySelector('p')?.textContent?.trim(), todayVisible: Boolean(today) };
  })()`);
  console.log(label, 'other week header:', JSON.stringify(otherWeek));
  await shot(cdp, `${label}-week-other`);

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
