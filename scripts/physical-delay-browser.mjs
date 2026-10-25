import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/physical-delay');await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];const mark=s=>{checks.push(s);console.log('PASS '+s);};
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const preflight=await browser.newPage();await preflight.goto('chrome://sandbox');const sandbox=await preflight.locator('body').innerText();
  assert.match(sandbox,/(?:Namespace Sandbox\s+Yes|Layer 1 Sandbox\s+Namespace)/i);for(const expression of [/PID namespaces\s+Yes/i,/Network namespaces\s+Yes/i,/Seccomp-BPF sandbox\s+Yes/i])assert.match(sandbox,expression);
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify({sandbox,browser:await browser.version()},null,2));await preflight.close();
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);await page.locator('#residual-structure-panel').waitFor({state:'visible'});
  await page.locator('#residual-lags').fill('1');await page.locator('#inspect-residual-structure').click();
  const sampleStatus=await page.locator('#residual-structure-status').innerText();
  await page.locator('#residual-pair-mode').selectOption('seconds');assert.equal(await page.locator('#residual-structure-panel svg').count(),0);
  assert.equal(await page.locator('#residual-lags').isVisible(),false);assert.equal(await page.locator('#residual-delay-bands').isVisible(),true);
  await page.locator('#residual-delay-bands').fill('.039:.041');await page.locator('#inspect-residual-structure').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#residual-structure-status').innerText(),sampleStatus);mark('maintained solver source reaches explicit physical-delay mode with matching one-step population');
  await page.locator('#residual-structure-panel summary').click();
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.locator('#residual-structure-panel').scrollIntoViewIfNeeded();
    const box=await page.locator('#residual-structure-panel').boundingBox();
    const layout=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
    assert.ok(box.x>=0&&box.x+box.width<=width+1&&layout.documentWidth<=width+1,JSON.stringify({box,layout}));
    const labels=await page.locator('#residual-structure-panel svg').evaluate(svg=>{const v=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {text:t.textContent,inside:b.x>=v.x+2&&b.y>=v.y+2&&b.x+b.width<=v.x+v.width-2&&b.y+b.height<=v.y+v.height-2};});});
    assert.ok(labels.length>=6&&labels.every(x=>x.inside),JSON.stringify({width,labels}));
    assert.ok(page.url().endsWith('/trajectory.html'));
    await page.locator('#residual-structure-panel').screenshot({path:resolve(dir,`physical-delay-app-${width}.png`)});
    await page.screenshot({path:resolve(dir,`physical-delay-app-context-${width}.png`)});
  }
  mark('actual styled trajectory app physical-delay consumer: desktop/narrow signed labels, overflow and original-pair ledger');
  await page.locator('#residual-delay-bands').fill('1:');await page.locator('#inspect-residual-structure').click();assert.match(await page.locator('#residual-structure-status').innerText(),/lower:upper/);assert.equal(await page.locator('#residual-structure-panel svg').count(),0);mark('malformed explicit band refuses after clearing previous authority');
  await page.goto(`http://127.0.0.1:${server.address().port}/health`);
  await page.evaluate(async()=>{const {createResidualStructurePanel}=await import('/src/trajectory/residual-structure-panel.mjs');const anchor=document.createElement('div');document.body.replaceChildren(anchor);createResidualStructurePanel(anchor).render(Array.from({length:400},(_,i)=>({time:i,observed:Math.sin(i),predicted:0})));});
  await page.locator('#residual-pair-mode').selectOption('seconds');await page.locator('#residual-delay-bands').fill('1:400');await page.locator('#inspect-residual-structure').click();
  assert.match(await page.locator('#residual-pair-page-note').innerText(),/1–200 of 79401/);assert.equal(await page.locator('#residual-structure-panel circle').count(),200);
  await page.locator('#residual-structure-panel summary').click();assert.equal(await page.locator('#residual-structure-panel table tr').count(),201);
  assert.equal(await page.locator('#residual-pair-page option').count(),398);
  await page.locator('#residual-pair-page').selectOption('397');assert.equal(await page.locator('#residual-structure-panel circle').count(),1);
  const final=page.locator('#residual-structure-panel table tr').nth(1).locator('td');assert.equal(await final.nth(0).innerText(),'398');assert.equal(await final.nth(1).innerText(),'399');mark('79401pair cohort remains bounded in DOM and exposes final original pair through explicit page selection');
  await page.locator('#residual-delay-bands').fill('1000:2000,398:398');await page.locator('#inspect-residual-structure').click();assert.match(await page.locator('#residual-structure-panel').innerText(),/no original receiving pairs/);assert.equal(await page.locator('#residual-structure-panel svg').count(),0);
  await page.locator('#residual-lag-choice').selectOption('1');assert.equal(await page.locator('#residual-structure-panel circle').count(),1);assert.match(await page.locator('#residual-structure-panel').innerText(),/Only one pair/);mark('empty and single-pair physical cohorts remain explicit without invented correlation');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const box=await page.locator('#residual-structure-panel').boundingBox();assert.ok(box.width<=width);const labels=await page.locator('#residual-structure-panel svg').evaluate(svg=>{const v=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {text:t.textContent,inside:b.x>=v.x+2&&b.y>=v.y+2&&b.x+b.width<=v.x+v.width-2&&b.y+b.height<=v.y+v.height-2};});});assert.ok(labels.length>=6&&labels.every(x=>x.inside),JSON.stringify(labels));await page.locator('#residual-structure-panel').screenshot({path:resolve(dir,`physical-delay-fixture-${width}.png`)});}mark('isolated authored single-pair fixture: desktop/narrow component rendering only');
  assert.deepEqual(errors,[]);await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,browser:await browser.version(),screenshots:{maintainedApp:'physical-delay-app-*.png and physical-delay-app-context-*.png, captured at trajectory.html on maintained solver source before the isolated fixture',isolatedFixture:'physical-delay-fixture-*.png, authored single-pair component only'},scope:'Actual styled product receiving plus separately labelled authored high-pair component course; no physical frequency or independence claim.'},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
