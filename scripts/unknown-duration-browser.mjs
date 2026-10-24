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

 await check('duration panel starts without invented training',async()=>{
  assert.equal(await evaljs("document.querySelector('#duration-state').textContent"),'INSUFFICIENT TRAINING');
 });
 await check('independent virtual series fits and predicts all separate challenges',async()=>{
  await evaljs("document.querySelector('#duration-example').click()");
  await wait("document.querySelector('#duration-state').textContent==='SINGLE GRID HYPOTHESIS'");
  const x=await evaljs("({rows:document.querySelectorAll('#duration-models tr').length,runs:document.querySelectorAll('#duration-runs li').length,results:document.querySelector('#duration-challenges').textContent,curves:document.querySelectorAll('#duration-plot polyline').length})");
  assert.equal(x.rows,9);assert.equal(x.runs,6);assert.equal(x.curves,1);assert.match(x.results,/saturation-1.3/);assert.doesNotMatch(x.results,/contradicted/);
 });
 await check('actual export and file import preserve study without saved verdicts',async()=>{
  const x=await evaljs(`(()=>{window.durationBlob=null;window.originalCreate=URL.createObjectURL;URL.createObjectURL=b=>{window.durationBlob=b;return window.originalCreate(b)};document.querySelector('#duration-export').click();return true})()`);
  assert.equal(x,true);
  const blob=await evaljs('window.durationBlob.text()');assert.match(blob,/worldlaw.duration-response/);
  await evaljs("document.querySelector('#duration-clear').click()");
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(blob)}],'study.json',{type:'application/json'}));const input=document.querySelector('#duration-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait("document.querySelectorAll('#duration-runs li').length===6");
  assert.equal(await evaljs("document.querySelector('#duration-state').textContent"),'SINGLE GRID HYPOTHESIS');
 });
 await check('malformed import refuses atomically',async()=>{
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['{}'],'bad.json',{type:'application/json'}));const input=document.querySelector('#duration-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait("document.querySelector('#duration-error').textContent.length>0");
  assert.equal(await evaljs("document.querySelectorAll('#duration-runs li').length"),6);
 });
 await check('adding same current acquisition twice refuses duplicate evidence',async()=>{
  await evaljs("document.querySelector('#duration-clear').click();document.querySelector('#duration-add-training').click();document.querySelector('#duration-add-challenge').click()");
  assert.equal(await evaljs("document.querySelectorAll('#duration-runs li').length"),1);
  assert.match(await evaljs("document.querySelector('#duration-error').textContent"),/reused|fresh virtual seed/);
 });
 await evaljs("document.querySelector('#duration-example').click();document.querySelector('#duration-title').scrollIntoView({behavior:'instant',block:'start'})");
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<500});await delay(150);
  await check('duration layout '+width+'px and keyboard focus',async()=>{
   const x=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(x.scroll<=x.inner+1,JSON.stringify(x));
   await evaljs("document.querySelector('#duration-example').focus()");assert.equal(await evaljs('document.activeElement.id'),'duration-example');
  });
  await evaljs("document.querySelector('#duration-title').scrollIntoView({behavior:'instant',block:'start'})");
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,'worldlaw-duration-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('no script exceptions or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:true,results:out,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
