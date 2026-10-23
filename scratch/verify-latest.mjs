import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9240;
const URL = 'http://127.0.0.1:5180/';
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-latest';

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
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('DevTools not ready');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}
async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function shot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`scratch/verify/${name}.png`, Buffer.from(r.data, 'base64'));
}
async function clickText(cdp, text, scope = 'document') {
  return evaluate(cdp, `(() => {
    const b = [...(${scope}).querySelectorAll('button, [role="button"]')]
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
    const add = async (data) => {
      if (existing.some((t) => t.title === data.title)) return;
      await taskRepo.create({
        entry_id: null, box_id: null, title: data.title, description: data.description || '',
        status: 'open', due_date: data.due_date || today, due_time: data.due_time,
        duration_minutes: data.duration_minutes, time_of_day: data.time_of_day,
        priority: data.priority, tag_ids: [], pinned: false,
      });
    };
    const morning = ['جلسه روزانه تیم', 'بازبینی طرح هفته', 'نوشتن مستندات API', 'پیگیری ایمیل‌های مشتری', 'بررسی بک‌لاگ اسپرینت', 'تماس با تیم طراحی'];
    for (const [i, title] of morning.entries()) {
      await add({ title, time_of_day: 'morning', priority: i === 0 ? 3 : i === 1 ? 2 : 0 });
    }
    await add({ title: 'خرید هفتگی', time_of_day: 'day', priority: 2 });
    await add({ title: 'مطالعه کتاب', time_of_day: 'evening' });
    await add({ title: 'پیگیری آزمایش', due_date: addJalaliDays(today, -1), time_of_day: 'morning', priority: 1 });
    await add({ title: 'ارسال گزارش مالی', due_date: addJalaliDays(today, -4), due_time: '11:00', duration_minutes: 30, time_of_day: 'morning', priority: 3 });
    return true;
  })()`);
  await sleep(400);
  await cdp.send('Page.reload');
  await sleep(4200);
}
async function openPage(width, height, mobile, label) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await cdp.send('Page.navigate', { url: URL });
  await sleep(3800);
  if (label === 'desktop') await seed(cdp);
  else await sleep(1200);
  return { cdp, target };
}

try {
  await waitDevtools();

  // ================= DESKTOP =================
  const { cdp, target } = await openPage(1494, 1026, false, 'desktop');
  await shot(cdp, 'latest-desktop-day-glass');

  const glass = await evaluate(cdp, `(() => {
    const card = document.querySelector('#app-main');
    const feImage = document.querySelector('#figma-glass-card-filter feImage');
    return {
      class: card.className.includes('figma-glass-card'),
      backdrop: getComputedStyle(card).backdropFilter || getComputedStyle(card).webkitBackdropFilter,
      mapLen: feImage?.getAttribute('href')?.length || 0,
      scales: [...document.querySelectorAll('#figma-glass-card-filter feDisplacementMap')].map((el) => el.getAttribute('scale')),
    };
  })()`);
  console.log('glass:', JSON.stringify(glass));

  await clickText(cdp, 'تقویم');
  await sleep(1400);
  await shot(cdp, 'latest-desktop-week-alltasks');

  const week = await evaluate(cdp, `(() => {
    const cells = [...document.querySelectorAll('div.group\\\\/cell')];
    const counts = cells.map((c) => c.querySelectorAll('.stream-row-hover').length);
    const targetCell = cells.find((c) => [...c.querySelectorAll('h3')].some((h) => (h.textContent || '').includes('جلسه روزانه تیم')));
    const titles = targetCell ? [...targetCell.querySelectorAll('h3')].map((h) => (h.textContent || '').trim()) : [];
    const title = targetCell?.querySelector('h3');
    const rect = targetCell?.getBoundingClientRect();
    return {
      cells: cells.length,
      maxTasksInCell: Math.max(...counts),
      taskCounts: counts.filter((n) => n > 0),
      todayMorningTitles: titles,
      todayCellHeight: rect ? Math.round(rect.height) : null,
      titleFontSize: title ? getComputedStyle(title).fontSize : null,
      clipped: targetCell ? targetCell.scrollHeight > targetCell.clientHeight + 1 : null,
    };
  })()`);
  console.log('week:', JSON.stringify(week));

  // Settings side panel
  const openSettings = await evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('aside button')].find((x) => (x.textContent || '').trim() === 'تنظیمات');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(700);
  const panel = await evaluate(cdp, `(() => {
    const p = document.querySelector('#desktop-settings-panel');
    const r = p?.getBoundingClientRect();
    const active = document.querySelector('aside [aria-current="page"]');
    const settingsBtn = [...document.querySelectorAll('aside button')].find((x) => (x.textContent || '').trim() === 'تنظیمات');
    return {
      open: Boolean(p),
      width: r ? Math.round(r.width) : null,
      left: r ? Math.round(r.left) : null,
      appStillVisible: Boolean(document.querySelector('#app-main')),
      activeTab: active?.textContent?.trim(),
      settingsExpanded: settingsBtn?.getAttribute('aria-expanded'),
      modalDialogs: document.querySelectorAll('[role="dialog"]').length,
      groups: [...p.querySelectorAll('h3')].map((h) => (h.textContent || '').trim()),
    };
  })()`);
  console.log('settings:', openSettings, JSON.stringify(panel));
  await shot(cdp, 'latest-desktop-settings-panel');

  console.log('theme subpage:', await clickText(cdp, 'تم و رنگ', 'document.querySelector("#desktop-settings-panel")'));
  await sleep(450);
  await shot(cdp, 'latest-desktop-settings-theme');

  await evaluate(cdp, `document.querySelector('#desktop-settings-panel button[aria-label="بازگشت به تنظیمات"]')?.click()`);
  await sleep(350);
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(400);
  console.log('panel after Escape:', await evaluate(cdp, `Boolean(document.querySelector('#desktop-settings-panel'))`));

  // Week with overdue panel + glass, after settings close
  await evaluate(cdp, `document.querySelector('button[aria-controls="week-overdue-panel"]')?.click()`);
  await sleep(450);
  await shot(cdp, 'latest-desktop-week-overdue-glass');

  await clickText(cdp, 'ماه');
  await sleep(800);
  await shot(cdp, 'latest-desktop-month-glass');

  cdp.ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);

  // ================= MOBILE =================
  const { cdp: m, target: mt } = await openPage(390, 844, true, 'mobile');
  await shot(m, 'latest-mobile-day-glass');

  await clickText(m, 'تقویم');
  await sleep(1200);
  await shot(m, 'latest-mobile-week-alltasks');
  const mweek = await evaluate(m, `(() => {
    const cards = [...document.querySelectorAll('div.rounded-2xl')].filter((el) => el.querySelector('.stream-row-hover'));
    const todayCard = cards.find((c) => (c.textContent || '').includes('جلسه روزانه تیم'));
    return {
      cards: cards.length,
      todayTaskCount: todayCard ? todayCard.querySelectorAll('.stream-row-hover').length : null,
      morningTitles: todayCard ? [...todayCard.querySelectorAll('h3')].map((h) => (h.textContent || '').trim()) : [],
      cardHeight: todayCard ? Math.round(todayCard.getBoundingClientRect().height) : null,
      clipped: todayCard ? todayCard.scrollHeight > todayCard.clientHeight + 1 : null,
      titleFontSize: todayCard ? getComputedStyle(todayCard.querySelector('h3')).fontSize : null,
    };
  })()`);
  console.log('mobile week:', JSON.stringify(mweek));

  await evaluate(m, `document.querySelector('button[aria-controls="week-overdue-panel"]')?.click()`);
  await sleep(500);
  await shot(m, 'latest-mobile-overdue');

  await evaluate(m, `(() => {
    const dlg = document.querySelector('[role="dialog"][aria-label="کارهای عقب‌افتاده"]');
    dlg?.querySelector('button[aria-label="بستن کارهای عقب‌افتاده"]')?.click();
  })()`);
  await sleep(350);
  await evaluate(m, `document.querySelector('button.group\\\\/profile')?.click()`);
  await sleep(600);
  await shot(m, 'latest-mobile-settings-page');

  m.ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${mt.id}`);
} catch (e) {
  console.error(e);
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
