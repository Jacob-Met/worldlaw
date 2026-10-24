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
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000',origin],{stdio:'ignore'});
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
 for(let i=0;i<60;i++){const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=tabs.find(x=>x.type==='page'&&x.url.includes('unknown-lab'));if(target)break;await delay(100);}
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
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await wait("document.readyState==='complete' && document.querySelector('#status')?.textContent.length>1");



 const ui=script=>evaljs(script);
 const upload=async(id,value)=>{await evaljs(`(()=>{const input=document.getElementById(${JSON.stringify(id)}),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'input.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);};
 await ui("document.querySelector('#duration-plan-example').click();document.querySelector('#duration-plan-form').requestSubmit();document.querySelector('.duration-receiving').open=true;document.querySelector('#duration-request-preparation').value='Same declared preparation and sensor arrangement';URL.oldCreate=URL.createObjectURL;URL.createObjectURL=b=>{window.lastBlob=b;return URL.oldCreate(b)}");
 await check('freeze uses keyboard and exports input-only request',async()=>{
  await ui("document.querySelector('#duration-request-freeze').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('#duration-request-status').textContent.includes('FROZEN:')");
  await ui("document.querySelector('#duration-request-save').click()");
 });
 const pendingReceipt=JSON.parse(await ui('window.lastBlob.text()'));
 assert.equal(pendingReceipt.observation,null);assert.equal(pendingReceipt.request.protocol.duration,2);
 const observation=await ui(`import('./src/unknown-lab/paired-history.mjs').then(m=>({protocol:${JSON.stringify(pendingReceipt.request.protocol)},run:{id:'duration-next',role:'challenge',duration:2,notebook:m.syntheticChallenge({duration:2,count:32,seed:501,noiseSigma:.005})}}))`);
 await check('wrong protocol refuses atomically',async()=>{const wrong=structuredClone(observation);wrong.protocol.duration=3;await upload('duration-request-observation',wrong);await wait("document.querySelector('#duration-request-error').textContent.includes('protocol')");assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),3);});
 const before=await ui("document.querySelector('#duration-models').textContent");
 await check('separate file receives without training refit',async()=>{await upload('duration-request-observation',observation);await wait("document.querySelector('#duration-request-status').textContent.includes('WITHIN-DECLARED-PLAN')");assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),4);assert.equal(await ui("document.querySelector('#duration-models').textContent"),before);});
 await ui("document.querySelector('#duration-request-save').click()");const saved=JSON.parse(await ui('window.lastBlob.text()'));
 await check('clear and input-only reopen reproduce the comparison',async()=>{await ui("document.querySelector('#duration-clear').click()");await upload('duration-request-open',saved);await wait("document.querySelector('#duration-request-status').textContent.includes('WITHIN-DECLARED-PLAN')");assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),4);assert.equal(await ui("document.querySelector('#duration-models').textContent"),before);});
 await check('reopen pending and receive poor precision preserves result',async()=>{await upload('duration-request-open',pendingReceipt);await wait("document.querySelector('#duration-request-status').textContent.includes('FROZEN:')");const wide=structuredClone(observation);wide.run.notebook.noiseSigma=.5;await upload('duration-request-observation',wide);await wait("document.querySelector('#duration-request-status').textContent.includes('UNQUALIFIED')");assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),4);});

 await check('late plain-study import cannot replace newer acquisition reopen',async()=>{
  await ui(`(()=>{const input=document.querySelector('#duration-file'),file=new File(['{}'],'slow-study.json',{type:'application/json'}),dt=new DataTransfer();file.text=()=>new Promise(resolve=>window.resolveOldStudy=resolve);dt.items.add(file);input.files=dt.files;window.oldStudyRead=input.onchange({target:input});})()`);
  await upload('duration-request-open',saved);await wait("document.querySelector('#duration-request-status').textContent.includes('WITHIN-DECLARED-PLAN')");
  await ui(`window.resolveOldStudy(${JSON.stringify(JSON.stringify(pendingReceipt.request.study))});window.oldStudyRead`);
  assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),4);assert.match(await ui("document.querySelector('#duration-request-status').textContent"),/WITHIN-DECLARED-PLAN/);
 });
 await check('late acquisition reopen cannot replace newer plain-study import',async()=>{
  await ui(`(()=>{const input=document.querySelector('#duration-request-open'),file=new File(['{}'],'slow-acquisition.json',{type:'application/json'}),dt=new DataTransfer();file.text=()=>new Promise(resolve=>window.resolveOldAcquisition=resolve);dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await upload('duration-file',pendingReceipt.request.study);await wait("document.querySelectorAll('#duration-runs li').length===3");
  await ui(`window.resolveOldAcquisition(${JSON.stringify(JSON.stringify(saved))});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(await ui("document.querySelectorAll('#duration-runs li').length"),3);assert.equal(await ui("document.querySelector('#duration-request-status').textContent"),'No request frozen.');
 });
 await upload('duration-request-open',saved);await wait("document.querySelector('#duration-request-status').textContent.includes('WITHIN-DECLARED-PLAN')");
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await delay(150);
  await check('receiving layout '+width,async()=>{const x=await ui('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(x.scroll<=x.inner+1,JSON.stringify(x));});
  await ui("document.querySelector('.duration-receiving').scrollIntoView({behavior:'instant',block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const clip=await ui("(()=>{const r=document.querySelector('.duration-receiving').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
  assert.ok(clip.width>0&&clip.height>0,'Expanded receiver must have visible dimensions');
  if(outputDir){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'duration-acquisition-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('no page exceptions or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out.length,pass:true,results:out,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
