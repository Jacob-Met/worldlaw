import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createChallengeServer} from './trajectory-server-92be.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/trajectory-92be');
const focus=process.env.TRAJECTORY_BROWSER_FOCUS||'';
const focused=['resolution','angular'].includes(focus);
const offlineFile=process.env.TRAJECTORY_OFFLINE_FILE?resolve(process.env.TRAJECTORY_OFFLINE_FILE):null;
await mkdir(dir,{recursive:true});
const server=offlineFile?null:createChallengeServer();if(server)await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
const fixturePath=resolve('examples/trajectory-pendulum-92be.json'),fixtureBytes=await readFile(fixturePath),fixture=JSON.parse(fixtureBytes);
const checks=[],mark=name=>{checks.push(name);console.log('PASS '+name);};
const count=String(fixture.trainingRuns.reduce((n,r)=>n+r.samples.length,0));

async function receiveNewSurfaces(page){
  assert.equal(await page.locator('#resolution-metric').isVisible(),true);
  const initialSensitivity=await page.locator('#step-sensitivity').innerText();assert.ok(Number.isFinite(Number(initialSensitivity)));assert.match(await page.locator('#resolution-note').innerText(),/not a bound/);
  const equation=await page.locator('#selected-equation').innerText(),prediction=await page.locator('#trajectory-chart [data-series="predicted"]').getAttribute('points');
  assert.match(await page.locator('#horizon-heading').innerText(),/all 160 checked samples/);
  await page.locator('#position-tolerance').fill('0.0001');await page.locator('#apply-tolerance').click();assert.equal(await page.locator('#residual-chart [data-horizon-marker]').count(),1);assert.match(await page.locator('#horizon-heading').innerText(),/First sampled breach/);
  assert.equal(await page.locator('#selected-equation').innerText(),equation);assert.equal(await page.locator('#trajectory-chart [data-series="predicted"]').getAttribute('points'),prediction);
  const previousHorizon=await page.locator('#horizon-heading').innerText();await page.locator('#position-tolerance').fill('0');await page.locator('#apply-tolerance').click();await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#horizon-heading').innerText(),previousHorizon);
  await page.locator('#position-tolerance').fill('0.0025');await page.locator('#position-tolerance').press('Enter');
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-notebook').click();const toleranceNotebook=resolve(dir,'trajectory-tolerance-notebook.json');await(await downloadPromise).saveAs(toleranceNotebook);assert.equal(JSON.parse(await readFile(toleranceNotebook,'utf8')).positionTolerance,.0025);
  await page.reload();await page.waitForFunction(()=>document.getElementById('position-tolerance').value==='0.0025');assert.equal(await page.locator('#selected-equation').innerText(),equation);
  mark('numerical step sensitivity is separate from observation error; tolerance changes only the sampled breach check, rejects invalid values and persists');
  const bounded={schema:'worldlaw.trajectory-notebook/v1',bundle:fixture,options:{method:'integral',noiseSigma:.01,maxTerms:4,maxStep:.00005,modelLimit:1}};
  await page.locator('#notebook-file').setInputFiles({name:'budgeted-step-check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bounded))});
  await page.waitForFunction(()=>document.getElementById('step-sensitivity').textContent==='Unavailable',undefined,{timeout:30000});
  const unavailableReason=await page.locator('#resolution-note').innerText();assert.match(unavailableReason,/shared solver budget/);assert.notEqual(await page.locator('#position-rmse').innerText(),'—');assert.equal(await page.locator('#trajectory-chart svg').count(),1);
  await page.locator('#challenge-metrics').screenshot({path:resolve(dir,'trajectory-step-unavailable.png')});
  mark('actual combined solver budget refusal preserves coarse trajectory and labels the unavailable refinement honestly');
  await page.locator('#example-choice').selectOption('ambiguous');await page.locator('#load-example').click();await page.waitForFunction(()=>document.getElementById('source-name').textContent.includes('Small-angle ambiguity'));
  assert.equal(await page.locator('#model-list [aria-pressed="true"]').getAttribute('data-model-id'),'rate+spring');
  const ambiguousRMSE=Number(await page.locator('#position-rmse').innerText());assert.ok(ambiguousRMSE>.1);assert.match(await page.locator('#model-diagnostics').innerText(),/does not isolate a unique explanation/);assert.match(await page.locator('#horizon-heading').innerText(),/0.2 s/);assert.match(await page.locator('#horizon-detail').innerText(),/9 \/ 160 samples/);assert.equal(await page.locator('#residual-chart [data-horizon-marker]').count(),1);
  await page.screenshot({path:resolve(dir,'trajectory-ambiguity-desktop.png'),fullPage:true});
  await page.locator('#model-list [data-model-id="rate+gravity"]').click();const alternativeRMSE=Number(await page.locator('#position-rmse').innerText());assert.ok(alternativeRMSE<ambiguousRMSE/100);assert.equal(await page.locator('#model-list button').first().getAttribute('data-model-id'),'rate+spring');assert.match(await page.locator('#horizon-heading').innerText(),/all 160 checked samples/);
  mark('small-angle scenario exposes wide-angle disagreement at 0.2 s; inspecting sinusoidal alternative improves challenge prediction without reranking');
  await page.locator('#example-choice').selectOption('pendulum');await page.locator('#load-example').click();await page.waitForFunction(label=>document.getElementById('source-name').textContent===label,fixture.label);
  return {initialSensitivity,unavailableReason,ambiguousRMSE,alternativeRMSE,ambiguousFirstSampledBreachSeconds:.2};
}

async function receiveAngularSurface(page){
  const measuredPath=resolve('examples/physical-pasco-92be.json'),measured=JSON.parse(await readFile(measuredPath,'utf8'));
  await page.locator('#example-choice').selectOption('measured');await page.locator('#load-example').click();await page.waitForFunction(()=>document.getElementById('training-count').textContent==='4002');
  await page.waitForFunction(()=>document.getElementById('challenge-workspace').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#challenge-count').innerText(),'2001');assert.match(await page.locator('#source-kind').innerText(),/MEASURED/);assert.match(await page.locator('#selected-equation').innerText(),/^α =/);
  assert.match(await page.locator('#source-description').innerText(),/reused during method development/);assert.match(await page.locator('#scope-heading').innerText(),/separate recording/i);
  assert.equal(await page.locator('#model-list [aria-pressed="true"]').getAttribute('data-model-id'),'coulomb+spring+gravity+bias');
  assert.equal(await page.locator('#prediction-status').isVisible(),true);assert.match(await page.locator('#prediction-status').innerText(),/exceeded numerical execution limits/);assert.equal(await page.locator('#position-rmse').innerText(),'—');
  assert.equal(await page.locator('#trajectory-chart [data-series="observed"]').count(),1);assert.equal(await page.locator('#trajectory-chart [data-series="predicted"]').count(),0);assert.equal(await page.locator('#motion-panel').isVisible(),false);assert.equal(await page.locator('#angular-context').isVisible(),true);assert.equal(await page.locator('#apply-tolerance').isDisabled(),true);
  assert.match(await page.locator('#model-diagnostics').innerText(),/Residual mismatch/);assert.match(await page.locator('#model-diagnostics').innerText(),/35\.4×/);assert.match(await page.locator('#selected-terms').innerText(),/rad\/s²/);
  assert.equal(await page.locator('input[name="method"][value="derivative"]').isDisabled(),true);assert.doesNotMatch(await page.locator('body').innerText(),/N·m|kg·m²/);
  await page.locator('.evidence-details summary').click();assert.equal(await page.locator('#run-list a').count(),3);assert.match(await page.locator('#run-list').innerText(),/Physical inertia unknown/);
  await page.screenshot({path:resolve(dir,'trajectory-measured-failure-desktop.png'),fullPage:true});
  const angularLayouts=[];for(const width of [390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);const dimensions=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(dimensions.document<=width,JSON.stringify(dimensions));angularLayouts.push(dimensions);await page.screenshot({path:resolve(dir,`trajectory-measured-failure-${width}.png`),fullPage:true});await page.locator('.trajectory-stage').screenshot({path:resolve(dir,`trajectory-measured-chart-${width}.png`)});}
  mark('measured angular evidence preserves unknown physical scale, source roles and failed training leader while actual observations remain visible');
  const finiteCandidate=page.locator('#model-list button').filter({hasText:/rad RMSE/}).first();assert.ok(await finiteCandidate.count());await finiteCandidate.click();const finiteModel=await finiteCandidate.getAttribute('data-model-id'),finiteEquation=await page.locator('#selected-equation').innerText(),finiteRMSE=Number((await page.locator('#position-rmse').innerText()).replaceAll(',',''));
  assert.ok(Number.isFinite(finiteRMSE)&&finiteRMSE>1);assert.equal(await page.locator('#trajectory-chart [data-series="predicted"]').count(),1);assert.equal(await page.locator('#prediction-status').isVisible(),false);assert.equal(await page.locator('#motion-panel').isVisible(),false);assert.match(await page.locator('#horizon-heading').innerText(),/First sampled breach/);
  assert.equal(await page.locator('#angular-context #playback-time').isVisible(),true);await page.locator('#playback-time').focus();await page.keyboard.press('End');assert.equal(await page.locator('#sample-time').innerText(),'20');assert.equal(await page.locator('#playback-time').inputValue(),'2000');await page.keyboard.press('Home');await page.locator('#play-pause').click();await page.waitForFunction(()=>Number(document.getElementById('playback-time').value)>0);await page.locator('#play-pause').click();
  await page.locator('#position-tolerance').fill('0.1');await page.locator('#apply-tolerance').click();assert.equal(await page.locator('#selected-equation').innerText(),finiteEquation);
  const downloading=page.waitForEvent('download');await page.locator('#export-notebook').click();const saved=resolve(dir,'trajectory-measured-notebook.json');await(await downloading).saveAs(saved);const notebook=JSON.parse(await readFile(saved,'utf8'));assert.equal(notebook.bundle.schema,'worldlaw.angular-bundle/v1');assert.deepEqual(notebook.bundle.units,measured.units);for(const role of ['trainingRuns','challengeRuns'])for(const [i,run] of notebook.bundle[role].entries()){assert.equal(run.inertia,null);assert.equal(run.dynamics,'unforced_scalar_rotation');assert.deepEqual(run.source,measured[role][i].source);assert.equal(run.initialRate,measured[role][i].initialRate);assert.ok(run.samples.every(sample=>!Object.hasOwn(sample,'command')));}
  await page.reload();await page.waitForFunction(id=>document.querySelector('#model-list [aria-pressed="true"]')?.dataset.modelId===id,finiteModel);assert.equal(await page.locator('#position-tolerance').inputValue(),'0.1');assert.equal(await page.locator('#selected-equation').innerText(),finiteEquation);
  const forged=structuredClone(measured);forged.trainingRuns[0].samples[0].command=0;await page.locator('#bundle-file').setInputFiles({name:'fabricated-command.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#selected-equation').innerText(),finiteEquation);
  await page.locator('#notebook-file').setInputFiles(saved);await page.waitForFunction(()=>document.getElementById('error').hidden);assert.equal(await page.locator('#selected-equation').innerText(),finiteEquation);assert.doesNotMatch(await page.locator('body').innerText(),/N·m|kg·m²/);
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:resolve(dir,'trajectory-measured-finite-alternative.png'),fullPage:true});
  mark('finite angular alternative remains visibly inaccurate; tolerance, portable reopen and invalid-command refusal preserve angular scale and ranking');
  await page.locator('input[name="method"][value="weak"]').check();assert.equal(await page.locator('#noise-unit').innerText(),'rad');assert.equal(await page.locator('#noise-sigma').inputValue(),'.01');await page.locator('#refit').click();await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='WINDOW ANGULAR FIT');
  const weakRMSE=Number(await page.locator('#position-rmse').innerText()),weakEquation=await page.locator('#selected-equation').innerText();assert.ok(Math.abs(weakRMSE-.322967992)<.0001);assert.equal(await page.locator('#model-list [aria-pressed="true"]').getAttribute('data-model-id'),'gravity+bias');assert.match(await page.locator('#model-diagnostics').innerText(),/Residual mismatch/);assert.match(await page.locator('#model-diagnostics').innerText(),/7\.55×/);assert.equal(await page.locator('#training-count').innerText(),'4002');assert.equal(await page.locator('#challenge-count').innerText(),'2001');assert.equal(await page.locator('#position-tolerance').inputValue(),'0.1');assert.equal(await page.locator('#motion-panel').isVisible(),false);assert.doesNotMatch(await page.locator('body').innerText(),/N·m|kg·m²/);
  const weakDownloading=page.waitForEvent('download');await page.locator('#export-notebook').click();const weakSaved=resolve(dir,'trajectory-measured-window-notebook.json');await(await weakDownloading).saveAs(weakSaved);const weakNotebook=JSON.parse(await readFile(weakSaved,'utf8'));assert.equal(weakNotebook.options.method,'weak');assert.deepEqual(weakNotebook.bundle,notebook.bundle);assert.equal(weakNotebook.positionTolerance,.1);
  await page.reload();await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='WINDOW ANGULAR FIT');assert.equal(await page.locator('#selected-equation').innerText(),weakEquation);assert.equal(await page.locator('#position-tolerance').inputValue(),'0.1');
  await page.locator('#bundle-file').setInputFiles(measuredPath);await page.waitForFunction(()=>document.getElementById('prediction-status').hidden===false);assert.equal(await page.locator('#method-badge').innerText(),'ANGULAR ACCELERATION');await page.locator('#notebook-file').setInputFiles(weakSaved);await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='WINDOW ANGULAR FIT');assert.equal(await page.locator('#selected-equation').innerText(),weakEquation);
  await page.screenshot({path:resolve(dir,'trajectory-measured-window-desktop.png'),fullPage:true});await page.setViewportSize({width:320,height:1000});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);await page.locator('.trajectory-stage').screenshot({path:resolve(dir,'trajectory-measured-window-320.png')});await page.setViewportSize({width:1440,height:1100});
  mark('window angular refit improves this reused measured benchmark while retaining training mismatch, source metadata, unknown scale and portable method settings');
  await page.locator('#example-choice').selectOption('pendulum');await page.locator('#load-example').click();await page.waitForFunction(label=>document.getElementById('source-name').textContent===label,fixture.label);assert.match(await page.locator('#selected-equation').innerText(),/^τ =/);assert.equal(await page.locator('input[name="method"][value="derivative"]').isDisabled(),false);assert.equal(await page.locator('#motion-panel').isVisible(),true);
  return {measuredSource:'examples/physical-pasco-92be.json',measuredSha256:createHash('sha256').update(await readFile(measuredPath)).digest('hex'),leaderStatus:'failed_runaway_state',finiteModel,finiteRMSE,weakRMSE,angularLayouts};
}

let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],externalRequests=[];
  if(offlineFile){await context.route(/^https?:\/\//,route=>{externalRequests.push(route.request().url());return route.abort('blockedbyclient');});await context.setOffline(true);}
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(offlineFile?pathToFileURL(offlineFile).href:`http://127.0.0.1:${server.address().port}/trajectory.html`);
  await page.waitForFunction(expected=>document.getElementById('training-count').textContent===expected,count);
  await page.waitForFunction(()=>document.getElementById('challenge-workspace').getAttribute('aria-busy')==='false');
  assert.match(await page.locator('#source-kind').innerText(),/SYNTHETIC/);
  assert.equal(await page.locator('#trajectory-chart svg').count(),1);assert.equal(await page.locator('#trajectory-chart [data-series="observed"]').count(),1);assert.equal(await page.locator('#trajectory-chart [data-series="predicted"]').count(),1);assert.equal(await page.locator('#residual-chart [data-series="residual"]').count(),1);
  assert.ok((await page.locator('#model-list button').count())>1);
  const initialEquation=await page.locator('#selected-equation').innerText(),initialError=await page.locator('#position-rmse').innerText();assert.notEqual(initialError,'—');
  await page.screenshot({path:resolve(dir,'trajectory-desktop.png'),fullPage:true});
  mark('actual paired-run discovery renders observed/predicted trajectories, residuals, metrics and competing executable models');
  const embeddedAngular=offlineFile&&await page.evaluate(()=>Object.hasOwn(globalThis.WORLDLAW_EMBEDDED_EXAMPLES||{},'physical-pasco-92be.json'));
  const featureMetrics={};if(focus!=='angular')Object.assign(featureMetrics,await receiveNewSurfaces(page));if((!offlineFile||embeddedAngular)&&focus!=='resolution')featureMetrics.angular=await receiveAngularSurface(page);
  let secondModel,saved,altered;const layouts=[];
  if(!focused){
  await page.locator('#playback-time').focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#playback-time').inputValue(),await page.locator('#playback-time').getAttribute('max'));
  assert.match(await page.locator('#motion-view').getAttribute('aria-label'),/observed angle.*predicted angle/);
  assert.notEqual(await page.locator('#sample-time').innerText(),'0');
  await page.locator('#play-pause').click();await page.waitForFunction(()=>Number(document.getElementById('playback-time').value)>0);await page.locator('#play-pause').click();
  mark('keyboard scrubbing and playback operate the synchronized observed/predicted motion schematic');
  const firstModel=await page.locator('#model-list button').first().getAttribute('data-model-id');
  await page.locator('#model-list button').nth(1).focus();await page.keyboard.press('Enter');
  secondModel=await page.locator('#model-list [aria-pressed="true"]').getAttribute('data-model-id');assert.notEqual(secondModel,firstModel);assert.notEqual(await page.locator('#selected-equation').innerText(),initialEquation);
  const selectedEquation=await page.locator('#selected-equation').innerText();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-notebook').click();const download=await downloadPromise;saved=resolve(dir,'trajectory-notebook.json');await download.saveAs(saved);
  const notebook=JSON.parse(await readFile(saved,'utf8'));assert.ok(notebook);
  await page.reload();await page.waitForFunction(id=>document.querySelector('#model-list [aria-pressed="true"]')?.dataset.modelId===id,secondModel);assert.equal(await page.locator('#selected-equation').innerText(),selectedEquation);
  await page.locator('#load-example').click();await page.waitForFunction(id=>document.querySelector('#model-list [aria-pressed="true"]')?.dataset.modelId===id,firstModel);
  await page.locator('#notebook-file').setInputFiles(saved);await page.waitForFunction(id=>document.querySelector('#model-list [aria-pressed="true"]')?.dataset.modelId===id,secondModel);
  mark('model inspection never reranks training evidence; export, reload and portable reopen preserve selected model');
  await page.locator('#bundle-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"not-a-trajectory"}')});await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#selected-equation').innerText(),selectedEquation);assert.equal(await page.locator('#training-count').innerText(),count);
  await page.locator('#noise-sigma').fill('0');await page.locator('#refit').click();await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#selected-equation').innerText(),selectedEquation);
  await page.locator('input[name="method"][value="derivative"]').check();assert.equal(await page.locator('#noise-unit').innerText(),'N·m');assert.equal(await page.locator('#noise-sigma').inputValue(),'.01');
  await page.locator('#refit').click();await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='DERIVATIVE FIT');assert.equal(await page.locator('#training-count').innerText(),count);assert.equal(await page.locator('#trajectory-chart svg').count(),1);
  await page.locator('input[name="method"][value="integral"]').check();assert.equal(await page.locator('#noise-unit').innerText(),'rad');await page.locator('#refit').click();await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='INTEGRAL FIT');
  mark('invalid replacement and invalid noise preserve prior result; integral/derivative method controls execute real refits with correct units');
  altered=structuredClone(fixture);altered.label='Challenge-only perturbation';for(const run of altered.challengeRuns)for(let i=1;i<run.samples.length;i++)run.samples[i].position+=.17*Math.sin(i*.13);
  await page.locator('#bundle-file').setInputFiles({name:'challenge-only-change.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(altered))});await page.waitForFunction(()=>document.getElementById('source-name').textContent==='Challenge-only perturbation');
  assert.equal(await page.locator('#selected-equation').innerText(),initialEquation);assert.notEqual(await page.locator('#position-rmse').innerText(),initialError);
  mark('changing only held-out angles changes trajectory error while the learned training equation remains identical');
  await page.locator('#bundle-file').setInputFiles(fixturePath);await page.waitForFunction(label=>document.getElementById('source-name').textContent===label,fixture.label);
  const runCount=await page.locator('#challenge-run option').count();if(runCount>1){const options=await page.locator('#challenge-run option').evaluateAll(nodes=>nodes.map(node=>node.value));await page.locator('#challenge-run').selectOption(options[1]);assert.equal(await page.locator('#selected-equation').innerText(),initialEquation);await page.reload();await page.waitForFunction(id=>document.getElementById('challenge-run').value===id,options[1]);mark('switching challenge recordings preserves learned models and selected run survives browser reload');}
  }
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);const dimensions=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,chart:document.getElementById('trajectory-chart').getBoundingClientRect().width}));assert.ok(dimensions.document<=width,JSON.stringify(dimensions));layouts.push(dimensions);if(width===390||width===320){await page.screenshot({path:resolve(dir,`trajectory-mobile-${width}.png`),fullPage:true});await page.locator('.trajectory-stage').screenshot({path:resolve(dir,`trajectory-chart-${width}.png`)});if(width===320)await page.locator('.comparison-grid').screenshot({path:resolve(dir,'trajectory-comparison-320.png')});}}
  mark('charts, controls and source evidence fit 320, 390, 768, 1024 and 1440 pixel viewports without page overflow');
  if(!focused){
  await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});await page.locator('#model-list button').nth(1).click();assert.match(await page.locator('#storage-status').innerText(),/unavailable or full/);assert.equal(await page.locator('#trajectory-chart svg').count(),1);await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});
  mark('browser quota failure keeps current scientific result usable and gives an honest export recovery message');
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){if(this.name==='delayed.json')await new Promise(resolve=>window.releaseTrajectoryRead=resolve);return original.call(this);};});
  await page.locator('#bundle-file').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(altered))});await page.locator('#notebook-file').setInputFiles(saved);await page.waitForFunction(id=>document.querySelector('#model-list [aria-pressed="true"]')?.dataset.modelId===id,secondModel);await page.evaluate(()=>window.releaseTrajectoryRead());await page.waitForTimeout(150);assert.equal(await page.locator('#source-name').innerText(),fixture.label);
  assert.deepEqual(errors,[]);mark('late file read cannot overwrite a newer notebook and all exercised flows have no JavaScript page errors');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  if(embeddedAngular){const license=await readFile(resolve('examples/physical-pasco-92be/LICENSE'),'utf8');assert.equal(await page.locator('.standalone-license-text').textContent(),license);await page.setViewportSize({width:320,height:1000});await page.locator('#dataset-license summary').click();assert.equal(await page.locator('#dataset-license').getAttribute('open'),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);await page.locator('#dataset-license').screenshot({path:resolve(dir,'trajectory-measured-license-320.png')});await page.locator('#dataset-license summary').click();mark('measured offline delivery preserves the complete Apache 2.0 license and source attribution in an accessible mobile disclosure');}
  if(offlineFile){assert.equal(await page.evaluate(()=>Object.hasOwn(globalThis.WORLDLAW_EMBEDDED_EXAMPLES,'trajectory-pendulum-92be.json')&&Object.hasOwn(globalThis.WORLDLAW_EMBEDDED_EXAMPLES,'trajectory-ambiguous-92be.json')),true);mark('standalone file executes embedded evidence and identical scientific modules with external network blocked and no external requests');}
  const standalone=offlineFile?{path:offlineFile,sha256:createHash('sha256').update(await readFile(offlineFile)).digest('hex'),externalNetworkBlocked:true,externalRequests}:null;
  await writeFile(resolve(dir,offlineFile?'receipt-offline.json':focus==='angular'?'receipt-angular.json':focused?'receipt-resolution.json':'receipt.json'),JSON.stringify({product:'WORLDLAW Trajectory Challenge',browser:await browser.version(),fixture:{path:'examples/trajectory-pendulum-92be.json',sha256:createHash('sha256').update(fixtureBytes).digest('hex')},checks,mode:offlineFile?'offline-file-full-product':focus==='angular'?'targeted-measured-angular':focused?'targeted-resolution-horizon-scenarios':'full-product',standalone,featureMetrics,initialEquation,initialPositionRMSE:initialError,layouts,scope:featureMetrics.angular?'Actual Chromium product receiving using controlled synthetic trajectories and separately recorded PASCO measurements with unknown physical torque scale. The measured benchmark was reused during method development; this is not new blind validation or unique mechanism discovery.':'Actual Chromium product receiving using declared synthetic paired trajectories. This receipt does not claim physical hardware validation or unique mechanism discovery.'},null,2)+'\n');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
