/** Actual Motion tracker -> source notebooks -> maintained angular-law UI. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {restoreChallenge} from '../src/trajectory/session.mjs';
const fixtures=resolve(process.env.MOTION_FIXTURE_DIR||'.receipts/motion-intake-fixtures');
const artifacts=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/motion-intake-browser');
await mkdir(artifacts,{recursive:true});
const truth=JSON.parse(await readFile(resolve(fixtures,'truth.json'),'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createProductServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[],acquisitions=[];let browser;
const mark=name=>{checks.push(name);console.log('PASS '+name);};
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const sandboxPage=await browser.newPage();await sandboxPage.goto('chrome://sandbox');
  const sandboxStatus=await sandboxPage.locator('body').innerText();
  assert.match(sandboxStatus,/Layer 1 Sandbox\s+Namespace/);
  for(const key of ['PID namespaces','Network namespaces','Seccomp-BPF sandbox'])
    assert.match(sandboxStatus,new RegExp(key+'\\s+Yes'));
  await sandboxPage.close();
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(30000);
 page.on('pageerror',error=>errors.push(error.message));
 const download=async(selector,name)=>{const pending=page.waitForEvent('download');await page.locator(selector).click();
  const path=resolve(artifacts,name);await(await pending).saveAs(path);const text=await readFile(path,'utf8');return {path,text,value:JSON.parse(text)};};
 const notebooks={};
 for(const course of truth.courses){
  await page.goto(origin+'/motion.html');
  await page.locator('#video-file').setInputFiles(resolve(fixtures,course.file));
  await page.waitForFunction(name=>document.getElementById('source-name').textContent.includes(name),course.file);
  await page.waitForFunction(()=>!document.getElementById('pick-marker').disabled);
  await page.locator('#pick-marker').click();await page.locator('#coordinate-details').evaluate(el=>el.open=true);
  await page.locator('#point-x').fill(String(course.frames[0].point.x));await page.locator('#point-y').fill(String(course.frames[0].point.y));await page.locator('#apply-point').click();
  await page.locator('#sample-step').fill('.05');await page.locator('#search-radius').fill('24');
  await page.locator('#track-until').fill('7.95');await page.locator('#track-motion').click();
  await page.waitForFunction(()=>document.getElementById('cancel-tracking').hidden&&Number(document.getElementById('accepted-count').textContent)>100,{},{timeout:120000});
  assert.equal(await page.locator('#motion-error').isVisible(),false);
  await page.locator('#path-reference-panel').evaluate(el=>el.open=true);
  await page.locator('#infer-path-reference').click();assert.equal(await page.locator('#apply-path-reference').isDisabled(),false);
  await page.locator('#apply-path-reference').click();
  notebooks[course.name]=await download('#save-notebook','motion-'+course.name+'.json');
  const nb=notebooks[course.name].value;
  assert.ok(nb.measurements.length>=155);assert.ok(nb.measurements.every(row=>row.point&&row.timeBasis==='decoded-media-time'));
  assert.equal(nb.source.sha256,createHash('sha256').update(await readFile(resolve(fixtures,course.file))).digest('hex'));
  acquisitions.push({course:course.name,frames:nb.measurements.length,sourceSha256:nb.source.sha256,
   referenceErrorPixels:Math.hypot(nb.calibration.pivot.x-course.center.x,nb.calibration.pivot.y-course.center.y)});
 }
 mark('three separately encoded original movies reach actual tracked pixels, reference acceptance and saved Motion inputs');
 await page.goto(origin+'/trajectory.html');await page.waitForFunction(()=>document.getElementById('refit')&&!document.getElementById('refit').disabled);
 await page.locator('#motion-intake-panel').evaluate(el=>el.open=true);
 const attach=async(role,name)=>{
  await page.locator('#motion-'+role+'-file').setInputFiles(notebooks[name].path);
  await page.waitForFunction(role=>!document.getElementById('motion-'+role+'-course').disabled,role);
  await page.locator('#motion-'+role+'-kind').selectOption('synthetic');
  await page.locator('#motion-'+role+'-rate').fill('0');
  await page.locator('#motion-'+role+'-rate-basis').fill('Independent authored release from rest; known from the source construction.');
 };
 const declarations=async()=>{
  await page.locator('#motion-unforced').check();await page.locator('#motion-shared-frame').check();
  await page.locator('#motion-assumption-basis').fill('Authored unforced oscillator movies; same downward angular zero and fixed image orientation.');
 };
 const apply=async()=>{
  await page.locator('#motion-compare').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('motion-intake-status').textContent.startsWith('Separate Motion recordings loaded.')||!document.getElementById('motion-intake-error').hidden);
 };
 await attach('training','fit');await attach('challenge','challenge');await declarations();await apply();
 assert.equal(await page.locator('#motion-intake-error').isVisible(),false);
 assert.match(await page.locator('#source-description').textContent(),/Prediction comparisons condition on that calibration/);
 const saved=await download('#export-notebook','motion-trajectory.json'),result=restoreChallenge(saved.text);
 const metrics=result.summary,selected=result.discovery.selected;
 assert.equal(result.bundle.trainingRuns[0].source.recordingId,'sha256:'+notebooks.fit.value.source.sha256);
 assert.equal(result.bundle.challengeRuns[0].source.recordingId,'sha256:'+notebooks.challenge.value.source.sha256);
 assert.equal(result.bundle.trainingRuns[0].source.motion.inputSha256,createHash('sha256').update(notebooks.fit.text).digest('hex'));
 assert.equal(result.bundle.challengeRuns[0].source.motion.initialRate.value,0);
 assert.ok(metrics.selectedPositionRMSE<.1,JSON.stringify(metrics));
 for(const baseline of metrics.predictionSkill.baselines)assert.ok(baseline.skill>0,JSON.stringify(baseline));
 assert.ok(result.bundle.trainingRuns[0].samples.every(row=>!Object.hasOwn(row,'command')));
 await page.locator('#trajectory-chart').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(artifacts,'prediction-desktop.png'),fullPage:false});
 mark('actual Motion intake fits its training recording and predicts a different recording better than both no-learning baselines');
 await page.locator('#notebook-file').setInputFiles(saved.path);
 await page.waitForFunction(()=>document.getElementById('notice').textContent.startsWith('Notebook reopened.'));
 const reopened=await download('#export-notebook','motion-trajectory-reopened.json');assert.deepEqual(reopened.value,saved.value);
 mark('portable trajectory notebook reopens with source lineage, declarations and identical input-only model reconstruction');
 await attach('challenge','fit');await declarations();await apply();
 assert.match(await page.locator('#motion-intake-error').textContent(),/shares a declared recording/);
 const preserved=await download('#export-notebook','same-video-refused.json');assert.deepEqual(preserved.value,saved.value);
 mark('a shared original video is refused without replacing the loaded prediction');
 await attach('challenge','different-law');
 assert.equal(await page.locator('#motion-unforced').isChecked(),false);assert.equal(await page.locator('#motion-shared-frame').isChecked(),false);
 await declarations();await apply();assert.equal(await page.locator('#motion-intake-error').isVisible(),false);
 const different=await download('#export-notebook','different-law.json'),failedTransfer=restoreChallenge(different.text);
 assert.deepEqual(failedTransfer.discovery, result.discovery);
 assert.ok(failedTransfer.summary.selectedPositionRMSE>metrics.selectedPositionRMSE*3,
  JSON.stringify({good:metrics.selectedPositionRMSE,bad:failedTransfer.summary.selectedPositionRMSE}));
 mark('a separately tracked different-law movie retains its failed transfer while the training-selected law remains identical');
 await page.setViewportSize({width:390,height:844});await page.locator('#motion-intake-panel').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#motion-training-rate').focus();assert.equal(await page.evaluate(()=>document.activeElement.id),'motion-training-rate');
 await page.locator('#motion-intake-panel').screenshot({path:resolve(artifacts,'intake-narrow.png')});
 mark('narrow layout, keyboard input and reduced-motion receiving stay operable');
 assert.deepEqual(errors,[]);mark('no uncaught page exceptions');
 const receipt={checks,acquisitions,positive:metrics,selectedModel:selected,
  differentLaw:{summary:failedTransfer.summary,selectedModel:failedTransfer.discovery.selected},errors,
  scope:'Authored synthetic pixel movies through actual video decode/tracking; no physical-mechanism or blind-validation claim.',chromiumSandbox:true,sandboxStatus,executable:process.env.BROWSER_EXECUTABLE_PATH||'playwright-managed'};
 await writeFile(resolve(artifacts,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
