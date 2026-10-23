import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9225;
const URL = 'http://localhost:5179/';
const profile = 'C:/Users/Pixel/Documents/antigravity/friendly-curie/scratch/chrome-profile-verify-notes';

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

async function newPage(width, height, mobile) {
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
  return { cdp, ws, target };
}

async function closePage(cdp, ws, target) {
  ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
}

async function runNotesDesktop() {
  const { cdp, ws, target } = await newPage(1494, 1026, false);
  const label = 'desktop';

  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button, [role="button"]')]
      .find(x => (x.textContent || '').trim() === 'یادداشت' && x.getBoundingClientRect().width > 0);
    b?.click();
  })()`);
  await sleep(1600);
  await shot(cdp, `${label}-notes-list`);

  const newNote = await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button[aria-label="یادداشت جدید"]')]
      .find(x => x.getBoundingClientRect().width > 0);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'new note:', newNote);
  await sleep(2600);
  await shot(cdp, `${label}-note-open`);

  await evaluate(cdp, `(() => {
    const el = document.querySelector('[contenteditable="true"]');
    if (!el) return 'missing';
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    return 'focused';
  })()`);
  await sleep(300);
  await cdp.send('Input.insertText', { text: '/' });
  await sleep(900);
  await shot(cdp, `${label}-note-slash`);

  const taskMenuClick = await evaluate(cdp, `(() => {
    const candidates = [...document.querySelectorAll('button, [role="option"], [class*="suggestion"] [class*="item"]')]
      .filter((el) => {
        const t = (el.textContent || '').trim();
        return t.includes('انتخاب از لیست تسک‌ها') && el.getBoundingClientRect().width > 0;
      })
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    const item = candidates[0];
    if (!item) return { result: 'missing' };
    item.click();
    return { result: 'clicked', tag: item.tagName, text: (item.textContent || '').trim().slice(0, 80) };
  })()`);
  console.log(label, 'task menu click:', JSON.stringify(taskMenuClick));
  await sleep(1000);
  await shot(cdp, `${label}-note-taskpicker`);

  const newListClick = await evaluate(cdp, `(() => {
    const all = [...document.querySelectorAll('button, [role="option"], div')];
    const target = all
      .filter((el) => (el.textContent || '').trim().includes('لیست تسک جدید') && el.getBoundingClientRect().width > 0)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!target) return 'missing';
    const clickable = target.closest('button, [role="option"], [data-index]') || target;
    clickable.click();
    return 'clicked';
  })()`);
  console.log(label, 'new list click:', newListClick);
  await sleep(1000);
  await shot(cdp, `${label}-note-tasklist`);

  const addRowClick = await evaluate(cdp, `(() => {
    const editor = document.querySelector('[contenteditable="true"]');
    const b = [...(editor?.querySelectorAll('button') || [])]
      .find((x) => (x.textContent || '').includes('افزودن تسک') && x.getBoundingClientRect().width > 0);
    if (!b) return { result: 'missing', editorText: editor?.innerText?.slice(0, 200) };
    b.click();
    return { result: 'clicked' };
  })()`);
  console.log(label, 'note add row:', JSON.stringify(addRowClick));
  await sleep(800);
  await shot(cdp, `${label}-note-inline`);
  const inlineInfo = await evaluate(cdp, `(() => {
    const textarea = [...document.querySelectorAll('textarea[placeholder^="چی کاره"]')]
      .find((t) => t.getBoundingClientRect().width > 0);
    const composer = textarea?.closest('div.rounded-2xl');
    const rect = composer?.getBoundingClientRect();
    const noteEditor = document.querySelector('[contenteditable="true"]');
    return {
      composerVisible: Boolean(textarea),
      insideEditor: Boolean(noteEditor?.contains(composer)),
      rect: rect ? { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) } : null,
      focusOnComposer: document.activeElement === textarea,
      chipCount: composer ? composer.querySelectorAll('button').length : 0,
    };
  })()`);
  console.log(label, 'note inline:', JSON.stringify(inlineInfo));

  await evaluate(cdp, `(() => {
    const t = [...document.querySelectorAll('textarea[placeholder^="چی کاره"]')]
      .find((x) => x.getBoundingClientRect().width > 0);
    t?.focus();
  })()`);
  await cdp.send('Input.insertText', { text: 'پیگیری پیشنهاد همکاری' });
  await sleep(400);
  const submitNote = await evaluate(cdp, `(() => {
    const t = [...document.querySelectorAll('textarea[placeholder^="چی کاره"]')]
      .find((x) => x.getBoundingClientRect().width > 0);
    const composer = t?.closest('div.rounded-2xl');
    const b = composer?.querySelector('button[type="submit"]');
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'note submit:', submitNote);
  await sleep(1800);
  await shot(cdp, `${label}-note-after-submit`);
  const noteAfter = await evaluate(cdp, `(() => {
    const t = [...document.querySelectorAll('textarea[placeholder^="چی کاره"]')]
      .find((x) => x.getBoundingClientRect().width > 0);
    const note = document.querySelector('[contenteditable="true"]');
    return {
      composerStillOpen: Boolean(t),
      titleValue: t?.value,
      noteHasTask: (note?.innerText?.match(/پیگیری پیشنهاد همکاری/g) || []).length,
      noteSnippet: note?.innerText?.slice(0, 400),
    };
  })()`);
  console.log(label, 'note after submit:', JSON.stringify(noteAfter, null, 2));

  const pressEscape = async () => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
  };

  await pressEscape();
  const afterEscape = await evaluate(cdp, `(() => ({
    composerOpen: Boolean(document.querySelector('textarea[placeholder^="چی کاره"]')),
    noteStillOpen: Boolean(document.querySelector('[contenteditable="true"]')),
    overlayRoot: Boolean(document.querySelector('[data-overlay-root]')),
  }))()`);
  console.log(label, 'after Escape:', JSON.stringify(afterEscape));
  await shot(cdp, `${label}-note-after-escape`);
  await pressEscape();
  const afterSecondEscape = await evaluate(cdp, `(() => ({
    noteStillOpen: Boolean(document.querySelector('[contenteditable="true"]')),
    overlayRoot: Boolean(document.querySelector('[data-overlay-root]')),
  }))()`);
  console.log(label, 'after second Escape:', JSON.stringify(afterSecondEscape));

  await closePage(cdp, ws, target);
}

async function runDayMobile() {
  const { cdp, ws, target } = await newPage(390, 844, true);
  const label = 'mobile';

  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button, [role="button"]')]
      .find(x => (x.textContent || '').trim() === 'تقویم' && x.getBoundingClientRect().width > 0);
    b?.click();
  })()`);
  await sleep(1600);

  await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('header button, header [role="button"]')]
      .find(x => (x.textContent || '').trim() === 'روز' && x.getBoundingClientRect().width > 0);
    b?.click();
  })()`);
  await sleep(1000);
  await shot(cdp, `${label}-day`);

  const dayAddClick = await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('button[title^="افزودن کار به"]')]
      .find((x) => x.getBoundingClientRect().width > 0);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'day add click:', dayAddClick);
  await sleep(900);
  await shot(cdp, `${label}-day-inline`);
  const dayInline = await evaluate(cdp, `(() => {
    const textarea = [...document.querySelectorAll('textarea[placeholder^="چی کاره"]')]
      .find((t) => t.getBoundingClientRect().width > 0);
    const composer = textarea?.closest('div.rounded-2xl');
    const rect = composer?.getBoundingClientRect();
    return {
      open: Boolean(textarea),
      rect: rect ? { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) } : null,
      closeVisible: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('بستن') && b.getBoundingClientRect().width > 0),
      focusOnComposer: document.activeElement === textarea,
    };
  })()`);
  console.log(label, 'day inline:', JSON.stringify(dayInline));

  await evaluate(cdp, `document.querySelector('textarea[placeholder^="چی کاره"]')?.focus()`);
  await cdp.send('Input.insertText', { text: 'بررسی گزارش هفتگی' });
  await sleep(400);
  const daySubmit = await evaluate(cdp, `(() => {
    const t = document.querySelector('textarea[placeholder^="چی کاره"]');
    const composer = t?.closest('div.rounded-2xl');
    const b = composer?.querySelector('button[type="submit"]');
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
  console.log(label, 'day submit:', daySubmit);
  await sleep(1600);
  await shot(cdp, `${label}-day-after-submit`);
  const dayAfter = await evaluate(cdp, `(() => ({
    composerStillOpen: Boolean(document.querySelector('textarea[placeholder^="چی کاره"]')),
    titleValue: document.querySelector('textarea[placeholder^="چی کاره"]')?.value,
    bodyHasTask: document.body.innerText.includes('بررسی گزارش هفتگی'),
  }))()`);
  console.log(label, 'day after submit:', JSON.stringify(dayAfter));

  await closePage(cdp, ws, target);
}

try {
  await waitDevtools();
  await runNotesDesktop();
  await runDayMobile();
} catch (err) {
  console.error(err);
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
