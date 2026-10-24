import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/unknown-lab.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:'ignore'});
let diagnosticEval=null;
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];
const outputDir=process.env.BROWSER_ARTIFACT_DIR;
if(outputDir)await mkdir(outputDir,{recursive:true});
try {
 let port=null;
 for(let i=0;i<120;i++){try{const lines=(await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).trim().split('\n');port=Number(lines[0]);break;}catch{await delay(100);}}
 assert.ok(port,'Chrome DevTools port unavailable');
 let target=null;
 for(let i=0;i<60;i++){const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(x=>x.type==='page'&&x.url==='about:blank');if(target)break;await delay(100);}
 assert.ok(target,'Missing actual UNKNOWN LAB tab');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{
   const v=JSON.parse(e.data);
   if(v.id){const p=pending.get(v.id);if(!p)return;pending.delete(v.id);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}
   if(v.method==='Runtime.exceptionThrown')events.exceptions.push(v.params.exceptionDetails.text);
   if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(new URL(origin).origin))events.outside.push(v.params.request.url);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
 diagnosticEval=evaljs;
 const wait=async predicate=>{for(let i=0;i<70;i++){if(await evaljs(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate)};
 const check=async(name,fn)=>{await fn();out.push({name,passed:true})};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.navigate',{url:origin});
 await wait("document.readyState==='complete' && document.querySelector('#status')?.textContent.length>1");

 await check('probe panel starts without invented evidence',async()=>{assert.equal(await evaljs("document.querySelector('#probe-state').textContent"),'NO STUDY');});
 await check('correlated training remains ambiguous and reversed probes challenge sine response',async()=>{
  await evaljs("document.querySelector('#probe-example').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('#probe-state').textContent==='AMBIGUOUS'");
  assert.match(await evaljs("document.querySelector('#probe-models').textContent"),/Change proportional to ratecompatible.*compatible/);
  assert.match(await evaljs("document.querySelector('#probe-challenges').textContent"),/restoring.*contradicted/);
  assert.ok(await evaljs("document.querySelectorAll('#probe-plot line').length>5"));
 });
 let saved;
 await check('export actual inputs and reopen through file control',async()=>{
  await evaljs("window.probeBlob=null;window.originalCreate=URL.createObjectURL;URL.createObjectURL=b=>{window.probeBlob=b;return window.originalCreate(b)};document.querySelector('#probe-export').click()");
  saved=await evaljs('window.probeBlob.text()');const parsed=JSON.parse(saved);assert.equal(parsed.schema,'worldlaw.probe-response/v1');assert.ok(!('fit'in parsed));
  await evaljs("document.querySelector('#probe-example-kind').value='mixed';document.querySelector('#probe-example').click()");assert.equal(await evaljs("document.querySelector('#probe-state').textContent"),'NONE COMPATIBLE');
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(saved)}],'probe.json',{type:'application/json'}));const input=document.querySelector('#probe-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("document.querySelector('#probe-state').textContent==='AMBIGUOUS'");
 });
 await check('measured declaration retained; training subset reuse refuses atomically',async()=>{
  const measured=JSON.parse(saved);for(const r of measured.runs)r.notebook.source='measured';
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(measured))}],'declared.json',{type:'application/json'}));const input=document.querySelector('#probe-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);await wait("document.querySelector('#probe-summary').textContent.startsWith('measured')");
  const c=structuredClone(measured.runs[0]);c.id='reused-subset';c.role='challenge';c.notebook.trials=c.notebook.trials.slice(0,16);measured.runs.push(c);
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(measured))}],'reused.json',{type:'application/json'}));const input=document.querySelector('#probe-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);await wait("document.querySelector('#probe-error').textContent.includes('overlaps')");assert.equal(await evaljs("document.querySelector('#probe-state').textContent"),'AMBIGUOUS');
 });
 await check('older pending import cannot replace newer authored choice',async()=>{
  await evaljs(`(()=>{window.originalFileText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.releaseProbeRead=()=>resolve(${JSON.stringify(saved)}));};const dt=new DataTransfer();dt.items.add(new File(['slow'],'slow.json',{type:'application/json'}));const input=document.querySelector('#probe-file');input.files=dt.files;input.dispatchEvent(new Event('change'));document.querySelector('#probe-example-kind').value='mixed';document.querySelector('#probe-example').click();window.releaseProbeRead();File.prototype.text=window.originalFileText;})()`);await delay(100);assert.equal(await evaljs("document.querySelector('#probe-state').textContent"),'NONE COMPATIBLE');
 });
 await evaljs("document.querySelector('#probe-example-kind').value='ambiguous';document.querySelector('#probe-example').click()");
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<500});await delay(150);
  await evaljs("document.querySelector('#probe-title').scrollIntoView({behavior:'instant',block:'start'})");
  await check('probe layout '+width+'px and keyboard focus',async()=>{const x=await evaljs("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(x.scroll<=x.inner+1,JSON.stringify(x));await evaljs("document.querySelector('#probe-example').focus()");assert.equal(await evaljs('document.activeElement.id'),'probe-example');});
  await check('probe plot readable text and keyboard scroll '+width+'px',async()=>{
   const metrics=await evaljs("(()=>{const svg=document.querySelector('#probe-plot'),text=svg.querySelector('text'),region=document.querySelector('.probe-plot-scroll');return {fontPixels:parseFloat(getComputedStyle(text).fontSize)*text.getScreenCTM().a,plotWidth:svg.getBoundingClientRect().width,view:region.clientWidth,scroll:region.scrollWidth};})()");
   assert.ok(metrics.fontPixels>=12,JSON.stringify(metrics));assert.ok(metrics.plotWidth>=820,JSON.stringify(metrics));
   if(width<500){assert.ok(metrics.scroll>metrics.view,JSON.stringify(metrics));await evaljs("document.querySelector('.probe-plot-scroll').scrollLeft=0;document.querySelector('.probe-plot-scroll').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await wait("document.querySelector('.probe-plot-scroll').scrollLeft>0");}
   await evaljs("document.querySelector('.probe-plot-scroll').scrollLeft=0;document.querySelector('.probe-plot-scroll').scrollIntoView({behavior:'instant',block:'center'})");
  });
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,'worldlaw-probe-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('no script exceptions or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:true,results:out,events},null,2));
}catch(error){
 let page=null;try{page=await diagnosticEval?.("({state:document.querySelector('#probe-state')?.textContent,error:document.querySelector('#probe-error')?.textContent,focus:document.activeElement?.id,location:location.href})");}catch{}
 console.error(JSON.stringify({failure:error.message,completed:out,page,events},null,2));throw error;
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}

