import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,origin=base+'/coupling.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-coupling-chrome-'));
const outputDir=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'receipts');
await mkdir(outputDir,{recursive:true});const downloads=path.join(dir,'downloads');await mkdir(downloads);
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1050',origin],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]},checks=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let port;
  for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}}
  assert.ok(port,'Chrome did not expose its supported debugger endpoint.');
  let target;
  for(let i=0;i<60;i++){target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page'&&t.url===origin);if(target)break;await delay(100);}
  assert.ok(target,'Coupling Lab browser target absent.');ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}}
    if(v.method==='Runtime.exceptionThrown')events.exceptions.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);
    if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(base)&&!v.params.request.url.startsWith('blob:'+base))events.outside.push(v.params.request.url);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Debugger timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async predicate=>{for(let i=0;i<100;i++){if(await evaluate(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate);};
  const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS '+name);};
  const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const text=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const importValue=async(value,name='evidence.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById('notebook-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
  const course=async kind=>{await evaluate(`document.getElementById('course').value=${JSON.stringify(kind)}`);await click('restart');};
  const acquire=async()=>{await click('use-proposal');await click('acquire-virtual');};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await send('Page.reload');
  await wait("document.querySelectorAll('#models tr').length===3");
  const importMotion=async(value,name='motion-inputs.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById('motion-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
  const change=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const declare=async()=>evaluate("document.getElementById('motion-declared').checked=true;document.getElementById('motion-declared').dispatchEvent(new Event('input',{bubbles:true}))");
  const run=async()=>evaluate("document.getElementById('motion-form').requestSubmit()");
  const paths=()=>evaluate("[...document.querySelectorAll('#motion-plot path')].map(x=>x.getAttribute('d'))");
  await check('coupled dynamics enters through the maintained lab and explicit declaration',async()=>{
    assert.equal((await fetch(base+'/src/coupling/dynamics.mjs')).status,200);
    assert.equal(await evaluate("document.querySelectorAll('#motion-rows tr').length"),0);
    await run();assert.match(await text('motion-error'),/Declare the dynamic interpretation/);
    assert.equal(await evaluate("document.querySelectorAll('#motion-plot svg').length"),0);
    await declare();await run();assert.equal(await evaluate("document.querySelectorAll('#motion-rows tr[data-motion-status=screened]').length"),3);
    assert.equal((await paths()).length,3);assert.match(await text('motion-status'),/conditional simulations, not measured motion/);
  });
  let firstPaths=await paths();
  await check('real initial-state edits clear stale motion and change computed paths',async()=>{
    await change('motion-position-0',.25);assert.equal(await evaluate("document.querySelectorAll('#motion-plot svg').length"),0);
    assert.match(await text('motion-status'),/Inputs changed/);await run();assert.notDeepEqual(await paths(),firstPaths);
    assert.match(await text('motion-rows'),/Leaves observed range/);
  });
  await check('invalid inertia clears the trajectory and preserves source evidence',async()=>{
    const counts=await text('counts');await change('motion-inertia-0',0);await run();
    assert.match(await text('motion-error'),/inertia/);assert.equal(await evaluate("document.querySelectorAll('#motion-plot svg').length"),0);assert.equal(await text('counts'),counts);
    await change('motion-inertia-0',1);await run();
  });
  await check('a source acquisition invalidates old motion and requires its interpretation again',async()=>{
    await acquire();assert.match(await text('counts'),/1 acquisitions/);
    assert.equal(await evaluate("document.querySelectorAll('#motion-plot svg').length"),0);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);
    await declare();await run();assert.equal((await paths()).length,3);
  });
  await check('trusted keyboard activation runs the actual declaration form',async()=>{
    await change('motion-position-1',.2);await send('Page.bringToFront');await evaluate("document.getElementById('motion-run').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal((await paths()).length,3);
  });
  let saved,expectedPaths=await paths();
  await check('actual download contains evidence and declarations, without stored models or forecasts',async()=>{
    await click('motion-save');let names=[];
    for(let i=0;i<60;i++){names=await readdir(downloads);if(names.includes('worldlaw-coupled-motion.json'))break;await delay(100);}
    assert.ok(names.includes('worldlaw-coupled-motion.json'));saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-coupled-motion.json'),'utf8'));
    assert.deepEqual(Object.keys(saved).sort(),['evidence','inputs','schema']);assert.equal(saved.evidence.revisions.length,1);assert.equal(saved.inputs.initialPosition[1],.2);
  });
  await check('reopening motion inputs restores declarations and recomputes the identical predictions',async()=>{
    await course('independent');await importMotion(saved);await wait("document.querySelectorAll('#motion-plot path').length===3");
    assert.deepEqual(await paths(),expectedPaths);assert.equal(await evaluate("document.getElementById('acquire-virtual').disabled"),true);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),true);
  });
  await check('changed held-aside checks do not change the motion and invalid motion input preserves the good source',async()=>{
    const changed=structuredClone(saved);changed.evidence.challenges=changed.evidence.challenges.map((r,i)=>({...r,torque:[5000+i,-5000-i]}));
    await importMotion(changed);await wait("document.querySelectorAll('#motion-plot path').length===3");assert.deepEqual(await paths(),expectedPaths);
    const bad=structuredClone(changed);bad.result={claimed:'passed'};await importMotion(bad);await wait("!document.getElementById('motion-error').hidden");
    assert.match(await text('motion-error'),/unknown fields/);assert.deepEqual(await paths(),expectedPaths);assert.match(await text('counts'),/1 acquisitions/);
  });
  await check('a late input file cannot overwrite a newer source or current predictions',async()=>{
    await evaluate("window.originalFileText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-motion.json')return new Promise(resolve=>window.finishSlowMotion=resolve);return originalFileText.call(this)}");
    await importMotion(saved,'slow-motion.json');await wait("typeof window.finishSlowMotion==='function'");await course('nonlinear');
    await evaluate(`window.finishSlowMotion(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=window.originalFileText`);await delay(100);
    assert.match(await text('plan-status'),/substantial training mismatch/);assert.equal(await evaluate("document.querySelectorAll('#motion-plot svg').length"),0);
    await declare();await run();assert.match(await text('motion-status'),/substantial training mismatch/);
  });
  await check('time inspection and explicit playback move computed sample markers',async()=>{
    await importMotion(saved);await wait("document.querySelectorAll('#motion-plot path').length===3");
    await evaluate("document.getElementById('motion-frame').value='120';document.getElementById('motion-frame').dispatchEvent(new Event('input'))");
    assert.equal(await text('motion-time'),'2 s');await click('motion-play');await delay(200);await click('motion-play');
    assert.ok(Number(await evaluate("document.getElementById('motion-frame').value"))>120);assert.equal(await text('motion-play'),'Play');
  });
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
    for(const variant of ['phase','traces']){
      await click('motion-'+variant);
      await check(`${variant} comparison renders real paths without page overflow at ${width}`,async()=>{
        const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,paths:document.querySelectorAll('#motion-plot path').length,plot:document.querySelector('#motion-plot svg').getBoundingClientRect().width})");
        assert.ok(d.scroll<=d.width+1,JSON.stringify(d));assert.equal(d.paths,variant==='phase'?3:6);assert.ok(d.plot>300,JSON.stringify(d));
      });
      const clip=await evaluate("(()=>{const r=document.getElementById('coupled-dynamics').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`coupled-motion-${variant}-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('reduced motion stops playback while time inspection remains available',async()=>{
    await delay(100);assert.equal(await evaluate("document.getElementById('motion-play').disabled"),true);
    await evaluate("document.getElementById('motion-frame').value='60';document.getElementById('motion-frame').dispatchEvent(new Event('input'))");
    assert.equal(await text('motion-time'),'1 s');assert.match(await text('motion-plot-note'),/Reduced motion/);
  });
  await check('no uncaught errors or external requests were introduced',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
  const receipt={checks,pass:true,events,node:process.version};await writeFile(path.join(outputDir,'verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Receiver closing'));}pending.clear();
  try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));
}
