import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9251;
const profile = 'C:/Users/Pixel/AppData/Local/Temp/chrome-profile-hl3';
mkdirSync('scratch/verify', { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
});
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((resolve, reject) => pending.set(i, { resolve, reject })); };
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(`scratch/verify/${name}.png`, Buffer.from(r.data, 'base64')); };
const rectOf = (sel) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
async function clickSel(sel) {
  const r = await rectOf(sel);
  if (!r) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  return true;
}
const overlays = () => evaluate(`document.querySelectorAll('.fixed.inset-0.z-\\\\[90\\\\].pointer-events-none [data-drag-handle]').length`);
const menuBtns = () => evaluate(`document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"],.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"]').length`);
const headings = () => evaluate(`document.querySelectorAll('.bn-block-content[data-content-type="heading"]').length`);
const paras = () => evaluate(`document.querySelectorAll('.bn-block-content[data-content-type="paragraph"]').length`);

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
  await send('Page.navigate', { url: 'http://127.0.0.1:5191/' });
  await sleep(3500);
  await evaluate(`localStorage.setItem('second_brain_theme','default-dark');localStorage.setItem('sb-settings-compact-nav','false');true`);
  await send('Page.reload'); await sleep(4000);

  // Open the first note from the notebook grid.
  const opened = await evaluate(`(()=>{const tiles=[...document.querySelectorAll('[role="button"][tabindex="0"]')];const t=tiles.find(x=>(x.textContent||'').includes('یادداشت'));if(!t)return false;t.click();return true;})()`);
  console.log('note tile clicked:', opened);
  await sleep(2500);
  const hasEditor = await evaluate(`!!document.querySelector('.bn-editor')`);
  console.log('editor visible:', hasEditor);
  if (!hasEditor) throw new Error('editor not found');

  // Hover the first paragraph block, then click its drag handle.
  const blockSel = '.bn-block-content[data-content-type="paragraph"]';
  const b = await rectOf(blockSel);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await sleep(350);
  await clickSel('[data-drag-handle]');
  await sleep(450);
  const before = { menu: await menuBtns(), overlay: await overlays(), headings: await headings(), paras: await paras() };
  console.log('after opening drag menu:', JSON.stringify(before));
  await shot('hl3-menu-open');

  // "تبدیل به" -> "عنوان ۱"
  await clickSel('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"]');
  await sleep(450);
  const submenuOpen = await evaluate(`document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]').length`);
  console.log('after clicking تبدیل به, menu items:', submenuOpen);
  await clickSel('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]');
  await sleep(700);
  const afterTurn = { menu: await menuBtns(), overlay: await overlays(), headings: await headings() };
  console.log('after تبدیل به -> عنوان ۱:', JSON.stringify(afterTurn));

  // "تکثیر"
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await sleep(300);
  await clickSel('[data-drag-handle]');
  await sleep(400);
  const items = await evaluate(`[...document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"],.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]')].map(e=>(e.textContent||'').trim())`);
  console.log('menu items:', JSON.stringify(items));
  const dupIdx = await evaluate(`(()=>{const l=[...document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"],.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]')];const i=l.findIndex(e=>(e.textContent||'').trim()==='تکثیر');if(i<0)return -1;const r=l[i].getBoundingClientRect();l[i].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return i;})()`);
  await sleep(700);
  console.log('duplicate item idx:', dupIdx, 'after:', JSON.stringify({ menu: await menuBtns(), overlay: await overlays(), headings: await headings() }));

  // "بیشتر" -> "حذف بلوک"
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await sleep(300);
  await clickSel('[data-drag-handle]');
  await sleep(400);
  const beforeDel = { headings: await headings(), paras: await paras() };
  const delResult = await evaluate(`(()=>{const l=[...document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"],.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]')];const more=l.find(e=>(e.textContent||'').trim()==='بیشتر');if(!more)return 'no-more';more.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return 'ok';})()`);
  await sleep(500);
  const delResult2 = await evaluate(`(()=>{const l=[...document.querySelectorAll('.fixed.inset-0.z-\\\\[100\\\\] [role="menuitemcheckbox"],.fixed.inset-0.z-\\\\[100\\\\] [role="menuitem"]')];const d=l.find(e=>(e.textContent||'').trim()==='حذف بلوک');if(!d)return 'no-delete';d.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return 'ok';})()`);
  await sleep(900);
  const afterDel = { headings: await headings(), paras: await paras(), menu: await menuBtns(), overlay: await overlays() };
  console.log('حذف بلوک:', delResult, delResult2, 'before:', JSON.stringify(beforeDel), 'after:', JSON.stringify(afterDel));

  const pass = afterTurn.overlay === 0 && afterTurn.menu === 0 && afterTurn.headings === before.headings + 1 && afterDel.overlay === 0 && afterDel.menu === 0;
  console.log('RESULT3', pass ? 'PASS' : 'FAIL');
  await shot('hl3-final');
} catch (e) {
  console.error('ERROR', e.message);
  await shot('hl3-error');
} finally {
  chrome.kill();
}
