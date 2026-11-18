import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createProductServer} from '../server.mjs';

const [dataDir,outputDir]=process.argv.slice(2);
if(!dataDir || !outputDir)throw new Error('Supply an acquired RealAIGym directory and an output directory.');
const source=JSON.parse(await readFile(path.join(dataDir,'source-manifest.json'),'utf8'));
const failedTrial=source.trials.find(t=>t.mount==='acrobot' && t.controller==='MC-PILCO' && t.trial==='experiment01');
assert.equal(failedTrial.sha256,'033055f440e3fc9efaf8e1451ac14e40bfb38c22f87066224459fd3686e83eee');
await mkdir(outputDir,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'worldlaw-physical-replay-'));
const server=createProductServer();
await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
const url='http://127.0.0.1:'+server.address().port+'/coupling.html';
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'google-chrome',['--headless=new','--enable-automation','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,url],{stdio:['ignore','ignore','pipe']});
let errorLog='',ws,seq=0;
chrome.stderr.on('data',data=>{errorLog=(errorLog+data).slice(-1500);});
chrome.on('error',error=>{errorLog=error.message;});
const checks=[],pending=new Map();
async function until(probe,timeout=15000){
  const end=Date.now()+timeout;
  do{const result=await probe();if(result)return result;await delay(100);}while(Date.now()<end);
  throw new Error('Browser condition timed out: '+errorLog);
}
try{
  const port=await until(async()=>{try{return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return 0;}});
  const page=await until(async()=>(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
  ws.addEventListener('message',event=>{const x=JSON.parse(event.data);if(x.id && pending.has(x.id)){const p=pending.get(x.id);pending.delete(x.id);clearTimeout(p.timer);x.error?p.reject(new Error(x.error.message)):p.resolve(x.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},15000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const e=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(e.exceptionDetails)throw new Error(e.exceptionDetails.exception?.description||e.exceptionDetails.text);
    return e.result.value;
  };
  const keyboard=async(key,code,number)=>{
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:number,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number});
  };
  const upload=async file=>{
    const {root}=await send('DOM.getDocument');
    const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#hardware-file'});
    await send('DOM.setFileInputFiles',{nodeId,files:[file]});
    await until(()=>evaluate("!document.querySelector('[data-port=reveal]').disabled"));
  };
  const flags=(await send('Browser.getBrowserCommandLine')).arguments;
  assert.ok(!flags.includes('--no-sandbox'),'Expected a sandboxed browser');
  await send('Page.enable');
  for(const [width,height] of [[1440,1080],[390,844]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await send('Page.navigate',{url});await until(()=>evaluate("document.readyState==='complete' && !!document.getElementById('hardware-clock')"));
    await evaluate("document.querySelector('a[href=\"#hardware-port-replay\"]').focus()");
    await keyboard('Enter','Enter',13);
    await until(()=>evaluate("location.hash==='#hardware-port-replay'"));
    await upload(path.resolve(dataDir,failedTrial.sha256+'.csv'));
    const status=()=>evaluate("document.querySelector('[data-port=status]').textContent");
    assert.match(await status(),/locked/);
    await evaluate("document.querySelector('[data-port=reveal]').focus()");
    await keyboard('Enter','Enter',13);await delay(200);assert.match(await status(),/^Shoulder/);
    await evaluate("document.getElementById('hardware-clock').focus()");
    await keyboard('ArrowDown','ArrowDown',40);await until(()=>evaluate("document.getElementById('hardware-clock').value==='fixed100'"));
    await evaluate("document.querySelector('[data-port=reveal]').focus()");await keyboard('Enter','Enter',13);
    await until(async()=>(await status()).startsWith('Elbow'));
    await evaluate("document.getElementById('hardware-port-replay').scrollIntoView({block:'start'})");
    const dimensions=await evaluate("(()=>{const r=document.getElementById('hardware-port-replay');return [r.clientWidth,r.scrollWidth,innerWidth]})()");
    assert.ok(dimensions[1]<=dimensions[2]+1);
    const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(path.join(outputDir,'physical-replay-'+width+'.png'),Buffer.from(shot.data,'base64'));
    const readings=await evaluate("document.querySelector('[data-port=reading]').textContent");
    checks.push({width,height,correctFixed:true,observedEarlyError:true,dimensions,readings});
  }
  await evaluate("document.querySelector('[data-port=recording]').value='shoulder';document.querySelector('[data-port=example]').click()");
  await until(async()=>{const s=await evaluate("document.querySelector('[data-port=status]').textContent");if(/Failed|Error|HTTP|differs|fetch/i.test(s))throw new Error(s);return await evaluate("document.querySelector('[data-port=source]').textContent.includes('8a290bc545d9acf700e340e90370eb632889d711ee037b57d4508c25b4fa8888')");},30000);
  await evaluate("document.querySelector('[data-port=reveal]').click()");
  assert.match(await evaluate("document.querySelector('[data-port=status]').textContent"),/^Shoulder/);
  const bad=path.join(profile,'bad-source.csv');
  await writeFile(bad,'time,invalid\n0,0\n1,1');
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#hardware-file'});
  await send('DOM.setFileInputFiles',{nodeId,files:[bad]});
  await until(()=>evaluate("document.querySelector('[data-port=status]').textContent.includes('Missing')"));
  assert.equal(await evaluate("document.querySelector('[data-port=reveal]').disabled"),true);
  await writeFile(path.join(outputDir,'browser-receipt.json'),JSON.stringify({source:failedTrial.sha256,checks,pinnedExample:true,sandboxEnabled:true,invalidSourceRejected:true},null,2));
  console.log(JSON.stringify(checks));
}finally{
  ws?.close();chrome.kill();
  await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
