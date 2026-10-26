/** Actual browser handoff of authored pixel notebooks. No video acquisition claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(process.env.WORLDLAW_SOURCE||fileURLToPath(new URL('../',import.meta.url)));
const out=resolve(process.env.BROWSER_ARTIFACT_DIR||join(root,'.receipts/motion-studio-transfer'));
const baselineOnly=process.argv.includes('--baseline-save-only');
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
const paths=['src/motion/app.mjs','src/motion/measurement.mjs','motion.html',...(baselineOnly?[]:['src/motion/studio-export.mjs','src/motion/notebook-output.mjs'])];
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
function formattingFixture(){
  const notebook=createNotebook({source:{kind:'user-supplied',label:'Authored Motion notebook formatting control; not physical evidence',width:128,height:128,duration:1}});
  notebook.measurements=Array.from({length:1000},(_,i)=>({time:i/1000,status:'lost',point:null,quality:{diagnostics:{flags:Array(750).fill(0)}}}));
  return validateNotebook(notebook);
}
const input=notebook=>({name:'authored-motion.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(notebook))});
let browser,context,motion,studio;
const server=createProductServer();await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port;
async function saveReceipt(){await writeFile(join(out,'receipt.json'),JSON.stringify({sourceCommit:process.env.SOURCE_COMMIT||null,sourceHashes,browser:browser?.version(),checks,metrics,errors,
  scope:'Actual maintained browser receiving of authored accepted pixel notebooks and declared synthetic coordinates, including source-only replay and asynchronous export custody. No long-video acquisition, physical law validation, or independent tracking accuracy is claimed.'},null,2)+'\n');}
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
    return {...split,settings:derived.settings,angularRows:angular.samples.map(({time,position})=>[time,position]),
      originalIndices:angular.source.metadata.measurementIndices};
  },{notebook,settings,segmentId});
}
async function transfer(notebook,suffix,{segmentId}={}){
  await openMotion(notebook);await declarations({...options,segment:segmentId??null});
  const original=JSON.stringify(notebook),expected=await expectedDerivation(notebook,options,segmentId);
  const before=await download(motion,'#save-notebook',suffix+'-motion-before.json');
  assert.deepEqual(before.value,notebook);
  const exported=await download(motion,'#export-studio',suffix+'-studio-observations.json',{keyboard:true});
  const parsed=parseObservationText(exported.text),metadata=exported.value.source.metadata;
  assert.equal(metadata.schema,'worldlaw.motion-studio-source/v1');
  assert.deepEqual(exported.value.observations,expected.observations);assert.deepEqual(exported.value.heldOut,expected.heldOut);
  assert.deepEqual(metadata.angularSamples.rows,expected.angularRows);
  assert.deepEqual(metadata.derivation.settings,expected.settings);assert.deepEqual(metadata.derivation.split,expected.split);
  assert.deepEqual(expected.originalIndices,Array.from({length:metadata.measurementRange.count},(_,i)=>metadata.measurementRange.start+i));
  assert.equal(metadata.angularSamples.rows.length,metadata.measurementRange.count);
  assert.ok(JSON.stringify(metadata).length<=250000);
  assert.deepEqual(parsed.observations,expected.observations);assert.deepEqual(parsed.heldOut,expected.heldOut);
  assert.match(await motion.locator('#studio-export-details').innerText(),/notebook/i);
  assert.equal(await motion.locator('#save-studio-source').isVisible(),true);
  const matching=await download(motion,'#save-studio-source',suffix+'-matching-motion.json');
  assert.equal(sha(matching.bytes),metadata.notebookIdentity.sha256);assert.equal(matching.bytes.length,metadata.notebookIdentity.byteLength);
  assert.deepEqual(matching.value,notebook);assert.equal(matching.text,before.text);
  const after=await download(motion,'#save-notebook',suffix+'-motion-after.json');assert.equal(after.text,before.text);
  assert.equal(JSON.stringify(notebook),original);

  await studio.goto(origin);await studio.waitForFunction(()=>document.querySelector('#sample-count')?.textContent);
  await studio.locator('#observation-file').setInputFiles(exported.path);
  await studio.waitForFunction(count=>document.querySelector('#sample-count')?.textContent===String(count),expected.observations.length);
  assert.equal(await studio.locator('#heldout-count').innerText(),String(expected.heldOut.length));
  assert.match(await studio.locator('#source-name').innerText(),/Motion Lab/);
  assert.equal(await studio.locator('#prediction-chart svg').count(),1);assert.ok(await studio.locator('#selected-equation').innerText());
  const saved=await download(studio,'#export-session',suffix+'-studio-session.json');
  assert.deepEqual(saved.value.base.observations,expected.observations);assert.deepEqual(saved.value.base.heldOut,expected.heldOut);
  assert.deepEqual(saved.value.base.source.metadata,metadata);
  await studio.reload();await studio.waitForFunction(count=>document.querySelector('#sample-count')?.textContent===String(count),expected.observations.length);
  await studio.locator('#session-file').setInputFiles(saved.path);
  await studio.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('Reopened the notebook'));
  const reopened=await download(studio,'#export-session',suffix+'-studio-reopened.json');assert.deepEqual(reopened.value,saved.value);
  assert.match(await motion.locator('#motion-notice').innerText(),/^Motion notebook saved/);
  await motion.locator('#notebook-file').setInputFiles(matching.path);
  await motion.waitForFunction(()=>document.querySelector('#motion-notice')?.textContent.includes('reopened'));
  const notebookReopened=await download(motion,'#save-notebook',suffix+'-motion-reopened.json');assert.equal(notebookReopened.text,matching.text);
  const metric={count:notebook.measurements.length,selectedCount:metadata.angularSamples.rows.length,observations:expected.observations.length,
    heldOut:expected.heldOut.length,metadataCodeUnits:JSON.stringify(metadata).length,downloadBytes:exported.bytes.length,
    originalNotebookSHA256:sha(matching.bytes),observationSHA256:sha(JSON.stringify(expected.observations)),
    heldOutSHA256:sha(JSON.stringify(expected.heldOut)),sourceSnapshotsEqual:true};
  metrics.transfers.push(metric);mark(suffix+': real Motion export → exact source snapshot → Studio fit → session and Motion reopen');await saveReceipt();
  return {exported,matching,expected};
}

try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const admission=await context.newPage(),cdp=await context.newCDPSession(admission);
  metrics.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await admission.close();
  motion=await context.newPage();studio=await context.newPage();motion.setDefaultTimeout(20000);studio.setDefaultTimeout(30000);
  for(const [kind,page]of [['motion',motion],['studio',studio]])page.on('pageerror',error=>errors.push({page:kind,message:error.message}));
  await motion.goto(origin+'/motion.html');
  if(baselineOnly){
    const flags=formattingFixture(),original=JSON.stringify(flags);
    assert.equal(sha(original),'65e1a048546c6bd0127a7902ccce49d536c852869c30ee843a2456038ee04dcf');
    await openMotion(flags);const saved=await download(motion,'#save-notebook','baseline-343-save.json');
    assert.deepEqual(saved.value,flags);assert.ok(saved.bytes.length>8*1024*1024,'Original baseline did not reproduce the oversized save defect.');
    await motion.locator('#notebook-file').setInputFiles(saved.path);await motion.locator('#motion-error').waitFor({state:'visible'});
    assert.match(await motion.locator('#motion-error').innerText(),/at most 8 MB/);
    assert.equal(await motion.locator('#source-name').innerText(),flags.source.label);
    metrics.baseline={inputSHA256:sha(original),inputBytes:Buffer.byteLength(original),savedSHA256:sha(saved.bytes),savedBytes:saved.bytes.length,
      actualReaderRefusal:await motion.locator('#motion-error').innerText(),scope:'Expected original product defect observed through actual Save and Open controls.'};
    await motion.bringToFront();await motion.locator('#motion-error').scrollIntoViewIfNeeded();
    await motion.locator('#motion-error').screenshot({path:join(out,'baseline-343-refusal.jpg'),type:'jpeg',quality:75,animations:'disabled'});
    mark('original accepted #343 notebook saves a file exceeding its own actual reader cap');assert.deepEqual(errors,[]);await saveReceipt();
  }else{
  await transfer(authored(1000),'authored-1000');await transfer(authored(4000),'authored-4000');
  mark('largest supported row count preserves every selected angular sample without binary encoding, rounding or downsampling');

  const flags=formattingFixture(),flagText=JSON.stringify(flags);
  assert.equal(sha(flagText),'65e1a048546c6bd0127a7902ccce49d536c852869c30ee843a2456038ee04dcf');
  assert.ok(Buffer.byteLength(JSON.stringify(flags,null,2)+'\n')>8*1024*1024);
  await openMotion(flags);const savedFlags=await download(motion,'#save-notebook','formatting-343-saved.json');
  assert.deepEqual(savedFlags.value,flags);assert.ok(savedFlags.bytes.length<=8*1024*1024);
  assert.match(await motion.locator('#motion-notice').innerText(),/^Motion notebook saved/);
  await motion.locator('#notebook-file').setInputFiles(savedFlags.path);
  await motion.waitForFunction(()=>document.querySelector('#gap-count')?.textContent==='1000'&&document.querySelector('#motion-notice')?.textContent.startsWith('Notebook reopened with its evidence'));
  assert.equal(await motion.locator('#motion-error').isVisible(),false);
  const resavedFlags=await download(motion,'#save-notebook','formatting-343-reopened.json');assert.equal(resavedFlags.text,savedFlags.text);
  metrics.formatting={originalCompactSHA256:sha(flagText),prettyBytes:Buffer.byteLength(JSON.stringify(flags,null,2)+'\n'),savedBytes:savedFlags.bytes.length,savedSHA256:sha(savedFlags.bytes)};
  mark('exact #343 1000-row / 750-flag source saves below the real file cap and reopens without losing diagnostics');

  const unicode=createNotebook({source:{kind:'user-supplied',label:'Authored Unicode notebook; not physical evidence',width:128,height:128,duration:1}});
  unicode.measurements=Array.from({length:1000},(_,i)=>({time:i/1000,status:'lost',point:null,quality:{note:'測'.repeat(1200)}}));
  const validUnicode=validateNotebook(unicode);assert.ok(Buffer.byteLength(JSON.stringify(validUnicode))>2000000);
  await openMotion(validUnicode);const unicodeSaved=await download(motion,'#save-notebook','unicode-saved.json');assert.deepEqual(unicodeSaved.value,validUnicode);
  assert.match(await motion.locator('#motion-notice').innerText(),/^Motion notebook saved/);
  await motion.locator('#notebook-file').setInputFiles(unicodeSaved.path);
  await motion.waitForFunction(()=>document.querySelector('#gap-count')?.textContent==='1000'&&document.querySelector('#motion-notice')?.textContent.startsWith('Notebook reopened with its evidence'));
  assert.equal(await motion.locator('#motion-error').isVisible(),false);
  const oversized={...validUnicode,extra:'x'.repeat(2000000)};
  await motion.locator('#notebook-file').setInputFiles({name:'oversized-normalized.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oversized))});
  await motion.locator('#motion-error').waitFor({state:'visible'});assert.match(await motion.locator('#motion-error').innerText(),/portable JSON limit/);
  const afterRefusal=await download(motion,'#save-notebook','unicode-after-refusal.json');assert.equal(afterRefusal.text,unicodeSaved.text);
  mark('Unicode is preserved by the byte-aware save contract; oversized normalized input refuses without replacing accepted evidence');

  // Exercise the existing pixel tracker on the product's own labeled synthetic
  // raster sequence, independently of the imported long-notebook controls.
  await motion.locator('#demo-occlusion').uncheck();await motion.locator('#load-demo').click();
  await motion.waitForFunction(()=>document.querySelector('#source-name')?.textContent==='Synthetic marked pendulum / clear view');
  await motion.locator('#sample-step').fill('.05');await motion.locator('#search-radius').fill('32');await motion.locator('#track-until').fill('1.5');
  await motion.locator('#track-motion').click();await motion.locator('#cancel-tracking').waitFor({state:'visible'});
  await motion.locator('#cancel-tracking').waitFor({state:'hidden',timeout:60000});
  assert.equal(await motion.locator('#motion-error').isVisible(),false);
  const tracked=await download(motion,'#save-notebook','normal-demo-tracked.json');
  assert.equal(tracked.value.source.kind,'synthetic-video');
  assert.ok(tracked.value.measurements.filter(row=>row.status==='accepted').length>=24,'Existing synthetic tracker did not retain enough actual accepted frames.');
  await declarations(options);const demoExpected=await expectedDerivation(tracked.value),demoExport=await download(motion,'#export-studio','normal-demo-studio.json');
  assert.deepEqual(demoExport.value.observations,demoExpected.observations);assert.deepEqual(demoExport.value.heldOut,demoExpected.heldOut);
  const demoSource=await download(motion,'#save-studio-source','normal-demo-matching-source.json');assert.deepEqual(demoSource.value,tracked.value);
  assert.equal(sha(demoSource.bytes),demoExport.value.source.metadata.notebookIdentity.sha256);
  metrics.tracker={kind:'maintained synthetic generated raster sequence',originalRows:tracked.value.measurements.length,
    acceptedRows:tracked.value.measurements.filter(row=>row.status==='accepted').length,sourceSHA256:sha(demoSource.bytes),observations:demoExpected.observations.length};
  mark('maintained synthetic demo actually tracks source pixels and passes a short-course Studio export without a video-acquisition claim');

  // Defer completion of the real digest; inputs, numerical science and browser
  // controls remain the maintained implementation. Fault mode only rejects this
  // controlled asynchronous boundary to test stale-error retirement.
  await motion.evaluate(()=>{
    const original=SubtleCrypto.prototype.digest;
    window.__motionDigest={armed:false,pending:null,active:0,settled:0};
    SubtleCrypto.prototype.digest=async function(...args){
      const gate=window.__motionDigest;gate.active++;
      try{const result=await original.apply(this,args);
        if(gate.armed){gate.armed=false;return await new Promise((resolve,reject)=>{gate.pending={resolve:()=>resolve(result),reject:()=>reject(new Error('Authored digest failure at deferred boundary'))};});}
        return result;
      }finally{gate.active--;gate.settled++;}
    };
  });
  const downloads=[];motion.on('download',file=>downloads.push(file.suggestedFilename()));
  for(const change of ['source','segment','inertia','command','sigma','confirmation'])for(const outcome of ['resolve','reject']){
    const notebook=authored(64,{label:'Authored async custody '+change+' '+outcome,split:true});await openMotion(notebook);await declarations({...options,segment:0});
    await motion.evaluate(()=>{window.__motionDigest.armed=true;window.__motionDigest.pending=null;});
    const before=downloads.length;await motion.locator('#export-studio').click();await motion.waitForFunction(()=>window.__motionDigest.pending!==null);
    if(change==='source'){
      await motion.evaluate(()=>{const native=window.__motionUngatedFileText??=File.prototype.text;window.__releaseNewerMotionRead=null;File.prototype.text=async function(){if(this.name==='held-newer-motion.json')await new Promise(resolve=>window.__releaseNewerMotionRead=resolve);return native.call(this);};});
      const newer=authored(71,{label:'Newer source owns '+outcome});
      await motion.locator('#notebook-file').setInputFiles({...input(newer),name:'held-newer-motion.json'});
      await motion.waitForFunction(()=>typeof window.__releaseNewerMotionRead==='function');
    }
    else if(change==='segment')await motion.locator('#segment-select').selectOption('1');
    else if(change==='confirmation')await motion.locator('#confirm-physics').uncheck();
    else await motion.locator({'inertia':'#known-inertia','command':'#declared-command','sigma':'#position-sigma'}[change]).fill({'inertia':'2.1','command':'.4','sigma':'.002'}[change]);
    const current={source:await motion.locator('#source-name').innerText(),status:await motion.locator('#studio-export-status').innerText(),notice:await motion.locator('#motion-notice').innerText()};
    await motion.evaluate(kind=>window.__motionDigest.pending[kind](),outcome);
    await motion.waitForFunction(()=>window.__motionDigest.active===0);
    await motion.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,25));await new Promise(requestAnimationFrame);});
    assert.equal(downloads.length,before,'Retired '+change+' '+outcome+' downloaded a stale file');
    assert.equal(await motion.locator('#studio-export-status').innerText(),current.status);
    assert.equal(await motion.locator('#motion-notice').innerText(),current.notice);
    assert.equal(await motion.locator('#source-name').innerText(),current.source);
    assert.equal(await motion.locator('#save-studio-source').isVisible(),false);
    assert.equal(await motion.locator('#motion-error').isVisible(),false,'Stale digest error surfaced after '+change);
    if(change==='source'){
      await motion.evaluate(()=>window.__releaseNewerMotionRead());
      await motion.waitForFunction(label=>document.querySelector('#source-name')?.textContent===label,'Newer source owns '+outcome);
      assert.equal(downloads.length,before);
    }
    metrics.races.push({change,outcome,downloadCount:downloads.length-before,retainedSource:current.source});
    await saveReceipt();
  }
  mark('new source, segment, inertia, command, noise and confirmation retire pending digest success/error before download or status changes');

  // Current failure must still be visible and must preserve the accepted source.
  const recovery=authored(100,{label:'Authored current-failure recovery'});await openMotion(recovery);await declarations(options);
  await motion.evaluate(()=>{window.__motionDigest.armed=true;window.__motionDigest.pending=null;});const beforeFailure=downloads.length;
  await motion.locator('#export-studio').click();await motion.waitForFunction(()=>window.__motionDigest.pending!==null);
  await motion.evaluate(()=>window.__motionDigest.pending.reject());await motion.locator('#motion-error').waitFor({state:'visible'});
  assert.match(await motion.locator('#motion-error').innerText(),/digest failure/);assert.equal(downloads.length,beforeFailure);
  const savedRecovery=await download(motion,'#save-notebook','current-failure-source.json');assert.deepEqual(savedRecovery.value,recovery);
  await declarations(options);const recovered=await download(motion,'#export-studio','current-failure-recovered.json');assert.ok(recovered.value.observations.length>0);
  mark('current digest failure remains visible, preserves evidence, and permits an ordinary successful retry');

  const scope=motion.locator('.motion-export-panel');
  for(const width of [1440,390]){
    await motion.setViewportSize({width,height:1000});await studio.setViewportSize({width,height:1000});
    assert.ok(await motion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await studio.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await motion.bringToFront();await scope.scrollIntoViewIfNeeded();
    await scope.screenshot({path:join(out,'motion-handoff-'+width+'.jpg'),type:'jpeg',quality:75,animations:'disabled'});
    await studio.bringToFront();await studio.locator('#prediction-chart').scrollIntoViewIfNeeded();
    await studio.screenshot({path:join(out,'studio-received-'+width+'.jpg'),type:'jpeg',quality:75,animations:'disabled',fullPage:false});
  }
  await motion.locator('#save-studio-source').focus();assert.equal(await motion.locator('#save-studio-source').evaluate(node=>document.activeElement===node),true);
  mark('actual Motion custody controls and received Studio result render at desktop/390px with keyboard focus and reduced motion');
  assert.deepEqual(errors,[]);await saveReceipt();
  }
}catch(error){metrics.failure={message:error.message,stack:error.stack};await saveReceipt();throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
