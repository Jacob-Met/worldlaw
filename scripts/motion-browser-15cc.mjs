/** Actual local-video file receiving; no video, tracker, or provider mocks. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const ownRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const productRoot=resolve(process.env.WORLDLAW_RECEIVE_ROOT||ownRoot);
const fixtureDir=resolve(process.env.MOTION_FIXTURE_DIR||resolve(productRoot,'.receipts/motion-fixtures'));
const artifactDir=resolve(process.env.BROWSER_ARTIFACT_DIR||resolve(productRoot,'.receipts/motion-browser'));
const truth=JSON.parse(await readFile(resolve(fixtureDir,'truth.json'),'utf8'));
const {createProductServer}=await import(pathToFileURL(resolve(productRoot,'server.mjs')));
const {deriveAngles}=await import(pathToFileURL(resolve(productRoot,'src/motion/measurement.mjs')));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
await mkdir(artifactDir,{recursive:true});
const sourceFile=variant=>resolve(fixtureDir,`analytic-pendulum-${variant}.webm`);
const checks=[],metrics={},errors=[],recordings=[];
const applicationPaths=['server.mjs','index.html','styles.css','motion.html','motion.css'];
async function modulePaths(relative='src') {
  const files=[];
  for(const entry of await readdir(resolve(productRoot,relative),{withFileTypes:true})) {
    const path=relative+'/'+entry.name;
    if(entry.isDirectory())files.push(...await modulePaths(path));
    else if(entry.isFile()&&entry.name.endsWith('.mjs'))files.push(path);
  }
  return files;
}
const sourcePaths=[...applicationPaths,...await modulePaths()].sort();
async function sourceDigests() {
  return Promise.all(sourcePaths.map(async path=>{
    const bytes=await readFile(resolve(productRoot,path));
    return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  }));
}
const sourceManifest={referenceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:productRoot,encoding:'utf8'}).trim(),
  worktreeStatus:execFileSync('git',['status','--short'],{cwd:productRoot,encoding:'utf8'}).trim(),files:await sourceDigests()};
await writeFile(resolve(artifactDir,'source-manifest.json'),JSON.stringify(sourceManifest,null,2)+'\n');
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const server=createProductServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,context,page;
try {
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000},
    ...(process.env.MOTION_RECORD_VIDEO==='1'?{recordVideo:{dir:artifactDir,size:{width:1440,height:1000}}}:{})});
  page=await context.newPage();
  if(page.video())recordings.push({video:page.video(),name:'motion-lab-browser-course.webm'});
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(15000);
  const screenshot=name=>page.screenshot({path:resolve(artifactDir,name+'.png'),fullPage:true});
  const point=async(kind,x,y)=>{
    await page.locator(kind).click();
    await page.locator('#coordinate-details').evaluate(el=>el.open=true);
    await page.locator('#point-x').fill(String(x));await page.locator('#point-y').fill(String(y));
    await page.locator('#apply-point').click();
  };
  const seek=async time=>{
    await page.locator('#seek-time').fill(String(time));await page.locator('#seek-frame').click();
    await page.waitForFunction(expected=>Math.abs(parseFloat(document.getElementById('frame-time').textContent)-expected)<.035,time);
  };
  const download=async(selector,name)=>{
    const event=page.waitForEvent('download');await page.locator(selector).click();
    const file=await event;const path=resolve(artifactDir,name);await file.saveAs(path);
    return {path,value:JSON.parse(await readFile(path,'utf8'))};
  };
  const load=async variant=>{
    await page.locator('#video-file').setInputFiles(sourceFile(variant));
    await page.waitForFunction(name=>document.getElementById('source-name').textContent.includes(name),`analytic-pendulum-${variant}`);
    await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
    assert.equal(await page.locator('#confirm-physics').isChecked(),false,'A new source must reset its physics acknowledgement');
    assert.equal(await page.locator('#known-inertia').inputValue(),'','A new source must not inherit a prior source inertia');
  };
  const calibrate=async()=>{
    await point('#pick-pivot',320,90);
    await point('#pick-marker',truth.frames[0].x,truth.frames[0].y);
    // 20Hz requests on a 30Hz source alternate one/two native-frame intervals.
    // The 32px search radius covers the largest declared fixture displacement.
    await page.locator('#sample-step').fill('.05');
    await page.locator('#search-radius').fill('32');
  };
  const track=async()=>{
    await page.locator('#track-motion').click();
    await page.locator('#cancel-tracking').waitFor({state:'visible'});
    await page.locator('#cancel-tracking').waitFor({state:'hidden',timeout:150000});
  };
  await page.goto(origin+'/motion.html');
  await load('clean');
  // Observe native callback ordering without substituting any frame or timestamp.
  // The yellow calibration dot has an independent color-centroid readout here;
  // this test does not use the tracker to validate the video's own clock.
  const clockProbe=await page.evaluate(async()=>{
    const {loadVideo}=await import('/src/motion/video.mjs');
    const file=document.getElementById('video-file').files[0],rows=[],callbacks=[];
    const nativeCallback=HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback) {
      let sawSeeked=false;this.addEventListener('seeked',()=>{sawSeeked=true;},{once:true});
      return nativeCallback.call(this,(now,metadata)=>{
        callbacks.push({seeking:this.seeking,sawSeeked,mediaTime:metadata.mediaTime,currentTime:this.currentTime});
        callback(now,metadata);
      });
    };
    const inspect=(frame,extra)=>{
      let sx=0,sy=0,count=0;
      for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++) {
        const i=(y*frame.width+x)*4;
        if(frame.data[i]>170&&frame.data[i+1]>130&&frame.data[i+2]<110){sx+=x;sy+=y;count++;}
      }
      const angle=.6*Math.exp(-.08*frame.time)*Math.cos(2.8*frame.time);
      return {...extra,time:frame.time,timeBasis:frame.timeBasis,markerPixelCount:count,
        pixelError:Math.hypot(sx/count-(320+230*Math.sin(angle)),sy/count-(90+230*Math.cos(angle)))};
    };
    let cancelled=0;
    try {
      for(let repeat=0;repeat<12;repeat++) {
        const video=await loadVideo(file);
        try {
          for(const requested of [1,.15,2.777,7.5])rows.push(inspect(await video.frameAt(requested),{repeat,requested}));
          const control=new AbortController();const pending=video.frameAt(.5,{signal:control.signal});control.abort();
          try{await pending;}catch(error){if(error.name==='AbortError')cancelled++;else throw error;}
          rows.push(inspect(await video.frameAt(1),{repeat,requested:1,afterCancel:true}));
        } finally {video.dispose();}
      }
    } finally {HTMLVideoElement.prototype.requestVideoFrameCallback=nativeCallback;}
    return {rows,callbacks,cancelled};
  });
  await writeFile(resolve(artifactDir,'clock-probe.json'),JSON.stringify(clockProbe,null,2)+'\n');
  assert.equal(clockProbe.cancelled,12);
  for(const row of clockProbe.rows) {
    assert.ok(row.markerPixelCount>0,'Clock probe did not find the rendered calibration dot');
    if(row.timeBasis==='decoded-media-time')assert.ok(row.pixelError<1.5,JSON.stringify(row));
  }
  metrics.clock={returnedFrames:clockProbe.rows.length,confirmedCancellations:clockProbe.cancelled,
    nativeCallbacksBeforeSeeked:clockProbe.callbacks.filter(row=>!row.sawSeeked).length,
    nominalFallbacks:clockProbe.rows.filter(row=>row.timeBasis!=='decoded-media-time').length,
    maxDecodedTimestampPixelError:Math.max(...clockProbe.rows.filter(row=>row.timeBasis==='decoded-media-time').map(row=>row.pixelError))};
  mark('actual rapid load/seek/cancel callbacks preserve timestamp-to-pixel agreement against independent marker detection');
  await calibrate();
  await screenshot('motion-calibrated-source');
  const beforeInvalid=await page.locator('#manual-count').innerText();
  await point('#pick-pivot',-1,90);
  await page.locator('#motion-error').waitFor({state:'visible'});
  assert.equal(await page.locator('#manual-count').innerText(),beforeInvalid);
  await point('#pick-pivot',320,90);
  await track();
  await screenshot('motion-clean-tracked');
  const clean=await download('#save-notebook','motion-clean-notebook.json');
  assert.equal(clean.value.source.sha256,createHash('sha256').update(await readFile(sourceFile('clean'))).digest('hex'));
  const angular=deriveAngles(clean.value);
  const samples=angular.samples.filter(row=>Number.isFinite(row.position));
  assert.ok(samples.length>=150,`Only ${samples.length} clean video angles retained`);
  const residuals=samples.map(row=>row.position-.6*Math.exp(-.08*row.time)*Math.cos(2.8*row.time));
  metrics.clean={samples:samples.length,angleRmse:Math.hypot(...residuals)/Math.sqrt(residuals.length),
    maxAngleError:Math.max(...residuals.map(Math.abs)),
    timeBases:[...new Set(clean.value.measurements.map(row=>row.timeBasis))]};
  assert.ok(metrics.clean.angleRmse<.006,JSON.stringify(metrics.clean));
  assert.ok(metrics.clean.maxAngleError<.015,JSON.stringify(metrics.clean));
  mark('actual WebM File decoded, calibrated, tracked and measured against analytic angular truth');
  await download('#export-angles','motion-clean-angular.json');
  await page.locator('#studio-export-details').evaluate(el=>el.open=true);
  await page.locator('#known-inertia').fill('.8');await page.locator('#declared-command').fill('0');
  await page.locator('#position-sigma').fill('.0012');await page.locator('#confirm-physics').check();
  const studio=await download('#export-studio','motion-studio-observations.json');
  assert.ok(studio.value.observations.length>=8);
  assert.ok(studio.value.heldOut.length>=8);
  metrics.studio={trainingRows:studio.value.observations.length,heldOutRows:studio.value.heldOut.length};
  const studioPage=await context.newPage();studioPage.on('pageerror',error=>errors.push(error.message));
  if(studioPage.video())recordings.push({video:studioPage.video(),name:'motion-studio-import.webm'});
  await studioPage.goto(origin);await studioPage.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
  await studioPage.locator('#observation-file').setInputFiles(studio.path);
  await studioPage.waitForFunction(expected=>document.getElementById('sample-count').textContent===String(expected),studio.value.observations.length);
  assert.match(await studioPage.locator('#source-kind').innerText(),/user-supplied/i);
  assert.equal(await studioPage.locator('#prediction-chart svg').count(),1);
  await studioPage.screenshot({path:resolve(artifactDir,'motion-received-in-torque-studio.png'),fullPage:true});
  mark('actual exported observations imported by the existing torque studio and produce model comparison');
  await studioPage.close();
  await seek(1);await page.locator('#mark-missing').click();
  assert.equal(await page.locator('#confirm-physics').isChecked(),false,'Evidence correction must invalidate the prior physics acknowledgement');
  await point('#correct-point',truth.frames[30].x,truth.frames[30].y);
  const corrected=await download('#save-notebook','motion-corrected-notebook.json');
  assert.ok(corrected.value.measurements.some(row=>Math.abs(row.time-1)<.02&&row.status==='manual'));
  await page.locator('#notebook-file').setInputFiles(corrected.path);
  await page.locator('#attach-video').waitFor({state:'visible'});
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(sourceFile('blank'));
  await page.locator('#motion-error').waitFor({state:'visible'});
  await page.locator('#attach-video').click();await page.locator('#video-file').setInputFiles(sourceFile('clean'));
  await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
  const reopened=await download('#save-notebook','motion-reopened-notebook.json');
  assert.deepEqual(reopened.value.measurements,corrected.value.measurements);
  assert.deepEqual(reopened.value.calibration,corrected.value.calibration);
  mark('manual correction persists through notebook reopen; mismatching media is refused and exact media reconnects');
  await load('occluded');await calibrate();await track();
  assert.ok(Number(await page.locator('#gap-count').innerText())>=1);
  await screenshot('motion-occlusion-stopped');
  const stopped=await download('#save-notebook','motion-occlusion-stopped.json');
  assert.ok(stopped.value.measurements.some(row=>row.time>=1.98&&row.time<2.5&&row.point===null));
  await seek(2.5);await point('#pick-marker',truth.frames[75].x,truth.frames[75].y);await track();
  const recovered=await download('#save-notebook','motion-occlusion-recovered.json');
  const segments=deriveAngles(recovered.value).segments;
  assert.ok(segments.length>=2,'Occlusion must retain distinct continuous segments');
  assert.ok(recovered.value.measurements.filter(row=>row.time>2.5&&row.point).length>90);
  await screenshot('motion-occlusion-corrected');
  metrics.occlusion={segments:segments.length,measurements:recovered.value.measurements.length};
  mark('occlusion creates an explicit null-point gap, pauses tracking and manual re-anchoring starts a separate segment');
  await load('blank');await point('#pick-pivot',320,90);await point('#pick-marker',truth.frames[0].x,truth.frames[0].y);
  await page.locator('#motion-error').waitFor({state:'visible'});
  assert.equal(await page.locator('#track-motion').isDisabled(),true);
  await screenshot('motion-blank-refused');
  mark('actual blank video cannot initialize a trusted marker template');
  if(process.env.REAL_MOTION_VIDEO) {
    const realPath=resolve(process.env.REAL_MOTION_VIDEO);
    const provenance=JSON.parse(await readFile(resolve(ownRoot,'examples/motion-fixtures-15cc.json'),'utf8')).real;
    assert.equal(createHash('sha256').update(await readFile(realPath)).digest('hex'),provenance.receivingExcerpt.sha256,
      'The optional real-video course requires the attributed four-second fixture identified in the source manifest');
    await writeFile(resolve(artifactDir,'real-media-attribution.json'),JSON.stringify(provenance,null,2)+'\n');
    await page.locator('#video-file').setInputFiles(realPath);
    await page.waitForFunction(name=>document.getElementById('source-name').textContent.includes(name),basename(realPath));
    await page.waitForFunction(()=>!document.getElementById('pick-pivot').disabled);
    assert.equal(await page.locator('#confirm-physics').isChecked(),false,'A real source must not inherit synthetic physics acknowledgement');
    assert.equal(await page.locator('#known-inertia').inputValue(),'');
    assert.doesNotMatch(await page.locator('#studio-export-status').innerText(),/Exported\s+106/);
    await point('#pick-pivot',239,238);await point('#pick-marker',260,132);
    await page.locator('#motion-error').waitFor({state:'visible'});
    assert.equal(await page.locator('#track-motion').isDisabled(),true);
    await screenshot('motion-real-saturated-marker-refused');
    await page.locator('#patch-radius').fill('14');await page.locator('#search-radius').fill('64');
    await page.locator('#sample-step').fill('.04');await point('#pick-marker',260,132);await track();
    const realNotebook=await download('#save-notebook','motion-real-inspected-notebook.json');
    metrics.real={sourceSha256:realNotebook.value.source.sha256,
      measurements:realNotebook.value.measurements.length,
      rejected:realNotebook.value.measurements.filter(row=>row.point===null).length,
      scope:'Rights-cleared recorded double pendulum; tracking inspection only, no exact point truth and no scalar torque export.'};
    await screenshot('motion-real-inspection');
    mark('rights-cleared real recording decodes; saturated marker initialization refuses and explicit wider patch remains inspectable');
  }
  // Exercise the actual input handler in the same rapid order as a dragged scrubber.
  await page.locator('#timeline').evaluate(input=>{
    for(const time of [1,2,3]){input.value=String(time);input.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  await page.waitForFunction(()=>Math.abs(parseFloat(document.getElementById('frame-time').textContent)-3)<.035);
  assert.equal(await page.locator('#motion-error').isVisible(),false);
  mark('rapid timeline seeks settle on the newest actual video frame without a busy-decoder error');
  await page.locator('#patch-radius').fill('7');await page.locator('#search-radius').fill('24');
  await page.locator('#sample-step').fill('.05');await page.locator('#demo-occlusion').uncheck();
  await page.locator('#load-demo').click();
  await page.waitForFunction(()=>document.getElementById('source-name').textContent.includes('clear view'));
  await track();
  assert.ok(Number(await page.locator('#accepted-count').innerText())>=115);
  assert.equal(Number(await page.locator('#gap-count').innerText()),0);
  await screenshot('motion-built-in-demo');
  mark('built-in synthetic example renders, tracks and retains its separate synthetic clock declaration');
  const layouts=[];
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:960});
    const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    assert.ok(size.document<=width,JSON.stringify(size));layouts.push(size);
    if(width===390)await screenshot('motion-mobile');
  }
  metrics.layouts=layouts;mark('source, evidence viewer, inspection and export fit 320–1440px layouts');
  assert.deepEqual(errors,[]);
  assert.deepEqual(await sourceDigests(),sourceManifest.files,'Application source changed while the receiving course was running');
  await writeFile(resolve(artifactDir,'receipt.json'),JSON.stringify({schema:'worldlaw.motion-browser-receipt/v1',
    revision:sourceManifest.referenceCommit,sourceManifest:'source-manifest.json',browser:await browser.version(),checks,metrics,sourceFiles:truth.files,
    recordings:recordings.map(recording=>recording.name),
    scope:'Real Chrome File upload, media decoding, pixel tracking, correction, portable notebook and existing studio import on explicitly synthetic analytic video. This does not qualify arbitrary video, unknown topology, physical torque truth or a live provider.',
    errors},null,2)+'\n');
} catch(error) {
  await writeFile(resolve(artifactDir,'failure.json'),JSON.stringify({error:error.message,stack:error.stack,checks,metrics,errors},null,2)+'\n');
  if(page&&!page.isClosed())await page.screenshot({path:resolve(artifactDir,'motion-failure.png'),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  if(context)await context.close();
  for(const recording of recordings)await recording.video.saveAs(resolve(artifactDir,recording.name));
  if(browser)await browser.close();
  await new Promise(yes=>server.close(yes));
}
