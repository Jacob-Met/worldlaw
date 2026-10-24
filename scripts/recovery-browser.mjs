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
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000',origin],{stdio:'ignore'});
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
 await wait("document.querySelectorAll('#recovery-models tr').length===7");
 const rows=()=>evaljs("Array.from(document.querySelectorAll('#recovery-models tr')).map(r=>r.textContent)");
 await check('recovery real app produces executable finite hypotheses and frozen separate challenges',async()=>{
  assert.match((await rows())[4],/compatiblecompatible/);
  assert.equal(await evaljs("document.querySelectorAll('#recovery-plot svg circle').length"),2);
  assert.equal(await evaljs("document.querySelectorAll('#recovery-plot svg rect').length"),2);
 });
 await check('persistent control changes executable predictions through actual course control',async()=>{
  await evaljs("document.querySelector('#recovery-demo').value='persistent';document.querySelector('#recovery-load').click()");
  assert.match((await rows())[1],/compatiblecompatible/);
  assert.match((await rows())[4],/training_contradiction/);
 });
 await check('out of family challenge retains training forecast and reports contradiction',async()=>{
  await evaljs("document.querySelector('#recovery-demo').value='mismatch';document.querySelector('#recovery-load').click()");
  assert.match((await rows())[4],/compatiblechallenged/);
 });
 await check('input export has actual evidence and import recomputes challenged forecast',async()=>{
  await evaljs("window.recoveryExport=null;window.savedCreate=URL.createObjectURL;URL.createObjectURL=b=>{window.recoveryExport=b;return window.savedCreate(b)};document.querySelector('#recovery-export').click()");
  const exported=await evaljs("recoveryExport.text()");assert.equal(JSON.parse(exported).challenges.length,2);assert.ok(!JSON.parse(exported).result);
  await evaljs("document.querySelector('#recovery-demo').value='persistent';document.querySelector('#recovery-load').click()");
  await evaljs(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(exported)}],'recovery.json',{type:'application/json'}));const f=document.querySelector('#recovery-file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()`);
  await wait("document.querySelectorAll('#recovery-models tr')[4].textContent.includes('challenged')");
 });
 await check('renamed reused evidence is rejected atomically by real import',async()=>{
  await evaljs("(async()=>{const n=JSON.parse(await recoveryExport.text());n.challenges=[structuredClone(n.training[0])];n.challenges[0].recordingId='renamed';const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(n)],'reuse.json'));const f=document.querySelector('#recovery-file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()");
  await wait("!document.querySelector('#recovery-error').hidden");assert.match(await evaljs("document.querySelector('#recovery-error').textContent"),/reused/);
  assert.match((await rows())[4],/compatiblechallenged/);
 });
 await check('user current paired readings flow through real add buttons and retain duplicate refusal',async()=>{
  await evaljs("document.querySelector('#recovery-reset').click();document.querySelector('#recovery-recording').value='new-a';document.querySelector('#recovery-add').click();document.querySelector('#recovery-recording').value='new-b';document.querySelector('#recovery-delay').value='1';document.querySelector('#recovery-add').click()");
  assert.match(await evaljs("document.querySelector('#recovery-state').textContent"),/1 training/);
  assert.match(await evaljs("document.querySelector('#recovery-error').textContent"),/reused/);
  await evaljs("document.querySelector('#seed').value='99';document.querySelector('#run-form').requestSubmit()");
  await delay(100);
  await evaljs("document.querySelector('#recovery-add').click()");
  assert.match(await evaljs("document.querySelector('#recovery-state').textContent"),/2 training/);
  assert.equal(await evaljs("document.querySelector('#recovery-error').hidden"),true);
 });
 await check('keyboard controls remain visible and focusable',async()=>{
  await send('Page.bringToFront');
  await evaljs("window.recoveryKeyEvents=[];const b=document.querySelector('#recovery-load');for(const type of ['keydown','keypress','keyup','click'])b.addEventListener(type,e=>recoveryKeyEvents.push({type:e.type,key:e.key,trusted:e.isTrusted}));b.focus()");assert.equal(await evaljs("document.activeElement.id"),'recovery-load');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  try {await wait("document.querySelector('#recovery-state').textContent.includes('2 separate challenges')");}
  catch(e){console.error('Keyboard diagnostics',await evaljs("({focused:document.hasFocus(),active:document.activeElement.id,events:recoveryKeyEvents,state:document.querySelector('#recovery-state').textContent})"));throw e;}
  assert.match(await evaljs("document.querySelector('#recovery-state').textContent"),/2 separate challenges/);
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
  await evaljs("document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:document.querySelector('#recovery-lab').getBoundingClientRect().top+scrollY,behavior:'instant'})");
  await wait("Math.abs(scrollY-Math.min(document.querySelector('#recovery-lab').getBoundingClientRect().top+scrollY,document.documentElement.scrollHeight-innerHeight))<2");
  await check('rendered recovery plot and contained page at '+width,async()=>{
   const d=await evaljs("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.querySelector('#recovery-plot svg').getBoundingClientRect().width})");assert.ok(d.scroll<=d.width+1,JSON.stringify(d));assert.ok(d.plot>200);
  });
  if(outputDir){const clip=await evaljs("(()=>{const r=document.querySelector('#recovery-lab').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");assert.ok(clip.height>400&&clip.width>200);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'recovery-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 await check('no uncaught runtime errors or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 console.log(JSON.stringify({checks:out,pass:true,events},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');
 await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
