import {createInertiaExample} from '../src/coupling/inertia-example.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const server=createProductServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,origin=base+'/coupling.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-identification-browser-')),out=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'receipts'),downloads=path.join(dir,'downloads');
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
 const importMotion=async filename=>{const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#inertia-file'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filename]});};
 let sandbox;try{sandbox=await requireChromiumSandbox({send});}catch(error){if(error.receipt)await writeFile(path.join(out,'sandbox-refusal.json'),JSON.stringify(error.receipt,null,2));throw error;}await writeFile(path.join(out,'sandbox.json'),JSON.stringify(sandbox,null,2));
 await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await send('Page.navigate',{url:origin});await wait("document.querySelectorAll('#models tr').length===3");

 const sourceBefore=await text('counts');
 const coefficients=()=>evaluate("[...document.querySelectorAll('#inertia-coefficients tr')].map(r=>Number(r.children[1].textContent))");
 const admitted=()=>wait("document.getElementById('inertia-status').textContent.startsWith('Candidate balance')");
 const upload=async(value,name)=>{const f=path.join(dir,name);await writeFile(f,JSON.stringify(value));await importMotion(f);};
 await evaluate("document.getElementById('inertia-lab').open=true");
 await check('authored analytic motion produces the coupled candidate from original samples',async()=>{
   await click('inertia-example');await admitted();const c=await coefficients();c.forEach((x,i)=>assert.ok(Math.abs(x-[1.4,.4,1.4,.2,.2][i])<1e-5));
   assert.equal(await evaluate("document.querySelectorAll('#inertia-source-plot path').length"),2);assert.equal(await evaluate("document.querySelectorAll('#inertia-balance-plot path').length"),4);
   assert.match(await text('inertia-source'),/801 original rows/);assert.match(await text('inertia-status'),/normalized QR pivot ratio/);assert.equal(await text('counts'),sourceBefore);
 });
 await check('selected weak window keeps original row and clock identities',async()=>{
   await set('inertia-window',2);assert.match(await text('inertia-window-readout'),/source rows 81–161, 0.8–1.6 s/);assert.equal(await evaluate("document.querySelectorAll('[data-source-window]').length"),1);
 });
 await check('keyboard copy requires source pairing and retains the simulation declaration step',async()=>{
   assert.equal(await evaluate("document.getElementById('inertia-apply').disabled"),true);
   await evaluate("document.getElementById('inertia-same-apparatus').checked=true;document.getElementById('inertia-same-apparatus').dispatchEvent(new Event('change'))");
   await send('Page.bringToFront');await evaluate("document.getElementById('inertia-apply').scrollIntoView();document.getElementById('inertia-apply').focus()");
   for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
   await wait("document.getElementById('motion-inertia-kind').value==='symmetric'");assert.ok(Math.abs(await evaluate("document.getElementById('motion-inertia-cross').valueAsNumber")-.4)<1e-5);
   assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);assert.equal(await evaluate('document.activeElement.id'),'motion-inertia-0');
   await run();assert.equal((await paths()).length,3);assert.equal(await text('counts'),sourceBefore);
 });
 let saved,savedFile,originalCoefficients=await coefficients();
 await check('actual download contains only original record and window settings',async()=>{
   await click('inertia-save');let names=[];for(let i=0;i<100;i++){names=(await readdir(downloads)).filter(x=>x.endsWith('.json'));if(names.length)break;await delay(40);}assert.equal(names.length,1);
   savedFile=path.join(downloads,names[0]);saved=JSON.parse(await readFile(savedFile,'utf8'));assert.deepEqual(Object.keys(saved).sort(),['record','schema','settings']);assert.deepEqual(saved.settings,{windowSamples:81,stride:40});assert.equal(saved.record.courses[0].rows.length,801);
   await writeFile(path.join(out,'saved-inputs.json'),JSON.stringify(saved));
 });
 await check('settings invalidate stale coefficients and reopening recomputes the original fit',async()=>{
   await set('inertia-width',61);assert.equal(await evaluate("document.getElementById('inertia-estimates').hidden"),true);assert.equal(await evaluate("document.getElementById('inertia-apply').disabled"),true);
   await importMotion(savedFile);await admitted();assert.deepEqual(await coefficients(),originalCoefficients);assert.equal(await evaluate("document.getElementById('inertia-width').valueAsNumber"),81);
 });
 await check('malformed units and saved verdicts refuse before candidate adoption',async()=>{
   const invalid=structuredClone(saved);invalid.record.units.position='degrees';await upload(invalid,'bad-units.json');await wait("!document.getElementById('inertia-error').hidden");assert.equal(await evaluate("document.getElementById('inertia-estimates').hidden"),true);
   const forged=structuredClone(saved);forged.result={coefficients:[1,0,1,0,0]};await upload(forged,'forged-result.json');await wait("!document.getElementById('inertia-error').hidden");assert.match(await text('inertia-error'),/unsupported fields/);
   await importMotion(savedFile);await admitted();
 });
 await check('affine motion retains nonidentification and out-of-family fits retain their refusal',async()=>{
   const affine=createInertiaExample();affine.courses[0].rows.forEach(r=>{r.position=[1000+.3*r.time,-700-.7*r.time];r.torque=[.06,-.14];});await upload(affine,'affine.json');await wait("document.getElementById('inertia-status').textContent.startsWith('Rank 2/5')");assert.equal(await evaluate("document.getElementById('inertia-apply-controls').hidden"),true);
   const invalid=createInertiaExample();invalid.courses[0].rows.forEach(r=>r.torque=r.torque.map(x=>-x));await upload(invalid,'negative-force.json');await wait("document.getElementById('inertia-status').textContent.startsWith('Outside supported')");assert.equal(await evaluate("document.getElementById('inertia-apply-controls').hidden"),true);assert.equal(await evaluate("document.getElementById('inertia-estimates').hidden"),false);
 });
 await check('the omitted-force control exposes tiny residuals with wrong known physical inertia',async()=>{
   await click('inertia-counterexample');await admitted();const c=await coefficients();assert.ok(Math.abs(c[0]-1.5)<1e-5&&Math.abs(c[2]-1.3)<1e-5);assert.match(await text('inertia-description'),/2|1.5/);assert.match(await text('inertia-torque'),/incomplete|omit|missing/i);
   assert.match(await evaluate("document.querySelector('.inertia-qualification').textContent"),/even with full rank, tiny residuals/);assert.equal(await evaluate("document.getElementById('inertia-apply').disabled"),true);
 });
 await check('a delayed file read cannot replace a newer authored source',async()=>{
   await evaluate("window.originalInertiaText=File.prototype.text;File.prototype.text=function(){const self=this;return new Promise(resolve=>{window.releaseInertiaRead=()=>window.originalInertiaText.call(self).then(resolve);});}");
   await importMotion(savedFile);await wait("typeof window.releaseInertiaRead==='function'");await click('inertia-counterexample');const label=await text('inertia-source');await evaluate("window.releaseInertiaRead();File.prototype.text=window.originalInertiaText");await delay(60);assert.equal(await text('inertia-source'),label);assert.ok(Math.abs((await coefficients())[0]-1.5)<1e-5);
 });
 await check('literal source labels remain text and response changes clear pairing consent',async()=>{
   const literal=createInertiaExample();literal.source.label='<img src=x onerror="throw Error(123)"> authored';await upload(literal,'literal.json');await admitted();assert.match(await text('inertia-source'),/<img/);assert.equal(await evaluate("document.querySelector('#inertia-source img')"),null);
   await evaluate("document.getElementById('inertia-same-apparatus').checked=true;document.getElementById('inertia-same-apparatus').dispatchEvent(new Event('change'))");await click('restart');assert.equal(await evaluate("document.getElementById('inertia-same-apparatus').checked"),false);assert.equal(await evaluate("document.getElementById('inertia-apply').disabled"),true);await click('inertia-example');
 });
 await check('a response change cancels an outstanding motion-file read with a current status',async()=>{
   await evaluate("window.originalInertiaText=File.prototype.text;File.prototype.text=function(){const self=this;return new Promise(resolve=>{window.releaseInertiaRead=()=>window.originalInertiaText.call(self).then(resolve);});}");
   await importMotion(savedFile);await wait("document.getElementById('inertia-status').textContent.startsWith('Opening')");await click('restart');assert.match(await text('inertia-status'),/Pending motion-file read canceled/);
   await evaluate("window.releaseInertiaRead();File.prototype.text=window.originalInertiaText");await delay(60);assert.equal(await evaluate("document.getElementById('inertia-estimates').hidden"),true);assert.doesNotMatch(await text('inertia-status'),/Opening/);await click('inertia-example');
 });
 await check('reduced-motion setting preserves static data inspection',async()=>{await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await set('inertia-window',4);assert.match(await text('inertia-window-label'),/5 \/ 19/);});
 for(const width of [1440,390])await check('source, balance and coefficient instruments fit '+width+' CSS pixels',async()=>{
   await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await delay(80);
   const dimensions=await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(dimensions.scroll<=dimensions.inner+1,JSON.stringify(dimensions));
   for(const id of ['inertia-lab','inertia-inspection','inertia-estimates']){await evaluate('document.getElementById('+JSON.stringify(id)+').scrollIntoView()');const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(out,id+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 });
 await check('compare an alternate stacked composition on the same actual data',async()=>{
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('.inertia-instruments').style.gridTemplateColumns='1fr';document.getElementById('inertia-inspection').scrollIntoView()");await delay(60);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(out,'concept-stacked-1440.png'),Buffer.from(shot.data,'base64'));await evaluate("document.querySelector('.inertia-instruments').style.gridTemplateColumns=''");
 });
 await check('no page exception or external network request occurred',async()=>{assert.deepEqual(exceptions,[]);assert.deepEqual(outside,[]);});
}finally{
 await writeFile(path.join(out,'receiving.json'),JSON.stringify({checks,exceptions,outside},null,2));
 if(ws)ws.close();for(const p of pending.values())clearTimeout(p.timer);
 chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)return resolve();const t=setTimeout(()=>{chrome.kill('SIGKILL');resolve();},3000);chrome.once('exit',()=>{clearTimeout(t);resolve();});});
 await new Promise(resolve=>server.close(resolve));
 console.log('Receipts: '+out);if(!out.startsWith(dir+path.sep))await rm(dir,{recursive:true,force:true});
}

