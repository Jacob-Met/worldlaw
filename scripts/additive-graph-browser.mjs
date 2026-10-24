import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const output=process.env.BROWSER_ARTIFACT_DIR;await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const fixture=new URL('../examples/sparse-additive-source.json',import.meta.url),dataset=JSON.parse(await readFile(fixture,'utf8'));
const checks=[],check=s=>checks.push(s);
async function open(){const d=page.locator('#separability > details');if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}
async function run(radius){await open();await page.locator('#separability-radius').fill(String(radius));await page.locator('#separability-exact').check();await page.locator('#separability-run').focus();await page.keyboard.press('Enter');}
try{
 await page.goto('chrome://sandbox');const sandbox=await page.locator('body').innerText();assert.match(sandbox,/adequately sandboxed/);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#observation-file').setInputFiles({name:'sparse-additive-source.json',mimeType:'application/json',buffer:Buffer.from(await readFile(fixture))});
 await page.getByText(dataset.source.label,{exact:true}).waitFor();const notebook=await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1'));
 await run(0);assert.equal(await page.locator('#separability-output h3').innerText(),'No complete source rectangles');assert.equal(await page.locator('#additive-graph-output').getAttribute('data-status'),'additivity-excluded');
 assert.equal(await page.locator('#additive-graph-output table tr').count(),7);assert.match(await page.locator('#additive-graph-output').innerText(),/-3/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('worldlaw.notebook.v1')),notebook);check('Actual eight-row authored import exposes six-row contradiction despite zero rectangles; evidence remains unchanged');
 await page.locator('#additive-graph-output > details').first().locator('summary').click();assert.match(await page.locator('#additive-graph-output code').first().innerText(),/-3 × 2\^0/);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});for(const view of ['cycle','coordinates']){await page.locator('#additive-graph-view').selectOption(view);await page.locator('#additive-graph-output').screenshot({path:`${output}/${view}-${width}.png`});assert.ok(await page.locator('#additive-graph-output').evaluate(n=>n.scrollWidth<=n.clientWidth+1));}}
 check('Original signed readings, exact bound, cycle and coordinate-group diagrams received at desktop and narrow viewport');
 await page.locator('#separability-radius').fill('.5');assert.equal(await page.locator('#additive-graph-output').count(),0);await run(.5);
 assert.equal(await page.locator('#additive-graph-output').getAttribute('data-status'),'compatible-on-observed-slice');
 await page.locator('#additive-graph-output').getByText('Inspect all original readings on the slice',{exact:true}).click();assert.equal(await page.locator('#additive-graph-output table').last().locator('tr').count(),9);
 await page.locator('#additive-graph-output').screenshot({path:`${output}/compatible-390.png`});check('Changed declarations invalidate prior result; equality gives constructive finite-slice assignment and every source row');
 await run(.49);assert.equal(await page.locator('#additive-graph-output').getAttribute('data-status'),'additivity-excluded');check('Strictly smaller declared bound restores a source-supported contradiction');
 const event=page.waitForEvent('download');await page.locator('#export-session').click();const download=await event;await download.saveAs(`${output}/source-notebook.json`);
 assert.deepEqual(JSON.parse(await readFile(`${output}/source-notebook.json`,'utf8')).base.observations,dataset.observations);
 await page.locator('#session-file').setInputFiles(`${output}/source-notebook.json`);await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Reopened the notebook'));
 await open();assert.equal(await page.locator('#separability-radius').inputValue(),'');await run(0);assert.equal(await page.locator('#additive-graph-output').getAttribute('data-status'),'additivity-excluded');check('Actual downloaded source notebook reopens, requires new declarations, and reconstructs the witness');
 const conflict={...dataset,source:{...dataset.source,label:'Authored repeat conflict'},observations:[...dataset.observations,{...dataset.observations[0],jointTorque:1}]};
 await page.locator('#observation-file').setInputFiles({name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflict))});await page.getByText('Authored repeat conflict',{exact:true}).waitFor();await run(0);assert.equal(await page.locator('#additive-graph-output').getAttribute('data-status'),'incompatible-replicates');assert.match(await page.locator('#additive-graph-output').innerText(),/not labeled an input interaction/);check('Repeated-reading contradiction remains distinct from an additive interaction claim');
 assert.deepEqual(errors,[]);check('No JavaScript exceptions');await writeFile(`${output}/browser.json`,JSON.stringify({browser:browser.version(),sandbox,checks,errors},null,2));console.log(`${checks.length} browser groups passed`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
