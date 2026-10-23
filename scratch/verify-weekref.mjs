import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9226;
const URL = 'http://localhost:5179/';
const profile = 'C:/Users/Pixel/Documents/antigravity/friendly-curie/scratch/chrome-profile-weekref';

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

async function clickHeaderTab(cdp, text) {
  return evaluate(cdp, `(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => (x.textContent || '').trim() === ${JSON.stringify(text)});
    if (!b) return 'missing';
    b.click();
    return 'clicked';
  })()`);
}

async function closeComposers(cdp) {
  await evaluate(cdp, `(() => {
    [...document.querySelectorAll('button')]
      .filter((b) => (b.textContent || '').trim() === 'بستن' && b.getBoundingClientRect().width > 0)
      .forEach((b) => b.click());
  })()`);
  await sleep(350);
}

async function openCalendar(cdp) {
  return evaluate(cdp, `(() => {
    const buttons = [...document.querySelectorAll('button, [role="button"]')];
    const b = buttons.find(x => (x.textContent || '').trim().includes('تقویم') && x.getBoundingClientRect().width > 0);
    if (b) { b.click(); return 'clicked'; }
    return 'not found';
  })()`);
}

async function seedAndReload(cdp) {
  await evaluate(cdp, `(async () => {
    localStorage.setItem('second_brain_enable_day_sections', 'true');
    const { taskRepo } = await import('/src/repositories/index.ts');
    const { getTodayJalaliKey, addJalaliDays } = await import('/src/lib/jalali.ts');
    const today = getTodayJalaliKey();
    const tomorrow = addJalaliDays(today, 1);
    const existing = await taskRepo.list();
    const add = async (data) => {
      if (existing.some((t) => t.title === data.title)) return;
      await taskRepo.create({
        entry_id: null,
        box_id: null,
        title: data.title,
        description: data.description || '',
        status: 'open',
        due_date: data.due_date || today,
        due_time: data.due_time,
        duration_minutes: data.duration_minutes,
        time_of_day: data.time_of_day,
        priority: data.priority,
        tag_ids: [],
        pinned: false,
      });
    };
    await add({ title: 'جلسه طراحی تقویم', description: 'مرور چیدمان کارت‌ها', due_time: '09:30', duration_minutes: 45, time_of_day: 'morning', priority: 3 });
    await add({ title: 'خرید هفتگی', time_of_day: 'day', priority: 2 });
    await add({ title: 'مطالعه کتاب', time_of_day: 'evening' });
    await add({ title: 'تماس با مادر', time_of_day: 'anytime' });
    await add({ title: 'پیگیری آزمایش', time_of_day: 'morning', priority: 1, due_date: tomorrow });
    return true;
  })()`);
  await sleep(600);
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
    await seedAndReload(cdp);
  } else {
    await sleep(2200);
  }

  console.log(label, 'calendar:', await openCalendar(cdp));
  await sleep(1600);
  await shot(cdp, `weekref-${label}-week`);

  if (!mobile) {
    const weekInfo = await evaluate(cdp, `(() => {
      const cells = [...document.querySelectorAll('div')].filter((el) => el.classList.contains('group/cell'));
      const addRows = cells
        .map((cell) => cell.querySelector('button[aria-label^="افزودن کار"]'))
        .filter(Boolean);
      const rows = [...document.querySelectorAll('.stream-row-hover')]
        .filter((el) => el.getBoundingClientRect().width > 0);
      const firstWithTask = cells.find((cell) => cell.querySelector('.stream-row-hover'));
      const addWrap = addRows[0]?.parentElement;
      const addRect = addRows[0]?.getBoundingClientRect();
      const taskRect = firstWithTask?.querySelector('.stream-row-hover')?.getBoundingClientRect();
      return {
        sectionCells: cells.length,
        addRows: addRows.length,
        addOpacities: addRows.slice(0, 6).map((b) => getComputedStyle(b.parentElement).opacity),
        visibleWeekCards: rows.length,
        hasChipLikeCards: [...document.querySelectorAll('.stream-row-hover')].length,
        addBelowTask: firstWithTask
          ? Math.round(firstWithTask.querySelector('button[aria-label^="افزودن کار"]').getBoundingClientRect().top) >=
            Math.round(firstWithTask.querySelector('.stream-row-hover').getBoundingClientRect().bottom)
          : null,
        firstAdd: addRect ? { top: Math.round(addRect.top), height: Math.round(addRect.height) } : null,
        firstTask: taskRect ? { top: Math.round(taskRect.top), bottom: Math.round(taskRect.bottom) } : null,
        timelineHoursRendered: [...document.querySelectorAll('div')].filter((el) => el.textContent?.trim() === '۰۱:۰۰').length,
      };
    })()`);
    console.log(label, 'week:', JSON.stringify(weekInfo));

    const hoverTarget = await evaluate(cdp, `(() => {
      const cells = [...document.querySelectorAll('div')].filter((el) => el.classList.contains('group/cell'));
      const cell = cells.find((c) => c.querySelector('.stream-row-hover')) || cells[0];
      if (!cell) return null;
      const r = cell.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(40, r.height / 2)) };
    })()`);
    if (hoverTarget) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverTarget.x, y: hoverTarget.y, button: 'none' });
      await sleep(450);
      const hoverInfo = await evaluate(cdp, `(() => {
        const cells = [...document.querySelectorAll('div')].filter((el) => el.classList.contains('group/cell'));
        const target = cells.find((c) => c.querySelector('.stream-row-hover')) || cells[0];
        const btn = target?.querySelector('button[aria-label^="افزودن کار"]');
        return {
          hoveredCellAddOpacity: btn ? getComputedStyle(btn.parentElement).opacity : null,
          otherAddOpacities: cells
            .filter((c) => c !== target)
            .slice(0, 5)
            .map((c) => {
              const b = c.querySelector('button[aria-label^="افزودن کار"]');
              return b ? getComputedStyle(b.parentElement).opacity : null;
            }),
        };
      })()`);
      console.log(label, 'hover:', JSON.stringify(hoverInfo));
      await shot(cdp, `weekref-${label}-week-hover`);

      await evaluate(cdp, `(() => {
        const cells = [...document.querySelectorAll('div')].filter((el) => el.classList.contains('group/cell'));
        const target = cells.find((c) => c.querySelector('.stream-row-hover')) || cells[0];
        target?.querySelector('button[aria-label^="افزودن کار"]')?.click();
      })()`);
      await sleep(900);
      await shot(cdp, `weekref-${label}-week-composer`);
      console.log(label, 'week composer:', JSON.stringify(await evaluate(cdp, `(() => {
        const ta = document.querySelector('textarea[placeholder^="چی کاره"]');
        const panel = ta?.closest('div.rounded-2xl');
        return { open: Boolean(ta), panelTop: panel ? Math.round(panel.getBoundingClientRect().top) : null };
      })()`)));
      await closeComposers(cdp);
    }

    await clickHeaderTab(cdp, 'روز');
    await sleep(900);
    await shot(cdp, `weekref-${label}-day`);
    const dayInfo = await evaluate(cdp, `(() => {
      const header = document.querySelector('header');
      const headerAdd = [...header.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('افزودن کار')).length;
      const sectionAdds = [...document.querySelectorAll('button[aria-label^="افزودن کار به"]')]
        .filter((b) => b.getBoundingClientRect().width > 0);
      const row = document.querySelector('.stream-row-hover');
      const firstSection = sectionAdds[0]?.closest('section');
      const lastTask = firstSection ? [...firstSection.querySelectorAll('.stream-row-hover')].pop() : null;
      return {
        headerAdd,
        sectionAdds: sectionAdds.length,
        firstAddLabel: sectionAdds[0]?.getAttribute('aria-label'),
        addBelowLastTask: lastTask && sectionAdds[0]
          ? Math.round(sectionAdds[0].getBoundingClientRect().top) >= Math.round(lastTask.getBoundingClientRect().bottom)
          : null,
        cardRows: document.querySelectorAll('.stream-row-hover').length,
        rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
      };
    })()`);
    console.log(label, 'day:', JSON.stringify(dayInfo));

    await evaluate(cdp, `(() => {
      const b = [...document.querySelectorAll('button[aria-label^="افزودن کار به"]')]
        .find((x) => x.getBoundingClientRect().width > 0);
      b?.click();
    })()`);
    await sleep(850);
    await shot(cdp, `weekref-${label}-day-composer`);
    console.log(label, 'day composer:', JSON.stringify(await evaluate(cdp, `(() => {
      const ta = document.querySelector('textarea[placeholder^="چی کاره"]');
      const panel = ta?.closest('div.rounded-2xl');
      const section = panel?.closest('section');
      const addStillVisible = section ? Boolean(section.querySelector('button[aria-label^="افزودن کار به"]')) : null;
      const rect = panel?.getBoundingClientRect();
      return { open: Boolean(ta), panelTop: rect ? Math.round(rect.top) : null, addStillVisible };
    })()`)));
    await closeComposers(cdp);
  } else {
    const mobileWeek = await evaluate(cdp, `(() => {
      const cells = [...document.querySelectorAll('div')].filter((el) => el.classList.contains('group/cell'));
      const cards = [...document.querySelectorAll('.stream-row-hover')].filter((el) => el.getBoundingClientRect().width > 0);
      const dayCards = [...document.querySelectorAll('div.rounded-2xl')]
        .filter((el) => el.querySelector('.stream-row-hover') && el.querySelector('button[aria-label^="افزودن کار برای"]'));
      const addRows = [...document.querySelectorAll('button[aria-label^="افزودن کار برای"]')]
        .filter((b) => b.getBoundingClientRect().width > 0);
      const placements = dayCards.map((card) => {
        const add = card.querySelector('button[aria-label^="افزودن کار برای"]');
        const lastTask = [...card.querySelectorAll('.stream-row-hover')].pop();
        return {
          addHeight: Math.round(add.getBoundingClientRect().height),
          addBelowLastTask:
            Math.round(add.getBoundingClientRect().top) >= Math.round(lastTask.getBoundingClientRect().bottom),
        };
      });
      return {
        sectionCellsMounted: cells.length,
        timelineHourLabels: [...document.querySelectorAll('div')].filter((el) => el.textContent?.trim() === '۰۱:۰۰').length,
        cards: cards.length,
        addRows: addRows.length,
        placements,
        viewport: { width: innerWidth, height: innerHeight },
        documentHeight: document.documentElement.scrollHeight,
        bodyNodes: document.querySelectorAll('*').length,
      };
    })()`);
    console.log(label, 'week:', JSON.stringify(mobileWeek));

    await evaluate(cdp, `(() => {
      const card = [...document.querySelectorAll('div.rounded-2xl')]
        .find((el) => el.querySelector('.stream-row-hover') && el.querySelector('button[aria-label^="افزودن کار برای"]'));
      card?.querySelector('button[aria-label^="افزودن کار برای"]')?.click();
    })()`);
    await sleep(850);
    await shot(cdp, `weekref-${label}-week-composer`);
    console.log(label, 'week composer:', JSON.stringify(await evaluate(cdp, `(() => {
      const ta = document.querySelector('textarea[placeholder^="چی کاره"]');
      const panel = ta?.closest('div.rounded-2xl');
      const rect = panel?.getBoundingClientRect();
      const dayCard = panel?.parentElement?.closest('div.rounded-2xl');
      return {
        open: Boolean(ta),
        panel: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) } : null,
        addReplacedInSameCard: dayCard
          ? !dayCard.querySelector('button[aria-label^="افزودن کار برای"]')
          : null,
      };
    })()`)));
    await closeComposers(cdp);

    console.log(label, 'month tab:', await clickHeaderTab(cdp, 'ماه'));
    await sleep(900);
    await shot(cdp, `weekref-${label}-month`);
    console.log(label, 'month:', JSON.stringify(await evaluate(cdp, `(() => ({
      desktopCells: [...document.querySelectorAll('div')].filter((el) => el.classList.contains('min-h-[104px]')).length,
      mobilePreview: Boolean([...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('باز کردن روز'))),
      previewCards: document.querySelectorAll('.stream-row-hover').length,
    }))()`)));

    await clickHeaderTab(cdp, 'روز');
    await sleep(900);
    await shot(cdp, `weekref-${label}-day`);
    console.log(label, 'day:', JSON.stringify(await evaluate(cdp, `(() => {
      const adds = [...document.querySelectorAll('button[aria-label^="افزودن کار به"]')].filter((b) => b.getBoundingClientRect().width > 0);
      return { sectionAdds: adds.length, cards: document.querySelectorAll('.stream-row-hover').length };
    })()`)));
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
