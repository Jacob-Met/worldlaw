import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

async function decoderBoundaryCourse(encoded) {
 const {loadVideo}=await import('/src/motion/video.mjs');
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 const source=await loadVideo(new File([bytes],'authored-boundary.webm',{type:'video/webm'}));
 const video=[...document.querySelectorAll('video')].at(-1),originalCallback=video.requestVideoFrameCallback.bind(video);
 let requests=0,suppressCallbacks=false;video.requestVideoFrameCallback=callback=>{requests++;return originalCallback((...args)=>{if(!suppressCallbacks)callback(...args)})};
 const checks=[],require=(value,message)=>{if(!value)throw Error(message)};
 const hash=data=>{let value=2166136261;for(const byte of data){value^=byte;value=Math.imul(value,16777619)}return value>>>0};
 const isReuse=frame=>frame.timingNote.startsWith('Previously decoded');
 const reject=async(action,pattern)=>{try{await action()}catch(error){require(pattern.test(error.name+' '+error.message),'Unexpected refusal: '+error);return}throw Error('Expected refusal '+pattern)};
 const warm=async time=>{const frame=await source.frameAt(time);require(frame.timeBasis==='decoded-media-time','Warm-up needs real decoded metadata');const repeat=await source.frameAt(time);require(isReuse(repeat),'Warm-up did not establish reusable exact evidence');return frame};
 try{
  const first=await source.frameAt(.27);
  require(first.timeBasis==='decoded-media-time','First boundary sample is not decoded');
  const expected={time:first.time,width:first.width,hash:hash(first.data),presentedFrames:first.presentedFrames};
  const initialRequests=requests;
  first.data[0]^=255;first.time=999;first.width=-1;first.presentedFrames=-1;
  const repeat=await source.frameAt(.27);
  require(isReuse(repeat)&&repeat.time===expected.time&&repeat.width===expected.width&&repeat.presentedFrames===expected.presentedFrames&&hash(repeat.data)===expected.hash,'First returned object corrupted private evidence');
  repeat.data[1]^=255;repeat.time=888;
  const alias=await source.frameAt(expected.time);
  require(isReuse(alias)&&alias.time===expected.time&&alias.requestedTime===expected.time&&hash(alias.data)===expected.hash&&requests===initialRequests,'Decoded-time alias or independent pixel copies failed');
  checks.push('private pixels/scalar metadata and exact decoded-time alias');
  let count=requests;
  const nearby=await source.frameAt(.26);
  require(requests>count&&!isReuse(nearby),'Unequal nearby request reused an inferred frame interval');
  require(['decoded-media-time','requested-seek-time'].includes(nearby.timeBasis),'Unexpected nearby timing provenance');
  checks.push('unequal nearby request uses a new native decode');
  // The browser may deliver an exact callback for equal-looking frames. Withhold
  // callback delivery explicitly to exercise fallback without inventing metadata.
  suppressCallbacks=true;count=requests;const fallback=await source.frameAt(.5);
  require(requests>count&&!isReuse(fallback)&&fallback.timeBasis==='requested-seek-time','Missing callback did not preserve nominal fallback');
  count=requests;const repeatedFallback=await source.frameAt(.5);suppressCallbacks=false;
  require(requests>count&&!isReuse(repeatedFallback)&&repeatedFallback.timeBasis==='requested-seek-time','Fallback was cached or promoted to decoded evidence');
  checks.push('controlled withheld callbacks: fallback is never cached or promoted');
  await warm(.75);await source.frameAt(1.25);count=requests;const back=await source.frameAt(.75);
  require(requests>count&&!isReuse(back),'A to B to A resurrected an older retained frame');
  checks.push('one-entry replacement does not resurrect an earlier frame');
  const eventControls=[];
  for(const [i,event] of ['seeking','play','emptied','error'].entries()){
   const time=i%2?1.25:.75;await warm(time);count=requests;
   video.dispatchEvent(new Event(event));
   const result=await source.frameAt(time);
   require(requests>count&&!isReuse(result),'Warm snapshot survived '+event);
   eventControls.push({event,mode:'controlled DOM event on a warm paused decoder',basis:result.timeBasis});
  }
  checks.push('warm-cache seeking/play/emptied/error invalidation');
  await warm(1.75);
  const externalSeek=time=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('External seek did not complete')),3000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true});video.currentTime=time});
  await externalSeek(2.25);await externalSeek(1.75);count=requests;
  const externallyReturned=await source.frameAt(1.75);
  require(requests>count&&!isReuse(externallyReturned),'External away/back seek reused an obsolete snapshot');
  checks.push('actual external media seeks retire an old occurrence');
  await warm(.5);
  for(const time of [NaN,-.1,source.duration+1])await reject(()=>source.frameAt(time),/Seek time/);
  const aborted=new AbortController();aborted.abort();
  await reject(()=>source.frameAt(.5,{signal:aborted.signal}),/AbortError/);
  const active=source.frameAt(1.25);
  await reject(()=>source.frameAt(1.25),/already being decoded/);
  await active;
  const cancellation=new AbortController(),cancelled=source.frameAt(2.25,{signal:cancellation.signal});cancellation.abort();
  await reject(()=>cancelled,/AbortError/);
  if(video.seeking)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Cancelled seek did not settle')),3000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true})});
  count=requests;const afterAbort=await source.frameAt(1.25);
  require(requests>count&&!isReuse(afterAbort),'Aborted uncached decode resurrected prior evidence');
  checks.push('range, pre-abort, concurrency and in-flight cancellation contracts');
  const endpoint=await source.frameAt(source.duration);count=requests;const endpointRepeat=await source.frameAt(source.duration);
  require(endpoint.timeBasis==='decoded-media-time'&&endpointRepeat.time===endpoint.time&&endpointRepeat.requestedTime===endpoint.requestedTime&&requests===count&&isReuse(endpointRepeat),'End-time clamping changed across reuse');
  checks.push('existing end-of-source clamp is preserved');
  source.dispose();await reject(()=>source.frameAt(.5),/released/);
  checks.push('disposal forbids retained reads');
  return {checks,eventControls,callbackRequests:requests,firstDecodedTime:expected.time,nearbyTimeBasis:nearby.timeBasis,fallbackControl:{mode:'real media seeks with frame-callback delivery withheld',time:fallback.time,basis:fallback.timeBasis,repeatBasis:repeatedFallback.timeBasis}};
 } finally {source.dispose()}
}

const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-frame-revisit-'));
const output=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'evidence');
await mkdir(output,{recursive:true});
let fixture=process.env.MOTION_FIXTURE;
if(!fixture){
 fixture=path.join(dir,'authored-paused-marker.webm');
 const frames=Buffer.alloc(60*160*96*3);
 for(let i=0;i<60;i++)for(let y=0;y<96;y++)for(let x=0;x<160;x++){
  const b=30+((Math.floor(x/8)+Math.floor(y/8))%2)*18,p=((i*96+y)*160+x)*3;
  const c=Math.abs(x-48)<10&&Math.abs(y-48)<10?[240,80,35]:[b,b,b];
  frames[p]=c[0];frames[p+1]=c[1];frames[p+2]=c[2];
 }
 const encoded=spawnSync('ffmpeg',['-nostdin','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size','160x96','-framerate','20','-i','pipe:0','-c:v','libvpx-vp9','-lossless','1','-threads','1','-y',fixture],{input:frames,maxBuffer:4*1024*1024});
 assert.equal(encoded.status,0,encoded.stderr?.toString()||'ffmpeg fixture generation failed');
}
const fixtureBytes=await readFile(fixture),fixtureSha256=createHash('sha256').update(fixtureBytes).digest('hex');
await writeFile(path.join(output,'authored-input.webm'),fixtureBytes);
const videoBytes=await readFile(new URL('../src/motion/video.mjs',import.meta.url));
const videoBlob=createHash('sha1').update('blob '+videoBytes.length+'\0').update(videoBytes).digest('hex');
const server=createProductServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='',ws,seq=0,sandbox,diagnostic=null;
chrome.stderr.on('data',data=>stderr=(stderr+data).slice(-9000));
const pending=new Map(),checks=[],exceptions=[],measurements={fixtureSha256,videoBlob};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let port;for(let i=0;i<100;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break}catch{await delay(100)}}
 assert.ok(port,'Missing isolated Chrome');
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.id){const request=pending.get(value.id);if(!request)return;pending.delete(value.id);clearTimeout(request.timer);value.error?request.reject(Error(value.error.message)):request.resolve(value.result)}if(value.method==='Runtime.exceptionThrown')exceptions.push(value.params.exceptionDetails)});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},40000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(40)}throw Error('Timed out: '+expression)};
 const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
 const values=map=>evaluate('(()=>{for(const [id,value] of Object.entries('+JSON.stringify(map)+')){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("input",{bubbles:true}));}})()');
 const upload=async(id,file)=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id});await send('DOM.setFileInputFiles',{nodeId,files:[file]})};
 const downloads=path.join(dir,'downloads');await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const download=async name=>{const p=path.join(downloads,name);for(let i=0;i<100;i++){try{const text=await readFile(p,'utf8');JSON.parse(text);return text}catch{await delay(40)}}throw Error('Missing complete download '+name)};
 const save=async name=>{await rm(path.join(downloads,'worldlaw-motion-notebook.json'),{force:true});await click('save-notebook');const text=await download('worldlaw-motion-notebook.json');await writeFile(path.join(output,name+'.json'),text);return JSON.parse(text)};
 const exportStudio=async name=>{
  const filename='worldlaw-motion-studio-observations.json';await rm(path.join(downloads,filename),{force:true});
  await values({'known-inertia':'1','declared-command':'0','position-sigma':'0.001'});
  await evaluate('(()=>{const e=document.getElementById("confirm-physics");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  assert.equal(await evaluate('document.getElementById("export-studio").disabled'),false,'Export is unexpectedly unavailable');
  await click('export-studio');
  await wait('!document.getElementById("studio-export-status").textContent.startsWith("Preparing")');
  const status=await evaluate('({status:document.getElementById("studio-export-status").textContent,error:document.getElementById("motion-error").hidden?null:document.getElementById("motion-error").textContent})');
  if(status.status.startsWith('Exported ')){const text=await download(filename);await writeFile(path.join(output,name+'.json'),text);const d=JSON.parse(text);return {...status,exported:true,rows:d.observations.length,heldOut:d.heldOut.length}}
  return {...status,exported:false};
 };
 const screenshot=async name=>{await evaluate('document.getElementById("evidence-canvas").scrollIntoView({block:"center",behavior:"instant"})');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'))};
 diagnostic=()=>evaluate('({error:document.getElementById("motion-error")?.textContent,notice:document.getElementById("motion-notice")?.textContent,frame:document.getElementById("frame-size")?.textContent,accepted:document.getElementById("accepted-count")?.textContent,active:document.activeElement?.id})');
 sandbox=await requireChromiumSandbox({send});await writeFile(path.join(output,'sandbox.json'),JSON.stringify(sandbox,null,2));
 await send('Runtime.enable');await send('Page.navigate',{url:origin+'/motion.html'});
 await wait('document.readyState==="complete"&&document.getElementById("load-video")');
 await upload('video-file',fixture);
 await wait('document.getElementById("motion-notice").textContent.includes("Video decoded locally")');
 await values({'sample-step':'0.1','patch-radius':'12','track-until':'2.5'});
 await click('pick-pivot');await values({'point-x':'48','point-y':'10'});await click('apply-point');
 await values({'point-x':'48','point-y':'48'});await click('apply-point');
 await wait('document.getElementById("motion-notice").textContent.includes("Manual marker anchor saved")');
 await click('track-motion');
 await wait('document.getElementById("motion-notice").textContent.startsWith("Tracking complete.")||document.getElementById("motion-notice").textContent.startsWith("Tracking paused")||!document.getElementById("motion-error").hidden');
 const before=await save('before-revisit');assert.equal(before.source.sha256,fixtureSha256);
 const last=before.measurements.at(-1);measurements.before={count:before.measurements.length,time:last.time,basis:last.timeBasis,status:last.status};
 assert.equal(last.time,2.5,'Fixture did not reach the intended final decoded frame');
 assert.equal(last.timeBasis,'decoded-media-time');
 measurements.beforeExport=await exportStudio('before-revisit-studio');
 assert.equal(measurements.beforeExport.exported,true,'Baseline source must already be eligible before its repeated request');
 checks.push('actual file input, pivot/marker, tracking and initial Studio export');
 const start=performance.now();
 await evaluate('document.querySelectorAll(".measurement-time")[document.querySelectorAll(".measurement-time").length-1].click()');
 await wait('!document.getElementById("pick-marker").disabled');
 measurements.revisitElapsedMs=performance.now()-start;
 await click('correct-point');await values({'point-x':'48','point-y':'48'});
 await evaluate('document.getElementById("apply-point").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await wait('document.getElementById("motion-notice").textContent.includes("Manual marker anchor saved")');
 const after=await save('after-revisit');const corrected=after.measurements.find(row=>row.time===last.time);
 measurements.after={time:corrected?.time,basis:corrected?.timeBasis,status:corrected?.status,point:corrected?.point};
 measurements.afterExport=await exportStudio('after-revisit-studio');
 await screenshot('revisited-frame-desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await screenshot('revisited-frame-narrow');
 // A new decoder must earn its own timestamp after saved evidence is reopened.
 await upload('notebook-file',path.join(output,'after-revisit.json'));
 await wait('document.getElementById("motion-notice").textContent.startsWith("Notebook reopened")');
 await evaluate('document.querySelectorAll(".measurement-time")[document.querySelectorAll(".measurement-time").length-1].click()');
 await click('attach-video');await upload('video-file',fixture);
 await wait('document.getElementById("motion-notice").textContent.includes("Video reconnected")');
 const reopened=await save('reopened-reconnected');
 assert.equal(reopened.source.sha256,fixtureSha256);
 assert.deepEqual(reopened.measurements,after.measurements,'Reattachment changed saved source evidence');
 checks.push('saved notebook and original-file reattachment preserve the complete measurement course');
 assert.equal(corrected.time,last.time,'Correction changed the decoded occurrence');
 assert.equal(corrected.status,'manual');
 assert.equal(corrected.timeBasis,'decoded-media-time','Revisiting and correcting a decoded frame degraded its timestamp provenance');
 assert.equal(measurements.afterExport.exported,true,'Correction lost original Studio export eligibility');
 assert.ok(measurements.revisitElapsedMs<1000,'Repeated access retained a timeout-scale wait');
 assert.deepEqual(exceptions,[]);
 checks.push('keyboard correction retains decoded timing and ordinary Studio eligibility without timeout-scale delay');
 measurements.decoderBoundaries=await evaluate('('+decoderBoundaryCourse.toString()+')('+JSON.stringify(fixtureBytes.toString('base64'))+')');
 checks.push(...measurements.decoderBoundaries.checks);
 const receipt={passed:true,checks,measurements,sandboxAdmitted:sandbox.admitted,scope:'Authored diagnostic pixels and declared dynamics; no physical-law qualification'};
 await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(error){const receipt={passed:false,checks,measurements,error:error.message,diagnostic:diagnostic?await diagnostic().catch(()=>null):null,sandboxAdmitted:sandbox?.admitted,stderr,exceptions};await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.error(JSON.stringify(receipt));process.exitCode=1}
finally{ws?.close();for(const p of pending.values())clearTimeout(p.timer);if(chrome.exitCode===null){const exited=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([exited,delay(2000)]);if(chrome.exitCode===null){chrome.kill('SIGKILL');await exited}}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(!output.startsWith(dir+path.sep))await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
