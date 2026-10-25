import assert from 'node:assert/strict';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {gravityRun} from '../experiments/integral-discovery-92be.mjs';
const playwright=await import(process.env.PLAYWRIGHT_MODULE),artifacts=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/periodic-phase');await mkdir(artifacts,{recursive:true});
const make=(id,position)=>{const r=gravityRun({id,position,cubic:0,dt:.02});return {...r,inertia:null,dynamics:'unforced_scalar_rotation',samples:r.samples.map(({time,position})=>({time,position:position+.237}))};};
const fixture={schema:'worldlaw.angular-bundle/v1',label:'Independent off-grid periodic phase fixture',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[make('a',1.5),make('b',-1.3)],challengeRuns:[make('c',2.1)]};
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const sandboxPage=await browser.newPage();let sandbox;try{const cdp=await sandboxPage.context().newCDPSession(sandboxPage);sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await writeFile(resolve(artifacts,'sandbox.json'),JSON.stringify(sandbox,null,2));}finally{await sandboxPage.close();}
 await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);await page.waitForFunction(()=>!document.getElementById('refit').disabled);
 await page.locator('#bundle-file').setInputFiles({name:'phase.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.waitForFunction(()=>document.getElementById('source-description').textContent.includes('simulated'));
 const panel=page.locator('#angle-reference-panel');await panel.getByText('Investigate the angle reference',{exact:true}).click();
 assert.equal(await panel.locator('#phase').isChecked(),false);
 await panel.locator('#noise').fill('0.000001');await panel.locator('#offsets').fill('-.3,-.15,0,.15,.3');
 await panel.locator('#phase').focus();await page.keyboard.press('Space');
 await panel.locator('#search').click();await page.waitForFunction(()=>!document.querySelector('#angle-reference-panel').shadowRoot.getElementById('save').disabled);
 const prediction=await panel.locator('#prediction').textContent();assert.match(prediction,/Original-coordinate periodic comparison/);
 const summary=await panel.locator('#phase-summary').textContent();assert.match(summary,/conditional_periodic_component/);assert.match(summary,/0.237/);
 const downloadEvent=page.waitForEvent('download');await panel.locator('#save').click();const download=await downloadEvent,path=resolve(artifacts,'notebook.json');await download.saveAs(path);const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.settings.phaseComparison,true);assert.equal(saved.phaseComparison,undefined);
 await panel.locator('#phase').uncheck();assert.equal(await panel.locator('#save').isDisabled(),true);
 await panel.locator('#open').setInputFiles(path);await page.waitForFunction(()=>!document.querySelector('#angle-reference-panel').shadowRoot.getElementById('save').disabled);assert.equal(await panel.locator('#phase').isChecked(),true);assert.equal(await panel.locator('#prediction').textContent(),prediction);
 await panel.screenshot({path:resolve(artifacts,'desktop.png')});await page.setViewportSize({width:390,height:900});await panel.screenshot({path:resolve(artifacts,'narrow.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const flat=structuredClone(saved);for(const run of flat.bundle.trainingRuns)for(const sample of run.samples)sample.position=.237;
 await panel.locator('#open').setInputFiles({name:'flat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(flat))});await page.waitForFunction(()=>document.querySelector('#angle-reference-panel').shadowRoot.getElementById('phase-summary').textContent.includes('insufficient_excitation'));
 const flatSummary=await panel.locator('#phase-summary').textContent();assert.match(flatSummary,/phase unavailable/);assert.equal(await panel.locator('#candidates tr').count()>0,true);
 const failure=structuredClone(saved);failure.settings.solver={maxStep:.01,maxSteps:1};
 await panel.locator('#open').setInputFiles({name:'refused.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(failure))});await page.waitForFunction(()=>document.querySelector('#angle-reference-panel').shadowRoot.getElementById('prediction').textContent.includes('Original-coordinate periodic comparison: refused'));
 assert.equal(await panel.locator('#save').isDisabled(),false);assert.equal(await panel.locator('#candidates tr').count()>0,true);
 await panel.locator('#open').setInputFiles(path);await page.waitForFunction(expected=>document.querySelector('#angle-reference-panel').shadowRoot.getElementById('prediction').textContent===expected,prediction);
 await page.locator('#example-choice').selectOption('measured');await page.locator('#load-example').click();await page.waitForFunction(()=>!document.getElementById('refit').disabled);assert.equal(await panel.locator('#phase').isChecked(),false);assert.equal(await panel.locator('#save').isDisabled(),true);
 assert.deepEqual(errors,[]);const receipt={sandbox,checks:['actual angular import','default opt-out','keyboard phase offer','separate frozen solver predictions','input-only download','toggle invalidation','reopen recomputation','desktop and390/reduced-motion','insufficient excitation withholds phase','solver refusal retains grid and notebook','source replacement resets offer'],prediction,summary,flatSummary,errors};await writeFile(resolve(artifacts,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
