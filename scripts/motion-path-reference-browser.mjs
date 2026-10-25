/** Actual maintained local server, original encoded pixels and unmocked browser processing. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {deriveAngles} from '../src/motion/measurement.mjs';
const fixtures=resolve(process.env.MOTION_FIXTURE_DIR||'.receipts/path-reference-fixtures');
const artifacts=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/path-reference-browser');
await mkdir(artifacts,{recursive:true});
const truth=JSON.parse(await readFile(resolve(fixtures,'truth.json'),'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createProductServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin='http://127.0.0.1:'+server.address().port;
const checks=[],metrics=[],errors=[];let browser;
const mark=name=>{checks.push(name);console.log('PASS '+name);};
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const sandboxPage=await browser.newPage();await sandboxPage.goto('chrome://sandbox');
  const sandboxStatus=await sandboxPage.locator('body').innerText();
  assert.match(sandboxStatus,/Layer 1 Sandbox\s+Namespace/);
  for(const key of ['PID namespaces','Network namespaces','Seccomp-BPF sandbox'])
    assert.match(sandboxStatus,new RegExp(key+'\\s+Yes'));
  await sandboxPage.close();
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  const download=async(selector,name)=>{
    const pending=page.waitForEvent('download');await page.locator(selector).click();
    const file=await pending,path=resolve(artifacts,name);await file.saveAs(path);
    return {path,value:JSON.parse(await readFile(path,'utf8'))};
  };
  const load=async course=>{
    await page.goto(origin+'/motion.html');
    await page.locator('#video-file').setInputFiles(resolve(fixtures,course.file));
    await page.waitForFunction(name=>document.getElementById('source-name').textContent.includes(name),course.file);
    await page.waitForFunction(()=>!document.getElementById('pick-marker').disabled);
    assert.equal(await page.locator('#export-angles').isDisabled(),true);
    await page.locator('#pick-marker').click();
    await page.locator('#coordinate-details').evaluate(el=>el.open=true);
    await page.locator('#point-x').fill(String(course.frames[0].point.x));
    await page.locator('#point-y').fill(String(course.frames[0].point.y));
    await page.locator('#apply-point').click();
    const initial=await download('#save-notebook',course.name+'-marker-only.json');
    assert.equal(initial.value.calibration,null);assert.equal(initial.value.measurements.length,1);
    await page.locator('#sample-step').fill('.05');await page.locator('#search-radius').fill('16');
    await page.locator('#track-until').fill('1.95');await page.locator('#track-motion').click();
    await page.waitForFunction(()=>document.getElementById('cancel-tracking').hidden&&Number(document.getElementById('accepted-count').textContent)>20,{},{timeout:120000});
    assert.equal(await page.locator('#motion-error').isVisible(),false);
    const tracked=await download('#save-notebook',course.name+'-tracked.json');
    assert.equal(tracked.value.calibration,null);assert.ok(tracked.value.measurements.length>=35);
    assert.ok(tracked.value.measurements.every(row=>row.point&&row.timeBasis==='decoded-media-time'));
    assert.equal(tracked.value.source.sha256,createHash('sha256').update(await readFile(resolve(fixtures,course.file))).digest('hex'));
    assert.equal(await page.locator('#export-angles').isDisabled(),true);
    await page.locator('#path-reference-panel').evaluate(el=>el.open=true);
    await page.locator('#infer-path-reference').click();
    return tracked;
  };
  let firstSaved;
  for(const course of truth.courses.filter(c=>c.center)){
    const tracked=await load(course);
    assert.equal(await page.locator('#apply-path-reference').isDisabled(),false);
    assert.match(await page.locator('#path-reference-result').textContent(),/Proposed fixed reference/);
    await page.locator('#evidence-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(artifacts,course.name+'-proposal-desktop.png'),fullPage:true});
    // A changed declaration invalidates the visible result before it can be used.
    await page.locator('#path-residual').fill('1.9');await page.locator('#path-residual').blur();
    assert.equal(await page.locator('#apply-path-reference').isDisabled(),true);
    await page.locator('#infer-path-reference').click();
    await page.locator('#apply-path-reference').focus();await page.keyboard.press('Enter');
    const saved=await download('#save-notebook',course.name+'-calibrated.json');
    assert.deepEqual(saved.value.measurements,tracked.value.measurements);
    const pivot=saved.value.calibration.pivot;
    const centerError=Math.hypot(pivot.x-course.center.x,pivot.y-course.center.y);
    const angles=deriveAngles(saved.value);
    const angularError=Math.max(...angles.samples.map(row=>Math.abs(row.position-course.frames[Math.round(row.time*truth.fps)].angle)));
    assert.ok(centerError<2,JSON.stringify({course:course.name,centerError}));
    assert.ok(angularError<.03,JSON.stringify({course:course.name,angularError}));
    const exported=await download('#export-angles',course.name+'-angles.json');
    assert.equal(exported.value.samples.length,tracked.value.measurements.length);
    assert.deepEqual(exported.value.source.metadata.referenceHistory.at(-1),saved.value.revisions.at(-1));
    metrics.push({course:course.name,frames:tracked.value.measurements.length,sourceSha256:saved.value.source.sha256,centerErrorPixels:centerError,maxAngularErrorRadians:angularError});
    if(!firstSaved)firstSaved={...saved,course};
    mark(course.name+': original video → one marker → observed circle → keyboard acceptance → source-bound angular export');
  }
  await page.locator('#notebook-file').setInputFiles(firstSaved.path);
  await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('disconnected'));
  const reopened=await download('#save-notebook','reopened.json');assert.deepEqual(reopened.value,firstSaved.value);
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(resolve(fixtures,'authored-line.webm'));
  await page.locator('#motion-error').waitFor({state:'visible'});
  assert.match(await page.locator('#motion-error').textContent(),/SHA-256/);
  const refused=await download('#save-notebook','wrong-source-preserved.json');assert.deepEqual(refused.value,firstSaved.value);
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(resolve(fixtures,firstSaved.course.file));
  await page.waitForFunction(()=>!document.getElementById('pick-marker').disabled);
  mark('save/reopen keeps exact source and derivation; wrong original refuses; matching video reconnects');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#path-reference-panel').evaluate(el=>el.open=true);
  await page.locator('#infer-path-reference').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#path-reference-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(artifacts,'proposal-narrow.png'),fullPage:true});
  mark('390px source/candidate controls, focus and reduced-motion layout remain operable');
  await page.setViewportSize({width:1440,height:1000});
  const line=await load(truth.courses.find(c=>c.name==='line'));
  assert.equal(await page.locator('#apply-path-reference').isDisabled(),true);
  assert.match(await page.locator('#path-reference-result').textContent(),/No applicable reference/);
  const unchanged=await download('#save-notebook','line-after-refusal.json');assert.deepEqual(unchanged.value,line.value);
  assert.equal(await page.locator('#export-angles').isDisabled(),true);
  mark('actual straight-source movie cannot be reported or applied as a circular reference');
  assert.deepEqual(errors,[]);mark('no uncaught page exceptions across complete positive and negative journeys');
  await writeFile(resolve(artifacts,'receiving.json'),JSON.stringify({checks,metrics,pageErrors:errors,
    scope:'Original authored encoded movies; unmocked local browser acquisition. Not physical-mechanism validation.',chromiumSandbox:true,sandboxStatus,executable:process.env.BROWSER_EXECUTABLE_PATH||'playwright-managed'},null,2)+'\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
