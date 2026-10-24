// Actual original-video receiving plus explicitly authored refusal/custody controls.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
import {createMotionReferenceCase} from '../src/motion/reference.mjs';

const [videoPath,notebookPath,referencePath,outputPath]=process.argv.slice(2);
if(!outputPath)throw Error('Usage: node scripts/motion-reference-browser.mjs ORIGINAL_VIDEO NOTEBOOK REFERENCE NEW_OUTPUT');
const out=resolve(outputPath);await mkdir(out); // Do not overwrite an earlier receiving run.
const {chromium}=await import(process.env.PLAYWRIGHT_PATH||'playwright');
const notebookBytes=await readFile(notebookPath),referenceBytes=await readFile(referencePath),videoBytes=await readFile(videoPath);
const notebook=JSON.parse(notebookBytes),reference=JSON.parse(referenceBytes),raw=createMotionReferenceCase(notebook,reference);
const sha=value=>createHash('sha256').update(value).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
assert.equal(sha(videoBytes),notebook.source.sha256);assert.deepEqual(reference.tracks[0].labels.map(x=>x.t),[2,4,6,8]);
const oracle=reference.tracks[0].labels.map(mark=>{const retained=notebook.measurements.find(row=>row.time===mark.t);return {time:mark.t,error:Math.hypot(retained.point.x-mark.x,retained.point.y-mark.y),radius:mark.uncertainty_px,score:retained.quality.score};});
const server=createProductServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin=`http://127.0.0.1:${server.address().port}`;
const report={groups:[],source_sha256:sha(videoBytes),notebook_sha256:sha(notebookBytes),reference_sha256:sha(referenceBytes),oracle,source_files:{},errors:[],offsite:[],boundary:'Four separately visually marked original frames; fallible authored radii, not blind ground truth or full trajectory accuracy. Other altered cases below are explicit software controls.'};
const files=['motion.html','motion-reference.html','motion-reference.css','server.mjs','src/motion/reference-app.mjs','src/motion/reference.mjs','src/motion/measurement.mjs','src/motion/video.mjs','src/motion/vendor/reference-admission.mjs','src/motion/vendor/reference-source.json','scripts/motion-reference-browser.mjs'];
for(const file of files)report.source_files[file]=sha(await readFile(new URL('../'+file,import.meta.url)));
const record=text=>{report.groups.push(text);console.log('PASS '+text);};let browser;
const watch=page=>{page.on('pageerror',error=>report.errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)report.offsite.push(request.url());});};
const uploadJSON=(page,id,value,name='input.json')=>page.locator(id).setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
const status=(page,text)=>page.waitForFunction(text=>document.getElementById('notice').textContent.includes(text),text);
async function open(page,value,name='case.json'){await uploadJSON(page,'#case-file',value,name);await status(page,'Comparison recomputed');}
async function attach(page){await page.locator('#source-file').setInputFiles(videoPath);await page.waitForFunction(()=>document.getElementById('source-state').textContent.startsWith('Matching original video attached'));}
async function frame(page,time){await page.waitForFunction(time=>{const c=document.getElementById('source-canvas');return document.getElementById('frame-empty').hidden&&c.dataset.timeBasis==='decoded-media-time'&&Math.abs(Number(c.dataset.frameTime)-time)<.000001;},time);}
async function selectTime(page,time){await page.getByRole('button',{name:`Inspect ${time.toFixed(6)} seconds`,exact:true}).click();await frame(page,time);}
async function download(page,id,name){const pending=page.waitForEvent('download');await page.locator(id).click();const receipt=await pending;assert.equal(await receipt.failure(),null);const path=resolve(out,name);await receipt.saveAs(path);return {path,value:JSON.parse(await readFile(path,'utf8'))};}
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY||'/usr/local/bin/google-chrome',chromiumSandbox:true,args:['--no-first-run']});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true}),page=await context.newPage();watch(page);
  await page.goto(origin+'/motion.html');await page.locator('a[href="/motion-reference.html"]').click();await page.waitForURL('**/motion-reference.html');
  await page.locator('#notebook-file').setInputFiles(notebookPath);await page.locator('#reference-file').setInputFiles(referencePath);await page.waitForFunction(()=>!document.getElementById('compare').disabled);
  assert.equal(await page.locator('#results').isVisible(),false);await page.locator('#compare').click();await status(page,'Comparison recomputed');
  assert.equal(await page.locator('#scored-count').textContent(),'4');assert.equal(Number(await page.locator('#unscored-count').textContent()),notebook.measurements.length-4);assert.equal(await page.locator('#comparison-rows tr').count(),4);
  await attach(page);await frame(page,2);assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'true');assert.equal(await page.locator('#source-canvas').getAttribute('data-reference-visible'),'true');
  for(const t of [4,6,8])await selectTime(page,t);await page.screenshot({path:resolve(out,'original-desktop.png'),fullPage:true});
  record('ordinary Motion link, explicit dual-input admission and all four original decoded frames display separate retained and marked positions');

  const saved=await download(page,'#save-case','raw-inputs.json'),derived=await download(page,'#save-report','derived-report.json');
  assert.deepEqual(saved.value.notebook,notebook);assert.deepEqual(saved.value.reference,reference);assert.equal(saved.value.comparison,undefined);
  const scored=derived.value.tracks[0].rows.filter(r=>r.status==='scored');assert.equal(scored.length,4);
  for(let i=0;i<4;i++){assert.ok(Math.abs(scored[i].error_px-oracle[i].error)<1e-12);assert.equal(scored[i].error_lower_px,Math.max(0,oracle[i].error-oracle[i].radius));assert.equal(scored[i].error_upper_px,oracle[i].error+oracle[i].radius);assert.equal(scored[i].pixel_match_score,oracle[i].score);}
  await open(page,{...saved.value,comparison:{tracks:[{summary:{scored:999},rows:[{error_px:0}]}]}});assert.equal(await page.locator('#scored-count').textContent(),'4');
  await page.locator('#row-filter').selectOption('all');assert.equal(await page.locator('#comparison-rows tr').count(),50);await page.locator('#next-page').click();assert.match(await page.locator('#page-status').textContent(),/^51–100 of /);await page.locator('#row-filter').selectOption('labeled');
  record('completed raw and report downloads preserve the entire ledger, recompute forged answers and retain independent pixel-distance oracles with bounded row pagination');

  const offset=clone(raw);offset.reference.annotation.method='Authored +40 px offset control to show disagreement despite a high recorded pixel-match score; not a natural-scene mark.';offset.reference.tracks[0].labels[0].x+=40;
  const retained2=notebook.measurements.find(row=>row.time===2).point,offsetMark=offset.reference.tracks[0].labels[0],offsetError=Math.hypot(retained2.x-offsetMark.x,retained2.y-offsetMark.y);assert.ok(offsetError>35);
  await open(page,offset);await frame(page,2);assert.ok((await page.locator('#selected-decision').textContent()).includes(`Distance ${offsetError.toFixed(3)} px`));assert.ok((await page.locator('#selected-detail').textContent()).includes(oracle[0].score.toFixed(6)));assert.equal(await page.locator('#source-canvas').getAttribute('data-reference-visible'),'true');await page.screenshot({path:resolve(out,'offset-control-desktop.png'),fullPage:true});
  record('an explicit offset reference remains visibly far from a high-score retained point; the marking interval does not borrow score confidence');

  const gaps=clone(raw);gaps.notebook.measurements=gaps.notebook.measurements.filter(r=>[2,4,6,8].includes(r.time));
  gaps.notebook.measurements[0].timeBasis='requested-seek-time';gaps.notebook.measurements[1].candidatePoint=gaps.notebook.measurements[1].point;gaps.notebook.measurements[1].point=null;gaps.notebook.measurements[1].status='lost';
  gaps.reference.annotation.method='Authored missing-position, nominal-clock, nearby-frame and hidden-mark software controls.';gaps.reference.tracks[0].labels[2].frame_t=6.04;Object.assign(gaps.reference.tracks[0].labels[3],{status:'unidentifiable'});delete gaps.reference.tracks[0].labels[3].x;delete gaps.reference.tracks[0].labels[3].y;
  await open(page,gaps);await frame(page,2);assert.equal(await page.locator('#scored-count').textContent(),'0');assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'false');assert.equal(await page.locator('#source-canvas').getAttribute('data-reference-visible'),'true');
  await selectTime(page,4);assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'false');assert.match(await page.locator('#selected-decision').textContent(),/no accepted position/);
  await page.getByRole('button',{name:'Inspect 6.000000 seconds',exact:true}).click();await frame(page,6.04);assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'false');assert.equal(await page.locator('#source-canvas').getAttribute('data-reference-visible'),'true');assert.match(await page.locator('#selected-decision').textContent(),/different reference frame/);
  await selectTime(page,8);assert.equal(await page.locator('#source-canvas').getAttribute('data-reference-visible'),'false');assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'true');
  record('nominal clocks, rejected candidates, different decoded frames and unidentifiable labels remain unscored with independently gated source overlays');

  const paired=clone(raw);paired.notebook.schema='worldlaw.motion-notebook/v2';paired.notebook.calibration.pivotMode='tracked';paired.notebook.measurements=paired.notebook.measurements.filter(r=>[2,4].includes(r.time));
  for(const row of paired.notebook.measurements)row.pivotMeasurement={status:row.time===2?'lost':'accepted',point:row.time===2?null:clone(paired.notebook.calibration.pivot)};
  paired.notebook.measurements[1].point=null;paired.notebook.measurements[1].status='lost';paired.reference.tracks[0].labels=paired.reference.tracks[0].labels.slice(0,2);
  paired.reference.annotation.method='Authored paired-observation and fixed-declaration UI control; pivot marks use the declared coordinate, not an independent measurement.';
  paired.reference.tracks.push({id:'pivot',labels:paired.reference.tracks[0].labels.map(label=>({...label,...paired.notebook.calibration.pivot,uncertainty_px:2}))});
  await open(page,paired);await page.locator('#target').selectOption('1');await selectTime(page,4);assert.equal(await page.locator('#scored-count').textContent(),'1');assert.equal(await page.locator('#source-canvas').getAttribute('data-observation-visible'),'true');assert.match(await page.locator('#selected-detail').textContent(),/Separately recorded pivot position/);
  const fixed=clone(paired);fixed.notebook.schema='worldlaw.motion-notebook/v1';fixed.notebook.calibration.pivotMode='fixed';for(const row of fixed.notebook.measurements)delete row.pivotMeasurement;
  await open(page,fixed);await page.locator('#target').selectOption('1');await frame(page,2);assert.match(await page.locator('#target-kind').textContent(),/fixed location declared/);assert.match(await page.locator('#source-canvas').getAttribute('aria-label'),/Fixed pivot declaration shown/);
  record('marker and pivot gaps stay independent, and fixed-pivot comparisons keep their declaration identity in the visible source view');

  const bad=clone(fixed);bad.reference.source.sha256='0'.repeat(64);await uploadJSON(page,'#case-file',bad);await page.waitForFunction(()=>!document.getElementById('error').hidden);assert.equal(await page.locator('#target').inputValue(),'1');assert.match(await page.locator('#source-state').textContent(),/^Matching original/);
  await page.locator('#source-file').setInputFiles({name:'different-original.webm',mimeType:'video/webm',buffer:Buffer.concat([videoBytes,Buffer.from([0])])});await page.waitForFunction(()=>document.getElementById('error').textContent.includes('video SHA-256'));assert.equal(await page.locator('#target').inputValue(),'1');assert.match(await page.locator('#source-state').textContent(),/previously verified source remains attached/);
  await open(page,raw);await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){return this.name==='delayed-case.json'?new Promise(resolve=>{window.releaseCase=()=>original.call(this).then(resolve);}):original.call(this);};});
  await uploadJSON(page,'#case-file',fixed,'delayed-case.json');await page.waitForFunction(()=>typeof window.releaseCase==='function');await page.locator('#frame-skew').fill('0.003');await page.evaluate(()=>window.releaseCase());await page.waitForTimeout(100);assert.equal(await page.locator('#target option').count(),1);assert.equal(await page.locator('#frame-skew').inputValue(),'0.003');
  await open(page,raw);await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return this.name==='delayed-video.webm'?new Promise(resolve=>{window.releaseVideo=()=>original.call(this).then(resolve);}):original.call(this);};});
  await page.locator('#source-file').setInputFiles({name:'delayed-video.webm',mimeType:'video/webm',buffer:videoBytes});await page.waitForFunction(()=>typeof window.releaseVideo==='function');
  const another=clone(raw);another.notebook.source.sha256='1'.repeat(64);another.reference.source.sha256='1'.repeat(64);await open(page,another);await page.evaluate(()=>window.releaseVideo());await page.waitForTimeout(200);assert.match(await page.locator('#source-state').textContent(),/^Source video is not attached/);assert.equal(await page.locator('#frame-empty').isVisible(),true);
  await open(page,raw);await attach(page);for(const t of [4,6,8])await page.getByRole('button',{name:`Inspect ${t.toFixed(6)} seconds`,exact:true}).click();await frame(page,8);assert.match(await page.locator('#selected-detail').textContent(),/8\.000000 s/);
  record('failed source/reference intake preserves accepted work; newer input choices suppress delayed case/video results and rapid row changes settle on the selected frame');

  const mobile=await context.newPage();watch(mobile);await mobile.setViewportSize({width:390,height:844});await mobile.goto(origin+'/motion-reference.html');await mobile.locator('#case-file').setInputFiles(saved.path);await status(mobile,'Comparison recomputed');await attach(mobile);await frame(mobile,2);
  const timeButton=mobile.getByRole('button',{name:'Inspect 4.000000 seconds',exact:true});await timeButton.focus();await mobile.keyboard.press('Enter');await frame(mobile,4);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(await mobile.locator('#comparison-rows tr').count(),4);await mobile.screenshot({path:resolve(out,'original-mobile.png'),fullPage:true});await mobile.close();
  record('fresh 390 px raw-file reopen, original-source attachment and keyboard row inspection work without horizontal page overflow');

  const nominal=await context.newPage();watch(nominal);await nominal.addInitScript(()=>{Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:undefined});});await nominal.goto(origin+'/motion-reference.html');await open(nominal,raw);await attach(nominal);await nominal.waitForFunction(()=>document.getElementById('source-canvas').dataset.timeBasis==='requested-seek-time');assert.equal(await nominal.locator('#source-canvas').getAttribute('data-observation-visible'),'false');assert.equal(await nominal.locator('#source-canvas').getAttribute('data-reference-visible'),'false');assert.match(await nominal.locator('#frame-caption').textContent(),/nominal seek time; overlays hidden/);await nominal.screenshot({path:resolve(out,'nominal-clock-control.png'),fullPage:true});await nominal.close();
  record('actual browser nominal-clock fallback shows source pixels with both overlays hidden and an explicit timing explanation');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.offsite,[]);for(const file of files)assert.equal(sha(await readFile(new URL('../'+file,import.meta.url))),report.source_files[file]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure={message:error.message,stack:error.stack};throw error;}
finally{await writeFile(resolve(out,'actual-browser.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
