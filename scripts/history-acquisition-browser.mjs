import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

if(!process.env.BROWSER_ARTIFACT_DIR)throw Error('Set BROWSER_ARTIFACT_DIR to preserve sandbox and browser receipts.');
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/unknown-lab.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];
const courseId='abcdefghijklmnopqrstuvwx';
let completedData;
const keyboardGeometry=[];
const outputDir=process.env.BROWSER_ARTIFACT_DIR;

const downloads=path.join(dir,'downloads');await mkdir(downloads);
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
 const wait=async predicate=>{for(let i=0;i<70;i++){if(await evaljs(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate)};
 const check=async(name,fn)=>{await fn();out.push({name,passed:true})};
 await send('Page.enable');await send('Runtime.enable');
 let sandbox;try{sandbox=await requireChromiumSandbox({send});}catch(error){if(error.receipt)await writeFile(path.join(outputDir,'sandbox.json'),JSON.stringify(error.receipt,null,2));throw error;}
 await writeFile(path.join(outputDir,'sandbox.json'),JSON.stringify(sandbox,null,2));
 await send('Network.enable');await send('Page.navigate',{url:origin});
 await wait("document.readyState==='complete' && !!document.querySelector('#history-acquisition')");
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const q="document.querySelector('#history-acquisition')";
 const click=selector=>evaljs(`${q}.querySelector(${JSON.stringify(selector)}).click()`);
 const open=async(text,slow=false)=>evaljs(`(()=>{const f=new File([${JSON.stringify(text)}],'worksheet.json',{type:'application/json'});${slow?"f.text=()=>new Promise(resolve=>{window.releaseWorksheetRead=()=>resolve("+JSON.stringify(text)+")});":""}const d=new DataTransfer();d.items.add(f);const input=${q}.querySelector('[data-action=open]');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await check('freeze blank chronological worksheet through real form',async()=>{
  await evaljs(`(()=>{const f=${q}.querySelector('form');f.closest('details').open=true;for(const [key,value] of Object.entries({id:${JSON.stringify(courseId)},count:8,seed:71,noiseSigma:.01,command:.2,position:.3,rate:-.1,preparation:'AB BA analytic receiver',sourceNote:'Authored control, not physical observations'}))f.elements[key].value=value;f.requestSubmit();})()`);
  await wait(`${q}.querySelectorAll('tbody tr').length===16`);
  assert.equal(await evaljs(`[...${q}.querySelectorAll('tbody input')].every(x=>x.value==='')`),true);
  await click('[data-action=apply]');assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  assert.equal(await evaljs(`document.activeElement===${q}.querySelector('[data-role=error]')`),true);
 });
 let partial;
 await check('actual downloaded partial worksheet distinguishes zero from missing and reopens',async()=>{
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=jointTorque]');x.value='0';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('[data-action=save]');
  for(let i=0;i<80;i++){try{partial=await readFile(path.join(downloads,`worldlaw-history-acquisition-${courseId}.json`),'utf8');break;}catch{await delay(100);}}
  assert.ok(partial,'Actual downloaded JSON missing');const data=JSON.parse(partial);
  assert.equal(data.readings[0].jointTorque,0);assert.equal(data.readings[1].jointTorque,null);assert.equal(data.orderConfirmed,false);
  await open(partial);await wait(`${q}.querySelector('tbody input[data-field=jointTorque]').value==='0'`);
  assert.equal(await evaljs(`${q}.querySelector('tbody tr:nth-child(2) input[data-field=jointTorque]').value`),'');
 });
 await check('late file completion cannot overwrite a newer handwritten reading',async()=>{
  await open(partial,true);
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=jointTorque]');x.value='7';x.dispatchEvent(new Event('input',{bubbles:true}));window.releaseWorksheetRead();})()`);
  await delay(150);assert.equal(await evaljs(`${q}.querySelector('tbody input[data-field=jointTorque]').value`),'7');
 });
 await check('separate analytic measurements apply only after explicit order confirmation',async()=>{
  await evaljs(`(()=>{for(const [i,row] of [...${q}.querySelectorAll('tbody tr')].entries()){const conditioned=row.dataset.history==='conditioned';for(const input of row.querySelectorAll('input')){const v={command:.2,position:.3,rate:-.1,jointTorque:10+.25*i+(conditioned?.6:0)};input.value=v[input.dataset.field];input.dispatchEvent(new Event('input',{bubbles:true}));}}})()`);
  await click('[data-action=apply]');assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  await click('[data-action=confirm]');await click('[data-action=apply]');
  await wait("document.querySelector('#source-badge').textContent==='USER-DECLARED MEASUREMENTS'");
  assert.equal(await evaljs("document.querySelector('#status').textContent"),'CHALLENGED');
  assert.match(await evaljs("document.querySelector('#order-adjustment').textContent"),/adjusted 0\.6 N·m/);
  assert.match(await evaljs("document.querySelector('#order-adjustment').textContent"),/estimated linear drift 0\.25 N·m/);
 });
 await check('editing a confirmed reading revokes confirmation and off-target evidence cannot replace comparison',async()=>{
  const before=await evaljs("document.querySelector('#offset').textContent");
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=command]');x.value='.202';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaljs(`${q}.querySelector('[data-action=confirm]').checked`),false);
  await click('[data-action=confirm]');await click('[data-action=apply]');
  assert.ok(await evaljs(`${q}.querySelector('[data-role=error]').textContent.length>0`));
  assert.equal(await evaljs("document.querySelector('#offset').textContent"),before);
  await evaljs(`(()=>{const x=${q}.querySelector('tbody input[data-field=command]');x.value='.2';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('[data-action=confirm]');await click('[data-action=apply]');
 });
 await check('completed worksheet actual download and reopen retain confirmation and supplied readings',async()=>{
  await rm(path.join(downloads,`worldlaw-history-acquisition-${courseId}.json`));await click('[data-action=save]');
  let text;for(let i=0;i<80;i++){try{text=await readFile(path.join(downloads,`worldlaw-history-acquisition-${courseId}.json`),'utf8');break;}catch{await delay(100);}}
  assert.ok(text);const data=JSON.parse(text);completedData=data;assert.equal(data.orderConfirmed,true);assert.ok(data.readings.every(r=>typeof r.jointTorque==='number'));
  await open(text);await wait(`${q}.querySelector('[data-action=confirm]').checked`);
  const observed=await evaljs(`[...${q}.querySelectorAll('tbody input[data-field=jointTorque]')].map(x=>Number(x.value))`);
  assert.deepEqual(observed,data.readings.map(r=>r.jointTorque));
 });
 const pressTab=async(reverse=false)=>{
  const params={key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:reverse?8:0};
  await send('Input.dispatchKeyEvent',{type:'keyDown',...params});await send('Input.dispatchKeyEvent',{type:'keyUp',...params});
  await delay(50);
 };
 const visibleReading=async()=>evaljs(`(()=>{
  const input=document.activeElement,row=input.closest('tbody tr'),wrap=${q}.querySelector('.table-wrap');
  if(!row||!input.matches('input[data-field]'))return {invalidFocus:true,active:input.tagName};
  const header=row.querySelector('th[scope=row]');
  const detail=header.querySelector('.history-reading-preparation');
  const visible=node=>{if(!node||getComputedStyle(node).display==='none')return false;const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&(()=>{const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===node||node.contains(hit)})();};
  const preparation=detail&&visible(detail)?detail:row.children[1];
  const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const r=input.getBoundingClientRect(),w=wrap.getBoundingClientRect();
  const corners=[[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2]];
  return {index:Number(input.dataset.index),field:input.dataset.field,value:input.value,label:input.getAttribute('aria-label'),identity:header.textContent,preparation:preparation.textContent,identityVisible:visible(header),preparationVisible:visible(preparation),input:rect(input),identityRect:rect(header),wrap:rect(wrap),viewport:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth},scrollLeft:wrap.scrollLeft,inputVisible:r.left>=Math.max(0,w.left)&&r.right<=Math.min(innerWidth,w.right)&&r.top>=0&&r.bottom<=innerHeight,unoccluded:corners.every(([x,y])=>document.elementFromPoint(x,y)===input)};
 })()`);
 const capture=async(name)=>{await evaljs('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,name+'.png'),Buffer.from(shot.data,'base64'));};
 for(const width of [1440,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaljs("document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto'");await delay(150);
  await evaljs(`${q}.querySelector('tbody input').focus()`);await delay(70);
  const observations=[],failures=[];
  assert.notEqual(completedData.readings[0].history,completedData.readings[1].history,'Both preparations must be exercised');
  const receive=async(index,field,direction)=>{
   const g=await visibleReading();g.direction=direction;observations.push(g);
   const wanted=completedData.readings[index];
   if(g.index!==index||g.field!==field)failures.push(`focus ${index}/${field}: ${JSON.stringify(g)}`);
   if(g.value!==String(wanted[field]))failures.push(`reading value changed ${index}/${field}`);
   if(!g.identity?.includes(wanted.pairId)||g.preparation?.trim()!==wanted.history)failures.push(`wrong visible source identity ${index}/${field}`);
   if(!g.identityVisible||!g.preparationVisible||!g.inputVisible||!g.unoccluded)failures.push(`clipped or occluded source/value ${index}/${field} ${direction}`);
   if(g.viewport?.scroll>width+1)failures.push(`page width ${g.viewport.scroll} exceeds ${width}`);
  };
  const fields=['command','position','rate','jointTorque'];
  for(let i=0;i<8;i++){
   if(i)await pressTab();await receive(Math.floor(i/4),fields[i%4],'forward');
   if(i===3)await capture(`history-acquisition-${width}-entry`);
  }
  for(let i=6;i>=0;i--){await pressTab(true);await receive(Math.floor(i/4),fields[i%4],'reverse');}
  await capture(`history-acquisition-${width}-first-field`);
  const visibleState={width,observations,failures};keyboardGeometry.push(visibleState);
  out.push({name:`complete reading identity and all fields through Tab/ShiftTab at ${width}px`,passed:failures.length===0,failures});
 }
 await writeFile(path.join(outputDir,'keyboard-geometry.json'),JSON.stringify(keyboardGeometry,null,2));
 await check('keyboard traversal preserves the exact completed portable acquisition',async()=>{
  await rm(path.join(downloads,`worldlaw-history-acquisition-${courseId}.json`));await click('[data-action=save]');
  let text;for(let i=0;i<80;i++){try{text=await readFile(path.join(downloads,`worldlaw-history-acquisition-${courseId}.json`),'utf8');break;}catch{await delay(100);}}
  assert.ok(text);assert.deepEqual(JSON.parse(text),completedData);
 });
 assert.ok(out.every(x=>x.passed),'Reading identity or complete input visibility failed; inspect keyboard-geometry.json and actual captures.');
 assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);
 const receipt={pass:true,checks:out,events};await writeFile(path.join(outputDir,'browser-result.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){const receipt={pass:false,checks:out,events,error:error.message,keyboardGeometry};await writeFile(path.join(outputDir,'browser-result.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));process.exitCode=1;}finally{try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));}
