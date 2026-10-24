import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';

const root=process.env.BROWSER_ARTIFACT_DIR;
if(root)await mkdir(root,{recursive:true});
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const directory=await mkdtemp(path.join(tmpdir(),'worldlaw-profile-receiving-'));
const executable=process.env.BROWSER_EXECUTABLE_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');
const chrome=spawn(executable,['--headless=new','--disable-background-networking','--remote-debugging-port=0',
  '--user-data-dir='+directory,'--window-size=1440,1100','about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map(),results=[],events={exceptions:[],outside:[]};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let evaluate;
const settings={knots:[-.75,-.5,-.25,0,.25,.5,.75],nuisanceTerms:['bias'],noiseSigma:1e-7,ambiguityDelta:6};
const source=count=>Array.from({length:count},(_,i)=>{const position=-1+2*i/(count-1);return{position,command:0,rate:0,jointTorque:.2-1.4*position+3.7*Math.max(0,position-.137)}});
const notebook=(rows=source(31),options=settings)=>JSON.stringify({schema:'worldlaw.stiffness-notebook/v1',settings:options,
 dataset:{schema:'worldlaw.observations/v1',source:{label:'Independent non-grid hinge course',kind:'synthetic',metadata:{basis:'Analytically authored development control; no physical measurement'}},
 observations:rows,heldOut:source(37)}});
const input=notebook(),inputSHA256=createHash('sha256').update(input).digest('hex');
try{
 let port;
 for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(directory,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}}
 assert.ok(port,'Chrome DevTools port unavailable');
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),tab=tabs.find(tab=>tab.type==='page');
 assert.ok(tab,'No isolated browser page');
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data);
  if(data.id){const request=pending.get(data.id);if(request){pending.delete(data.id);data.error?request.reject(Error(data.error.message)):request.resolve(data.result);}}
  if(data.method==='Runtime.exceptionThrown')events.exceptions.push(data.params.exceptionDetails);
  if(data.method==='Network.requestWillBeSent'&&!data.params.request.url.startsWith(origin+'/')&&!data.params.request.url.startsWith('blob:'+origin+'/'))events.outside.push(data.params.request.url);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 evaluate=async expression=>{const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value;};
 const until=async predicate=>{for(let i=0;i<90;i++){if(await evaluate(predicate))return;await delay(60);}throw Error('Timed out: '+predicate);};
 const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
 const text=id=>evaluate('document.getElementById('+JSON.stringify(id)+').textContent');
 const upload=async(id,contents,name='authored.json')=>evaluate(`(()=>{const list=new DataTransfer();list.items.add(new File([${JSON.stringify(contents)}],${JSON.stringify(name)},{type:'application/json'}));const element=document.getElementById(${JSON.stringify(id)});element.files=list.files;element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const load=async(contents=input)=>{await upload('source-file',contents);await until("document.querySelector('#source-label').textContent.includes('Independent non-grid hinge course') && document.querySelector('#knot-profile-status').dataset.status==='not_run'");};
 const run=async()=>{await click('knot-profile-run');await until("document.querySelector('#knot-profile-status').dataset.status!=='not_run'");};
 const knot=()=>evaluate("Number(document.querySelector('#knot-profile-status').dataset.knot)");
 const check=async(name,fn)=>{await fn();results.push({name,passed:true});};
 const key=async(key,code,number,text)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:number,...(text?{text}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number});};
 const save=async()=>{const file=path.join(directory,'worldlaw-stiffness-inputs.json');await rm(file,{force:true});await click('save');for(let i=0;i<100;i++){try{const content=await readFile(file,'utf8');JSON.parse(content);return content;}catch{await delay(60);}}throw Error('Actual experiment download absent');};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
 await send('Page.navigate',{url:origin+'/stiffness.html'});
 await until("document.readyState==='complete' && document.querySelector('#verdict')?.textContent.length>0");

 await check('actual original source produces a computed non-grid curve without mutating the declared experiment',async()=>{
  await load();const before=await save();await run();assert.ok(Math.abs(await knot()-.137)<1e-10);
  assert.equal(await evaluate("document.querySelectorAll('#response-plot polyline').length"),3);
  assert.equal(await evaluate("document.querySelector('#profile-grid-legend').hidden"),false);
  assert.equal(await save(),before);assert.match(await text('knot-profile-status'),/Computed candidate/);
  assert.match(await text('knot-profile-detail'),/Checks did not generate or select/);
 });
 await check('native keyboard offers an angle, explicit fit changes the law, and an actual downloaded experiment reopens',async()=>{
  await evaluate("document.getElementById('knot-profile-offer').focus()");await key('Enter','Enter',13,'\r');
  assert.equal(await evaluate("document.activeElement.closest('form')?.id"),'settings');
  assert.ok((await evaluate("document.querySelector('#knots').value")).includes('0.137'));
  await key('Enter','Enter',13,'\r');await until("document.querySelector('#knot-profile-status').dataset.status==='not_run'");
  const saved=await save(),json=JSON.parse(saved);
  assert.ok(saved.includes('0.137'));assert.equal(await text('verdict'),'PIECEWISE PREFERRED');
  await upload('source-file',saved,'received-experiment.json');await until("document.querySelector('#verdict').textContent==='PIECEWISE PREFERRED'");
  assert.equal(await save(),saved);assert.ok(json.schema.startsWith('worldlaw.stiffness-'));
  await run();assert.equal(await evaluate("document.querySelector('#knot-profile-status').dataset.status"),'grid_retained');
 });
 await check('an admitted interior neighbor keeps exact editable precision through fit, actual save, reopen and unchanged refit',async()=>{
  const boundary=-.7999999999999999;
  const rows=Array.from({length:21},(_,i)=>{const position=-1+i/10;return{position,command:0,rate:0,jointTorque:.2-1.4*position+3.7*Math.max(0,position-boundary)}});
  await load(notebook(rows,{...settings,knots:[boundary]}));
  const exact=()=>evaluate("document.querySelector('#knots').value.split(',').map(Number)");
  assert.deepEqual(await exact(),[boundary]);
  const before=await save();
  await evaluate("document.querySelector('#settings').requestSubmit()");
  assert.deepEqual(await exact(),[boundary]);assert.equal(await save(),before);
  await upload('source-file',before,'interior-neighbor.json');
  await until("document.querySelector('#knots').value==='-0.7999999999999999'");
  await evaluate("document.querySelector('#settings').requestSubmit()");
  assert.deepEqual(await exact(),[boundary]);assert.equal(await save(),before);
  assert.equal(await text('error'),'');
 });
 await check('separately supplied contradictory checks change challenge error without changing computed angle',async()=>{
  await load();await run();const before=await knot();
  await upload('check-file',JSON.stringify({observations:source(37).map(row=>({...row,jointTorque:row.jointTorque+100})),source:{label:'Contradictory independent authored checks',kind:'synthetic'}}));
  await until("document.querySelector('#knot-profile-status').dataset.status==='not_run'");await run();
  assert.equal(await knot(),before);assert.match(await text('knot-profile-detail'),/Separate-check RMSE 100 N/);
 });
 await check('rank refusal, workload refusal and full declaration capacity stay visible without a substitute proposal',async()=>{
  await load(notebook(source(31),{...settings,nuisanceTerms:['bias','command']}));await run();
  assert.equal(await evaluate("document.querySelector('#knot-profile-status').dataset.status"),'baseline_rank_deficient');
  assert.equal(await evaluate("document.querySelector('#knot-profile-offer').disabled"),true);
  await load(notebook(source(1024)));await run();assert.equal(await evaluate("document.querySelector('#knot-profile-status').dataset.status"),'work_limit');
  assert.equal(await evaluate("document.querySelector('#knot-profile-inspect').disabled"),true);
  await load(notebook(source(31),{...settings,knots:Array.from({length:101},(_,i)=>-.75+1.5*i/100)}));await run();
  assert.equal(await evaluate("document.querySelector('#knot-profile-status').dataset.status"),'candidate_found');
  assert.equal(await evaluate("document.querySelector('#knot-profile-offer').disabled"),true);
  assert.match(await text('knot-profile-detail'),/grid is full/);
 });
 await check('search activity fences an outstanding source-file read and preserves the current raw source',async()=>{
  await load();await evaluate("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='late-profile.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',notebook(source(31).map(row=>({...row,jointTorque:0}))),'late-profile.json');await run();await delay(500);assert.ok(Math.abs(await knot()-.137)<1e-10);assert.equal(await evaluate("document.querySelector('#knot-profile-status').dataset.status"),'candidate_found');}
  finally{await evaluate('File.prototype.text=window.originalFileText');}
 });
 for(const width of [1440,390])await check('computed laws, controls and keyboard focus remain readable at '+width+'px',async()=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await load();await evaluate("document.querySelector('#knot-profile-run').focus()");await key('Enter','Enter',13,'\r');
  assert.ok(Math.abs(await knot()-.137)<1e-10);assert.equal(await evaluate('document.activeElement.id'),'knot-profile-run');
  for(const id of ['knot-profile-run','knot-profile-status','knot-profile-inspect','knot-profile-offer']){
   const geometry=await evaluate(`(()=>{const n=document.getElementById(${JSON.stringify(id)}),r=n.getBoundingClientRect(),s=getComputedStyle(n);return{left:r.left,right:r.right,font:parseFloat(s.fontSize),height:r.height}})()`);
   assert.ok(geometry.left>=-1&&geometry.right<=width+1&&geometry.font>=13,JSON.stringify(geometry));
  }
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
  if(root){for(const [id,name]of [['response-plot','curves'],['knot-profile-title','profile']]){
   await evaluate('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"start",behavior:"instant"})');await delay(80);
   const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(root,name+'-'+width+'.png'),Buffer.from(screenshot.data,'base64'));
  }}
  await click('gauge-view');assert.equal(await evaluate("document.querySelector('#profile-grid-legend').hidden"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);await click('response-view');
 });
 await check('no page exception or nonlocal request in the actual source-to-notebook course',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 const receipt={pass:true,checks:results.length,inputSHA256,results,events,qualification:'Actual authored-source browser receiving; no physical calibration or runtime sandbox attestation.'};
 if(root){await writeFile(path.join(root,'browser.json'),JSON.stringify(receipt,null,2));await writeFile(path.join(root,'authored-input.json'),input);}
 console.log(JSON.stringify(receipt,null,2));
}catch(error){
 let state;try{state=await evaluate?.("({error:document.querySelector('#error')?.textContent,status:document.querySelector('#knot-profile-status')?.textContent,focus:document.activeElement?.id})");}catch{}
 console.error(JSON.stringify({pass:false,error:error.message,completed:results,state,events},null,2));throw error;
}finally{
 try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(300);
 await rm(directory,{recursive:true,force:true});await new Promise(resolve=>server.close(resolve));
}
