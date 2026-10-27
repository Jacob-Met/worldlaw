/** Actual browser handoff of authored pixel notebooks. No video acquisition claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(process.env.WORLDLAW_SOURCE||fileURLToPath(new URL('../',import.meta.url)));
process.chdir(root); // Keep maintained server defaults bound to the selected complete source tree.
const out=resolve(process.env.BROWSER_ARTIFACT_DIR||join(root,'.receipts/motion-derivative-review'));
const load=relative=>import(pathToFileURL(join(root,relative)).href);
const [{createProductServer},{createNotebook,calibrateNotebook,validateNotebook},
  {parseObservationText},{requireChromiumSandbox},{chromium}]=await Promise.all([
  load('server.mjs'),load('src/motion/measurement.mjs'),load('src/data.mjs'),
  load('scripts/support/chromium-sandbox.mjs'),import(process.env.PLAYWRIGHT_MODULE||'playwright'),
]);
await mkdir(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const checks=[],metrics={transfers:[],races:[]},errors=[];
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const paths=['server.mjs','motion.html','motion.css','src/motion/app.mjs','src/motion/measurement.mjs','src/motion/studio-export.mjs','src/motion/notebook-output.mjs','src/science/trajectory-observations.mjs','src/science/angular-kinematics.mjs','scripts/support/chromium-sandbox.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha(await readFile(join(root,path)))])));
const options={inertia:1.37,command:.125,positionSigma:null,windowSize:7,confirmKnownDynamics:true};

function authored(count,{label='Authored '+count+'-row point notebook; no acquired video',split=false}={}){
  const source={kind:'synthetic',label,width:640,height:480,duration:Math.ceil(count*.05+3),
    metadata:{scope:'Analytic marker points with authored diagnostics. No pixels were decoded or tracked in this course.',unicode:'測定の保存 — μ'}};
  const notebook=calibrateNotebook(createNotebook({source}),{pivot:{x:311,y:101},zeroAngle:.13,direction:-1,pixelSigma:.72,maxGapSeconds:.08});
  notebook.measurements=Array.from({length:count},(_,i)=>{
    const time=i*.05+(split&&i>=Math.floor(count/2)?1:0),angle=.43*Math.cos(1.7*time)+.07*Math.sin(.31*time);
    return {time,requestedTime:time,timeBasis:'synthetic-time',status:i%83===0?'manual':'accepted',
      point:{x:311+189*Math.sin(angle),y:101+189*Math.cos(angle)},
      quality:{score:.991,runnerUpScore:.72,ambiguityMargin:.271,textureStd:37,searchClipped:false},
      tracker:{version:'worldlaw.patch-ncc/v1',patchRadius:12,searchRadius:24,anchorTime:0,
        anchorPoint:{x:311+189*Math.sin(.43),y:101+189*Math.cos(.43)}}};
  });
  return validateNotebook(notebook);
}
const input=notebook=>({name:'authored-motion.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(notebook))});
let browser,context,motion,studio;
const server=createProductServer();await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port;
async function saveReceipt(){await writeFile(join(out,'receipt.json'),JSON.stringify({sourceCommit:process.env.SOURCE_COMMIT||null,sourceHashes,browser:browser?.version(),checks,metrics,errors,
  scope:'Actual maintained browser receiving of authored accepted pixel notebooks and declared synthetic coordinates, including source-only replay and asynchronous export custody. Window 7/11 receiving and window 15 refusal on authored 40-row evidence. No video acquisition, physical law validation, or independent tracking accuracy is claimed.'},null,2)+'\n');}
async function openMotion(notebook){
  await motion.locator('#notebook-file').setInputFiles(input(notebook));
  await motion.waitForFunction(label=>document.querySelector('#source-name')?.textContent===label,notebook.source.label);
  assert.equal(await motion.locator('#motion-error').isVisible(),false);
}
async function declarations({segment=null,...settings}=options){
  await motion.locator('#studio-export-details').evaluate(node=>node.open=true);
  if(segment!==null)await motion.locator('#segment-select').selectOption(String(segment));
  await motion.locator('#known-inertia').fill(String(settings.inertia));
  await motion.locator('#declared-command').fill(String(settings.command));
  await motion.locator('#position-sigma').fill(settings.positionSigma===null?'':String(settings.positionSigma));
  await motion.locator('#derivative-window').selectOption(String(settings.windowSize));
  await motion.locator('#confirm-physics').check();
  assert.equal(await motion.locator('#export-studio').isEnabled(),true);
}
async function download(page,selector,name,{keyboard=false}={}){
  const pending=page.waitForEvent('download');
  if(keyboard){await page.locator(selector).focus();await page.keyboard.press('Enter');}
  else await page.locator(selector).click();
  const file=await pending,path=join(out,name);await file.saveAs(path);const bytes=await readFile(path),text=bytes.toString('utf8');
  return {path,bytes,text,value:JSON.parse(text),suggestedFilename:file.suggestedFilename()};
}
async function expectedDerivation(notebook,settings=options,segmentId){
  // Reconstruct through the pre-existing angular and derivative consumers,
  // independently of prepareStudioExport's new envelope/serialization logic.
  return motion.evaluate(async({notebook,settings,segmentId})=>{
    const {exportAngular}=await import('/src/motion/measurement.mjs');
    const {deriveTorqueObservations,splitTrajectoryEvidence}=await import('/src/science/trajectory-observations.mjs');
    const angular=exportAngular(notebook,{command:settings.command,...(segmentId===undefined?{}:{segmentId})});
    const positionSigma=settings.positionSigma??Math.max(...angular.samples.map(row=>row.positionSigma));
    const derived=deriveTorqueObservations(angular.samples,{inertia:settings.inertia,positionSigma,windowSize:settings.windowSize});
    const split=splitTrajectoryEvidence(derived,{trainingFraction:.7});
    return {...split,settings:derived.settings,diagnostics:derived.diagnostics,angularRows:angular.samples.map(({time,position})=>[time,position]),
      originalIndices:angular.source.metadata.measurementIndices};
  },{notebook,settings,segmentId});
}
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const admission=await context.newPage(),cdp=await context.newCDPSession(admission);
  metrics.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await admission.close();
  motion=await context.newPage();studio=await context.newPage();motion.setDefaultTimeout(20000);studio.setDefaultTimeout(30000);
  for(const [kind,page]of [['motion',motion],['studio',studio]])page.on('pageerror',error=>errors.push({page:kind,message:error.message}));
  await motion.goto(origin+'/motion.html');
  const notebook=authored(40,{label:'Authored 40-row derivative-window control; no acquired video'});
  // Authored timestamp declarations exercise the supported clock field without
  // claiming any actual decoded movie, frame acquisition or calibrated sensor.
  for(const row of notebook.measurements)row.timeBasis='decoded-media-time';
  await openMotion(notebook);
  assert.equal(await motion.locator('#derivative-window').inputValue(),'7');
  const original=await download(motion,'#save-notebook','original-motion.json');
  const review=motion.locator('#studio-derivative-review');
  const reviewTexts=[];
  for(const windowSize of [7,11]) {
    await declarations({...options,windowSize});
    await motion.locator('#review-studio').focus();await motion.keyboard.press('Enter');
    assert.equal(await motion.locator('#motion-error').isVisible(),false);
    assert.equal(await review.isVisible(),true);
    const reviewText=await review.innerText();assert.ok(reviewText.trim().length>50);
    assert.match(reviewText,/noise|sigma|σ/i);assert.match(reviewText,/held.out|check/i);
    reviewTexts.push(reviewText);
    const expected=await expectedDerivation(notebook,{...options,windowSize});
    assert.equal(expected.observations.length,28-windowSize+1);
    assert.equal(expected.heldOut.length,12-windowSize+1);
    const values={window:windowSize,input:40,output:expected.diagnostics.outputCount,
      edges:expected.diagnostics.droppedEdges,training:expected.observations.length,
      'held-out':expected.heldOut.length,crossing:expected.split.excludedCrossingWindows,
      'torque-sigma':expected.diagnostics.maxTorqueSigma,'noise-gain':expected.diagnostics.maxTorqueNoiseGain,
      'angle-sigma':expected.settings.positionSigma};
    for(const [field,value]of Object.entries(values)){
      const cell=review.locator(`[data-derivative-field="${field}"]`);
      assert.equal(await cell.count(),1,`Missing unique review field ${field}`);
      assert.equal(Number(await cell.getAttribute('data-value')),value,`Incorrect review field ${field}`);
      assert.ok((await cell.innerText()).trim(),`Unreadable review field ${field}`);
    }
    assert.equal(await review.locator('[data-derivative-field="noise-origin"]').getAttribute('data-value'),'maximum_declared_angular_sigma');
    for(const field of ['input','output','training','held-out','crossing'])
      assert.equal((await review.locator(`[data-derivative-field="${field}"]`).innerText()).trim(),String(values[field]));
    assert.equal((await review.locator('[data-derivative-field="window"]').innerText()).trim(),`${windowSize} angle samples`);
    assert.equal((await review.locator('[data-derivative-field="edges"]').innerText()).trim(),`${values.edges} at each end`);
    for(const [field,unit]of [['angle-sigma','rad'],['torque-sigma','N·m'],['noise-gain','N·m/rad']]){
      const visible=(await review.locator(`[data-derivative-field="${field}"]`).innerText()).trim();
      assert.ok(visible.endsWith(' '+unit),`Wrong visible unit for ${field}: ${visible}`);
      const numeric=visible.slice(0,-unit.length).trim();
      assert.match(numeric,/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i);
      const expected=values[field],shown=Number(numeric);
      const tolerance=expected===0?0:0.50001*10**(Math.floor(Math.log10(Math.abs(expected)))-3);
      assert.ok(Math.abs(shown-expected)<=tolerance,`Wrong visible ${field}: ${visible}; expected ${expected}`);
    }
    assert.equal((await review.locator('[data-derivative-field="noise-origin"]').innerText()).trim(),'Maximum from declared point noise');


    const exported=await download(motion,'#export-studio',`window-${windowSize}.json`,{keyboard:true});
    const meta=exported.value.source.metadata;
    assert.deepEqual(exported.value.observations,expected.observations);
    assert.deepEqual(exported.value.heldOut,expected.heldOut);
    assert.equal(meta.derivation.settings.windowSize,windowSize);
    assert.deepEqual(meta.derivation.split,expected.split);
    const matching=await download(motion,'#save-studio-source',`window-${windowSize}-source.json`);
    assert.equal(matching.text,original.text);assert.equal(sha(matching.bytes),meta.notebookIdentity.sha256);
    const {replayStudioExport,verifyStudioExportSource,prepareStudioExport}=await load('src/motion/studio-export.mjs');
    replayStudioExport(exported.value); // Exact retained-angular replay remains mandatory in Node.
    const browserSourceVerification=await motion.evaluate(async({dataset,notebookText})=>{
      const {verifyStudioExportSource}=await import('/src/motion/studio-export.mjs');
      return verifyStudioExportSource(dataset,notebookText);
    },{dataset:exported.value,notebookText:matching.text});
    metrics.sourceReplay??=[];
    const probe={windowSize,browser:browser.version(),node:process.version,nodeVersions:process.versions,browserSourceVerification,nodeFullSource:'pass',differences:[]};
    try{await verifyStudioExportSource(exported.value,matching.text);}
    catch(error){
      assert.equal(error.message,'Motion Studio source snapshot replay does not match its retained inputs.');
      const metadata=exported.value.source.metadata;
      const prepared=await prepareStudioExport(JSON.parse(matching.text),{
        inertia:metadata.dynamics.inertia,command:metadata.dynamics.command,
        windowSize:metadata.derivation.settings.windowSize,segmentId:metadata.selectedSegment.id,
        ...(metadata.noise.origin==='caller_override'?{positionSigma:metadata.noise.value}:{}),confirmKnownDynamics:true});
      function compare(a,b,path=[]){
        if(Object.is(a,b))return;
        if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
          assert.equal(Array.isArray(a),Array.isArray(b),'Replay container type changed');
          const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();assert.deepEqual(ak,bk,'Replay keys changed at '+path.join('.'));
          for(const key of ak)compare(a[key],b[key],[...path,key]);return;
        }
        const field=path.join('.');
        assert.ok(/^source\.metadata\.angularSamples\.rows\.\d+\.1$/.test(field)||/^(observations|heldOut)\.\d+\.(position|rate|jointTorque)$/.test(field),'Unexpected replay difference: '+field);
        assert.ok(typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b),'Nonfinite or nonnumeric replay difference');
        probe.differences.push({path:field,node:a,browser:b,absolute:Math.abs(a-b)});
      }
      compare(prepared.dataset,exported.value);
      assert.ok(probe.differences.length>0,'Failed replay without inspectable numeric differences');
      probe.nodeFullSource='unqualified';probe.error=error.message;
      probe.maxAbsoluteDifference=Math.max(...probe.differences.map(row=>row.absolute));
      probe.qualification='Exact browser full-source replay and Node retained-angular replay passed; cross-runtime full-source replay is unqualified. Numeric differences are recorded without tolerance acceptance.';
    }
    metrics.sourceReplay.push(probe);
    await studio.goto(origin);await studio.locator('#observation-file').setInputFiles(exported.path);
    await studio.waitForFunction(n=>document.querySelector('#sample-count')?.textContent===String(n),expected.observations.length);
    const saved=await download(studio,'#export-session',`window-${windowSize}-session.json`);
    assert.deepEqual(saved.value.base.source.metadata,meta);
    await studio.locator('#session-file').setInputFiles(saved.path);
    await studio.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('Reopened the notebook'));
    const reopened=await download(studio,'#export-session',`window-${windowSize}-reopened.json`);assert.deepEqual(reopened.value,saved.value);
    metrics.transfers.push({windowSize,training:expected.observations.length,heldOut:expected.heldOut.length,reviewText,sourceHash:sha(matching.bytes)});
    mark(`window ${windowSize}: keyboard review, exact download, source identity, exact browser source replay, Node angular replay and Studio reopen (Node full-source qualification recorded separately)`);
  }
  assert.notEqual(reviewTexts[0],reviewTexts[1]);
  await motion.locator('#derivative-window').selectOption('15');
  assert.equal(await motion.locator('#save-studio-source').isVisible(),false);
  assert.equal(await motion.locator('#confirm-physics').isChecked(),false);
  assert.ok(!await review.isVisible() || (await review.innerText())!==reviewTexts[1],'Old review survives changed window');
  await motion.locator('#confirm-physics').check();await motion.locator('#review-studio').click();
  await motion.locator('#motion-error').waitFor({state:'visible'});
  assert.match(await motion.locator('#motion-error').innerText(),/short|guard|held.out|support/i);
  assert.equal(await motion.locator('#derivative-window').inputValue(),'15');
  const downloads=[];motion.on('download',file=>downloads.push(file.suggestedFilename()));
  await motion.locator('#export-studio').click();await motion.locator('#motion-error').waitFor({state:'visible'});
  assert.equal(downloads.length,0);assert.equal(await motion.locator('#save-studio-source').isVisible(),false);
  mark('unsupported window refuses review and export without fallback or stale source');
  await declarations({...options,windowSize:7,positionSigma:0});await motion.locator('#review-studio').click();
  const zero=await download(motion,'#export-studio','zero-noise.json');
  assert.equal(zero.value.source.metadata.derivation.diagnostics.maxTorqueSigma,0);
  assert.ok(zero.value.source.metadata.derivation.diagnostics.maxTorqueNoiseGain>0);
  assert.equal(zero.value.source.metadata.derivation.settings.positionSigma,0);
  assert.equal(Number(await review.locator('[data-derivative-field="torque-sigma"]').getAttribute('data-value')),0);
  assert.equal(Number(await review.locator('[data-derivative-field="angle-sigma"]').getAttribute('data-value')),0);
  assert.equal(Number(await review.locator('[data-derivative-field="noise-gain"]').getAttribute('data-value')),zero.value.source.metadata.derivation.diagnostics.maxTorqueNoiseGain);
  assert.equal(await review.locator('[data-derivative-field="noise-origin"]').getAttribute('data-value'),'caller_override');
  assert.equal((await review.locator('[data-derivative-field="noise-origin"]').innerText()).trim(),'Your angle-noise override');
  assert.equal((await review.locator('[data-derivative-field="torque-sigma"]').innerText()).trim(),'0 N·m');
  assert.equal((await review.locator('[data-derivative-field="angle-sigma"]').innerText()).trim(),'0 rad');
  assert.match(await review.innerText(),/0/);mark('explicit zero-noise assumption preserves positive amplification');
  await motion.evaluate(()=>{const original=SubtleCrypto.prototype.digest;window.__motionDigest={armed:false,pending:null,active:0};SubtleCrypto.prototype.digest=async function(...args){const gate=window.__motionDigest;gate.active++;try{const result=await original.apply(this,args);if(gate.armed){gate.armed=false;return await new Promise((resolve,reject)=>{gate.pending={resolve:()=>resolve(result),reject:()=>reject(new Error('Authored delayed digest failure'))};});}return result;}finally{gate.active--;}};});
  for(const outcome of ['resolve','reject']){
    await declarations({...options,windowSize:7});
    await motion.evaluate(()=>{window.__motionDigest.armed=true;window.__motionDigest.pending=null;});
    const before=downloads.length;await motion.locator('#export-studio').click();
    await motion.waitForFunction(()=>window.__motionDigest.pending!==null);
    await motion.locator('#derivative-window').selectOption('11');
    const status=await motion.locator('#studio-export-status').innerText();
    await motion.evaluate(kind=>window.__motionDigest.pending[kind](),outcome);
    await motion.waitForFunction(()=>window.__motionDigest.active===0);
    await motion.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,25));await new Promise(requestAnimationFrame);});
    assert.equal(downloads.length,before);assert.equal(await motion.locator('#studio-export-status').innerText(),status);
    assert.equal(await motion.locator('#motion-error').isVisible(),false);assert.equal(await motion.locator('#save-studio-source').isVisible(),false);
    metrics.races.push({change:'window',outcome,staleDownloads:downloads.length-before});
  }
  mark('changed window retires deferred hash success and error');
  await declarations({...options,windowSize:11});await motion.locator('#review-studio').click();
  for(const width of [1440,390]){
    await motion.setViewportSize({width,height:1000});await motion.locator('#review-studio').focus();
    assert.equal(await motion.locator('#review-studio').evaluate(node=>document.activeElement===node),true);
    assert.ok(await motion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const assertScreenshotState=async()=>{
      for(const [field,value,label]of [['window',11,'11 angle samples'],['training',18,'18'],['held-out',2,'2']]){
        const cell=review.locator(`[data-derivative-field="${field}"]`);
        assert.equal(await cell.getAttribute('data-value'),String(value));
        assert.equal((await cell.innerText()).trim(),label);
      }
    };
    await review.scrollIntoViewIfNeeded();
    await assertScreenshotState();
    await review.screenshot({path:join(out,`derivative-review-values-${width}.png`),animations:'disabled'});
    await assertScreenshotState();
    await motion.locator('.motion-export-panel').screenshot({path:join(out,`derivative-review-${width}.png`),animations:'disabled'});
  }
  const finalSource=await download(motion,'#save-notebook','unchanged-motion.json');assert.equal(finalSource.text,original.text);
  mark('desktop and narrow keyboard review preserves original notebook bytes');
  assert.deepEqual(errors,[]);await saveReceipt();
}catch(error){metrics.failure={message:error.message,stack:error.stack};await saveReceipt();throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
