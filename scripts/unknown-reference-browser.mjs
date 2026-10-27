import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const out=process.env.BROWSER_ARTIFACT_DIR||'/tmp/worldlaw-reference-receipts';await mkdir(out,{recursive:true});
const server=createProductServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
const origin='http://127.0.0.1:'+server.address().port,dir=await mkdtemp(path.join(os.tmpdir(),'reference-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',x=>stderr+=x.toString());let ws,seq=0;const pending=new Map(),checks=[],errors=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},12000);pending.set(id,{resolve:x=>{clearTimeout(timer);resolve(x);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<100;i++){if(await evaljs(expression))return;await delay(50);}throw Error('Timed out '+expression);};
const check=async(name,fn)=>{await fn();checks.push({name,passed:true});};
const status=()=>evaljs("document.querySelector('#ref-state').dataset.status");
const load=async kind=>{await evaljs(`document.querySelector('#ref-example').value=${JSON.stringify(kind)};document.querySelector('#ref-load').click()`);};
const upload=async text=>{await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(text)}],'study.json',{type:'application/json'}));const e=document.querySelector('#ref-file');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(100);};
let primaryError=null;
try{
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{if(chrome.exitCode!==null)throw Error('Chrome exited: '+stderr);await delay(100);}}
 assert.ok(port,'Chrome debugging port unavailable');const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),target=targets.find(t=>t.type==='page');assert.ok(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);});
 let sandbox;try{sandbox=await requireChromiumSandbox({send});}catch(e){await writeFile(path.join(out,'sandbox-admission.json'),JSON.stringify(e.receipt,null,2));throw e;}
 await writeFile(path.join(out,'sandbox-admission.json'),JSON.stringify(sandbox,null,2));
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:origin+'/unknown-lab.html'});await wait("document.querySelector('#ref-load')&&document.querySelector('#status')?.textContent==='CHALLENGED'");
 await check('actual UNKNOWN LAB baseline remains, authored reference screen is explicit',async()=>{assert.equal(await evaljs("document.querySelector('#ref-state').textContent"),'NOT SCREENED');await load('artifact-only');assert.equal(await status(),'compatible');assert.equal(await evaljs("document.querySelectorAll('#ref-rows tr').length"),6);assert.equal(await evaljs("!!document.querySelector('#ref-plot svg')"),true);});
 await check('conditional negative controls retain rejection and negative-gain positive survives',async()=>{for(const kind of ['additional-effect','changing-gain','zero-reference']){await load(kind);assert.equal(await status(),'training-contradicted',kind);}await load('negative-gain');assert.equal(await status(),'compatible');await load('artifact-only');});
 // Capture the actual exported Blob, while retaining the real link/download action.
 await evaljs("window.__refBlobs={};window.__refURL=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{const u=window.__refURL(b);window.__refBlobs[u]=b;return u};document.addEventListener('click',e=>{const a=e.target.closest('a[download]');if(a&&window.__refBlobs[a.href])window.__refExport=window.__refBlobs[a.href].text();},true)");
 await evaljs("document.querySelector('#ref-save').click()");const saved=await evaljs('window.__refExport');assert.ok(saved);await writeFile(path.join(out,'worldlaw-reference-channel.json'),saved);
 await check('fresh page reopens actual exported original observations',async()=>{await send('Page.navigate',{url:origin+'/unknown-lab.html'});await wait("!!document.querySelector('#ref-file')");await upload(saved);assert.equal(await status(),'compatible');assert.equal(await evaljs("document.querySelectorAll('#ref-rows tr').length"),6);});
 await check('invalid replacement retires result without accepting corrupted source',async()=>{await upload('{"schema":"wrong"}');assert.equal(await status(),undefined);assert.match(await evaljs("document.querySelector('#ref-error').textContent"),/Expected/);await evaljs("document.querySelector('#ref-form').requestSubmit()");assert.equal(await status(),'compatible');});
 await check('declared-gain edits retire stale inference and keyboard submits form',async()=>{await evaljs("const e=document.querySelector('#ref-gain-low');e.value='0.9';e.dispatchEvent(new Event('input',{bubbles:true}));e.focus()");assert.equal(await status(),undefined);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("document.querySelector('#ref-state').dataset.status==='compatible'");});
 await check('late file read cannot replace a newer authored-control action',async()=>{await evaljs(`(()=>{const d=new DataTransfer();const f=new File([${JSON.stringify(saved)}],'late.json');f.text=()=>new Promise(r=>window.__releaseRef=()=>r(${JSON.stringify(saved)}));d.items.add(f);const e=document.querySelector('#ref-file');e.files=d.files;Object.defineProperty(e.files[0],'text',{value:f.text});e.dispatchEvent(new Event('change'));})()`);await load('negative-gain');await evaljs('window.__releaseRef()');await delay(100);assert.equal(await evaljs("document.querySelector('#ref-gain-low').value"),'-1.2');assert.equal(await status(),'compatible');});
 await check('independent channel notebook imports add a real run; duplicate acquisition refuses atomically',async()=>{await upload(saved);const source=JSON.parse(saved);const extra=structuredClone(source.runs[0]);extra.id='extra';extra.role='challenge';extra.main.acquisitionId='extra-main';extra.reference.acquisitionId='extra-reference';// Fresh authored virtual acquisitions, not recycled evidence.
 const pair=await evaljs("(async()=>{const {syntheticChallenge}=await import('/src/unknown-lab/paired-history.mjs');return [syntheticChallenge({seed:901,duration:.3,count:32,noiseSigma:.003,effect:.8}),syntheticChallenge({seed:902,duration:.3,count:32,noiseSigma:.003,effect:.8})]})()");
 const fill=async()=>evaljs(`(()=>{const f=document.querySelector('#ref-add');for(const [k,v] of Object.entries({id:'extra',role:'challenge',duration:'.3',mainId:'extra-main',referenceId:'extra-reference'}))f.elements[k].value=v;for(const [key,raw]of ${JSON.stringify([['mainFile',pair[0]],['referenceFile',pair[1]]])}){const d=new DataTransfer();d.items.add(new File([JSON.stringify(raw)],key+'.json'));f.elements[key].files=d.files;}f.requestSubmit()})()`);
 await fill();await wait("document.querySelectorAll('#ref-rows tr').length===7");await fill();await wait("document.querySelector('#ref-error').textContent.length>0");assert.match(await evaljs("document.querySelector('#ref-error').textContent"),/distinct/);await evaljs("document.querySelector('#ref-form').requestSubmit()");assert.equal(await evaljs("document.querySelectorAll('#ref-rows tr').length"),7);});
 await check('qualified contradiction remains visible alongside unqualified challenge',async()=>{const s=JSON.parse(saved);for(const t of s.runs[3].main.notebook.trials)if(t.history==='conditioned')t.jointTorque+=.4;for(const t of s.runs[4].reference.notebook.trials)delete t.sampleIndex;await upload(JSON.stringify(s));assert.equal(await status(),'contradicted');assert.match(await evaljs("document.querySelector('#ref-summary').textContent"),/unqualified 1/);});
 await load('artifact-only');
 for(const width of [1440,390,320])await check('actual layout and focus at '+width,async()=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await evaljs("document.querySelector('#ref-form').scrollIntoView({behavior:'instant',block:'start'});document.querySelector('#ref-gain-low').focus({preventScroll:true})");await evaljs('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.equal(await evaljs("document.activeElement.id"),'ref-gain-low');assert.equal(await evaljs('document.documentElement.scrollWidth<=innerWidth+1'),true);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'reference-'+width+'.png'),Buffer.from(shot.data,'base64'));await evaljs("document.querySelector('#ref-plot').scrollIntoView({behavior:'instant',block:'start'})");await evaljs('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.equal(await evaljs("(()=>{const svg=document.querySelector('#ref-plot svg'),scale=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;return [...svg.querySelectorAll('text')].every(t=>Number(t.getAttribute('font-size'))*scale>=11)})()"),true);assert.equal(await evaljs("document.querySelector('#ref-table-caption').getBoundingClientRect().right<=innerWidth"),true);const plotShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'reference-plot-'+width+'.png'),Buffer.from(plotShot.data,'base64'));});
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'reference-verification.json'),JSON.stringify({schema:'worldlaw.reference-browser/v1',origin,node:process.version,checks,exceptions:errors,sandboxAdmitted:true},null,2));console.log(JSON.stringify({passed:checks.length,artifacts:out}));
}catch(e){primaryError=e;try{await writeFile(path.join(out,'reference-failure.json'),JSON.stringify({message:e.message,checks,stderr,exceptions:errors},null,2));}catch(receiptError){console.error('Failure receipt could not be written:',receiptError.message);}throw e;}
finally{
 const cleanupErrors=[];
 const attempt=async(label,fn)=>{try{await fn();}catch(e){cleanupErrors.push({step:label,message:e.message});}};
 await attempt('close owned CDP socket',async()=>ws?.close());
 const hasExited=()=>chrome.exitCode!==null||chrome.signalCode!==null;
 const awaitExit=ms=>new Promise(resolve=>{
  if(hasExited()){resolve(true);return;}
  let timer;const done=()=>{clearTimeout(timer);chrome.off('exit',done);resolve(true);};
  chrome.once('exit',done);timer=setTimeout(()=>{chrome.off('exit',done);resolve(hasExited());},ms);
 });
 await attempt('stop owned Chrome child',async()=>{
  if(hasExited())return;
  chrome.kill('SIGTERM');
  if(!await awaitExit(5000)){chrome.kill('SIGKILL');if(!await awaitExit(5000))throw Error('Owned Chrome child did not exit; temporary profile retained.');}
 });
 await attempt('close owned product server',()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
 // This exact directory was created by mkdtemp above. Never remove a live profile.
 if(hasExited())await attempt('remove owned temporary profile',()=>rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}));
 const cleanup={schema:'worldlaw.reference-browser-cleanup/v1',profile:dir,chromeExited:hasExited(),exitCode:chrome.exitCode,signalCode:chrome.signalCode,primaryFailure:primaryError?.message??null,errors:cleanupErrors};
 await attempt('write cleanup receipt',()=>writeFile(path.join(out,'reference-cleanup.json'),JSON.stringify(cleanup,null,2)));
 if(cleanupErrors.length){console.error('Browser cleanup errors:',JSON.stringify(cleanupErrors));if(!primaryError)throw Error('Browser checks completed but cleanup failed: '+cleanupErrors.map(e=>e.message).join('; '));}
}
