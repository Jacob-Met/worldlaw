import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createChallengeServer} from './trajectory-server-92be.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {createExperimentSession,planNextExperiment,exportExperimentSession} from '../src/trajectory/experiment-session.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/correlated-reading');
await mkdir(dir,{recursive:true});
const fixture=JSON.parse(await readFile('examples/trajectory-ambiguous-92be.json','utf8'));
// Ordinary portable input notebook: no cached predictions or UI state are
// injected. Reopen recomputes the original independent reading protocol.
const input=exportExperimentSession(planNextExperiment(createExperimentSession(createChallenge(fixture)),
  {noiseSigma:.012,noiseTargetZ:.000001,noiseMaxReadings:1,maxModels:2,maxTotalSteps:250000}));
await writeFile(resolve(dir,'original-independent-input.json'),input);
const server=process.env.TRAJECTORY_OFFLINE_FILE?null:createChallengeServer();
if(server)await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
let browser;
const checks=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const external=[];
  if(process.env.TRAJECTORY_OFFLINE_FILE){
    await page.context().route(/^https?:\/\//,route=>{external.push(route.request().url());return route.abort('blockedbyclient');});
    await page.context().setOffline(true);
  }
  await page.goto(server?`http://127.0.0.1:${server.address().port}`:pathToFileURL(resolve(process.env.TRAJECTORY_OFFLINE_FILE)).href);
  await page.waitForFunction(()=>document.getElementById('export-notebook')?.disabled===false&&document.getElementById('challenge-workspace')?.getAttribute('aria-busy')==='false');
  await page.locator('#notebook-file').setInputFiles({name:'original-independent-input.json',mimeType:'application/json',buffer:Buffer.from(input)});
  const panel=page.locator('#experiment-panel'),p=id=>panel.locator('#'+id);
  await p('release-stats').waitFor({state:'visible'});
  // Controls are deliberately inside an accessible collapsed disclosure; open it
  // through the public UI before modifying sensor assumptions.
  await panel.locator('summary').click();
  await p('power-correlation').fill('.4');
  await p('plan').focus();await page.keyboard.press('Enter');
  await p('power-readout').filter({hasText:'correlated'}).waitFor();
  assert.equal(await p('acquire-sparse').isEnabled(),true);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(dir,'correlated-plan-1920x1080.png')});
  await panel.screenshot({path:resolve(dir,'correlated-plan-panel.png')});
  checks.push('normal keyboard replanning consumes declared sensor memory');
  await p('acquire-sparse').focus();await page.keyboard.press('Enter');
  await p('sparse-evidence').waitFor({state:'visible'});
  const download=page.waitForEvent('download');await page.locator('#export-notebook').click();
  const saved=resolve(dir,'correlated-acquired-notebook.json');await(await download).saveAs(saved);
  const record=JSON.parse(await readFile(saved,'utf8'));
  assert.equal(record.experiment.sparse.evidence.source.positionNoiseCorrelationTime,.4);
  assert.equal(record.experiment.sparse.receiving,undefined,'derived receiving is recomputed, not trusted from export');
  assert.equal(record.experiment.sparse.evidence.measurementCount,1);
  checks.push('selected acquisition exports actual covariance provenance');
  await page.reload();await p('sparse-evidence').waitFor({state:'visible'});
  assert.equal(await p('power-correlation').inputValue(),'0.4');
  assert.equal(await p('acquire-sparse').isDisabled(),true);
  checks.push('normal reload preserves source and forbids repeated acquisition');
  await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.screenshot({path:resolve(dir,'correlated-reopened-390x844.png')});
  await p('sparse-evidence').screenshot({path:resolve(dir,'correlated-evidence-390.png')});
  const bad=structuredClone(record);bad.experiment.sparse.evidence.source.positionNoiseCorrelationTime=.5;
  await page.locator('#notebook-file').setInputFiles({name:'changed-covariance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await p('sparse-evidence').isVisible(),true);
  checks.push('changed-memory import refuses while retaining current acquired record');
  // A distinct cold notebook is essential: source acquisition is single-use.
  // Re-enter the actual public controls, never patch document state or cache.
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('#notebook-file').setInputFiles({
    name:'original-independent-input.json',mimeType:'application/json',buffer:Buffer.from(input)});
  await p('sparse-evidence').waitFor({state:'hidden'});
  await p('release-stats').waitFor({state:'visible'});
  if((await panel.locator('details').getAttribute('open'))===null)await panel.locator('summary').click();
  await p('power-correlation').fill('.2');
  await p('power-correlation-max').fill('.8');
  await p('plan').focus();await page.keyboard.press('Enter');
  await p('power-readout').filter({hasText:'Bounded sensor memory'}).waitFor();
  assert.equal(await p('acquire-sparse').isEnabled(),true);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(dir,'bounded-plan-1920x1080.png')});
  checks.push('actual uncertainty instrument plans across declared memory interval via keyboard');
  await p('acquire-sparse').focus();await page.keyboard.press('Enter');
  await p('sparse-evidence').waitFor({state:'visible'});
  const robustDownload=page.waitForEvent('download');
  await page.locator('#export-notebook').click();
  const robustPath=resolve(dir,'bounded-acquired-notebook.json');
  await(await robustDownload).saveAs(robustPath);
  const robust=JSON.parse(await readFile(robustPath,'utf8'));
  assert.equal(robust.experiment.sparse.planSettings.noiseCorrelationTime,.2);
  assert.equal(robust.experiment.sparse.planSettings.noiseCorrelationTimeMax,.8);
  assert.equal(robust.experiment.sparse.evidence.source.positionNoiseCorrelationTime,.2);
  assert.equal(robust.experiment.sparse.evidence.measurementCount,1);
  await page.reload();
  await p('sparse-evidence').waitFor({state:'visible'});
  assert.equal(await p('power-correlation-max').inputValue(),'0.8');
  assert.equal(await p('acquire-sparse').isDisabled(),true);
  await page.setViewportSize({width:390,height:844});
  await panel.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.screenshot({path:resolve(dir,'bounded-reopened-390x844.png')});
  checks.push('real 390px reload retains bounded tau and source-faithful nominal acquisition');
  await page.locator('#error').waitFor({state:'hidden'});
  const forged=structuredClone(robust);
  forged.experiment.sparse.planSettings.noiseCorrelationTimeMax=.9;
  await page.locator('#notebook-file').setInputFiles({name:'forged-upper-memory.json',
    mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await p('sparse-evidence').isVisible(),true);
  checks.push('forged uncertainty interval refuses import without replacing acquired source');
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[],'Standalone receiving must not request external assets');
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,scope:'real browser controls and one-reading persistence; not a statistical power experiment',screens:['correlated-plan-1920x1080.png','correlated-reopened-390x844.png','bounded-plan-1920x1080.png','bounded-reopened-390x844.png']},null,2));
  console.log(JSON.stringify({checks,output:dir}));
}finally{if(browser)await browser.close();if(server)await new Promise(yes=>server.close(yes));}
