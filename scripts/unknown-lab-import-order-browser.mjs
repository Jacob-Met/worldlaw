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
const profile=await mkdtemp(path.join(os.tmpdir(),'worldlaw-import-order-'));
const artifacts=process.env.BROWSER_ARTIFACT_DIR;
const checks=[],exceptions=[];
let chrome,ws,seq=0,browserStderr='',failure,actualViewport,sandboxReceipt,browserVersion,browserPlatform,sourceSha256,downloadReceipt,stage='setup';
const controllerPath='src/unknown-lab/app.mjs';
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
 const wait=async expr=>{for(let i=0;i<80;i++){if(await js(expr))return;await delay(50);}throw new Error('Timed out: '+expr);};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
 browserVersion=await send('Browser.getVersion');
 browserPlatform=await js('navigator.platform');
 if(process.platform==='linux'){
  const {requireChromiumSandbox}=await import(pathToFileURL(path.join(root,'scripts/support/chromium-sandbox.mjs')).href);
  try{sandboxReceipt=await requireChromiumSandbox({send});}
  catch(e){sandboxReceipt=e.receipt;throw e;}
 }else{
  sandboxReceipt={qualification:'Linux Chromium status gate',applicable:false,reason:'Linux-specific admission is not applicable on this host; no Linux sandbox claim.',hostPlatform:process.platform,browserPlatform,browser:browserVersion};
 }
 const navigation=await send('Page.navigate',{url:origin+'/unknown-lab.html'});
 assert.ok(!navigation.errorText,'Product navigation failed: '+navigation.errorText);

 await wait("document.readyState==='complete' && !!document.querySelector('#plot svg')");
 actualViewport=await js('({width:innerWidth,height:innerHeight})');
 assert.deepEqual(actualViewport,viewport);
 const served=await (await fetch(origin+'/'+controllerPath)).text();
 const disk=await readFile(path.join(root,controllerPath),'utf8');
 assert.equal(served,disk,'Server must serve the exact selected source/package controller');
 sourceSha256=createHash('sha256').update(disk).digest('hex');
 await js(`(async()=>{
  const m=await import('/src/unknown-lab/paired-history.mjs');
  const deferred=new Map(),readCalls=new Map();const originalText=File.prototype.text;
  File.prototype.text=function(){readCalls.set(this.name,(readCalls.get(this.name)||0)+1);return deferred.has(this.name)?deferred.get(this.name).promise:originalText.call(this);};
  let lastExport=null;const createURL=URL.createObjectURL;
  URL.createObjectURL=function(blob){if(blob.type==='application/json')lastExport=blob.text();return createURL.call(this,blob);};
  const anchorClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(!this.download)return anchorClick.call(this);};
  const input=document.querySelector('#file');
  window.receiver={
   reads(name){return readCalls.get(name)||0;},
   evidence(seed){const n=m.syntheticChallenge({seed,effect:seed%2?1:-.5});n.source='measured';n.sourceNote='import-order receiver '+seed;return m.exportNotebook(n);},
   choose(name,text,hold=false){if(hold){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});deferred.set(name,{promise,resolve,reject});}const dt=new DataTransfer();dt.items.add(new File([text],name,{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},
   async settle(name,text,reject=false){const d=deferred.get(name);if(reject)d.reject(new Error(text));else d.resolve(text);await new Promise(r=>setTimeout(r,0));},
   async exported(){lastExport=null;document.querySelector('#export').click();await new Promise(r=>setTimeout(r,0));if(!lastExport)throw new Error('No actual export Blob');return await lastExport;},
   view(){return Object.fromEntries(['source-badge','offset','status','rows','storage','error'].map(id=>[id,{text:document.getElementById(id).textContent,hidden:document.getElementById(id).hidden}]).concat([['focus',document.activeElement?.id],['file',input.value]]));},
   run(){document.querySelector('#run-form button[type=submit]').click();},
   async baseline(){document.querySelector('#count').value='16';document.querySelector('#sigma').value='.02';this.run();await new Promise(r=>setTimeout(r,0));}
  };
 })()`);
 stage='behavior';
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});throw e;}};
 const snapshot=()=>js('(async()=>({evidence:await receiver.exported(),view:receiver.view()}))()');
 const same=async expected=>assert.deepEqual(await snapshot(),expected);
 await check('newest import survives older success; actual exported evidence and UI',async()=>{
  await js("receiver.choose('older-success.json',receiver.evidence(101),true);receiver.choose('newer-success.json',receiver.evidence(102),true)");
  await js("receiver.settle('newer-success.json',receiver.evidence(102))");
  assert.equal(await js('receiver.exported()'),await js('receiver.evidence(102)'));
  const expected=await snapshot();await js("receiver.settle('older-success.json',receiver.evidence(101))");await same(expected);
 });
 await check('new import supersedes a virtual run queued in the same event turn',async()=>{
  const before=await js('receiver.exported()');
  await js("receiver.run();receiver.choose('after-queued-run.json','',true)");
  assert.equal(await js('receiver.exported()'),before,'Superseded queued run must not replace the current evidence');
  await js("receiver.settle('after-queued-run.json',receiver.evidence(115))");
  assert.equal(await js('receiver.exported()'),await js('receiver.evidence(115)'));
 });
 await check('stale rejection does not change newer success or focus',async()=>{
  await js("receiver.choose('older-error.json','',true);receiver.choose('newer-after-error.json','',true)");
  await js("receiver.settle('newer-after-error.json',receiver.evidence(103))");const expected=await snapshot();
  await js("receiver.settle('older-error.json','stale read rejection',true)");await same(expected);
 });
 await check('newest malformed import owns refusal and preserves prior notebook',async()=>{
  const before=await js('receiver.exported()');
  await js("receiver.choose('old-before-invalid.json','',true);receiver.choose('invalid.json','',true)");
  await js("receiver.settle('invalid.json','{broken')");
  assert.equal(await js("document.querySelector('#error').hidden"),false);
  const expected=await snapshot();assert.equal(expected.evidence,before);
  await js("receiver.settle('old-before-invalid.json',receiver.evidence(104))");await same(expected);
 });
 await check('newest oversized import supersedes old success without reading oversized file',async()=>{
  await js("receiver.choose('old-before-large.json','',true);receiver.choose('oversize.json',' '.repeat(200001),true)");
  assert.match(await js("document.querySelector('#error').textContent"),/200 KB/);
  assert.equal(await js("receiver.reads('oversize.json')"),0);
  const expected=await snapshot();await js("receiver.settle('old-before-large.json',receiver.evidence(105))");await same(expected);
 });
 await check('explicit valid virtual run supersedes pending import',async()=>{
  await js("receiver.choose('old-before-run.json','',true);receiver.run()");
  await wait("document.querySelector('#source-badge').textContent==='DECLARED SIMULATION'");
  const expected=await snapshot();await js("receiver.settle('old-before-run.json',receiver.evidence(106))");await same(expected);
 });
 for(const [name,value]of [['required',''],['range','129']])await check('native '+name+' invalid Run supersedes pending import',async()=>{
  await js('receiver.baseline()');
  await js(`receiver.choose('old-before-${name}.json','',true);document.querySelector('#count').value=${JSON.stringify(value)};receiver.run()`);
  assert.equal(await js("document.querySelector('#count').validity.valid"),false);
  const expected=await snapshot();await js(`receiver.settle('old-before-${name}.json',receiver.evidence(107))`);await same(expected);
  await js("document.querySelector('#count').value='16'");
 });
 await check('pending newer File survives stale completion and permits reselection',async()=>{
  await js("receiver.choose('cleanup-old.json','',true);receiver.choose('cleanup-new.json','',true)");
  assert.equal(await js("document.querySelector('#file').value"),'');
  await js("receiver.settle('cleanup-old.json',receiver.evidence(108))");
  assert.equal(await js("document.querySelector('#file').value"),'');
  await js("receiver.settle('cleanup-new.json',receiver.evidence(109))");
  assert.equal(await js('receiver.exported()'),await js('receiver.evidence(109)'));
  assert.equal(await js("document.querySelector('#file').value"),'');
 });
 await check('same file can be selected after a virtual run supersedes its pending read',async()=>{
  await js("receiver.choose('same-after-run.json','',true);receiver.run()");
  await wait("document.querySelector('#source-badge').textContent==='DECLARED SIMULATION'");
  assert.equal(await js("document.querySelector('#file').value"),'');
  await js("receiver.settle('same-after-run.json',receiver.evidence(113))");
  await js("receiver.choose('same-after-run.json','',true)");
  assert.equal(await js("document.querySelector('#file').value"),'');
  await js("receiver.settle('same-after-run.json',receiver.evidence(114))");
  assert.equal(await js('receiver.exported()'),await js('receiver.evidence(114)'));
 });
 await check('empty picker change does not supersede pending import',async()=>{
  await js("receiver.choose('cancel-control.json','',true);const i=document.querySelector('#file');i.files=new DataTransfer().files;i.dispatchEvent(new Event('change',{bubbles:true}))");
  await js("receiver.settle('cancel-control.json',receiver.evidence(110))");
  assert.equal(await js('receiver.exported()'),await js('receiver.evidence(110)'));
 });
 await check('ordinary File.text roundtrip and same-name reselection',async()=>{
  for(const seed of [111,112]){
   await js(`receiver.choose('ordinary-same.json',receiver.evidence(${seed}))`);
   await wait(`(async()=>await receiver.exported()===receiver.evidence(${seed}))()`);
   assert.equal(await js('receiver.exported()'),await js(`receiver.evidence(${seed})`));
  }
 });
 await check('save and forget preserve current evidence',async()=>{
  assert.equal(await js("localStorage.getItem('worldlaw.unknown-lab.history.v1')"),null,'No implicit notebook persistence');
  const before=await js('receiver.exported()');
  await js("document.querySelector('#remember').click()");
  assert.equal(await js("localStorage.getItem('worldlaw.unknown-lab.history.v1')"),before);
  await js("document.querySelector('#forget').click()");
  assert.equal(await js("localStorage.getItem('worldlaw.unknown-lab.history.v1')"),null);
  assert.equal(await js('receiver.exported()'),before);
 });
 await check('keyboard save, reload and actual downloaded file preserve evidence',async()=>{
  const expected=await js('receiver.exported()');
  const enter=async()=>{
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  };
  await js("document.querySelector('#remember').focus()");
  assert.equal(await js('document.activeElement.id'),'remember');await enter();
  await wait(`localStorage.getItem('worldlaw.unknown-lab.history.v1')===${JSON.stringify(expected)}`);
  await send('Page.reload',{ignoreCache:true});
  await wait("document.readyState==='complete' && !!document.querySelector('#plot svg') && document.querySelector('#storage').textContent.startsWith('Reopened explicitly saved local copy')");
  assert.equal(await js("document.querySelector('#source-badge').textContent"),'USER-DECLARED MEASUREMENTS');
  const downloads=path.join(profile,'receiver-downloads');await mkdir(downloads);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  await js("document.querySelector('#export').focus()");
  assert.equal(await js('document.activeElement.id'),'export');await enter();
  const filename='worldlaw-history-pairs.json';let downloaded;
  for(let i=0;i<100;i++){try{downloaded=await readFile(path.join(downloads,filename),'utf8');break;}catch{await delay(50);}}
  assert.equal(downloaded,expected,'The actual downloaded notebook must exactly match the saved and reopened evidence');
  downloadReceipt={filename,bytes:Buffer.byteLength(downloaded),sha256:createHash('sha256').update(downloaded).digest('hex'),keyboardActivation:'CDP Enter on focused Remember and Export buttons',reopened:true};
  if(artifacts)await writeFile(path.join(artifacts,'reopened-download.json'),downloaded);
  await js("document.querySelector('#forget').click()");
  await wait("localStorage.getItem('worldlaw.unknown-lab.history.v1')===null");
 });
 assert.deepEqual(exceptions,[],'No uncaught page exceptions');
 if(artifacts){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'unknown-import-order.png'),Buffer.from(shot.data,'base64'));}
 console.log(JSON.stringify({pass:true,root,origin,stage,sandboxReceipt,browserVersion,browserPlatform,actualViewport,controllerPath,sourceSha256,downloadReceipt,browserExecutable:executable,checks},null,2));
}catch(e){failure=e;console.error(JSON.stringify({pass:false,root,origin,stage,negativeControlEligible:stage==='behavior'&&checks.some(c=>!c.passed),controllerPath,sourceSha256,downloadReceipt,sandboxReceipt,browserVersion,browserPlatform,actualViewport,checks,error:e.stack,browserStderr},null,2));}
finally{
 try{if(artifacts)await writeFile(path.join(artifacts,'unknown-import-order-results.json'),JSON.stringify({pass:!failure,root,origin,stage,negativeControlEligible:!!failure&&stage==='behavior'&&checks.some(c=>!c.passed),controllerPath,sourceSha256,downloadReceipt,sandboxReceipt,browserVersion,browserPlatform,actualViewport,checks,exceptions,error:failure?.stack},null,2));}
 catch(e){failure??=e;console.error('Could not write receiver results: '+e.message);}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Receiver shutting down'));}pending.clear();
 try{ws?.close();}catch{}
 if(chrome?.pid&&chrome.exitCode===null&&chrome.signalCode===null){
  const exited=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await Promise.race([exited,delay(3000)]);
  if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill('SIGKILL');await Promise.race([exited,delay(3000)]);}
 }
 await rm(profile,{recursive:true,force:true});
 await new Promise(resolve=>server.close(resolve));
}
if(failure)process.exitCode=1;
