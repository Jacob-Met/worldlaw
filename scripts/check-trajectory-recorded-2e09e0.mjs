import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const root=await realpath(process.env.WORLDLAW_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const executable=process.env.BROWSER_EXECUTABLE_PATH;
const viewport={width:Number(process.env.BROWSER_VIEWPORT_WIDTH||1440),height:Number(process.env.BROWSER_VIEWPORT_HEIGHT||1000)};
assert.ok(Object.values(viewport).every(n=>Number.isSafeInteger(n)&&n>0),'Viewport dimensions must be positive integers.');
assert.ok(executable,'Set BROWSER_EXECUTABLE_PATH to an authorized sandboxed browser launcher/executable.');
assert.equal(typeof WebSocket,'function','Use a Node runtime with built-in WebSocket.');
process.chdir(root);
const {createProductServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(path.join(os.tmpdir(),'worldlaw-recorded-'));
const artifacts=process.env.BROWSER_ARTIFACT_DIR;
const checks=[],exceptions=[],downloadsRecorded=[],sourceDigests={};
let chrome,ws,seq=0,browserStderr='',failure,actualViewport,sandboxReceipt,browserVersion,browserPlatform,sourceSha256,downloadReceipt,stage='setup';
const controllerPath='src/trajectory/app.mjs';
const pending=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 if(artifacts)await mkdir(artifacts,{recursive:true});
 chrome=spawn(executable,['--headless=new','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size='+viewport.width+','+viewport.height,'about:blank'],{stdio:['ignore','ignore','pipe']});
 chrome.stderr.on('data',b=>{browserStderr=(browserStderr+b).slice(-12000);});
 let spawnError;chrome.on('error',e=>{spawnError=e;});
 let port;
 for(let i=0;i<150;i++){
  if(spawnError)throw spawnError;
  if(chrome.exitCode!==null)throw new Error('Browser exited: '+browserStderr);
  try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}
 }
 assert.ok(port,'Browser DevTools port unavailable: '+browserStderr);
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url==='about:blank');
 assert.ok(target,'Fresh isolated about:blank target missing');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{
  const v=JSON.parse(e.data);
  if(v.id){const p=pending.get(v.id);if(!p)return;pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}
  if(v.method==='Runtime.exceptionThrown')exceptions.push(v.params.exceptionDetails);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
 const js=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expr=>{for(let i=0;i<300;i++){if(await js(expr))return;await delay(50);}throw new Error('Timed out: '+expr);};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
 browserVersion=await send('Browser.getVersion');
 browserPlatform=await js('navigator.platform');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 if(process.platform==='linux'){
  const {requireChromiumSandbox}=await import(pathToFileURL(path.join(root,'scripts/support/chromium-sandbox.mjs')).href);
  try{sandboxReceipt=await requireChromiumSandbox({send});}
  catch(e){sandboxReceipt=e.receipt;throw e;}
 }else{
  sandboxReceipt={qualification:'Linux Chromium status gate',applicable:false,reason:'Linux-specific admission is not applicable on this host; no Linux sandbox claim.',hostPlatform:process.platform,browserPlatform,browser:browserVersion};
 }
 const navigation=await send('Page.navigate',{url:origin+'/trajectory.html'});
 assert.ok(!navigation.errorText,'Product navigation failed: '+navigation.errorText);

 await wait("document.readyState==='complete' && !!document.querySelector('#recorded-experiment-panel')?.shadowRoot && document.querySelector('#training-count')?.textContent!=='—'");
 actualViewport=await js('({width:innerWidth,height:innerHeight})');
 assert.deepEqual(actualViewport,viewport);
 const served=await (await fetch(origin+'/'+controllerPath)).text();
 const disk=await readFile(path.join(root,controllerPath),'utf8');
 assert.equal(served,disk,'Server must serve the exact selected source/package controller');
 sourceSha256=createHash('sha256').update(disk).digest('hex');
 for(const relative of ['src/trajectory/recorded-experiment-session.mjs','src/trajectory/experiment-workflow.mjs','src/trajectory/recorded-experiment-panel.mjs']){
  const response=await fetch(origin+'/'+relative);assert.equal(response.status,200,relative);
  const served=await response.text(),local=await readFile(path.join(root,relative),'utf8');assert.equal(served,local,relative);
  sourceDigests[relative]=createHash('sha256').update(local).digest('hex');
 }
 sourceDigests[controllerPath]=sourceSha256;
 const downloadDir=path.join(profile,'recorded-downloads');await mkdir(downloadDir);
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir,eventsEnabled:true});
 const S="document.querySelector('#recorded-experiment-panel').shadowRoot";
 const E=id=>`${S}.getElementById(${JSON.stringify(id)})`;
 const ready="document.readyState==='complete' && !!document.querySelector('#recorded-experiment-panel')?.shadowRoot";
 const plotData=async id=>js(`(()=>{const curves=[...${E(id)}.querySelectorAll('polyline')].map(p=>({id:p.dataset.series,points:p.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number))}));const all=curves.flatMap(c=>c.points),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),xmin=Math.min(...xs),xspan=Math.max(...xs)-xmin,ymin=Math.min(...ys),yspan=Math.max(...ys)-ymin;return curves.map(c=>({id:c.id,points:c.points.map(([x,y])=>[(x-xmin)/(xspan||1),(y-ymin)/(yspan||1)])}));})()`);
 const storage="localStorage.getItem('worldlaw.trajectory-challenge.v1')";
 const saved=async()=>JSON.parse(await js(storage));
 const idle=()=>wait("document.querySelector('#challenge-workspace').getAttribute('aria-busy')==='false'");
 const enter=async expression=>{
  await js(`${expression}.scrollIntoView({block:'center'});${expression}.focus()`);
  assert.equal(await js(`${expression}.getRootNode().activeElement===${expression}`),true,'Expected focused control');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 };
 const download=async(filename,activate)=>{
  const file=path.join(downloadDir,filename);await rm(file,{force:true});await activate();
  let text;for(let i=0;i<300;i++){try{text=await readFile(file,'utf8');break;}catch{await delay(50);}}
  assert.equal(typeof text,'string','Expected actual downloaded file '+filename);
  const receipt={filename,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};downloadsRecorded.push(receipt);
  return text;
 };
 const exportNotebook=()=>download('worldlaw-trajectory-notebook.json',()=>enter("document.querySelector('#export-notebook')"));
 const choose=async(expression,raw,name)=>js(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(typeof raw==='string'?raw:JSON.stringify(raw))}],${JSON.stringify(name)},{type:'application/json'}));const input=${expression};input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const shot=async name=>{if(!artifacts)return;await js("document.querySelector('#recorded-experiment-panel').scrollIntoView({block:'start'})");const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));};
 const loadAmbiguous=async()=>{await js("document.querySelector('#example-choice').value='ambiguous';document.querySelector('#example-choice').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#load-example').click()");await wait(`${storage} && JSON.parse(${storage}).schema==='worldlaw.trajectory-notebook/v1'`);await idle();};
 const startAndPlan=async()=>{
  await enter(E('start'));await wait(`${storage} && JSON.parse(${storage}).schema==='worldlaw.recorded-trajectory-experiment/v1'`);await idle();
  // Explicit consumer declarations, independent of any convenience defaults.
  await js(`(()=>{const values={inertia:.8,command:0,pmin:-2.2,pmax:2.2,rmin:-.6,rmax:.6,duration:8,sampleInterval:.04};for(const[id,value]of Object.entries(values)){const i=${S}.getElementById(id);i.value=String(value);i.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  await enter(E('plan'));await wait(`${E('export')}.disabled===false && ${E('file')}.disabled===false`);await idle();
 };
 stage='behavior';
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});throw e;}};
 let request,run,baseNotebook,plannedNotebook,trainingCount,reservedRuns,pendingText,appliedText;
 await check('actual Trajectory entry, reduced motion, explicit known-inertia plan and request download',async()=>{
  assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
  await loadAmbiguous();await startAndPlan();plannedNotebook=await saved();baseNotebook=JSON.parse(plannedNotebook.baseNotebookText);
  reservedRuns=baseNotebook.bundle.challengeRuns;trainingCount=await js("Number(document.querySelector('#training-count').textContent)");
  request=JSON.parse(await download('worldlaw-recorded-experiment-request.json',()=>enter(E('export'))));
  assert.equal(request.schema,'worldlaw.recorded-trajectory-request/v1');assert.equal(request.request.inertia,.8);assert.equal(request.request.command,0);assert.equal(request.units.position,'rad');
  assert.ok(await js(`${E('plot')}.querySelectorAll('polyline').length>=2`));
 });
 const createRun=()=>{
  const q=request.request,n=Math.round(q.duration/q.sampleInterval)+1,start=10,theta=q.initialPosition+.03,rate=q.initialRate+.07,w=1.35;
  return {id:'recorded-browser-analytic-1',label:'Authored analytic course — synthetic',kind:'synthetic',units:request.units,inertia:q.inertia,initialRate:rate,source:{label:'Independent authored cosine/sine receiver control; not physical measurements',recordingId:'recorded-browser-analytic-source-1',generator:'authored analytic formula, no learned-model calls'},samples:Array.from({length:n},(_,i)=>{const t=i*q.sampleInterval+(i>0&&i<n-1?(i%2?.001:-.001):0);return {time:start+t,position:theta*Math.cos(w*t)+rate/w*Math.sin(w*t),command:q.command};})};
 };
 await check('wrong-inertia and reused-source refusals preserve planned notebook and training',async()=>{
  run=createRun();const before=await js(storage),bad=structuredClone(run);bad.inertia=1.2;
  await choose(E('file'),bad,'wrong-inertia.json');await wait(`${E('error')}.hidden===false`);await idle();
  assert.equal(await js(storage),before);assert.match(await js(`${E('error')}.textContent`),/inertia/i);
  await choose(E('file'),baseNotebook.bundle.trainingRuns[0],'reused-source.json');await wait(`${E('error')}.hidden===false && ${E('file')}.disabled===false`);await idle();
  assert.equal(await js(storage),before);assert.equal(await js("Number(document.querySelector('#training-count').textContent)"),trainingCount);
 });
 await check('obsolete delayed recorded import cannot replace a newly loaded source',async()=>{
  await js(`(()=>{const old=File.prototype.text;window.__recordedReadStarted=false;File.prototype.text=function(){if(this.name==='delayed-recording.json'){window.__recordedReadStarted=true;return new Promise(resolve=>{window.__releaseRecordedRead=()=>resolve(${JSON.stringify(JSON.stringify(run))});});}return old.call(this);};window.__restoreRecordedText=()=>{File.prototype.text=old;};})()`);
  await choose(E('file'),run,'delayed-recording.json');await wait('window.__recordedReadStarted===true');
  await loadAmbiguous();const expected=await js(storage);
  await js('window.__releaseRecordedRead()');await wait(`${E('start')}.disabled===false`);await delay(100);
  assert.equal(await js(storage),expected);assert.equal(await js("document.querySelector('#error').hidden"),true);
  await js('window.__restoreRecordedText()');await startAndPlan();
  plannedNotebook=await saved();baseNotebook=JSON.parse(plannedNotebook.baseNotebookText);reservedRuns=baseNotebook.bundle.challengeRuns;
  request=JSON.parse(await download('worldlaw-recorded-experiment-request.json',()=>enter(E('export'))));run=createRun();
 });
 await check('supplied analytic recording retains actual clock and conditions without implicit refitting',async()=>{
  const nominal=await plotData('plot'),before=await saved();
  await choose(E('file'),run,'analytic-recording.json');await wait(`${E('apply')}.disabled===false`);await idle();
  const pending=await saved();assert.deepEqual(pending.pending.run,run);assert.deepEqual(pending.history,[]);assert.equal(pending.baseNotebookText,before.baseNotebookText);
  assert.equal(await js("Number(document.querySelector('#training-count').textContent)"),trainingCount);
  assert.equal(await js(`${E('conditions')}.hidden`),false);assert.equal(await js(`${E('original')}.hidden`),false);
  assert.match(await js(`${E('plot-caption')}.textContent`),/actual initial conditions and timestamps/);
  assert.match(await js(`${E('source')}.textContent`),/synthetic/);assert.match(await js(`${E('clock')}.textContent`),/0\.039|0\.038/);
  const original=await plotData('original-plot');assert.deepEqual(original.map(c=>c.id),nominal.map(c=>c.id));
  for(let c=0;c<nominal.length;c++){assert.equal(original[c].points.length,nominal[c].points.length);for(let i=0;i<nominal[c].points.length;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(original[c].points[i][axis]-nominal[c].points[i][axis])<.0001,'Original planned curve shape remains unchanged across plot widths');}
  assert.ok(await js(`${E('plot')}.querySelector('[data-series="supplied-recording"]')!==null`));
  await shot('recorded-pending');
 });
 await check('ordinary keyboard export and same-origin reload retain pending source and reserved evidence',async()=>{
  pendingText=await exportNotebook();assert.equal(pendingText,await js(storage));
  await send('Page.reload',{ignoreCache:true});await wait(`${ready} && ${E('apply')}.disabled===false && document.querySelector('#storage-status').textContent.includes('restored')`);await idle();
  const pending=await saved();assert.deepEqual(pending.pending.run,run);assert.equal(pending.history.length,0);assert.deepEqual(JSON.parse(pending.baseNotebookText).bundle.challengeRuns,reservedRuns);
  assert.equal(await js("Number(document.querySelector('#training-count').textContent)"),trainingCount);
 });
 await check('keyboard Apply refits only after explicit action and retains reserved course',async()=>{
  await enter(E('apply'));await wait(`${E('revision')}.hidden===false && ${E('apply-row')}.hidden===true`);await idle();
  const applied=await saved();assert.equal(applied.pending,null);assert.equal(applied.history.length,1);assert.deepEqual(applied.history[0].run,run);
  assert.deepEqual(JSON.parse(applied.baseNotebookText).bundle.challengeRuns,reservedRuns);
  assert.equal(await js("Number(document.querySelector('#training-count').textContent)"),trainingCount+run.samples.length);
  assert.match(await js(`${E('revision-summary')}.textContent`),/unchanged/);
  assert.match(await js(`${E('source')}.textContent`),/recorded-browser-analytic-source-1/);
  appliedText=await exportNotebook();assert.equal(appliedText,await js(storage));
 });
 await check('portable applied notebook reopens through ordinary file input with exact evidence',async()=>{
  await loadAmbiguous();await choose("document.querySelector('#notebook-file')",appliedText,'applied-recorded-notebook.json');
  await wait(`${E('revision')}.hidden===false && JSON.parse(${storage}).history?.length===1`);await idle();
  const finalText=await exportNotebook();assert.equal(finalText,appliedText);
  assert.equal(await js("Number(document.querySelector('#training-count').textContent)"),trainingCount+run.samples.length);
  assert.equal(await js(`${E('original')}.hidden`),false);await shot('recorded-applied');
  if(artifacts){await writeFile(path.join(artifacts,'synthetic-control.json'),JSON.stringify(run,null,2));await writeFile(path.join(artifacts,'pending-notebook.json'),pendingText);await writeFile(path.join(artifacts,'applied-notebook.json'),finalText);}
 });
 await check('viewport, real charts and no uncaught page exceptions',async()=>{
  const dims=await js(`({width:innerWidth,scroll:document.documentElement.scrollWidth,chart:${E('plot')}.getBoundingClientRect().width})`);
  assert.ok(dims.scroll<=dims.width+1,JSON.stringify(dims));assert.ok(dims.chart>200);assert.deepEqual(exceptions,[]);
 });
 console.log(JSON.stringify({pass:true,root,origin,stage,sandboxReceipt,browserVersion,browserPlatform,actualViewport,sourceDigests,downloadsRecorded,checks},null,2));
}catch(e){failure=e;console.error(JSON.stringify({pass:false,root,origin,stage,sandboxReceipt,browserVersion,browserPlatform,actualViewport,sourceDigests,downloadsRecorded,checks,error:e.stack,browserStderr},null,2));}
finally{
 try{if(artifacts)await writeFile(path.join(artifacts,'recorded-browser-results.json'),JSON.stringify({pass:!failure,root,origin,stage,sandboxReceipt,browserVersion,browserPlatform,actualViewport,sourceDigests,downloadsRecorded,checks,exceptions,error:failure?.stack},null,2));}catch(e){failure??=e;console.error(e.message);}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Receiver shutting down'));}pending.clear();try{ws?.close();}catch{}
 if(chrome?.pid&&chrome.exitCode===null&&chrome.signalCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await Promise.race([exited,delay(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill('SIGKILL');await Promise.race([exited,delay(3000)]);}}
 await rm(profile,{recursive:true,force:true});await new Promise(resolve=>server.close(resolve));
}
if(failure)process.exitCode=1;
