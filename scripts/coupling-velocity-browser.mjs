import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {receiveVelocityComparison} from './coupling-velocity-receiving.mjs';

// No browser download or sandbox-disabling fallback. The caller provisions the
// installed executable and sandbox helper; the live browser must prove admission.
const executable=process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable';
await access(executable,constants.X_OK);
const outputDir=process.env.BROWSER_ARTIFACT_DIR||await mkdtemp(path.join(os.tmpdir(),'worldlaw-velocity-artifacts-'));
await mkdir(outputDir,{recursive:true});
const profile=await mkdtemp(path.join(os.tmpdir(),'worldlaw-velocity-chrome-'));
const downloads=path.join(profile,'downloads');await mkdir(downloads);
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const chrome=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1440,1050','about:blank'],{
 env:process.env,stdio:['ignore','ignore','pipe']});
let stderr='',launchError=null;chrome.stderr.on('data',data=>{stderr=(stderr+data).slice(-20000);});chrome.on('error',error=>{launchError=error;});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),checks=[],events={exceptions:[],outside:[]};
let ws,seq=0,sandbox=null,productActive=false;
try{
 let port;
 for(let i=0;i<100;i++){
  if(launchError)throw launchError;
  if(chrome.exitCode!==null)throw Error('Chrome exited before admission: '+stderr);
  try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}
  await delay(100);
 }
 assert.ok(port,'Owned Chrome debugger endpoint was not available. '+stderr);
 let target;
 for(let i=0;i<60;i++){
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  target=targets.find(t=>t.type==='page'&&t.url==='about:blank');if(target)break;await delay(100);
 }
 assert.ok(target,'Owned isolated preflight page was not found.');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{
  const value=JSON.parse(event.data);
  if(value.id){const p=pending.get(value.id);if(p){pending.delete(value.id);clearTimeout(p.timer);value.error?p.reject(Error(value.error.message)):p.resolve(value.result);}}
  if(productActive&&value.method==='Runtime.exceptionThrown')events.exceptions.push(value.params.exceptionDetails.exception?.description||value.params.exceptionDetails.text);
  if(productActive&&value.method==='Network.requestWillBeSent'){
   const url=value.params.request.url;if(!url.startsWith(base+'/')&&!url.startsWith('blob:'+base+'/'))events.outside.push(url);
  }
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
 sandbox=await requireChromiumSandbox({send});assert.equal(sandbox.admitted,true);
 await writeFile(path.join(outputDir,'sandbox-admission.json'),JSON.stringify(sandbox,null,2)+'\n');
 const evaluate=async expression=>{
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;
 };
 const wait=async predicate=>{for(let i=0;i<100;i++){if(await evaluate(predicate))return;await delay(70);}throw Error('Timed out: '+predicate);};
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});throw error;}};
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const text=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
 await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 productActive=true;
 await receiveVelocityComparison({evaluate,send,check,click,text,wait,outputDir,downloads,base});
 await check('strictly sandboxed receiving has no uncaught product exception or external request',async()=>{
  assert.equal(sandbox.admitted,true);assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);
 });
 const downloaded=await readFile(path.join(downloads,'worldlaw-velocity-study.json'));
 await writeFile(path.join(outputDir,'worldlaw-velocity-study.json'),downloaded);
 const receipt={pass:true,checks,events,sandbox,node:process.version,outputDir};
 await writeFile(path.join(outputDir,'velocity-verification.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}catch(error){
 const receipt={pass:false,error:String(error.stack||error),checks,events,sandbox:error.receipt||sandbox,browserStderr:stderr,node:process.version};
 await writeFile(path.join(outputDir,'velocity-verification.json'),JSON.stringify(receipt,null,2)+'\n');
 console.error(JSON.stringify(receipt,null,2));process.exitCode=1;
}finally{
 productActive=false;
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Receiver closing'));}pending.clear();
 try{ws?.close();}catch{}
 chrome.kill('SIGTERM');await delay(400);await rm(profile,{recursive:true,force:true});
 await new Promise(resolve=>server.close(resolve));
}
