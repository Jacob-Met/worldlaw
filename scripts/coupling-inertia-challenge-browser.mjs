import {createInertiaChallengeExample} from '../src/coupling/inertia-challenge-example.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const server=createProductServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,origin=base+'/coupling.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-inertia-challenge-browser-')),out=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'receipts'),downloads=path.join(dir,'downloads');
await mkdir(out,{recursive:true});await mkdir(downloads);
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/opt/google/chrome/chrome',['--headless=new','--disable-gpu','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1050','about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),exceptions=[],outside=[],checks=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(60);}}
 assert.ok(port,'Owned Chrome did not start');const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),target=targets.find(x=>x.type==='page');assert.ok(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}}if(v.method==='Runtime.exceptionThrown')exceptions.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(base)&&!v.params.request.url.startsWith('blob:'+base))outside.push(v.params.request.url);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Debugger timeout: '+method));},12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async predicate=>{for(let i=0;i<100;i++){if(await evaluate(predicate))return;await delay(40);}throw Error('Timed out: '+predicate);};
 const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS '+name);};
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const text=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
 const set=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const paths=()=>evaluate("[...document.querySelectorAll('#motion-plot path')].map(x=>x.getAttribute('d'))");
 const run=async()=>{await evaluate("document.getElementById('motion-declared').checked=true");await click('motion-run');};
 const importMotion=async filename=>{const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#challenge-file'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filename]});};
 let sandbox;try{sandbox=await requireChromiumSandbox({send});}catch(error){if(error.receipt)await writeFile(path.join(out,'sandbox-refusal.json'),JSON.stringify(error.receipt,null,2));throw error;}await writeFile(path.join(out,'sandbox.json'),JSON.stringify(sandbox,null,2));
 await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await send('Page.navigate',{url:origin});await wait("document.querySelectorAll('#models tr').length===3");

 const positive=createInertiaChallengeExample(),negative=createInertiaChallengeExample({omittedForce:true});
 const upload=async(value,name)=>{const file=path.join(dir,name);await writeFile(file,JSON.stringify(value));await importMotion(file);return file;};
 const evaluated=()=>wait("document.getElementById('challenge-status').textContent.includes('no challenge refit')");
 const frozen=()=>text('challenge-coefficients');
 const originalResponse=await text('counts');
 await evaluate("document.getElementById('inertia-lab').open=true");
 await check('freeze requires a current supported source and authored positive changes motion without refitting',async()=>{
  await click('challenge-freeze');assert.match(await text('challenge-error'),/Fit an admissible/);
  await click('challenge-positive');await evaluated();assert.match(await text('challenge-status'),/^Within/);
  assert.equal(await evaluate("document.querySelectorAll('#challenge-motion-plot path').length"),2);
  assert.equal(await evaluate("document.querySelectorAll('#challenge-balance-plot path').length"),4);
  assert.equal(await evaluate("document.querySelectorAll('#challenge-residual-plot path').length"),2);
  assert.equal(await evaluate("document.querySelectorAll('[data-challenge-tolerance]').length"),4);
  assert.equal(await text('counts'),originalResponse);
 });
 await check('missing-force changed frequencies falsify the frozen effective inertia',async()=>{
  await click('challenge-negative');await evaluated();assert.match(await text('challenge-status'),/^Exceeds.*0.814149/);
  assert.match(await frozen(),/1.5/);assert.match(await frozen(),/1.3/);assert.match(await text('challenge-training-description'),/missing|omit|incomplete/i);
  assert.match(await text('challenge-sampling'),/same frozen coefficients/);
 });
 await check('source window keeps original indices, clock, observed torque and coarser provenance',async()=>{
  await set('challenge-window',2);assert.match(await text('challenge-window-readout'),/original source rows 81–161.*0.6–1.2 s/);
  assert.match(await text('challenge-window-readout'),/supplied.*frozen.*residual/);assert.match(await text('challenge-coarse-window'),/original rows/);
  assert.equal(await evaluate("document.querySelectorAll('[data-challenge-window]').length"),3);
 });
 let saved,savedFile;
 await check('actual save retains only raw frozen training, challenge and declared settings',async()=>{
  await click('challenge-save');let names=[];for(let i=0;i<100;i++){names=(await readdir(downloads)).filter(x=>x.endsWith('.json'));if(names.length)break;await delay(40);}assert.equal(names.length,1);
  savedFile=path.join(downloads,names[0]);saved=JSON.parse(await readFile(savedFile,'utf8'));assert.deepEqual(Object.keys(saved).sort(),['challenge','schema','settings','training']);
  const browserNegative=await evaluate("(async()=>{const {createInertiaChallengeExample}=await import('/src/coupling/inertia-challenge-example.mjs');return createInertiaChallengeExample({omittedForce:true});})()");
  assert.deepEqual(saved,browserNegative);await writeFile(path.join(out,'saved-inputs.json'),JSON.stringify(saved));
 });
 await check('changing the source above preserves the frozen training and challenge',async()=>{
  const before=await frozen(),label=await text('challenge-training');await click('inertia-example');assert.equal(await frozen(),before);assert.equal(await text('challenge-training'),label);assert.match(await text('challenge-status'),/^Exceeds/);
  await click('challenge-freeze');assert.notEqual(await frozen(),before);assert.match(await frozen(),/1.4/);
  assert.equal(await evaluate("document.getElementById('challenge-inspection').hidden"),true);assert.equal(await evaluate("document.getElementById('challenge-correspondence').value"),'');
 });
 await check('fresh raw reopen recomputes and forged results or duplicate evidence refuse',async()=>{
  await send('Page.navigate',{url:origin});await wait("document.getElementById('challenge-negative')!==null");await evaluate("document.getElementById('inertia-lab').open=true");
  await importMotion(savedFile);await evaluated();assert.match(await text('challenge-status'),/^Exceeds.*0.814149/);
  const forged=structuredClone(saved);forged.result={status:'within_declared_tolerance'};await upload(forged,'forged-challenge.json');await wait("!document.getElementById('challenge-error').hidden");assert.match(await text('challenge-error'),/unsupported fields/);
  const reused=structuredClone(saved);reused.challenge=structuredClone(reused.training.record);reused.challenge.source.label='New label, repeated source';await upload(reused,'reused.json');await wait("/complete challenge course repeats|five-row/.test(document.getElementById('challenge-error').textContent)");
  assert.equal(await evaluate("document.getElementById('challenge-inspection').hidden"),true);await importMotion(savedFile);await evaluated();
 });
 await check('raw separate source requires a new explicit correspondence before keyboard evaluation',async()=>{
  await click('challenge-positive');const before=await frozen();await upload(positive.challenge,'separate-observations.json');await wait("document.getElementById('challenge-status').textContent.startsWith('Separate source loaded')");
  assert.equal(await evaluate("document.getElementById('challenge-correspondence').value"),'');await click('challenge-run');assert.match(await text('challenge-error'),/Declare how/);
  await set('challenge-correspondence',positive.settings.correspondence);await send('Page.bringToFront');await evaluate("document.getElementById('challenge-run').scrollIntoView();document.getElementById('challenge-run').focus()");
  assert.equal(await evaluate('document.activeElement.id'),'challenge-run');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  await evaluated();assert.match(await text('challenge-status'),/^Within/);assert.equal(await frozen(),before);
 });
 await check('changed tolerances invalidate the verdict without altering frozen coefficients',async()=>{
  await click('challenge-negative');const before=await frozen();await set('challenge-tolerance-0',2);await set('challenge-tolerance-1',2);
  assert.equal(await evaluate("document.getElementById('challenge-inspection').hidden"),true);assert.equal(await evaluate("document.getElementById('challenge-save').disabled"),true);
  await click('challenge-run');await evaluated();assert.match(await text('challenge-status'),/^Within.*0.814149/);assert.equal(await frozen(),before);await click('challenge-negative');
 });
 await check('a delayed reopen cannot replace a newer authored pair',async()=>{
  await evaluate("window.originalChallengeText=File.prototype.text;File.prototype.text=function(){const self=this;return new Promise(resolve=>{window.releaseChallengeRead=()=>window.originalChallengeText.call(self).then(resolve);});}");
  await importMotion(savedFile);await wait("typeof window.releaseChallengeRead==='function'");await click('challenge-positive');const label=await text('challenge-source');
  await evaluate("window.releaseChallengeRead();File.prototype.text=window.originalChallengeText");await delay(80);assert.equal(await text('challenge-source'),label);assert.match(await text('challenge-status'),/^Within/);
 });
 await check('changing a declaration cancels an outstanding read and leaves no stale verdict',async()=>{
  await evaluate("window.originalChallengeText=File.prototype.text;File.prototype.text=function(){const self=this;return new Promise(resolve=>{window.releaseChallengeRead=()=>window.originalChallengeText.call(self).then(resolve);});}");
  await importMotion(savedFile);await wait("document.getElementById('challenge-status').textContent.startsWith('Opening')");await set('challenge-width',61);
  await evaluate("window.releaseChallengeRead();File.prototype.text=window.originalChallengeText");await delay(80);
  assert.match(await text('challenge-status'),/settings changed/);assert.equal(await evaluate("document.getElementById('challenge-inspection').hidden"),true);
 });
 await check('literal source text remains inert and reduced motion preserves window inspection',async()=>{
  const literal=structuredClone(negative);literal.challenge.source.label='<img src=x onerror="throw Error(123)"> challenge';await upload(literal,'literal-challenge.json');await evaluated();assert.match(await text('challenge-source'),/<img/);assert.equal(await evaluate("document.querySelector('#challenge-source img')"),null);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await set('challenge-window',4);assert.match(await text('challenge-window-label'),/5 \/ 19/);await click('challenge-negative');
 });
 for(const width of [1440,390])await check('aligned scientific instruments fit '+width+' CSS pixels',async()=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width===390});await delay(80);
  const dimensions=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.inner+1,JSON.stringify(dimensions));
  for(const id of ['challenge-title','challenge-form','challenge-instruments','challenge-window-readout']){await evaluate('document.getElementById('+JSON.stringify(id)+').scrollIntoView()');const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(out,id+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 });
 await check('capture materially different split-instrument composition on identical actual evidence',async()=>{
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('challenge-instruments').dataset.composition='split';document.getElementById('challenge-instruments').scrollIntoView()");await delay(80);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(out,'concept-split-1440.png'),Buffer.from(shot.data,'base64'));await evaluate("delete document.getElementById('challenge-instruments').dataset.composition");
 });
 await check('no page exception or external network request occurred',async()=>{assert.deepEqual(exceptions,[]);assert.deepEqual(outside,[]);});
}finally{
 await writeFile(path.join(out,'receiving.json'),JSON.stringify({checks,exceptions,outside},null,2));
 if(ws)ws.close();for(const p of pending.values())clearTimeout(p.timer);
 chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)return resolve();const t=setTimeout(()=>{chrome.kill('SIGKILL');resolve();},3000);chrome.once('exit',()=>{clearTimeout(t);resolve();});});
 await new Promise(resolve=>server.close(resolve));
 console.log('Receipts: '+out);if(!out.startsWith(dir+path.sep))await rm(dir,{recursive:true,force:true});
}

