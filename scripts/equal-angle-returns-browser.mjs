import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),output=resolve(process.argv[3]||join(tmpdir(),'worldlaw-cycle-receiving'));await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'worldlaw-cycle-chrome-'));
const downloads=await mkdtemp(join(output,'downloads-'));
const {createProductServer}=await import(pathToFileURL(join(root,'server.mjs')));
const server=createProductServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const chrome=spawn(process.env.CHROME||'google-chrome',['--headless=new','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeLog='';chrome.stderr.on('data',chunk=>{chromeLog+=chunk;});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,label,timeout=15000){const started=Date.now();while(Date.now()-started<timeout){try{const value=await fn();if(value)return value;}catch{}await delay(80);}throw Error(`Timed out: ${label}`);}
let socket;
const exceptions=[],requests=[],checks=[];
try {
  const port=await waitFor(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),'Chrome debugging endpoint');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const waiting=new Map();
  socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id){const pending=waiting.get(message.id);if(pending){waiting.delete(message.id);message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);}}else{if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));return result.result.value;};
  const clickSelector=async selector=>{
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    const point=await waitFor(()=>evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center',behavior:'instant'});const a=e.getBoundingClientRect();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();if(Math.abs(a.left-r.left)>.25||Math.abs(a.top-r.top)>.25||Math.abs(a.width-r.width)>.25||Math.abs(a.height-r.height)>.25)return null;const x=r.left+r.width/2,y=r.top+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))return null;return {x,y};})()`),'stable visible click target '+selector);
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});window.__activationProof=[];for(const type of ['pointerdown','pointerup','click'])e.addEventListener(type,event=>window.__activationProof.push({type:event.type,trusted:event.isTrusted,inside:e.contains(event.target)}),{once:true});})()`);
    await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    const proof=await evaluate('window.__activationProof');for(const type of ['pointerdown','pointerup','click'])assert.ok(proof.some(e=>e.type===type&&e.trusted&&e.inside),'Trusted activation missing '+type+' for '+selector);
  };
  const click=id=>clickSelector('#'+id);
  const set=(id,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
  const ready=()=>waitFor(()=>evaluate("document.getElementById('refit') && !document.getElementById('refit').disabled"),'challenge finished');
  const compared=()=>waitFor(()=>evaluate("!document.getElementById('compare-initial-states').disabled"),'grid finished');
  const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('DOM.enable');
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'chrome://sandbox'});
  const sandboxText=await waitFor(async()=>{const text=await evaluate('document.body.innerText');return text.includes('Seccomp-BPF sandbox supports TSYNC')?text:null;},'sandbox status');
  assert.match(sandboxText,/Layer 1 Sandbox\s+Namespace/i);assert.match(sandboxText,/PID namespaces\s+Yes/i);assert.match(sandboxText,/Network namespaces\s+Yes/i);assert.match(sandboxText,/Seccomp-BPF sandbox\s+Yes/i);assert.match(sandboxText,/Seccomp-BPF sandbox supports TSYNC\s+Yes/i);
  await writeFile(join(output,'sandbox.txt'),sandboxText);checks.push('active namespace and seccomp browser sandbox');
  await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();
  const cycleReady=()=>waitFor(()=>evaluate("!document.getElementById('compare-cycle-work').disabled"),'cycle investigation finished');
  const status=()=>evaluate("document.getElementById('cycle-work-status').textContent");
  async function fileInput(path,id){const {result}=await call('Runtime.evaluate',{expression:`document.getElementById(${JSON.stringify(id)})`,returnByValue:false});assert.ok(result.objectId);try{await call('DOM.setFileInputFiles',{objectId:result.objectId,files:[path]});}finally{await call('Runtime.releaseObject',{objectId:result.objectId});}}
  await check('original torque consumer remains usable; angular cycle instrument is hidden',async()=>{assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),true);assert.ok(await evaluate("document.querySelector('#trajectory-chart svg')!==null"));});
  await set('example-choice','measured','change');await click('load-example');await ready();
  await evaluate("(()=>{const radio=document.querySelector('input[name=method][value=weak]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));})()");await click('refit');await ready();
  assert.match(await evaluate("document.getElementById('method-badge').textContent"),/weak|window/i);
  await clickSelector('#model-list button[data-model-id="gravity+bias"]');
  assert.equal(await evaluate("document.querySelector('#model-list button[data-model-id=\"gravity+bias\"]').getAttribute('aria-pressed')"),'true');
  await check('maintained measured source and frozen restoring law execute cycle work by keyboard',async()=>{
    assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),false);
    await evaluate("document.getElementById('compare-cycle-work').focus()");
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await cycleReady();
    assert.match(await status(),/35\/35 complete cycle pairs admitted/);assert.match(await status(),/no receiving winner selected/);
    assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart circle').length"),35);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),8);
    assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/Nonnegative boundary/);
  });
  let receipt,notebook;
  await check('actual downloaded input notebook recomputes scientific disagreement and reopens',async()=>{
    await click('export-cycle-work');notebook=join(downloads,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(notebook)).size>0;}catch{return false;}},'cycle notebook download');
    receipt=JSON.parse(await readFile(notebook,'utf8'));assert.equal(receipt.result,undefined);
    const {replayCycleWork}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work.mjs'))),r=replayCycleWork(receipt);
    assert.equal(r.fit.admittedCycleCount,35);assert.ok(r.fit.candidates[0].lossRMSE<r.fit.candidates[1].lossRMSE);assert.ok(r.receiving[1].rollout.metrics.positionRMSE>r.receiving[2].rollout.metrics.positionRMSE);assert.equal(r.selected,null);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'cycle notebook replay');
  });
  await check('quadratic opt-in invalidates, executes, downloads v2 and restores by actual file reopen',async()=>{
    await evaluate("document.getElementById('cycle-work-quadratic').focus()");
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
    assert.equal(await evaluate("document.getElementById('cycle-work-quadratic').checked"),true);
    assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await click('compare-cycle-work');await cycleReady();
    assert.match(await status(),/All 4 candidate families retained/);
    assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),10);
    assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/Quadratic · 1\/rad/);
    const quadraticDownloads=await mkdtemp(join(output,'quadratic-downloads-'));
    await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:quadraticDownloads});await click('export-cycle-work');
    const saved=join(quadraticDownloads,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(saved)).size>0;}catch{return false;}},'quadratic notebook download');
    const input=JSON.parse(await readFile(saved,'utf8'));assert.equal(input.schema,'worldlaw.cycle-work-inputs/v2');assert.equal(input.options.includeQuadratic,true);assert.equal(input.result,undefined);
    const {replayCycleWork}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work.mjs')));const compared=replayCycleWork(input);assert.equal(compared.fit.candidates.length,4);assert.equal(compared.receiving.length,5);
    await click('cycle-work-quadratic');assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await fileInput(saved,'cycle-work-file');await waitFor(async()=>/All 4 candidate families retained/.test(await status()),'quadratic file replay');assert.equal(await evaluate("document.getElementById('cycle-work-quadratic').checked"),true);
    for(const width of [1440,390]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('cycle-work-panel').scrollIntoView({block:'start',behavior:'instant'})");await delay(150);const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'quadratic-'+width+'.png'),Buffer.from(png.data,'base64'));assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));if(width===390){await evaluate("document.getElementById('cycle-work-chart').scrollIntoView({block:'start',behavior:'instant'})");const chart=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'quadratic-chart-390.png'),Buffer.from(chart.data,'base64'));}}
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/All 3 candidate families retained/.test(await status()),'original v1 restored');assert.equal(await evaluate("document.getElementById('cycle-work-quadratic').checked"),false);
  });
  await check('mixed loss admission compares and reopens actual v3 inputs without replacing older populations',async()=>{
    await evaluate("document.getElementById('cycle-work-mixed').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
    assert.equal(await evaluate("document.getElementById('cycle-work-mixed').checked && document.getElementById('cycle-work-quadratic').checked"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await click('compare-cycle-work');await cycleReady();assert.match(await status(),/All 5 candidate families retained/);assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/viscous-quadratic/);
    const mixedDownloads=await mkdtemp(join(output,'mixed-downloads-'));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:mixedDownloads});await click('export-cycle-work');const saved=join(mixedDownloads,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(saved)).size>0;}catch{return false;}},'v3 download');
    const input=JSON.parse(await readFile(saved,'utf8'));assert.equal(input.schema,'worldlaw.cycle-work-inputs/v3');assert.equal(input.options.includeMixedQuadratic,true);assert.equal(input.options.includeQuadratic,true);const {replayCycleWork}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work.mjs')));const report=replayCycleWork(input);assert.equal(report.fit.candidates.length,5);assert.equal(report.receiving.length,6);assert.equal(report.selected,null);
    await click('cycle-work-mixed');assert.equal(await evaluate("document.getElementById('cycle-work-quadratic').checked"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);await click('compare-cycle-work');await cycleReady();assert.match(await status(),/All 4 candidate families retained/);
    const qDownloads=await mkdtemp(join(output,'v2-downloads-'));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:qDownloads});await click('export-cycle-work');const qFile=join(qDownloads,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(qFile)).size>0;}catch{return false;}},'v2 download');assert.equal(JSON.parse(await readFile(qFile,'utf8')).schema,'worldlaw.cycle-work-inputs/v2');
    await fileInput(saved,'cycle-work-file');await waitFor(async()=>/All 5 candidate families retained/.test(await status()),'v3 reopen');assert.equal(await evaluate("document.getElementById('cycle-work-mixed').checked"),true);
    for(const width of [1440,390]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('cycle-work-panel').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);assert.ok(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"));const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'mixed-'+width+'.png'),Buffer.from(image.data,'base64'));
      if(width===390){await evaluate("document.getElementById('cycle-work-chart').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);const chart=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'mixed-chart-390.png'),Buffer.from(chart.data,'base64'));}
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await click('cycle-work-quadratic');assert.equal(await evaluate("document.getElementById('cycle-work-mixed').checked"),false);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await fileInput(qFile,'cycle-work-file');await waitFor(async()=>/All 4 candidate families retained/.test(await status()),'v2 reopen');assert.equal(await evaluate("document.getElementById('cycle-work-mixed').checked"),false);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/All 3 candidate families retained/.test(await status()),'v1 reopen');assert.equal(await evaluate("document.getElementById('cycle-work-quadratic').checked || document.getElementById('cycle-work-mixed').checked"),false);
  });
  let halvesPath,halvesSource,halvesReport;
  const receivingChecks={numericValues:0,plottedPositions:0,keyboard:null};
  const halvesReady=()=>waitFor(()=>evaluate("!document.getElementById('inspect-cycle-work-halves').disabled && !document.getElementById('export-cycle-work-halves').hidden"),'observed half-cycle inspection');
  async function downloadCycle(button,name,prefix){const dir=await mkdtemp(join(output,prefix));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await click(button);const path=join(dir,name);await waitFor(async()=>{try{return(await stat(path)).size>0;}catch{return false;}},name+' download');return path;}
  await check('measured frozen halves by keyboard preserve original export and scientific disagreement',async()=>{
    await click('cycle-work-mixed');await click('compare-cycle-work');await cycleReady();
    const before=JSON.parse(await readFile(await downloadCycle('export-cycle-work','worldlaw-cycle-work.json','halves-before-'),'utf8'));
    await evaluate("document.getElementById('inspect-cycle-work-halves').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await halvesReady();
    halvesPath=await downloadCycle('export-cycle-work-halves','worldlaw-cycle-work-halves.json','halves-source-');halvesSource=JSON.parse(await readFile(halvesPath,'utf8'));assert.equal(halvesSource.schema,'worldlaw.cycle-work-halves/v1');assert.deepEqual(Object.keys(halvesSource).sort(),['cycleWork','schema']);assert.deepEqual(halvesSource.cycleWork,before);
    const {replayHalfCycleWork}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work.mjs')));halvesReport=replayHalfCycleWork(halvesSource);assert.equal(halvesReport.selected,null);
    const count=halvesReport.records.reduce((n,r)=>n+r.cycles.length,0);assert.equal(count,17);assert.equal(halvesReport.comparisons.length,count*6);
    const r=halvesReport.investigation;assert.ok(r.fit.candidates.find(x=>x.id==='viscous-quadratic').lossRMSE<r.fit.candidates.find(x=>x.id==='quadratic').lossRMSE);assert.ok(r.receiving.find(x=>x.candidateId==='viscous-quadratic').rollout.metrics.positionRMSE>r.receiving.find(x=>x.candidateId==='viscous').rollout.metrics.positionRMSE);
    assert.deepEqual(JSON.parse(await readFile(await downloadCycle('export-cycle-work','worldlaw-cycle-work.json','halves-after-'),'utf8')),before);
    await writeFile(join(output,'halves-observed-receipt.json'),JSON.stringify({source:halvesSource,records:halvesReport.records,comparisons:halvesReport.comparisons,work:halvesReport.work},null,2));
  });
  await check('wrapper reopens in fresh document with exact observed values and plotted positions',async()=>{
    await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(halvesPath,'cycle-work-file');await halvesReady();assert.match(await status(),/All 5 candidate families retained/);
    const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';
    for(const record of halvesReport.records){
      await set('cycle-work-halves-run',record.runId,'change');assert.equal(await evaluate("document.querySelectorAll('#cycle-work-halves-cycle option').length"),record.cycles.length);
      const source=halvesReport.investigation.inputs.bundle.challengeRuns.find(r=>r.id===record.runId);
      for(const cycle of record.cycles){
        await set('cycle-work-halves-cycle',cycle.cycleIndex,'change');
        const rows=halvesReport.comparisons.filter(x=>x.runId===record.runId&&x.cycleIndex===cycle.cycleIndex);
        const expected=rows.flatMap(r=>r.status==='compared'?r.halves.map(h=>[r.candidateId,h.direction,fmt(h.observedLoss),fmt(h.predictedLoss),fmt(h.residual),fmt(r.residualSum)]):[[r.candidateId,r.reason,'—','—','—','—']]);
        const actual=await evaluate("[...document.querySelectorAll('#cycle-work-halves-output tbody tr')].map(r=>[...r.cells].map(c=>c.textContent))");assert.deepEqual(actual,expected);receivingChecks.numericValues+=rows.filter(r=>r.status==='compared').length*8;
        const trace=await evaluate("(()=>{const s=document.querySelector('#cycle-work-halves-trace svg');return {points:[...s.querySelector('polyline').points].map(p=>[p.x,p.y]),markers:s.querySelectorAll('circle').length,bands:s.querySelectorAll('rect').length,title:s.querySelector('title').textContent};})()");
        const samples=source.samples.slice(cycle.first,cycle.last+1),first=samples[0],last=samples.at(-1),low=Math.min(...samples.map(p=>p.position)),high=Math.max(...samples.map(p=>p.position));
        assert.equal(trace.points.length,samples.length);assert.equal(trace.markers,cycle.halfStatus==='compared'?3:2);assert.equal(trace.bands,cycle.halfStatus==='compared'?2:0);assert.ok(trace.title.includes(record.runId));
        for(let i=0;i<samples.length;i++){const x=48+294*(samples[i].time-first.time)/(last.time-first.time),y=178-140*(samples[i].position-low)/Math.max(1e-12,high-low);assert.ok(Math.abs(trace.points[i][0]-x)<.0001);assert.ok(Math.abs(trace.points[i][1]-y)<.0001);receivingChecks.plottedPositions++;}
      }
    }
    assert.equal(receivingChecks.numericValues,816);assert.equal(receivingChecks.plottedPositions,1800);
    const forged=join(output,'halves-forged-derived.json');await writeFile(forged,JSON.stringify({...halvesSource,comparisons:[{candidateId:'forged'}]}));await fileInput(forged,'cycle-work-file');await halvesReady();assert.equal(await evaluate("document.getElementById('cycle-work-halves-output').textContent.includes('forged')"),false);
  });
  let sensitivityPath,sensitivitySource,sensitivityReport;
  const sensitivityReady=()=>waitFor(()=>evaluate("!document.getElementById('export-half-sensitivity').hidden"),'sensitivity source export ready');
  await check('frozen numerical windows retain populations and match native selected residuals',async()=>{
    await set('cycle-work-halves-cycle',0,'change');
    const oldLedger=await evaluate("document.getElementById('cycle-work-halves-output').textContent");
    assert.equal(await evaluate("document.getElementById('half-sensitivity-windows').value"),'5, 9, 17, 31');
    await click('inspect-half-sensitivity');await sensitivityReady();assert.equal(await evaluate("document.querySelectorAll('#half-sensitivity-results>section').length"),4);assert.equal(await evaluate("document.getElementById('half-sensitivity-results').textContent.includes('REFUSED')"),false);
    await set('half-sensitivity-windows','5, 9, 17, 31, 33');assert.equal(await evaluate("document.getElementById('export-half-sensitivity').hidden"),true);await click('inspect-half-sensitivity');await sensitivityReady();
    sensitivityPath=await downloadCycle('export-half-sensitivity','worldlaw-half-cycle-sensitivity.json','sensitivity-source-');sensitivitySource=JSON.parse(await readFile(sensitivityPath,'utf8'));
    assert.deepEqual(Object.keys(sensitivitySource).sort(),['cycleWork','options','schema']);assert.deepEqual(sensitivitySource.cycleWork,halvesSource.cycleWork);
    const {replayHalfCycleSensitivity}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work-half-sensitivity.mjs')));sensitivityReport=replayHalfCycleSensitivity(sensitivitySource);
    const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';let checked=0;
    for(const id of ['restoring-only',...sensitivityReport.original.investigation.fit.candidates.map(x=>x.id)]){
      await set('half-sensitivity-family',id,'change');
      const cards=await evaluate("[...document.querySelectorAll('#half-sensitivity-results>section')].map(x=>x.textContent)");assert.equal(cards.length,5);
      for(let i=0;i<cards.length;i++){const v=sensitivityReport.variants[i],row=v.comparisons.find(x=>x.cycleIndex===0&&x.candidateId===id);assert.equal(v.comparisons.length,102);if(row.status==='compared'){for(const h of row.halves){for(const n of [h.observedLoss,h.predictedLoss,h.residual]){assert.ok(cards[i].includes(fmt(n)));checked++;}}assert.ok(cards[i].includes(fmt(row.residualSum)));}else assert.ok(cards[i].includes(row.reason));}
    }
    assert.equal(checked,144);assert.equal(await evaluate("document.getElementById('cycle-work-halves-output').textContent"),oldLedger);
    assert.match(await evaluate("document.querySelector('#cycle-work-half-sensitivity details').textContent"),/102 refused/);
    await writeFile(join(output,'sensitivity-observed-receipt.json'),JSON.stringify({source:sensitivitySource,work:sensitivityReport.work,comparisons:sensitivityReport.variants.map(v=>({window:v.windowSize,comparisons:v.comparisons})),checkedDisplayedValues:checked},null,2));
  });
  await check('sensitivity source reopens fresh and declarations invalidate old results',async()=>{
    await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(sensitivityPath,'cycle-work-file');await sensitivityReady();
    assert.equal(await evaluate("document.querySelectorAll('#half-sensitivity-results>section').length"),5);
    assert.deepEqual(JSON.parse(await readFile(await downloadCycle('export-half-sensitivity','worldlaw-half-cycle-sensitivity.json','sensitivity-reopened-'),'utf8')),sensitivitySource);
    await set('half-sensitivity-windows','9, 33');assert.equal(await evaluate("document.getElementById('export-half-sensitivity').hidden"),true);assert.equal(await evaluate("document.querySelectorAll('#half-sensitivity-results>section').length"),0);
    await click('inspect-half-sensitivity');await sensitivityReady();assert.equal(await evaluate("document.querySelectorAll('#half-sensitivity-results>section').length"),2);
    const low=join(output,'sensitivity-zero-budget.json');await writeFile(low,JSON.stringify({...sensitivitySource,options:{windows:[9,33],maximumEach:0}}));await fileInput(low,'cycle-work-file');await sensitivityReady();assert.equal(await evaluate("[...document.querySelectorAll('#half-sensitivity-results>section')].every(x=>x.textContent.includes('REFUSED'))"),true);
    await set('cycle-work-crossing','.1');assert.equal(await evaluate("document.getElementById('cycle-work-half-sensitivity').hidden"),true);await fileInput(sensitivityPath,'cycle-work-file');await sensitivityReady();
  });
  await check('sensitivity cards support narrow layout and keyboard family selection',async()=>{
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('cycle-work-half-sensitivity').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));
      if(width===390){await evaluate("document.getElementById('half-sensitivity-family').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});assert.equal(await evaluate("document.getElementById('half-sensitivity-family').value"),'viscous');}
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'sensitivity-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  });
  let returnPath,returnSource,returnReport;
  const returnReady=()=>waitFor(()=>evaluate("!document.getElementById('export-equal-angle-returns').hidden"),'equal-coordinate source export');
  await check('original equal-coordinate returns preserve every level and frozen calculation',async()=>{
    await fileInput(halvesPath,'cycle-work-file');await halvesReady();await evaluate("document.getElementById('inspect-equal-angle-returns').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await returnReady();
    returnPath=await downloadCycle('export-equal-angle-returns','worldlaw-equal-angle-returns.json','return-source-');returnSource=JSON.parse(await readFile(returnPath,'utf8'));assert.deepEqual(Object.keys(returnSource).sort(),['cycleWork','options','schema']);assert.deepEqual(returnSource.cycleWork,halvesSource.cycleWork);
    const {replayEqualAngleReturns}=await import(pathToFileURL(join(root,'src/trajectory/equal-angle-returns.mjs')));returnReport=replayEqualAngleReturns(returnSource);assert.equal(returnReport.rows.length,123);assert.equal(returnReport.rows.filter(x=>x.kineticLoss<0).length,49);
    let displayed=0,markers=0;const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';
    for(let index=0;index<returnReport.rows.length;index++){
      const row=returnReport.rows[index];await set('cycle-work-halves-run',row.runId,'change');await set('cycle-work-halves-cycle',row.cycleIndex,'change');await set('equal-angle-level',index,'change');
      const actual=await evaluate("[...document.querySelectorAll('#equal-angle-output tbody tr')].map(r=>[...r.cells].map(c=>c.textContent))");assert.deepEqual(actual,row.comparisons.map(x=>x.status==='compared'?[x.candidateId,fmt(x.predictedLoss),fmt(x.residual)]:[x.candidateId,'REFUSED · '+x.reason]));displayed+=row.comparisons.filter(x=>x.status==='compared').length*2;
      const text=await evaluate("document.getElementById('equal-angle-output').textContent");for(const v of [row.firstRate,row.lastRate,row.kineticLoss]){assert.ok(text.includes(fmt(v)));displayed++;}
      const trace=await evaluate("(()=>{const e=document.querySelector('#cycle-work-halves-trace svg');return {points:[...e.querySelectorAll('[data-return-marker]')].map(p=>[Number(p.getAttribute('cx')),Number(p.getAttribute('cy'))]),chord:[...['x1','x2','y1','y2']].map(k=>Number(e.querySelector('[data-return-chord]').getAttribute(k)))};})()");assert.equal(trace.points.length,2);
      const samples=returnReport.original.investigation.inputs.bundle.challengeRuns.find(r=>r.id===row.runId).samples,c=returnReport.original.records.find(r=>r.runId===row.runId).cycles.find(c=>c.cycleIndex===row.cycleIndex),part=samples.slice(c.first,c.last+1),first=part[0],last=part.at(-1),low=Math.min(...part.map(s=>s.position)),high=Math.max(...part.map(s=>s.position)),x=t=>48+294*(t-first.time)/(last.time-first.time),y=q=>178-140*(q-low)/Math.max(1e-12,high-low);
      for(const [j,i] of [row.first,row.last].entries()){assert.ok(Math.abs(trace.points[j][0]-x(samples[i].time))<1e-6);assert.ok(Math.abs(trace.points[j][1]-y(samples[i].position))<1e-6);markers++;}assert.equal(trace.chord[2],trace.chord[3]);
    }
    assert.equal(displayed,1845);assert.equal(markers,246);await writeFile(join(output,'equal-angle-observed-receipt.json'),JSON.stringify({source:returnSource,rows:returnReport.rows,work:returnReport.work,displayed,markers},null,2));
  });
  await check('return source reopens fresh; full refusal retains source and no invented markers',async()=>{
    await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(returnPath,'cycle-work-file');await returnReady();assert.match(await evaluate("document.getElementById('equal-angle-status').textContent"),/123 compared.*49/);
    assert.deepEqual(JSON.parse(await readFile(await downloadCycle('export-equal-angle-returns','worldlaw-equal-angle-returns.json','return-reopen-'),'utf8')),returnSource);
    const budget=join(output,'return-zero-budget.json');await writeFile(budget,JSON.stringify({...returnSource,options:{maximumEach:0}}));await fileInput(budget,'cycle-work-file');await returnReady();assert.match(await evaluate("document.getElementById('equal-angle-output').textContent"),/REFUSED/);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-halves-trace [data-return-marker]').length"),0);
    await fileInput(returnPath,'cycle-work-file');await returnReady();await set('cycle-work-crossing','.2');assert.equal(await evaluate("document.getElementById('equal-angle-returns').hidden"),true);await fileInput(returnPath,'cycle-work-file');await returnReady();
  });
  await check('matched original passages and conditional ledger received desktop narrow and keyboard',async()=>{
    await set('cycle-work-halves-cycle',4,'change');const index=returnReport.rows.findIndex(r=>r.cycleIndex===4&&r.position===-.657);assert.ok(index>=0);await set('equal-angle-level',index,'change');
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await click('locate-equal-angle');assert.equal(await evaluate("document.activeElement.id"),'cycle-work-halves-trace');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));
      const trace=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'return-trace-'+width+'.png'),Buffer.from(trace.data,'base64'));
      await evaluate("document.getElementById('equal-angle-returns').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);const panel=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'return-ledger-'+width+'.png'),Buffer.from(panel.data,'base64'));
      if(width===390){await evaluate("document.getElementById('equal-angle-level').focus()");const before=await evaluate("document.getElementById('equal-angle-level').value");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});assert.notEqual(await evaluate("document.getElementById('equal-angle-level').value"),before);}
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  });
  await check('pending return input cannot resurrect after a newer declaration',async()=>{
    const delayed=join(output,'delayed-returns.json');await writeFile(delayed,JSON.stringify(returnSource));await evaluate("(()=>{window.__oldReturnText=File.prototype.text;window.__returnStarted=false;File.prototype.text=async function(){const text=await window.__oldReturnText.call(this);if(this.name==='delayed-returns.json'){window.__returnStarted=true;await new Promise(resolve=>window.__returnRelease=resolve);}return text;};})()");await fileInput(delayed,'cycle-work-file');await waitFor(()=>evaluate('window.__returnStarted'),'pending returnread');await set('cycle-work-window',11);await evaluate('File.prototype.text=window.__oldReturnText;window.__returnRelease()');await delay(200);assert.equal(await evaluate("document.getElementById('equal-angle-returns').hidden"),true);await fileInput(halvesPath,'cycle-work-file');await halvesReady();
  });
  await check('half-cycle declarations and delayed source cannot restore stale inspection',async()=>{
    await set('cycle-work-crossing','.2');assert.equal(await evaluate("document.getElementById('cycle-work-halves').hidden"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work-halves').hidden"),true);
    const delayed=join(output,'delayed-halves.json');await writeFile(delayed,JSON.stringify(halvesSource));
    await evaluate("(()=>{window.__oldHalfText=File.prototype.text;window.__halfReadStarted=false;File.prototype.text=async function(){const text=await window.__oldHalfText.call(this);if(this.name==='delayed-halves.json'){window.__halfReadStarted=true;await new Promise(resolve=>window.__halfRelease=resolve);}return text;};})()");
    await fileInput(delayed,'cycle-work-file');await waitFor(()=>evaluate('window.__halfReadStarted'),'pending half read');await set('cycle-work-window',11);await evaluate('File.prototype.text=window.__oldHalfText;window.__halfRelease()');await delay(250);
    assert.equal(Number(await evaluate("document.getElementById('cycle-work-window').value")),11);assert.equal(await evaluate("document.getElementById('cycle-work-halves').hidden"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await fileInput(halvesPath,'cycle-work-file');await halvesReady();await set('example-choice','pendulum','change');await click('load-example');await ready();assert.equal(await evaluate("document.getElementById('cycle-work-halves').hidden"),true);
    await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(halvesPath,'cycle-work-file');await halvesReady();
  });
  await check('observed trace and signed ledger support desktop narrow and actual keyboard scrolling',async()=>{
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate("document.getElementById('cycle-work-halves').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'));assert.match(await evaluate("document.getElementById('cycle-work-halves-output').textContent"),/Residual/);
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'halves-'+width+'.png'),Buffer.from(shot.data,'base64'));
      if(width===390){
        const start=await evaluate("(()=>{const e=document.getElementById('cycle-work-halves-output');e.scrollLeft=0;e.focus();return {overflow:e.scrollWidth>e.clientWidth,position:e.scrollLeft,focused:document.activeElement===e};})()");assert.ok(start.focused);assert.ok(start.overflow);
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
        const after=await waitFor(()=>evaluate("document.getElementById('cycle-work-halves-output').scrollLeft"),'keyboard horizontal movement');assert.ok(after>start.position);receivingChecks.keyboard={...start,after};
        await evaluate("document.getElementById('cycle-work-halves-output').scrollIntoView({block:'start',behavior:'instant'})");
        for(let key=1;key<12;key++){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await delay(70);}
        await waitFor(()=>evaluate("(()=>{const e=document.getElementById('cycle-work-halves-output');return e.scrollLeft>=e.scrollWidth-e.clientWidth-1;})()"),'12 ArrowRight keys reach ledger end');receivingChecks.keyboard.keys=12;
        await delay(100);
        const sticky=await evaluate("(()=>{const e=document.getElementById('cycle-work-halves-output'),r=e.getBoundingClientRect(),c=e.querySelector('tbody th[scope=row]'),b=c.getBoundingClientRect(),summary=document.getElementById('cycle-work-halves-selected-summary');return {scroll:e.scrollLeft,position:getComputedStyle(c).position,left:b.left,width:b.width,containerLeft:r.left,containerRight:r.right,label:c.textContent,summaryOutside:!e.contains(summary),hintVisible:document.getElementById('cycle-work-halves-scroll-hint').getClientRects().length>0,columns:[...e.querySelectorAll('tr')].flatMap(row=>[4,5].map(index=>{const cell=row.cells[index],box=cell.getBoundingClientRect();return {index,left:box.left,right:box.right,width:box.width,text:cell.textContent};}))};})()");
        assert.ok(sticky.scroll>0);assert.equal(sticky.position,'sticky');assert.ok(Math.abs(sticky.left-sticky.containerLeft)<2);assert.ok(sticky.left+sticky.width<=sticky.containerRight+1);assert.ok(sticky.label.length>0);assert.equal(sticky.summaryOutside,true);assert.equal(sticky.hintVisible,true);assert.ok(sticky.width>0&&sticky.width<sticky.containerRight-sticky.containerLeft);for(const cell of sticky.columns){assert.ok(cell.width>0);assert.ok(cell.left>=sticky.left+sticky.width-1,JSON.stringify({failure:'residual cell obscured by sticky law',sticky,cell}));assert.ok(cell.right<=sticky.containerRight+1,JSON.stringify({failure:'residual cell clipped at right edge',sticky,cell}));}receivingChecks.sticky=sticky;
        const table=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(output,'halves-table-390.png'),Buffer.from(table.data,'base64'));
      }
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/All 3 candidate families retained/.test(await status()),'original v1 after halves');assert.equal(await evaluate("document.getElementById('export-cycle-work-halves').hidden"),true);
  });

  await check('invalid declarations clear stale claims; source replacement invalidates exported result',async()=>{
    await set('cycle-work-window',4);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),0);await click('compare-cycle-work');await cycleReady();assert.match(await status(),/odd derivative window/);
    await set('cycle-work-window',9);await click('compare-cycle-work');await cycleReady();
    await set('example-choice','pendulum','change');await click('load-example');await ready();assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'reopen independent source inputs');
  });
  await check('delayed imported notebook cannot overwrite a newer declaration',async()=>{
    const delayed=join(output,'delayed-cycle.json');await writeFile(delayed,JSON.stringify(receipt));
    await evaluate(`(()=>{window.__oldText=File.prototype.text;window.__readStarted=false;File.prototype.text=async function(){const text=await window.__oldText.call(this);if(this.name==='delayed-cycle.json'){window.__readStarted=true;await new Promise(resolve=>window.__release=resolve);}return text;};})()`);
    await fileInput(delayed,'cycle-work-file');await waitFor(()=>evaluate('window.__readStarted'),'pending cycle read');await set('cycle-work-crossing','.2');await evaluate('File.prototype.text=window.__oldText;window.__release()');await delay(250);
    assert.equal(Number(await evaluate("document.getElementById('cycle-work-crossing').value")),.2);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),0);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'restore final cycle notebook');
  });
  await check('reopened refusal budget survives unchanged recompute and export',async()=>{
    const low=structuredClone(receipt);low.options.maxSteps=1;const input=join(output,'low-budget-cycle.json');await writeFile(input,JSON.stringify(low));
    await fileInput(input,'cycle-work-file');await waitFor(()=>evaluate("document.getElementById('cycle-work-panel').textContent.includes('budget 1.')"),'imported budget refusal');
    await click('compare-cycle-work');await cycleReady();assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/budget 1\./);
    const fresh=await mkdtemp(join(output,'budget-download-'));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fresh});await click('export-cycle-work');const saved=join(fresh,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(saved)).size>0;}catch{return false;}},'retained budget export');assert.equal(JSON.parse(await readFile(saved,'utf8')).options.maxSteps,1);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'restore full-budget study');
  });
  await check('desktop and390px instrument stays in viewport and produces actual screenshots',async()=>{
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
      const bounds=await evaluate(`(()=>{const p=document.getElementById('cycle-work-panel'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,overflow:[...p.querySelectorAll('input,button,svg')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(r=>r.left< -1||r.right>innerWidth+1)};})()`);
      assert.ok(bounds.left>=-1&&bounds.right<=width+1,JSON.stringify(bounds));assert.deepEqual(bounds.overflow,[]);
      await evaluate("document.getElementById('cycle-work-panel').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`cycle-work-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  });
  await check('no page exceptions or external network requests',async()=>{assert.deepEqual(exceptions,[]);assert.deepEqual(requests.filter(url=>!url.startsWith(origin+'/')&&!url.startsWith('blob:')&&!url.startsWith('data:')&&!url.startsWith('chrome://sandbox')&&!url.startsWith('chrome://resources/')),[]);});
  await writeFile(join(output,'browser-receipt.json'),JSON.stringify({checks,receivingChecks,exceptions,requests,inputSchema:receipt.schema,screenshots:['halves-1440.png','halves-390.png','halves-table-390.png','cycle-work-1440.png','cycle-work-390.png','quadratic-1440.png','quadratic-390.png','mixed-1440.png','mixed-390.png','mixed-chart-390.png']},null,2));console.log(JSON.stringify({passed:checks.length,output}));
}catch(error){await writeFile(join(output,'browser-failure.json'),JSON.stringify({checks,error:String(error),exceptions,chromeLog},null,2));throw error;}
finally{socket?.close();chrome.kill('SIGTERM');server.close();}

