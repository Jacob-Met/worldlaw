import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {createSession,appendMeasurements,exportSession} from '../src/session.mjs';
import {executeStudioDynamics} from '../src/science/studio-dynamics.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const narrowWidthText=process.env.BROWSER_NARROW_WIDTH??'320';
assert.ok(['320','390'].includes(narrowWidthText),'BROWSER_NARROW_WIDTH must be 320 or 390');
const narrowWidth=Number(narrowWidthText);
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/earlier-motion');
await mkdir(dir,{recursive:true});
const checks=[],mark=name=>{checks.push(name);console.log('PASS '+name);};
const source={schema:'worldlaw.observations/v1',source:{label:'Authored historical motion receiving course',kind:'synthetic_analytic_fixture'},observations:Array.from({length:64},(_,i)=>{
 const position=.12*Math.sin(i*.731+.2),rate=.35*Math.cos(i*1.117+.4),command=.4*Math.sin(i*1.331+.7);
 return {position,rate,command,jointTorque:command-2.8*Math.sin(position)-.15*rate+.0007*Math.sin(i*.911)};
})};
const reading={position:1.3,rate:.1,command:0,jointTorque:-2.8*Math.sin(1.3)-.015};
const original=createSession(source);
const updated=appendMeasurements(original,[reading]);
const receipt=updated.history[1].experiment;
assert.equal(receipt.models.length,16);assert.equal(updated.discovery.competitive.length,9);
const currentIds=new Set(updated.discovery.competitive.map(m=>m.id));
const lost=receipt.models.filter(m=>!currentIds.has(m.id));assert.equal(lost.length,7);
const changed=receipt.models.filter(m=>{const now=updated.discovery.competitive.find(n=>n.id===m.id);return now&&JSON.stringify(now.terms)!==JSON.stringify(m.terms);});assert.ok(changed.length);
const snapshot=JSON.stringify(receipt);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(receipt);
const initial={position:1.3,rate:.1},settings={inertia:.8,duration:2.6,dt:.02,command:0};
const expected=receipt.models.map(model=>({model,...executeStudioDynamics(model,initial,settings)}));
assert.equal(JSON.stringify(receipt),snapshot);
assert.deepEqual(receipt.models.map(m=>m.domain),original.discovery.competitive.map(m=>m.domain));
let sameIdMotionDifference=0;
for(const model of changed){const old=expected.find(run=>run.model.id===model.id),now=executeStudioDynamics(updated.discovery.competitive.find(m=>m.id===model.id),initial,settings);for(let i=0;i<old.trajectory.length;i++)sameIdMotionDifference=Math.max(sameIdMotionDifference,Math.abs(old.trajectory[i].position-now.trajectory[i].position));}
assert.ok(sameIdMotionDifference>1e-6);
mark('qualified 16 earlier / 9 current laws, seven lost IDs, changed same-ID motion, exact immutable saved domains and coefficients');
const server=createProductServer();await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const errors=[],badRequests=[],external=[];let browser,worstPixel=0;
const track=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badRequests.push({url:r.url(),status:r.status()});});page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(r.url()))external.push(r.url());});};
const release=async page=>{for(const [id,value]of Object.entries({'initial-angle':1.3,'initial-rate':.1,inertia:.8,duration:2.6,'simulation-command':0}))await page.locator('#'+id).fill(String(value));await page.locator('#studio-comparison-interval').selectOption('0.02');};
const historical=async page=>{await page.locator('#compare-earlier-studio-laws').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('#studio-comparison-transport').hidden);assert.equal(await page.locator('#studio-comparison-pause').getAttribute('data-paused'),'true');assert.equal(await page.locator('#studio-comparison-pause').evaluate(n=>n===document.activeElement),true);const provenance=await page.locator('#studio-comparison-source').innerText();assert.match(provenance,/Before outcome 1/);assert.match(provenance,/reconstructed from notebook inputs/);assert.match(provenance,/current declared release/);assert.match(provenance,/not an authenticated forecast/);const assumptions=await page.locator('#studio-comparison-assumptions').innerText();for(const pattern of [/1\.3 rad/,/0\.1 rad\/s/,/inertia 0\.8 kg/,/fixed command 0 N/,/2\.6 s/,/samples every 20 ms/])assert.match(assumptions,pattern);await page.waitForFunction(()=>document.querySelector('#stage-prediction-label').textContent.includes('Before outcome 1'));assert.deepEqual(await page.locator('#studio-comparison-outcomes tr').evaluateAll(rows=>rows.map(r=>r.dataset.modelId)),receipt.models.map(m=>m.id));assert.equal(await page.locator('#studio-comparison-outcomes tr[data-status="completed"]').count(),16);};
const curves=async page=>{
 if(!await page.locator('.motion-comparison-details').evaluate(n=>n.open))await page.locator('.motion-comparison-details summary').click();
 await page.waitForFunction(()=>document.querySelectorAll('#studio-comparison-chart polyline').length===16);
 const rendered=await page.locator('#studio-comparison-chart svg').evaluate(svg=>({width:svg.viewBox.baseVal.width,lines:[...svg.querySelectorAll('polyline')].map(n=>n.getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number)))}));
 let q0=Infinity,q1=-Infinity;for(const run of expected)for(const p of run.trajectory){q0=Math.min(q0,p.position);q1=Math.max(q1,p.position);}
 const xp=settings.duration*.07,yp=Math.max((q1-q0)*.12,1e-8);let worst=0;
 for(let m=0;m<expected.length;m++){assert.equal(rendered.lines[m].length,expected[m].trajectory.length);for(let i=0;i<expected[m].trajectory.length;i++){const p=expected[m].trajectory[i],x=68+(p.time+xp)/(settings.duration+2*xp)*(rendered.width-86),y=214-(p.position-q0+yp)/(q1-q0+2*yp)*196;worst=Math.max(worst,Math.hypot(rendered.lines[m][i][0]-x,rendered.lines[m][i][1]-y));}}
 assert.ok(worst<1e-7,'Historical curves differ from direct saved-model executions: '+worst);worstPixel=Math.max(worstPixel,worst);
};
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),sandboxPage=await context.newPage(),cdp=await context.newCDPSession(sandboxPage);
 try{const sandbox=await requireChromiumSandbox({send:(m,p)=>cdp.send(m,p)});await writeFile(resolve(dir,'sandbox.json'),JSON.stringify(sandbox,null,2)+'\n');}catch(error){await writeFile(resolve(dir,'sandbox.json'),JSON.stringify(error.receipt??{error:error.message},null,2)+'\n');throw error;}await sandboxPage.close();
 const page=await context.newPage();track(page);const url='http://127.0.0.1:'+server.address().port;await page.goto(url);await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='64');
 await page.locator('#observation-file').setInputFiles({name:'historical-motion-source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});await page.waitForFunction(()=>document.querySelector('#source-name').textContent.includes('Authored historical motion'));
 for(const [id,value]of Object.entries({position:reading.position,rate:reading.rate,command:reading.command,'measured-torque':reading.jointTorque}))await page.locator('#'+id).fill(String(value));
 await page.locator('#run-experiment').click();await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='65');assert.equal(await page.locator('#experiment-receipt-event').inputValue(),'1');
 const persisted=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));assert.ok(persisted);
 await release(page);await historical(page);await curves(page);
 await page.locator('.instrument-stage').screenshot({path:resolve(dir,'historical-motion-desktop.png')});await page.locator('#studio-motion-comparison').screenshot({path:resolve(dir,'historical-comparison-desktop.png')});
 mark('actual entered measurement and keyboard historical launch render all saved laws with direct-executor exact curves');
 await page.locator('#compare-studio-laws').click();await page.waitForFunction(()=>document.querySelectorAll('#studio-comparison-outcomes tr').length===9);assert.match(await page.locator('#studio-comparison-source').innerText(),/Current competitive laws/);
 await historical(page);await curves(page);assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),persisted);
 await page.locator('#initial-angle').fill('.9');assert.equal(await page.locator('#studio-comparison-transport').isVisible(),false);assert.equal(await page.locator('#studio-comparison-chart polyline').count(),0);await release(page);await historical(page);
 mark('current nine-law and historical sixteen-law sources switch explicitly; changed release retires derived paths without notebook mutation');
 const max=await page.locator('#duration').getAttribute('max');assert.ok(!max||Number(max)>=4.01,'Budget course requires supported duration 4.01');await page.locator('#duration').fill('4.01');assert.equal(await page.locator('#duration').evaluate(n=>n.validity.valid),true);await page.locator('#studio-comparison-interval').selectOption('0.000625');await page.locator('#compare-earlier-studio-laws').click();await page.waitForFunction(()=>document.querySelectorAll('#studio-comparison-outcomes tr[data-status="refused"]').length===16);
 assert.equal(await page.locator('#studio-comparison-transport').isVisible(),false);assert.equal(await page.locator('#studio-comparison-spread').isVisible(),false);assert.match(await page.locator('#studio-comparison-outcomes').innerText(),/complete comparison requires.*samples/);assert.equal(await page.locator('#studio-comparison-chart polyline').count(),0);
 mark('over-budget historical grid refuses every original law and leaves no sampled spread or surviving trace');
 await release(page);await historical(page);
 const row2={position:-1.1,rate:-.2,command:.15,jointTorque:.15-2.8*Math.sin(-1.1)-.15*(-.2)+.0004};
 const afterSecond=appendMeasurements(updated,[row2]);
 for(const [id,value]of Object.entries({position:row2.position,rate:row2.rate,command:row2.command,'measured-torque':row2.jointTorque}))await page.locator('#'+id).fill(String(value));
 await page.locator('#run-experiment').click();await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='66');
 const persistedSecond=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
 await page.locator('#experiment-receipt-event').selectOption('1');await historical(page);await curves(page);
 await page.locator('#experiment-receipt-event').selectOption('2');assert.equal(await page.locator('#studio-comparison-transport').isVisible(),false);assert.equal(await page.locator('#studio-comparison-chart polyline').count(),0);
 await page.locator('#compare-earlier-studio-laws').click();await page.waitForFunction(()=>!document.querySelector('#studio-comparison-transport').hidden);
 assert.deepEqual(await page.locator('#studio-comparison-outcomes tr').evaluateAll(rows=>rows.map(r=>r.dataset.modelId)),afterSecond.history[2].experiment.models.map(m=>m.id));assert.match(await page.locator('#studio-comparison-source').innerText(),/Before outcome 2/);await page.waitForFunction(()=>document.querySelector('#stage-prediction-label').textContent.includes('Before outcome 2'));assert.equal(await page.locator('#studio-comparison-pause').getAttribute('data-paused'),'true');
 await page.locator('#compare-studio-laws').click();await page.waitForFunction(n=>document.querySelectorAll('#studio-comparison-outcomes tr').length===n,afterSecond.discovery.competitive.length);assert.match(await page.locator('#studio-comparison-source').innerText(),/Current competitive laws/);
 await page.locator('#experiment-receipt-event').selectOption('1');assert.equal(await page.locator('#studio-comparison-transport').isVisible(),false);await historical(page);await curves(page);
 mark('two actual outcomes preserve their distinct original sets; receipt selection retires paths before explicit rerun');
 const downloading=page.waitForEvent('download');await page.locator('#export-session').click();const file=resolve(dir,'earlier-motion-notebook.json');await(await downloading).saveAs(file);const raw=JSON.parse(await readFile(file,'utf8'));
 const exported=exportSession(afterSecond);const independent=typeof exported==='string'?JSON.parse(exported):exported;
 assert.equal(Object.keys(raw).length,5);assert.deepEqual(Object.keys(raw).sort(),Object.keys(independent).sort());assert.equal(raw.history,undefined);assert.ok(raw.events.every(e=>e.experiment===undefined));assert.equal(raw.base.observations.length,64);assert.equal(raw.events.length,2);assert.equal(JSON.stringify(raw).includes('worldlaw.studio-dynamics-comparison'),false);assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),persistedSecond);
 const freshContext=await browser.newContext({viewport:{width:narrowWidth,height:960},reducedMotion:'reduce'}),fresh=await freshContext.newPage();track(fresh);await fresh.goto(url);await fresh.locator('#session-file').setInputFiles(file);await fresh.waitForFunction(()=>document.querySelector('#sample-count').textContent==='66');await fresh.locator('#experiment-receipt-event').selectOption('1');await release(fresh);const reopened=await fresh.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));await historical(fresh);await curves(fresh);
 await fresh.locator('#studio-comparison-time').focus();await fresh.keyboard.press('End');assert.equal(await fresh.locator('#studio-comparison-time').inputValue(),String(expected[0].trajectory.length-1));await fresh.locator('.instrument-stage').scrollIntoViewIfNeeded();assert.ok(await fresh.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${narrowWidth}px overflow`);await fresh.locator('.instrument-stage').screenshot({path:resolve(dir,`historical-motion-${narrowWidth}.png`)});await fresh.locator('#studio-motion-comparison').screenshot({path:resolve(dir,`historical-comparison-${narrowWidth}.png`)});
 const still=await fresh.locator('#mechanism-canvas').evaluate(c=>c.toDataURL());await fresh.waitForTimeout(125);assert.equal(await fresh.locator('#mechanism-canvas').evaluate(c=>c.toDataURL()),still);
 await fresh.locator('#clear-studio-comparison').focus();await fresh.keyboard.press('Enter');await fresh.waitForFunction(()=>document.querySelector('#simulation-status').dataset.method);assert.equal(await fresh.locator('#studio-comparison-transport').isVisible(),false);assert.equal(await fresh.locator('#trajectory-chart polyline').count(),1);assert.equal(await fresh.locator('#compare-studio-laws').evaluate(n=>n===document.activeElement),true);assert.equal(await fresh.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),reopened);
 mark(`five-key input-only export reopens fresh; historical curves reproduce at ${narrowWidth}px with reduced motion, keyboard scrub and clear`);
 assert.deepEqual(errors,[]);assert.deepEqual(badRequests,[]);assert.deepEqual(external,[]);assert.equal(JSON.stringify(receipt),snapshot);
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({browser:await browser.version(),narrowViewport:{width:narrowWidth,height:960},checks,lostIds:lost.map(m=>m.id),sameIdMotionDifference,worstPixel,errors,badRequests,external,scope:'Authored synthetic analytic fixture entered as actual-reading UI input; no claim of physical acquisition or authenticated historical forecast.'},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
