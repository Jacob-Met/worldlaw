import {requireChromiumSandbox} from '../tests/support/chromium-sandbox.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,origin=base+'/coupling.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-coupling-chrome-'));
const outputDir=process.env.BROWSER_ARTIFACT_DIR||await mkdtemp(path.join(os.tmpdir(),'worldlaw-circulation-receipts-'));
await mkdir(outputDir,{recursive:true});const downloads=await mkdtemp(path.join(outputDir,'downloads-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1050','about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]},checks=[];
let sandbox=null,failed=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let port;
  for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}}
  assert.ok(port,'Chrome did not expose its supported debugger endpoint.');
  let target;
  for(let i=0;i<60;i++){target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page'&&t.url==='about:blank');if(target)break;await delay(100);}
  assert.ok(target,'Coupling Lab browser target absent.');ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(new Error(v.error.message)):p.resolve(v.result);}}
    if(v.method==='Runtime.exceptionThrown')events.exceptions.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);
    if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(base)&&!v.params.request.url.startsWith('blob:'+base))events.outside.push(v.params.request.url);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Debugger timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async predicate=>{for(let i=0;i<100;i++){if(await evaluate(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate);};
  const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS '+name);};
  const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const text=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const importValue=async(value,name='evidence.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById('notebook-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
  const course=async kind=>{await evaluate(`document.getElementById('course').value=${JSON.stringify(kind)}`);await click('restart');};
  const acquire=async()=>{await click('use-proposal');await click('acquire-virtual');};
  sandbox=await requireChromiumSandbox({send});await writeFile(path.join(outputDir,'sandbox.json'),JSON.stringify(sandbox,null,2));
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await send('Page.navigate',{url:origin});
  await wait("document.querySelectorAll('#models tr').length===3");
  const setPath=async pathValue=>evaluate(`(()=>{const el=document.getElementById('circulation-input');el.value=${JSON.stringify(JSON.stringify(pathValue))};el.dispatchEvent(new Event('input'));})()`);
  const input=()=>evaluate("JSON.parse(document.getElementById('circulation-input').value)");
  await check('actual loop geometry and all fitted laws receive a complete separate path',async()=>{
    const before=await text('counts');await click('circulation-run');assert.match(await text('circulation-result'),/Observed polygon work 2 J/);
    assert.equal(await evaluate("document.querySelectorAll('#circulation-result tr').length"),4);assert.equal(await text('counts'),before);
    assert.ok(await evaluate("document.querySelector('#circulation-result polyline').getAttribute('points').length>20"));
  });
  await check('keyboard run, reversal and wide bounds alter actual computed receiving',async()=>{
    const p=await input();p.samples.reverse();await setPath(p);assert.equal(await text('circulation-result'),'');
    await send('Page.bringToFront');
    await evaluate("(()=>{window.circulationKeys=[];const b=document.getElementById('circulation-run');for(const type of ['keydown','keypress','keyup','click'])b.addEventListener(type,e=>window.circulationKeys.push({type:e.type,key:e.key,trusted:e.isTrusted,prevented:e.defaultPrevented}));b.focus();})()");
    assert.equal(await evaluate("document.activeElement.id"),'circulation-run','Keyboard activation must target the visible comparison button.');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    try {await wait("document.getElementById('circulation-result').textContent.includes('Observed polygon work -2 J')");}
    finally {await writeFile(path.join(outputDir,'keyboard.json'),JSON.stringify(await evaluate("({active:document.activeElement.id,status:document.getElementById('circulation-status').textContent,events:window.circulationKeys})"),null,2));}
    assert.match(await text('circulation-result'),/Observed polygon work -2 J/);
    p.samples.forEach(s=>s.torqueRadius=[2,2]);await setPath(p);await click('circulation-run');assert.match(await text('circulation-result'),/zero-compatible/);
  });
  await check('download and input-only reopened replay preserve source without replacing active notebook',async()=>{
    await click('circulation-save');let names=[];for(let i=0;i<60;i++){names=(await readdir(downloads)).filter(x=>x.endsWith('.json'));if(names.length)break;await delay(50);}assert.equal(names.length,1);
    const raw=JSON.parse(await readFile(path.join(downloads,names[0]),'utf8'));assert.equal(raw.report,undefined);assert.equal(raw.schema,'worldlaw.coupling-circulation-notebook/v1');
    const before=await text('counts');const doc=await send('DOM.getDocument');const fileNode=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#circulation-open'});await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[path.join(downloads,names[0])]});
    await wait("document.getElementById('circulation-status').textContent.includes('Recomputed')");assert.equal(await text('counts'),before);assert.match(await text('circulation-result'),/zero-compatible/);
  });
  await check('malformed closure refuses, source strings remain text, and source replacement invalidates',async()=>{
    const p=await input();p.samples.pop();await setPath(p);await click('circulation-run');assert.match(await text('circulation-status'),/return to both/);assert.equal(await text('circulation-result'),'');
    await click('circulation-load');const good=await input();good.source.label='<img src=x onerror=alert(1)>';await setPath(good);await click('circulation-run');assert.equal(await evaluate("document.querySelectorAll('#circulation-result img').length"),0);assert.match(await text('circulation-result'),/<img/);
    await click('restart');assert.equal(await text('circulation-result'),'');assert.equal(await evaluate("document.getElementById('circulation-save').disabled"),true);
  });
  await check('late saved-file reads cannot revive a comparison after training changes',async()=>{
    await evaluate(`(()=>{window.oldCirculationText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.finishCirculationRead=()=>resolve('{}'));};const dt=new DataTransfer();dt.items.add(new File(['{}'],'slow.json'));const el=document.getElementById('circulation-open');el.files=dt.files;el.dispatchEvent(new Event('change'));})()`);
    await click('restart');await evaluate("window.finishCirculationRead();File.prototype.text=window.oldCirculationText");await delay(80);
    assert.equal(await text('circulation-result'),'');assert.match(await text('circulation-status'),/Compare again/);
  });
  await click('circulation-load');await click('circulation-run');
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
    await check(`real rendered complete path at ${width} CSS pixels`,async()=>{const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.querySelector('#circulation-result svg').getBoundingClientRect().width})");assert.equal(d.width,width);assert.ok(d.scroll<=width+1,JSON.stringify(d));assert.ok(d.plot>250);});
    if(width===390)await check('narrow table keeps complete numbers and keyboard-scrolls within its own region',async()=>{
      const state=await evaluate("(()=>{const r=document.getElementById('circulation-table-scroll'),t=document.getElementById('circulation-comparison-table');r.focus();return {client:r.clientWidth,scroll:r.scrollWidth,table:t.getBoundingClientRect().width,numeric:[...t.querySelectorAll('tr')].slice(1).map(row=>getComputedStyle(row.children[1]).whiteSpace),active:document.activeElement.id};})()");
      assert.ok(state.scroll>state.client);assert.ok(state.table>=620);assert.ok(state.numeric.every(v=>v==='nowrap'));assert.equal(state.active,'circulation-table-scroll');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
      await wait("document.getElementById('circulation-table-scroll').scrollLeft>0");
      await evaluate("document.getElementById('circulation-table-scroll').scrollLeft=0");
    });
    const clip=await evaluate("(()=>{const r=document.getElementById('coupled-circulation').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`circulation-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  if(process.env.WORLDLAW_OBSERVABLE_RECEIVING==='1'){const {receiveObservables}=await import('./coupling-observables-receiving.mjs');await receiveObservables({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_MODES_RECEIVING==='1'){const {receiveModes}=await import('./coupling-modes-receiving.mjs');await receiveModes({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_RESPONSE_REGION_RECEIVING==='1'){const {receiveResponseRegions}=await import('./coupling-response-region-receiving.mjs');await receiveResponseRegions({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_RESPONSE_CONTRAST_RECEIVING==='1'){const {receiveResponseContrasts}=await import('./coupling-response-contrast-receiving.mjs');await receiveResponseContrasts({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_SHARED_COURSE_RECEIVING==='1'){const {receiveSharedCourse}=await import('./coupling-shared-course-receiving.mjs');await receiveSharedCourse({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_ALLOWANCE_RECEIVING==='1'){const {receiveAllowance}=await import('./coupling-allowance-receiving.mjs');await receiveAllowance({evaluate,send,check,click,text,wait,outputDir});}
  if(process.env.WORLDLAW_CIRCULATION_BOX_RECEIVING==='1'){const {receiveCirculationBoxes}=await import('./coupling-angle-boxes-receiving.mjs');await receiveCirculationBoxes({evaluate,send,check,click,text,wait,outputDir,downloads});}
  if(process.env.WORLDLAW_CALIBRATION_RECEIVING==='1'){const {receiveCalibration}=await import('./coupling-calibration-receiving.mjs');await receiveCalibration({evaluate,send,check,click,text,wait,outputDir,downloads});}
  if(process.env.WORLDLAW_MATRIX_RECEIVING==='1'){const {receiveMatrixCalibration}=await import('./coupling-matrix-receiving.mjs');await receiveMatrixCalibration({evaluate,send,check,click,text,wait,outputDir,downloads});}
  await check('no page exceptions or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
  await writeFile(path.join(outputDir,'verification.json'),JSON.stringify({checks,events,node:process.version,pass:true,sandbox,downloads},null,2));
}catch(error){
  failed=true;await writeFile(path.join(outputDir,'failure.json'),JSON.stringify({checks,events,sandbox:error.receipt??sandbox,error:String(error.stack),profile:dir,downloads},null,2));throw error;
}finally{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Receiver closing'));}pending.clear();
  try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);if(!failed)await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));
}
