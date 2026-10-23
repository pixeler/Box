import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'; const PORT=9242; const profile='C:/Users/Pixel/AppData/Local/Temp/chrome-profile-1024nb'; mkdirSync('scratch/verify',{recursive:true});
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'--no-first-run','--disable-gpu','--hide-scrollbars','about:blank'],{stdio:'ignore'});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok)break;}catch{}await sleep(200);}
const target=await(await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r));
let id=0; const pending=new Map(); ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
const send=(method,params={})=>{const i=++id;ws.send(JSON.stringify({id:i,method,params}));return new Promise((resolve,reject)=>pending.set(i,{resolve,reject}));};
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const shot=async(name)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`scratch/verify/${name}.png`,Buffer.from(r.data,'base64'));};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false,screenWidth:1024,screenHeight:768});
 await send('Page.navigate',{url:'http://127.0.0.1:5180/'});await sleep(3000);
 await evaluate(`localStorage.setItem('second_brain_theme','default-dark');localStorage.setItem('second_brain_glass_background','true');true`);await send('Page.reload');await sleep(4200);
 await evaluate(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>(x.textContent||'').trim()==='یادداشت');b?.click();})()`);await sleep(1200);
 const before=await evaluate(`(()=>{const c=document.querySelector('#app-main').getBoundingClientRect();return{left:Math.round(c.left),right:Math.round(c.right),w:Math.round(c.width),canvas:Math.round(document.querySelector('.desktop-canvas').getBoundingClientRect().width)};})()`);
 await evaluate(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>(x.textContent||'').trim()==='تنظیمات');b?.click();})()`);await sleep(700);
 const after=await evaluate(`(()=>{const c=document.querySelector('#app-main').getBoundingClientRect();const canvas=document.querySelector('.desktop-canvas').getBoundingClientRect();return{card:{left:Math.round(c.left),right:Math.round(c.right),w:Math.round(c.width)},canvas:{left:Math.round(canvas.left),right:Math.round(canvas.right),w:Math.round(canvas.width)},panel:Boolean(document.querySelector('#desktop-settings-panel'))};})()`);
 console.log(JSON.stringify({before,after})); await shot('latest-1024-notebook-settings');
}catch(e){console.error(e);}finally{chrome.kill();}
