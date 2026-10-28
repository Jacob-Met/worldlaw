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
await check('original consumer and bounded nested model comparison remain live',async()=>{
 await evaljs("document.querySelector('#rm-form').requestSubmit()");
 assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/No offered/);
 assert.ok(await evaljs("document.querySelectorAll('#rm-result svg').length")>=1);
});
const authored=await evaljs(`(async()=>{const {syntheticChallenge}=await import('/src/unknown-lab/paired-history.mjs');return {schema:'worldlaw.reference-model-comparison-input/v1',input:{schema:'worldlaw.reference-models/v1',study:{schema:'worldlaw.reference-channel/v1',gainBounds:[.9,2.1],assumptions:{referenceInsensitivity:'Authored reference is insensitive to the offered additional signal.',sharedArtifact:'Both authored channels share proportional simulated artifact values.',stableGain:'One gain remains fixed across each offered explanation and source run.'},runs:[.25,.5,1].map((duration,i)=>{const f=-Math.expm1(-duration),nb=(target,seed)=>syntheticChallenge({count:32,seed,noiseSigma:.0001,duration,effect:target/(-Math.expm1(-duration/1.3)),orderStrategy:'shuffled'});return {id:'collinear-'+i,role:'training',duration,main:{acquisitionId:'future-main-'+i,notebook:nb(2*f,900+i*2)},reference:{acquisitionId:'future-reference-'+i,notebook:nb(f,901+i*2)}};})},amplitudeBounds:[.9,1.1],taus:[1]},offers:[{id:'repeat',duration:1,referenceInterval:[1-Math.exp(-1),1-Math.exp(-1)],radius:.02},{id:'suppressed',duration:1,referenceInterval:[-.01,.01],radius:.02}]};})()`);
const modelUpload=async obj=>{await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(obj))}],'comparison.json'));const e=document.querySelector('#rm-file');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(120);};
await check('actual notebook import separates suppressed reference but not repeated proportional observations',async()=>{await modelUpload(authored);assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/suppressed/);assert.match(await evaljs("document.querySelector('#rm-result').textContent"),/repeat.*0\/1 pairs separated/s);assert.match(await evaljs("document.querySelector('#rm-result').textContent"),/suppressed.*1\/1 pairs separated/s);});
await check('A=0 nesting and weak reference preserve overlap',async()=>{const n=structuredClone(authored);n.input.amplitudeBounds=[0,1.1];await modelUpload(n);assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/No offered/);const w=structuredClone(authored);w.offers[1].referenceInterval=[-.5,.5];await modelUpload(w);assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/No offered/);await modelUpload(authored);});
await evaljs("window.__blobs={};const orig=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{const u=orig(b);window.__blobs[u]=b;return u};document.addEventListener('click',e=>{const a=e.target.closest('a[download]');if(a&&window.__blobs[a.href])window.__saved=window.__blobs[a.href].text();},true)");
await evaljs("document.querySelector('#rm-save').click()");const saved=await evaljs('window.__saved');assert.ok(saved);await writeFile(path.join(out,'comparison-source.json'),saved);
await check('actual export fresh page reopen retains complete source and predictions',async()=>{assert.deepEqual(JSON.parse(saved).input,authored.input);await send('Page.navigate',{url:origin+'/unknown-lab.html'});await wait("!!document.querySelector('#rm-file')");await modelUpload(JSON.parse(saved));assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/suppressed/);});
await check('reopened source identity persists through coefficient edits and recompare',async()=>{await evaljs("const a=document.querySelector('#rm-form [name=amax]');a.value='1.2';a.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#rm-form').requestSubmit()");assert.match(await evaljs("document.querySelector('#rm-source').textContent"),/reopened comparison study/);assert.match(await evaljs("document.querySelector('#rm-source').textContent"),/future-main-0/);await modelUpload(authored);});
await check('invalid replacement retires predictions; later valid compare uses retained imported study',async()=>{await modelUpload({schema:'bad'});assert.equal(await evaljs("document.querySelector('#rm-result').children.length"),0);assert.match(await evaljs("document.querySelector('#rm-error').textContent"),/Wrong/);await evaljs("document.querySelector('#rm-form').requestSubmit()");assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/suppressed/);});
await check('late import cannot overwrite a newer numeric edit',async()=>{await evaljs(`(()=>{const d=new DataTransfer(),f=new File([${JSON.stringify(saved)}],'late.json');d.items.add(f);const e=document.querySelector('#rm-file');e.files=d.files;Object.defineProperty(e.files[0],'text',{value:()=>new Promise(r=>window.__releaseModel=()=>r(${JSON.stringify(saved)}))});e.dispatchEvent(new Event('change'));})()`);await evaljs("const x=document.querySelector('#rm-form [name=amin]');x.value='0';x.dispatchEvent(new Event('input',{bubbles:true}));window.__releaseModel()");await delay(100);assert.equal(await evaljs("document.querySelector('#rm-form [name=amin]').value"),'0');await evaljs("document.querySelector('#rm-form').requestSubmit()");assert.match(await evaljs("document.querySelector('#rm-status').textContent"),/No offered/);});
await check('completed asynchronous parent source adoption retires a comparison made while pending',async()=>{await modelUpload(authored);const parent=JSON.stringify(authored.input.study);await evaljs(`(()=>{const d=new DataTransfer(),f=new File([${JSON.stringify(parent)}],'parent.json');d.items.add(f);const e=document.querySelector('#ref-file');e.files=d.files;Object.defineProperty(e.files[0],'text',{value:()=>new Promise(r=>window.__parentRelease=()=>r(${JSON.stringify(parent)}))});e.dispatchEvent(new Event('change'));})()`);await evaljs("document.querySelector('#rm-form').requestSubmit()");assert.ok(await evaljs("document.querySelector('#rm-result').children.length")>0);await evaljs("window.__parentRelease()");await delay(100);assert.equal(await evaljs("document.querySelector('#rm-result').children.length"),0);});

const receiveUpload=async(selector,obj)=>{await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(obj))}],'receiving.json'));const e=document.querySelector(${JSON.stringify(selector)});e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(100);};
let requestSaved,receivedSaved;
await check('freeze explicit training source and export request before outcomes',async()=>{
 await modelUpload(authored);await evaljs("document.querySelector('#rr-condition').value='suppressed';document.querySelector('#rr-declare').checked=true;document.querySelector('#rr-freeze').click()");
 assert.match(await evaljs("document.querySelector('#rr-source').textContent"),/future-main-0/);
 await evaljs("window.__blobs={};const orig=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{const u=orig(b);window.__blobs[u]=b;return u};document.addEventListener('click',e=>{const a=e.target.closest('a[download]');if(a&&window.__blobs[a.href])window.__saved=window.__blobs[a.href].text();},true);document.querySelector('#rr-save').click()");requestSaved=JSON.parse(await evaljs('window.__saved'));assert.equal(requestSaved.outcomes.length,0);
});
const actual=await evaljs(`(async()=>{const {syntheticChallenge}=await import('/src/unknown-lab/paired-history.mjs');const nb=(target,seed)=>syntheticChallenge({count:32,seed,noiseSigma:.0001,duration:1,effect:target/(-Math.expm1(-1/1.3)),orderStrategy:'shuffled'});return {id:'actual-suppressed',role:'challenge',duration:1,main:{acquisitionId:'actual-main-1',notebook:nb(1-Math.exp(-1),2501)},reference:{acquisitionId:'actual-reference-1',notebook:nb(0,2502)}};})()`);
await check('actual acquisition separates achieved condition from joint model outcome',async()=>{
 await receiveUpload('#rr-actual',{schema:'worldlaw.reference-model-acquisition/v1',request:requestSaved.request,runs:[actual]});
 const text=await evaljs("document.querySelector('#rr-results').textContent");assert.match(text,/reference offer achieved/);assert.match(text,/artifact-only.*jointly contradicted/s);assert.match(text,/additional-0.*jointly compatible/s);
});
await check('receiving save and fresh-page reopen retains original actual source',async()=>{
 await evaljs("document.querySelector('#rr-save').click()");const saved=await evaljs('window.__saved');receivedSaved=JSON.parse(saved);assert.equal(JSON.parse(saved).outcomes[0].main.acquisitionId,actual.main.acquisitionId);await writeFile(path.join(out,'request-received-source.json'),saved);
 await send('Page.navigate',{url:origin+'/unknown-lab.html'});await wait("!!document.querySelector('#rr-open')");await receiveUpload('#rr-open',JSON.parse(saved));assert.match(await evaljs("document.querySelector('#rr-results').textContent"),/artifact-only.*jointly contradicted/s);
});
await check('missed reference and wider achieved precision remain original visible evidence',async()=>{
 await receiveUpload('#rr-open',requestSaved);
 const missed=await evaljs(`(async()=>{const {syntheticChallenge}=await import('/src/unknown-lab/paired-history.mjs');const nb=(target,seed)=>syntheticChallenge({count:32,seed,noiseSigma:.1,duration:1,effect:target/(-Math.expm1(-1/1.3)),orderStrategy:'shuffled'});return {id:'missed-offer',role:'challenge',duration:1,main:{acquisitionId:'missed-main',notebook:nb(2*(1-Math.exp(-1)),2601)},reference:{acquisitionId:'missed-reference',notebook:nb(1-Math.exp(-1),2602)}};})()`);
 await receiveUpload('#rr-actual',{schema:'worldlaw.reference-model-acquisition/v1',request:requestSaved.request,runs:[missed]});const text=await evaljs("document.querySelector('#rr-results').textContent");assert.match(text,/reference offer NOT achieved/);assert.match(text,/main precision NOT achieved/);assert.match(await evaljs("document.querySelector('#rr-status').textContent"),/1 actual/);assert.match(text,/artifact-only.*jointly compatible/s);
 await receiveUpload('#rr-open',receivedSaved);
});
await check('wrong source refuses transactionally and delayed reopen loses to parent edit',async()=>{
 const bad=structuredClone(requestSaved.request);bad.input.amplitudeBounds=[0,1.1];await receiveUpload('#rr-actual',{schema:'worldlaw.reference-model-acquisition/v1',request:bad,runs:[actual]});assert.match(await evaljs("document.querySelector('#rr-error').textContent"),/complete frozen/);assert.match(await evaljs("document.querySelector('#rr-status').textContent"),/1 actual/);
 await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File(['x'],'late.json'));const e=document.querySelector('#rr-open');e.files=d.files;Object.defineProperty(e.files[0],'text',{value:()=>new Promise(r=>window.__releaseRequest=()=>r(${JSON.stringify(JSON.stringify(requestSaved))}))});e.dispatchEvent(new Event('change'));})()`);
 await evaljs("const e=document.querySelector('#rm-form [name=amax]');e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}));window.__releaseRequest()");await delay(100);assert.match(await evaljs("document.querySelector('#rr-source').textContent"),/STALE/);assert.match(await evaljs("document.querySelector('#rr-status').textContent"),/1 actual/);
});

await check('completed pending comparison adoption marks reopened child stale without losing outcomes',async()=>{
 await evaljs(`(()=>{const d=new DataTransfer();d.items.add(new File(['x'],'pending-parent.json'));const e=document.querySelector('#rm-file');e.files=d.files;Object.defineProperty(e.files[0],'text',{value:()=>new Promise(r=>window.__releaseComparison=()=>r(${JSON.stringify(JSON.stringify(authored))}))});e.dispatchEvent(new Event('change'));})()`);
 await receiveUpload('#rr-open',receivedSaved);assert.doesNotMatch(await evaljs("document.querySelector('#rr-source').textContent"),/STALE/);
 await evaljs('window.__releaseComparison()');await delay(100);assert.match(await evaljs("document.querySelector('#rr-source').textContent"),/STALE/);assert.match(await evaljs("document.querySelector('#rr-status').textContent"),/1 actual/);
});
for(const width of [1440,390,320])await check('keyboard and actual layout '+width,async()=>{await modelUpload(authored);await receiveUpload('#rr-open',receivedSaved);await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await evaljs("(()=>{const e=document.querySelector('#rm-form [name=amax]');e.scrollIntoView({behavior:'instant',block:'center'});e.focus()})()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("document.querySelector('#rm-status').textContent.includes('suppressed')");assert.equal(await evaljs("document.documentElement.scrollWidth<=innerWidth+1"),true);await evaljs("document.querySelector('#reference-request').scrollIntoView({behavior:'instant',block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'model-'+width+'.png'),Buffer.from(shot.data,'base64'));});
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
