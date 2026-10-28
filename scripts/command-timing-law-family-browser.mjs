/** Portable real-entrypoint receiving. No browser installation or security changes. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compareCommandTiming} from '../src/trajectory/command-timing-study.mjs';
import {prepareTimingLawForecasts, executeTimingLawForecasts, timingLawComparison} from '../src/trajectory/command-timing-law-family.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

const options = {};
for (let i=2;i<process.argv.length;i+=2) {
  assert(['--cases-dir','--url','--standalone','--receipt','--screenshots-dir'].includes(process.argv[i]), `Unknown argument ${process.argv[i]}`);
  assert(process.argv[i+1] && !process.argv[i+1].startsWith('--'), 'Each argument needs a value');
  options[process.argv[i].slice(2)] = process.argv[i+1];
}
const casesDir=options['cases-dir']||process.env.LAW_FAMILY_CASES_DIR;
const url=options.url||process.env.LAW_FAMILY_URL;
const standalone=options.standalone||process.env.LAW_FAMILY_STANDALONE;
const receiptPath=options.receipt||process.env.LAW_FAMILY_RECEIPT;
assert(casesDir && receiptPath, 'Supply --cases-dir and --receipt (or LAW_FAMILY_CASES_DIR/RECEIPT)');
assert(Boolean(url)!==Boolean(standalone), 'Supply exactly one --url or --standalone');
const output=resolve(receiptPath), shots=resolve(options['screenshots-dir']||dirname(output));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const declared={constant:'e559f22896acb490ace94320954a6d735ee89e3154c33bdea87156911595c62a',switch:'28fd7c0a059523667184405136c96039e96b57c25b9451009e8047482cadcbff',pulse:'e8336c3c99d5732efc1764a220bd724c741211d3b73bd86e593693b0690b6fd8'};
const receipt={schema:'worldlaw.timing-law-browser-receiving/v1',checks:[],inputs:[],screenshots:[],errors:[],failedRequests:[],externalRequests:[],httpFailures:[],result:'FAIL'};
let browser;
try {
  const cases=[];
  // Refuse different evidence before launching a browser.
  for(const [name,expectedHash] of Object.entries(declared)) {
    const path=resolve(casesDir,`excitation-${name}.json`), bytes=await readFile(path);
    assert.equal(digest(bytes),expectedHash,`${name} original input hash`);
    const input=JSON.parse(bytes);assert.equal(input.schema,'worldlaw.command-timing-inputs/v1');
    assert.deepEqual(Object.keys(input).sort(),['bundle','options','schema']);
    const report=compareCommandTiming(input.bundle,input.options), plan=prepareTimingLawForecasts(report);
    assert.equal(plan.status,'ready');assert.equal(plan.members.length,name==='constant'?12:1);
    assert.equal(plan.work.additionalMemberCount,name==='constant'?6:0);
    const family=executeTimingLawForecasts(plan), comparison=timingLawComparison(family,report.bundle.challengeRuns[0].id);
    assert.equal(comparison.availableCount,plan.members.length);
    cases.push({name,path,input,report,plan,family,comparison});
    receipt.inputs.push({name,file:path,sha256:expectedHash,members:plan.members.length,work:family.work});
  }
  receipt.url=standalone?pathToFileURL(resolve(standalone)).href:new URL(url).href;
  receipt.standaloneSHA256=standalone?digest(await readFile(resolve(standalone))):null;
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',acceptDownloads:true});
  const preflight=await context.newPage(),cdp=await context.newCDPSession(preflight);
  receipt.sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await preflight.close();
  const origin=standalone?null:new URL(receipt.url).origin;
  await context.route('**/*',async route=>{
    const requestURL=route.request().url();
    if(/^https?:/.test(requestURL)&&(standalone||new URL(requestURL).origin!==origin)) {
      receipt.externalRequests.push(requestURL);await route.abort();
    } else await route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>receipt.errors.push(error.message));
  page.on('requestfailed',request=>receipt.failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('response',response=>{if(response.status()>=400)receipt.httpFailures.push({url:response.url(),status:response.status()});});
  await page.goto(receipt.url);
  const at=id=>page.locator('#command-timing-'+id);
  async function reopen(c) {
    const chooserPending=page.waitForEvent('filechooser');
    await at('open').click();
    await (await chooserPending).setFiles(c.path);
    await page.waitForFunction(()=>!document.querySelector('#command-timing-result').hidden&&document.querySelector('#command-timing-law-status').textContent.includes('Optional computation'),undefined,{timeout:60000});
    assert.equal(await at('law').locator('option').count(),0,'Source replacement retires computed laws');
  }
  async function sourceState(){return {source:await at('source').innerText(),status:await at('status').innerText(),selected:await at('candidate').inputValue(),observed:await at('chart').locator('polyline[stroke="#174858"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('points')))};}
  async function savedInput(label) {
    const pending=page.waitForEvent('download');await at('save').click();const download=await pending;
    const path=join(shots,`${label}-saved.json`);await download.saveAs(path);return JSON.parse(await readFile(path));
  }
  async function compute(c) {
    await at('law-compute').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#command-timing-family-mode').value==='laws'&&document.querySelector('#command-timing-law').options.length>0,undefined,{timeout:60000});
    const keys=await at('law').locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.deepEqual(keys,c.plan.members.map(m=>m.key),'UI actual complete global membership');
    assert.match(await at('law-status').innerText(),new RegExp(`${c.plan.work.additionalMemberCount} additional`));
    assert.match(await at('comparison-caption').innerText(),/not a probability or confidence interval/);
  }
  await mkdir(shots,{recursive:true});
  const constant=cases[0];await reopen(constant);
  assert.equal(await at('law-accounting').evaluate(node=>node.open),false,'Accounting starts closed');
  assert.equal(await at('comparison').isChecked(),false);assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  const before=await sourceState(), savedBefore=await savedInput('constant-before');assert.deepEqual(savedBefore,constant.input);
  await compute(constant);
  assert.equal(await at('law-accounting').evaluate(node=>node.open),false,'Computation does not force accounting open');
  await at('law-accounting').locator('summary').focus();await page.keyboard.press('Enter');
  assert.equal(await at('law-accounting').evaluate(node=>node.open),true);
  const accountingText=await at('law-accounting').innerText();
  const w=constant.family.work;
  for(const value of [w.originalReservedSteps,w.additionalReservedSteps,w.totalReservedSteps,w.maxTotalSteps,w.originalCompletedSteps,w.completedAdditionalSteps]) assert(accountingText.includes(String(value)),`Accounting retains ${value}`);
  assert.match(accountingText,/original/i);assert.match(accountingText,/additional/i);assert.match(accountingText,/completed/i);
  assert.match(accountingText,/rank.deficient/i);assert.match(accountingText,/unexecutable/i);assert.match(accountingText,/failed/i);
  const excluded=constant.plan.excludedFitCounts;
  assert(accountingText.includes(`${excluded.rankDeficientCandidates} rank-deficient`), 'Accounting must label the rank-deficient excluded-fit count');
  assert(accountingText.includes(`${excluded.unexecutableCandidates} unexecutable`), 'Accounting must label the unexecutable excluded-fit count');
  assert(accountingText.includes(`${excluded.fitFailedTimings} timing fits failed`), 'Accounting must label the failed timing-fit count');
  await page.keyboard.press('Enter');assert.equal(await at('law-accounting').evaluate(node=>node.open),false);
  receipt.checks.push({name:'accounting disclosure is closed by default and keyboard accessible',text:accountingText});
  assert.equal(await at('source').innerText(),before.source);assert.equal(await at('status').innerText(),before.status);
  assert.equal(await at('candidate').inputValue(),before.selected);
  const bias=constant.family.members.find(m=>m.delaySeconds===.12&&m.modelId==='rate+spring+bias');assert(bias);
  const commandLaw=constant.family.members.find(m=>m.delaySeconds===.12&&m.modelId==='command+rate+spring');assert(commandLaw);
  await at('law').selectOption(commandLaw.key);
  const initialPredicted=await at('chart').locator('polyline[stroke="#a24915"]').first().getAttribute('points');
  await at('law').selectOption(bias.key);
  const biasPredicted=await at('chart').locator('polyline[stroke="#a24915"]').first().getAttribute('points');
  assert.notEqual(biasPredicted,initialPredicted,'Bias-law inspection must display a different actual forecast');
  const plottedCount=await page.locator('[data-training-competitive-span]').evaluate(p=>p.points.length);
  assert.equal(plottedCount,constant.comparison.rows.length*2,'Complete original-grid span is rendered');
  const identity=await at('law-identity').innerText();assert(identity.includes(bias.modelId));assert(identity.includes('Delay 0.12 s'));assert.match(identity,/command/i);assert.match(identity,/unused|not used|does not use|does not depend|no command term/i,'No-command law explains the displayed command is not used');assert.match(await at('detail').innerText(),/Inspected 0.12 s delay/);
  // Bound display rounding only; no raw cross-runtime bit-equality claim.
  const detail=await at('detail').innerText();
  const shownText=detail.match(/Separate motion RMSE ([0-9.eE+-]+) rad/)?.[1];assert(shownText);
  const expectedRMSE=bias.receiving.find(r=>r.runId===constant.report.bundle.challengeRuns[0].id).rollout.metrics.positionRMSE;
  const [mantissa,exponent='0']=shownText.toLowerCase().split('e');
  const decimals=(mantissa.split('.')[1]||'').length;
  const halfDisplayUnit=0.5*10**(Number(exponent)-decimals);
  assert(Math.abs(Number(shownText)-expectedRMSE)<=halfDisplayUnit+Number.EPSILON*Math.max(1,Math.abs(expectedRMSE)), 'Inspected RMSE agrees within half displayed digit');
  receipt.checks.push({name:'constant complete family and same-delay bias-law inspection',members:12,additional:6,identity:await at('law-identity').innerText(),detail:await at('detail').innerText()});
  await at('family-mode').selectOption('representatives');
  assert.deepEqual(await sourceState(),before,'Returning to default preserves original selected/source/observed curves');
  assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  await at('family-mode').selectOption('laws');
  await at('view').selectOption('profile');assert.equal(await at('law').isVisible(),false);assert.equal(await at('law-compute').isVisible(),false);assert.equal(await at('law-accounting').isVisible(),false);
  await at('view').selectOption('response');assert.equal(await at('law').inputValue(),bias.key);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1100});await page.waitForTimeout(150);
    const overflow=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
    const bad=await at('chart').locator('svg').evaluate(svg=>/NaN|Infinity/.test(svg.outerHTML));assert.equal(bad,false);
    const path=join(shots,`timing-laws-${width}.png`);await at('panel').screenshot({path});receipt.screenshots.push(path);
  }
  assert.deepEqual(await savedInput('constant-after'),savedBefore,'Inspection preserves exact exported source/options');
  await at('noise').fill('0.002');assert.equal(await at('result').isVisible(),false);assert.equal(await at('law').locator('option').count(),0);
  await reopen(constant);await compute(constant);receipt.checks.push({name:'settings retire and source-only reopen restores family'});
  const refusedBudget=constant.plan.work.totalReservedSteps-1;
  assert(refusedBudget>=constant.plan.work.originalReservedSteps);
  await at('budget').fill(String(refusedBudget));await at('run').click();
  await page.waitForFunction(()=>!document.querySelector('#command-timing-result').hidden,undefined,{timeout:60000});
  assert.equal(await at('law-compute').isDisabled(),true);
  assert.equal(await at('law').locator('option').count(),0);
  assert.equal(await page.locator('[data-training-competitive-span]').count(),0);
  const refusedStatus=await at('law-status').innerText();
  assert(refusedStatus.includes(String(constant.plan.work.totalReservedSteps))&&refusedStatus.includes(String(refusedBudget)));
  assert.match(refusedStatus,/No additional forecasts were run/);
  assert.equal(await at('status').innerText(),before.status);
  assert.equal(await at('result').locator('tbody tr').count(),constant.report.candidates.length);
  receipt.checks.push({name:'whole added budget refused with original results retained',required:constant.plan.work.totalReservedSteps,allowed:refusedBudget,status:refusedStatus});
  await reopen(constant);await compute(constant);
  for(const c of cases.slice(1)) {
    await reopen(c);await compute(c);assert.equal(await at('law').locator('option').count(),1);
    assert.deepEqual(await savedInput(c.name),c.input);
    receipt.checks.push({name:`${c.name} original notebook and single global member`,members:1,additional:0,caption:await at('comparison-caption').innerText()});
  }
  assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.externalRequests,[]);assert.deepEqual(receipt.failedRequests,[]);assert.deepEqual(receipt.httpFailures,[]);
  receipt.result='PASS';
} catch(error) {receipt.error=error.stack;if(error.receipt)receipt.sandbox=error.receipt;process.exitCode=1;}
finally {await browser?.close();await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2));}
console.log(JSON.stringify(receipt,null,2));
