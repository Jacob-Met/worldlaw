import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {cycleExample,importCycle,evaluateCycle} from '../src/cycle-work/core.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.BROWSER_ARTIFACT_DIR||resolve('.receipts/cycle-work');await mkdir(dir,{recursive:true});
const server=createProductServer();await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
let browser;const checks=[],errors=[];const mark=x=>{checks.push(x);console.log('PASS '+x);};
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/cycle-work.html`);
 await page.waitForFunction(()=>document.querySelector('#input').value.includes('exact-declared'));
 await page.locator('#analyze').focus();await page.keyboard.press('Enter');
 assert.match(await page.locator('#result').innerText(),/^4\.00000 J/);assert.equal(await page.locator('#segments tr').count(),5);assert.equal(await page.locator('#trace polyline').count(),1);
 mark('actual page and keyboard execution show ordered trace and five signed segments');
 await page.locator('#reverse').click();await page.locator('#analyze').click();assert.match(await page.locator('#result').innerText(),/^-4\.00000 J/);
 for(const kind of ['conservative','uncertain']){await page.locator('#example').selectOption(kind);await page.locator('#load').click();await page.locator('#analyze').click();assert.match(await page.locator('#result').innerText(),/zero remains compatible/);}
 await page.locator('#example').selectOption('quadrature');await page.locator('#load').click();await page.locator('#analyze').click();assert.match(await page.locator('#result').innerText(),/^-0\.250000 J/);
 mark('reverse, conservative, uncertainty and nonlinear quadrature controls reach consumer');
 const bad=cycleExample();bad.samples.at(-1).position=.1;await page.locator('#input').fill(JSON.stringify(bad));assert.equal(await page.locator('#trace polyline').count(),0);await page.locator('#analyze').click();assert.match(await page.locator('#error').innerText(),/initial declared angle/);assert.equal(await page.evaluate(()=>document.activeElement.id),'error');
 await page.locator('#example').selectOption('loop');await page.locator('#load').click();await page.locator('#analyze').click();
 const downloaded=page.waitForEvent('download');await page.locator('#save').click();const dl=await downloaded,saved=resolve(dir,'cycle-inputs.json');await dl.saveAs(saved);const reopened=importCycle(await readFile(saved,'utf8'));assert.equal(evaluateCycle(reopened).work,4);assert.equal(reopened.angleAssumption,'exact-declared');
 await page.locator('#example').selectOption('conservative');await page.locator('#load').click();await page.locator('#open').setInputFiles(saved);await page.waitForFunction(()=>JSON.parse(document.querySelector('#input').value).samples[0].jointTorque===1);await page.locator('#analyze').click();assert.match(await page.locator('#result').innerText(),/^4\.00000 J/);
 mark('invalid closure clears old result; actual downloaded inputs reopen and recompute');
 await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){if(this.name==='delayed.json')await new Promise(r=>window.releaseCycleRead=r);return original.call(this);};});
 await page.locator('#open').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cycleExample()))});
 await page.waitForFunction(()=>typeof window.releaseCycleRead==='function');await page.locator('#example').selectOption('conservative');await page.locator('#load').click();await page.evaluate(()=>window.releaseCycleRead());await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>JSON.parse(document.querySelector('#input').value).samples[0].jointTorque),3);await page.locator('#analyze').click();
 mark('late file read cannot replace newer control');
 const layouts=[];for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});const m=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(m.document<=width,JSON.stringify(m));layouts.push(m);if(width!==320)await page.screenshot({path:resolve(dir,`cycle-${width}.png`),fullPage:true});}
 assert.deepEqual(errors,[]);mark('desktop and narrow layouts fit with no runtime errors');
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({checks,layouts,browser:await browser.version(),scope:'Actual browser with authored controls; no physical acquisition claim.'},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
