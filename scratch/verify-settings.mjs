import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9227;
const URL = 'http://127.0.0.1:5180/';
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-settings';

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
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(`scratch/verify/${name}.png`, Buffer.from(result.data, 'base64'));
}

async function clickText(cdp, text, scope = 'document') {
  return evaluate(cdp, `(() => {
    const root = ${scope};
    const b = [...root.querySelectorAll('button, [role="button"]')]
      .find((x) => (x.textContent || '').trim().includes(${JSON.stringify(text)}) && x.getBoundingClientRect().width > 0);
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
}

async function seed(cdp) {
  await evaluate(cdp, `(async () => {
    localStorage.setItem('second_brain_theme', 'default-dark');
    localStorage.setItem('second_brain_glass_background', 'true');
    localStorage.setItem('second_brain_enable_day_sections', 'true');
    const { taskRepo } = await import('/src/repositories/index.ts');
    const { getTodayJalaliKey, addJalaliDays } = await import('/src/lib/jalali.ts');
    const today = getTodayJalaliKey();
    const existing = await taskRepo.list();
    if (!existing.some((t) => t.title === 'تماس با مادر')) {
      const add = async (data) => taskRepo.create({
        entry_id: null,
        box_id: null,
        title: data.title,
        description: '',
        status: 'open',
        due_date: data.due_date,
        due_time: data.due_time,
        duration_minutes: data.duration_minutes,
        time_of_day: data.time_of_day,
        priority: data.priority,
        tag_ids: [],
        pinned: false,
      });
      await add({ title: 'تماس با مادر', due_date: addJalaliDays(today, -1), time_of_day: 'anytime' });
      await add({ title: 'ارسال گزارش مالی', due_date: addJalaliDays(today, -4), due_time: '11:00', duration_minutes: 30, time_of_day: 'morning', priority: 3 });
      await add({ title: 'بازبینی قرارداد پروژه', due_date: addJalaliDays(today, -9), time_of_day: 'day', priority: 2 });
      await add({ title: 'جلسه طراحی تقویم', due_date: today, due_time: '09:30', duration_minutes: 45, time_of_day: 'morning', priority: 3 });
      await add({ title: 'خرید هفتگی', due_date: today, time_of_day: 'day', priority: 2 });
      await add({ title: 'مطالعه کتاب', due_date: today, time_of_day: 'evening' });
    }
    return true;
  })()`);
  await sleep(500);
  await evaluate(cdp, 'location.reload()');
  await sleep(4200);
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
  await sleep(3800);

  if (label === 'desktop') {
    await seed(cdp);
  } else {
    await sleep(2200);
  }

  return { cdp, target };
}

try {
  await waitDevtools();

  // ---------------- Desktop ----------------
  const { cdp, target } = await openPage(1494, 1026, false, 'desktop');

  const glassInfo = await evaluate(cdp, `(() => ({
    card: document.querySelector('#app-main')?.className.includes('figma-glass-card') ?? false,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }))()`);
  console.log('desktop glass:', JSON.stringify(glassInfo));
  await shot(cdp, 'settings-desktop-day-dark');

  console.log('notebook:', await clickText(cdp, 'یادداشت'));
  await sleep(900);
  await shot(cdp, 'settings-desktop-notebook-dark');

  console.log('calendar:', await clickText(cdp, 'تقویم'));
  await sleep(1400);
  await shot(cdp, 'settings-desktop-week-dark');

  await evaluate(cdp, `(() => {
    const b = document.querySelector('button[aria-controls="week-overdue-panel"]');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(500);
  const overdueInfo = await evaluate(cdp, `(() => {
    const panel = document.querySelector('#week-overdue-panel');
    const rows = [...(panel?.querySelectorAll('[draggable="true"]') || [])];
    return {
      open: Boolean(panel),
      rows: rows.length,
      titles: rows.map((r) => (r.textContent || '').trim().slice(0, 40)),
      panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : null,
    };
  })()`);
  console.log('overdue panel:', JSON.stringify(overdueInfo));
  await shot(cdp, 'settings-desktop-week-overdue');

  const dragResult = await evaluate(cdp, `(async () => {
    const panel = document.querySelector('#week-overdue-panel');
    const row = panel?.querySelector('[draggable="true"]');
    const cells = [...document.querySelectorAll('div.group\\\\/cell')];
    const target = cells[cells.length - 1];
    if (!row || !target) return { ok: false, reason: 'missing row or target' };
    const dt = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 120));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 120));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 1400));
    const after = [...(panel?.querySelectorAll('[draggable="true"]') || [])].length;
    return { ok: true, after };
  })()`);
  console.log('drag result:', JSON.stringify(dragResult));
  await shot(cdp, 'settings-desktop-week-overdue-after-drag');

  console.log('open settings:', await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('aside button')].find((x) => (x.textContent || '').trim() === 'تنظیمات');
    b?.click();
    return Boolean(b);
  })()`));
  await sleep(800);
  const settingsInfo = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const active = document.querySelector('aside [aria-current="page"]');
    const settingsBtn = [...document.querySelectorAll('aside button')].find((x) => (x.textContent || '').trim() === 'تنظیمات');
    return {
      dialog: Boolean(dialog),
      title: dialog?.querySelector('[class*="font-darvish"]')?.textContent?.trim(),
      width: dialog ? Math.round(dialog.getBoundingClientRect().width) : null,
      activeTabBehind: active?.textContent?.trim(),
      settingsButtonActive: settingsBtn ? settingsBtn.className.includes('bg-foreground') : null,
      scrollBody: dialog ? Math.round(dialog.querySelector('.overflow-y-auto')?.scrollHeight || 0) : null,
    };
  })()`);
  console.log('settings dialog:', JSON.stringify(settingsInfo));
  await shot(cdp, 'settings-desktop-dialog-dark');

  console.log('theme subpage:', await clickText(cdp, 'تم و رنگ', 'document.querySelector(\'[role="dialog"]\')'));
  await sleep(550);
  await shot(cdp, 'settings-desktop-dialog-theme');
  console.log('back to main:', await evaluate(cdp, `(() => {
    const b = document.querySelector('[role="dialog"] button[aria-label="بازگشت به تنظیمات"]');
    b?.click();
    return Boolean(b);
  })()`));
  await sleep(450);

  const darkToggle = await evaluate(cdp, `(() => {
    const sw = document.querySelector('[role="dialog"] button[role="switch"][aria-label="حالت تیره"]');
    if (!sw) return null;
    sw.click();
    return sw.getAttribute('aria-checked');
  })()`);
  await sleep(700);
  await shot(cdp, 'settings-desktop-dialog-light');
  const isLight = await evaluate(cdp, `document.documentElement.classList.contains('light') || !document.documentElement.classList.contains('dark')`);
  console.log('dark toggle before:', darkToggle, 'light mode now:', isLight);
  await evaluate(cdp, `document.querySelector('[role="dialog"] button[role="switch"][aria-label="حالت تیره"]')?.click()`);
  await sleep(650);

  console.log('close settings:', await evaluate(cdp, `(() => {
    const b = document.querySelector('[role="dialog"] button[aria-label="بستن تنظیمات"]');
    b?.click();
    return Boolean(b);
  })()`));
  await sleep(500);
  console.log('dialog after close:', await evaluate(cdp, `Boolean(document.querySelector('[role="dialog"]'))`));

  // month + year dark surfaces
  await clickText(cdp, 'ماه');
  await sleep(900);
  await shot(cdp, 'settings-desktop-month-dark');
  const monthSurfaces = await evaluate(cdp, `(() => {
    const selected = [...document.querySelectorAll('div')].filter((el) => el.className.includes && String(el.className).includes('dark:bg-black/25'));
    return { darkSelectedCells: selected.length };
  })()`);
  console.log('month surfaces:', JSON.stringify(monthSurfaces));

  await clickText(cdp, 'سال');
  await sleep(1000);
  await shot(cdp, 'settings-desktop-year-dark');
  const yearInfo = await evaluate(cdp, `(() => {
    const grid = [...document.querySelectorAll('div')].find((el) => el.className.includes && String(el.className).includes('lg:grid-rows-3'));
    const cards = [...document.querySelectorAll('button')].filter((b) => b.className.includes('bg-card/40'));
    const scroll = grid?.parentElement;
    return {
      grid: grid ? { h: Math.round(grid.getBoundingClientRect().height), w: Math.round(grid.getBoundingClientRect().width) } : null,
      container: scroll ? { h: Math.round(scroll.getBoundingClientRect().height), w: Math.round(scroll.getBoundingClientRect().width) } : null,
      cards: cards.length,
      cardHeight: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : null,
    };
  })()`);
  console.log('year layout:', JSON.stringify(yearInfo));

  ws_close(cdp, target);
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);

  // ---------------- Mobile ----------------
  const { cdp: mcdp, target: mtarget } = await openPage(390, 844, true, 'mobile');
  await shot(mcdp, 'settings-mobile-day-dark');

  console.log('mobile calendar:', await clickText(mcdp, 'تقویم'));
  await sleep(1200);
  await shot(mcdp, 'settings-mobile-week-dark');

  const overdueTrigger = await evaluate(mcdp, `(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('کارهای عقب‌افتاده'));
    if (!b) return null;
    b.click();
    return true;
  })()`);
  await sleep(500);
  console.log('mobile overdue opened:', overdueTrigger);
  await shot(mcdp, 'settings-mobile-overdue-sheet');

  const sheetInfo = await evaluate(mcdp, `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="کارهای عقب‌افتاده"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      open: Boolean(dialog),
      rect: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width) } : null,
      rows: dialog ? dialog.querySelectorAll('[draggable]').length : null,
      hasMoveToToday: dialog ? [...dialog.querySelectorAll('button')].some((b) => (b.title || '').includes('انتقال به امروز') || (b.getAttribute('aria-label') || '').includes('امروز')) : null,
    };
  })()`);
  console.log('mobile sheet:', JSON.stringify(sheetInfo));
  await evaluate(mcdp, `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="کارهای عقب‌افتاده"]');
    const b = dialog?.querySelector('button[aria-label="بستن کارهای عقب‌افتاده"]') || [...(dialog?.querySelectorAll('button') || [])].find((x) => (x.textContent || '').trim() === 'بستن');
    b?.click();
  })()`);
  await sleep(400);

  // mobile profile page
  await evaluate(mcdp, `(() => {
    const b = document.querySelector('button.group\\\\/profile') || [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('پروفایل'));
    b?.click();
  })()`);
  await sleep(700);
  await shot(mcdp, 'settings-mobile-profile-dark');
  const mobileProfileInfo = await evaluate(mcdp, `(() => ({
    hasPageTitle: [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === 'تنظیمات'),
    groups: [...document.querySelectorAll('h3')].map((h) => (h.textContent || '').trim()),
    horizontalScrollRail: [...document.querySelectorAll('div')].filter((el) => String(el.className).includes('overflow-x-auto')).length,
    switches: document.querySelectorAll('button[role="switch"]').length,
  }))()`);
  console.log('mobile profile:', JSON.stringify(mobileProfileInfo));

  await clickText(mcdp, 'تم و رنگ');
  await sleep(500);
  await shot(mcdp, 'settings-mobile-profile-theme');

  ws_close(mcdp, mtarget);
  await fetch(`http://127.0.0.1:${PORT}/json/close/${mtarget.id}`);
} catch (err) {
  console.error(err);
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

function ws_close(cdp, target) {
  try { cdp.ws.close(); } catch {}
}
