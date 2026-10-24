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


 await check('duration planning starts without exportable fabricated protocol',async()=>{
  assert.equal(await evaljs("document.querySelector('#duration-plan-export').disabled"),true);
 });
 await check('short training leaves competing predictions and chooses2 seconds',async()=>{
  await evaljs("document.querySelector('#duration-plan-example').click();document.querySelector('#sigma').value='.005';document.querySelector('#duration-plan-form').requestSubmit()");
  await wait("document.querySelector('#duration-plan-status').textContent.includes('ALL PAIRS SEPARATED: 2 s')");
  assert.equal(await evaljs("document.querySelectorAll('#duration-plan-rows tr').length"),5);
  assert.equal(await evaljs("document.querySelector('#duration-plan-export').disabled"),false);
 });
 await check('manual protocol exports training inputs and no acquired challenge',async()=>{
  await evaljs("window.originalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.planBlob=b;return window.originalURL(b)};document.querySelector('#duration-plan-export').click()");
  const data=JSON.parse(await evaljs('window.planBlob.text()'));
  assert.equal(data.schema,'worldlaw.duration-plan/v1');assert.equal(data.selected.duration,2);
  assert.ok(data.training.runs.every(r=>r.role==='training'));assert.equal(data.observations,undefined);
 });
 const before=await evaljs("document.querySelector('#duration-models').textContent");
 await check('planned virtual acquisition appends a separate challenge without refitting',async()=>{
  await evaljs("document.querySelector('#duration-plan-acquire').click()");
  assert.equal(await evaljs("document.querySelectorAll('#duration-runs li').length"),4);
  assert.equal(await evaljs("document.querySelector('#duration-models').textContent"),before);
  assert.match(await evaljs("document.querySelector('#duration-plan-status').textContent"),/within declared planning radius/);
  assert.equal(await evaljs("document.querySelector('#duration-plan-acquire').disabled"),true);
 });
 await check('budget edits revoke export; challenges do not affect replanning',async()=>{
  await evaljs("document.querySelector('#duration-plan-budget').value='40';document.querySelector('#duration-plan-budget').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaljs("document.querySelector('#duration-plan-export').disabled"),true);
  await evaljs("document.querySelector('#duration-plan-form').requestSubmit()");
  assert.match(await evaljs("document.querySelector('#duration-plan-status').textContent"),/PARTIAL SEPARATION: 1 s/);
 });
 await check('actual imprecise acquisition retains observations and refuses planned precision claim',async()=>{
  await evaljs("document.querySelector('#sigma').value='.5';document.querySelector('#duration-plan-acquire').click()");
  assert.equal(await evaljs("document.querySelectorAll('#duration-runs li').length"),5);
  assert.match(await evaljs("document.querySelector('#duration-plan-status').textContent"),/EXCEEDS planning radius/);
 });
 await check('clearing training revokes previously exportable plan',async()=>{
  await evaljs("document.querySelector('#duration-clear').click()");
  assert.equal(await evaljs("document.querySelector('#duration-plan-export').disabled"),true);
  await evaljs("document.querySelector('#duration-plan-form').requestSubmit()");
  assert.match(await evaljs("document.querySelector('#duration-plan-status').textContent"),/qualified training/);
 });
 await evaljs("document.querySelector('#duration-plan-example').click();document.querySelector('#duration-plan-form').requestSubmit()");
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<500});await delay(150);
  await check('planner layout and keyboard '+width+'px',async()=>{
   const x=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(x.scroll<=x.inner+1,JSON.stringify(x));
   await evaljs("document.querySelector('#duration-plan-example').focus()");assert.equal(await evaljs('document.activeElement.id'),'duration-plan-example');
  });
  await evaljs("document.querySelector('#duration-planner-title').scrollIntoView({behavior:'instant',block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,'worldlaw-duration-planner-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('planner has no script errors or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:true,results:out,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
