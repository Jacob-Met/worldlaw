import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=process.env.ARTIFACT_DIR||'evidence/conditional-rate';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.BASE_URL||'http://127.0.0.1:4193');
 const rows=n=>Array.from({length:n},(_,i)=>{const rate=-1+2*(i+.5)/n;return {command:0,position:0,rate,jointTorque:-Math.sign(rate)+8*rate-8*rate*Math.abs(rate)}});
 const source={source:{label:'Authored active-law falsification of imposed dissipation',kind:'synthetic'},observations:rows(60),heldOut:rows(20)};
 await page.locator('#observation-file').setInputFiles({name:'active-law.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});await page.waitForFunction(label=>document.querySelector('#source-name').textContent===label,source.source.label);
 await page.locator('#initial-rate').fill('.5');await page.locator('#run-simulation').click();
 const group=page.locator('#conditional-rate-revision'),button=group.getByRole('button',{name:'Fit under nonpositive rate-power assumption'}),limit=group.getByLabel('Conditional maximum absolute speed (rad/s)');
 await limit.fill('1');await button.focus();await page.keyboard.press('Enter');
 await group.locator('[data-status="computed"]').waitFor();assert.match(await group.innerText(),/conditional law predicts them worse/);assert.equal(await group.locator('svg polyline').count(),2);
 const original=await page.locator('#model-heading').innerText();
 await group.scrollIntoViewIfNeeded();await group.screenshot({path:artifacts+'/conditional-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await group.scrollIntoViewIfNeeded();assert.ok(await group.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await group.screenshot({path:artifacts+'/conditional-narrow.png'});
 await limit.fill('0');assert.equal(await group.locator('[data-status="computed"]').count(),0);assert.equal(await group.locator('svg').count(),0);await button.click();assert.match(await group.innerText(),/refused/);assert.equal(await group.locator('svg').count(),0);
 await limit.fill('1');await button.click();assert.equal(await page.locator('#model-heading').innerText(),original);
 const download=page.waitForEvent('download');await page.locator('#export-session').click();const file=await download;const notebook=artifacts+'/conditional-notebook.json';await file.saveAs(notebook);
 await page.reload();await page.locator('#conditional-rate-revision').waitFor();assert.equal(await page.locator('#conditional-rate-revision [data-status="computed"]').count(),0);
 const replacement={...source,source:{label:'Temporary distinct replacement',kind:'synthetic'},heldOut:[]};
 await page.locator('#observation-file').setInputFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Temporary distinct replacement');
 await page.locator('#session-file').setInputFiles({name:'reopened.json',mimeType:'application/json',buffer:await readFile(notebook)});await page.waitForFunction(label=>document.querySelector('#source-name').textContent===label,source.source.label);
 await page.locator('#conditional-rate-revision').getByLabel('Conditional maximum absolute speed (rad/s)').fill('1');await page.locator('#conditional-rate-revision').getByRole('button',{name:'Fit under nonpositive rate-power assumption'}).click();
 await page.locator('#conditional-rate-revision [data-status="computed"]').waitFor();assert.match(await page.locator('#conditional-rate-revision').innerText(),/conditional law predicts them worse/);assert.deepEqual(errors,[]);
 console.log('PASS actual authored import -> explicit conditional fit -> false-assumption held-out harm -> two executed solver traces -> desktop/narrow/reduced-motion/keyboard -> stale and invalid clearing -> original preserved -> notebook export/reopen/recompute.');
}finally{await browser.close();}
