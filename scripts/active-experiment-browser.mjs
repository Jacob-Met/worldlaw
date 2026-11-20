#!/usr/bin/env node
/** Actual application receiver. The scientific expectations were frozen before
 * implementation; browser and CLI execute independently against original bytes. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/active-experiment');
await mkdir(dir,{recursive:true});
const source=await readFile('examples/active-intervention-coupled-kinematics.json');
const sourceSHA='f7f996c569a07cf9b2a3230c12519bd80536cc0a2082f857b3ca671c1e4ffe19';
const planSHA='cbc93f82d9aaa885d83bdf51e1b49840b5506e2d9d5f887ed64322c6240f82c5';
assert.equal(createHash('sha256').update(source).digest('hex'),sourceSHA);
const server=createProductServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin='http://127.0.0.1:'+server.address().port;
const checks=[],layouts=[],errors=[],httpErrors=[];
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const clone=value=>JSON.parse(JSON.stringify(value));
const cli=args=>spawnSync(process.execPath,[resolve('scripts/active-linear-family.mjs'),...args],{encoding:'utf8',timeout:30000});
let browser,page,sandbox;
const idle=()=>page.waitForFunction(()=>document.querySelector('#experiment')?.getAttribute('aria-busy')==='false');
const accepted=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem(localStorage.getItem('worldlaw-active-current-v1')))).book;
const setFile=(id,name,bytes)=>page.locator('#'+id).setInputFiles({name,mimeType:'application/json',buffer:Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes)});
async function openDetails(id){
  if(!await page.locator('#'+id).evaluate(element=>element.open))await page.locator('#'+id+'>summary').click();
}
async function download(id,name){
  const pending=page.waitForEvent('download');await page.locator('#'+id).click();
  const file=await pending,path=resolve(dir,name);await file.saveAs(path);return path;
}
async function acquire(profile,count,status){
  await page.locator('#demo-profile').selectOption(profile);await page.locator('#acquire').click();await idle();
  assert.equal(await page.locator('#reading-set option').count(),count);
  assert.equal(await page.locator('#result-region').getAttribute('data-status'),status);
}
async function refuse(name,value,original){
  await setFile('notebook-file',name,JSON.stringify(value));await idle();
  assert.ok(await page.locator('#error').isVisible(),name);
  assert.deepEqual(await accepted(),original,name+' changed the accepted notebook');
}
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
  if(process.platform==='linux'){
    const cdp=await context.newCDPSession(page);
    sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});
  }
  await page.goto(origin);await page.locator('a[href="/active.html"]').click();await idle();
  assert.equal(await page.locator('#source-digest').textContent(),sourceSHA);
  assert.equal(await page.locator('#plan-digest').textContent(),planSHA);
  assert.equal(await page.locator('#exact-margin').textContent(),'1/4');
  assert.equal(await page.locator('#acquire').isDisabled(),true);
  assert.equal(await page.locator('#export-notebook').isDisabled(),true);
  await page.locator('#tick').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tick').inputValue(),'1');
  await page.screenshot({path:resolve(dir,'active-preview-1920.png'),fullPage:true});
  await page.locator('#freeze-plan').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'acquire');
  assert.equal((await accepted()).readouts.length,0);
  await acquire('unit',1,'one_hypothesis_consistent');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'result-heading');
  const one=await accepted();
  assert.deepEqual(JSON.parse(one.readouts[0].readingsText).readings.map(row=>row.value),[3,1,0]);
  assert.deepEqual(one.readouts[0].result.consistentHypothesisIds,['unit_coupling']);
  assert.equal(one.plan.planSHA256,planSHA);
  assert.match(await page.locator('#result-origin').textContent(),/SYNTHETIC/);
  const notebookPath=await download('export-notebook','active-one-notebook.json');
  const replay=cli(['--notebook',notebookPath]);assert.equal(replay.status,0,replay.stderr);
  assert.deepEqual(JSON.parse(replay.stdout),one);
  mark('live navigation, keyboard freeze, independent synthetic readings and portable CLI replay');

  await openDetails('source-details');
  const sourcePath=await download('download-source','active-original-source.json');
  const planPath=await download('download-plan','active-original-plan.json');
  const readingsPath=await download('download-readings','active-original-readings.json');
  const resultPath=await download('download-result','active-original-result.json');
  assert.deepEqual(await readFile(sourcePath),source);
  const separate=cli(['--input',sourcePath,'--replay',planPath,'--readings',readingsPath,'--replay-readings',resultPath]);
  assert.equal(separate.status,0,separate.stderr);
  const separateResult=JSON.parse(separate.stdout);
  for(const [key,value] of Object.entries(one.readouts[0].result))assert.deepEqual(separateResult[key],value,key);
  await page.reload();await idle();assert.deepEqual(await accepted(),one);
  await acquire('partial',2,'multiple_hypotheses_consistent');
  assert.match(await page.locator('#missing-readings').textContent(),/1, 2/);
  await acquire('outside',3,'all_hypotheses_falsified');
  assert.deepEqual((await accepted()).readouts[2].result.consistentHypothesisIds,[]);
  await page.locator('#reading-set').selectOption('0');
  assert.equal(await page.locator('#result-region').getAttribute('data-status'),'one_hypothesis_consistent');
  assert.equal((await accepted()).readouts.length,3);
  mark('original byte downloads, separate CLI readout replay, reload and all three honest outcomes');

  await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Independent manual decimal receiving exercise; no physical source attested.');
  for(const [tick,value] of [[0,'3.000'],[1,'1.0'],[2,'0.00']])await page.locator('#reading-'+tick).fill(value);
  await page.locator('#evaluate-readings').click();await idle();
  const four=await accepted();
  assert.equal(four.readouts.length,4);assert.equal(four.readouts[3].result.status,'one_hypothesis_consistent');
  assert.deepEqual(JSON.parse(four.readouts[3].readingsText).readings.map(row=>row.value),['3','1','0']);
  assert.equal(four.readouts[3].result.physicalProvenanceVerified,false);
  assert.match(await page.locator('#result-origin').textContent(),/ORIGIN UNVERIFIED/);
  const fullPath=await download('export-notebook','active-four-notebook.json');
  assert.equal(cli(['--notebook',fullPath]).status,0);
  for(const [name,mutate] of [
    ['source',b=>{b.sourceText+=' ';}],
    ['plan',b=>{b.plan.totalNodes++;}],
    ['readings',b=>{b.readouts[0].readingsText+=' ';}],
    ['result',b=>{b.readouts[0].result.status='all_hypotheses_falsified';}],
  ]){
    const bad=clone(four);mutate(bad);await refuse(name+'.json',bad,four);
  }
  for(const [name,bytes] of [['bom.json',Buffer.concat([Buffer.from([239,187,191]),source])],
    ['invalid-utf8.json',Buffer.from([123,34,120,34,58,34,255,34,125])]]){
    await setFile('source-file',name,bytes);await idle();
    assert.ok(await page.locator('#error').isVisible());assert.deepEqual(await accepted(),four);
  }
  mark('exact decimal input and atomic source, plan, reading, result and UTF-8 refusal');

  await page.evaluate(()=>{
    const original=File.prototype.arrayBuffer;
    File.prototype.arrayBuffer=async function(){
      if(this.name==='delayed.json')await new Promise(resolve=>{window.releaseDelayedFile=resolve;});
      const bytes=await original.call(this);
      if(this.name==='delayed.json')window.delayedReadFinished=true;
      return bytes;
    };
  });
  await setFile('notebook-file','delayed.json',JSON.stringify(one));
  await page.waitForFunction(()=>typeof window.releaseDelayedFile==='function');
  await setFile('notebook-file','newer.json',JSON.stringify(four));await idle();
  await page.evaluate(()=>window.releaseDelayedFile());
  await page.waitForFunction(()=>window.delayedReadFinished===true);
  assert.deepEqual(await accepted(),four);
  assert.equal(await page.locator('#reading-set option').count(),4);
  await page.goto(origin);await page.goBack();await idle();
  await acquire('double',5,'one_hypothesis_consistent');
  assert.deepEqual((await accepted()).readouts[4].result.consistentHypothesisIds,['double_coupling']);
  mark('later accepted notebook wins a delayed original-file race; back navigation keeps acquisition usable');

  const primary=page,older=await context.newPage();
  older.on('pageerror',error=>errors.push(error.message));
  page=older;await page.goto(origin+'/active.html');await idle();page=primary;
  await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Primary tab independent follow-up, retained before the older tab saves.');
  for(const [tick,value] of [[0,'3'],[1,'1'],[2,'0']])await page.locator('#reading-'+tick).fill(value);
  await page.locator('#evaluate-readings').click();await idle();
  const newest=await accepted(),newestBytes=await page.evaluate(()=>localStorage.getItem(localStorage.getItem('worldlaw-active-current-v1')));
  assert.equal(newest.readouts.length,6);
  page=older;await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Older tab separate follow-up; this version must remain exportable.');
  for(const [tick,value] of [[0,'3'],[1,'1'],[2,'0.001']])await page.locator('#reading-'+tick).fill(value);
  await page.locator('#evaluate-readings').click();await idle();
  assert.match(await page.locator('#storage-status').textContent(),/Another tab changed/);
  assert.equal(await page.evaluate(()=>localStorage.getItem(localStorage.getItem('worldlaw-active-current-v1'))),newestBytes);
  const conflictPath=await download('export-notebook','active-older-tab-unsaved.json');
  const conflict=JSON.parse(await readFile(conflictPath,'utf8'));
  assert.equal(conflict.readouts.length,6);
  assert.equal(JSON.parse(conflict.readouts[5].readingsText).readings[2].value,'1/1000');
  assert.equal(cli(['--notebook',conflictPath]).status,0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(dir,'active-storage-conflict-390.png'),fullPage:true});
  await older.close();page=primary;
  assert.deepEqual(await accepted(),newest);
  await page.locator('#reading-timeline button[data-tick="2"]').click();
  mark('shared custody guard retains newer saved readings and exports the older tab without overwriting');

  for(const width of [1920,1440,768,390,320]){
    await page.setViewportSize({width,height:width===1920?1080:844});
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      svgWidth:document.querySelector('#apparatus svg').getBoundingClientRect().width,
      textSize:getComputedStyle(document.querySelector('.scene-label')).fontSize}));
    assert.ok(layout.scrollWidth<=width,JSON.stringify(layout));
    assert.ok(layout.svgWidth>=270,JSON.stringify(layout));assert.equal(layout.textSize,'12px');
    layouts.push(layout);
    if(width===1920||width===390)await page.screenshot({path:resolve(dir,'active-received-'+width+'.png'),fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#play').click();
  const stepped=await page.locator('#tick').inputValue();
  assert.equal(await page.locator('#play').textContent(),'Step predictions');
  await page.waitForTimeout(750);assert.equal(await page.locator('#tick').inputValue(),stepped);
  await page.locator('#tick').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tick').inputValue(),'1');
  mark('native-width 1920 to 320 layouts, actual mobile pixels, keyboard inspection and reduced motion');

  await openDetails('source-details');await page.locator('#new-draft').click();await idle();
  assert.equal(await page.locator('#acquire').isDisabled(),true);
  // Even an independently dispatched input event cannot skip the prospective freeze.
  await setFile('readings-file','premature.json',one.readouts[0].readingsText);await idle();
  assert.match(await page.locator('#error').textContent(),/Freeze a certified prospective plan/);
  await page.locator('#noise-bound').fill('1/2');
  assert.equal(await page.locator('#freeze-plan').isDisabled(),true);
  await page.locator('#replan').click();await idle();
  assert.notEqual(JSON.parse(await page.locator('#certificate').textContent()).status,'optimal_certified_intervention');
  await page.locator('#freeze-plan').click();
  assert.equal(await page.locator('#acquire').isDisabled(),true);
  assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  assert.ok((await page.locator('#local-notebook option').count())>=3);
  await page.locator('#example').selectOption('cycles');await page.locator('#load-example').click();await idle();
  const cycle=JSON.parse(await page.locator('#certificate').textContent());
  assert.deepEqual(cycle.selection.map(row=>row.tick),[0,10]);assert.equal(cycle.proof[0].marginLowerBound,'1');
  await page.locator('#freeze-plan').click();
  assert.equal(await page.locator('#demo-controls').isVisible(),false);
  await page.locator('#readout-source').fill('Hand-derived signed-cycle zero start, pulse at tick four.');
  await page.locator('#reading-0').fill('0');await page.locator('#reading-10').fill('1');
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal((await accepted()).readouts.at(-1).result.status,'one_hypothesis_consistent');
  assert.deepEqual((await accepted()).readouts.at(-1).result.consistentHypothesisIds,['positive']);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const croppedText=await page.locator('#apparatus svg').evaluate(svg=>[...svg.querySelectorAll('text')].map(text=>{
    const box=text.getBBox();return {text:text.textContent,x:box.x,end:box.x+box.width,width:svg.viewBox.baseVal.width};
  }).filter(row=>row.x<0||row.end>row.width));
  assert.deepEqual(croppedText,[],'Every mechanism label must fit the actual narrow viewport.');
  assert.match(await page.locator('.intro>p').textContent(),/read\. The starting/);
  await page.screenshot({path:resolve(dir,'active-cyclic-320.png'),fullPage:true});
  mark('noise defeats separation without erasing history; a distinct five-state source uses only supplied readings');

  const legacy=JSON.parse(await readFile('tests/fixtures/active-linear-certificates-v1.json','utf8')).cases[0];
  await setFile('source-file','historical-source.json',legacy.sourceText);await idle();
  await setFile('plan-file','historical-plan.json',JSON.stringify(legacy.plan));await idle();
  assert.equal((await accepted()).plan.planSHA256,legacy.plan.planSHA256);
  if(legacy.readouts.length){
    await setFile('readings-file','historical-readings.json',legacy.readouts[0].readoutText);await idle();
    const oldResult=(await accepted()).readouts[0].result;
    for(const [key,value] of Object.entries(legacy.readouts[0].result))
      if(!['sourcePath','planPath','readingsPath'].includes(key))assert.deepEqual(oldResult[key],value,key);
  }
  mark('historical CLI plan and original readouts retain their prior certificate identity');

  const failureContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await failureContext.addInitScript(()=>{
    const pointer='worldlaw-active-current-v1',key='worldlaw-active-notebook-v1:protected-original';
    if(location.protocol!=='http:')return;
    localStorage.setItem(key,'{ unreadable original bytes');localStorage.setItem(pointer,key);
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k.startsWith('worldlaw-active-'))throw new DOMException('Synthetic quota fault','QuotaExceededError');
      return original.call(this,k,v);
    };
  });
  const mainPage=page;page=await failureContext.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/active.html');await idle();
  assert.match(await page.locator('#storage-status').textContent(),/retained/);
  await page.locator('#freeze-plan').click();
  assert.match(await page.locator('#storage-status').textContent(),/not saved locally/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw-active-notebook-v1:protected-original')),'{ unreadable original bytes');
  const unsaved=await download('export-notebook','active-unsaved-export.json');
  assert.equal(cli(['--notebook',unsaved]).status,0);
  await failureContext.close();page=mainPage;
  mark('unreadable originals and storage quota faults preserve custody and permit portable export');
  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify({schema:'worldlaw.active-experiment-browser/v1',
    sourceSHA256:sourceSHA,planSHA256:planSHA,browser:browser.version(),sandbox,checks,layouts,errors,httpErrors},null,2)+'\n');
}catch(error){
  if(page&&!page.isClosed())await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
