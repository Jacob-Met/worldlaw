import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/stiffness.html';
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
 assert.ok(target,'Missing actual STIFFNESS LAB tab');
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
 await wait("document.readyState==='complete' && document.querySelector('#verdict')?.textContent.length>1");


 const click=async id=>evaljs("document.getElementById("+JSON.stringify(id)+").click()");
 const upload=async(id,content,name='input.json')=>evaljs("(()=>{const dt=new DataTransfer();dt.items.add(new File(["+JSON.stringify(content)+"],"+JSON.stringify(name)+",{type:'application/json'}));const input=document.getElementById("+JSON.stringify(id)+");input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
 const example=async kind=>{await evaljs("document.querySelector('#example-kind').value="+JSON.stringify(kind));await click('load-example');};
 const screenshot=async name=>{if(outputDir){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,name+'.png'),Buffer.from(s.data,'base64'));}};
 let saved,exported;
 await check('actual default source has recovered change and separate challenge',async()=>{
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'PIECEWISE PREFERRED');
  assert.match(await evaljs("document.querySelector('#comparison-body').textContent"),/0.4 rad/);
  assert.match(await evaljs("document.querySelector('#source-label').textContent"),/simulated.*116 training \/ 92 separate/);
  assert.equal(await evaljs("document.querySelectorAll('#profile-body tr').length"),26);
  assert.ok(await evaljs("document.querySelectorAll('#response-plot circle').length")>20);
 });
 await check('conditional input and angle change executable response without fitting',async()=>{
  const equation=await evaljs("document.querySelector('#equation').textContent");
  await evaljs("document.querySelector('#probe-angle').value='.8';document.querySelector('#probe-angle').dispatchEvent(new Event('input'));document.querySelector('#slice-command').value='.5';document.querySelector('#slice-command').dispatchEvent(new Event('input'));");
  assert.match(await evaljs("document.querySelector('#probe-value').textContent"),/0.8/);
  assert.match(await evaljs("document.querySelector('#slice-note').textContent"),/0 training, 0 checks/);
  assert.equal(await evaljs("document.querySelector('#equation').textContent"),equation);
  await evaljs("document.querySelector('#slice-command').value='0';document.querySelector('#slice-command').dispatchEvent(new Event('input'))");
 });
 await check('both distinct apparatus compositions render actual frozen predictions',async()=>{
  await evaljs("document.querySelector('.apparatus').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('response-1440');
  await click('gauge-view');assert.match(await evaljs("document.querySelector('#response-plot').textContent"),/FROZEN MODEL RESPONSE.*N·m/);await screenshot('gauge-1440');await click('response-view');
 });
 await check('alternative inspection preserves training winner and challenge roles',async()=>{
  await evaljs("document.querySelector('#profile-body button').click()");
  assert.match(await evaljs("document.querySelector('#comparison-body').textContent"),/Training winner · κ 0.4 rad/);
  assert.match(await evaljs("document.querySelector('#comparison-body').textContent"),/Inspected alternative/);
  await example('kink');
 });
 await check('actual download contains only inputs and reopens through file control',async()=>{
  const download=path.join(dir,'downloads');await mkdir(download,{recursive:true});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});
  await click('save');
  for(let i=0;i<60;i++){try{saved=await readFile(path.join(download,'worldlaw-stiffness-inputs.json'),'utf8');break;}catch{await delay(80);}}
  assert.ok(saved);exported=JSON.parse(saved);assert.equal(exported.schema,'worldlaw.stiffness-notebook/v1');assert.ok(!('fit'in exported));
  await example('linear');assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'GLOBAL PREFERRED');
  await upload('source-file',saved);await wait("document.querySelector('#verdict').textContent==='PIECEWISE PREFERRED'");
 });
 await check('separately supplied bad checks change errors without changing fitted explanation',async()=>{
  const equation=await evaljs("document.querySelector('#equation').textContent");
  const data={observations:exported.dataset.heldOut.map(r=>({...r,jointTorque:100})),source:{label:'Independent declared challenge'}};
  await upload('check-file',JSON.stringify(data));await wait("document.querySelector('#comparison-body').textContent.includes('100')");
  assert.equal(await evaljs("document.querySelector('#equation').textContent"),equation);
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'PIECEWISE PREFERRED');
  await upload('source-file',saved);await wait("document.querySelector('#comparison-body').textContent.includes('0.000')");
 });
 await check('a smooth omitted law is retained as family mismatch',async()=>{
  await example('smooth');assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'FAMILY MISMATCH');
 });
 await check('one-sided evidence preserves refused change angles and failed separate checks',async()=>{
  await example('narrow');assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'GLOBAL PREFERRED');
  assert.match(await evaljs("document.querySelector('#profile-body').textContent"),/insufficient side support/);
 });
 await check('input refusal and claimed-result tampering preserve the current valid study',async()=>{
  await upload('source-file',saved);await wait("document.querySelector('#verdict').textContent==='PIECEWISE PREFERRED'");
  const bad=JSON.parse(saved);bad.fit={status:'verified'};await upload('source-file',JSON.stringify(bad));
  await wait("document.querySelector('#error').textContent.includes('input-only')");
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'PIECEWISE PREFERRED');
  await evaljs("document.querySelector('#knots').value='0,,1';document.querySelector('#settings').requestSubmit()");
  assert.match(await evaljs("document.querySelector('#error').textContent"),/empty/);
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'PIECEWISE PREFERRED');
 });
 await check('unidentifiable declared nuisance columns refuse visibly without substitution',async()=>{
  const bad=JSON.parse(saved);bad.dataset.observations.forEach(r=>{r.command=0;r.rate=0;});
  await upload('source-file',JSON.stringify(bad));await wait("document.querySelector('#verdict').textContent==='UNIDENTIFIABLE'");
  assert.match(await evaljs("document.querySelector('#profile-body').textContent"),/rank deficient/);
 });
 await check('a late file read cannot replace a newer source choice',async()=>{
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),300)):window.originalFileText.call(file)}");
  await upload('source-file',saved,'slow.json');await example('linear');await delay(450);
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'GLOBAL PREFERRED');
  await evaljs("File.prototype.text=window.originalFileText");
 });
 await check('keyboard commits the authored source and focuses the ordinary controls',async()=>{
  await evaljs("document.querySelector('#example-kind').value='kink';document.querySelector('#load-example').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaljs("document.querySelector('#verdict').textContent"),'PIECEWISE PREFERRED');
  assert.equal(await evaljs("document.activeElement.id"),'load-example');
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(150);
  await check('readable response and contained layout at '+width+'px',async()=>{
   const m=await evaljs("(()=>{const t=document.querySelector('#response-plot text');return {viewport:innerWidth,body:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(t).fontSize)*t.getScreenCTM().a,viewbox:document.querySelector('#response-plot').getAttribute('viewBox')}})()");
   assert.ok(m.body<=m.viewport+1,JSON.stringify(m));assert.ok(m.font>=10,JSON.stringify(m));
  });
  await evaljs("document.querySelector('.apparatus').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('response-'+width);
  await click('gauge-view');await screenshot('gauge-'+width);await click('response-view');
 }
 await check('ordinary studio still loads through maintained navigation',async()=>{
  await send('Page.navigate',{url:new URL('/',origin).href});await wait("document.readyState==='complete'&&Number(document.querySelector('#sample-count')?.textContent)>0");
  assert.ok(await evaljs("Boolean(document.querySelector('a[href=\"/stiffness.html\"]'))"));
  assert.ok(await evaljs("document.documentElement.scrollWidth<=innerWidth+1"));
  const before=await evaljs("Number(document.querySelector('#sample-count').textContent)");
  await click('use-proposal');await click('run-experiment');await wait("Number(document.querySelector('#sample-count').textContent)>"+before);
 });
 await check('no uncaught page errors or external requests',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 const result={checks:out.length,pass:true,results:out,events};if(outputDir)await writeFile(path.join(outputDir,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
 let page=null;try{page=await diagnosticEval?.("({state:document.querySelector('#verdict')?.textContent,error:document.querySelector('#error')?.textContent,focus:document.activeElement?.id,location:location.href})");}catch{}
 console.error(JSON.stringify({failure:error.message,completed:out,page,events},null,2));throw error;
}finally{
 try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));
}
