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
  await check('actual maintained server exposes the integrated lab and exact executable modules',async()=>{
    const index=await(await fetch(base+'/')).text();assert.match(index,/href="\/coupling.html"/);
    for(const asset of ['/coupling.html','/coupling.css','/src/coupling/science.mjs','/src/science/linear-fit.mjs'])assert.equal((await fetch(base+asset)).status,200);
    assert.match(await text('counts'),/32 initial observations · 0 acquisitions · 25 separate checks/);assert.match(await text('plan-status'),/disagree/);
    assert.match(await evaluate("document.querySelector('#models tr.winner').textContent"),/Independent/);
  });
  await check('two actual acquisition actions preserve a first-probe loss then select reciprocal coupling',async()=>{
    await acquire();assert.match(await text('counts'),/1 acquisitions/);assert.match(await text('comparison'),/0.48293.*0.6545/);
    await acquire();assert.match(await evaluate("document.querySelector('#models tr.winner').textContent"),/Reciprocal/);assert.match(await text('comparison'),/0.00051/);
    assert.equal(await evaluate("document.querySelectorAll('#history li').length"),2);assert.match(await text('history'),/frozen prediction/);
  });
  let saved;
  await check('real browser download retains input evidence and ordered acquisitions',async()=>{
    await click('save');let names=[];for(let i=0;i<60;i++){names=await readdir(downloads);if(names.includes('worldlaw-coupling-notebook.json'))break;await delay(100);}
    assert.ok(names.includes('worldlaw-coupling-notebook.json'),'No completed browser download');saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-coupling-notebook.json'),'utf8'));assert.equal(saved.revisions.length,2);assert.equal(saved.challenges.length,25);assert.ok(!saved.result);assert.ok(!saved.discovery);
  });
  await check('file reopen recomputes the model and never infers a virtual instrument from a source label',async()=>{
    await course('independent');await importValue(saved);await wait("document.getElementById('counts').textContent.includes('2 acquisitions')");assert.match(await evaluate("document.querySelector('#models tr.winner').textContent"),/Reciprocal/);assert.equal(await evaluate("document.getElementById('acquire-virtual').disabled"),true);
  });
  await check('renamed repeated fitting evidence is rejected without replacing valid notebook',async()=>{
    const bad=structuredClone(saved);bad.challenges=[{...structuredClone(bad.training[0]),id:'renamed'}];await importValue(bad);await wait("!document.getElementById('error').hidden");assert.match(await text('error'),/repeats fitting evidence/);assert.match(await text('counts'),/2 acquisitions/);
  });
  await check('declared measured import accepts a separate response and retains source boundaries',async()=>{
    const measured=structuredClone(saved);measured.source={kind:'measured',label:'Browser receiving fixture (authored values)',reference:'User-declared classification test; not physical evidence'};measured.revisions=[];
    await importValue(measured);await wait("document.getElementById('source-kind').textContent.includes('User-declared')");assert.equal(await evaluate("document.getElementById('acquire-virtual').disabled"),true);
    await evaluate("document.getElementById('observation-id').value='received-001';document.getElementById('torque-a').value='1.25';document.getElementById('torque-b').value='.56';document.getElementById('manual-form').requestSubmit()");
    assert.match(await text('counts'),/1 acquisitions/);assert.match(await text('history'),/1.25, 0.56/);assert.match(await text('source-kind'),/User-declared/);
  });
  await check('late file read cannot overwrite a newer experiment or its failure evidence',async()=>{
    await evaluate("window.originalFileText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow.json')return new Promise(resolve=>window.finishSlow=resolve);return originalFileText.call(this)}");
    await importValue(saved,'slow.json');await wait("typeof window.finishSlow==='function'");await course('nonlinear');await evaluate(`window.finishSlow(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=window.originalFileText`);await delay(100);assert.match(await text('plan-status'),/substantial training mismatch/);assert.match(await text('counts'),/0 acquisitions/);
  });
  await check('no-coupling, directional and insufficient-excitation controls are visible in the real consumer',async()=>{
    await course('independent');assert.match(await text('plan-status'),/do not separate/);assert.equal(await evaluate("document.getElementById('use-proposal').disabled"),true);
    await course('directional');await acquire();await acquire();assert.match(await evaluate("document.querySelector('#models tr.winner').textContent"),/Directional/);
    await course('collinear');assert.match(await text('diagnostics'),/rank 4\/6/);assert.match(await text('plan-status'),/pilot state/);await acquire();assert.match(await text('diagnostics'),/rank 6\/6/);
  });
  await course('reciprocal');
  await check('trusted keyboard activation selects the proposed input',async()=>{
    await send('Page.bringToFront');await evaluate("document.getElementById('candidate').value='4';document.getElementById('candidate').dispatchEvent(new Event('change'));document.getElementById('use-proposal').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await evaluate("document.getElementById('candidate').value"),'0');
  });
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
    for(const variant of ['field','gauge']){
      await click(variant+'-view');await evaluate("window.scrollTo({top:0,behavior:'instant'})");
      await check(`${variant} composition has actual vector content and no page overflow at ${width}`,async()=>{
        const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,svg:document.querySelector('#mechanism svg').getBoundingClientRect().width,lines:document.querySelectorAll('#mechanism svg line').length})");assert.ok(d.scroll<=d.width+1,JSON.stringify(d));assert.ok(d.svg>250&&d.lines>10,JSON.stringify(d));
      });
      const clip=await evaluate("(()=>{const r=document.getElementById('apparatus').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`coupling-${variant}-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('reduced-motion preference and no uncaught errors or external requests',async()=>{
    assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);
  });
  await check('maintained scalar Studio still receives its acquisition after the shared fitter extraction',async()=>{
    await send('Page.navigate',{url:base+'/'});await wait("document.getElementById('sample-count')?.textContent==='64'");
    await click('use-proposal');await click('run-experiment');await wait("document.getElementById('sample-count')?.textContent==='65'");
    const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
    assert.ok((await text('selected-equation')).includes('sin')||(await text('selected-equation')).includes('sinus'));
    assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);
  });
  const receipt={checks,pass:true,events,node:process.version};await writeFile(path.join(outputDir,'verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Receiver closing'));}pending.clear();
  try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));
}
