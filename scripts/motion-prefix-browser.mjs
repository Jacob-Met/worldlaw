/** Maintained Motion intake receiving: adopted source-prefix rates, not new estimation.
 * Uses packaged examples/motion-prefix notebooks; MOTION_PREFIX_NOTEBOOK_DIR
 * optionally overrides that directory. The upstream authored movies were decoded/tracked
 * in that course; this receiver reopens their notebooks, not the movie acquisition.
 * --baseline-only demonstrates the original UI's missing-rate refusal.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(process.env.WORLDLAW_SOURCE||fileURLToPath(new URL('../',import.meta.url)));
const out=resolve(process.env.BROWSER_ARTIFACT_DIR||join(root,'.receipts/motion-prefix'));
const baselineOnly=process.argv.includes('--baseline-only');
const load=path=>import(pathToFileURL(join(root,path)).href);
const [{createProductServer},{createNotebook,calibrateNotebook,validateNotebook},{requireChromiumSandbox},{chromium}]=await Promise.all([
 load('server.mjs'),load('src/motion/measurement.mjs'),load('scripts/support/chromium-sandbox.mjs'),import(process.env.PLAYWRIGHT_MODULE||'playwright')]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
await mkdir(out,{recursive:true});
const notebookDir=resolve(process.env.MOTION_PREFIX_NOTEBOOK_DIR||join(root,'examples/motion-prefix'));
const pinned={training:{file:'fit-plane-notebook.json',hash:'a3ae4cec3a031e86d557b13ff623f1068fddf441761fd97a127882cd88dd8953',movie:'5a27a92fe35d38e54f303b8299693f630223c6d252076b52820cb4e302e66d7c'},
 challenge:{file:'challenge-plane-notebook.json',hash:'2b4e1759e3b85632167d16fc3d635ac353e4eebb27e96e7728df079ffc520371',movie:'1740ff6d082d562f7b35bbb1d28e6eaaf5f0de1198d23721fb369912a59ad3c9'}};
const sourceHashes=Object.fromEntries(await Promise.all(['src/trajectory/motion-intake.mjs','src/trajectory/motion-intake-panel.mjs','src/trajectory/app.mjs','src/trajectory/session.mjs','src/science/angular-prelude.mjs','src/motion/measurement.mjs','trajectory.css'].map(async path=>[path,sha(await readFile(join(root,path)))])));
const records={};
for(const [role,pin]of Object.entries(pinned)){
 const bytes=await readFile(join(notebookDir,pin.file));assert.equal(sha(bytes),pin.hash);
 const notebook=JSON.parse(bytes);assert.equal(notebook.source.sha256,pin.movie);
 assert.ok(notebook.measurements.every(row=>row.timeBasis==='decoded-media-time'));
 const path=join(out,role+'-original-motion.json');await writeFile(path,bytes);records[role]={path,bytes,notebook};
}
const checks=[],errors=[],requests=[],metrics={sources:Object.fromEntries(Object.entries(records).map(([role,r])=>[role,{inputSha256:sha(r.bytes),inputBytes:r.bytes.length,sourceSha256:r.notebook.source.sha256,count:r.notebook.measurements.length}])),cases:[]};
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const server=createProductServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin='http://127.0.0.1:'+server.address().port;let browser,page;
const settings={origin:30,windowSize:17}; // Fixed before loading or scoring either source.
async function receipt(){await writeFile(join(out,'receipt.json'),JSON.stringify({sourceCommit:process.env.SOURCE_COMMIT||null,baselineOnly,sourceHashes,browser:browser?.version(),settings,checks,metrics,errors,requests,
 scope:'Actual Motion notebook intake and trajectory consumer. Pinned authored decoded-video notebooks retain upstream tracked/manual evidence; analytical controls are authored coordinates only. No new acquisition, physical validation, calibrated uncertainty or independent prospective reference claim. Portable sessions reuse the explicitly adopted scalar; they do not re-estimate it.'},null,2)+'\n');}
async function download(selector,name){const wait=page.waitForEvent('download');await page.locator(selector).focus();await page.keyboard.press('Enter');const result=await wait,path=join(out,name);await result.saveAs(path);const bytes=await readFile(path),text=bytes.toString('utf8');return{path,bytes,text,value:JSON.parse(text)};}
async function intake(){await page.goto(origin+'/trajectory.html');await page.waitForFunction(()=>document.getElementById('refit')&&!document.getElementById('refit').disabled);await page.locator('#motion-intake-panel > summary').click();}
async function openRecord(role,record){await page.locator('#motion-'+role+'-file').setInputFiles({name:role+'-source.json',mimeType:'application/json',buffer:record.bytes});await page.waitForFunction(role=>!document.getElementById('motion-'+role+'-course').disabled,role);assert.equal(await page.locator('#motion-intake-error').isVisible(),false);await page.locator('#motion-'+role+'-kind').selectOption('synthetic');}
async function openPair(pair){for(const role of ['training','challenge'])await openRecord(role,pair[role]);}
async function assumptions(){await page.locator('#motion-unforced').check();await page.locator('#motion-shared-frame').check();await page.locator('#motion-assumption-basis').fill('Authored synthetic courses with declared unforced scalar dynamics and shared angular frame. No physical independence or calibrated tracking confidence is claimed.');}
async function supplied(pair){for(const role of ['training','challenge']){if(!baselineOnly)await page.locator('#motion-'+role+'-start-mode').selectOption('supplied');await page.locator('#motion-'+role+'-rate').fill(String(pair[role].rate));await page.locator('#motion-'+role+'-rate-basis').fill('Independent authored analytic derivative at the first original source sample; not a measured sensor rate.');}await assumptions();}
async function prefix(role,{originIndex=settings.origin,windowSize=settings.windowSize,sigma,course}={}){const p='#motion-'+role+'-';await page.locator(p+'start-mode').selectOption('source-prefix');if(course!==undefined)await page.locator(p+'course').selectOption(String(course));await page.locator(p+'start-index').fill(String(originIndex+1));await page.locator(p+'start-window').selectOption(String(windowSize));await page.locator(p+'start-sigma').fill(sigma===undefined?'':String(sigma));await page.waitForFunction(role=>!document.getElementById('motion-'+role+'-start-confirm').disabled,role);assert.match(await page.locator(p+'start-rate').innerText(),/rad\/s/);assert.equal(await page.locator(p+'start-confirm').isChecked(),false);await page.locator(p+'start-confirm').check();}
async function apply(name){await assumptions();assert.equal(await page.locator('#motion-compare').isEnabled(),true);await page.locator('#motion-compare').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('motion-intake-status').textContent.startsWith('Separate Motion recordings loaded.')||!document.getElementById('motion-intake-error').hidden);assert.equal(await page.locator('#motion-intake-error').isVisible(),false,await page.locator('#motion-intake-error').textContent());assert.equal(await page.locator('#error').isVisible(),false);const saved=await download('#export-notebook',name+'.json');assert.equal(await page.locator('#trajectory-chart svg').count(),1);assert.ok(await page.locator('#selected-equation').innerText());return saved;}
async function expected(record,{originIndex=settings.origin,windowSize=settings.windowSize,sigma,course=0}={}){
 // Deliberately use the unchanged angular export and estimator, never the new
 // preview or createMotionAngularBundle helper to generate receiving expectations.
 return page.evaluate(async({notebook,originIndex,windowSize,sigma,course})=>{
  const {exportAngular}=await import('/src/motion/measurement.mjs');const {estimateAngularPrelude}=await import('/src/science/angular-prelude.mjs');
  const angular=exportAngular(notebook,{segmentId:course}),samples=angular.samples,indices=angular.source.metadata.measurementIndices;
  const prefix=samples.slice(originIndex-windowSize+1,originIndex+1).map(({time,position,positionSigma})=>({time,position,positionSigma}));
  const positionSigma=sigma===undefined?Math.max(...prefix.map(row=>row.positionSigma)):sigma;
  const report=estimateAngularPrelude(prefix,samples[originIndex],{windowSizes:[windowSize],positionSigma});
  return {prefix,indices:indices.slice(originIndex-windowSize+1,originIndex+1),origin:{courseSampleIndex:originIndex,measurementIndex:indices[originIndex],time:samples[originIndex].time,position:samples[originIndex].position},
   suffix:samples.slice(originIndex).map(({time,position})=>({time,position})),suffixIndices:indices.slice(originIndex),course:angular.source.metadata.selectedSegment,report,
   referenceConditioning:angular.source.metadata.referenceConditioning||null};
 },{notebook:record.notebook,originIndex,windowSize,sigma,course});
}
async function checkPrefix(saved,pair,label,options={}){const result={label,roles:{}};for(const role of ['training','challenge']){
 const record=pair[role],run=saved.value.bundle[role+'Runs'][0],motion=run.source.motion,prep=motion.initialRate.preparation,exp=await expected(record,options);
 assert.equal(run.kind,'synthetic');assert.equal(motion.inputSha256,sha(record.bytes));assert.equal(motion.inputByteLength,record.bytes.length);assert.equal(motion.originalVideo.sha256,record.notebook.source.sha256);
 assert.deepEqual(motion.calibration,record.notebook.calibration);assert.equal(prep.schema,'worldlaw.motion-source-prefix/v1');assert.equal(prep.mode,'source-prefix');assert.deepEqual(prep.prefixSamples,exp.prefix);assert.deepEqual(prep.prefixSourceIndices,exp.indices);assert.deepEqual(prep.origin,exp.origin);assert.deepEqual(prep.settings,exp.report.settings);
 assert.deepEqual(prep.estimate,{rate:exp.report.estimates[0].rate,rateSigma:exp.report.estimates[0].rateSigma,conditionEstimate:exp.report.estimates[0].conditionEstimate,localResidualScale:exp.report.estimates[0].localResidualScale});
 assert.equal(run.initialRate,exp.report.estimates[0].rate);assert.equal(motion.initialRate.value,run.initialRate);assert.deepEqual(run.samples,exp.suffix);assert.deepEqual(motion.observationIndices,exp.suffixIndices);
 const course=clone(exp.course);delete course.sourceIndices;assert.deepEqual(motion.selectedCourse,course);assert.match(prep.persistence,/does not re-estimate/);assert.match(prep.qualification,/original forecast-origin angle/);
 if(exp.referenceConditioning)assert.deepEqual(motion.reference.conditioning,exp.referenceConditioning);
 assert.equal(prep.noise.origin,options.sigma===undefined?'maximum_motion_window_sigma':'caller_override');
 assert.equal(await page.locator('#'+role+'-count').innerText(),String(run.samples.length));
 result.roles[role]={rate:run.initialRate,rateSigma:prep.estimate.rateSigma,prefixSha256:sha(JSON.stringify(prep.prefixSamples)),prefixSourceIndices:prep.prefixSourceIndices,originalCourseCount:motion.selectedCourse.count,retainedSamples:run.samples.length,origin:prep.origin,noise:prep.noise};
 }metrics.cases.push(result);return result;}
async function inspectSession(saved){return page.evaluate(async text=>{const {restoreChallenge}=await import('/src/trajectory/session.mjs');const state=restoreChallenge(text),selected=state.discovery.selected,result=state.results.find(r=>r.modelId===selected.id&&r.runId===state.bundle.challengeRuns[0].id);return{selected,summary:state.summary,status:result.status,rows:result.rollout?.rows.map(({time,predicted,rate})=>({time,predicted,rate})),metrics:result.rollout?.metrics};},saved.text);}
async function reopen(saved,name){await page.locator('#notebook-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.getElementById('notice').textContent.startsWith('Notebook reopened.'));assert.equal(await page.locator('#error').isVisible(),false);const again=await download('#export-notebook',name+'-reopened.json');assert.deepEqual(again.value,saved.value);return again;}
async function capture(name,selector){
 await page.bringToFront();const forecast=selector==='#trajectory-chart',target=page.locator(forecast?'.trajectory-stage':selector);
 await target.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 // Let actual resize/scroll observers repaint before capturing the foreground page.
 await page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
 const options={path:join(out,name+'.jpg'),type:'jpeg',quality:75,animations:'disabled'};
 if(forecast){
  await page.waitForFunction(()=>{const svg=document.querySelector('#trajectory-chart svg');if(!svg)return false;const r=svg.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&svg.querySelector('[data-series=observed]')?.points.length>2&&svg.querySelector('[data-series=predicted]')?.points.length>2;});
  metrics.captures??={};metrics.captures[name]=await page.locator('#trajectory-chart svg').evaluate(svg=>{const r=svg.getBoundingClientRect();return{width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,observedPoints:svg.querySelector('[data-series=observed]').points.length,predictedPoints:svg.querySelector('[data-series=predicted]').points.length};});
  await target.screenshot(options);
 }else await page.screenshot({...options,fullPage:false});
}
function authored(role,{future=false,gap=false}={}){const A=role==='training'?.95:-.65,B=role==='training'?.4:.8,truth=Array.from({length:501},(_,i)=>{const time=i*.02,shape=A*Math.cos(2*time)+B*Math.sin(2*time),position=Math.exp(-.12*time)*shape;return{time,position:position+(future && i>settings.origin ? .35+.05*Math.sin(i*.17) : 0),rate:Math.exp(-.12*time)*(-.12*shape-2*A*Math.sin(2*time)+2*B*Math.cos(2*time))};});
 const payload={kind:'authored-analytic-coordinate-control',role,future,gap,samples:truth},sourceText=JSON.stringify(payload);
 const notebook=calibrateNotebook(createNotebook({source:{kind:'synthetic',label:role+' authored point control'+(future?' altered later receiving angles':'')+(gap?' with a real lost row':''),width:640,height:480,duration:10,sha256:sha(sourceText),metadata:{scope:'Authored analytic coordinates, not decoded video. Source SHA binds the retained authored JSON payload.'}}}),{pivot:{x:320,y:80},pixelSigma:0,maxGapSeconds:.04});
 notebook.measurements=truth.map((row,i)=>({time:row.time,requestedTime:row.time,timeBasis:'synthetic-time',status:gap&&i===20?'lost':'manual',point:gap&&i===20?null:{x:320+220*Math.sin(row.position),y:80+220*Math.cos(row.position)},reason:'Authored isolation control; no decoder or tracker was run.'}));
 const valid=validateNotebook(notebook),bytes=Buffer.from(JSON.stringify(valid));return{notebook:valid,bytes,rate:truth[0].rate,sourceText};}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),admission=await context.newPage(),cdp=await context.newCDPSession(admission);metrics.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await admission.close();page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin))requests.push(request.url());});
 await intake();await openPair(records);await assumptions();await page.locator('#motion-compare').click();await page.locator('#motion-intake-error').waitFor({state:'visible'});assert.match(await page.locator('#motion-intake-error').innerText(),/Supply the starting rate/);metrics.missingRate=await page.locator('#motion-intake-error').innerText();mark('Actual pinned Motion inputs reach the existing unknown-starting-rate refusal');
 if(baselineOnly){assert.equal(await page.locator('#motion-training-start-mode').count(),0);await capture('baseline-missing-rate','#motion-intake-error');}
 else{
  for(const role of ['training','challenge'])await prefix(role);
  // A real number-input transient must not silently become the blank/default noise assumption.
  await page.locator('#motion-training-start-sigma').focus();await page.keyboard.press('-');
  const badInput=await page.locator('#motion-training-start-sigma').evaluate(node=>({value:node.value,badInput:node.validity.badInput}));
  assert.equal(badInput.value,'');assert.equal(badInput.badInput,true,'The browser did not create the intended native badInput state.');
  assert.equal(await page.locator('#motion-training-start-confirm').isDisabled(),true);assert.equal(await page.locator('#motion-compare').isDisabled(),true);
  await prefix('training');metrics.invalidNoise=badInput;mark('Actual transient invalid numeric noise cannot silently fall back to declared source error');
  // Click an actual point on the rendered original-course curve, then return to
  // the predeclared origin before scoring. This is a real mouse action, not a DOM edit.
  await page.locator('#motion-challenge-start-chart').scrollIntoViewIfNeeded();
  const clickTarget=await page.locator('#motion-challenge-start-chart').evaluate(svg=>{const point=svg.querySelector('.motion-start-original').points.getItem(40),screen=new DOMPoint(point.x,point.y).matrixTransform(svg.getScreenCTM());return{x:screen.x,y:screen.y};});
  await page.mouse.click(clickTarget.x,clickTarget.y);assert.equal(await page.locator('#motion-challenge-start-index').inputValue(),'41');assert.equal(await page.locator('#motion-challenge-start-confirm').isChecked(),false);assert.equal(await page.locator('#motion-challenge-start-chart .motion-start-prefix').evaluate(node=>node.points.length),17);
  await prefix('challenge');mark('Rendered source-curve click selects the matching one-based sample and revokes adoption');
  const pinnedSession=await apply('pinned-prefix-session');await checkPrefix(pinnedSession,records,'pinned decoded-video notebooks');await reopen(pinnedSession,'pinned-prefix');metrics.pinnedReceiving=await inspectSession(pinnedSession);assert.equal(metrics.pinnedReceiving.status,'ok');assert.match(metrics.pinnedReceiving.summary.limitations.join(' '),/does not re-estimate/);mark('Pinned decoded-video Motion notebooks reach the frozen-law consumer with exact adopted rates, original source hashes and selected prefix/suffix');
  await capture('prefix-desktop','#motion-training-start-chart');await capture('forecast-desktop','#trajectory-chart');await page.setViewportSize({width:390,height:844});await page.locator('#motion-challenge-start-index').focus();assert.equal(await page.evaluate(()=>document.activeElement.id),'motion-challenge-start-index');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await capture('prefix-narrow','#motion-challenge-start-chart');await capture('forecast-narrow','#trajectory-chart');await page.setViewportSize({width:1440,height:1000});mark('Desktop and 390px origin selection and receiving views captured with keyboard access');
  // Delay one genuine native digest. The original result is returned unchanged.
  // While applying the old pair, edit and re-adopt a new origin. Re-enablement of
  // Apply proves the obsolete async attempt finished before we inspect its result.
  await page.evaluate(()=>{const subtle=crypto.subtle,original=subtle.digest.bind(subtle),gate={armed:true,entered:false,release:null};globalThis.__motionPrefixDigestGate=gate;const wait=new Promise(resolve=>gate.release=resolve);gate.restore=()=>{subtle.digest=original;};subtle.digest=async(...args)=>{const held=gate.armed;if(held){gate.armed=false;gate.entered=true;}const value=await original(...args);if(held)await wait;return value;};});
  await assumptions();await page.locator('#motion-compare').click();await page.waitForFunction(()=>globalThis.__motionPrefixDigestGate?.entered);
  await prefix('challenge',{originIndex:32});assert.equal(await page.locator('#motion-compare').isDisabled(),true);
  await page.evaluate(()=>globalThis.__motionPrefixDigestGate.release());await page.waitForFunction(()=>!document.getElementById('motion-compare').disabled);
  await page.evaluate(()=>{globalThis.__motionPrefixDigestGate.restore();delete globalThis.__motionPrefixDigestGate;});
  assert.equal(await page.locator('#motion-intake-error').isVisible(),false);assert.match(await page.locator('#motion-intake-status').innerText(),/^Prepared inputs changed/);assert.deepEqual((await download('#export-notebook','retired-pending-pair.json')).value,pinnedSession.value);await prefix('challenge');mark('Changed and re-adopted origin retires a pending actual pair digest without replacing the accepted session');
  await page.locator('#motion-challenge-start-window').selectOption('19');assert.equal(await page.locator('#motion-challenge-start-confirm').isChecked(),false);assert.equal(await page.locator('#motion-compare').isDisabled(),true);await prefix('challenge');
  await page.locator('#motion-challenge-start-index').fill('5');assert.match(await page.locator('#motion-challenge-start-preview').innerText(),/complete trailing window/);assert.equal(await page.locator('#motion-challenge-start-confirm').isDisabled(),true);assert.equal(await page.locator('#motion-compare').isDisabled(),true);assert.deepEqual((await download('#export-notebook','invalid-prefix-retained.json')).value,pinnedSession.value);
  await openRecord('challenge',records.challenge);assert.equal(await page.locator('#motion-challenge-start-mode').inputValue(),'supplied');assert.equal(await page.locator('#motion-challenge-start-confirm').isChecked(),false);mark('Changed settings revoke adoption; incomplete prefix refuses without replacing the loaded result; new source resets the start choice');
  for(const role of ['training','challenge']){await page.goto(origin+'/motion.html');await page.locator('#notebook-file').setInputFiles(records[role].path);await page.waitForFunction(()=>document.getElementById('motion-notice').textContent.startsWith('Notebook reopened'));assert.equal(await page.locator('#motion-error').isVisible(),false);const saved=await download('#save-notebook',role+'-motion-resaved.json');assert.deepEqual(saved.value,records[role].notebook);await page.locator('#notebook-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.getElementById('motion-notice').textContent.startsWith('Notebook reopened'));assert.deepEqual((await download('#save-notebook',role+'-motion-reopened.json')).value,records[role].notebook);}
  mark('Original Motion files actually reopen and Save/reopen without measurement, calibration or source mutation');
  const analytic={training:authored('training'),challenge:authored('challenge')};for(const[role,r]of Object.entries(analytic)){await writeFile(join(out,role+'-authored-source.json'),r.sourceText);await writeFile(join(out,role+'-authored-motion.json'),r.bytes);}
  await intake();await openPair(analytic);await supplied(analytic);const legacy=await apply('legacy-supplied-session');for(const role of ['training','challenge']){const run=legacy.value.bundle[role+'Runs'][0];assert.equal(run.initialRate,analytic[role].rate);assert.equal(run.source.motion.initialRate.preparation,undefined);assert.equal(run.samples.length,501);}await reopen(legacy,'legacy-supplied');mark('Existing supplied-rate flow and portable replay preserve the independently declared rate');
  for(const role of ['training','challenge'])await prefix(role,{sigma:0});const original=await apply('authored-prefix-session');await checkPrefix(original,analytic,'authored analytic isolation',{sigma:0});const originalState=await inspectSession(original);assert.equal(originalState.status,'ok');await reopen(original,'authored-prefix');
  const changed=authored('challenge',{future:true});await writeFile(join(out,'future-control-authored-source.json'),changed.sourceText);await writeFile(join(out,'future-control-motion.json'),changed.bytes);await openRecord('challenge',changed);await prefix('challenge',{sigma:0});const altered=await apply('future-control-session');await checkPrefix(altered,{training:analytic.training,challenge:changed},'all strictly later receiving angles changed',{sigma:0});const changedState=await inspectSession(altered);
  assert.deepEqual(altered.value.bundle.trainingRuns,original.value.bundle.trainingRuns);assert.deepEqual(altered.value.bundle.challengeRuns[0].source.motion.initialRate.preparation,original.value.bundle.challengeRuns[0].source.motion.initialRate.preparation);assert.equal(altered.value.bundle.challengeRuns[0].initialRate,original.value.bundle.challengeRuns[0].initialRate);assert.deepEqual(changedState.selected,originalState.selected);assert.deepEqual(changedState.rows,originalState.rows);assert.notEqual(changedState.metrics.positionRMSE,originalState.metrics.positionRMSE);assert.notEqual(altered.value.bundle.challengeRuns[0].source.motion.inputSha256,original.value.bundle.challengeRuns[0].source.motion.inputSha256);
  metrics.futureControl={changedLaterSamples:470,originalRMSE:originalState.metrics.positionRMSE,changedRMSE:changedState.metrics.positionRMSE,originalForecastSHA256:sha(JSON.stringify(originalState.rows)),changedForecastSHA256:sha(JSON.stringify(changedState.rows)),adoptedRate:original.value.bundle.challengeRuns[0].initialRate};mark('All 470 later authored angles change receiving error but leave chosen prefix, adopted rate, training law and exact frozen predictions unchanged');
  const gap=authored('challenge',{gap:true});await writeFile(join(out,'gapped-authored-source.json'),gap.sourceText);await writeFile(join(out,'gapped-motion.json'),gap.bytes);await openRecord('challenge',gap);await page.locator('#motion-challenge-start-mode').selectOption('source-prefix');await page.locator('#motion-challenge-course').selectOption('1');await page.locator('#motion-challenge-start-index').fill('10');await page.locator('#motion-challenge-start-window').selectOption('17');assert.match(await page.locator('#motion-challenge-start-preview').innerText(),/complete trailing window/);assert.equal(await page.locator('#motion-challenge-start-confirm').isDisabled(),true);assert.equal(await page.locator('#motion-compare').isDisabled(),true);assert.deepEqual((await download('#export-notebook','gapped-prefix-retained.json')).value,altered.value);mark('Chosen course cannot borrow earlier points across an original lost measurement; rejected prefix preserves the current result');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);mark('No uncaught page errors or external requests');await receipt();console.log(JSON.stringify({checks:checks.length,artifactDirectory:out,metrics},null,2));
}catch(error){metrics.failure={message:error.message,stack:error.stack};await receipt();throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
