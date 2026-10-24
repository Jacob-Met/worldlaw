import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';import {reopenRefinement} from '../src/cycle-work/refinement.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/cycle-refinement');await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});let browser;const checks=[],errors=[];
const mark=s=>{checks.push(s);console.log('PASS '+s);};
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/cycle-work.html`);
 await page.locator('#ref-current').click();await page.locator('#ref-plan').click();assert.match(await page.locator('#ref-error').innerText(),/smoothness/);
 await page.locator('#ref-example').click();await page.locator('#ref-plan').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#ref-requests tr').count(),12);assert.match(await page.locator('#ref-status').innerText(),/pending/);assert.match(await page.locator('#ref-comparison').innerText(),/zero-compatible/);
 await page.locator('#ref-simulate').click();assert.match(await page.locator('#ref-status').innerText(),/All requested/);assert.match(await page.locator('#ref-comparison').innerText(),/positive-work/);mark('explicit assumptions, frozen grid and separate analytic acquisition resolve authored branch work');
 const wait=page.waitForEvent('download');await page.locator('#ref-export').click();const dl=await wait,saved=resolve(dir,'refinement-inputs.json');await dl.saveAs(saved);const input=JSON.parse(await readFile(saved,'utf8'));assert.equal(reopenRefinement(input).refined.conclusion,'positive-work');
 await page.locator('#ref-kind').selectOption('conservative');await page.locator('#ref-example').click();await page.locator('#ref-plan').click();await page.locator('#ref-simulate').click();assert.doesNotMatch(await page.locator('#ref-comparison').innerText(),/positive-work/);assert.match(await page.locator('#ref-comparison').innerText(),/zero-compatible/);
 await page.locator('#ref-open').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#ref-comparison').textContent.includes('positive-work'));mark('actual downloaded notebook recomputes; conservative sampling artifact remains enclosed');
 const submission=input.acquisition;submission.readings.pop();await page.locator('#ref-acquisition').fill(JSON.stringify(submission));
 let unexpectedDownloads=0;const countDownload=()=>unexpectedDownloads++;page.on('download',countDownload);
 await page.locator('#ref-export').click();await page.locator('#ref-export').click();assert.match(await page.locator('#ref-error').innerText(),/Receive edited/);assert.equal(await page.locator('#ref-acquisition').inputValue(),JSON.stringify(submission));assert.equal(unexpectedDownloads,0);page.off('download',countDownload);
 await page.locator('#ref-receive').click();assert.match(await page.locator('#ref-status').innerText(),/1 new readings pending/);
 const bad=structuredClone(submission);bad.request.cycle.source+=' stale';await page.locator('#ref-acquisition').fill(JSON.stringify(bad));await page.locator('#ref-receive').click();assert.match(await page.locator('#ref-error').innerText(),/stale or modified/);mark('partial actual readings remain pending and stale request is refused');
 await page.locator('#ref-kind').selectOption('branch');await page.locator('#ref-example').click();await page.locator('#ref-plan').click();await page.locator('#ref-simulate').click();
 await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){if(this.name==='delayed.json')await new Promise(r=>window.releaseRefinement=r);return original.call(this);};});
 await page.locator('#ref-open').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:await readFile(saved)});await page.waitForFunction(()=>typeof window.releaseRefinement==='function');await page.locator('#ref-kind').selectOption('conservative');await page.locator('#ref-example').click();await page.evaluate(()=>window.releaseRefinement());await page.waitForTimeout(100);assert.match(await page.locator('#ref-input').inputValue(),/analytic conservative/);mark('late import cannot replace newer source declarations');
 await page.locator('#ref-plan').click();await page.locator('#ref-simulate').click();const layouts=[];
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});const m=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(m.document<=width,JSON.stringify(m));layouts.push(m);if(width!==320)await page.screenshot({path:resolve(dir,`refinement-${width}.png`),fullPage:true});}
 assert.deepEqual(errors,[]);mark('desktop and narrow consumer has no horizontal overflow or script errors');
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({browser:await browser.version(),checks,layouts,scope:'Authored analytic responses only; conditional curvature assumptions, no physical acquisition.'},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
