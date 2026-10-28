/** Actual trajectory entrypoint receiving; use an owned, sandboxed browser. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compareCommandTiming} from '../src/trajectory/command-timing-study.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {createChallengeServer} from './trajectory-server-92be.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/command-timing-comparison');
await mkdir(out,{recursive:true});
const offline=process.env.TRAJECTORY_OFFLINE_FILE?resolve(process.env.TRAJECTORY_OFFLINE_FILE):null;
const receipt={checks:[],screenshots:[],offlineFile:offline,offlineSha256:offline?createHash('sha256').update(await readFile(offline)).digest('hex'):null};
let browser,server;
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',acceptDownloads:true});
  const preflight=await context.newPage(),cdp=await context.newCDPSession(preflight);
  receipt.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});
  await preflight.close();
  if(!offline){server=createChallengeServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});}
  const externalRequests=[];
  if(offline)await context.setOffline(true);
  if(offline)await context.route(/^(https?|wss?):/i,route=>{externalRequests.push(route.request().url());return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  receipt.url=offline?pathToFileURL(offline).href:`http://127.0.0.1:${server.address().port}/trajectory.html`;
  await page.goto(receipt.url);
  await page.locator('#command-timing-example').click();
  await page.waitForFunction(()=>!document.querySelector('#command-timing-run').disabled&&document.querySelector('#command-timing-before').value.trim()!=='');
  async function execute(){
    await page.locator('#command-timing-run').click();
    await page.waitForFunction(()=>!document.querySelector('#command-timing-result').hidden,undefined,{timeout:60000});
  }
  await execute();
  receipt.baseline={status:await page.locator('#command-timing-status').innerText(),source:await page.locator('#command-timing-source').innerText()};
  assert.equal(await page.locator('#command-timing-comparison').isChecked(),false);
  assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  await page.locator('#command-timing-noise').fill('0.01');
  await page.locator('#command-timing-ambiguity').fill('100');await execute();
  const download=page.waitForEvent('download');await page.locator('#command-timing-save').click();
  const saved=resolve(out,'comparison-inputs.json');await(await download).saveAs(saved);
  const bytes=await readFile(saved);receipt.inputSha256=createHash('sha256').update(bytes).digest('hex');
  let report,run,competitive,low,high;
  function oracle(bytes){
    const input=JSON.parse(bytes);report=compareCommandTiming(input.bundle,input.options);
    run=report.bundle.challengeRuns[0];
    competitive=report.candidates.filter(c=>report.options.responseTimes
      ?report.competitiveResponses.some(pair=>pair.delaySeconds===c.delaySeconds&&pair.responseTimeSeconds===c.responseTimeSeconds)
      :report.competitiveDelays.includes(c.delaySeconds));
    const trajectories=competitive.map(c=>c.receiving.find(r=>r.runId===run.id)).filter(r=>r?.status==='executed').map(r=>r.rollout.rows);
    assert(trajectories.length>=2,'Fixture requires multiple actual competitive fits');
    assert.equal(trajectories.length,competitive.length,'This real fixture must have complete receiving');
    low=run.samples.map((_,i)=>Math.min(...trajectories.map(rows=>rows[i].predicted)));
    high=run.samples.map((_,i)=>Math.max(...trajectories.map(rows=>rows[i].predicted)));
  }
  oracle(bytes);
  async function state(){return {selection:await page.locator('#command-timing-candidate').inputValue(),status:await page.locator('#command-timing-status').innerText(),source:await page.locator('#command-timing-source').innerText()};}
  const before=await state();
  await page.locator('#command-timing-comparison').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('#command-timing-comparison').isChecked(),true);
  assert.deepEqual(await state(),before,'Comparison toggle changed selection or source');
  async function check(label,{collapsed=false}={}){
    const key=await page.locator('#command-timing-candidate').inputValue();
    const candidate=report.candidates.find(c=>(report.options.responseTimes?`${c.delaySeconds}:${c.responseTimeSeconds}`:String(c.delaySeconds))===key);assert(candidate);
    const rows=candidate.receiving.find(r=>r.runId===run.id).rollout.rows;
    const reference=report.options.responseTimes?report.candidates.filter(c=>c.responseTimeSeconds===0&&c.status==='fitted').sort((a,b)=>a.score-b.score||a.delaySeconds-b.delaySeconds)[0]:report.candidates.find(c=>c.delaySeconds===0);
    const baseline=reference.receiving.find(r=>r.runId===run.id).rollout.rows;
    const values=[...run.samples.map(r=>r.position),...rows.map(r=>r.predicted),...baseline.map(r=>r.predicted),...low,...high];
    const minimum=Math.min(...values),maximum=Math.max(...values),pad=Math.max(.02,(maximum-minimum)*.06);
    const geo=await page.locator('[data-training-competitive-span]').evaluate(p=>({points:[...p.points].map(v=>[v.x,v.y]),width:p.ownerSVGElement.viewBox.baseVal.width,raw:p.outerHTML}));
    assert(!/NaN|Infinity/.test(geo.raw));
    const x=i=>58+(geo.width-76)*(run.samples[i].time-run.samples[0].time)/(run.samples.at(-1).time-run.samples[0].time);
    const y=v=>245-(v-(minimum-pad))*200/(maximum-minimum+2*pad);
    const maximumSpan=Math.max(...high.map((v,i)=>v-low[i]));
    const maximumPixelSpan=maximumSpan*200/(maximum-minimum+2*pad);
    if(collapsed){assert(maximumSpan<1e-10,'Unit-scale near-identical control exceeded roundoff-scale spread');}
    else {assert(maximumSpan>.05,`${label}: no meaningful numerical spread`);assert(maximumPixelSpan>2,`${label}: spread not visible at plot scale`);}
    const expected=[...low.map((v,i)=>[x(i),y(v)]),...high.map((v,i)=>[x(i),y(v)]).reverse()];
    assert.equal(geo.points.length,expected.length);
    for(let i=0;i<expected.length;i++)for(let j=0;j<2;j++)assert(Math.abs(geo.points[i][j]-expected[i][j])<.001,`${label} polygon ${i}/${j}`);
    const caption=await page.locator('#command-timing-comparison-caption').innerText();
    assert.match(caption,/not .*probab|not a .*interval/i);assert(caption.includes(String(competitive.length)));
    receipt.checks.push({label,candidate:key,competitive:competitive.length,maximumSpan,maximumPixelSpan,points:geo.points.length,caption});
  }
  await check('desktop scientific range');
  const choices=await page.locator('#command-timing-candidate option').evaluateAll(o=>o.map(x=>x.value));
  await page.locator('#command-timing-candidate').selectOption(choices.find(v=>v!==before.selection));await check('different inspected candidate');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.waitForTimeout(150);await check(`width ${width}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Unexpected page horizontal overflow');const path=resolve(out,`comparison-${width}.png`);await page.locator('#command-timing-panel').screenshot({path});receipt.screenshots.push(path);}
  await page.locator('#command-timing-noise').fill('2');assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  await page.locator('#command-timing-file').setInputFiles(saved);
  await page.waitForFunction(()=>document.querySelector('#command-timing-noise').value==='0.01'&&!document.querySelector('#command-timing-result').hidden,undefined,{timeout:60000});
  await page.locator('#command-timing-comparison').check();await check('saved source-only inputs reopened');
  await page.locator('#command-timing-noise').fill('1');await execute();
  const collapsedDownload=page.waitForEvent('download');await page.locator('#command-timing-save').click();
  const collapsedSaved=resolve(out,'collapsed-comparison-inputs.json');await(await collapsedDownload).saveAs(collapsedSaved);
  const collapsedBytes=await readFile(collapsedSaved);oracle(collapsedBytes);
  receipt.collapsedInputSha256=createHash('sha256').update(collapsedBytes).digest('hex');
  await check('near-identical forecasts retain only roundoff-scale spread',{collapsed:true});
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#command-timing-noise').fill('0.02');
  await page.locator('#command-timing-delays').fill('0, 0.137');
  await page.locator('#command-timing-response').fill('0, 0.1');await execute();
  const jointDownload=page.waitForEvent('download');await page.locator('#command-timing-save').click();
  const jointSaved=resolve(out,'joint-comparison-inputs.json');await(await jointDownload).saveAs(jointSaved);
  const jointBytes=await readFile(jointSaved);oracle(jointBytes);
  receipt.jointInputSha256=createHash('sha256').update(jointBytes).digest('hex');
  assert.equal(report.candidates.length,4);
  assert.deepEqual(competitive.map(c=>`${c.delaySeconds}:${c.responseTimeSeconds}`).sort(),['0:0.1','0.137:0','0.137:0.1'].sort());
  assert(competitive.some((c,i)=>competitive.some((other,j)=>i!==j&&c.delaySeconds===other.delaySeconds&&c.responseTimeSeconds!==other.responseTimeSeconds)),'Joint fixture must retain pairs sharing a delay');
  await check('joint delay-response range');
  const jointState=await state();await page.locator('#command-timing-view').selectOption('profile');
  assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  assert.equal(await page.locator('#command-timing-comparison-caption').isVisible(),false);
  assert.equal(await page.locator('#command-timing-comparison').isVisible(),false);
  assert.equal(await page.locator('#command-timing-comparison-unavailable').isVisible(),false);
  await page.locator('#command-timing-view').selectOption('response');
  assert.deepEqual(await state(),jointState);assert.equal(await page.locator('#command-timing-comparison').isChecked(),true);
  await check('joint profile return preserves range');
  const jointPath=resolve(out,'comparison-joint.png');await page.locator('#command-timing-panel').screenshot({path:jointPath});receipt.screenshots.push(jointPath);
  receipt.externalRequests=externalRequests;receipt.offlineNetworkBlocked=Boolean(offline);
  assert.deepEqual(externalRequests,[],'Standalone attempted external network access');
  assert.deepEqual(errors,[]);receipt.result='PASS';
}catch(error){receipt.result='FAIL';receipt.error=error.stack;if(error.receipt)receipt.sandbox=error.receipt;process.exitCode=1;}
finally{await writeFile(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));}
console.log(JSON.stringify(receipt,null,2));
