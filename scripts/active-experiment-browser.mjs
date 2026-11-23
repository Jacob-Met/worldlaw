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

  await openDetails('source-details');await page.locator('#example').selectOption('bounded');
  await page.locator('#load-example').click();await idle();
  const boundedPreview=JSON.parse(await page.locator('#certificate').textContent());
  assert.equal(boundedPreview.status,'optimal_certified_control_box');
  assert.deepEqual(boundedPreview.selection.map(row=>row.tick),[0,1,4]);
  assert.deepEqual(boundedPreview.chosenControls,[['1'],['1'],['1'],['0']]);
  assert.equal(await page.locator('#exact-margin').textContent(),'3/4');
  assert.equal(await page.locator('#control-course').isVisible(),true);
  assert.deepEqual(await page.locator('#control-table .chosen-control').allTextContents(),['1','1','1','0']);
  assert.equal(await page.locator('#demo-controls').isVisible(),false);
  await page.locator('#freeze-plan').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'readout-source');
  await page.locator('#readout-source').fill('Separate hand calculation: p0=3, v0=-2, unit coupling, velocity inputs 1,1,1,0.');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [t,v] of [[0,'3'],[1,'1'],[4,'1']])await page.locator('#reading-'+t).fill(v);
  await page.locator('#evaluate-readings').click();await idle();
  const boundedOne=await accepted();assert.deepEqual(boundedOne.readouts[0].result.consistentHypothesisIds,['unit_coupling']);
  assert.equal(boundedOne.plan.planSHA256,boundedPreview.planSHA256);
  await page.locator('#source-details').evaluate(element=>{element.open=false;});
  await page.locator('#supplied-details').evaluate(element=>{element.open=false;});
  for(const width of [1920,390,320]){
    await page.setViewportSize({width,height:width===1920?1080:844});
    await page.locator('#control-course').scrollIntoViewIfNeeded();
    const layout=await page.locator('#control-table').evaluate(host=>({
      width:innerWidth,pageWidth:document.documentElement.scrollWidth,tableWidth:host.getBoundingClientRect().width,
      cells:[...host.querySelectorAll('th,td')].map(cell=>({client:cell.clientWidth,scroll:cell.scrollWidth}))}));
    assert.ok(layout.pageWidth<=width);assert.ok(layout.cells.every(cell=>cell.scroll<=cell.client+1));
    layouts.push({kind:'bounded-control',...layout});
    await page.screenshot({path:resolve(dir,'active-bounded-'+width+'.png'),fullPage:true});
  }
  await page.locator('#tick').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#control-table tr[data-current]').getAttribute('data-input-tick'),'1');
  await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Independent deliberately mismatched synthetic position values.');
  for(const [t,v] of [[0,'3'],[1,'1'],[4,'20']])await page.locator('#reading-'+t).fill(v);
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal((await accepted()).readouts.at(-1).result.status,'all_hypotheses_falsified');
  await page.locator('#readout-source').fill('Independent partial synthetic reading; later readings remain missing.');
  await page.locator('#reading-0').fill('3');
  await page.locator('#evaluate-readings').click();await idle();
  const boundedBook=await accepted();assert.equal(boundedBook.readouts.at(-1).result.status,'multiple_hypotheses_consistent');
  const boundedPath=await download('export-notebook','active-bounded-notebook.json');
  const boundedReplay=cli(['--notebook',boundedPath]);assert.equal(boundedReplay.status,0,boundedReplay.stderr);
  assert.deepEqual(JSON.parse(boundedReplay.stdout),boundedBook);
  const forged=clone(boundedBook);forged.plan.chosenControls[0][0]='-1';
  await refuse('changed-bounded-control.json',forged,boundedBook);
  await page.reload();await idle();assert.deepEqual(await accepted(),boundedBook);
  mark('continuous bounded input, exact visible control course, keyboard, narrow pixels, separate outcomes and portable replay');
  await openDetails('source-details');await page.locator('#new-draft').click();await idle();
  await page.locator('#noise-bound').fill('1/2');await page.locator('#replan').click();await idle();
  assert.equal(JSON.parse(await page.locator('#certificate').textContent()).status,'noise_separation_not_certified');
  assert.deepEqual(await page.locator('#control-table .chosen-control').allTextContents(),['—','—','—','—']);
  assert.match(await page.locator('#illustration-note').textContent(),/reference forecasts use the lower bound/);
  await page.locator('#freeze-plan').click();assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  await setFile('notebook-file','original-bounded-book.json',await readFile(boundedPath));await idle();
  assert.deepEqual(await accepted(),boundedBook);
  mark('closed control-box noise contact refuses acquisition and keeps the earlier original notebook replayable');

  await openDetails('source-details');await page.locator('#example').selectOption('joint');
  await page.locator('#load-example').click();await idle();
  const jointPreview=JSON.parse(await page.locator('#certificate').textContent());
  assert.equal(jointPreview.status,'optimal_certified_joint_control');
  assert.deepEqual(jointPreview.chosenControls,[['1','-1/3'],['0','0']]);
  assert.deepEqual(jointPreview.selection.map(row=>row.tick),[1]);
  assert.equal(await page.locator('#tick').inputValue(),'1');
  assert.equal(await page.locator('#plan-heading').textContent(),'1 reading separates the offered laws.');
  assert.equal(await page.locator('#joint-margin').textContent(),'2/3');
  assert.equal(await page.locator('#joint-pairs button').count(),3);
  await page.locator('#joint-pairs button').nth(1).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#witness-pair').inputValue(),'1');
  assert.equal(await page.locator('#exact-margin').textContent(),'4/3');
  assert.equal(await page.locator('#joint-pairs button').nth(1).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#joint-pairs button').nth(0).getAttribute('aria-pressed'),'false');
  await page.locator('#witness-pair').selectOption('2');
  assert.equal(await page.locator('#exact-margin').textContent(),'2/3');
  assert.equal(await page.locator('#joint-pairs button').nth(2).getAttribute('aria-pressed'),'true');
  await page.locator('#freeze-plan').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'readout-source');
  await page.locator('#readout-source').fill('Independent analytic three-response acquisition: zero response at tick one.');
  await page.locator('#acquisition-kind').selectOption('synthetic');await page.locator('#reading-1').fill('0');
  await page.locator('#evaluate-readings').click();await idle();
  assert.deepEqual((await accepted()).readouts[0].result.consistentHypothesisIds,['zero_response']);
  assert.equal(await page.locator('#tick').inputValue(),'1');
  assert.match(await page.locator('#mechanism-view').getAttribute('aria-label'),/at tick 1/);
  await page.locator('#source-details').evaluate(element=>{element.open=false;});
  await page.locator('#supplied-details').evaluate(element=>{element.open=false;});
  for(const width of [1920,390,320]){
    await page.setViewportSize({width,height:width===1920?1080:844});
    await page.locator('#joint-comparison').scrollIntoViewIfNeeded();
    const layout=await page.locator('#joint-comparison').evaluate(host=>({
      width:innerWidth,pageWidth:document.documentElement.scrollWidth,
      children:[...host.querySelectorAll('button,strong')].map(element=>({client:element.clientWidth,scroll:element.scrollWidth}))}));
    assert.ok(layout.pageWidth<=width);assert.ok(layout.children.every(element=>element.scroll<=element.client+1));
    layouts.push({kind:'joint-control',...layout});
    await page.screenshot({path:resolve(dir,'active-joint-'+width+'.png'),fullPage:true});
  }
  await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Independent deliberate mismatch: output ten is outside every offered response.');
  await page.locator('#reading-1').fill('10');await page.locator('#evaluate-readings').click();await idle();
  const jointBook=await accepted();assert.equal(jointBook.readouts.at(-1).result.status,'all_hypotheses_falsified');
  const jointPath=await download('export-notebook','active-joint-notebook.json');
  const jointReplay=cli(['--notebook',jointPath]);assert.equal(jointReplay.status,0,jointReplay.stderr);
  assert.deepEqual(JSON.parse(jointReplay.stdout),jointBook);
  const forgedJoint=clone(jointBook);forgedJoint.plan.jointProof.certificate.mixtureWeights[0]='7';
  await refuse('changed-joint-certificate.json',forgedJoint,jointBook);
  await page.reload();await idle();assert.deepEqual(await accepted(),jointBook);
  mark('joint interior input, every common-input pair, keyboard projections, narrow pixels and separate notebook outcomes');
  await openDetails('source-details');await page.locator('#new-draft').click();await idle();
  await page.locator('#noise-bound').fill('1/3');await page.locator('#replan').click();await idle();
  assert.equal(JSON.parse(await page.locator('#certificate').textContent()).status,'noise_separation_not_certified');
  assert.equal(await page.locator('#joint-margin').textContent(),'—');
  assert.match(await page.locator('#joint-explanation').textContent(),/greatest jointly attainable distance.*2\/3/);
  await page.locator('#freeze-plan').click();assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  const jointCases=JSON.parse(await readFile('tests/fixtures/active-joint-control-cases.json','utf8'));
  const jointCoupled=jointCases.find(row=>row.name==='coupled_minimum_union').request;
  await setFile('source-file','separate-three-law-coupled-source.json',JSON.stringify(jointCoupled));await idle();
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Independent partial coupled response: only initial position three was supplied.');
  await page.locator('#acquisition-kind').selectOption('synthetic');await page.locator('#reading-0').fill('3');
  await page.locator('#evaluate-readings').click();await idle();
  const jointPartial=await accepted();assert.equal(jointPartial.readouts[0].result.status,'multiple_hypotheses_consistent');
  assert.equal(jointPartial.readouts[0].result.consistentHypothesisIds.length,3);
  const jointPartialPath=await download('export-notebook','active-joint-partial-notebook.json');
  const jointPartialReplay=cli(['--notebook',jointPartialPath]);assert.equal(jointPartialReplay.status,0,jointPartialReplay.stderr);
  assert.deepEqual(JSON.parse(jointPartialReplay.stdout),jointPartial);
  mark('joint closed contact and independently supplied partial coupled readings preserve honest uncertainty');

  await page.setViewportSize({width:1920,height:1080});
  await openDetails('source-details');await page.locator('#example').selectOption('adaptive');
  await page.locator('#load-example').click();await idle();
  const adaptivePreview=JSON.parse(await page.locator('#certificate').textContent());
  assert.equal(await page.locator('#readout-source').inputValue(),'');
  assert.equal(await page.locator('#acquisition-kind').inputValue(),'supplied');
  assert.equal(adaptivePreview.sourceSHA256,'6d4c8ce6d1503a2de318e50f0da1d9462156e773f3882be384c0502517dd63c3');
  assert.equal(adaptivePreview.status,'optimal_certified_adaptive_policy');
  assert.equal(adaptivePreview.worstReadings,6);assert.equal(adaptivePreview.staticPlan.readings,9);
  assert.equal(await page.locator('#tick').inputValue(),'2');
  assert.equal(await page.locator('#acquire-adaptive').isDisabled(),true);
  assert.equal(await page.locator('#adaptive-branches .adaptive-branch').count(),2);
  await page.locator('#freeze-plan').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'acquire-adaptive');
  await page.keyboard.press('Enter');await idle();
  const adaptiveFirst=await accepted();
  assert.equal(adaptiveFirst.readouts.length,1);
  assert.equal(adaptiveFirst.readouts[0].result.status,'continue_frozen_policy');
  assert.deepEqual(adaptiveFirst.readouts[0].result.consistentHypothesisIds,['main_coupling','cross_coupling']);
  assert.equal(adaptiveFirst.plan.planSHA256,adaptivePreview.planSHA256);
  assert.match(await page.locator('#course-label').textContent(),/Round 1.*main impulse.*received/);
  assert.equal(await page.locator('#apparatus .scene-measurement').count(),1);
  const adaptiveFirstPath=await download('export-notebook','active-adaptive-first-notebook.json');
  const firstAdaptiveReplay=cli(['--notebook',adaptiveFirstPath]);assert.equal(firstAdaptiveReplay.status,0,firstAdaptiveReplay.stderr);
  assert.deepEqual(JSON.parse(firstAdaptiveReplay.stdout),adaptiveFirst);
  mark('adaptive prospective six-versus-nine guarantee, keyboard freeze and separate first acquisition');

  await page.locator('#inspect-next').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'apparatus-heading');
  assert.match(await page.locator('#course-label').textContent(),/Round 2.*cross impulse.*preview/);
  assert.equal(await page.locator('#apparatus .scene-measurement').count(),0);
  assert.equal(await page.locator('#apparatus .model-marker').count(),2);
  assert.deepEqual(await page.locator('#control-table .chosen-control').allTextContents(),['0','0','1','0','0','0','0','0','0']);
  assert.match(await page.locator('#illustration-note').textContent(),/Earlier rounds excluded: uncoupled, side coupling/);
  assert.deepEqual(await accepted(),adaptiveFirst);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#tick').focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#tick').inputValue(),'1');
  await page.locator('#play').click();assert.equal(await page.locator('#tick').inputValue(),'2');
  await page.locator('#source-details').evaluate(element=>{element.open=false;});
  await page.locator('#supplied-details').evaluate(element=>{element.open=false;});
  for(const width of [1920,390,320]){
    await page.setViewportSize({width,height:width===1920?1080:844});
    await page.locator('#adaptive-policy').scrollIntoViewIfNeeded();
    const layout=await page.locator('#adaptive-policy').evaluate(host=>({
      width:innerWidth,pageWidth:document.documentElement.scrollWidth,
      children:[...host.querySelectorAll('button,select,.adaptive-branch')].map(element=>({client:element.clientWidth,scroll:element.scrollWidth}))}));
    assert.ok(layout.pageWidth<=width);assert.ok(layout.children.every(element=>element.scroll<=element.client+1));
    layouts.push({kind:'adaptive-pending',...layout});
    await page.screenshot({path:resolve(dir,'active-adaptive-pending-'+width+'.png'),fullPage:true});
  }
  await page.locator('#adaptive-history').selectOption('0');
  assert.match(await page.locator('#course-label').textContent(),/Round 1.*main impulse.*received/);
  assert.equal(await page.locator('#apparatus .scene-measurement').count(),1);
  assert.equal(await page.locator('#apparatus .model-marker').count(),4);
  assert.deepEqual(await page.locator('#control-table .chosen-control').allTextContents(),['1','0','0','0','0','0','0','0','0']);
  mark('adaptive pending and historical inputs stay separate with stable lanes, keyboard stepping and narrow pixels');

  await page.locator('#acquire-adaptive').click();await idle();
  const adaptiveBook=await accepted();assert.equal(adaptiveBook.readouts.length,2);
  assert.deepEqual(adaptiveBook.readouts[1].result.consistentHypothesisIds,['cross_coupling']);
  assert.equal(adaptiveBook.readouts[1].result.previousReadingsSHA256,adaptiveFirst.readouts[0].result.readingsSHA256);
  assert.equal(adaptiveBook.plan.planSHA256,adaptivePreview.planSHA256);
  assert.equal(await page.locator('#acquire-adaptive').isDisabled(),true);
  assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  assert.match(await page.locator('#course-label').textContent(),/Round 2.*cross impulse.*received/);
  const adaptivePath=await download('export-notebook','active-adaptive-complete-notebook.json');
  const adaptiveReplay=cli(['--notebook',adaptivePath]);assert.equal(adaptiveReplay.status,0,adaptiveReplay.stderr);
  assert.deepEqual(JSON.parse(adaptiveReplay.stdout),adaptiveBook);
  const forgedAdaptive=clone(adaptiveBook);forgedAdaptive.readouts[1].result.previousReadingsSHA256='0'.repeat(64);
  await refuse('altered-adaptive-chain.json',forgedAdaptive,adaptiveBook);
  const forgedPolicy=clone(adaptiveBook);forgedPolicy.plan.policy.states[0].cost+=1;
  await refuse('altered-adaptive-policy.json',forgedPolicy,adaptiveBook);
  await page.reload();await idle();assert.deepEqual(await accepted(),adaptiveBook);
  await page.locator('#adaptive-history').selectOption('0');
  assert.match(await page.locator('#course-label').textContent(),/Round 1.*main impulse/);
  assert.equal(await page.locator('#acquire-adaptive').isDisabled(),true);
  mark('adaptive terminal singleton, exact chained portable replay, altered records refused and historical reopen');

  await openDetails('source-details');await page.locator('#example').selectOption('adaptive');
  await page.locator('#load-example').click();await idle();await page.locator('#freeze-plan').click();
  const adaptiveEmpty=await accepted();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Separate deliberately incompatible track measurements for receiving.');
  await page.locator('#acquisition-kind').selectOption('supplied');
  await page.locator('#reading-0').fill('0');await page.locator('#evaluate-readings').click();await idle();
  assert.ok(await page.locator('#error').isVisible());assert.deepEqual(await accepted(),adaptiveEmpty);
  await page.locator('#reading-1').fill('0');await page.locator('#reading-2').fill('10');
  await page.locator('#evaluate-readings').click();await idle();
  const adaptiveOutside=await accepted();assert.equal(adaptiveOutside.readouts.length,1);
  assert.equal(adaptiveOutside.readouts[0].result.status,'all_remaining_hypotheses_falsified');
  assert.equal(adaptiveOutside.readouts[0].result.physicalProvenanceVerified,false);
  assert.equal(await page.locator('#acquire-adaptive').isDisabled(),true);
  const adaptiveOutsidePath=await download('export-notebook','active-adaptive-outside-notebook.json');
  const outsideAdaptiveReplay=cli(['--notebook',adaptiveOutsidePath]);assert.equal(outsideAdaptiveReplay.status,0,outsideAdaptiveReplay.stderr);
  assert.deepEqual(JSON.parse(outsideAdaptiveReplay.stdout),adaptiveOutside);
  await openDetails('source-details');await page.locator('#new-draft').click();await idle();
  await page.locator('#noise-bound').fill('1/8');await page.locator('#replan').click();await idle();
  assert.equal(JSON.parse(await page.locator('#certificate').textContent()).status,'no_guaranteed_policy');
  await page.locator('#freeze-plan').click();assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  await setFile('notebook-file','original-adaptive-complete.json',await readFile(adaptivePath));await idle();
  assert.deepEqual(await accepted(),adaptiveBook);
  mark('adaptive incomplete bundle refusal, out-of-family rejection and exact closed-contact negative without losing originals');

  await page.setViewportSize({width:1920,height:1080});
  await openDetails('source-details');await page.locator('#example').selectOption('amplitudes');
  await page.locator('#load-example').click();await idle();
  const amplitudePreview=JSON.parse(await page.locator('#certificate').textContent());
  assert.deepEqual(amplitudePreview.requiredExperiments,['amplitude_one','amplitude_two','amplitude_interior']);
  assert.deepEqual(amplitudePreview.achievedRequiredInputDiversity,{distinct:3,rank:2});
  assert.equal(amplitudePreview.worstReadings,3);assert.equal(amplitudePreview.staticPlan.readings,3);
  await page.locator('#freeze-plan').focus();await page.keyboard.press('Enter');
  await openDetails('supplied-details');
  for(const [round,value] of ['2','4','5/2'].entries()){
    await page.locator('#readout-source').fill('Separate exact quadratic diagnostic, double law plus 2(u-1)(u-2); synthetic only.');
    await page.locator('#acquisition-kind').selectOption('synthetic');
    await page.locator('#reading-1').fill(value);
    await page.locator('#evaluate-readings').focus();await page.keyboard.press('Enter');await idle();
    const book=await accepted(),last=book.readouts.at(-1).result;
    assert.equal(book.plan.planSHA256,amplitudePreview.planSHA256);
    assert.equal(book.readouts.length,round+1);
    assert.equal(last.status,round<2?'continue_frozen_policy':'all_remaining_hypotheses_falsified');
    assert.equal(last.pendingRequiredExperiments.length,2-round);
    if(round===0){
      assert.deepEqual(last.consistentHypothesisIds,['double']);
      assert.match(await page.locator('#result-heading').textContent(),/One candidate fits so far/);
      assert.equal(await page.locator('#evaluate-readings').isDisabled(),false);
      await page.locator('#inspect-next').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#apparatus .model-marker').count(),1);
      for(const width of [1920,390,320]){
        await page.setViewportSize({width,height:width===1920?1080:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.locator('#adaptive-policy').scrollIntoViewIfNeeded();
        await page.screenshot({path:resolve(dir,'active-required-pending-'+width+'.png'),fullPage:true});
      }
      await page.reload();await idle();assert.deepEqual(await accepted(),book);
      await openDetails('supplied-details');
    }
  }
  const amplitudeRejected=await accepted();
  assert.deepEqual(amplitudeRejected.readouts.at(-1).result.consistentHypothesisIds,[]);
  assert.equal(await page.locator('#evaluate-readings').isDisabled(),true);
  await page.screenshot({path:resolve(dir,'active-required-rejected-320.png'),fullPage:true});
  const amplitudePath=await download('export-notebook','active-required-rejected-notebook.json');
  const amplitudeReplay=cli(['--notebook',amplitudePath]);assert.equal(amplitudeReplay.status,0,amplitudeReplay.stderr);
  assert.deepEqual(JSON.parse(amplitudeReplay.stdout),amplitudeRejected);
  const forgedCoverage=clone(amplitudeRejected);forgedCoverage.readouts[0].result.nextCoveredMask=7;
  await refuse('altered-required-coverage.json',forgedCoverage,amplitudeRejected);
  await page.reload();await idle();assert.deepEqual(await accepted(),amplitudeRejected);
  mark('required amplitudes keep a singleton provisional, reject the endpoint alias, and retain exact portable custody');

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


  await openDetails('source-details');
  await page.locator('#example').selectOption('driftSchedule');
  await page.locator('#load-example').click();await idle();
  assert.ok(await page.locator('#drift-panel').isVisible());
  assert.match(await page.locator('#plan-summary').textContent(),/10 pulses/);
  await page.locator('#freeze-plan').click();
  await page.locator('#readout-source').fill('Synthetic persistent-drift trajectory');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  await page.locator('#drift-reading-0').fill('0');
  await page.locator('#drift-reading-2').fill('35');
  const beforeDrift=await accepted();
  await page.locator('#evaluate-readings').click();await idle();
  assert.ok(await page.locator('#error').isVisible());
  assert.deepEqual(await accepted(),beforeDrift);
  await page.locator('#drift-reading-0').fill('0');
  await page.locator('#drift-reading-1').fill('25');
  await page.locator('#drift-reading-2').fill('35');
  await page.locator('#evaluate-readings').click();await idle();
  const measured=await accepted();
  assert.deepEqual(measured.readouts[0].result.checked.surviving.map(r=>r.law),['A']);
  await page.screenshot({path:resolve(dir,'active-drift-checkpoints.png'),fullPage:true});
  const measuredPath=await download('export-notebook','active-drift-checkpoints.json');
  const measuredCLI=cli(['--notebook',measuredPath]);assert.equal(measuredCLI.status,0,measuredCLI.stderr);
  assert.deepEqual(JSON.parse(measuredCLI.stdout),measured);
  await openDetails('source-details');
  await page.locator('#example').selectOption('driftGauge');await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#plan-summary').textContent(),/constant change in drift/);
  assert.equal(await page.locator('#drift-gauge-controls').evaluate(control=>control.disabled),true);
  assert.ok(await page.locator('#drift-trace').isDisabled());
  await page.locator('#freeze-plan').click();
  await page.locator('#drift-position').fill('1/7');await page.locator('#drift-velocity').fill('-2/9');
  await page.locator('#drift-word').fill('slow 10000000000000000000001\nfast 2');
  await page.locator('#drift-trace').click();await idle();
  const gauged=await accepted(),trace=gauged.readouts[0].result.trace;
  assert.deepEqual(trace.readings[0],trace.readings[1]);assert.equal(trace.driftShift,'-1/6');
  assert.match(await page.locator('#candidate-results').textContent(),/10000000000000000000003/);
  await page.reload();await idle();assert.deepEqual(await accepted(),gauged);
  const gaugeExport=await download('export-notebook','active-drift-gauge.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',gaugeExport]).stdout),gauged);
  const wrongGauge=clone(gauged);wrongGauge.readouts[0].result.trace.starts[1][1]='123';
  await refuse('altered-gauge-witness.json',wrongGauge,gauged);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:840});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.screenshot({path:resolve(dir,'active-drift-gauge-320.png'),fullPage:true});
  mark('drift schedules and gauge traces use the same frozen browser/CLI source and exact physical receiver');

  await page.setViewportSize({width:390,height:844});
  for(const [example,expected,values] of [
    ['driftBinary',/require 5 pulses/,[[0,'0'],[2,'4'],[5,'25']]],
    ['driftMulti',/requires 9 pulses/,[[0,'0'],[4,'8'],[9,'33']]]]){
    await openDetails('source-details');await page.locator('#example').selectOption(example);
    await page.locator('#load-example').click();await idle();
    assert.match(await page.locator('#plan-heading').textContent(),expected);
    await page.locator('#freeze-plan').click();await openDetails('supplied-details');
    await page.locator('#readout-source').fill('Known synthetic fixed-tape trajectory');
    await page.locator('#acquisition-kind').selectOption('synthetic');
    for(const [tick,value] of values)await page.locator('#drift-reading-'+tick).fill(value);
    await page.locator('#evaluate-readings').click();await idle();
    const exact=await accepted();assert.deepEqual(exact.readouts.at(-1).result.consistentHypothesisIds,['A']);
    const portable=await download('export-notebook',example+'.json');
    assert.deepEqual(JSON.parse(cli(['--notebook',portable]).stdout),exact);
  }
  const shift=value=>String(10n**60n+1n+13n*BigInt(value))+'/13';
  for(const [values,command,survivors,finalValue] of [
    [[-1,-2,-3,-4,2,8],'u2',['L0','L1'],13],
    [[1,-2,-3,-4,2,10],'u1',['L0','L2'],15]]){
    await openDetails('source-details');await page.locator('#example').selectOption('driftFeedback');
    await page.locator('#load-example').click();await idle();await page.locator('#freeze-plan').click();
    await openDetails('supplied-details');
    assert.equal(await page.locator('#drift-reading-6').count(),0);
    await page.locator('#readout-source').fill('Original rational trajectory for branch '+command);
    await page.locator('#acquisition-kind').selectOption('synthetic');
    for(const [i,value] of values.entries())await page.locator('#drift-reading-'+i).fill(shift(value));
    await page.locator('#evaluate-readings').click();await idle();
    const prefix=await accepted(),outcome=prefix.readouts[0].result;
    assert.deepEqual(outcome.consistentHypothesisIds,survivors);assert.equal(outcome.checked.nextCommand,command);
    assert.match(await page.locator('#receive-note').textContent(),new RegExp('Apply '+command));
    const prefixPath=await download('export-notebook','active-feedback-'+command+'-prefix.json');
    const opened=cli(['--notebook',prefixPath]);assert.equal(opened.status,0,opened.stderr);
    assert.deepEqual(JSON.parse(opened.stdout),prefix);
    await setFile('notebook-file','cli-reopened-notebook.json',opened.stdout);await idle();
    assert.equal(await page.locator('#drift-reading-6').getAttribute('data-command'),command);
    assert.equal(await page.locator('#readout-source').inputValue(),outcome.readoutSource);
    await openDetails('supplied-details');
    await page.locator('#drift-reading-6').fill(shift(finalValue));await page.locator('#evaluate-readings').click();await idle();
    const final=await accepted(),result=final.readouts[1].result;
    assert.deepEqual(result.consistentHypothesisIds,['L0']);
    assert.deepEqual(result.checked.values,[...values,finalValue].map(shift));
    assert.equal(result.checked.nextCommand,null);
    assert.equal(result.previousReadingsSHA256,outcome.readingsSHA256);
    assert.ok(await page.locator('#evaluate-readings').isDisabled());
    const finalPath=await download('export-notebook','active-feedback-'+command+'-final.json');
    assert.deepEqual(JSON.parse(cli(['--notebook',finalPath]).stdout),final);
    await page.reload();await idle();assert.deepEqual(await accepted(),final);
    await page.screenshot({path:resolve(dir,'active-feedback-'+command+'.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  mark('exact minimum planners and both measured sixth-command branches survive browser and CLI notebook replay');

  await openDetails('source-details');await page.locator('#example').selectOption('driftFeedbackSearch');
  await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#plan-heading').textContent(),/single feedback decision/);
  assert.match(await page.locator('#drift-proof').textContent(),/Common history found/);
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Generic held rate-catalog trajectory');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [i,x] of [-1,-2,-3,-4,2,8].entries())await page.locator('#drift-reading-'+i).fill(String(x));
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal(await page.locator('#drift-reading-6').getAttribute('data-command'),'sample');
  await page.locator('#drift-reading-6').fill('13');await page.locator('#evaluate-readings').click();await idle();
  const generic=await accepted();assert.deepEqual(generic.readouts[1].result.consistentHypothesisIds,['A']);
  const genericFile=await download('export-notebook','generic-one-feedback.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',genericFile]).stdout),generic);
  await page.locator('#new-draft').click();await idle();
  const cut=JSON.parse(await page.locator('#source-text').inputValue());cut.limits.assignments=0;
  await page.locator('#source-text').fill(JSON.stringify(cut));await page.locator('#replan').click();await idle();
  assert.match(await page.locator('#plan-heading').textContent(),/budget was reached/);
  assert.equal(await page.locator('#supplied-details').isVisible(),false);
  mark('a source-driven feedback search exposes a physical refutation, executes its winning prefix, and marks exhausted budgets inconclusive');

  await openDetails('source-details');await page.locator('#example').selectOption('driftSuffix');
  await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#plan-heading').textContent(),/command sequence/);
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Early suffix group-three trajectory');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [i,x] of [0,0,48].entries())await page.locator('#drift-reading-'+i).fill(String(x));
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal(await page.locator('#drift-reading-3').getAttribute('data-command'),'g3x');
  assert.equal(await page.locator('#drift-reading-4').getAttribute('data-command'),'g3y');
  await page.locator('#drift-reading-3').fill('48');
  await page.locator('#evaluate-readings').click();await idle();await page.reload();await idle();
  await openDetails('supplied-details');await page.locator('#drift-reading-4').fill('64');
  await page.locator('#evaluate-readings').click();await idle();
  const early=await accepted();assert.deepEqual(early.readouts.at(-1).result.consistentHypothesisIds,['G3_01']);
  const earlyFile=await download('export-notebook','early-suffix-feedback.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',earlyFile]).stdout),early);
  mark('the prefix commits both later pulses and the unchanged suffix survives intermediate reopen and CLI replay');

  await openDetails('source-details');await page.locator('#example').selectOption('driftHistorySuffix');
  await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#drift-proof').textContent(),/cannot share one prefix/);
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Six-command physical world B');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [i,x] of [0,0,2,4,7].entries())await page.locator('#drift-reading-'+i).fill(String(x));
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal(await page.locator('#drift-reading-5').getAttribute('data-command'),'x');
  assert.equal(await page.locator('#drift-reading-6').getAttribute('data-command'),'rest');
  await page.locator('#drift-reading-5').fill('6');await page.locator('#drift-reading-6').fill('8');
  await page.locator('#evaluate-readings').click();await idle();
  const higher=await accepted();assert.deepEqual(higher.readouts.at(-1).result.consistentHypothesisIds,['B']);
  const higherFile=await download('export-notebook','higher-order-suffix.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',higherFile]).stdout),higher);
  mark('a four-law common-history exclusion admits both suffixes and replays a six-command measured record');

  for(const [history,command,tail,law] of [[2,'y1',[4,7],'A'],[3,'x1',[101,99],'C']]){
    await openDetails('source-details');await page.locator('#example').selectOption('driftSuffixRegions');
    await page.locator('#load-example').click();await idle();
    assert.match(await page.locator('#plan-heading').textContent(),/second difference/);
    await page.locator('#freeze-plan').click();await openDetails('supplied-details');
    await page.locator('#readout-source').fill('Four-survivor conditional position course');
    await page.locator('#acquisition-kind').selectOption('synthetic');
    for(const [i,x] of [0,0,history].entries())await page.locator('#drift-reading-'+i).fill(String(x));
    await page.locator('#evaluate-readings').click();await idle();
    const prefixBook=await accepted();
    assert.deepEqual(prefixBook.readouts.at(-1).result.consistentHypothesisIds,['A','B','C','D']);
    assert.equal(await page.locator('#drift-reading-3').getAttribute('data-command'),command);
    for(const [i,x] of tail.entries())await page.locator('#drift-reading-'+(3+i)).fill(String(x));
    await page.locator('#evaluate-readings').click();await idle();
    const finished=await accepted();assert.deepEqual(finished.readouts.at(-1).result.consistentHypothesisIds,[law]);
    const file=await download('export-notebook','conditional-suffix-'+command+'.json');
    assert.deepEqual(JSON.parse(cli(['--notebook',file]).stdout),finished);
  }
  mark('identical four-law survivor lists drive opposite measured suffixes in the browser and CLI');

  await openDetails('source-details');await page.locator('#example').selectOption('driftPlanarSuffix');
  await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#plan-heading').textContent(),/Two measured contrasts/);
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Five-pulse oblique region replay');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [i,x] of [0,0,-1,-3].entries())await page.locator('#drift-reading-'+i).fill(String(x));
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal(await page.locator('#drift-reading-4').getAttribute('data-command'),'x1');
  await page.locator('#drift-reading-4').fill('-5/2');await page.locator('#drift-reading-5').fill('-3');
  await page.locator('#evaluate-readings').click();await idle();
  const planeBook=await accepted();assert.deepEqual(planeBook.readouts.at(-1).result.consistentHypothesisIds,['A']);
  const planeFile=await download('export-notebook','planar-suffix.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',planeFile]).stdout),planeBook);
  mark('an oblique closed suffix region governs the measured three-pulse prefix and replays through the CLI');

  await openDetails('source-details');await page.locator('#example').selectOption('driftSharedSuffix');
  await page.locator('#load-example').click();await idle();
  assert.match(await page.locator('#plan-heading').textContent(),/safe complete suffix/);
  await page.locator('#freeze-plan').click();await openDetails('supplied-details');
  await page.locator('#readout-source').fill('Seven-pulse shared-prefix replay');
  await page.locator('#acquisition-kind').selectOption('synthetic');
  for(const [i,x] of ['0','0','11/40','-11/40','5/8'].entries())await page.locator('#drift-reading-'+i).fill(x);
  await page.locator('#evaluate-readings').click();await idle();
  assert.equal(await page.locator('#drift-reading-5').getAttribute('data-command'),'x1');
  for(const [i,x] of ['1/2','-7/2','1/2'].entries())await page.locator('#drift-reading-'+(5+i)).fill(x);
  await page.locator('#evaluate-readings').click();await idle();
  const sharedBook=await accepted();assert.deepEqual(sharedBook.readouts.at(-1).result.consistentHypothesisIds,['A']);
  const sharedFile=await download('export-notebook','shared-suffix.json');
  assert.deepEqual(JSON.parse(cli(['--notebook',sharedFile]).stdout),sharedBook);
  mark('the state-space exclusion commits a three-command suffix from a four-pulse measured prefix');

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
