/** Actual maintained Studio receiving; no CSP bypass or sandbox weakening. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from '../scripts/support/chromium-sandbox.mjs';
import {covarianceBundle,covarianceRun,covarianceOptions} from '../tests/fixtures/covariance-course.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/position-covariance');await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
const checks=[],errors=[];let browser,sandbox;
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const packet=(bundle=covarianceBundle(),options=covarianceOptions,covarianceOptionsValue=null)=>({schema:covarianceOptionsValue===null?'worldlaw.predictive-notebook/v1':'worldlaw.predictive-notebook/v3',bundle,options,...(covarianceOptionsValue===null?{}:{covarianceOptions:covarianceOptionsValue})});
async function until(check,label){for(let i=0;i<200;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable'});
 const preflight=await browser.newPage(),cdp=await preflight.context().newCDPSession(preflight);sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await preflight.close();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${server.address().port}`;page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base+'/trajectory.html');
 const picker=page.waitForEvent('filechooser');await page.locator('#import-bundle').click();
 await(await picker).setFiles({name:'covariance-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(covarianceBundle()))});
 await page.locator('#predictive-selection').waitFor({state:'visible'});
 assert.equal(await page.locator('#predictive-covariance').isChecked(),false);mark('original angular intake retains covariance-off default');
 async function open(raw,name='comparison.json'){
  await page.locator('#predictive-open').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  await until(async()=>await page.locator('#predictive-save').isEnabled()&&!(await page.locator('#predictive-status').textContent()).includes('Executing'),'notebook recomputation');
 }
 async function save(name){const waiting=page.waitForEvent('download');await page.locator('#predictive-save').click();const path=resolve(dir,name);await(await waiting).saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
 await open(packet());
 const baselineRows=await page.locator('#predictive-results table tr').allTextContents(),baselinePaths=await page.locator('#predictive-chart polyline').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.model,points:n.getAttribute('points')})));
 assert.equal(await page.locator('#predictive-covariance-status').count(),0);
 const original=await save('original-v1.json');assert.equal(original.schema,'worldlaw.predictive-notebook/v1');assert.equal(original.covarianceOptions,undefined);mark('legacy source notebook remains v1 with no covariance result or request');
 await page.locator('#predictive-covariance').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#predictive-covariance').isChecked(),true);assert.equal(await page.locator('#predictive-save').isDisabled(),true);
 await page.locator('#predictive-run').focus();await page.keyboard.press('Enter');
 await until(async()=>await page.locator('#predictive-save').isEnabled(),'covariance comparison');
 assert.match(await page.locator('#predictive-covariance-status').textContent(),/comparison: converged/);
 const comparedRows=await page.locator('#predictive-results table tr').allTextContents();assert.deepEqual(comparedRows.filter(row=>!row.includes('Position covariance')),baselineRows);
 assert.equal(await page.locator('#predictive-chart polyline[data-model$="~position-covariance"]').count(),1);
 mark('keyboard-enabled covariance converges with preserved original challenge rows and an additional prediction');
 const updates=await page.locator('#predictive-covariance-iterations').textContent(),saved=await save('covariance-v3.json');
 assert.equal(saved.schema,'worldlaw.predictive-notebook/v3');assert.deepEqual(saved.covarianceOptions,{});for(const key of ['covariance','results','selection','refinedModel'])assert.equal(saved[key],undefined);assert.deepEqual(saved.bundle,original.bundle);
 const forged={...saved,covariance:{status:'invented-success'},results:[]};await open(forged);assert.equal(await page.locator('#predictive-covariance-iterations').textContent(),updates);assert.deepEqual(await page.locator('#predictive-results table tr').allTextContents(),comparedRows);mark('raw v3 download and reopened forged-derived report recompute the same evidence');
 await page.locator('#predictive-covariance-iterations summary').click();await page.locator('#predictive-selection').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'covariance-desktop.png'),fullPage:true});await page.locator('#predictive-selection').screenshot({path:resolve(dir,'covariance-panel-desktop.png')});
 const changed=covarianceBundle();changed.trainingRuns=[covarianceRun('changed-a',.8,-.3,{seed:313}),covarianceRun('changed-b',-1.1,.4,{seed:811})];await open(packet(changed,covarianceOptions,{}));
 assert.match(await page.locator('#predictive-covariance-status').textContent(),/comparison: converged/);assert.notEqual(await page.locator('#predictive-covariance-iterations').textContent(),updates);mark('different original training trajectories change the fitted covariance coefficients');
 await open(packet(covarianceBundle(),covarianceOptions,{maxIterations:1}));assert.match(await page.locator('#predictive-covariance-status').textContent(),/iteration_limit/);assert.equal(await page.locator('#predictive-chart polyline[data-model$="~position-covariance"]').count(),0);
 const limited=await save('iteration-limit-v3.json');assert.deepEqual(limited.covarianceOptions,{maxIterations:1});await open(limited);assert.match(await page.locator('#predictive-covariance-status').textContent(),/iteration_limit/);mark('saved finite iteration boundary stays unresolved without a fabricated refined forecast');
 const beforeInvalid=await page.locator('#predictive-results').textContent(),invalid={...limited};delete invalid.covarianceOptions;
 await page.locator('#predictive-open').setInputFiles({name:'missing-options.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await until(async()=>(await page.locator('#predictive-status').textContent()).includes('explicit options'),'missing request refusal');assert.equal(await page.locator('#predictive-results').textContent(),beforeInvalid);mark('v3 missing covariance request refuses explicitly and retains the labeled prior result');
 const pasco=JSON.parse(await readFile(new URL('../examples/physical-pasco-92be.json',import.meta.url),'utf8'));await open(packet(pasco,{},{}),'measured-pasco-v3.json');
 assert.match(await page.locator('#predictive-covariance-status').textContent(),/comparison: refused/);assert.match(await page.locator('#predictive-covariance-status').textContent(),/linear rate and smooth position terms/);assert.equal(await page.locator('#predictive-chart polyline[data-model$="~position-covariance"]').count(),0);
 assert.ok((await page.locator('#predictive-results table tr').count())>1);mark('measured PASCO nonsmooth selected law refuses covariance while retaining original forecasts');
 await page.locator('#predictive-selection').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'covariance-pasco-refusal.png'),fullPage:true});
 await open(saved);const layouts=[];for(const width of [390,320]){await page.setViewportSize({width,height:900});await page.locator('#predictive-covariance').focus();assert.equal(await page.locator('#predictive-covariance').evaluate(e=>document.activeElement===e),true);const actual=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(actual.document<=width,JSON.stringify(actual));layouts.push(actual);if(width===390){await page.screenshot({path:resolve(dir,'covariance-narrow.png'),fullPage:true});await page.locator('#predictive-selection').screenshot({path:resolve(dir,'covariance-panel-narrow.png')});}}mark('actual comparison and controls fit narrow viewports with keyboard focus');
 await page.locator('#predictive-covariance').uncheck();assert.equal(await page.locator('#predictive-save').isDisabled(),true);await page.locator('#predictive-run').click();await until(()=>page.locator('#predictive-save').isEnabled(),'return to default');assert.equal(await page.locator('#predictive-covariance-status').count(),0);assert.deepEqual(await page.locator('#predictive-results table tr').allTextContents(),baselineRows);assert.deepEqual(await page.locator('#predictive-chart polyline').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.model,points:n.getAttribute('points')}))),baselinePaths);mark('turning comparison off restores exact original visible rows and paths');
 assert.deepEqual(errors,[]);mark('no unexpected browser or served-asset errors');
 await writeFile(resolve(dir,'position-covariance-browser.json'),JSON.stringify({checks,errors,sandbox,layouts,browser:await browser.version(),scope:'Actual maintained Studio with closed-form authored trajectories and measured PASCO source; no physical validity or improved prediction claim.'},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
