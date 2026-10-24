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



 await check('continuous comparison starts without invented fitted parameters',async()=>{
  assert.equal(await evaljs("document.querySelector('#continuous-export').disabled"),true);
 });
 await check('off-grid oracle has finite-grid refusal but actual coherent continuous witnesses',async()=>{
  await evaljs("document.querySelector('#continuous-example').click()");
  await wait("document.querySelector('#continuous-status').textContent.includes('FEASIBLE WITNESSES')");
  assert.match(await evaljs("document.querySelector('#continuous-status').textContent"),/finite baseline: none-compatible/);
  assert.ok(await evaljs("document.querySelectorAll('#continuous-witnesses tr').length>0"));
  assert.match(await evaljs("document.querySelector('#continuous-challenges').textContent"),/coherent-witness/);
 });
 const boxes=await evaljs("document.querySelector('#continuous-boxes').textContent"),witnesses=await evaljs("document.querySelector('#continuous-witnesses').textContent");
 let saved;
 await check('export contains inputs; a separate changed challenge cannot refit training parameters',async()=>{
  await evaljs("window.originalContinuousURL=URL.createObjectURL;URL.createObjectURL=b=>{window.continuousBlob=b;return window.originalContinuousURL(b)};document.querySelector('#continuous-export').click()");
  saved=JSON.parse(await evaljs('window.continuousBlob.text()'));assert.equal(saved.fit,undefined);
  const changed=structuredClone(saved);for(const r of changed.study.runs)if(r.role==='challenge')for(const t of r.notebook.trials)if(t.history==='conditioned')t.jointTorque-=2;
  await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(changed))}],'changed.json',{type:'application/json'}));const input=document.querySelector('#continuous-file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait("document.querySelector('#continuous-challenges').textContent.includes('contradicted')");
  assert.equal(await evaljs("document.querySelector('#continuous-boxes').textContent"),boxes);
  assert.equal(await evaljs("document.querySelector('#continuous-witnesses').textContent"),witnesses);
 });
 await check('reopen restores input-derived comparison; malformed replacement is atomic',async()=>{
  await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(saved))}],'saved.json',{type:'application/json'}));const input=document.querySelector('#continuous-file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait("document.querySelector('#continuous-challenges').textContent.includes('coherent-witness')");
  await evaljs("(()=>{const d=new DataTransfer();d.items.add(new File(['{}'],'bad.json',{type:'application/json'}));const input=document.querySelector('#continuous-file');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("document.querySelector('#continuous-error').textContent.length>0");
  assert.equal(await evaljs("document.querySelector('#continuous-boxes').textContent"),boxes);
 });
 await check('work budget exhaustion retains possible boxes without inventing a feasible witness',async()=>{
  await evaljs("document.querySelector('#continuous-budget').value='1';document.querySelector('#continuous-budget').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#continuous-form').requestSubmit()");
  assert.match(await evaljs("document.querySelector('#continuous-status').textContent"),/BUDGET EXHAUSTED/);
  assert.equal(await evaljs("document.querySelectorAll('#continuous-witnesses tr').length"),0);
  assert.ok(await evaljs("document.querySelectorAll('#continuous-boxes tr').length>0"));
 });
 await check('zero response retains the full tau range and no identification claim',async()=>{
  await evaljs("document.querySelector('#continuous-budget').value='2048';document.querySelector('#continuous-kind').value='zero';document.querySelector('#continuous-example').click()");
  assert.match(await evaljs("document.querySelector('#continuous-status').textContent"),/ZERO COMPATIBLE UNIDENTIFIED/);
  assert.match(await evaljs("document.querySelector('#continuous-status').textContent"),/0.1 to 8/);
 });
 await check('sign-changing oracle rejects bounded family without zero-filled model',async()=>{
  await evaljs("document.querySelector('#continuous-kind').value='contradictory';document.querySelector('#continuous-example').click()");
  assert.match(await evaljs("document.querySelector('#continuous-status').textContent"),/EXCLUDED IN BOUNDS/);
  assert.equal(await evaljs("document.querySelectorAll('#continuous-witnesses tr').length"),0);
  assert.equal(await evaljs("document.querySelectorAll('#continuous-boxes tr').length"),0);
 });
 await evaljs("document.querySelector('#continuous-kind').value='off-grid';document.querySelector('#continuous-example').click()");
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<500});await delay(150);
  await check('continuous comparison layout and keyboard '+width+'px',async()=>{
   const x=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(x.scroll<=x.inner+1,JSON.stringify(x));
   await evaljs("document.querySelector('#continuous-example').focus()");assert.equal(await evaljs('document.activeElement.id'),'continuous-example');
  });
  await evaljs("document.querySelector('#continuous-title').scrollIntoView({behavior:'instant'})");
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,'worldlaw-continuous-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('continuous module has no browser exceptions or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:true,results:out,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
