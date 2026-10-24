import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const output=process.env.BROWSER_ARTIFACT_DIR;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const fixture=new URL('../examples/scalar-command-position.json',import.meta.url);
const dataset=JSON.parse(await readFile(fixture,'utf8'));
try{
 await page.goto('chrome://sandbox');const sandbox=await page.locator('body').innerText();assert.match(sandbox,/adequately sandboxed/);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#observation-file').setInputFiles({name:'scalar-command-position.json',mimeType:'application/json',buffer:Buffer.from(await readFile(fixture))});
 await page.getByText(dataset.source.label,{exact:true}).waitFor();
 assert.ok(Number(await page.locator('#heldout-error').innerText())>.4);
 await page.locator('#include-command-position').check();await page.locator('#revise-features').focus();await page.keyboard.press('Enter');
 assert.match(await page.locator('#selected-equation').innerText(),/uθ/);assert.ok(Number(await page.locator('#heldout-error').innerText())<1e-12);
 assert.equal(await page.locator('#history-list li').count(),2);assert.match(await page.locator('#history-list').innerText(),/command\+spring · held-out 0.4324/);
 await page.locator('#simulation-command').fill('.25');await page.locator('#run-simulation').click();
 assert.match(await page.locator('#trajectory-chart').innerText(),/fixed command 0.25/);
 const snapshot=await page.locator('#mechanism-canvas').evaluate(n=>n.toDataURL());
 await page.waitForFunction(old=>document.querySelector('#mechanism-canvas').toDataURL()!==old,snapshot);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const reduced=await page.locator('#mechanism-canvas').evaluate(n=>n.toDataURL());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('#mechanism-canvas').evaluate(n=>n.toDataURL()),reduced);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const downloadEvent=page.waitForEvent('download');await page.locator('#export-session').click();const download=await downloadEvent;await download.saveAs(`${output}/interaction-notebook.json`);
 const saved=JSON.parse(await readFile(`${output}/interaction-notebook.json`,'utf8'));assert.equal(saved.schema,'worldlaw.session/v2');assert.deepEqual(saved.base.observations,dataset.observations);
 const encoded=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));assert.equal(JSON.parse(encoded).schema,'worldlaw.session/v2');
 await page.reload();assert.equal(await page.locator('#include-command-position').isChecked(),true);assert.equal(await page.locator('#history-list li').count(),2);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.locator('.model-panel').screenshot({path:`${output}/model-${width}.png`});
  assert.ok(await page.locator('.model-panel').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 }
 await page.locator('#undo').click();assert.equal(await page.locator('#include-command-position').isChecked(),false);assert.ok(Number(await page.locator('#heldout-error').innerText())>.4);
 await page.locator('#session-file').setInputFiles(`${output}/interaction-notebook.json`);
 await page.waitForFunction(()=>document.querySelector('#include-command-position').checked);assert.equal(await page.locator('#history-list li').count(),2);
 await page.locator('#simulation-command').fill('1000001');await page.locator('#run-simulation').click();assert.match(await page.locator('#simulation-status').innerText(),/Prediction unavailable/);
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/browser.json`,JSON.stringify({browser:browser.version(),sandbox,checks:['actual authored import and failed baseline','keyboard feature revision and heldout improvement','fixed-command dynamics','browser reload retains v2 model history','desktop and narrow model panel','undo preserves failed baseline','actual moving model and reduced-motion freeze','downloaded v2 source notebook reopens and invalid dynamics refuses'],errors},null,2));
 console.log('8 browser checks passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
