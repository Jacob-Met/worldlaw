import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/residual-epochs');await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const checks=[];const mark=s=>{checks.push(s);console.log('PASS '+s);};
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const sandboxPage=await browser.newPage();await sandboxPage.goto('chrome://sandbox');const sandbox=await sandboxPage.locator('body').innerText();
  assert.match(sandbox,/(?:Namespace Sandbox\s+Yes|Layer 1 Sandbox\s+Namespace)/i);for(const expression of [/PID namespaces\s+Yes/i,/Network namespaces\s+Yes/i,/Seccomp-BPF sandbox\s+Yes/i])assert.match(sandbox,expression);
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify({sandbox,browser:await browser.version()},null,2));await sandboxPage.close();
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);await page.locator('#residual-structure-panel').waitFor({state:'visible'});
  await page.locator('#residual-pair-mode').selectOption('seconds');await page.locator('#residual-delay-bands').fill('.039:.041');await page.locator('#inspect-residual-structure').click();
  await page.locator('#residual-epochs').waitFor({state:'visible'});const defaultBoundaries=await page.locator('#residual-epoch-boundaries').inputValue();
  await page.locator('#inspect-residual-epochs').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#residual-epoch-status').innerText(),/160\/160 original receiving rows/);
  assert.equal(await page.locator('#residual-epoch-timeline svg').count(),1);mark('actual maintained solver rows enter keyboard-operated complete source-epoch attribution');
  await page.locator('#residual-epoch-scope').selectOption('2');const selected=page.locator('#residual-epoch-ledger table tr').nth(1).locator('td');assert.equal(await selected.nth(0).innerText(),'81');
  const parentEvidence=page.locator('#residual-structure-panel > details');if(!await parentEvidence.evaluate(node=>node.open))await parentEvidence.locator(':scope > summary').click();
  const original=page.locator('#residual-structure-panel > details table tr').nth(81).locator('td');
  assert.equal(await selected.nth(3).innerText(),await original.nth(5).innerText());mark('selected source epoch retains exact existing frozen prediction rather than reinitializing it');
  await page.locator('#residual-epoch-scope').selectOption('cross');const cross=page.locator('#residual-epoch-ledger table tr');assert.equal(await cross.count(),4);
  assert.deepEqual(await cross.evaluateAll(rows=>rows.slice(1).map(tr=>[tr.children[1].textContent,tr.children[2].textContent])),[['40','41'],['80','81'],['120','121']]);
  for(const [rowIndex,originalIndex] of [[1,40],[2,80],[3,120]]){
    const values=await cross.nth(rowIndex).locator('td').allTextContents();
    const originalValues=await page.locator('#residual-structure-panel > details table tr').nth(originalIndex).locator('td').allTextContents();
    assert.deepEqual([values[1],values[2],...values.slice(5)],originalValues);
  }
  assert.match(await page.locator('#residual-epoch-page-note').innerText(),/159\/159 original band pairs/);mark('cross-epoch pairs retain exact original indices, timestamps, observations, frozen predictions and errors with complete accounting');
  await page.locator('#residual-epoch-scope').selectOption('3');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.locator('#residual-epochs').scrollIntoViewIfNeeded();
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(layout.scroll<=width+1,JSON.stringify(layout));
    const labels=await page.locator('#residual-epoch-timeline svg').evaluate(svg=>{const v=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {text:t.textContent,inside:b.x>=v.x+2&&b.y>=v.y+2&&b.x+b.width<=v.x+v.width-2&&b.y+b.height<=v.y+v.height-2};});});assert.ok(labels.length>=6&&labels.every(x=>x.inside),JSON.stringify(labels));
    await page.locator('#residual-epochs').screenshot({path:resolve(dir,`epochs-app-${width}.png`)});await page.screenshot({path:resolve(dir,`epochs-context-${width}.png`)});
  }mark('actual styled epoch timeline and exact original-source ledger at desktop and390px, with signed labels inside SVG');
  await page.locator('#residual-epoch-boundaries').fill('0,1');assert.equal(await page.locator('#residual-epoch-timeline svg').count(),0);await page.locator('#inspect-residual-epochs').click();assert.match(await page.locator('#residual-epoch-status').innerText(),/exactly cover/);
  await page.locator('#residual-epoch-boundaries').fill(defaultBoundaries);await page.locator('#inspect-residual-epochs').click();
  await page.locator('#residual-delay-bands').fill('.04:.05');assert.equal(await page.locator('#residual-epochs').isVisible(),false);mark('incomplete boundary declaration refuses, and parent-band edits retire prior attribution');
  await page.locator('#residual-delay-bands').fill('.039:.041');await page.locator('#inspect-residual-structure').click();await page.locator('#inspect-residual-epochs').click();
  const downloading=page.waitForEvent('download');await page.locator('#export-notebook').click();const download=await downloading,path=resolve(dir,'source-notebook.json');await download.saveAs(path);
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){if(this.name==='delayed.json')await new Promise(resolve=>window.releaseEpochRead=resolve);return original.call(this);};});
  await page.locator('#notebook-file').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:await readFile(path)});assert.equal(await page.locator('#residual-epochs').isVisible(),false);
  await page.evaluate(()=>window.releaseEpochRead());await page.locator('#residual-structure-panel').waitFor({state:'visible'});assert.equal(await page.locator('#residual-epochs').isVisible(),false);
  await page.locator('#inspect-residual-structure').click();await page.locator('#inspect-residual-epochs').click();assert.match(await page.locator('#residual-epoch-status').innerText(),/160\/160 original/);mark('pending source retirement and source-only notebook reopen require recomputation of unchanged original forecast attribution');
  assert.deepEqual(errors,[]);await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,browser:await browser.version(),scope:'Actual maintained authored solver source through complete epoch consumer; measured PASCO receiving is separately recorded native exploration, not relabelled browser input.'},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
