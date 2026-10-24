import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),output=resolve(process.argv[3]||join(tmpdir(),'worldlaw-rolling-receiving'));await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'worldlaw-rolling-chrome-'));
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
  const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const set=(id,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
  const ready=()=>waitFor(()=>evaluate("document.getElementById('refit') && !document.getElementById('refit').disabled"),'challenge finished');
  const compared=()=>waitFor(()=>evaluate("!document.getElementById('compare-initial-states').disabled"),'grid finished');
  const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('DOM.enable');
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/trajectory.html'});await ready();
  await check('original torque journey remains available; angular instrument hidden',async()=>{
    assert.equal(await evaluate("document.getElementById('initial-state-panel').hidden"),true);
    assert.ok(await evaluate("document.querySelector('#trajectory-chart svg')!==null"));
  });
  const bundle={schema:'worldlaw.angular-bundle/v1',label:'Analytic oscillator receiving',units:{time:'s',position:'rad',initialRate:'rad/s'}};
  const make=(id,amplitude,phase)=>({id,label:id,kind:'synthetic',inertia:null,dynamics:'unforced_scalar_rotation',initialRate:-2*amplitude*Math.sin(phase),source:{label:'Independent analytic oscillator',recordingId:id},samples:Array.from({length:201},(_,i)=>({time:i/20,position:amplitude*Math.cos(2*i/20+phase)}))});
  bundle.trainingRuns=[make('fit',.3,0)];bundle.challengeRuns=[make('challenge',.7,.1)];
  const file=join(output,'analytic-angular.json');await writeFile(file,JSON.stringify(bundle));
  const dom=await call('DOM.getDocument');const {nodeId}=await call('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#bundle-file'});await call('DOM.setFileInputFiles',{nodeId,files:[file]});await waitFor(()=>evaluate("document.getElementById('source-name').textContent==='Analytic oscillator receiving'"),'analytic bundle installed');await ready();
  await check('actual imported angular model runs declared grid by keyboard',async()=>{
    assert.equal(await evaluate("document.getElementById('initial-state-panel').hidden"),false);
    await evaluate("document.getElementById('compare-initial-states').focus()");
    assert.equal(await evaluate('document.activeElement.id'),'compare-initial-states');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:String.fromCharCode(13),unmodifiedText:String.fromCharCode(13)});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await compared();
    assert.match(await evaluate("document.getElementById('initial-state-status').textContent"),/9 starting states screened/);
    assert.equal(await evaluate("document.querySelectorAll('#initial-state-chart polyline').length"),10);
  });
  await check('exported actual inputs recompute unchanged forecasts',async()=>{
    await evaluate("document.querySelector('#initial-state-panel > button:last-child').click()");
    const file=join(downloads,'worldlaw-initial-state-sensitivity.json');await waitFor(async()=>{try{return (await stat(file)).size>0;}catch{return false;}},'download');
    const receipt=JSON.parse(await readFile(file,'utf8'));const {initialStateSensitivity}=await import(pathToFileURL(join(root,'src/trajectory/initial-state-sensitivity.mjs')));
    assert.deepEqual(initialStateSensitivity(receipt.model,receipt.run,receipt.options),receipt.result);
  });
  await check('changed inputs clear stale paths; empty width refuses; zero width is one forecast',async()=>{
    await set('initial-rate-width','');assert.equal(await evaluate("document.querySelectorAll('#initial-state-chart polyline').length"),0);
    await click('compare-initial-states');await compared();assert.match(await evaluate("document.getElementById('initial-state-status').textContent"),/Enter both/);
    await set('initial-rate-width',0);await set('initial-position-width',0);await click('compare-initial-states');await compared();
    assert.match(await evaluate("document.getElementById('initial-state-status').textContent"),/1 starting states screened/);
  });
  const preludeInput={schema:'worldlaw.angular-prelude-input/v1',targetRunId:'challenge',kind:'synthetic',units:{time:'s',position:'rad'},source:{label:'Earlier analytic oscillator samples',recordingId:'challenge'},samples:Array.from({length:31},(_,i)=>({time:(i-30)/100,position:.7*Math.cos(2*(i-30)/100+.1)}))};
  const preludeFile=join(output,'angular-prelude.json');await writeFile(preludeFile,JSON.stringify(preludeInput));
  async function importPrelude(path){const d=await call('DOM.getDocument');const {nodeId}=await call('DOM.querySelector',{nodeId:d.root.nodeId,selector:'#prelude-file'});await call('DOM.setFileInputFiles',{nodeId,files:[path]});}
  await check('actual prelude import refuses future samples and requires explicit choice',async()=>{
    await evaluate("document.querySelector('#prelude-controls summary').click()");
    const wrong=structuredClone(preludeInput);wrong.samples.push({time:.01,position:0});const wrongFile=join(output,'future-prelude.json');await writeFile(wrongFile,JSON.stringify(wrong));await importPrelude(wrongFile);
    await waitFor(()=>evaluate("document.getElementById('prelude-status').textContent.includes('Future')"),'future refusal');
    assert.equal(await evaluate("document.getElementById('estimate-prelude').disabled"),true);
    await importPrelude(preludeFile);await waitFor(()=>evaluate("!document.getElementById('estimate-prelude').disabled"),'prelude imported');
    await click('estimate-prelude');assert.equal(await evaluate("document.querySelectorAll('#prelude-controls table tr').length"),5);
    assert.equal(await evaluate("document.getElementById('apply-prelude').disabled"),true);
    await set('prelude-choice','9','change');await click('apply-prelude');assert.match(await evaluate("document.getElementById('prelude-status').textContent"),/Explicitly using/);
    assert.equal(await evaluate("document.querySelectorAll('#initial-state-chart polyline').length"),0);
    await click('compare-initial-states');await compared();assert.match(await evaluate("document.getElementById('initial-state-status').textContent"),/1 starting states screened/);
  });
  await check('actual prelude notebook download replays both starts; restore invalidates paths',async()=>{
    await evaluate("document.querySelector('#initial-state-panel > button:last-child').click()");const path=join(downloads,'worldlaw-prelude-comparison.json');await waitFor(async()=>{try{return(await stat(path)).size>0;}catch{return false;}},'prelude notebook download');
    const bytes=await readFile(path,'utf8');const {reopenPreludeComparison}=await import(pathToFileURL(join(root,'src/trajectory/prelude-investigation.mjs')));const result=reopenPreludeComparison(bytes);
    assert.equal(result.chosenWindowSize,9);assert.deepEqual(result.input.samples,preludeInput.samples);assert.ok(Math.abs(result.derivedRate-result.originalRate)<.001);assert.equal(result.original.forecasts.variants.length,1);
    assert.ok(result.input.importedFile.sha256.match(/^[a-f0-9]{64}$/));assert.ok(!JSON.parse(bytes).result);
    await click('restore-prelude');assert.equal(await evaluate("document.querySelectorAll('#initial-state-chart polyline').length"),0);assert.equal(await evaluate("document.querySelector('#initial-state-panel > button:last-child').hidden"),true);
    await click('compare-initial-states');await compared();
  });
  const rollingReady=()=>waitFor(()=>evaluate("!document.getElementById('compare-rolling').disabled"),'conditional forecasts finished');
  await check('one through four future observations execute as forecast-only segments',async()=>{
    await set('rolling-origins','30');await set('rolling-horizons','1,2,3,4');await set('rolling-window',9);
    await click('compare-rolling');await rollingReady();
    assert.match(await evaluate("document.getElementById('rolling-status').textContent"),/4\/4 complete horizons; 4 declared/);
    assert.equal(await evaluate("document.querySelectorAll('#rolling-origin-panel details table tr').length"),5);
    assert.equal(await evaluate("document.querySelectorAll('#rolling-chart polyline').length"),2);
  });
  await check('conditional forecast instrument executes declared origins through real keyboard activation',async()=>{
    assert.equal(await evaluate("document.getElementById('rolling-origin-panel').hidden"),false);
    await set('rolling-origins','30,130');await set('rolling-horizons','10,50');await set('rolling-window',9);
    await evaluate("document.getElementById('compare-rolling').focus()");assert.equal(await evaluate('document.activeElement.id'),'compare-rolling');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:String.fromCharCode(13),unmodifiedText:String.fromCharCode(13)});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await rollingReady();
    assert.match(await evaluate("document.getElementById('rolling-status').textContent"),/2\/2 complete horizons; 4 declared/);
    assert.equal(await evaluate("document.querySelectorAll('#rolling-chart polyline').length"),3);
    assert.equal(await evaluate("document.querySelectorAll('#rolling-origin-panel details table tr').length"),5);
    await set('rolling-show-horizon',50,'change');assert.equal(await evaluate("document.querySelectorAll('#rolling-chart polyline').length"),3);
  });
  await check('rolling notebook replays all input-bound outcomes; invalid tail does not truncate',async()=>{
    await click('export-rolling');const file=join(downloads,'worldlaw-rolling-origin.json');await waitFor(async()=>{try{return(await stat(file)).size>0;}catch{return false;}},'rolling notebook download');
    const bytes=await readFile(file,'utf8');const {reopenRollingOrigin}=await import(pathToFileURL(join(root,'src/trajectory/rolling-origin.mjs')));const replay=reopenRollingOrigin(bytes);assert.equal(replay.trials.length,4);assert.ok(replay.summaries.every(s=>s.status==='complete'));assert.ok(!JSON.parse(bytes).summaries);
    await set('rolling-origins','199');assert.equal(await evaluate("document.querySelectorAll('#rolling-chart polyline').length"),0);assert.equal(await evaluate("document.getElementById('export-rolling').hidden"),true);
    await click('compare-rolling');await rollingReady();assert.match(await evaluate("document.getElementById('rolling-status').textContent"),/complete receiving window/);
    await set('rolling-origins','30,130');await click('compare-rolling');await rollingReady();
  });
  await check('narrow and desktop layouts preserve instrument',async()=>{
    for(const width of [320,390,1440]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await waitFor(()=>evaluate("(()=>{const s=document.querySelector('#initial-state-chart svg');return s&&Math.abs(s.viewBox.baseVal.width-Math.max(200,Math.round(s.parentElement.clientWidth)))<1})()"),'responsive chart dimensions');const labels=await evaluate("(()=>{const t=document.querySelectorAll('#initial-state-chart text'),a=t[3].getBoundingClientRect(),b=t[4].getBoundingClientRect();return {minimumBottom:a.bottom,timeTop:b.top,font:getComputedStyle(t[3]).fontSize}})()");assert.ok(labels.minimumBottom<labels.timeTop,JSON.stringify(labels));const rollingLabels=await evaluate("(()=>{const t=document.querySelectorAll('#rolling-chart text');return {bottom:t[3].getBoundingClientRect().bottom,top:t[4].getBoundingClientRect().top}})()");assert.ok(rollingLabels.bottom<rollingLabels.top,JSON.stringify(rollingLabels));const sizes=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(sizes.scroll<=sizes.width,JSON.stringify(sizes));const metrics=await call('Page.getLayoutMetrics');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});await writeFile(join(output,`initial-states-${width}.png`),Buffer.from(shot.data,'base64'));}
  });
  await check('no page exceptions or external requests',async()=>{assert.deepEqual(exceptions,[]);assert.deepEqual(requests.filter(url=>!url.startsWith(origin)&&!url.startsWith('data:')&&!url.startsWith('blob:')),[]);});
  await writeFile(join(output,'browser-receipt.json'),JSON.stringify({status:'passed',checks,sourceRoot:root,browser:await call('Browser.getVersion')},null,2));console.log(JSON.stringify({passed:checks.length,output}));
}catch(error){await writeFile(join(output,'browser-failure.json'),JSON.stringify({passed:checks,error:String(error),exceptions,chromeLog},null,2));throw error;}
finally{socket?.close();chrome.kill('SIGTERM');server.close();}
