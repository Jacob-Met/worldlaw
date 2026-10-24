import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const dir=process.env.BROWSER_ARTIFACT_DIR;
await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,chromiumSandbox:true});
try {
 const admission=await browser.newPage();await admission.goto('chrome://sandbox');const sandbox=await admission.locator('body').innerText();
 await writeFile(dir+'/sandbox-admission.txt',sandbox);
 assert.match(sandbox,/Layer 1 Sandbox\s+Namespace/i);assert.match(sandbox,/PID namespaces\s+Yes/i);assert.match(sandbox,/Network namespaces\s+Yes/i);assert.match(sandbox,/Seccomp-BPF sandbox\s+Yes/i);assert.match(sandbox,/Seccomp-BPF sandbox supports TSYNC\s+Yes/i);assert.match(sandbox,/You are adequately sandboxed\./i);await admission.close();
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/unknown-lab.html`);
 await page.locator('#construction-open').setInputFiles(new URL('../examples/order-construction.json',import.meta.url).pathname);
 await page.waitForFunction(()=>document.querySelector('#construction-status').textContent.includes('70 complete orders'));
 const original=await page.locator('#construction-status').textContent();assert.match(original,/16 within budget/);
 await page.locator('#order-construction summary').click();assert.equal(await page.locator('#construction-results p').count(),30);await page.locator('#construction-next').click();assert.match(await page.locator('#construction-page').textContent(),/31–60 of 70/);
 const promise=page.waitForEvent('download');await page.locator('#construction-save').click();const saved=dir+'/construction.json';await(await promise).saveAs(saved);
 const raw=JSON.parse(await page.locator('#construction-input').inputValue());raw.maximumVariance=.25;await page.locator('#construction-input').fill(JSON.stringify(raw));await page.locator('#construction-run').click();assert.match(await page.locator('#construction-status').textContent(),/0 within budget; 8 unresolved boundary/);
 await page.locator('#construction-open').setInputFiles(saved);await page.waitForFunction(text=>document.querySelector('#construction-status').textContent===text,original);
 await page.locator('#construction-selection').fill('order-85,order-90');const exported=page.waitForEvent('download');await page.locator('#construction-export').click();const comparison=dir+'/selected.json';await(await exported).saveAs(comparison);await page.locator('#serial-orders-open').setInputFiles(comparison);await page.waitForFunction(()=>document.querySelector('#serial-orders-results').children.length===4);
 await page.locator('#order-construction').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#order-construction').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/narrow.png'});assert.deepEqual(errors,[]);
 const receipt={implementationBaseline:'5a5c105217cb55c64c7ec1b165dd96894418b16c',executionBase:process.env.SOURCE_COMMIT||null,sandbox,exceptions:errors,passed:true,checks:['complete family','paginated rows','unresolved budget boundary','construction replay','explicit selected comparison','narrow no exceptions'],sandboxRequested:true};await writeFile(dir+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(error){await writeFile(dir+'/browser-failure.json',JSON.stringify({passed:false,error:error.message,stack:error.stack,implementationBaseline:'5a5c105217cb55c64c7ec1b165dd96894418b16c',executionBase:process.env.SOURCE_COMMIT||null},null,2));throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
