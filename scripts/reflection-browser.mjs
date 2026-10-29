// Actual maintained Studio receiving. Expected values are authored arithmetic
// controls, never computed by importing the reflection implementation.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createProductServer} from '../server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.env.BROWSER_ARTIFACT_DIR||path.join(root,'evidence/reflection-browser'));
await mkdir(output,{recursive:true});
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright entrypoint');
const {chromium}=await import(pathToFileURL(modulePath).href);
const receipt={status:'running',checks:[],screenshots:[],inputs:[],cleanup:{}};
const check=name=>receipt.checks.push(name);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function persist(){await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
function authored(label,positions,torque){return {schema:'worldlaw.observations/v1',source:{label,kind:'authored-control',declaredKind:'authored-control',metadata:{purpose:'Authored numerical receiving control; not physical measurements'}},observations:positions.map(position=>({command:0,position,rate:0,jointTorque:torque(position)})),heldOut:[]};}
const compatible=authored('Authored reflection compatible control',[-2,-1,0,1,2,-2,-1,1,2],p=>3+2*p);
const excluded=authored('Authored reflection excluded control',[-2,-1,1,2,-2,-1,1,2],p=>p*p);
let browser,server,page;
const errors=[];
async function upload(source,name){
 const bytes=Buffer.from(JSON.stringify(source,null,2)+'\n');
 await writeFile(path.join(output,name),bytes);
 receipt.inputs.push({name,bytes:bytes.length,sha256:digest(bytes),label:source.source.label});
 await page.locator('#observation-file').setInputFiles({name,mimeType:'application/json',buffer:bytes});
 await page.getByText(source.source.label,{exact:true}).first().waitFor();
}
async function save(name){
 const pending=page.waitForEvent('download');await page.locator('#export-session').click();
 const download=await pending;const dest=path.join(output,name);await download.saveAs(dest);
 const bytes=await readFile(dest);return {path:dest,bytes:bytes.length,sha256:digest(bytes),notebook:JSON.parse(bytes)};
}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 receipt.browser=browser.version();
 server=process.env.WORLDLAW_URL?null:createProductServer();
 if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 page.on('pageerror',error=>errors.push(error.message));
 const base=process.env.WORLDLAW_URL||`http://127.0.0.1:${server.address().port}`;receipt.url=base;
 await page.goto('chrome://sandbox/');receipt.sandbox=await page.locator('body').innerText();
 assert.match(receipt.sandbox,/You are adequately sandboxed/);
 await page.goto(base);await page.locator('#sample-count').waitFor();
 // Panel course follows the product worker's agreed DOM contract.
 const panel=page.locator('details').filter({has:page.locator(':scope > summary', {hasText:'Challenge odd angle response'})}).first();
 const result=page.locator('#reflection-output');
 async function openPanel(){if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click();}
 async function retired(){assert.ok(!['compatible','excluded','repeat-conflict','insufficient'].includes(await result.getAttribute('data-status')),'Previous scientific conclusion must be retired');}
 async function reset(){await openPanel();assert.equal(await page.locator('#reflection-radius').inputValue(),'');assert.equal(await page.locator('#reflection-exact').isChecked(),false);await retired();}
 async function inspect(status){await page.locator('#reflection-run').click();await page.waitForFunction(expected=>document.querySelector('#reflection-output')?.dataset.status===expected,status);}
 await upload(compatible,'compatible-input.json');
 const before=await save('compatible-before-notebook.json');
 await reset();await page.locator('#reflection-run').click();
 await retired();assert.match(await result.innerText(),/bound|declar|required/i);
 await page.locator('#reflection-radius').fill('0');await page.locator('#reflection-run').click();
 await retired();assert.match(await result.innerText(),/exact/i);
 await page.locator('#reflection-exact').check();await inspect('compatible');
 assert.match(await panel.innerText(),/authored-control/i);
 assert.equal(await page.locator('#reflection-constraint option').count(),3);
 check('Actual nine-row authored import; missing-bound and exact-coordinate refusals; compatible offset with two pairs and zero anchor');
 await page.locator('#reflection-constraint').selectOption('pair-0');
 await page.locator('#reflection-constraint').focus();await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator('#reflection-constraint').inputValue(),'pair-1');
 async function commonBounds(expected){
  const details=result.locator(':scope > details.reflection-exact-values').first();
  await details.locator(':scope > summary').click();
  assert.deepEqual(await details.locator('code').allTextContents(),expected);
 }
 async function rowsEqual(table,source,indices){
  const actual=await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>({index:Number(row.dataset.rowIndex),cells:[...row.querySelectorAll('th,td')].slice(0,5).map(cell=>cell.textContent)})));
  const expected=indices.map(index=>({index,cells:[String(index+1),...['command','position','rate','jointTorque'].map(key=>String(source.observations[index][key]))]}));
  assert.deepEqual(actual.sort((a,b)=>a.index-b.index),expected.sort((a,b)=>a.index-b.index));
 }
 await commonBounds(['3/1','3/1']);
 const allRows=result.locator(':scope > details').filter({has:page.getByText('Inspect every original row in the selected slice, including unmatched angles',{exact:true})});
 await allRows.locator(':scope > summary').click();
 await rowsEqual(allRows.locator('table'),compatible,[0,1,2,3,4,5,6,7,8]);
 await page.locator('#reflection-constraint').selectOption('zero');
 await rowsEqual(page.locator('#reflection-source-table'),compatible,[2]);
 check('Exact common c=3/1; every original compatible row and the zero anchor retain original coordinates and torque');
 const after=await save('compatible-after-notebook.json');assert.deepEqual(after.notebook,before.notebook);
 receipt.notebooks={before:{path:before.path,bytes:before.bytes,sha256:before.sha256},after:{path:after.path,bytes:after.bytes,sha256:after.sha256}};
 check('Read-only compatible inspection preserves complete downloaded notebook');
 await page.locator('#reflection-radius').fill('0.5');await retired();
 await page.locator('#reflection-radius').fill('0');await inspect('compatible');
 await page.locator('#reflection-exact').uncheck();await retired();
 await page.locator('#reflection-exact').check();await page.locator('#reflection-run').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#reflection-output')?.dataset.status==='compatible');
 check('Radius and exact-coordinate edits retire conclusions; actual keyboard inspection recomputes');
 await upload(excluded,'excluded-input.json');await reset();
 const excludedBefore=await save('excluded-before-notebook.json');
 await page.locator('#reflection-radius').fill('0');await page.locator('#reflection-exact').check();await inspect('excluded');
 assert.equal(await page.locator('#reflection-constraint option').count(),2);
 await commonBounds(['4/1','1/1']);
 const gap=result.locator(':scope > details').filter({has:page.getByText('Exact contradiction gap',{exact:true})});
 await gap.locator(':scope > summary').click();assert.deepEqual(await gap.locator('code').allTextContents(),['3/1']);
 await page.locator('#reflection-contradiction').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#reflection-constraint').inputValue(),'pair-1');
 assert.equal(await page.locator('#reflection-evidence').getAttribute('data-witness'),'true');
 await rowsEqual(page.locator('#reflection-source-table'),excluded,[0,1,2,3,4,5,6,7]);
 assert.equal(await page.locator('#reflection-evidence').evaluate(node=>document.activeElement===node),true);
 check('Independent eight-row quadratic control excluded; keyboard contradiction selects lower witness pair-1 and exposes certificate rows');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const composition of ['intervals','mirrored']){
   await page.locator('#reflection-composition').selectOption(composition);
   const name=`reflection-${composition}-${width}.png`;
   const geometry=await page.locator('#reflection-graphic').evaluate(region=>{
    const svg=region.querySelector('svg');
    const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {clientWidth:region.clientWidth,clientHeight:region.clientHeight,scrollWidth:region.scrollWidth,scrollHeight:region.scrollHeight,scrollLeft:region.scrollLeft,scrollTop:region.scrollTop,clientLeft:region.clientLeft,clientTop:region.clientTop,regionRect:rect(region),svgRect:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')??null};
   });
   receipt.graphGeometry??={};receipt.graphGeometry[`${composition}-${width}`]=geometry;await persist();
   assert.ok(geometry.svgRect&&geometry.svgRect.width>0&&geometry.svgRect.height>0,'The scientific SVG must have positive rendered dimensions');
   assert.ok(geometry.viewBox,'The responsive scientific SVG retains its viewBox');
   assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,'Small-control graph fits available width without panning');
   assert.ok(geometry.scrollHeight<=geometry.clientHeight+1,'Small-control graph has no vertical clipping');
   const innerLeft=geometry.regionRect.left+geometry.clientLeft,innerTop=geometry.regionRect.top+geometry.clientTop;
   assert.ok(geometry.svgRect.left>=innerLeft-1&&geometry.svgRect.right<=innerLeft+geometry.clientWidth+1,'Complete SVG width lies inside the graph viewport');
   assert.ok(geometry.svgRect.top>=innerTop-1&&geometry.svgRect.bottom<=innerTop+geometry.clientHeight+1,'Complete SVG height lies inside the graph viewport');
   await panel.screenshot({path:path.join(output,name)});receipt.screenshots.push(name);
   assert.ok(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Reflection panel fits available width');
  }
 }
 check('Both source-grounded scientific compositions fit completely without graph clipping at1440 and390 pixels; geometry and actual frames retained');
 // Receive the offscreen numerical content through actual keyboard scrolling.
 async function keyboardRight(region,name){
  await region.focus();
  assert.equal(await region.evaluate(node=>document.activeElement===node),true);
  const position=()=>region.evaluate(node=>({left:node.scrollLeft,max:node.scrollWidth-node.clientWidth}));
  receipt.horizontalScroll??={};
  const measurements=receipt.horizontalScroll[name]={originalFocus:await position(),keyboardReset:'ArrowLeft',keyboard:'ArrowRight'};
  await persist();
  assert.ok(measurements.originalFocus.max>0,'Narrow source region must expose actual horizontal scrolling');
  // Clicking an offscreen exact-bounds disclosure can already scroll its table
  // right. Establish the starting edge through the same real keyboard interface.
  for(let i=0;i<24;i++)await page.keyboard.press('ArrowLeft',{delay:20});
  measurements.afterLeft=await position();await persist();
  await page.waitForFunction(element=>element.scrollLeft<=1,await region.elementHandle());
  const before=measurements.before=await position();await persist();
  assert.ok(before.left<=1,'Keyboard reset must reach the left edge');
  for(let i=0;i<24;i++)await page.keyboard.press('ArrowRight',{delay:20});
  measurements.afterKeys=await position();await persist();
  await page.waitForFunction(element=>element.scrollLeft>=element.scrollWidth-element.clientWidth-2,await region.elementHandle());
  const after=measurements.after=await position();await persist();
  assert.ok(after.left>before.left,'ArrowRight must produce positive horizontal movement');
  assert.ok(after.left>=after.max-2,'ArrowRight must reach the right edge');
  await region.screenshot({path:path.join(output,name)});receipt.screenshots.push(name);
 }
 // Responsive graphs have already passed full-visibility checks at both widths.
 // Original-reading columns deliberately retain actual keyboard scrolling.
 const sourceScroll=page.locator('#reflection-evidence [data-source-table="selected"] .reflection-table-scroll');
 await page.locator('#reflection-source-table tbody tr').first().locator('td details > summary').click();
 await keyboardRight(sourceScroll,'reflection-source-bounds-390.png');
 check('At390px actual focused ArrowRight scrolling exposes original torque/exact reading bounds; responsive graphs require no panning');

 const excludedAfter=await save('excluded-after-notebook.json');assert.deepEqual(excludedAfter.notebook,excludedBefore.notebook);
 await page.reload();await reset();
 await page.locator('#session-file').setInputFiles(before.path);
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Reopened the notebook'));
 await reset();await page.locator('#reflection-radius').fill('0');await page.locator('#reflection-exact').check();await inspect('compatible');
 const reopened=await save('reopened-notebook.json');assert.deepEqual(reopened.notebook,before.notebook);
 check('Downloaded notebook reopens with declarations reset and recomputes compatible without changing original inputs');
 const repeated=structuredClone(compatible);repeated.source.label='Authored reflection pagination repeat control';
 repeated.observations=Array.from({length:3},()=>compatible.observations.map(row=>({...row}))).flat();
 repeated.source.metadata.purpose='27 repeated authored rows solely to receive pagination; no independent acquisitions';
 await upload(repeated,'pagination-repeat-input.json');await reset();
 const repeatedBefore=await save('pagination-before-notebook.json');
 await page.locator('#reflection-radius').fill('0');await page.locator('#reflection-exact').check();await inspect('compatible');await commonBounds(['3/1','3/1']);
 const allRepeated=result.locator(':scope > details').filter({has:page.getByText('Inspect every original row in the selected slice, including unmatched angles',{exact:true})});
 await allRepeated.locator(':scope > summary').click();
 const rowPages=allRepeated.locator('[data-pagination="Original rows"]');
 await rowsEqual(allRepeated.locator('table'),repeated,Array.from({length:25},(_,i)=>i));
 assert.match(await rowPages.innerText(),/1–25 of 27/);
 await rowPages.locator('[data-page-direction="next"]').focus();await page.keyboard.press('Enter');
 await rowsEqual(allRepeated.locator('table'),repeated,[25,26]);assert.match(await rowPages.innerText(),/26–27 of 27/);
 assert.equal(await rowPages.locator('[data-page-direction="next"]').isDisabled(),true);
 await rowPages.locator('[data-page-direction="previous"]').click();
 await rowsEqual(allRepeated.locator('table'),repeated,Array.from({length:25},(_,i)=>i));
 const repeatedAfter=await save('pagination-after-notebook.json');assert.deepEqual(repeatedAfter.notebook,repeatedBefore.notebook);
 receipt.pagination={rows:27,firstPageRows:25,secondPageRows:2,offset:'3/1',notebookUnchanged:true};
 check('27 repeated compatible rows traverse25+2 original-row pages and return without changingc3 or the notebook');
 receipt.expected={compatibleOffset:'3/1' ,excludedPairOffsets:['1/1','4/1'],excludedGap:'3/1',sourceKind:'authored-control'};

 assert.deepEqual(errors,[]);check('No page exceptions');receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error={name:error.name,message:error.message,stack:error.stack};throw error;}
finally{
 receipt.pageErrors=errors;
 try{if(browser){await browser.close();receipt.cleanup.browserClosed=true;}}
 finally{try{if(server){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));receipt.cleanup.serverClosed=true;}else receipt.cleanup.serverScope='externally-owned';}
 finally{await persist();}}
}
console.log(JSON.stringify(receipt));
