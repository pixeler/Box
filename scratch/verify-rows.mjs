import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9243;
const URL = 'http://127.0.0.1:5180/';
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-rows';
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(`scratch/verify/${name}.png`, Buffer.from(r.data, 'base64')); };
const clickText = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim().includes(${JSON.stringify(text)}) && x.getBoundingClientRect().width > 0); if (!b) return 'missing'; b.click(); return 'clicked'; })()`);

async function measure() {
  return evaluate(`(() => {
    const grid = [...document.querySelectorAll('div.min-h-full')].sort((a, b) => b.children.length - a.children.length)[0];
    const scroller = grid?.parentElement;
    const rows = grid ? grid.children.length / 8 : 0;
    const g = grid?.getBoundingClientRect();
    const s = scroller?.getBoundingClientRect();
    return {
      rowCount: rows,
      gridHeight: g ? Math.round(g.height) : null,
      viewportHeight: s ? Math.round(s.height) : null,
      fillsViewport: g && s ? Math.abs(g.height - Math.max(s.height, g.height)) < 2 : null,
      scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : null,
      overflowStyle: scroller ? getComputedStyle(scroller).overflowY : null,
      rowHeights: grid ? Array.from({ length: rows }, (_, i) => Math.round(grid.children[i * 8].getBoundingClientRect().height)) : [],
    };
  })()`);
}

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1494, height: 1026, deviceScaleFactor: 1, mobile: false, screenWidth: 1494, screenHeight: 1026 });
  await send('Page.navigate', { url: URL });
  await sleep(3200);
  await evaluate(`localStorage.setItem('second_brain_theme','default-dark');localStorage.setItem('second_brain_glass_background','true');localStorage.setItem('second_brain_enable_day_sections','true');true`);
  await send('Page.reload');
  await sleep(4200);
  await clickText('تقویم');
  await sleep(1200);
  console.log('sparse:', JSON.stringify(await measure()));
  await shot('rows-sparse-dark');

  const marker = await evaluate(`(() => {
    const friday = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '').includes('جمعه'));
    const circle = friday ? [...friday.querySelectorAll('span')].find((s) => (s.textContent || '').trim() === '۱') : null;
    if (!circle) return null;
    const cs = getComputedStyle(circle);
    return { bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius };
  })()`);
  console.log('today marker:', JSON.stringify(marker));

  // Seed six tasks in one morning cell to force scrolling.
  await evaluate(`(async () => {
    const { taskRepo } = await import('/src/repositories/index.ts');
    const { getTodayJalaliKey } = await import('/src/lib/jalali.ts');
    const today = getTodayJalaliKey();
    const existing = await taskRepo.list();
    const titles = ['جلسه روزانه تیم', 'بازبینی طرح هفته', 'نوشتن مستندات API', 'پیگیری ایمیل‌های مشتری', 'بررسی بک‌لاگ اسپرینت', 'تماس با تیم طراحی', 'هماهنگی انتشار نسخه', 'مرور بودجه ماهانه', 'پاسخ به بازخورد کاربران', 'برنامه‌ریزی هفته آینده'];
    for (const title of titles) {
      if (existing.some((t) => t.title === title)) continue;
      await taskRepo.create({ entry_id: null, box_id: null, title, description: 'توضیح کوتاه برای آزمون ارتفاع', status: 'open', due_date: today, time_of_day: 'morning', priority: 0, tag_ids: [], pinned: false });
    }
    return true;
  })()`);
  await send('Page.reload');
  await sleep(4200);
  await clickText('تقویم');
  await sleep(1200);
  console.log('dense:', JSON.stringify(await measure()));
  await shot('rows-dense-dark');

  const content = await evaluate(`(() => {
    const grid = [...document.querySelectorAll('div.min-h-full')].sort((a, b) => b.children.length - a.children.length)[0];
    const cells = [...grid.querySelectorAll('div.group\\\\/cell')];
    const max = Math.max(...cells.map((c) => c.querySelectorAll('.stream-row-hover').length));
    const dense = cells.find((c) => c.querySelectorAll('.stream-row-hover').length === max);
    return { maxTasks: max, denseHeight: dense ? Math.round(dense.getBoundingClientRect().height) : null, clipped: dense ? dense.scrollHeight > dense.clientHeight + 1 : null };
  })()`);
  console.log('dense content:', JSON.stringify(content));

  await clickText('ماه');
  await sleep(1000);
  const monthMarker = await evaluate(`(() => {
    const cells = [...document.querySelectorAll('[role="button"]')].filter((b) => (b.getAttribute('aria-label') || '').startsWith('نمایش روز ۱ '));
    const found = cells.map((cell) => {
      const span = [...cell.querySelectorAll('span')].find((s) => (s.textContent || '').trim() === '۱');
      return span ? { label: cell.getAttribute('aria-label'), bg: getComputedStyle(span).backgroundColor, color: getComputedStyle(span).color } : null;
    }).filter(Boolean);
    return found;
  })()`);
  console.log('month marker:', JSON.stringify(monthMarker));
  await shot('rows-month-holiday');
} catch (e) {
  console.error(e);
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
