import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {stiffnessExperimentCourse} from '../src/stiffness/experiment-fixture.mjs';
import {importStiffnessExperiment} from '../src/stiffness/experiment.mjs';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-reading-draft-'));
const output=process.env.BROWSER_ARTIFACT_DIR||path.join(dir,'evidence');
await mkdir(output,{recursive:true});
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',[
 '--headless=new','--disable-gpu','--disable-background-networking','--no-first-run',
 '--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'
],{stdio:['ignore','ignore','pipe']});
let chromeError='',ws,seq=0,admission=null,inspectFailure=null;
chrome.stderr.on('data',data=>{chromeError=(chromeError+data).slice(-12000);});
const pending=new Map(),checks=[],exceptions=[],viewportSizes=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let port;
 for(let i=0;i<100;i++){
  if(chrome.exitCode!==null)throw new Error('Chromium exited before admission: '+chromeError);
  try{port=Number((await readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}
 }
 assert.ok(port,'Chromium DevTools port unavailable: '+chromeError);
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=tabs.find(tab=>tab.type==='page'&&tab.url==='about:blank');
 assert.ok(target,'Missing isolated preflight page');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{
  const value=JSON.parse(event.data);
  if(value.id){const request=pending.get(value.id);if(!request)return;pending.delete(value.id);clearTimeout(request.timer);value.error?request.reject(new Error(value.error.message)):request.resolve(value.result);}
  if(value.method==='Runtime.exceptionThrown')exceptions.push(value.params.exceptionDetails);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 const wait=async expression=>{
  for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(60);}
  throw new Error('Timed out waiting for '+expression);
 };
 const click=async id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
 const upload=async(id,content,name)=>{
  const file=path.join(dir,name);await writeFile(file,content);
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id});
  await send('DOM.setFileInputFiles',{nodeId,files:[file]});
 };
 const download=path.join(dir,'downloads');await mkdir(download);
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});
 const savedPath=path.join(download,'worldlaw-stiffness-inputs.json');
 const save=async()=>{
  await rm(savedPath,{force:true});await click('save');
  for(let i=0;i<100;i++){try{const text=await readFile(savedPath,'utf8');JSON.parse(text);return text;}catch{await delay(50);}}
  throw new Error('No complete notebook download');
 };
 const draftIds=['observation-id','observation-command','observation-position','observation-rate','observation-torque'];
 const readDraft=()=>evaluate('Object.fromEntries('+JSON.stringify(draftIds)+'.map(id=>[id,document.getElementById(id).value]))');
 const writeDraft=async(request,id,torque)=>{
  const values={'observation-id':id,'observation-torque':torque,'observation-source':'Authored reading for draft regression','observation-kind':'authored test control'};
  for(const axis of ['command','position','rate'])values['observation-'+axis]=request.state[axis].toFixed(4);
  await evaluate('(()=>{for(const [id,value] of Object.entries('+JSON.stringify(values)+')){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));}})()');
  return readDraft();
 };
 const screenshot=async name=>{
  await evaluate('document.getElementById("experiment-observation-form").scrollIntoView({block:"center",behavior:"instant"})');
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const image=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(output,name+'.png'),Buffer.from(image.data,'base64'));
 };
 const sameScience=(before,after)=>{
  assert.deepEqual(after.study.fit,before.study.fit,'Checks changed training inference');
  assert.deepEqual(after.pending,before.pending,'Checks changed frozen request');
  assert.deepEqual(after.history,before.history,'Checks changed earlier forecasts');
  assert.deepEqual(after.acquisitions,before.acquisitions,'Checks manufactured an acquisition');
 };
 const checkData=offset=>({
  source:{label:'Authored independent-check control '+offset,kind:'synthetic'},
  observations:stiffnessExperimentCourse().study.dataset.heldOut.map(row=>({...row,jointTorque:row.jointTorque+offset}))
 });
 const replaceChecks=async(offset,name)=>{
  const before=await evaluate('document.getElementById("comparison-body").textContent');
  await upload('check-file',JSON.stringify(checkData(offset)),name);
  await wait('document.getElementById("comparison-body").textContent!=='+JSON.stringify(before));
  await wait('document.getElementById("error").textContent===""');
 };

 inspectFailure=()=>evaluate('({url:location.href,error:document.getElementById("error")?.textContent,active:document.activeElement?.id,inputs:[...document.querySelectorAll("#experiment-observation-form input")].map(input=>({id:input.id,value:input.value,disabled:input.disabled,validation:input.validationMessage})),history:document.getElementById("experiment-history")?.dataset.acquisitionCount})');
 admission=await requireChromiumSandbox({send});
 await writeFile(path.join(output,'sandbox.json'),JSON.stringify(admission,null,2));
 await send('Page.navigate',{url:origin+'/stiffness.html'});
 await wait('document.readyState==="complete"&&document.getElementById("verdict")?.textContent.length>1');
 viewportSizes.push(await evaluate('[innerWidth,innerHeight]'));
 await click('experiment-load-course');
 await click('experiment-freeze-proposed');
 await wait('!document.getElementById("observation-torque").disabled');
 const before=importStiffnessExperiment(await save());
 assert.ok(before.pending,'Authored course did not freeze a request');
 const firstDraft=await writeDraft(before.pending,'bench-note-A','1.234500');
 await replaceChecks(30,'checks-a.json');
 const after=importStiffnessExperiment(await save());
 sameScience(before,after);
 assert.ok(after.study.checks[0].rmse>before.study.checks[0].rmse+20,'Fixture did not change check diagnostics');
 await screenshot('draft-after-checks-desktop');
 assert.deepEqual(await readDraft(),firstDraft,'Replacing checks discarded the current reading draft');
 checks.push('same request preserves exact reading strings while check metrics change');

 const secondDraft=await writeDraft(after.pending,'bench-note-B','-0.7200');
 await replaceChecks(45,'checks-b.json');
 assert.deepEqual(await readDraft(),secondDraft,'Second replacement restored an old draft');
 checks.push('second replacement preserves latest edited draft');
 await evaluate('document.getElementById("observation-torque").value=""');
 const incomplete=await readDraft();
 await replaceChecks(60,'checks-empty-draft.json');
 assert.deepEqual(await readDraft(),incomplete,'Incomplete draft was reconstructed');
 checks.push('incomplete draft remains untouched');
 await writeDraft(after.pending,'bench-note-invalid-check','2.500');
 const beforeFailure=await readDraft();
 await upload('check-file','{"observations":[]}', 'invalid-checks.json');
 await wait('document.getElementById("error").textContent.length>0');
 assert.deepEqual(await readDraft(),beforeFailure,'Failed check import discarded a draft');
 checks.push('failed check import leaves draft intact');

 await click('experiment-freeze-proposed');
 const refrozen=importStiffnessExperiment(await save());
 assert.deepEqual(refrozen.pending,after.pending,'Reset control did not refreeze the identical request');
 assert.equal((await readDraft())['observation-torque'],'','Explicit refreeze retained old draft');
 assert.equal((await readDraft())['observation-id'],'reading-1');
 checks.push('refreezing identical request resets draft');
 const sameNotebook=await save();
 await writeDraft(refrozen.pending,'should-not-cross-notebooks','4.2000');
 await upload('source-file',sameNotebook,'same-notebook.json');
 await wait('document.getElementById("observation-torque").value===""');
 assert.equal((await readDraft())['observation-id'],'reading-1');
 checks.push('opening identical notebook resets draft');

 const finalDraft=await writeDraft(refrozen.pending,'recorded-note','1.25000');
 await replaceChecks(75,'checks-final.json');
 assert.deepEqual(await readDraft(),finalDraft);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 viewportSizes.push(await evaluate('[innerWidth,innerHeight]'));
 await screenshot('draft-after-checks-narrow');
 await evaluate('document.getElementById("experiment-receive").focus()');
 assert.equal(await evaluate('document.activeElement.id'),'experiment-receive');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await wait('document.getElementById("experiment-history").dataset.acquisitionCount==="1"');
 const receivedText=await save(),received=importStiffnessExperiment(receivedText);
 assert.equal(received.acquisitions[0].id,'recorded-note');
 assert.equal(received.acquisitions[0].observation.jointTorque,1.25);
 assert.deepEqual(received.acquisitions[0].observation,{...refrozen.pending.state,jointTorque:1.25});
 assert.equal(received.pending,null);
 checks.push('keyboard receive records preserved measurement through actual form');
 await send('Page.reload');
 await wait('document.readyState==="complete"&&document.getElementById("verdict")?.textContent.length>1');
 await upload('source-file',receivedText,'received-notebook.json');
 await wait('document.getElementById("experiment-history").dataset.acquisitionCount==="1"');
 const reopened=importStiffnessExperiment(await save());
 assert.deepEqual(reopened.acquisitions,received.acquisitions);
 assert.deepEqual(reopened.history,received.history);
 checks.push('reload and notebook reopen retain received evidence');
 assert.deepEqual(exceptions,[],'Unexpected browser exception');
 const receipt={passed:true,checks,admitted:admission.admitted,viewportSizes,sourceCommit:process.env.SOURCE_COMMIT||null};
 await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
}catch(error){
 const diagnostic=inspectFailure?await inspectFailure().catch(()=>null):null;
 const receipt={passed:false,checks,error:error.message,stack:error.stack,sandbox:error.receipt||admission,diagnostic,chromeError};
 await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));
 console.error(JSON.stringify({passed:false,checks,error:error.message,sandboxAdmitted:receipt.sandbox?.admitted,chromeError}));
 process.exitCode=1;
}finally{
 ws?.close();for(const request of pending.values())clearTimeout(request.timer);
 if(chrome.exitCode===null){
  const exited=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');
  await Promise.race([exited,delay(2000)]);
  if(chrome.exitCode===null){chrome.kill('SIGKILL');await exited;}
 }
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
