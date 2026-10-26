import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port+'/stiffness.html';
const dir=await mkdtemp(path.join(os.tmpdir(),'worldlaw-experiment-chrome-'));
const chrome=spawn(process.env.BROWSER_EXECUTABLE_PATH||'/usr/local/bin/google-chrome',['--headless=new','--disable-gpu','--disable-background-networking','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+dir,'--window-size=1440,1000','about:blank'],{stdio:'ignore'});
let diagnosticEval=null;
let ws,seq=0;const pending=new Map(),events={exceptions:[],outside:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const out=[],historyVisibility=[],proposalVisibility=[];
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
   if(v.method==='Network.requestWillBeSent'&&!v.params.request.url.startsWith(new URL(origin).origin+'/')&&!v.params.request.url.startsWith('blob:'+new URL(origin).origin+'/'))events.outside.push(v.params.request.url);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaljs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
 diagnosticEval=evaljs;
 const wait=async predicate=>{for(let i=0;i<70;i++){if(await evaljs(predicate))return;await delay(70);}throw new Error('Timed out: '+predicate)};
 const check=async(name,fn)=>{await fn();out.push({name,passed:true})};
 await send('Page.enable');await send('Runtime.enable');const sandbox=await requireChromiumSandbox({send});if(outputDir)await writeFile(path.join(outputDir,'stiffness-experiment-browser-sandbox.json'),JSON.stringify(sandbox,null,2));await send('Network.enable');
 await send('Page.navigate',{url:origin});
 await wait("document.readyState==='complete' && document.querySelector('#verdict')?.textContent.length>1");


 const click=async id=>evaljs("document.getElementById("+JSON.stringify(id)+").click()");
 const upload=async(id,content,name='input.json')=>evaljs("(()=>{const dt=new DataTransfer();dt.items.add(new File(["+JSON.stringify(content)+"],"+JSON.stringify(name)+",{type:'application/json'}));const input=document.getElementById("+JSON.stringify(id)+");input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
 const paint=async()=>evaljs('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 const screenshot=async name=>{await paint();if(outputDir){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outputDir,name+'.png'),Buffer.from(s.data,'base64'));}};
 const showHistory=async name=>{
  await evaljs("(()=>{const body=document.querySelector('#experiment-history'),box=body.closest('.experiment-scroll');body.querySelectorAll('details').forEach(d=>d.open=true);box.scrollIntoView({block:'start',behavior:'instant'});box.scrollTop=0;box.scrollLeft=0;})()");
  await paint();
  const metrics=await evaljs(`(()=>{
   const body=document.querySelector('#experiment-history'),box=body.closest('.experiment-scroll'),row=body.querySelector('tr[data-acquisition-id]'),table=body.closest('table');
   const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   if(!row)return {missing:true};
   const clip=rect(box),paragraph=innerWidth<=740?row.querySelector('.history-forecast-preview'):[...row.querySelectorAll('details p')].find(p=>p.textContent.includes('frozen residual'));
   const measure=(node,phrase=null)=>{
    if(!node)return null;
    const range=document.createRange();range.selectNodeContents(node);
    if(phrase){const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let textNode;while(textNode=walker.nextNode()){const start=textNode.textContent.indexOf(phrase);if(start>=0){const unit=textNode.textContent.indexOf('N·m',start);range.setStart(textNode,start);range.setEnd(textNode,unit<0?textNode.length:unit+3);break;}}}
    const r=rect(range),style=getComputedStyle(node);
    return {text:range.toString(),...r,font:parseFloat(style.fontSize),visibility:style.visibility,display:style.display,
     visibleWidth:Math.max(0,Math.min(r.right,clip.right,innerWidth)-Math.max(r.left,clip.left,0)),
     visibleHeight:Math.max(0,Math.min(r.bottom,clip.bottom,innerHeight)-Math.max(r.top,clip.top,0)),
     fullyVisible:r.left>=Math.max(0,clip.left)-1&&r.right<=Math.min(innerWidth,clip.right)+1&&r.top>=Math.max(0,clip.top)-1&&r.bottom<=Math.min(innerHeight,clip.bottom)+1};
   };
   return {viewport:{width:innerWidth,height:innerHeight},table:rect(table),row:rect(row),container:clip,
    acquisition:row.dataset.acquisitionId,identity:measure(row.cells[0]),torque:measure(row.cells[2]),prediction:measure(paragraph,'predicted '),residual:measure(paragraph,'frozen residual '),
    labels:[...row.cells].map(cell=>({declared:cell.dataset.label??null,before:getComputedStyle(cell,'::before').content,text:cell.textContent})),
    scrollTop:box.scrollTop,scrollLeft:box.scrollLeft};
  })()`);
  assert.ok(!metrics.missing&&metrics.table.width>0&&metrics.row.height>0,JSON.stringify(metrics));
  assert.ok(metrics.identity.visibleWidth>8&&metrics.identity.visibleHeight>8,JSON.stringify(metrics));
  for(const key of ['torque','prediction','residual']){
   const evidence=metrics[key];assert.ok(evidence&&evidence.fullyVisible&&evidence.font>=12,JSON.stringify({key,...metrics}));
   assert.notEqual(evidence.visibility,'hidden');assert.notEqual(evidence.display,'none');assert.match(evidence.text,/N·m/);
  }
  assert.match(metrics.prediction.text,/predicted/);assert.match(metrics.residual.text,/frozen residual/);
  if(metrics.viewport.width===390){
   assert.ok(metrics.table.width<=metrics.container.width+1,JSON.stringify(metrics));
   assert.ok(metrics.labels.some(label=>/torque/i.test(label.declared??'')&&(/torque/i.test(label.before)||/torque/i.test(label.text))),JSON.stringify(metrics.labels));
  }
  historyVisibility.push({name,...metrics});await screenshot(name);
 };
 const download=path.join(dir,'downloads');await mkdir(download,{recursive:true});
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});
 const savedPath=path.join(download,'worldlaw-stiffness-inputs.json');
 const save=async()=>{
  await rm(savedPath,{force:true});await click('save');
  for(let i=0;i<80;i++){try{const text=await readFile(savedPath,'utf8');JSON.parse(text);return text;}catch{await delay(70);}}
  throw new Error('No complete experiment download');
 };
 const text=id=>evaljs('document.getElementById('+JSON.stringify(id)+').textContent');
 const value=async(id,v)=>evaljs('document.getElementById('+JSON.stringify(id)+').value='+JSON.stringify(v));
 const course=async kind=>{await value('experiment-course',kind);await click('experiment-load-course');};
 const freeze=async index=>evaljs('document.querySelector(\'#experiment-ranking button[data-freeze-index="'+index+'"]\').click()');
 const rowCount=async()=>Number((await text('source-label')).match(/(\d+) training/)[1]);
 const historyCount=async()=>Number(await evaljs("document.querySelector('#experiment-history').dataset.acquisitionCount"));
 const planStatus=async()=>evaljs("document.querySelector('#experiment-status').dataset.planStatus");
 const pendingIndex=async()=>evaljs("document.querySelector('#experiment-pending').dataset.index || null");
 const renderedState=async()=>evaljs("({ranking:document.querySelector('#experiment-ranking').textContent,pending:document.querySelector('#experiment-pending').textContent,history:document.querySelector('#experiment-history').textContent,status:document.querySelector('#experiment-status').dataset.planStatus})");
 let initialSaved,afterObservedSaved,pendingSaved,firstPendingText;
 await check('maintained studio navigation enters the actual experiment-enabled lab',async()=>{
  await send('Page.navigate',{url:new URL('/',origin).href});
  await wait("document.readyState==='complete'&&Number(document.querySelector('#sample-count')?.textContent)>0");
  assert.ok(await evaljs("Boolean(document.querySelector('a[href=\"/stiffness.html\"]'))"));
  await evaljs("document.querySelector('a[href=\"/stiffness.html\"]').click()");
  await wait("document.readyState==='complete'&&Boolean(document.querySelector('#experiment-load-course'))");
 });
 await check('authored ambiguous course exposes a numerical proposal from actual training',async()=>{
  await course('kink');await wait("document.querySelector('#experiment-status').dataset.planStatus==='proposed'");
  assert.equal(await rowCount(),8);assert.equal(await historyCount(),0);
  assert.equal(await evaljs("document.querySelectorAll('#experiment-ranking button[data-freeze-index]').length"),8);
  assert.match(await text('source-label'),/authored.*ambiguous/i);
  initialSaved=await save();const input=JSON.parse(initialSaved);
  assert.equal(input.schema,'worldlaw.stiffness-experiment/v1');assert.equal(input.initial.dataset.observations.length,8);
  assert.equal(input.permitted.length,8);assert.deepEqual(input.acquisitions,[]);
  assert.ok(!('fit'in input)&&!('history'in input));
 });
 await check('keyboard freezes a current proposal before authored observation and refit',async()=>{
  await evaljs("document.querySelector('#experiment-ranking button[data-freeze-index=\"2\"]').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await pendingIndex(),'2');
  assert.equal(await evaljs("document.activeElement!==document.body && document.activeElement.isConnected"),true,'Keyboard freeze must retain a usable focus target');
  firstPendingText=await text('experiment-pending');assert.match(firstPendingText,/frozen|forecast/i);
  assert.equal(await evaljs("document.querySelector('#experiment-virtual-receive').disabled"),false);
  await evaljs("document.querySelector('#experiment-pending').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('experiment-frozen-1440');
  await click('experiment-virtual-receive');assert.equal(await rowCount(),9);assert.equal(await historyCount(),1);
  assert.match(await text('experiment-history'),/authored|synthetic/i);
  afterObservedSaved=await save();const input=JSON.parse(afterObservedSaved);
  assert.equal(input.acquisitions.length,1);assert.equal(input.acquisitions[0].index,2);
  assert.equal(input.acquisitions[0].observation.jointTorque,.3);
  assert.equal(input.pending,null);assert.equal(input.initial.dataset.observations.length,8);
  await showHistory('experiment-refit-history-1440');
 });
 await check('input-only download reopens both accumulated history and a frozen pending request',async()=>{
  await freeze(3);assert.equal(await pendingIndex(),'3');
  pendingSaved=await save();const input=JSON.parse(pendingSaved);assert.equal(input.pending,3);assert.equal(input.acquisitions.length,1);
  const before=await renderedState();
  await course('smooth');await upload('source-file',pendingSaved,'pending-experiment.json');
  await wait("document.querySelector('#experiment-pending').dataset.index==='3'");
  assert.equal(await historyCount(),1);assert.equal(await rowCount(),9);
  const after=await renderedState();assert.equal(after.history,before.history);assert.equal(after.pending,before.pending);assert.equal(after.ranking,before.ranking);
  assert.equal(await evaljs("document.querySelector('#experiment-virtual-receive').disabled"),true,'Imported provenance must not restore the local authored instrument capability');
 });
 await check('separate-check replacement leaves proposals, frozen forecasts and history unchanged',async()=>{
  const before=await renderedState();
  const input=JSON.parse(pendingSaved);const checks={source:{label:'Independently supplied hostile-valued separate checks'},observations:input.initial.dataset.heldOut.map(r=>({...r,jointTorque:9999}))};
  const previousComparison=await text('comparison-body');
  await upload('check-file',JSON.stringify(checks));
  await wait('document.querySelector("#comparison-body").textContent!=='+JSON.stringify(previousComparison));
  const after=await renderedState();assert.deepEqual(after,before);assert.equal(await historyCount(),1);
 });
 await check('manual acquisition preserves declared provenance and rejects coordinates outside the pending request',async()=>{
  await value('observation-id','browser-manual-reading');await value('observation-source','Operator entered receiver check');await value('observation-kind','manual-unverified');
  await value('observation-torque','0.18');
  const originalPosition=await evaljs("document.querySelector('#observation-position').value");
  await value('observation-position','0.987');await click('experiment-receive');
  await wait("document.querySelector('#error').textContent.includes('coordinates')");
  assert.equal(await historyCount(),1);assert.equal(await pendingIndex(),'3');assert.equal(await rowCount(),9);
  await value('observation-position',originalPosition);await click('experiment-receive');
  assert.equal(await historyCount(),2);assert.equal(await rowCount(),10);
  assert.match(await text('experiment-history'),/Operator entered receiver check/);
  const saved=JSON.parse(await save());const last=saved.acquisitions.at(-1);
  assert.equal(last.id,'browser-manual-reading');assert.equal(last.source.label,'Operator entered receiver check');assert.equal(last.source.declaredKind,'manual-unverified');assert.equal(last.observation.jointTorque,.18);
 });
 await check('declaration changes cannot rewrite historical planning; pending-only edits remain available in a fresh experiment',async()=>{
  await freeze(4);assert.equal(await pendingIndex(),'4');
  const before=await renderedState(),count=await historyCount(),input=JSON.parse(await save());
  const expanded=[...input.permitted,{command:0,position:.25,rate:0}];
  await value('permitted-states',JSON.stringify(expanded));await click('experiment-set-permitted');
  await wait("document.querySelector('#error').textContent.includes('frozen after the first acquisition')");
  assert.deepEqual(await renderedState(),before);assert.equal(await historyCount(),count);assert.equal(await pendingIndex(),'4');
  await course('kink');await freeze(4);assert.equal(await historyCount(),0);
  await value('permitted-states',JSON.stringify(expanded));await click('experiment-set-permitted');
  assert.equal(await pendingIndex(),null);
  assert.equal(await evaljs("document.querySelector('#experiment-receive').disabled"),true);
  await click('experiment-receive');assert.equal(await historyCount(),0);
 });
 await check('omitted smooth course reports model mismatch without a recommendation',async()=>{
  await course('smooth');assert.equal(await planStatus(),'model_mismatch');assert.equal(await text('verdict'),'FAMILY MISMATCH');
  assert.equal(await evaljs("[...document.querySelectorAll('#experiment-ranking button')].some(button=>button.textContent==='Freeze proposed state')"),false);
  assert.equal(await evaljs("document.querySelector('#experiment-freeze-proposed').disabled"),true);
  assert.equal(await evaljs("document.querySelector('#experiment-freeze-proposed').dataset.freezeIndex??null"),null);
  assert.match(await text('experiment-proposed-summary'),/No automatic proposal: model mismatch/);
  const input=JSON.parse(await save());assert.equal(input.pending,null);assert.equal(input.acquisitions.length,0);
  assert.match(await text('experiment-status'),/mismatch|not recommend/i);
 });
 await check('late experiment import cannot replace a more recent course selection',async()=>{
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow-experiment.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',pendingSaved,'slow-experiment.json');await course('smooth');await delay(500);
   assert.equal(await planStatus(),'model_mismatch');assert.equal(await historyCount(),0);assert.equal(await pendingIndex(),null);
  }finally{await evaljs("File.prototype.text=window.originalFileText");}
 });
 await check('late source read cannot replace a newly frozen request',async()=>{
  await course('kink');
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow-experiment.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',pendingSaved,'slow-experiment.json');await freeze(2);await delay(500);
   assert.equal(await historyCount(),0);assert.equal(await pendingIndex(),'2');assert.equal(await rowCount(),8);
  }finally{await evaljs("File.prototype.text=window.originalFileText");}
 });
 await check('late source read cannot overwrite a newly received acquisition',async()=>{
  await course('kink');await freeze(2);
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow-experiment.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',pendingSaved,'slow-experiment.json');await click('experiment-virtual-receive');await delay(500);
   assert.equal(await historyCount(),1);assert.equal(await pendingIndex(),null);assert.equal(await rowCount(),9);
   const received=JSON.parse(await save());assert.equal(received.acquisitions.length,1);assert.equal(received.acquisitions[0].index,2);assert.equal(received.pending,null);
  }finally{await evaljs("File.prototype.text=window.originalFileText");}
 });
 await check('malformed experiment results and invalid state declarations leave the valid experiment intact',async()=>{
  const before=await renderedState();const bad=JSON.parse(pendingSaved);bad.fit={verified:true};
  await upload('source-file',JSON.stringify(bad));await wait("document.querySelector('#error').textContent.length>0");
  assert.deepEqual(await renderedState(),before);
  await evaljs("document.querySelector('#error').textContent=''");
  await value('permitted-states','[{"command":0,"position":1e99,"rate":0}]');await click('experiment-set-permitted');
  await wait("document.querySelector('#error').textContent.includes('finite')");
  assert.deepEqual(await renderedState(),before);
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await course('kink');await delay(120);
  await check('contained readable experiment controls and keyboard access at '+width+'px',async()=>{
   await evaljs("document.querySelector('#experiment-proposed-summary').scrollIntoView({block:'start',behavior:'instant'})");await paint();
   const proposal=await evaljs("(()=>{const summary=document.querySelector('#experiment-proposed-summary'),button=document.querySelector('#experiment-freeze-proposed');return {text:summary.textContent,index:button.dataset.freezeIndex,disabled:button.disabled,elements:[summary,button].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(n).fontSize)}})}})()");
   assert.equal(proposal.index,'2');assert.equal(proposal.disabled,false);assert.match(proposal.text,/Proposed state #2.*Forecast spread/);
   for(const element of proposal.elements)assert.ok(element.left>=-1&&element.right<=width+1&&element.top>=-1&&element.bottom<=1001&&element.font>=12,JSON.stringify(proposal));
   proposalVisibility.push({width,...proposal});await screenshot('experiment-proposal-summary-'+width);
   await evaljs("document.querySelector('#experiment-freeze-proposed').focus()");
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   assert.equal(await pendingIndex(),'2');assert.equal(await evaljs("document.activeElement.id"),'observation-source');
   assert.equal(await evaljs("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
   assert.ok(await evaljs("document.documentElement.scrollWidth<=innerWidth+1"));
   const metrics=await evaljs("['experiment-status','experiment-pending','experiment-virtual-receive'].map(id=>{const n=document.getElementById(id),r=n.getBoundingClientRect();return {id,width:r.width,left:r.left,right:r.right,font:parseFloat(getComputedStyle(n).fontSize)}})");
   for(const m of metrics){assert.ok(m.width>0&&m.left>=-1&&m.right<=width+1,JSON.stringify(m));assert.ok(m.font>=12,JSON.stringify(m));}
   await evaljs("document.querySelector('#experiment-virtual-receive').focus()");
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   assert.ok(await evaljs("document.activeElement!==document.body"));
  });
  await evaljs("document.querySelector('#experiment-status').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('experiment-proposal-'+width);
  await evaljs("document.querySelector('#experiment-pending').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('experiment-pending-'+width);
  await click('experiment-virtual-receive');await showHistory('experiment-history-'+width);
 }

 let revisedSaved,revisionHistory;
 const expand=async(origin=0)=>{await value('family-origin',origin);await value('family-reason','Test an explicit smooth alternative after the original family mismatch.');await click('family-expand');};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await check('explicit smooth expansion retains the original failure and exact earlier frozen errors',async()=>{
  await course('smooth');await freeze(2);await click('experiment-virtual-receive');
  revisionHistory=await text('experiment-history');await freeze(7);assert.equal(await pendingIndex(),'7');
  await expand();assert.equal(await pendingIndex(),null);assert.equal(await historyCount(),1);
  assert.equal(await text('verdict'),'SMOOTH CUBIC PREFERRED');assert.equal(await text('experiment-history'),revisionHistory);
  assert.equal(await evaljs("document.querySelector('#family-revision-status').dataset.boundary"),'1');
  assert.match(await text('family-original-error'),/training mismatch/);assert.match(await text('family-expanded-error'),/not falsified on training/);
  assert.match(await text('equation'),/³/);assert.match(await text('slopes'),/Slope varies with angle/);
  const saved=JSON.parse(await save());assert.equal(saved.schema,'worldlaw.stiffness-experiment/v2');
  assert.equal(saved.initial.schema,'worldlaw.stiffness-notebook/v1');assert.equal(saved.revisions.length,1);assert.equal(saved.revisions[0].at,1);assert.equal(saved.revisions[0].origin,0);
  assert.equal(await evaljs("document.querySelector('#family-expand').disabled"),true);
 });
 await check('future cubic forecasts receive separately and complete revised inputs reopen through actual download',async()=>{
  await freeze(0);assert.match(await text('experiment-pending'),/Smooth cubic, origin 0/);await click('experiment-virtual-receive');
  assert.equal(await historyCount(),2);assert.ok((await text('experiment-history')).startsWith(revisionHistory));
  await freeze(7);revisedSaved=await save();const before=await renderedState();
  await course('kink');await upload('source-file',revisedSaved,'revised-experiment.json');
  await wait("document.querySelector('#family-revision-status').dataset.boundary==='1'&&document.querySelector('#experiment-history').dataset.acquisitionCount==='2'");
  assert.deepEqual(await renderedState(),before);assert.equal(await evaljs("document.querySelector('#experiment-virtual-receive').disabled"),true);
  await value('observation-source','Separate supplied authored cubic reading');await value('observation-kind','authored receiving control');
  await value('observation-torque',-3.9);await click('experiment-receive');assert.equal(await historyCount(),3);assert.equal(await pendingIndex(),null);
  assert.ok((await text('experiment-history')).startsWith(revisionHistory));
 });
 await check('changed separate checks preserve revised training, requests, revision evidence and sequential errors',async()=>{
  await freeze(4);const before=await renderedState(),revision=await text('family-revision-comparison');
  const input=JSON.parse(revisedSaved);const checks={source:{label:'Separate counterfactual check values'},observations:input.initial.dataset.heldOut.map(row=>({...row,jointTorque:999}))};
  await upload('check-file',JSON.stringify(checks));await wait("document.querySelector('#experiment-status').textContent.includes('Separate checks replaced only')");assert.ok(await evaljs("[...document.querySelectorAll('#comparison-body tr')].every(row=>parseFloat(row.cells[2].textContent)>990)"));
  assert.deepEqual(await renderedState(),before);assert.equal(await text('family-revision-comparison'),revision);
 });
 await check('malformed family event refuses without replacing the accepted revised experiment',async()=>{
  const before=await renderedState(),bad=JSON.parse(revisedSaved);bad.revisions[0].at=99;
  await upload('source-file',JSON.stringify(bad));await wait("document.querySelector('#error').textContent.includes('boundary')");assert.deepEqual(await renderedState(),before);
 });
 await check('a late source import cannot overwrite a newly declared family revision',async()=>{
  await course('smooth');
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow-family.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',pendingSaved,'slow-family.json');await expand();await delay(500);
   assert.equal(await text('verdict'),'SMOOTH CUBIC PREFERRED');assert.equal(await evaljs("document.querySelector('#family-revision-status').dataset.boundary"),'0');
  }finally{await evaljs("File.prototype.text=window.originalFileText");}
 });
 await check('higher-order authored response still reports expanded-family mismatch',async()=>{
  await course('higher');await expand();assert.equal(await planStatus(),'model_mismatch');assert.equal(await text('verdict'),'FAMILY MISMATCH');
  assert.match(await text('family-expanded-error'),/training mismatch/);assert.equal(await evaljs("document.querySelector('#experiment-freeze-proposed').disabled"),true);
 });
 const revisionVisibility=[];
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await check('family revision is keyboard-operable with original and expanded evidence visible at '+width+'px',async()=>{
   await course('smooth');await value('family-origin',0);await value('family-reason','Explicit keyboard revision control.');
   await evaljs("document.querySelector('#family-expand').focus()");
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   assert.equal(await text('verdict'),'SMOOTH CUBIC PREFERRED');
   await evaljs("document.querySelector('#family-revision-status').scrollIntoView({block:'start',behavior:'instant'})");await paint();
   const evidence=await evaljs("['family-revision-status','family-original-error','family-expanded-error','family-revision-guard'].map(id=>{const n=document.getElementById(id),r=n.getBoundingClientRect(),s=getComputedStyle(n);return{id,text:n.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(s.fontSize),display:s.display,visibility:s.visibility}})");
   for(const e of evidence){assert.ok(e.left>=-1&&e.right<=width+1&&e.top>=-1&&e.bottom<=1001&&e.font>=13,JSON.stringify(e));assert.notEqual(e.display,'none');assert.notEqual(e.visibility,'hidden');}
   assert.ok(await evaljs("document.documentElement.scrollWidth<=innerWidth+1"));revisionVisibility.push({width,evidence});await screenshot('stiffness-revision-'+width);
  });
 }

 const designVisibility=[];
 const designStatus=()=>evaljs("document.querySelector('#input-design-status').dataset.status");
 const chooseDesign=async choice=>evaljs("(()=>{const s=document.querySelector('#input-design-structure');s.value="+JSON.stringify(JSON.stringify(choice))+";s.dispatchEvent(new Event('change',{bubbles:true}));})()");
 const designBefore=()=>evaljs("({...document.querySelector('#input-design-before').dataset})");
 let confoundedSaved,recoveredDesignSaved,emptyForecastHistory;
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await check('confounded authored inputs expose rank two of three and the off-line proposed state',async()=>{
  await course('confounded');await chooseDesign({family:'global'});
  assert.equal(await text('verdict'),'UNIDENTIFIABLE');assert.equal(await planStatus(),'unidentifiable');
  assert.equal(await rowCount(),17);assert.equal(await historyCount(),0);
  assert.deepEqual(await designBefore(),{rank:'2',coefficientCount:'3',unresolved:'1'});
  assert.equal(await designStatus(),'proposed');
  assert.equal(await evaljs("document.querySelector('#input-design-freeze').dataset.designIndex"),'1');
  assert.match(await text('input-design-proposal'),/state #1: command 1 N·m; angle 0 rad; rate 0 rad\/s/);
  assert.match(await text('input-design-proposal'),/rank 3 \/ 3; 0 unresolved/);
  assert.equal(await evaljs("document.querySelectorAll('#input-design-rows button[data-design-index]').length"),2);
  assert.match(await evaljs("document.querySelector('#input-design-rows tr[data-design-index=\"0\"]').textContent"),/No admitted improvement.*still unsupported/);
  confoundedSaved=await save();const input=JSON.parse(confoundedSaved);
  assert.deepEqual(input.initial.settings.nuisanceTerms,['bias','command']);assert.equal(input.pending,null);
 });
 await check('design target inspection follows exactly the offered global hinge and revised cubic structures',async()=>{
  const original=await save();
  const choices=await evaljs("[...document.querySelector('#input-design-structure').options].map(o=>JSON.parse(o.value))");
  assert.deepEqual(choices,[{family:'global'},{family:'piecewise',knot:-.3},{family:'piecewise',knot:0},{family:'piecewise',knot:.3}]);
  for(const choice of choices){await chooseDesign(choice);assert.equal(await designStatus(),'proposed');assert.equal((await designBefore()).unresolved,'1');assert.equal(await save(),original);}
  await expand();
  const revised=await evaljs("[...document.querySelector('#input-design-structure').options].map(o=>JSON.parse(o.value))");
  assert.deepEqual(revised.at(-1),{family:'cubic',origin:0});
  await chooseDesign({family:'cubic',origin:0});assert.equal((await designBefore()).coefficientCount,'4');
  assert.match(await text('input-design-status'),/Smooth cubic at origin 0/);
 });
 await check('no-gain and still-deficient design states retain numerical qualifications without inventing a response',async()=>{
  await course('confounded');await chooseDesign({family:'global'});
  await value('permitted-states',JSON.stringify([{command:1,position:.5,rate:0}]));await click('experiment-set-permitted');
  assert.equal(await designStatus(),'no_gain');assert.equal(await evaljs("document.querySelector('#input-design-freeze').disabled"),true);
  assert.equal(await evaljs("document.querySelector('#input-design-freeze').dataset.designIndex??null"),null);
  assert.match(await text('input-design-proposal'),/No single declared input improves/);assert.equal(await pendingIndex(),null);
  const deficient=JSON.parse(confoundedSaved);deficient.initial.settings.nuisanceTerms=['bias','command','rate'];
  await upload('source-file',JSON.stringify(deficient),'still-deficient-design.json');
  await wait("document.querySelector('#input-design-before').dataset.coefficientCount==='4'");
  assert.deepEqual(await designBefore(),{rank:'2',coefficientCount:'4',unresolved:'2'});
  assert.equal(await designStatus(),'proposed');assert.match(await text('input-design-proposal'),/rank 3 \/ 4; 1 unresolved/);
  assert.match(await text('input-design-proposal'),/still lack support/);assert.equal(await text('verdict'),'UNIDENTIFIABLE');
 });
 await check('full observation capacity preserves input diagnostics while disabling every design freeze affordance',async()=>{
  const full=JSON.parse(confoundedSaved),seed=full.initial.dataset.observations;
  full.initial.dataset.observations=Array.from({length:4096},(_,index)=>({...seed[index%seed.length]}));
  await upload('source-file',JSON.stringify(full),'full-capacity-confounded.json');
  await wait("document.querySelector('#source-label').textContent.includes('4096 training')");
  await chooseDesign({family:'global'});
  assert.equal(await rowCount(),4096);assert.equal(await historyCount(),0);assert.equal(await pendingIndex(),null);
  assert.deepEqual(await designBefore(),{rank:'2',coefficientCount:'3',unresolved:'1'});
  assert.match(await text('input-design-proposal'),/rank 3 \/ 3; 0 unresolved/);
  const controls=await evaljs("({proposalDisabled:document.querySelector('#input-design-freeze').disabled,rows:[...document.querySelectorAll('#input-design-rows button[data-design-index]')].map(b=>({index:b.dataset.designIndex,disabled:b.disabled})),explanation:document.querySelector('.input-design').textContent})");
  assert.equal(controls.proposalDisabled,true);assert.equal(controls.rows.length,2);assert.ok(controls.rows.every(row=>row.disabled));
  assert.match(controls.explanation,/capacity|observation bound|4096/i);
  assert.match(controls.explanation,/cannot|disabled|full|limit|capacity/i);
  await click('input-design-freeze');
  await evaljs("document.querySelector('#input-design-rows button[data-design-index=\"1\"]').click()");
  assert.equal(await pendingIndex(),null);assert.equal(await rowCount(),4096);assert.equal(await historyCount(),0);
 });

 async function trustedCapacityClick(selector){
  const point=await evaljs("(()=>{const element=document.querySelector("+JSON.stringify(selector)+");if(!element)throw Error('Missing capacity control');element.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=element.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);if(r.width<=0||r.height<=0||x<0||y<0||x>=innerWidth||y>=innerHeight||!(hit===element||element.contains(hit)))throw Error('Capacity control is not the visible mouse target');return{x,y};})()");
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point,button:'none',buttons:0});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
 }
 async function receiveDesignCapacity({rows,count,workLimit,reason}){
  const raw=JSON.parse(confoundedSaved),seed=raw.initial.dataset.observations;
  assert.ok(seed.length>0);
  raw.initial.dataset.observations=Array.from({length:rows},(_,i)=>({...seed[i%seed.length]}));
  if(workLimit)raw.initial.settings.knots=Array.from({length:101},(_,i)=>-.5+i/100);
  raw.acquisitions=Array.from({length:count},(_,i)=>({id:'capacity-'+i,index:0,
   source:{label:'Authored capacity receiving control',declaredKind:'authored'},
   observation:{...raw.permitted[0],jointTorque:-.1}}));
  raw.pending=null;assert.equal(raw.revisions?.length??0,0);
  const knotCount=raw.initial.settings.knots.length,currentWork=(count+1)*(rows+count)*(knotCount+1),nextWork=(count+2)*(rows+count+1)*(knotCount+1);
  assert.ok(currentWork<=2_000_000);assert.ok(rows+count+1<4096);
  if(workLimit){
   assert.equal(count,17);assert.equal(rows,1024);assert.equal(knotCount,101);
   assert.equal(currentWork,1_911_276);assert.equal(nextWork,2_019_396);
   assert.ok(count+1<=32);assert.ok(nextWork>2_000_000);
  }else{assert.equal(count,32);assert.equal(rows+count,49);assert.ok(nextWork<=2_000_000);}
  await upload('source-file',JSON.stringify(raw),workLimit?'fit-work-capacity-confounded.json':'acquisition-capacity-confounded.json');
  await wait("Number(document.querySelector('#experiment-history')?.dataset.acquisitionCount)==="+count);
  await chooseDesign({family:'global'});
  await wait("(document.querySelector('.input-design')?.textContent||'').includes("+JSON.stringify(reason)+")");
  assert.equal(await rowCount(),rows+count);assert.equal(await historyCount(),count);assert.equal(await pendingIndex(),null);
  const beforeDownload=JSON.parse(await save());
  assert.equal(beforeDownload.initial.dataset.observations.length,rows);assert.equal(beforeDownload.initial.settings.knots.length,knotCount);
  assert.equal(beforeDownload.acquisitions.length,count);assert.equal(beforeDownload.revisions?.length??0,0);assert.equal(beforeDownload.pending,null);
  const beforeSource=await evaljs("document.querySelector('#observation-source').value"),beforeDiagnostics=await designBefore();
  const ui=await evaljs("(()=>{const before=document.querySelector('#input-design-before'),proposal=document.querySelector('#input-design-freeze'),buttons=[...document.querySelectorAll('#input-design-rows button[data-design-index]')];return{rank:Number(before.dataset.rank),coefficientCount:Number(before.dataset.coefficientCount),text:document.querySelector('.input-design').innerText,proposalDisabled:proposal.disabled,rows:buttons.map(b=>({index:b.dataset.designIndex,disabled:b.disabled}))};})()");
  assert.equal(ui.rank,2);assert.equal(ui.coefficientCount,3);
  assert.match(await text('input-design-proposal'),/rank 3 \/ 3; 0 unresolved/);
  assert.match(await text('input-design-proposal'),/Proposed state #1:/);
  assert.ok(ui.text.includes(reason));assert.equal(ui.proposalDisabled,true);assert.equal(ui.rows.length,2);
  assert.deepEqual(ui.rows.map(r=>r.index).sort(),['0','1']);assert.ok(ui.rows.every(r=>r.disabled));
  for(const selector of ['#input-design-freeze','#input-design-rows button[data-design-index="1"]']){
   await trustedCapacityClick(selector);
   assert.equal(await pendingIndex(),null);assert.equal(await historyCount(),count);assert.equal(await rowCount(),rows+count);
   assert.equal(await evaljs("document.querySelector('#observation-source').value"),beforeSource);
   assert.deepEqual(await designBefore(),beforeDiagnostics);assert.deepEqual(JSON.parse(await save()),beforeDownload);
  }
  await evaljs("document.querySelector('#input-design-status').scrollIntoView({block:'start',behavior:'instant'})");
  await screenshot(workLimit?'stiffness-design-work-capacity':'stiffness-design-acquisition-capacity');
 }
 await check('input-design preserves diagnostics and refuses all freeze controls at 32 acquisitions',async()=>receiveDesignCapacity({
  rows:17,count:32,workLimit:false,reason:'At most 32 sequential acquisitions are supported.'}));
 await check('input-design preserves diagnostics and refuses the next acquisition over replay-work budget',async()=>receiveDesignCapacity({
  rows:1024,count:17,workLimit:true,reason:'The replay exceeds its declared fit-work budget; reduce the grid, initial rows or acquisitions.'}));

 await check('input-design request freezes no forecast then receives torque 1.4 and reopens unchanged historical absence',async()=>{
  await course('confounded');await chooseDesign({family:'global'});await click('input-design-freeze');
  assert.equal(await pendingIndex(),'1');assert.match(await text('experiment-pending'),/No executable forecast was available/);
  assert.equal(await rowCount(),17);assert.equal(await historyCount(),0);
  const pending=JSON.parse(await save());assert.equal(pending.pending,1);assert.deepEqual(pending.acquisitions,[]);
  await click('experiment-virtual-receive');assert.equal(await rowCount(),18);assert.equal(await historyCount(),1);
  assert.equal(await text('verdict'),'GLOBAL PREFERRED');assert.equal(await designStatus(),'already_supported');
  assert.deepEqual(await designBefore(),{rank:'3',coefficientCount:'3',unresolved:'0'});
  assert.match(await text('equation'),/0\.2·1.*1\.2·u.*-3·θ/);
  assert.match(await text('experiment-history'),/No executable prior forecast was available/);
  assert.match(await text('experiment-history'),/Inspect 0 frozen forecasts and residuals/);
  emptyForecastHistory=await text('experiment-history');recoveredDesignSaved=await save();
  const saved=JSON.parse(recoveredDesignSaved);assert.equal(saved.acquisitions[0].observation.jointTorque,1.4);assert.equal(saved.acquisitions[0].index,1);assert.equal(saved.pending,null);
  assert.ok(!('history'in saved)&&!('fit'in saved));
  await course('kink');await upload('source-file',recoveredDesignSaved,'recovered-design.json');
  await wait("document.querySelector('#input-design-before').dataset.rank==='3'&&document.querySelector('#experiment-history').dataset.acquisitionCount==='1'");
  assert.equal(await text('experiment-history'),emptyForecastHistory);assert.equal(await text('verdict'),'GLOBAL PREFERRED');
  assert.equal(await save(),recoveredDesignSaved);assert.equal(await evaljs("document.querySelector('#experiment-virtual-receive').disabled"),true);
 });
 await check('changing an inspected design target fences a late source import without changing the experiment',async()=>{
  await course('confounded');await chooseDesign({family:'global'});
  await evaljs("window.originalFileText=File.prototype.text;File.prototype.text=function(){const file=this;return file.name==='slow-design.json'?new Promise(resolve=>setTimeout(()=>window.originalFileText.call(file).then(resolve),350)):window.originalFileText.call(file)}");
  try{await upload('source-file',recoveredDesignSaved,'slow-design.json');await chooseDesign({family:'piecewise',knot:0});await delay(500);
   assert.equal(await rowCount(),17);assert.equal(await historyCount(),0);assert.equal(await pendingIndex(),null);
   assert.equal(await evaljs("document.querySelector('#input-design-structure').value"),JSON.stringify({family:'piecewise',knot:0}));
   assert.equal(await text('verdict'),'UNIDENTIFIABLE');assert.equal(await save(),confoundedSaved);
  }finally{await evaljs("File.prototype.text=window.originalFileText");}
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await check('input support and proposal remain readable with keyboard request controls at '+width+'px',async()=>{
   await course('confounded');await chooseDesign({family:'global'});
   const evidence=[];
   for(const id of ['input-design-structure','input-design-status','input-design-before','input-design-proposal','input-design-freeze']){
    await evaljs('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"center",behavior:"instant"})');await paint();
    const item=await evaljs('(()=>{const n=document.getElementById('+JSON.stringify(id)+'),r=n.getBoundingClientRect(),s=getComputedStyle(n);return{id:n.id,text:n.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(s.fontSize),display:s.display,visibility:s.visibility}})()');
    assert.ok(item.left>=-1&&item.right<=width+1&&item.top>=-1&&item.bottom<=1001&&item.font>=12,JSON.stringify(item));
    assert.notEqual(item.display,'none');assert.notEqual(item.visibility,'hidden');evidence.push(item);
   }
   assert.ok(await evaljs("document.documentElement.scrollWidth<=innerWidth+1"));
   await evaljs("document.querySelector('#input-design-before').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('stiffness-input-design-'+width);
   const selector=await evaljs("(()=>{const s=document.querySelector('#input-design-structure');s.focus();return s.value})()");
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   assert.notEqual(await evaljs("document.querySelector('#input-design-structure').value"),selector);
   assert.equal(await historyCount(),0);assert.equal(await pendingIndex(),null);
   await chooseDesign({family:'global'});
   const target=width===1440?"#input-design-freeze":"#input-design-rows button[data-design-index=\"1\"]";
   await evaljs('document.querySelector('+JSON.stringify(target)+').focus()');
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   assert.equal(await pendingIndex(),'1');assert.equal(await evaljs("document.activeElement.id"),'observation-source');
   assert.match(await text('experiment-pending'),/No executable forecast was available/);
   designVisibility.push({width,evidence,keyboardTarget:target});
  });
 }
 await check('no uncaught page exceptions or external requests during experiment receiving',async()=>{assert.deepEqual(events.exceptions,[]);assert.deepEqual(events.outside,[]);});
 const result={checks:out.length,pass:true,results:out,events,historyVisibility,proposalVisibility,revisionVisibility,designVisibility};if(outputDir)await writeFile(path.join(outputDir,'stiffness-experiment-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
 let page=null;try{page=await diagnosticEval?.("({state:document.querySelector('#verdict')?.textContent,error:document.querySelector('#error')?.textContent,focus:document.activeElement?.id,location:location.href,experiment:document.querySelector('#experiment-status')?.textContent,pending:document.querySelector('#experiment-pending')?.dataset.index,acquisitions:document.querySelector('#experiment-history')?.dataset.acquisitionCount})");}catch{}
 console.error(JSON.stringify({failure:error.message,completed:out,page,events},null,2));throw error;
}finally{
 try{ws?.close();}catch{}chrome.kill('SIGTERM');await delay(400);
 await rm(dir,{recursive:true,force:true}).catch(()=>{});await new Promise(resolve=>server.close(resolve));
}

