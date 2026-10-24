import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),output=resolve(process.argv[3]||join(tmpdir(),'worldlaw-cycle-receiving'));await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'worldlaw-cycle-chrome-'));
const downloads=await mkdtemp(join(output,'downloads-'));
const {createProductServer}=await import(pathToFileURL(join(root,'server.mjs')));
const server=createProductServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const chrome=spawn(process.env.CHROME||'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeLog='';chrome.stderr.on('data',chunk=>{chromeLog+=chunk;});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,label,timeout=15000){const started=Date.now();while(Date.now()-started<timeout){try{const value=await fn();if(value)return value;}catch{}await delay(80);}throw Error(`Timed out: ${label}`);}
let socket;
const exceptions=[],requests=[],checks=[];
try {
  const port=await waitFor(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),'Chrome debugging endpoint');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const waiting=new Map();
  socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id){const pending=waiting.get(message.id);if(pending){waiting.delete(message.id);message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);}}else{if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));return result.result.value;};
  const click=async id=>{const point=await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
  const set=(id,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
  const ready=()=>waitFor(()=>evaluate("document.getElementById('refit') && !document.getElementById('refit').disabled"),'challenge finished');
  const compared=()=>waitFor(()=>evaluate("!document.getElementById('compare-initial-states').disabled"),'grid finished');
  const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('DOM.enable');
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();
  const cycleReady=()=>waitFor(()=>evaluate("!document.getElementById('compare-cycle-work').disabled"),'cycle investigation finished');
  const status=()=>evaluate("document.getElementById('cycle-work-status').textContent");
  async function fileInput(path,id){const {result}=await call('Runtime.evaluate',{expression:`document.getElementById(${JSON.stringify(id)})`,returnByValue:false});assert.ok(result.objectId);try{await call('DOM.setFileInputFiles',{objectId:result.objectId,files:[path]});}finally{await call('Runtime.releaseObject',{objectId:result.objectId});}}
  await check('original torque consumer remains usable; angular cycle instrument is hidden',async()=>{assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),true);assert.ok(await evaluate("document.querySelector('#trajectory-chart svg')!==null"));});
  await set('example-choice','measured','change');await click('load-example');await ready();
  await evaluate("(()=>{const radio=document.querySelector('input[name=method][value=weak]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));})()");await click('refit');await ready();
  await check('maintained measured source and frozen restoring law execute cycle work by keyboard',async()=>{
    assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),false);
    await evaluate("document.getElementById('compare-cycle-work').focus()");
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await cycleReady();
    assert.match(await status(),/35\/35 complete cycle pairs admitted/);assert.match(await status(),/no receiving winner selected/);
    assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart circle').length"),35);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),8);
    assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/Nonnegative boundary/);
  });
  let receipt,notebook;
  await check('actual downloaded input notebook recomputes scientific disagreement and reopens',async()=>{
    await click('export-cycle-work');notebook=join(downloads,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(notebook)).size>0;}catch{return false;}},'cycle notebook download');
    receipt=JSON.parse(await readFile(notebook,'utf8'));assert.equal(receipt.result,undefined);
    const {replayCycleWork}=await import(pathToFileURL(join(root,'src/trajectory/cycle-work.mjs'))),r=replayCycleWork(receipt);
    assert.equal(r.fit.admittedCycleCount,35);assert.ok(r.fit.candidates[0].lossRMSE<r.fit.candidates[1].lossRMSE);assert.ok(r.receiving[1].rollout.metrics.positionRMSE>r.receiving[2].rollout.metrics.positionRMSE);assert.equal(r.selected,null);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'cycle notebook replay');
  });
  await check('invalid declarations clear stale claims; source replacement invalidates exported result',async()=>{
    await set('cycle-work-window',4);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),0);await click('compare-cycle-work');await cycleReady();assert.match(await status(),/odd derivative window/);
    await set('cycle-work-window',9);await click('compare-cycle-work');await cycleReady();
    await set('example-choice','pendulum','change');await click('load-example');await ready();assert.equal(await evaluate("document.getElementById('cycle-work-panel').hidden"),true);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);
    await set('example-choice','measured','change');await click('load-example');await ready();await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'reopen independent source inputs');
  });
  await check('delayed imported notebook cannot overwrite a newer declaration',async()=>{
    const delayed=join(output,'delayed-cycle.json');await writeFile(delayed,JSON.stringify(receipt));
    await evaluate(`(()=>{window.__oldText=File.prototype.text;window.__readStarted=false;File.prototype.text=async function(){const text=await window.__oldText.call(this);if(this.name==='delayed-cycle.json'){window.__readStarted=true;await new Promise(resolve=>window.__release=resolve);}return text;};})()`);
    await fileInput(delayed,'cycle-work-file');await waitFor(()=>evaluate('window.__readStarted'),'pending cycle read');await set('cycle-work-crossing','.2');await evaluate('File.prototype.text=window.__oldText;window.__release()');await delay(250);
    assert.equal(Number(await evaluate("document.getElementById('cycle-work-crossing').value")),.2);assert.equal(await evaluate("document.getElementById('export-cycle-work').hidden"),true);assert.equal(await evaluate("document.querySelectorAll('#cycle-work-chart polyline').length"),0);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'restore final cycle notebook');
  });
  await check('reopened refusal budget survives unchanged recompute and export',async()=>{
    const low=structuredClone(receipt);low.options.maxSteps=1;const input=join(output,'low-budget-cycle.json');await writeFile(input,JSON.stringify(low));
    await fileInput(input,'cycle-work-file');await waitFor(()=>evaluate("document.getElementById('cycle-work-panel').textContent.includes('budget 1.')"),'imported budget refusal');
    await click('compare-cycle-work');await cycleReady();assert.match(await evaluate("document.getElementById('cycle-work-panel').textContent"),/budget 1\./);
    const fresh=await mkdtemp(join(output,'budget-download-'));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fresh});await click('export-cycle-work');const saved=join(fresh,'worldlaw-cycle-work.json');await waitFor(async()=>{try{return(await stat(saved)).size>0;}catch{return false;}},'retained budget export');assert.equal(JSON.parse(await readFile(saved,'utf8')).options.maxSteps,1);
    await fileInput(notebook,'cycle-work-file');await waitFor(async()=>/35\/35 complete/.test(await status()),'restore full-budget study');
  });
  await check('desktop and390px instrument stays in viewport and produces actual screenshots',async()=>{
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
      const bounds=await evaluate(`(()=>{const p=document.getElementById('cycle-work-panel'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,overflow:[...p.querySelectorAll('input,button,svg')].filter(e=>e.getClientRects().length).map(e=>({id:e.id,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(r=>r.left< -1||r.right>innerWidth+1)};})()`);
      assert.ok(bounds.left>=-1&&bounds.right<=width+1,JSON.stringify(bounds));assert.deepEqual(bounds.overflow,[]);
      await evaluate("document.getElementById('cycle-work-panel').scrollIntoView({block:'start'})");await delay(100);const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`cycle-work-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  });
  await check('no page exceptions or external network requests',async()=>{assert.deepEqual(exceptions,[]);assert.deepEqual(requests.filter(url=>!url.startsWith(origin+'/')&&!url.startsWith('blob:')&&!url.startsWith('data:')),[]);});
  await writeFile(join(output,'browser-receipt.json'),JSON.stringify({checks,exceptions,requests,inputSchema:receipt.schema,screenshots:['cycle-work-1440.png','cycle-work-390.png']},null,2));console.log(JSON.stringify({passed:checks.length,output}));
}catch(error){await writeFile(join(output,'browser-failure.json'),JSON.stringify({checks,error:String(error),exceptions,chromeLog},null,2));throw error;}
finally{socket?.close();chrome.kill('SIGTERM');server.close();}
