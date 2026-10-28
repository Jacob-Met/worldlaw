import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/energy-command-work');
await mkdir(dir,{recursive:true});
const server=createProductServer();
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port,checks=[],errors=[],external=[];
const source={schema:'worldlaw.observations/v1',source:{label:'Authored fixed-command oscillator accounting control',kind:'synthetic_analytic_fixture'},observations:Array.from({length:79},(_,i)=>{
  const position=Math.sin(i*.741+.3),rate=2*Math.cos(i*1.117+.2),command=Math.sin(i*1.337);
  return {position,rate,command,jointTorque:-22500*position+1.5*command};
})};
let browser;
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const preflight=await context.newPage(),cdp=await context.newCDPSession(preflight);
  let sandbox;
  try { sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)}); }
  catch(error) {
    if(error?.receipt)await writeFile(resolve(dir,'sandbox-refusal.json'),JSON.stringify(error.receipt,null,2)+'\n');
    throw error;
  }
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify(sandbox,null,2)+'\n');
  await preflight.close();
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(origin+'/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto(origin);
  await page.locator('#observation-file').setInputFiles({name:'command-oscillator.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.waitForFunction(()=>document.querySelector('#sample-count').textContent==='79');
  await page.locator('.dynamics-details').evaluate(e=>e.open=true);
  async function receive() {
    for(const [id,value] of Object.entries({'initial-angle':'1','initial-rate':'0',inertia:'1',duration:'.501','simulation-command':'-3'}))await page.locator('#'+id).fill(value);
    await page.locator('#run-simulation').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#simulation-status').getAttribute('data-method'),'adaptive_RK4_step_doubling');
    const displayed=Number(await page.locator('#energy-budget tr').filter({has:page.getByRole('rowheader',{name:'Work supplied by command',exact:true})}).locator('td').innerText());
    // Independent closed-form forced oscillator; no energyBudget call.
    const omega=150,equilibrium=-4.5/22500;
    const angle=t=>equilibrium+(1-equilibrium)*Math.cos(omega*t);
    const velocity=t=>-(1-equilibrium)*omega*Math.sin(omega*t);
    const exact=-4.5*(angle(.501)-1);
    let oldTrapezoid=0;
    for(let t=0;t<.501;) {const next=Math.min(.501,t+.02);oldTrapezoid+=(next-t)*(-4.5)*(velocity(t)+velocity(next))/2;t=next;}
    assert.ok(Math.abs(displayed-exact)<.002,JSON.stringify({displayed,exact,oldTrapezoid}));
    assert.ok(Math.abs(displayed-oldTrapezoid)>.05,'Control must distinguish old sampled command-power quadrature.');
    return {displayed,independentAnalyticWork:exact,oldAnalyticTrapezoid:oldTrapezoid,toleranceJ:.002};
  }
  const numeric=await receive();checks.push('authored torque upload, keyboard negative-command execution and analytic work agreement distinguish old quadrature');
  await page.locator('#energy-budget').scrollIntoViewIfNeeded();
  await page.locator('#energy-budget').screenshot({path:resolve(dir,'energy-command-desktop.png')});
  const before=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
  await page.locator('#inertia').fill('0');await page.locator('#run-simulation').click();
  assert.match(await page.locator('#energy-budget').innerText(),/trajectory was refused/);
  assert.equal(await page.locator('#energy-budget table').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),before);
  await receive();checks.push('invalid inertia clears stale energy and leaves source notebook unchanged');
  const downloading=page.waitForEvent('download');await page.locator('#export-session').click();
  const saved=resolve(dir,'notebook.json');await(await downloading).saveAs(saved);
  const notebook=JSON.parse(await readFile(saved,'utf8'));
  assert.equal(notebook.base.observations.length,79);
  for(let i=0;i<79;i++)for(const key of ['position','rate','command','jointTorque'])assert.equal(notebook.base.observations[i][key],source.observations[i][key]);
  // A fresh context proves portable reopen rather than cached localStorage.
  const reopened=await browser.newContext({viewport:{width:390,height:844}}),narrow=await reopened.newPage();
  narrow.on('pageerror',e=>errors.push(e.message));
  narrow.on('request',r=>{if(!r.url().startsWith(origin+'/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await narrow.goto(origin);await narrow.locator('#session-file').setInputFiles(saved);
  await narrow.waitForFunction(()=>document.querySelector('#sample-count').textContent==='79');
  await narrow.locator('.dynamics-details').evaluate(e=>e.open=true);
  for(const [id,value] of Object.entries({'initial-angle':'1','initial-rate':'0',inertia:'1',duration:'.501','simulation-command':'-3'}))await narrow.locator('#'+id).fill(value);
  await narrow.locator('#run-simulation').focus();await narrow.keyboard.press('Enter');
  assert.equal(Number(await narrow.locator('#energy-budget tr').filter({has:narrow.getByRole('rowheader',{name:'Work supplied by command',exact:true})}).locator('td').innerText()),numeric.displayed);
  await narrow.emulateMedia({reducedMotion:'reduce'});await narrow.locator('#energy-budget').scrollIntoViewIfNeeded();
  assert.ok(await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await narrow.locator('#energy-budget').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await narrow.locator('#energy-budget').screenshot({path:resolve(dir,'energy-command-narrow.png')});
  checks.push('unaltered original observations survive portable fresh-context reopen and 390px keyboard execution');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify({browser:await browser.version(),checks,numeric,errors,external,qualification:'Authored analytic control of displayed model accounting; no physical energy certification.'},null,2)+'\n');
  console.log(JSON.stringify({status:'pass',checks,numeric},null,2));
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
