import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

if(!process.env.BROWSER_ARTIFACT_DIR)throw Error('Set BROWSER_ARTIFACT_DIR to preserve sandbox and browser receipts.');
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/unknown-lab.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];
const outputDir=process.env.BROWSER_ARTIFACT_DIR;

const downloads=path.join(dir,'downloads');await mkdir(downloads);
if(outputDir)await mkdir(outputDir,{recursive:true});
try {
 let port=null;
 for(let i=0;i<120;i++){try{const lines=(await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).trim().split('\n');port=Number(lines[0]);break;}catch{await delay(100);}}
 assert.ok(port,'Chrome DevTools port unavailable');
 let target=null;
 for(let i=0;i<60;i++){const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(x=>x.type==='page'&&x.url==='about:blank');if(target)break;await delay(100);}
 assert.ok(target,'Missing actual UNKNOWN LAB tab');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{
   const v=JSON.parse(e.data);
   if(v.id){const p=pending.get(v.id);if(!p)return;pending.delete(v.id);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}
   if(v.method==='Runtime.exceptionThrown')events.exceptions.push(v.params.exceptionDetails.text);
   if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(new URL(origin).origin))events.outside.push(v.params.request.url);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async predicate=>{for(let i=0;i<70;i++){if(await evaljs(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate)};
 const check=async(name,fn)=>{await fn();out.push({name,passed:true})};
 await send('Page.enable');await send('Runtime.enable');
 let sandbox;try{sandbox=await requireChromiumSandbox({send});}catch(error){if(error.receipt)await writeFile(path.join(outputDir,'sandbox.json'),JSON.stringify(error.receipt,null,2));throw error;}
 await writeFile(path.join(outputDir,'sandbox.json'),JSON.stringify(sandbox,null,2));
 await send('Network.enable');await send('Page.navigate',{url:origin});
 await wait("document.readyState==='complete' && !!document.querySelector('#history-acquisition')");
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const q="document.querySelector('#history-acquisition')";
 const click=selector=>evaljs(`${q}.querySelector(${JSON.stringify(selector)}).click()`);
 const open=async(text,slow=false)=>evaljs(`(()=>{const f=new File([${JSON.stringify(text)}],'worksheet.json',{type:'application/json'});${slow?"f.text=()=>new Promise(resolve=>{window.releaseWorksheetRead=()=>resolve("+JSON.stringify(text)+")});":""}const d=new DataTransfer();d.items.add(f);const input=${q}.querySelector('[data-action=open]');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await check('freeze blank chronological worksheet through real form',async()=>{
  await evaljs(`(()=>{const f=${q}.querySelector('form');f.closest('details').open=true;for(const [key,value] of Object.entries({id:'receiver',count:8,seed:71,noiseSigma:.01,command:.2,position:.3,rate:-.1,preparation:'AB BA analytic receiver',sourceNote:'Authored control, not physical observations'}))f.elements[key].value=value;f.requestSubmit();})()`);
  await wait(`${q}.querySelectorAll('tbody tr').length===16`);
  assert.equal(await evaljs(`[...${q}.querySelectorAll('tbody input')].every(x=>x.value==='')`),true);
  await click('[data-action=apply]');assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  assert.equal(await evaljs(`document.activeElement===${q}.querySelector('[data-role=error]')`),true);
 });
 let partial;
 await check('actual downloaded partial worksheet distinguishes zero from missing and reopens',async()=>{
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=jointTorque]');x.value='0';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('[data-action=save]');
  for(let i=0;i<80;i++){try{partial=await readFile(path.join(downloads,'worldlaw-history-acquisition-receiver.json'),'utf8');break;}catch{await delay(100);}}
  assert.ok(partial,'Actual downloaded JSON missing');const data=JSON.parse(partial);
  assert.equal(data.readings[0].jointTorque,0);assert.equal(data.readings[1].jointTorque,null);assert.equal(data.orderConfirmed,false);
  await open(partial);await wait(`${q}.querySelector('tbody input[data-field=jointTorque]').value==='0'`);
  assert.equal(await evaljs(`${q}.querySelector('tbody tr:nth-child(2) input[data-field=jointTorque]').value`),'');
 });
 await check('late file completion cannot overwrite a newer handwritten reading',async()=>{
  await open(partial,true);
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=jointTorque]');x.value='7';x.dispatchEvent(new Event('input',{bubbles:true}));window.releaseWorksheetRead();})()`);
  await delay(150);assert.equal(await evaljs(`${q}.querySelector('tbody input[data-field=jointTorque]').value`),'7');
 });
 await check('separate analytic measurements apply only after explicit order confirmation',async()=>{
  await evaljs(`(()=>{for(const [i,row] of [...${q}.querySelectorAll('tbody tr')].entries()){const conditioned=row.dataset.history==='conditioned';for(const input of row.querySelectorAll('input')){const v={command:.2,position:.3,rate:-.1,jointTorque:10+.25*i+(conditioned?.6:0)};input.value=v[input.dataset.field];input.dispatchEvent(new Event('input',{bubbles:true}));}}})()`);
  await click('[data-action=apply]');assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  await click('[data-action=confirm]');await click('[data-action=apply]');
  await wait("document.querySelector('#source-badge').textContent==='USER-DECLARED MEASUREMENTS'");
  assert.equal(await evaljs("document.querySelector('#status').textContent"),'CHALLENGED');
  assert.match(await evaljs("document.querySelector('#order-adjustment').textContent"),/adjusted 0\.6 N·m/);
  assert.match(await evaljs("document.querySelector('#order-adjustment').textContent"),/estimated linear drift 0\.25 N·m/);
 });
 await check('editing a confirmed reading revokes confirmation and off-target evidence cannot replace comparison',async()=>{
  const before=await evaljs("document.querySelector('#offset').textContent");
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=command]');x.value='.202';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaljs(`${q}.querySelector('[data-action=confirm]').checked`),false);
  await click('[data-action=confirm]');await click('[data-action=apply]');
  assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  assert.equal(await evaljs("document.querySelector('#offset').textContent"),before);
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=command]');x.value='.2';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('[data-action=confirm]');await click('[data-action=apply]');
 });
 await check('completed worksheet actual download and reopen retain confirmation and supplied readings',async()=>{
  await rm(path.join(downloads,'worldlaw-history-acquisition-receiver.json'));await click('[data-action=save]');
  let text;for(let i=0;i<80;i++){try{text=await readFile(path.join(downloads,'worldlaw-history-acquisition-receiver.json'),'utf8');break;}catch{await delay(100);}}
  assert.ok(text);const data=JSON.parse(text);assert.equal(data.orderConfirmed,true);assert.ok(data.readings.every(r=>typeof r.jointTorque==='number'));
  await open(text);await wait(`${q}.querySelector('[data-action=confirm]').checked`);
  const observed=await evaljs(`[...${q}.querySelectorAll('tbody input[data-field=jointTorque]')].map(x=>Number(x.value))`);
  assert.deepEqual(observed,data.readings.map(r=>r.jointTorque));
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await delay(150);
  await check(`worksheet keyboard and page containment at ${width}px`,async()=>{
   await evaljs(`${q}.querySelector('tbody input').focus()`);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   assert.equal(await evaljs("document.activeElement.dataset.field"),'position');
   const dims=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
   await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   const capture=async(name,selector,horizontal=false)=>{
    await evaljs(`(async()=>{document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing capture target');node.scrollIntoView({behavior:'instant',block:'start'});${horizontal?"const table=document.querySelector('#history-acquisition .table-wrap');table.scrollLeft=table.scrollWidth;":''}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,`history-acquisition-${width}-${name}.png`),Buffer.from(shot.data,'base64'));
   };
   await capture('heading','#history-acquisition');
   await capture('course','#history-acquisition [data-role=course]');
   if(width===390)await capture('actual-readings','#history-acquisition .table-wrap',true);
   await capture('confirmation','#history-acquisition .history-acquisition-confirm');
   await capture('comparison','.readout');
  });
 }
 assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);
 const receipt={pass:true,checks:out,events};await writeFile(path.join(outputDir,'browser-result.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));}
