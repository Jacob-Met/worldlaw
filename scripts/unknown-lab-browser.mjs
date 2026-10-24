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
 await wait("document.readyState==='complete' && document.querySelector('#status')?.textContent.length>1");
 await check('initial real page: synthetic challenger and paired plot',async()=>{
  const x=await evaljs("({status:document.querySelector('#status').textContent,rows:document.querySelectorAll('#rows tr').length,svg:!!document.querySelector('#plot svg'),source:document.querySelector('#source-badge').textContent,errorHidden:document.querySelector('#error').hidden})");
  assert.equal(x.status,'CHALLENGED');assert.equal(x.rows,16);assert.equal(x.svg,true);assert.equal(x.source,'DECLARED SIMULATION');assert.equal(x.errorHidden,true);
 });
 await check('zero memory effect is inconclusive through actual form',async()=>{
  await evaljs("(()=>{document.querySelector('#effect').value='0';document.querySelector('#effect').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#run-form').requestSubmit();})()");
  await wait("document.querySelector('#status').textContent==='INCONCLUSIVE'");
  assert.equal(await evaljs("document.querySelector('#effect-out').textContent"),'0.00');
 });
 await check('negative memory effect challenges with negative offset',async()=>{
  await evaljs("(()=>{document.querySelector('#effect').value='-1';document.querySelector('#run-form').requestSubmit();})()");
  await wait("document.querySelector('#status').textContent==='CHALLENGED'");
  assert.equal(await evaljs("document.querySelector('#offset').textContent.trim().startsWith('-')"),true);
 });
 await check('explicitly save, reload, and recover original evidence',async()=>{
  await evaljs("document.querySelector('#remember').click()");
  await wait("document.querySelector('#storage').textContent.includes('Explicitly saved')");
  const before=await evaljs("document.querySelector('#offset').textContent");
  await send('Page.reload',{ignoreCache:true});
  await wait("document.querySelector('#storage')?.textContent.includes('Reopened explicitly saved')");
  assert.equal(await evaljs("document.querySelector('#offset').textContent"),before);
 });
 await check('measured import through real file-input DOM replaces synthetic badge',async()=>{
  const x=await evaljs("(async()=>{const m=await import('/src/unknown-lab/paired-history.mjs');const n=m.syntheticChallenge({effect:1,noiseSigma:.02});n.source='measured';n.sourceNote='external bench test sample';const f=new File([m.exportNotebook(n)],'measured.json',{type:'application/json'});const d=new DataTransfer();d.items.add(f);const input=document.querySelector('#file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
  assert.equal(x,true);
  await wait("document.querySelector('#source-badge').textContent==='USER-DECLARED MEASUREMENTS'");
  assert.equal(await evaljs("document.querySelector('#status').textContent"),'CHALLENGED');
 });
 await check('mismatched visible-state import refused without replacing current valid data',async()=>{
  await evaljs("(async()=>{const m=await import('/src/unknown-lab/paired-history.mjs');const n=m.syntheticChallenge();n.trials[1].rate+=.3;const f=new File([JSON.stringify(n)],'bad.json',{type:'application/json'});const d=new DataTransfer();d.items.add(f);const input=document.querySelector('#file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("!document.querySelector('#error').hidden");
  assert.equal(await evaljs("document.querySelector('#source-badge').textContent"),'USER-DECLARED MEASUREMENTS');
  assert.match(await evaljs("document.querySelector('#error').textContent"),/not matched on rate/);
 });
 await check('Forget local copy prevents saved measured evidence reopening',async()=>{
  await evaljs("document.querySelector('#forget').click()");
  await wait("document.querySelector('#storage').textContent.includes('forgotten')");
  await send('Page.reload',{ignoreCache:true});
  await wait("document.querySelector('#source-badge')?.textContent==='DECLARED SIMULATION'");
  assert.equal(await evaljs("localStorage.getItem('worldlaw.unknown-lab.history.v1')"),null);
 });
 await check('desktop 1440px contains all content',async()=>{
  const dims=await evaljs("({width:window.innerWidth,scroll:document.documentElement.scrollWidth,svg:document.querySelector('#plot svg').getBoundingClientRect().width})");
  assert.ok(dims.scroll<=dims.width+1,JSON.stringify(dims));assert.ok(dims.svg>500);
 });
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await delay(500);
 await check('phone 390px no horizontal overflow and chart visible',async()=>{
  const d=await evaljs("({inner:window.innerWidth,scroll:document.documentElement.scrollWidth,svg:document.querySelector('#plot svg').getBoundingClientRect().width,button:document.querySelector('#run-form button').getBoundingClientRect().width})");
  assert.ok(d.scroll<=d.inner+1,JSON.stringify(d));assert.ok(d.svg>200&&d.button>250);
 });
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 if(outputDir)await writeFile(path.join(outputDir,'worldlaw-unknown-lab-mobile.png'),Buffer.from(shot.data,'base64'));
 await check('browser isolation and script errors',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:out.every(x=>x.passed),events,browserExecutable:process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',mobileScreenshot:!!outputDir},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
