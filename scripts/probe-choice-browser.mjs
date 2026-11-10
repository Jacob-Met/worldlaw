// Real Chrome journey for the combined one/two-state UNKNOWN LAB planner.
// Requires a local Chrome/Chromium binary; no provider key or external network.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createProductServer} from '../server.mjs';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(path.join(os.tmpdir(),'worldlaw-probe-choice-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',
 '--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1440,1000',
 origin+'/unknown-lab.html'
],{stdio:'ignore'});
let ws,sequence=0;
const pending=new Map(),exceptions=[],checks=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let port;
 for(let attempt=0;attempt<120;attempt++){
  try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}
  catch{await delay(100);}
 }
 assert.ok(port,'Chrome DevTools port not available');
 let page;
 for(let attempt=0;attempt<60;attempt++){
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  page=tabs.find(tab=>tab.type==='page'&&tab.url.includes('unknown-lab'));
  if(page)break;
  await delay(100);
 }
 assert.ok(page,'No product browser tab');
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){
   const waiter=pending.get(message.id);
   if(waiter){pending.delete(message.id);message.error?waiter.reject(Error(message.error.message)):waiter.resolve(message.result);}
  }
  if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++sequence;
  pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(reply.exceptionDetails)throw Error(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text);
  return reply.result.value;
 };
 const wait=async predicate=>{
  for(let attempt=0;attempt<100;attempt++){
   if(await evaluate(predicate))return;
   await delay(50);
  }
  throw Error('Timed out: '+predicate);
 };
 const check=async(name,fn)=>{await fn();checks.push(name);};
 await send('Page.enable');
 await send('Runtime.enable');
 await wait("document.readyState==='complete'&&!!document.querySelector('#probe-choice-run')");
 await check('authored cross-probe input loaded through product button',async()=>{
  await evaluate("document.querySelector('#probe-example').click()");
  await wait("document.querySelector('#probe-state').textContent!=='NO STUDY'");
  assert.equal(await evaluate("document.querySelector('#probe-error').textContent"),'');
 });
 await check('combined selector chooses cheaper informative singleton and retains six offers',async()=>{
  await evaluate("(()=>{document.querySelector('#probe-choice-mode').value='choice';document.querySelector('#probe-choice-form').requestSubmit()})()");
  await wait("document.querySelector('#probe-choice-results').children.length===6||!!document.querySelector('#probe-choice-error').textContent");
  const result=await evaluate("({status:document.querySelector('#probe-choice-status').textContent,rows:document.querySelector('#probe-choice-results').children.length,error:document.querySelector('#probe-choice-error').textContent,disabled:document.querySelector('#probe-choice-export').disabled})");
  assert.equal(result.error,'');
  assert.equal(result.rows,6);
  assert.equal(result.disabled,false);
  assert.match(result.status,/zero-rate.*effort 2/i);
 });
 let request;
 await check('export retains inputs rather than cached conclusions or challenge outcomes',async()=>{
  request=await evaluate("(async()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{globalThis.__probeChoiceBlob=blob;return original.call(URL,blob)};try{document.querySelector('#probe-choice-export').click()}finally{URL.createObjectURL=original}return globalThis.__probeChoiceBlob.text()})()");
  const parsed=JSON.parse(request);
  assert.equal(parsed.schema,'worldlaw.probe-choice/v1');
  assert.equal(parsed.training.runs.length,3);
  assert.ok(parsed.training.runs.every(run=>run.role==='training'));
  assert.equal(parsed.settings.probes.length,3);
  assert.equal(Object.hasOwn(parsed,'selected'),false);
 });
 await check('legacy one-state form stays usable',async()=>{
  await evaluate("(()=>{document.querySelector('#probe-choice-mode').value='single';document.querySelector('#probe-choice-form').requestSubmit()})()");
  await wait("document.querySelector('#probe-choice-results').children.length===3||!!document.querySelector('#probe-choice-error').textContent");
  assert.equal(await evaluate("document.querySelector('#probe-choice-error').textContent"),'');
 });
 await check('legacy two-state form stays usable',async()=>{
  await evaluate("(()=>{document.querySelector('#probe-choice-mode').value='course';document.querySelector('#probe-choice-form').requestSubmit()})()");
  await wait("document.querySelector('#probe-choice-results').children.length===3||!!document.querySelector('#probe-choice-error').textContent");
  assert.equal(await evaluate("document.querySelector('#probe-choice-error').textContent"),'');
 });
 await check('file-input reopen restores the combined source-only request',async()=>{
  await evaluate("(async()=>{const input=document.querySelector('#probe-choice-file');const transfer=new DataTransfer();transfer.items.add(new File([await globalThis.__probeChoiceBlob.text()],'request.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await wait("document.querySelector('#probe-choice-mode').value==='choice'||!!document.querySelector('#probe-choice-error').textContent");
  assert.equal(await evaluate("document.querySelector('#probe-choice-error').textContent"),'');
  assert.equal(await evaluate("document.querySelector('#probe-choice-results').children.length"),6);
 });
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await check('390px mobile viewport contains the form without horizontal page overflow',async()=>{
  const metrics=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,select:document.querySelector('#probe-choice-mode').getBoundingClientRect().width,form:document.querySelector('#probe-choice-form').getBoundingClientRect().width})");
  assert.ok(metrics.scroll<=metrics.width+1,JSON.stringify(metrics));
  assert.ok(metrics.select>100&&metrics.form>200,JSON.stringify(metrics));
 });
 if(process.env.BROWSER_ARTIFACT_DIR){
  await mkdir(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(process.env.BROWSER_ARTIFACT_DIR,'probe-choice-mobile.png'),Buffer.from(shot.data,'base64'));
 }
 await check('no uncaught page exceptions',async()=>assert.deepEqual(exceptions,[]));
 console.log(JSON.stringify({checks:checks.length,passed:true,scenarios:checks},null,2));
}finally{
 try{ws?.close();}catch{}
 chrome.kill('SIGKILL');
 await new Promise(resolve=>server.close(resolve));
 await rm(profile,{recursive:true,force:true});
}
