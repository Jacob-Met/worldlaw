import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
import {restoreSession} from '../src/session.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/soft-l1');
await mkdir(directory,{recursive:true});
const original=await readFile(resolve('examples/synthetic-reading-spikes.json'));
const source=JSON.parse(original),checks=[],errors=[],external=[];
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const server=createProductServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const cdp=await browser.newBrowserCDPSession();
  const command=await cdp.send('Browser.getBrowserCommandLine');
  assert.ok(!command.arguments.some(arg=>arg==='--no-sandbox'||arg==='--disable-setuid-sandbox'));
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:'))external.push(request.url());});
  await page.goto(origin);await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
  await page.locator('#observation-file').setInputFiles({name:'authored-reading-spikes.json',mimeType:'application/json',buffer:original});
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='121');
  const before=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));
  assert.ok(before>1);assert.ok(!(await page.locator('#selected-terms').innerText()).includes('Actuation'));
  await page.locator('.fit-settings summary').click();
  await page.locator('#reading-loss').selectOption('soft_l1');await page.locator('#loss-scale').fill('.03');
  assert.match(await page.locator('#loss-choice-status').innerText(),/Unapplied/);
  assert.equal(Number((await page.locator('#heldout-error').innerText()).replaceAll(',','')),before);
  await page.locator('#refit').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('reading-loss-result').textContent.includes('121 readings'));
  const after=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));
  const rawError=Number((await page.locator('#training-error').innerText()).replaceAll(',',''));
  assert.ok(after<.004);assert.ok(rawError>2.4);
  assert.match(await page.locator('#selected-terms').innerText(),/Actuation/);
  assert.match(await page.locator('#diagnostics').innerText(),/Residual mismatch/);
  assert.equal(await page.locator('#history-list li').count(),2);
  assert.match(await page.locator('#simulation-status').innerText(),/RK4/);
  mark('actual imported source -> explicit keyboard-applied loss -> changed executable law; raw mismatch retained');

  await page.locator('#reading-loss-result summary').click();
  assert.equal(await page.locator('#reading-loss-result tbody tr').count(),121);
  const observed=Number((await page.locator('#reading-loss-result tr[data-source-row="3"] td').nth(4).innerText()).replaceAll(',',''));
  assert.ok(Math.abs(observed-source.observations[3].jointTorque)<.01);
  assert.equal(await page.locator('.loss-diagnostic-note').count(),3);
  await page.locator('#reading-loss-result summary').click();
  await page.locator('.model-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(directory,'soft-l1-desktop.png')});
  mark('every original reading remains inspectable; ordinary-refit diagnostics identify the different loss');

  const downloading=page.waitForEvent('download');await page.locator('#export-session').click();
  const download=await downloading,saved=resolve(directory,'soft-l1-notebook.json');await download.saveAs(saved);
  const savedText=await readFile(saved,'utf8'),raw=JSON.parse(savedText),native=restoreSession(savedText);
  assert.equal(raw.schema,'worldlaw.session/v3');assert.equal(raw.discovery,undefined);
  assert.deepEqual(raw.base.observations,source.observations);
  assert.equal(native.discovery.selected.id,'command+spring+quadratic');
  await page.reload();await page.waitForFunction(()=>document.getElementById('reading-loss-result').textContent.includes('Soft-L1 fit'));
  await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('reading-loss-result').textContent==='');
  assert.equal(await page.locator('#reading-loss').inputValue(),'least_squares');
  await page.locator('#session-file').setInputFiles(saved);await page.waitForFunction(()=>document.getElementById('reading-loss-result').textContent.includes('Soft-L1 fit'));
  mark('download contains original inputs and explicit v3 history; reload, undo and portable reopen recompute');

  await page.locator('.fit-settings summary').click();await page.locator('#loss-scale').fill('0');
  await page.locator('#refit').focus();await page.keyboard.press('Enter');
  await page.locator('#error').waitFor({state:'visible'});
  assert.match(await page.locator('#error').innerText(),/scale/i);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'error');
  assert.match(await page.locator('#reading-loss-result').innerText(),/Soft-L1 fit at 0.03/);
  assert.equal(await page.locator('#history-list li').count(),2);
  mark('invalid scale focuses an error without replacing the law, evidence or history');

  await page.locator('#session-file').setInputFiles(saved);
  await page.setViewportSize({width:390,height:900});
  await page.locator('.model-panel').scrollIntoViewIfNeeded();
  const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(width.document<=width.viewport,JSON.stringify(width));
  await page.screenshot({path:resolve(directory,'soft-l1-mobile.png')});
  await page.locator('#reading-loss-result summary').click();
  const scroll=page.locator('#reading-loss-result .prediction-sensitivity-scroll');
  await scroll.scrollIntoViewIfNeeded();await scroll.focus();await page.keyboard.press('ArrowRight');
  const table=await scroll.evaluate(element=>({client:element.clientWidth,scroll:element.scrollWidth}));
  assert.ok(table.scroll>table.client);assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=390);
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  await page.screenshot({path:resolve(directory,'soft-l1-mobile-readings.png')});
  mark('390px workflow and scrollable full-reading table preserve keyboard access without document overflow');

  const hard=Array.from({length:35},(_,i)=>{const command=Math.sin(i*1.3),position=Math.cos(i*.7),rate=Math.sin(i*2.3);return {command,position,rate,jointTorque:Math.sin(i*1.73)*100+position**5};});
  await page.locator('#observation-file').setInputFiles({name:'unresolved-authored-course.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({observations:hard,source:{label:'Authored unresolved numerical control'}}))});
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='35');
  const retained=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
  if((await page.locator('.fit-settings').getAttribute('open'))===null)await page.locator('.fit-settings summary').click();
  await page.locator('#reading-loss').selectOption('soft_l1');await page.locator('#loss-scale').fill('0.0000001');
  await page.locator('#refit').click();await page.locator('#error').waitFor({state:'visible'});
  assert.match(await page.locator('#error').innerText(),/No partially optimized ranking/);
  assert.equal(await page.locator('#reading-loss-result').innerText(),'');
  assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),retained);
  mark('real unresolved candidate refuses the complete comparison; no successful fallback is displayed or saved');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(resolve(directory,'receipt.json'),JSON.stringify({browser:await browser.version(),sandboxDisabled:false,
    sourceSHA256:createHash('sha256').update(original).digest('hex'),checks,
    metrics:{beforeHeldOutRMSE:before,afterHeldOutRMSE:after,rawTrainingRMSE:rawError},width,
    scope:'Authored source controls through the actual local product. No physical calibration, blind validation or deployment.'},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
