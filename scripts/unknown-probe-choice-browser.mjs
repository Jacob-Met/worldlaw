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
   if(v.id){const p=pending.get(v.id);if(!p)return;pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}
   if(v.method==='Runtime.exceptionThrown')events.exceptions.push(v.params.exceptionDetails.text);
   if(v.method==='Network.requestWillBeSent'&&new URL(v.params.request.url).origin!==new URL(origin).origin)events.outside.push(v.params.request.url);
 });
 ws.addEventListener('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Chrome debugging connection closed'));}pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out CDP '+method));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
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
 await check('probe chooser uses current training and chooses cheaper complete separation by keyboard',async()=>{
  await evaljs("document.querySelector('#probe-choice-run').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('#probe-choice-status').textContent.includes('zero-rate')");assert.match(await evaljs("document.querySelector('#probe-choice-status').textContent"),/effort 2, 1\/1/);assert.equal(await evaljs("document.querySelectorAll('#probe-choice-results tr').length"),3);
 });
 await check('assumption edits revoke request and changed precision and budget change decision',async()=>{
  await evaljs("document.querySelector('#probe-choice-radius').value='.2';document.querySelector('#probe-choice-radius').dispatchEvent(new Event('input',{bubbles:true}))");assert.equal(await evaljs("document.querySelector('#probe-choice-export').disabled"),true);
  await evaljs("document.querySelector('#probe-choice-run').click()");assert.match(await evaljs("document.querySelector('#probe-choice-status').textContent"),/reversed/);
  await evaljs("document.querySelector('#probe-choice-budget').value='2';document.querySelector('#probe-choice-budget').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#probe-choice-run').click()");assert.equal(await evaljs("document.querySelector('#probe-choice-export').disabled"),true);assert.match(await evaljs("document.querySelector('#probe-choice-status').textContent"),/Every affordable/);
  await evaljs("document.querySelector('#probe-choice-budget').value='4';document.querySelector('#probe-choice-radius').value='.01';document.querySelector('#probe-choice-run').click()");
 });
 let request;
 await check('request export and reopen recompute inputs instead of trusting cached selection',async()=>{
  await evaljs("window.choiceBlob=null;URL.createObjectURL=b=>{window.choiceBlob=b;return window.originalCreate(b)};document.querySelector('#probe-choice-export').click()");request=await evaljs('window.choiceBlob.text()');const value=JSON.parse(request);assert.equal(value.selected.id,'zero-rate');assert.ok(value.training.runs.every(r=>r.role==='training'));value.selected={id:'forged'};value.candidates=[];
  await evaljs("document.querySelector('#probe-example-kind').value='mixed';document.querySelector('#probe-example').click()");assert.equal(await evaljs("document.querySelector('#probe-choice-export').disabled"),true);
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'request.json',{type:'application/json'}));const input=document.querySelector('#probe-choice-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);await wait("document.querySelector('#probe-choice-status').textContent.includes('zero-rate')");assert.equal(await evaljs("document.querySelector('#probe-choice-export').disabled"),false);
 });
 await check('late request file cannot replace edited acquisition assumptions',async()=>{
  await evaljs(`(()=>{window.savedChoiceText=File.prototype.text;File.prototype.text=()=>new Promise(resolve=>window.releaseChoiceRead=()=>resolve(${JSON.stringify(request)}));const dt=new DataTransfer();dt.items.add(new File(['pending'],'pending.json',{type:'application/json'}));const input=document.querySelector('#probe-choice-file');input.files=dt.files;input.dispatchEvent(new Event('change'));document.querySelector('#probe-choice-budget').value='.5';document.querySelector('#probe-choice-budget').dispatchEvent(new Event('input',{bubbles:true}));window.releaseChoiceRead();File.prototype.text=window.savedChoiceText;})()`);await delay(100);assert.equal(Number(await evaljs("document.querySelector('#probe-choice-budget').value")),.5);assert.equal(await evaljs("document.querySelector('#probe-choice-export').disabled"),true);
 });
 await check('reopened request supersedes an older pending study import',async()=>{
  await evaljs("document.querySelector('#probe-example-kind').value='mixed';document.querySelector('#probe-example').click();window.pendingMixedJSON=null");
  await evaljs("import('/src/unknown-lab/probe-fixture.mjs').then(m=>{window.pendingMixedJSON=JSON.stringify(m.probeExample('mixed'));})");
  await evaljs(`(()=>{window.choiceOriginalText=File.prototype.text;File.prototype.text=function(){return this.name==='older-study.json'?new Promise(resolve=>window.releaseOldStudy=()=>resolve(window.pendingMixedJSON)):window.choiceOriginalText.call(this);};const dt=new DataTransfer();dt.items.add(new File(['pending'],'older-study.json',{type:'application/json'}));const input=document.querySelector('#probe-file');input.files=dt.files;input.dispatchEvent(new Event('change'));const newer=new DataTransfer();newer.items.add(new File([${JSON.stringify(request)}],'newer-request.json',{type:'application/json'}));const requestInput=document.querySelector('#probe-choice-file');requestInput.files=newer.files;requestInput.dispatchEvent(new Event('change'));})()`);
  await wait("document.querySelector('#probe-choice-status').textContent.includes('zero-rate')");await evaljs("window.releaseOldStudy();File.prototype.text=window.choiceOriginalText");await delay(100);assert.equal(await evaljs("document.querySelector('#probe-state').textContent"),'AMBIGUOUS');
 });
 await evaljs("document.querySelector('#probe-choice-budget').value='4';document.querySelector('#probe-example-kind').value='ambiguous';document.querySelector('#probe-example').click();document.querySelector('#probe-choice-run').click()");

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
  await check('probe chooser narrow controls and focus '+width+'px',async()=>{
   await evaljs("document.querySelector('#probe-choice-title').scrollIntoView({behavior:'instant',block:'start'});document.querySelector('#probe-choice-run').focus()");assert.equal(await evaljs('document.activeElement.id'),'probe-choice-run');
   const size=await evaljs("({width:innerWidth,page:document.documentElement.scrollWidth})");assert.ok(size.page<=size.width+1,JSON.stringify(size));
   const bounds=await evaljs("(()=>{const panel=document.querySelector('.probe-choice').getBoundingClientRect();return {left:panel.left,right:panel.right,viewport:innerWidth,inputs:['probe-choice-budget','probe-choice-radius'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};})};})()");
   for(const input of bounds.inputs){assert.ok(input.width>0&&input.left>=bounds.left-.5&&input.right<=bounds.right+.5&&input.left>=0&&input.right<=bounds.viewport,JSON.stringify(bounds));}
   if(width<=520)assert.ok(bounds.inputs[1].top>=bounds.inputs[0].bottom,JSON.stringify(bounds));
  });
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,'worldlaw-probe-choice-'+width+'.png'),Buffer.from(shot.data,'base64'));}
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

