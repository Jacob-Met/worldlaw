import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {account as refinementActualAccount,zeroRef} from '../probe-refinement-fixture.mjs';
import {createReferenceSequence} from '../src/unknown-lab/reference-sequence.mjs';
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

const visualSource=JSON.parse(await readFile(process.env.INTERVAL_VISUAL_SOURCE,'utf8'));
const visualUpload=async(selector,obj)=>{await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(obj))}],'visual-source.json'));const e=document.querySelector(${JSON.stringify(selector)});e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(150);};
await visualUpload('#rs-open',visualSource.account);await visualUpload('#rf-open',visualSource);
assert.equal(await evaljs("document.querySelector('#rf-error').textContent"),'');
for(const width of[1440,390,320])await check('finite interval attaining witness actual viewport '+width,async()=>{
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
 await evaljs("(()=>{const all=[...document.querySelectorAll('#rf-results > details')];all.forEach(x=>x.open=false);const x=all.at(-1);x.open=true;x.scrollIntoView({behavior:'instant',block:'start'});})()");await evaljs("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
 assert.match(await evaljs("document.querySelector('#rf-results > details:last-child').textContent"),/0.363818/);assert.match(await evaljs("document.querySelector('#rf-results > details:last-child').textContent"),/separate latent reference witnesses/);assert.equal(await evaljs('document.documentElement.scrollWidth<=innerWidth+1'),true);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'finite-witness-'+width+'.png'),Buffer.from(shot.data,'base64'));
});
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'model-verification.json'),JSON.stringify({schema:'worldlaw.reference-browser/v1',origin,node:process.version,checks,exceptions:errors,sandboxAdmitted:true},null,2));console.log(JSON.stringify({passed:checks.length,artifacts:out}));
}catch(e){primaryError=e;try{await writeFile(path.join(out,'model-failure.json'),JSON.stringify({message:e.message,checks,stderr,exceptions:errors},null,2));}catch(receiptError){console.error('Failure receipt could not be written:',receiptError.message);}throw e;}
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
