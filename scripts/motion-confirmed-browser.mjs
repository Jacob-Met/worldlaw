/** Actual original-video and authored alias receiving for full-pixel candidate confirmation. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {deriveAngles} from '../src/motion/measurement.mjs';

if(!process.env.MOTION_GRID_VIDEO)throw Error('Supply the unchanged original declared in examples/motion-fixtures-15cc.json.');
const video=resolve(process.env.MOTION_GRID_VIDEO),out=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/grid-browser');
const manifest=JSON.parse(await readFile(new URL('../examples/motion-fixtures-15cc.json',import.meta.url),'utf8')).real;
const sha256=createHash('sha256').update(await readFile(video)).digest('hex');assert.equal(sha256,manifest.originalSha256);
await mkdir(out,{recursive:true});const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createProductServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin=`http://127.0.0.1:${server.address().port}`,checks=[],errors=[],metrics={};let browser;
const mark=name=>{checks.push(name);console.log('PASS '+name);};
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
  const download=async name=>{const pending=page.waitForEvent('download');await page.locator('#save-notebook').click();const file=await pending;
    const path=resolve(out,name);await file.saveAs(path);return {path,value:JSON.parse(await readFile(path,'utf8'))};};
  const point=async(selector,p)=>{await page.locator(selector).click();await page.locator('#coordinate-details').evaluate(el=>el.open=true);
    await page.locator('#point-x').fill(String(p.x));await page.locator('#point-y').fill(String(p.y));await page.locator('#apply-point').click();};
  const seek=async t=>{await page.locator('#seek-time').fill(String(t));await page.locator('#seek-frame').click();
    await page.waitForFunction(time=>!document.getElementById('seek-frame').disabled&&Math.abs(Number(document.getElementById('timeline').value)-time)<.001,t);};
  const track=async()=>{await page.locator('#track-motion').click();await page.waitForFunction(()=>document.getElementById('cancel-tracking').hidden&&/Tracking (paused|complete)/.test(document.getElementById('motion-notice').textContent),{},{timeout:120000});assert.equal(await page.locator('#motion-error').isVisible(),false);};
  await page.goto(origin+'/motion.html');await page.locator('#video-file').setInputFiles(video);
  await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  assert.equal(await page.locator('#patch-sampling').inputValue(),'1');assert.equal(await page.locator('#appearance-mode').inputValue(),'luminance');
  await page.locator('#patch-radius').fill('14');await page.locator('#search-radius').fill('64');
  await page.locator('#sample-step').fill('.04');await page.locator('#track-until').fill('.28');await page.locator('#appearance-mode').selectOption('color');
  await point('#pick-pivot',{x:238,y:238});await point('#pick-marker',{x:260,y:132});await track();
  const dense=await download('dense-color.json');assert.equal(dense.value.measurements.at(-1).time,.2);
  assert.equal(dense.value.measurements.at(-1).status,'lost');assert.equal(dense.value.measurements.at(-1).point,null);
  mark('unchanged dense color profile retains its actual radius64 loss at0.20s');

  await seek(0);await page.locator('#patch-sampling').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#patch-sampling').inputValue(),'2-confirmed');await page.locator('#search-radius').fill('128');await page.locator('#track-until').fill('1.56');
  const before=await download('profile-change-retains-evidence.json');assert.deepEqual(before.value,dense.value);
  const started=Date.now();await track();metrics.elapsedMs=Date.now()-started;
  const sparse=await download('confirmed-color.json'),rows=sparse.value.measurements;
  assert.deepEqual(rows.map(r=>r.time),Array.from({length:40},(_,i)=>Number((i*.04).toFixed(2))));assert.ok(rows.every(r=>r.status==='manual'||r.status==='accepted'));
  assert.deepEqual(rows[0],dense.value.measurements[0]);
  for(const row of rows.slice(1)) {
    assert.equal(row.tracker.version,'worldlaw.patch-color-grid-confirmed-ncc/v1');assert.equal(row.tracker.sampleStep,2);
    assert.equal(row.tracker.patchRadius,14);assert.equal(row.tracker.searchRadius,128);assert.equal(row.timeBasis,'decoded-media-time');
    assert.equal(row.tracker.minScore,.75);assert.equal(row.tracker.minMargin,.06);
    assert.equal(row.tracker.confirmFullPixel,true);assert.equal(row.quality.confirmation.status,'passed');assert.ok(row.quality.confirmation.score>=.75);assert.ok(row.quality.confirmation.textureStd>=5);
  }
  // Broad visually inspected regions of the selected red marker, not independent truth.
  for(const [time,x,y] of [[.2,341,274],[.24,316,317],[.28,216,342]]) {
    const p=rows.find(r=>r.time===time).point;assert.ok(Math.hypot(p.x-x,p.y-y)<5,JSON.stringify({time,p}));
  }
  assert.equal(deriveAngles(sparse.value).samples.length,40);
  assert.ok(sparse.value.revisions.some(r=>JSON.stringify(r).includes('score-below-threshold')));
  metrics.rows=rows.map(r=>({time:r.time,point:r.point,status:r.status,score:r.quality?.score,margin:r.quality?.ambiguityMargin,fullPixel:r.quality?.confirmation}));
  mark('explicit sampled profile searches every original candidate and retains all forty source frames with separate full-pixel candidate checks and unchanged score gates');

  await seek(1.56);await page.locator('#match-diagnostics').scrollIntoViewIfNeeded();
  assert.match(await page.locator('#match-diagnostics').textContent(),/full-pixel candidate check/);
  await page.locator('#evidence-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'confirmed-1440.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(out,'confirmed-390.png'),fullPage:true});
  mark('desktop and390px original source overlays, keyboard sampling control and recorded profile diagnostics');

  await page.locator('#notebook-file').setInputFiles(sparse.path);await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('disconnected'));
  for(const [id,value] of [['patch-sampling','2-confirmed'],['patch-radius','14'],['search-radius','128'],['appearance-mode','color']])assert.equal(await page.locator('#'+id).inputValue(),value);
  assert.deepEqual((await download('reopened.json')).value,sparse.value);
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(video);await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  assert.equal(await page.locator('#patch-sampling').inputValue(),'2-confirmed');assert.deepEqual((await download('reattached.json')).value,sparse.value);
  mark('completed raw download, reopening and matching original-video reattachment preserve the mixed recorded profiles and restore the latest settings');

  await seek(0);await page.locator('#patch-sampling').selectOption('1');await page.locator('#track-motion').click();
  assert.match(await page.locator('#motion-error').textContent(),/computation limit/);assert.deepEqual((await download('after-budget-refusal.json')).value,sparse.value);
  await page.locator('#patch-radius').fill('7');await page.locator('#patch-sampling').selectOption('2');await page.locator('#track-motion').click();
  assert.match(await page.locator('#motion-error').textContent(),/even patch radius/);assert.deepEqual((await download('after-grid-refusal.json')).value,sparse.value);
  await page.locator('#patch-radius').fill('14');await page.locator('#notebook-file').setInputFiles(dense.path);await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('disconnected'));
  assert.equal(await page.locator('#patch-sampling').inputValue(),'1');assert.equal(await page.locator('#search-radius').inputValue(),'64');
  assert.deepEqual((await download('dense-reopened.json')).value,dense.value);
  mark('expensive dense and asymmetric sparse settings refuse without changing evidence; legacy dense notebook restores its actual profile');
  // Exercise the old sparse profile directly; old rows never inherit confirmation.
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(video);await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  await seek(0);await page.locator('#patch-radius').fill('14');await page.locator('#search-radius').fill('128');await page.locator('#patch-sampling').selectOption('2');await page.locator('#track-until').fill('.28');await track();
  const legacySparse=await download('legacy-sparse.json');assert.ok(legacySparse.value.measurements.slice(1).every(r=>r.tracker.version==='worldlaw.patch-color-grid-ncc/v1'&&!r.quality.confirmation));
  await page.locator('#notebook-file').setInputFiles(legacySparse.path);await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('disconnected'));assert.equal(await page.locator('#patch-sampling').inputValue(),'2');
  assert.deepEqual((await download('legacy-sparse-reopened.json')).value,legacySparse.value);
  mark('previous sparse records retain their unchecked profile and diagnostics after actual save/reopen');

  // Authored lossless video: only pixels skipped by the selected patch lattice change.
  let seed=7;const original=Buffer.alloc(96*96*4);
  for(let i=0;i<original.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed>>>24;original.set([v,v,v,255],i);}
  const altered=Buffer.from(original);for(let y=40;y<=56;y++)for(let x=40;x<=56;x++)if(x%2||y%2){const i=(y*96+x)*4,v=255-altered[i];altered.set([v,v,v,255],i);}
  const raw=resolve(out,'alias.rgba'),alias=resolve(out,'alias.webm');await writeFile(raw,Buffer.concat([original,altered]));
  execFileSync('ffmpeg',['-v','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','96x96','-framerate','5','-i',raw,'-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv444p','-an',alias]);
  await page.locator('#video-file').setInputFiles(alias);await page.waitForFunction(()=>document.getElementById('source-detail').textContent.includes('96 × 96'));
  await page.locator('#patch-radius').fill('8');await page.locator('#search-radius').fill('8');await page.locator('#sample-step').fill('.2');await page.locator('#track-until').fill('.2');await page.locator('#patch-sampling').selectOption('2');
  await point('#pick-pivot',{x:10,y:10});await point('#pick-marker',{x:48,y:48});await track();
  const aliasUnchecked=await download('alias-unchecked.json');assert.equal(aliasUnchecked.value.measurements.at(-1).status,'accepted');
  await seek(0);await page.locator('#patch-sampling').selectOption('2-confirmed');await track();
  const aliasChecked=await download('alias-checked.json'),failure=aliasChecked.value.measurements.at(-1);
  assert.equal(failure.status,'lost');assert.equal(failure.point,null);assert.equal(failure.reason,'full-pixel-candidate-score-below-threshold');
  assert.equal(failure.quality.confirmation.status,'failed');assert.ok(failure.quality.score>.99);assert.ok(failure.quality.confirmation.score<.3);
  const aliasAngles=deriveAngles(aliasChecked.value).samples;assert.equal(aliasAngles.filter(r=>Number.isFinite(r.position)).length,1);assert.equal(aliasAngles.at(-1).position,null);assert.match(await page.locator('#inspection-summary').textContent(),/complete original-pixel patch/);
  metrics.alias={sourceSHA256:createHash('sha256').update(await readFile(alias)).digest('hex'),unchecked:aliasUnchecked.value.measurements.at(-1),checked:failure};
  await page.locator('#match-diagnostics').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'alias-refused-390.png'),fullPage:true});
  mark('actual authored skipped-pixel video passes the old sparse match but pauses with no point or angle under full-pixel confirmation');

  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'receipt.json'),JSON.stringify({checks,errors,metrics,
    scope:'Original-video association receiving, not independent center truth or physical dynamics qualification. Full-pixel confirmation checks only the selected candidate. It cannot establish global full-pixel uniqueness or physical identity. An authored skipped-pixel video separately exercises the refusal.',
    source:{sha256,title:manifest.title,creators:manifest.creators,sourcePage:manifest.sourcePage,license:manifest.license,licenseUrl:manifest.licenseUrl},
    screenshotMedia:'Source movie pixels are adapted within app screenshots; source attribution and CC BY-SA4.0 apply.'},null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,errors,metrics}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
