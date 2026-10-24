/** Actual source-video receiving. Media is supplied locally and is never bundled. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {deriveAngles} from '../src/motion/measurement.mjs';

if(!process.env.MOTION_COLOR_VIDEO)throw new Error('Set MOTION_COLOR_VIDEO to the original source in examples/motion-fixtures-15cc.json.');
const video=resolve(process.env.MOTION_COLOR_VIDEO),artifactDir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/color-browser');
const manifest=JSON.parse(await readFile(new URL('../examples/motion-fixtures-15cc.json',import.meta.url),'utf8')).real;
const sha256=createHash('sha256').update(await readFile(video)).digest('hex');
assert.equal(sha256,manifest.originalSha256,'receive the unchanged, source-declared original');
await mkdir(artifactDir,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createProductServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin=`http://127.0.0.1:${server.address().port}`,checks=[],errors=[],metrics={};let browser;
const mark=name=>{checks.push(name);console.log('PASS '+name);};
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(25000);
  const download=async(selector,name)=>{const event=page.waitForEvent('download');await page.locator(selector).click();const file=await event;
    const path=resolve(artifactDir,name);await file.saveAs(path);return {path,value:JSON.parse(await readFile(path,'utf8'))};};
  const point=async(selector,p)=>{await page.locator(selector).click();await page.locator('#coordinate-details').evaluate(el=>el.open=true);
    await page.locator('#point-x').fill(String(p.x));await page.locator('#point-y').fill(String(p.y));await page.locator('#apply-point').click();};
  const seek=async time=>{await page.locator('#seek-time').fill(String(time));await page.locator('#seek-frame').click();
    await page.waitForFunction(t=>!document.getElementById('seek-frame').disabled&&Math.abs(Number(document.getElementById('timeline').value)-t)<.001,time);};
  const track=async()=>{await page.locator('#track-motion').click();
    await page.waitForFunction(()=>document.getElementById('cancel-tracking').hidden&&/Tracking (paused|complete)/.test(document.getElementById('motion-notice').textContent),{},{timeout:120000});
    assert.equal(await page.locator('#motion-error').isVisible(),false);};
  await page.goto(origin+'/motion.html');await page.locator('#video-file').setInputFiles(video);
  await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  await page.locator('#patch-radius').fill('14');await page.locator('#search-radius').fill('64');
  await page.locator('#sample-step').fill('.04');await page.locator('#track-until').fill('2');
  await point('#pick-pivot',{x:238,y:238});await point('#pick-marker',{x:260,y:132});
  assert.equal(await page.locator('#appearance-mode').inputValue(),'luminance');await track();
  const baseline=await download('#save-notebook','real-luminance-notebook.json');
  assert.equal(baseline.value.measurements.length,2);const rejected=baseline.value.measurements[1];
  assert.equal(rejected.status,'ambiguous');assert.equal(rejected.reason,'competing-match');assert.equal(rejected.point,null);
  assert.ok(rejected.quality.ambiguityMargin<.06);metrics.luminanceFirst=rejected;
  mark('original real video retains the documented luminance ambiguity and no observed point');

  await seek(0);await page.locator('#appearance-mode').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#appearance-mode').inputValue(),'color');
  const before=await download('#save-notebook','mode-change-keeps-evidence.json');assert.deepEqual(before.value,baseline.value);
  const start=Date.now();await track();metrics.elapsedMs=Date.now()-start;
  const colored=await download('#save-notebook','real-color-notebook.json'),rows=colored.value.measurements;
  assert.equal(colored.value.source.sha256,sha256);assert.ok(rows.length>2);
  const first=rows[1];assert.equal(first.status,'accepted');assert.equal(first.tracker.version,'worldlaw.patch-color-ncc/v1');
  assert.equal(first.tracker.appearance,'color');assert.equal(first.tracker.minMargin,.06);assert.equal(first.tracker.minScore,.75);
  assert.equal(first.time,rejected.time);assert.equal(first.timeBasis,'decoded-media-time');
  // Visually inspected red-marker region; this is not independent position truth.
  assert.ok(first.point.x>300&&first.point.x<308&&first.point.y>151&&first.point.y<159,JSON.stringify(first));
  assert.ok(first.quality.ambiguityMargin>.06);metrics.colorFirst=first;
  metrics.rows=rows.map(row=>({time:row.time,status:row.status,point:row.point,reason:row.reason,score:row.quality?.score,margin:row.quality?.ambiguityMargin}));
  console.log(JSON.stringify(metrics.rows));
  for(const row of rows.slice(1)) {
    assert.equal(row.tracker.version,'worldlaw.patch-color-ncc/v1');assert.equal(row.tracker.appearance,'color');
    if(row.status!=='accepted')assert.equal(row.point,null);
  }
  assert.equal(rows.at(-1).time,.2);assert.equal(rows.at(-1).status,'lost');
  assert.equal(rows.at(-1).reason,'score-below-threshold');assert.equal(rows.at(-1).point,null);
  const angles=deriveAngles(colored.value);for(const row of angles.samples)if(row.status!=='accepted'&&row.status!=='manual')assert.equal(row.position,null);
  assert.ok(colored.value.revisions.some(r=>JSON.stringify(r).includes('competing-match')),'the replaced rejected run remains in revision custody');
  mark('color resolves the first real association with unchanged gates, preserves later outcomes and prior rejected evidence');

  await seek(first.time);await page.locator('#match-diagnostics').scrollIntoViewIfNeeded();
  assert.match(await page.locator('#match-diagnostics').textContent(),/Brightness \+ color/);
  await page.locator('#evidence-canvas').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(artifactDir,'color-1440.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('#appearance-mode').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(artifactDir,'color-390.png'),fullPage:true});
  mark('actual desktop and narrow source overlays, keyboard appearance choice and per-frame diagnostics');

  await page.locator('#notebook-file').setInputFiles(colored.path);
  await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('disconnected'));
  assert.equal(await page.locator('#appearance-mode').inputValue(),'color');
  const reopened=await download('#save-notebook','real-color-reopened.json');assert.deepEqual(reopened.value,colored.value);
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(video);
  await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  assert.equal(await page.locator('#appearance-mode').inputValue(),'color');
  const reattached=await download('#save-notebook','real-color-reattached.json');assert.deepEqual(reattached.value,colored.value);
  await page.locator('#appearance-mode').selectOption('luminance');
  const changed=await download('#save-notebook','real-color-change-preserved.json');assert.deepEqual(changed.value,colored.value);
  mark('source-bound save/reopen restores the latest measured mode; changing next-run controls preserves recorded algorithms');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(artifactDir,'receipt.json'),JSON.stringify({kind:'real-image association receiving, not independent marker ground truth or physical dynamics qualification',checks,errors,metrics,
    source:{sha256,title:manifest.title,creators:manifest.creators,sourcePage:manifest.sourcePage,license:manifest.license,licenseUrl:manifest.licenseUrl},
    screenshotMedia:'Source movie pixels are adapted within app screenshots; attribution and CC BY-SA 4.0 apply to the source/adapted media.'},null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,errors,metrics},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
