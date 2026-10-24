import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/unknown-lab.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000',origin],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];
const outputDir=process.env.BROWSER_ARTIFACT_DIR;
if(outputDir)await mkdir(outputDir,{recursive:true});
try {
 let port=null;
 for(let i=0;i<120;i++){try{const lines=(await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).trim().split('\n');port=Number(lines[0]);break;}catch{await delay(100);}}
 assert.ok(port,'Chrome DevTools port unavailable');
 let target=null;
 for(let i=0;i<60;i++){const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(x=>x.type==='page'&&x.url.includes('unknown-lab'));if(target)break;await delay(100);}
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


 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await wait("!!document.querySelector('#recovery-plan-course')");
 const click=async id=>evaljs(`document.querySelector('#${id}').click()`);
 await check('actual early-training course selects finite shortest full-separation request',async()=>{
  await click('recovery-plan-course');assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/all-pairs-separated · request 1.5 s/);
  assert.equal(await evaljs("document.querySelectorAll('#recovery-plan-rows tr').length"),11);
 });
 await check('independent selected acquisition changes compatibility without refitting training',async()=>{
  await click('recovery-plan-acquire');assert.match(await evaljs("document.querySelector('#recovery-plan-result').textContent"),/Compatible after separate evidence: decay:2/);
  assert.match(await evaljs("document.querySelector('#recovery-state').textContent"),/2 training recordings \/ 1 separate/);
  assert.match(await evaljs("document.querySelector('#recovery-plan-result').textContent"),/Declared acquisition checks met/);
  await click('recovery-plan-acquire');assert.match(await evaljs("document.querySelector('#recovery-plan-result').textContent"),/virtual-recovery-4/);
 });
 await check('changed settings disable stale acquisition, budget exposes partial and unavailable outcomes',async()=>{
  await evaljs("const e=document.querySelector('#recovery-plan-budget');e.value='70';e.dispatchEvent(new Event('input'))");assert.equal(await evaljs("document.querySelector('#recovery-plan-acquire').disabled"),true);
  await click('recovery-plan-run');assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/partial-separation/);
  await evaljs("document.querySelector('#recovery-plan-budget').value='0';document.querySelector('#recovery-plan-run').click()");assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/no-informative-delay/);assert.equal(await evaljs("document.querySelector('#recovery-plan-acquire').disabled"),true);
 });
 await check('changed parent training invalidates frozen request',async()=>{
  await evaljs("document.querySelector('#recovery-plan-budget').value='500';document.querySelector('#recovery-plan-run').click();document.querySelector('#recovery-load').click()");
  assert.equal(await evaljs("document.querySelector('#recovery-plan-acquire').disabled"),true);assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/Training changed/);
 });
 await check('input-only plan export and reopen reproduce actual offered wait',async()=>{
  await click('recovery-plan-course');
  await evaljs("window.requestExport=null;window.oldCreate=URL.createObjectURL;URL.createObjectURL=b=>{window.requestExport=b;return window.oldCreate(b)};document.querySelector('#recovery-plan-export').click()");
  const exported=await evaljs("requestExport.text()"),n=JSON.parse(exported);assert.equal(n.training.challenges.length,0);assert.ok(!n.selected);
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(exported)}],'request.json'));const f=document.querySelector('#recovery-plan-file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()`);
  await wait("document.querySelector('#recovery-plan-result').textContent.includes('forecasts recomputed')");assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/request 1.5 s/);
 });
 await check('user-declared measured course refuses virtual guessing and receives supplied paired evidence',async()=>{
  await evaljs("(async()=>{const m=await import('/src/unknown-lab/recovery-planning-example.mjs');const n=m.recoveryPlanningExample();n.source='measured';for(const r of n.training)r.evidence.source='measured';const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(n)],'measured.json'));const f=document.querySelector('#recovery-file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()");
  await wait("document.querySelector('#recovery-source').textContent.includes('USER-DECLARED')");await click('recovery-plan-run');await click('recovery-plan-acquire');assert.match(await evaljs("document.querySelector('#recovery-plan-error').textContent"),/exact authored/);
  await evaljs("(async()=>{const m=await import('/src/unknown-lab/recovery-fixture.mjs');const n=m.recoveryRecording('decay',50,1.5,{noiseSigma:.03}).evidence;n.source='measured';const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(n)],'paired.json'));const f=document.querySelector('#file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()");
  await wait("document.querySelector('#source-badge').textContent==='USER-DECLARED MEASUREMENTS'");await click('recovery-plan-supplied');assert.match(await evaljs("document.querySelector('#recovery-plan-result').textContent"),/Acquired recovery-acquisition-1/);assert.equal(await evaljs("document.querySelector('#recovery-plan-error').hidden"),true);
 });
 await check('changed-response control retains misleading finite-family survival',async()=>{
  await evaljs("document.querySelector('#recovery-plan-kind').value='mismatch';document.querySelector('#recovery-plan-course').click();document.querySelector('#recovery-plan-acquire').click()");
  assert.match(await evaljs("document.querySelector('#recovery-plan-result').textContent"),/Compatible after separate evidence: persistent/);
 });
 await check('native complete Enter recomputes selected request',async()=>{
  await send('Page.bringToFront');await evaljs("document.querySelector('#recovery-plan-run').focus()");assert.equal(await evaljs("document.activeElement.id"),'recovery-plan-run');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('#recovery-plan-result').textContent===''");assert.match(await evaljs("document.querySelector('#recovery-plan-status').textContent"),/request 1.5 s/);
 });
 await click('recovery-plan-acquire');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
  await evaljs("document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:document.querySelector('#recovery-planner').getBoundingClientRect().top+scrollY,behavior:'instant'})");
  await wait("Math.abs(scrollY-Math.min(document.querySelector('#recovery-planner').getBoundingClientRect().top+scrollY,document.documentElement.scrollHeight-innerHeight))<2");
  await check('actual planner layout contained at '+width,async()=>{const d=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth,rows:document.querySelectorAll('#recovery-plan-rows tr').length})");assert.ok(d.scroll<=d.inner+1,JSON.stringify(d));assert.equal(d.rows,11);});
  if(outputDir){const clip=await evaljs("(()=>{const r=document.querySelector('#recovery-planner').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'recovery-planner-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('no script exceptions or outside requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out,pass:true,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
