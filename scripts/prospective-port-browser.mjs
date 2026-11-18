// Native Chrome receiving for the actual prospective Coupling Lab consumer.
// Uses CDP/DOM reads (not screenshots as a data-extraction substitute).
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {createProductServer} from '../server.mjs';

const dir=await mkdtemp(path.join(process.env.TMPDIR||os.tmpdir(),'worldlaw-prospective-'));
const output=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'proof');
await mkdir(output,{recursive:true});
const downloads=path.join(dir,'downloads');await mkdir(downloads);
const profile=path.join(dir,'profile');await mkdir(profile);
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const url='http://127.0.0.1:'+server.address().port+'/coupling.html';
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',
 ['--headless=new','--enable-automation','--disable-background-networking','--disable-dev-shm-usage','--remote-debugging-port=0',
 '--window-size=1440,1000','--user-data-dir='+profile,url],{stdio:['ignore','ignore','pipe']});
let chromeError='',ws,seq=0;const pending=new Map();
const errors=[],unexpected=[],checks=[];
chrome.stderr.on('data',data=>chromeError=(chromeError+data).slice(-3000));
async function until(predicate,timeout=15000){
 const deadline=Date.now()+timeout;
 do{const value=await predicate();if(value)return value;await delay(80);}while(Date.now()<deadline);
 throw Error('Timed out: '+chromeError);
}
try{
 const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return 0;}});
 const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
 ws.addEventListener('message',event=>{
  const value=JSON.parse(event.data);
  if(value.id&&pending.has(value.id)){
   const p=pending.get(value.id);pending.delete(value.id);clearTimeout(p.timer);
   value.error?p.reject(Error(value.error.message)):p.resolve(value.result);
  }
  if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails.exception?.description||value.params.exceptionDetails.text);
  if(value.method==='Network.requestWillBeSent'&&!value.params.request.url.startsWith('http://127.0.0.1:'+server.address().port)&&
     !value.params.request.url.startsWith('blob:'))unexpected.push(value.params.request.url);
 });
 const send=(method,params={})=>new Promise((res,rej)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);rej(Error('CDP '+method+' timed out'));},15000);
  pending.set(id,{resolve:res,reject:rej,timer});ws.send(JSON.stringify({id,method,params}));
 });
 const evalJs=async expression=>{
  const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);
  return out.result.value;
 };
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const upload=async(inputPath,file)=>{
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:inputPath});
  assert.ok(nodeId);
  await send('DOM.setFileInputFiles',{nodeId,files:[file]});
 };
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const flags=(await send('Browser.getBrowserCommandLine')).arguments;
 assert.ok(!flags.includes('--no-sandbox'),'Browser must retain native sandbox.');
 await until(()=>evalJs("document.readyState==='complete' && document.querySelector('[data-prospective=result]')?.textContent.includes('precommitted')"));
 await check('default cold-open planner actually computes a qualifying command and draws two trajectories',async()=>{
  const counts=await evalJs("({status:document.querySelector('[data-prospective=result]').textContent,paths:document.querySelectorAll('[data-prospective=plot] polyline').length,fields:document.querySelectorAll('[data-prospective-source]').length})");
  assert.match(counts.status,/[0-9]+ admissible commands/);assert.ok(counts.paths>=3);assert.equal(counts.fields,10);
  assert.equal(await evalJs("document.querySelector('[data-prospective=sample]').disabled"),false);
 });
 await check('frozen proposal downloads a portable, prospective plan rather than an observed recording',async()=>{
  await evalJs("document.querySelector('[data-prospective=save]').click()");
  await until(async()=>(await readdir(downloads)).includes('worldlaw-prospective-port-plan.json'));
 });
 const original=JSON.parse(await readFile(path.join(downloads,'worldlaw-prospective-port-plan.json'),'utf8'));
 assert.equal(original.status,'prospective-witness');assert.ok(original.selected.drive.length>20);
 await check('saved proposal reopens through source recomputation without importing measurements',async()=>{
  await upload('[data-prospective=file]',path.join(downloads,'worldlaw-prospective-port-plan.json'));
  await until(()=>evalJs("document.querySelector('[data-prospective=result]').textContent.includes('Reopened from source')"));
  assert.equal(await evalJs("document.querySelector('[data-prospective=error]').textContent"),'');
 });
 await check('independently supplied matching command and one encoder snapshot produce a conditional classification',async()=>{
  const file=path.join(dir,'delivered.json');
  await writeFile(file,JSON.stringify(original.selected.drive));
  await upload('[data-prospective=trace]',file);
  await evalJs("document.querySelector('[data-prospective=angle1]').value="+JSON.stringify(original.selected.predicted.shoulder[0]));
  await evalJs("document.querySelector('[data-prospective=angle2]').value="+JSON.stringify(original.selected.predicted.shoulder[1]));
  await evalJs("document.querySelector('[data-prospective=evidence-form]').requestSubmit()");
  await until(()=>evalJs("document.querySelector('[data-prospective=result]').textContent.includes('SHOULDER PORT')"));
  assert.equal(await evalJs("document.querySelector('[data-prospective=error]').textContent"),'');
 });
 await check('delivered command tampering refuses classification in the maintained UI',async()=>{
  const broken=structuredClone(original.selected.drive);broken[5].torque+=.1;
  const file=path.join(dir,'tampered.json');await writeFile(file,JSON.stringify(broken));
  await upload('[data-prospective=trace]',file);
  await evalJs("document.querySelector('[data-prospective=evidence-form]').requestSubmit()");
  await until(()=>evalJs("document.querySelector('[data-prospective=error]').textContent.includes('differs')"));
 });
 await check('editing the initial state retires the readout and requires explicit replanning',async()=>{
  const retired=await evalJs("(()=>{const x=document.querySelector('[data-prospective=q1]');x.value='.15';x.dispatchEvent(new Event('input',{bubbles:true}));return {save:document.querySelector('[data-prospective=save]').disabled,evidence:document.querySelector('[data-prospective=evidence]').hidden}})()");
  assert.deepEqual(retired,{save:true,evidence:true});
  await evalJs("document.querySelector('[data-prospective=form]').requestSubmit()");
  await until(()=>evalJs("!document.querySelector('[data-prospective=save]').disabled"));
 });
 for(const width of [1920,1440,390,320])await check('full product desktop/mobile viewport '+width+' and native instrument pixels',async()=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
  await evalJs("document.getElementById('prospective-port').scrollIntoView({block:'start'})");
  const dims=await evalJs("(()=>{const e=document.getElementById('prospective-port');const r=e.getBoundingClientRect();return {screen:innerWidth,body:document.documentElement.scrollWidth,section:e.scrollWidth,width:r.width,x:r.x}})()");
  assert.ok(dims.section<=dims.width+1,JSON.stringify(dims));
  assert.ok(dims.body<=width+1,JSON.stringify(dims));
  const clip=await evalJs("(()=>{const r=document.getElementById('prospective-port').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:Math.min(r.height,1000),scale:1}})()");
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(path.join(output,'prospective-'+width+'.png'),Buffer.from(shot.data,'base64'));
 });
 await check('no JavaScript exception or unrequested network',async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 });
 console.log('RECEIPT '+JSON.stringify({checks,sandboxed:true,node:process.version,proposed:original.selected.id,observationTime:original.selected.observationTime,screenedMargin:original.selected.predicted.certifiedMargin}));
}finally{
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closed'));}pending.clear();
 ws?.close();chrome.kill();
 await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
