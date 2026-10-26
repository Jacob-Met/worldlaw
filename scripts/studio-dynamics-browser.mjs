import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/studio-dynamics');
await mkdir(dir,{recursive:true});
const server=createProductServer();
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const checks=[],mark=name=>{checks.push(name);console.log('PASS '+name);};
let browser;
function sourceFor(spring=-1600,coulomb=0) {
  const observations=Array.from({length:79},(_,i)=>{
    const position=Math.sin(i*.741+.3),rate=2*Math.cos(i*1.117+.2),command=Math.sin(i*1.337);
    return {command,position,rate,jointTorque:spring*position+coulomb*Math.sign(rate)};
  });
  return {schema:'worldlaw.observations/v1',source:{label:'Independent authored numerical-execution control',kind:'synthetic_analytic_fixture'},observations};
}
const upload=async(page,source)=>{
  await page.locator('#observation-file').setInputFiles({name:'authored-law.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='79');
};
function expectedPolyline(omega,duration=2,initial=1) {
  const points=Array.from({length:Math.ceil(duration/.02)+1},(_,i)=>({time:Math.min(duration,i*.02),position:initial*Math.cos(omega*Math.min(duration,i*.02))}));
  const xPad=duration*.07,lo=Math.min(...points.map(x=>x.position)),hi=Math.max(...points.map(x=>x.position)),yPad=(hi-lo)*.12;
  return points.map(p=>[68+(p.time+xPad)/(duration+2*xPad)*494,214-(p.position-lo+yPad)/(hi-lo+2*yPad)*196]);
}
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const sandboxPage=await context.newPage(),cdp=await context.newCDPSession(sandboxPage);
  const sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify(sandbox,null,2)+'\n');
  await sandboxPage.close();
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:')&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='64');
  await upload(page,sourceFor());
  await page.locator('#initial-angle').fill('1');await page.locator('#initial-rate').fill('0');
  await page.locator('#duration').fill('2');await page.locator('#inertia').fill('1');
  await page.locator('#run-simulation').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#simulation-status').getAttribute('data-method'),'adaptive_RK4_step_doubling');
  const actual=await page.locator('#trajectory-chart polyline').evaluate(p=>p.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number)));
  const expected=expectedPolyline(40);assert.equal(actual.length,expected.length);
  const worstPixel=Math.max(...actual.map((p,i)=>Math.hypot(p[0]-expected[i][0],p[1]-expected[i][1])));
  assert.ok(worstPixel<.003,'Rendered line differs from independent oscillator by '+worstPixel+' pixels.');
  await page.locator('.dynamics-panel').screenshot({path:resolve(dir,'studio-dynamics-desktop.png')});
  mark('actual imported torque law, keyboard execution and rendered polyline agree with independent analytic motion');

  const stateBefore=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
  const beforeLine=await page.locator('#trajectory-chart polyline').getAttribute('points');
  await page.locator('#inertia').fill('.04');await page.locator('#run-simulation').click();
  assert.equal(await page.locator('#simulation-status').getAttribute('data-method'),'adaptive_RK4_step_doubling');
  assert.notEqual(await page.locator('#trajectory-chart polyline').getAttribute('points'),beforeLine);
  assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),stateBefore);
  await page.locator('#mechanism-canvas').scrollIntoViewIfNeeded();
  const frameA=await page.locator('#mechanism-canvas').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(137);
  const frameB=await page.locator('#mechanism-canvas').evaluate(c=>c.toDataURL());
  assert.notEqual(frameA,frameB);
  mark('changed inertia produces a new successful high-frequency prediction and moving canvas without changing source evidence');

  const downloadPromise=page.waitForEvent('download');await page.locator('#export-session').click();
  const saved=resolve(dir,'notebook.json');await (await downloadPromise).saveAs(saved);
  const notebook=JSON.parse(await readFile(saved,'utf8'));assert.equal(notebook.base.observations.length,79);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='79');
  await page.locator('#session-file').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#simulation-status').dataset.method==='adaptive_RK4_step_doubling');
  assert.equal(await page.locator('#sample-count').innerText(),'79');
  mark('source-only notebook reload and file reopen recompute ordinary refined dynamics');

  await page.locator('#inertia').fill('0');await page.locator('#run-simulation').click();
  assert.match(await page.locator('#simulation-status').innerText(),/Prediction unavailable/);
  assert.equal(await page.locator('#simulation-status').getAttribute('data-method'),null);
  assert.equal(await page.locator('#trajectory-chart polyline').count(),0);
  await page.waitForFunction(()=>document.querySelector('#mechanism-canvas').getAttribute('aria-label').includes('unavailable'));
  assert.equal(await page.locator('#sample-count').innerText(),'79');
  await page.locator('#inertia').fill('1');await page.locator('#run-simulation').click();
  mark('invalid inertia clears old plot, solver method and moving prediction while preserving original rows');

  await upload(page,sourceFor(-4,-.6));
  await page.waitForFunction(()=>document.querySelector('#selected-terms').textContent.includes('Coulomb'));
  await page.locator('#run-simulation').click();
  assert.equal(await page.locator('#simulation-status').getAttribute('data-method'),'classical_RK4');
  assert.match(await page.locator('#simulation-status').innerText(),/no local error control/);
  const conditional=page.locator('#conditional-rate-revision');
  await conditional.getByRole('button',{name:'Fit under nonpositive rate-power assumption'}).click();
  await page.waitForFunction(()=>document.querySelector('#conditional-rate-trajectories polyline'));
  assert.equal(await page.locator('#conditional-rate-trajectories polyline').count(),2);
  assert.match(await conditional.innerText(),/Fixed-step RK4 retained/);
  mark('discontinuous sign-law keeps labeled incumbent execution and existing conditional comparison uses the maintained policy');

  await upload(page,sourceFor());
  await page.waitForFunction(()=>document.querySelector('#selected-terms').textContent.includes('Linear spring'));
  await page.locator('#inertia').fill('1');await page.locator('#duration').fill('2');await page.locator('#run-simulation').click();
  await page.setViewportSize({width:390,height:960});
  await page.locator('#run-simulation').click();
  await page.locator('.dynamics-panel').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.dynamics-panel').screenshot({path:resolve(dir,'studio-dynamics-narrow.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);
  const stillA=await page.locator('#mechanism-canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(100);
  const stillB=await page.locator('#mechanism-canvas').evaluate(c=>c.toDataURL());
  assert.equal(stillA===stillB,true,'Reduced-motion canvas remains still after its next animation frame.');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  mark('390px layout, reduced motion and no browser exceptions or external source transfer');
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify({browser:await browser.version(),checks,worstRenderedPixelError:worstPixel,errors,external,scope:'Authored analytic numerical-execution controls through the actual maintained browser; no physical validation or continuous-time display qualification.'},null,2)+'\n');
} finally {if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
