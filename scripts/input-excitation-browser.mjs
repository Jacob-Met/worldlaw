import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
import {restoreSession,sessionPilotPlan} from '../src/session.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/input-excitation');
await mkdir(directory,{recursive:true});
const original=await readFile(resolve('examples/scalar-unexcited-command.json'));
const source=JSON.parse(original),report={status:'FAIL',checks:[],errors:[],external:[],
  scope:'Authored source observations through the maintained Studio. Numerical excitation and receiving error; no hardware operation or physical identification.'};
const mark=name=>{report.checks.push(name);console.log('PASS '+name);};
const server=createProductServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const sandbox=await browser.newPage();await sandbox.goto('chrome://sandbox');
  report.sandbox=await sandbox.locator('body').innerText();
  assert.match(report.sandbox,/Layer 1 Sandbox\s+Namespace/);
  for(const key of ['PID namespaces','Network namespaces','Seccomp-BPF sandbox'])assert.match(report.sandbox,new RegExp(key+'\\s+Yes'));
  await sandbox.close();
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:'))report.external.push(request.url());});
  const state=()=>page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
  const upload=async value=>page.locator('#observation-file').setInputFiles({
    name:'authored-excitation-course.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  const saved=async name=>{
    const pending=page.waitForEvent('download');await page.locator('#export-session').click();
    const download=await pending,path=resolve(directory,name);assert.equal(await download.failure(),null);
    await download.saveAs(path);return {path,text:await readFile(path,'utf8')};
  };
  await page.goto(origin);await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
  await upload(source);await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='40');
  const initial=await state(),initialModel=await page.locator('#selected-equation').innerText();
  const before=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));
  assert.ok(before>.8);assert.match(await page.locator('#planner-status').innerText(),/largely agree/);
  assert.equal(await page.locator('#command').inputValue(),'0');
  await page.locator('#planner-objective').selectOption('excitation');
  assert.match(await page.locator('#model-spread').innerText(),/6 → 7 \/ 7/);
  assert.match(await page.locator('#pilot-explanation').innerText(),/no torque forecast/);
  assert.equal(await state(),initial);assert.equal(await page.locator('#selected-equation').innerText(),initialModel);
  assert.equal(await page.locator('#measured-torque').inputValue(),'');
  await page.locator('#pilot-course-summary').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#pilot-course-rows tr').count(),3);
  assert.equal(await page.locator('#pilot-course-rows .pilot-selected td').first().innerText(),'2');
  assert.deepEqual(await page.locator('#pilot-course-rows tr td:nth-child(4)').allTextContents(),['No gain','+1 direction','No gain']);
  await page.locator('#use-proposal').focus();await page.keyboard.press('Enter');
  for(const field of ['command','position','rate'])assert.equal(Number(await page.locator('#'+field).inputValue()),source.offeredInputs[1][field]);
  const beforeFile=await saved('before-measurement.json');
  assert.equal(beforeFile.text,initial);
  mark('actual imported inputs and keyboard pilot preserve every observation and fitted law; all three offers are visible without a future reading');

  await page.locator('.experiment-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(directory,'pilot-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.proposal-card').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(directory,'pilot-narrow.png')});
  const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);assert.equal(reduced,true);
  mark('desktop and 390px keyboard course retain full offer inspection without page overflow under reduced motion');

  await page.locator('#run-experiment').focus();await page.keyboard.press('Enter');
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'error');
  assert.equal(await state(),initial);
  await page.locator('#measured-torque').fill('1.25');
  await page.locator('#run-experiment').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='41');
  const after=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));
  assert.ok(after<1e-10);assert.match(await page.locator('#selected-terms').innerText(),/Actuation/);
  assert.match(await page.locator('#planner-status').innerText(),/already has full input rank/);
  assert.equal(await page.locator('#use-proposal').isDisabled(),true);
  const result=await saved('after-measurement.json'),raw=JSON.parse(result.text),native=restoreSession(result.text);
  assert.deepEqual(raw.base.offeredInputs,source.offeredInputs);
  assert.deepEqual(raw.base.observations,source.observations);assert.equal(raw.discovery,undefined);
  assert.equal(raw.base.schema,'worldlaw.observations/v2');assert.equal(raw.events.length,1);
  assert.deepEqual(raw.events[0].rows,[{...source.offeredInputs[1],jointTorque:1.25}]);
  assert.equal(sessionPilotPlan(native).previouslyObservedCount,1);
  mark('blank outcome cannot advance the notebook; an explicitly entered independent outcome restores rank and receiving accuracy through the unchanged fitter');

  await page.reload();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='41');
  await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='40');
  await page.locator('#planner-objective').selectOption('excitation');
  assert.match(await page.locator('#model-spread').innerText(),/6 → 7/);
  await page.locator('#session-file').setInputFiles(result.path);
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='41');
  assert.equal(await state(),result.text);
  mark('actual downloaded source-only notebook survives reload, undo and native file reopening with exact offers and recomputed results');

  for(const bad of [
    {...source,schema:'worldlaw.observations/v1'},
    {...source,offeredInputs:[{...source.offeredInputs[1],jointTorque:999}]}
  ]){
    const retained=await state();await upload(bad);await page.locator('#error').waitFor({state:'visible'});
    assert.equal(await state(),retained);assert.equal(await page.locator('#sample-count').innerText(),'41');
    await page.locator('#planner-objective').selectOption('prediction'); // Clears the previous error before the next asynchronous read.
    await page.locator('#planner-objective').selectOption('excitation');
  }
  mark('old-format offers and a forged future torque refuse atomically without replacing the accepted notebook');

  const precise={...source,offeredInputs:[{command:1.2345678901234567,position:.3123456789012345,rate:.4123456789012345}]};
  await upload(precise);await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='40');
  await page.locator('#use-proposal').focus();await page.keyboard.press('Enter');
  for(const field of ['command','position','rate'])assert.equal(Number(await page.locator('#'+field).inputValue()),precise.offeredInputs[0][field]);
  const storedPrecise=JSON.parse(await state());assert.deepEqual(storedPrecise.base.offeredInputs,precise.offeredInputs);
  mark('offered acquisition coordinates retain their full numeric precision through the actual input controls');

  const longCourse={...source,source:{...source.source,label:'Authored complete128-offer keyboard control'},
    offeredInputs:Array.from({length:128},(_,i)=>({command:0,position:.71+i/1000,rate:-.31}))};
  await upload(longCourse);await page.waitForFunction(()=>document.getElementById('source-name').textContent==='Authored complete128-offer keyboard control');
  if((await page.locator('#pilot-course').getAttribute('open'))===null)await page.locator('#pilot-course-summary').click();
  assert.equal(await page.locator('#pilot-course-rows tr').count(),128);
  assert.match(await page.locator('#planner-status').innerText(),/No offered state adds/);
  const scroll=page.locator('.pilot-table-wrap');await scroll.focus();await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('.pilot-table-wrap').scrollTop>0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  mark('the complete128-offer no-gain course remains inspectable with keyboard scrolling; no truncated success');

  const wrong={...source,source:{...source.source,label:'Authored omitted-cubic-law negative control'},
    observations:source.observations.map(row=>({...row,jointTorque:row.jointTorque+.3*row.position**3}))};
  await upload(wrong);await page.waitForFunction(()=>document.getElementById('source-name').textContent==='Authored omitted-cubic-law negative control');
  await page.locator('#use-proposal').click();await page.locator('#measured-torque').fill(String(1.25+.3*.3**3));
  await page.locator('#run-experiment').click();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='41');
  assert.match(await page.locator('#planner-status').innerText(),/already has full input rank/);
  assert.match(await page.locator('#diagnostics').innerText(),/Residual mismatch/);
  mark('a full-rank but omitted-law negative control remains a residual mismatch; excitation is never rendered as physical correctness');

  report.status='PASS';report.browser=browser.version();report.metrics={beforeHeldOutRMSE:before,afterHeldOutRMSE:after};
  report.sourceSHA256=createHash('sha256').update(original).digest('hex');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
}finally{
  await writeFile(resolve(directory,'receipt.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
}

