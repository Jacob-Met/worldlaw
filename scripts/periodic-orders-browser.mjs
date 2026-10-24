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
 await page.locator('#serial-orders-open').setInputFiles(new URL('../examples/periodic-orders.json',import.meta.url).pathname);
 await page.waitForFunction(()=>document.querySelector('#serial-orders-results').children.length===4);
 const original=await page.locator('#serial-orders-results').textContent();assert.match(original,/1.41421/);assert.match(original,/0.395382/);assert.match(original,/near cancellation, not certified zero/);assert.match(original,/Periodic basis/);
 const promise=page.waitForEvent('download');await page.locator('#serial-orders-save').click();const saved=dir+'/periodic.json';await(await promise).saveAs(saved);
 const raw=JSON.parse(await page.locator('#serial-orders-input').inputValue());raw.periodic.periods=[4.2];await page.locator('#serial-orders-input').fill(JSON.stringify(raw));assert.equal(await page.locator('#serial-orders-results').textContent(),'');await page.locator('#serial-orders-run').click();assert.doesNotMatch(await page.locator('#serial-orders-results').textContent(),/near cancellation/);
 await page.locator('#serial-orders-open').setInputFiles(saved);await page.waitForFunction(text=>document.querySelector('#serial-orders-results').textContent===text,original);
 await page.locator('#serial-orders').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#serial-orders').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/narrow.png'});
 await page.locator('#serial-orders-input').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'serial-orders-run');assert.deepEqual(errors,[]);
 const receipt={implementationBaseline:'fc390452ec7e01fd5d3ce6c99539fadae9bfef93',executionBase:process.env.SOURCE_COMMIT||null,sandbox,exceptions:errors,passed:true,checks:['complete periodic course','changed period','download replay','narrow overflow','keyboard focus','no exceptions'],sandboxRequested:true};await writeFile(dir+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(error){await writeFile(dir+'/browser-failure.json',JSON.stringify({passed:false,error:error.message,stack:error.stack,implementationBaseline:'fc390452ec7e01fd5d3ce6c99539fadae9bfef93',executionBase:process.env.SOURCE_COMMIT||null},null,2));throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
