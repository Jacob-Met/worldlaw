const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const artifacts=process.env.ARTIFACT_DIR || 'evidence/rate-dissipation';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4193');await page.getByRole('button',{name:'Inspect continuous speed interval'}).waitFor({state:'attached'});
await page.locator('.dynamics-details').evaluate(e=>e.open=true);
await page.getByRole('button',{name:'Inspect continuous speed interval'}).click();
assert.match(await page.locator('#energy-budget').innerText(),/nonpositive power throughout/);
const observations=Array.from({length:96},(_,i)=>{const position=Math.sin(i*.37),rate=Math.cos(i*.91);return {command:Math.sin(i*1.7),position,rate,jointTorque:-position-Math.sign(rate)+8*rate-8*rate*Math.abs(rate)}});
await page.locator('#observation-file').setInputFiles({name:'authored-active-pocket.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({source:{label:'Authored interior active-speed pocket',kind:'synthetic'},observations}))});
await page.waitForFunction(()=>document.querySelector('#source-name').textContent.includes('interior active'));
await page.getByLabel('Maximum absolute speed to inspect').fill('1');await page.getByRole('button',{name:'Inspect continuous speed interval'}).click();
assert.match(await page.locator('#energy-budget').innerText(),/Positive rate power exists/);
await page.getByText('Inspect exact rational witness').click();await page.locator('#energy-budget').scrollIntoViewIfNeeded();
await page.screenshot({path:artifacts+'/rate-desktop.png'});
await page.setViewportSize({width:390,height:844});await page.locator('#energy-budget section').scrollIntoViewIfNeeded();
assert.ok(await page.locator('#energy-budget').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:artifacts+'/rate-narrow.png'});
await page.getByLabel('Maximum absolute speed to inspect').fill('-1');await page.getByRole('button',{name:'Inspect continuous speed interval'}).click();
assert.match(await page.locator('#energy-budget').innerText(),/investigation refused/);
assert.doesNotMatch(await page.locator('#energy-budget').innerText(),/Witness speed enclosure/);
await page.reload();await page.getByRole('button',{name:'Inspect continuous speed interval'}).waitFor({state:'attached'});
assert.match(await page.locator('#energy-budget').innerText(),/No interval has been inspected/);
assert.deepEqual(errors,[]);console.log('PASS continuous-domain actual Studio default, authored active pocket, exact witness, narrow layout, invalid clearing, reload query reset');
}finally{await browser.close()}
