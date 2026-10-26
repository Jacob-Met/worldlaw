import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/experiment-receipts');
await mkdir(dir,{recursive:true});
const server=createProductServer();
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
let browser;const checks=[];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} versus ${b}`);
const mark=text=>{checks.push(text);console.log('PASS '+text);};
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const sandboxPage=await browser.newPage();
  await sandboxPage.goto('chrome://sandbox');
  const sandboxStatus=await sandboxPage.locator('body').innerText();
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify({browser:await browser.version(),status:sandboxStatus},null,2)+'\n');
  assert.match(sandboxStatus,/Layer 1 Sandbox\s+Namespace/);
  for(const key of ['PID namespaces','Network namespaces','Seccomp-BPF sandbox'])
    assert.match(sandboxStatus,new RegExp(key+'\\s+Yes'));
  await sandboxPage.close();
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
  assert.deepEqual(errors,[],'initial empty experiment history must finish rendering without a page error');
  for(const path of ['experiment-receipts.mjs','experiment-receipts-panel.mjs'])assert.equal((await page.request.get(`${url}/src/science/${path}`)).status(),200);
  assert.equal(await page.locator('#inspect-last-experiment').isVisible(),false);
  await page.locator('#use-proposal').click();await page.locator('#run-experiment').click();
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='65');
  await page.locator('#inspect-last-experiment').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#experiment-receipt-event').evaluate(node=>node===document.activeElement),true);
  assert.match(await page.locator('#experiment-receipts').innerText(),/synthetic virtual instrument/);
  assert.ok(Number(await page.locator('#experiment-receipt-summary').getAttribute('data-before-rmse'))>1);
  assert.equal(await page.locator('#experiment-receipt-chart svg').count(),1);
  mark('Actual virtual acquisition exposes prior prediction loss and keeps its structural alternatives.');
  const source={source:{label:'Authored independent slope control · synthetic',kind:'synthetic'},observations:Array.from({length:8},(_,i)=>({command:i+1,position:0,rate:0,jointTorque:2*(i+1)}))};
  await page.locator('#observation-file').setInputFiles({name:'independent-slope.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='8');
  assert.equal(await page.locator('#inspect-last-experiment').isVisible(),false);
  const enter=async(command,torque)=>{
    for(const [id,value]of Object.entries({command,position:0,rate:0,'measured-torque':torque}))await page.locator('#'+id).fill(String(value));
    await page.locator('#run-experiment').click();
  };
  const chooseCommand=async()=>{
    const value=await page.locator('#experiment-receipt-law option').evaluateAll(options=>options.find(option=>/^\d+\. command ·/.test(option.textContent)).value);
    await page.locator('#experiment-receipt-law').selectOption(value);
  };
  await enter(2,12);await chooseCommand();
  close(Number(await page.locator('#experiment-receipt-summary').getAttribute('data-before-rmse')),8);
  await page.locator('#experiment-receipt-readings summary').click();
  // The native details toggle event is queued after activation. Receive its
  // actual lazily built row before asserting original values; no fixed sleep.
  await page.locator('#experiment-receipt-readings tbody tr').first().waitFor({state:'visible'});
  const cells=await page.locator('#experiment-receipt-readings tbody tr').first().locator('td').allTextContents();
  assert.deepEqual(cells.slice(0,5),['1','2','0','0','12']);close(Number(cells[5]),4);close(Number(cells[6]),8);
  await enter(1,-7);await chooseCommand();
  close(Number(await page.locator('#experiment-receipt-summary').getAttribute('data-before-rmse')),7+27/13);
  await page.locator('#experiment-receipt-event').selectOption('1');await chooseCommand();
  if(!await page.locator('.fit-settings').evaluate(node=>node.open))await page.locator('.fit-settings > summary').click();
  await page.locator('#noise-sigma').waitFor({state:'visible'});
  await page.locator('#noise-sigma').fill('.1');await page.locator('#refit').click();
  assert.equal(await page.locator('#experiment-receipt-event').inputValue(),'1');
  close(Number(await page.locator('#experiment-receipt-summary').getAttribute('data-before-rmse')),8);
  assert.equal(await page.locator('#experiment-receipt-event option').count(),2);
  mark('Independent measured-entry controls preserve same-ID coefficients, earlier-event selection through refit, and raw failed predictions.');
  await enter(0,99);
  assert.equal(await page.locator('#experiment-receipt-event').inputValue(),'4');
  assert.equal(await page.locator('#experiment-receipt-event option').count(),3);
  await page.locator('#inspect-last-experiment').click();
  const before=await page.locator('#experiment-receipt-summary').innerText();
  await page.locator('#measured-torque').fill('');await page.locator('#run-experiment').click();
  assert.equal(await page.locator('#sample-count').innerText(),'11');
  assert.equal(await page.locator('#experiment-receipt-summary').innerText(),before);
  await page.locator('#experiment-receipt-readings summary').click();
  await page.locator('#experiment-receipt-readings tbody tr').first().waitFor({state:'visible'});
  await page.locator('#experiment-receipts').screenshot({path:resolve(dir,'experiment-desktop.png')});
  const layouts=[];
  for(const width of [390,320]){
    await page.setViewportSize({width,height:960});
    await page.waitForFunction(()=>{
      const plot=document.getElementById('experiment-receipt-chart'),svg=plot?.querySelector('svg');
      return svg?.viewBox.baseVal.width===Math.max(280,Math.min(580,plot.clientWidth));
    });
    const typography=await page.locator('#experiment-receipt-chart').evaluate(plot=>{
      const svg=plot.querySelector('svg'),scale=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;
      return {viewBoxWidth:svg.viewBox.baseVal.width,renderedWidth:svg.getBoundingClientRect().width,
        minimumTickPx:Math.min(...[...svg.querySelectorAll('text[font-size]')].map(node=>Number(node.getAttribute('font-size'))*scale)),
        legendPx:parseFloat(getComputedStyle(plot.querySelector('.chart-legend')).fontSize)};
    });
    assert.ok(typography.minimumTickPx>=9,JSON.stringify(typography));
    assert.ok(typography.legendPx>=12,JSON.stringify(typography));
    const measured=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(measured.scroll<=width,JSON.stringify(measured));layouts.push({...measured,typography});
    if(width===390)await page.locator('#experiment-receipts').screenshot({path:resolve(dir,'experiment-narrow.png')});
  }
  mark('New outcome selects its own receipt; blank entry preserves it; exact raw rows remain scrollable at desktop, 390px and 320px.');
  const download=page.waitForEvent('download');await page.locator('#export-session').click();const artifact=await download;
  const file=resolve(dir,'experiment-notebook.json');await artifact.saveAs(file);
  const bytes=await readFile(file,'utf8'),raw=JSON.parse(bytes);
  assert.equal(raw.history,undefined);assert.ok(raw.events.every(event=>event.experiment===undefined));
  const fresh=await browser.newPage({viewport:{width:1440,height:1000}});fresh.on('pageerror',error=>errors.push(error.message));
  await fresh.goto(url);await fresh.locator('#session-file').setInputFiles(file);
  await fresh.waitForFunction(()=>document.getElementById('sample-count').textContent==='11');
  assert.equal(await fresh.locator('#experiment-receipt-summary').innerText(),before);
  await fresh.locator('#experiment-receipt-event').selectOption('1');
  const earlierValue=await fresh.locator('#experiment-receipt-law option').evaluateAll(options=>options.find(option=>/^\d+\. command ·/.test(option.textContent)).value);
  await fresh.locator('#experiment-receipt-law').selectOption(earlierValue);
  close(Number(await fresh.locator('#experiment-receipt-summary').getAttribute('data-before-rmse')),8);
  await fresh.locator('#undo').click();assert.equal(await fresh.locator('#sample-count').innerText(),'10');assert.equal(await fresh.locator('#experiment-receipt-event option').count(),2);
  assert.deepEqual(errors,[]);
  mark('Actual source-only download reopens in a fresh browser context, recomputes original predictions, and undo removes only its outcome.');
  await writeFile(resolve(dir,'receiving.json'),JSON.stringify({browser:await browser.version(),checks,layouts,scope:'Authored synthetic measurements entered through the actual Studio; no physical acquisition, authenticated freeze or calibrated probability claim.'},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
