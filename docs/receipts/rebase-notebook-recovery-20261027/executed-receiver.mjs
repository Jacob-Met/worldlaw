import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {withProductBrowserSession} from './product-browser-session.mjs';

const [product,root,baseUrl,runDirectory,processId] = process.argv.slice(2);
if(!['worldlaw','synapse'].includes(product)) throw Error('Unknown product');
const receiverPath=product==='worldlaw'?'scripts/historical-training.receiving.mjs':'scripts/backing-observation.receiving.mjs';
const receiver=await import(pathToFileURL(resolve(root,receiverPath)));
const report=[];
const outcome={product,root,baseUrl,processId:processId||null,startedAt:new Date().toISOString(),checks:report,status:'running'};
const result=await withProductBrowserSession({baseUrl,chromeBin:'/tmp/hamon-69d25c99168e-tools/chrome-namespace-wrapper.sh',runDirectory,commandMs:20000},async session=>{
 const {evaluate,send}=session;
 try{
  const condition=product==='worldlaw'?"document.querySelector('#sample-count')?.textContent==='64'":"document.querySelector('#go-live')&&document.querySelector('#process-search')";
  await evaluate(`(async()=>{for(let n=0;n<300;n++){if(${condition})return true;await new Promise(r=>setTimeout(r,50));}throw Error('Initial product readiness timed out');})()`);
  const receive=product==='worldlaw'?receiver.receiveHistoricalTraining:receiver.receiveBackingObservation;
  const captures=await receive({evaluate,send,report,processId});
  await evaluate(`localStorage.setItem('worldlaw.notebook.v1','{broken café original}\\r\\n');true`);
  await send('Page.reload');
  await evaluate(`(async()=>{for(let n=0;n<300;n++){if(document.querySelector('#storage-recovery')?.hidden===false)return true;await new Promise(r=>setTimeout(r,50));}throw Error('Recovery startup timed out');})()`);
  assert.equal(await evaluate(`localStorage.getItem('worldlaw.notebook.v1')`),'{broken café original}\r\n');
  await evaluate(`document.querySelector('#scalar-plan-mode').value='bounded';document.querySelector('#scalar-plan-mode').dispatchEvent(new Event('change'));document.querySelector('#apply-scalar-plan').click();true`);
  assert.equal(await evaluate(`localStorage.getItem('worldlaw.notebook.v1')`),'{broken café original}\r\n');
  assert.match(await evaluate(`document.querySelector('#storage-status').textContent`),/protected/);
  report.push('Rebased recovery preserves unreadable original through bounded-planning adoption');
  await evaluate(`window.confirm=()=>true;document.querySelector('#replace-unreadable').click();true`);
  assert.equal(await evaluate(`localStorage.getItem('worldlaw.notebook.recovery.v1.1')`),'{broken café original}\r\n');
  assert.notEqual(await evaluate(`localStorage.getItem('worldlaw.notebook.v1')`),'{broken café original}\r\n');
  await send('Page.reload');
  await evaluate(`(async()=>{for(let n=0;n<300;n++){if(document.querySelector('#storage-status')?.textContent==='Local notebook restored')return true;await new Promise(r=>setTimeout(r,50));}throw Error('Replaced notebook reopen timed out');})()`);
  assert.equal(await evaluate(`document.querySelector('#scalar-plan-mode').value`),'bounded');
  assert.equal(await evaluate(`document.querySelector('#download-archived').hidden`),false);
  report.push('Explicit archive replacement reopens bounded notebook and retains exact original archive');
  for(const [name,shot] of Object.entries(captures))await writeFile(resolve(runDirectory,`${product}-${name}.png`),Buffer.from(shot.data,'base64'),{flag:'wx'});
  assert.deepEqual(session.exceptions,[],'Unexpected browser exceptions');
  Object.assign(outcome,{status:'passed',browser:session.browserVersion,sandbox:session.sandbox,exceptions:session.exceptions,finishedAt:new Date().toISOString()});
  console.log(JSON.stringify({product,status:'passed',checks:report,runDirectory},null,2));
  return outcome;
 }catch(error){
  Object.assign(outcome,{status:'failed',error:{name:error.name,message:error.message,stack:error.stack},checks:report,exceptions:session.exceptions,finishedAt:new Date().toISOString()});
  try{await writeFile(resolve(runDirectory,`${product}-failure.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'),{flag:'wx'});}catch{}
  try{await writeFile(resolve(runDirectory,`${product}-failure.txt`),await evaluate('document.body?.innerText||""'),{flag:'wx'});}catch{}
  throw error;
 }finally{await writeFile(resolve(runDirectory,'browser-result.json'),JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});}
});
assert.equal(result.receipt.cleanup.directChildExited,true);
