import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const artifacts=resolve(process.env.BROWSER_ARTIFACT_DIR);await mkdir(artifacts,{recursive:true});
function oscillator(id,x,v,noise=0){const d=.2,w=Math.sqrt(4-d*d/4),b=(v+d*x/2)/w;return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:v,source:{label:'Independent analytic oscillator with deterministic position contamination',recordingId:id},samples:Array.from({length:161},(_,i)=>{const time=i*.05;return{time,position:Math.exp(-d*time/2)*(x*Math.cos(w*time)+b*Math.sin(w*time))+noise*Math.sin(i*1.731)*Math.sin(i*.317)};})};}
const fixture={schema:'worldlaw.angular-bundle/v1',label:'Independent analytic noisy oscillator',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[oscillator('a',1,.2,.003),oscillator('b',-.6,.1,.003)],challengeRuns:[oscillator('c',1.4,-.1)]};
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
try{
 const preflight=await browser.newPage(),cdp=await preflight.context().newCDPSession(preflight);const sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await preflight.close();
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);await page.waitForFunction(()=>!document.getElementById('refit').disabled);
 await page.locator('#bundle-file').setInputFiles({name:'analytic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>document.getElementById('source-description').textContent.includes('simulated'));
 const panel=page.locator('#predictive-selection');assert.equal(await panel.locator('#predictive-refine').isChecked(),false);
 for(const id of ['coulomb','gravity','quadratic'])await panel.locator('#predictive-term-'+id).uncheck();await panel.locator('#predictive-terms').fill('3');
 const execute=async()=>{await panel.locator('#predictive-run').click();await page.waitForFunction(()=>!document.getElementById('predictive-save').disabled);};
 await execute();const baseline=await panel.locator('#predictive-results').textContent();
 await panel.locator('#predictive-refine').focus();await page.keyboard.press('Space');assert.equal(await panel.locator('#predictive-save').isDisabled(),true);await execute();
 const candidate=await panel.locator('#predictive-results').textContent();assert.match(candidate,/training_improved/);assert.match(candidate,/Original training RMSE/);assert.equal(await panel.locator('polyline[data-model$="~forward-refined"]').count(),1);
 const save=async name=>{const waiting=page.waitForEvent('download');await panel.locator('#predictive-save').click();const download=await waiting,path=resolve(artifacts,name);await download.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
 const notebook=await save('forward-refinement.json');assert.equal(notebook.schema,'worldlaw.predictive-notebook/v2');assert.equal(notebook.refinement,undefined);
 const open=async data=>{await panel.locator('#predictive-open').setInputFiles({name:'comparison.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>!document.getElementById('predictive-save').disabled);};
 await open(notebook);assert.equal(await panel.locator('#predictive-results').textContent(),candidate);
 await panel.locator('#predictive-refinement-trials summary').click();assert.match(await panel.locator('#predictive-refinement-trials').textContent(),/Trial 120/);await panel.locator('#predictive-refinement-trials summary').click();
 await panel.screenshot({path:resolve(artifacts,'desktop.png')});await page.setViewportSize({width:390,height:900});await panel.screenshot({path:resolve(artifacts,'narrow.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const refused=structuredClone(notebook);refused.refinementOptions.maxTotalSteps=1;await open(refused);const refusal=await panel.locator('#predictive-results').textContent();assert.match(refusal,/refinement: refused/);assert.match(refusal,/reservation/);assert.equal(await panel.locator('polyline[data-model$="~forward-refined"]').count(),0);assert.ok(await panel.locator('polyline[data-model="rate+spring+bias"]').count());
 const unresolved=structuredClone(notebook);unresolved.refinementOptions={sweeps:2,maxNumericalDifference:0};await open(unresolved);assert.match(await panel.locator('#predictive-results').textContent(),/baseline_unresolved/);assert.equal(await panel.locator('polyline[data-model$="~forward-refined"]').count(),0);
 await page.locator('#example-choice').selectOption('measured');await page.locator('#load-example').click();await page.waitForFunction(()=>!document.getElementById('refit').disabled);assert.equal(await panel.locator('#predictive-refine').isChecked(),false);
 await panel.locator('#predictive-terms').fill('4');await panel.locator('#predictive-refine').check();await execute();const measured=await panel.locator('#predictive-results').textContent();assert.match(measured,/rate\+coulomb\+gravity\+bias/);assert.match(measured,/0\.08951/);assert.match(measured,/training_improved/);await save('reused-pasco.json');await page.setViewportSize({width:1440,height:1000});await panel.screenshot({path:resolve(artifacts,'measured-transfer-loss.png')});
 assert.deepEqual(errors,[]);const receipt={sandbox,checks:['actual analytic source import','default refinement off','keyboard opt-in and invalidation','maintained training refinement and ghost forecast','real source-only v2 download','reopen recomputes exact result','all retained trials inspected','desktop and390 layout','budget refusal retains incumbent forecast','numerical refusal withholds candidate','source reset clears opt-in','reused PASCO incumbent and transfer loss retained'],baseline,candidate,refusal,measured,errors};await writeFile(resolve(artifacts,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({checks:receipt.checks.length,sandbox:sandbox.admitted,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
