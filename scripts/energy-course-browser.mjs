import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChallengeServer} from './trajectory-server-92be.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),out=process.env.BROWSER_ARTIFACT_DIR;await mkdir(out,{recursive:true});
const server=createChallengeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[],errors=[];
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
 const guard=await browser.newPage();await guard.goto('chrome://sandbox');const sandbox=await guard.locator('body').innerText();for(const p of [/Layer 1 Sandbox\s+Namespace/,/PID namespaces\s+Yes/,/Network namespaces\s+Yes/,/Seccomp-BPF sandbox\s+Yes/])assert.match(sandbox,p);await guard.close();
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(String(e)));await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);
 await page.waitForFunction(()=>document.querySelector('#trajectory-chart [data-series="predicted"]'));
 await page.locator('#bundle-file').setInputFiles(process.env.ENERGY_READING_SOURCE);
 await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Authored reading compatibility receiving'&&document.querySelector('#challenge-workspace').getAttribute('aria-busy')==='false');
 await page.locator('#model-list button[data-model-id="rate+gravity"]').click();
 const check=async()=>{await page.locator('#check-initial-energy').click();await page.waitForFunction(()=>document.querySelector('#initial-energy').dataset.state==='confined');};
 const compare=async value=>{await page.locator('#initial-energy-reading-radius').fill(value);await page.locator('#compare-initial-energy-readings').click();await page.waitForFunction(()=>!document.querySelector('#initial-energy-reading-output').hidden);};
 const upload=async raw=>page.locator('#open-initial-energy').setInputFiles({name:'question.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
 const save=async name=>{const pending=page.waitForEvent('download');await page.locator('#save-initial-energy').click();const download=await pending,path=resolve(out,name);await download.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
 await page.locator('#initial-position-width').fill('0');await page.locator('#initial-rate-width').fill('0');await check();
 const curve=await page.locator('#trajectory-chart [data-series="predicted"]').getAttribute('points'),bound=await page.locator('#initial-energy-output table').innerText();

 await compare('.5');
 assert.equal(await page.locator('#initial-energy-reading-output').getAttribute('data-state'),'inconclusive');
 assert.equal(await page.locator('#initial-energy-course').getAttribute('data-state'),'conjunction_rejected');
 assert.match(await page.locator('#initial-energy-course').innerText(),/original row 199.*original row 200/);
 assert.equal(await page.locator('#trajectory-chart [data-series="predicted"]').getAttribute('points'),curve);assert.equal(await page.locator('#initial-energy-output table').innerText(),bound);
 checks.push('All201 position intervals overlap while late199/200 speed certificate rejects without changing forecast or bound');
 for(const [name,index,p] of [['earlier',199,'1'],['later',200,'2']]){await page.locator('#initial-energy-course-'+name).click();assert.equal(await page.locator('#initial-energy-reading-page').inputValue(),p);assert.equal(await page.evaluate(()=>document.activeElement.dataset.originalIndex),String(index));}
 checks.push('Both original certificate rows navigate across existing ledger pages');
 const source=await save('course-source.json');assert.deepEqual(source.readingComparison,{angleReadingHalfWidth:.5});assert(!JSON.stringify(source).includes('allowedTravel'));
 await upload({...source,result:{status:'confined',course:{status:'inconclusive'}}});await page.waitForFunction(()=>!document.querySelector('#initial-energy-reading-output').hidden);assert.equal(await page.locator('#initial-energy-course').getAttribute('data-state'),'conjunction_rejected');assert.deepEqual(await save('course-reopened.json'),source);
 checks.push('Source-only reopen recomputes complete speed certificate and ignores cached answers');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.locator('#initial-energy-course details').evaluate(e=>e.open=true);await page.locator('#initial-energy-course').scrollIntoViewIfNeeded();assert(await page.locator('#initial-energy-course').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:resolve(out,`course-${width}.png`)});await page.locator('#initial-energy-course-later').click();const region=page.locator('#initial-energy-reading-output [role="region"]');await region.focus();await region.evaluate(e=>e.scrollLeft=e.scrollWidth);const cells=await page.locator('#initial-energy-reading-output td').evaluateAll(cells=>cells.map(cell=>{const range=document.createRange();range.selectNodeContents(cell);const t=range.getBoundingClientRect(),b=cell.getBoundingClientRect();return t.left>=b.left-.5&&t.right<=b.right+.5;}));assert(cells.every(Boolean));await page.screenshot({path:resolve(out,`course-witness-${width}.png`)});}
 checks.push('Desktop390 exact certificate and ledger remain readable, bounded and keyboard reachable');
 await page.locator('#initial-energy-reading-radius').fill('.6');assert.equal(await page.locator('#initial-energy-course').count(),0);assert(await page.locator('#save-initial-energy').isDisabled());await upload({schema:'invalid'});await page.waitForFunction(()=>document.querySelector('#initial-energy-status').textContent.includes('Question not reopened'));assert.equal(await page.locator('#initial-energy-reading-radius').inputValue(),'.6');assert.equal(await page.locator('#initial-energy-course').count(),0);assert(await page.locator('#save-initial-energy').isDisabled());await compare('.5');await page.locator('#initial-position-width').fill('.1');assert.equal(await page.locator('#initial-energy-course').count(),0);
 checks.push('Radius and starting-width changes retire course; refused replacement preserves dirty draft and save gate');
 await page.locator('#bundle-file').setInputFiles(process.env.ENERGY_CONSTANT_SOURCE);await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Authored constant-angle necessary-condition control'&&document.querySelector('#challenge-workspace').getAttribute('aria-busy')==='false');assert.equal(await page.locator('#initial-energy-course').count(),0);await page.locator('#model-list button[data-model-id="rate+gravity"]').click();await page.locator('#initial-position-width').fill('0');await page.locator('#initial-rate-width').fill('0');await check();await compare('0');assert.equal(await page.locator('#initial-energy-course').getAttribute('data-state'),'inconclusive');assert.match(await page.locator('#initial-energy-course').innerText(),/does not establish an ODE trajectory/);
 checks.push('Replacement source retires prior certificate; constant authored course is explicitly inconclusive');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'receipt.json'),JSON.stringify({checks,errors,sandbox,browser:await browser.version(),scope:'Actual authored ordinary source, unchanged source-only replay, exact common-course certificate and retirement'},null,2)+'\n');console.log(JSON.stringify({checks:checks.length}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
