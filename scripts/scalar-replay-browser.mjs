import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createProductServer} from '../server.mjs';
import {createSession,refitSession,exportSession,restoreSession} from '../src/session.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length+3);
const out = resolve(process.env.BROWSER_ARTIFACT_DIR || '.receipts/scalar-replay-browser');
await mkdir(out,{recursive:true});
const input = JSON.parse(await readFile(arg('input'),'utf8'));
let state = createSession(input.dataset,input.initialOptions);
for(const options of input.revisions) state = refitSession(state,options);
const notebook = exportSession(state), hash = value => createHash('sha256').update(value).digest('hex');
const variants = [];
if(arg('baseline-root')) {
  const module = await import(pathToFileURL(resolve(arg('baseline-root'),'server.mjs')));
  variants.push({name:'baseline',createServer:module.createProductServer});
}
variants.push({name:'candidate',createServer:createProductServer});
const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH}: {})});
const records = [];
try {
  for(const variant of variants) {
    const server = variant.createServer();
    await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
    const context = await browser.newContext({viewport:{width:1440,height:960}}), page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors=[], external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(!request.url().startsWith(`http://127.0.0.1:${server.address().port}`))external.push(request.url());});
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
      const start=performance.now();
      await page.locator('#session-file').setInputFiles({name:'recorded-notebook.json',mimeType:'application/json',buffer:Buffer.from(notebook)});
      await page.waitForFunction(count=>document.getElementById('sample-count').textContent===String(count),state.discovery.observations.length);
      await page.waitForFunction(count=>document.querySelectorAll('#history-list li').length===count,state.history.length);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const openMs=performance.now()-start;
      assert.equal(await page.locator('#candidate-count').innerText(),String(state.discovery.candidates.length));
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#export-session').click();
      const download=await downloadPromise, saved=resolve(out,`${variant.name}-notebook.json`);
      await download.saveAs(saved);
      const savedText=await readFile(saved,'utf8');
      assert.equal(savedText,notebook,'complete original input history must export unchanged');
      const displayed={terms:await page.locator('#selected-terms').innerText(),heldOut:await page.locator('#heldout-error').innerText()};
      await page.locator('.fit-settings summary').click();
      await page.locator('#noise-sigma').fill('.07');
      const refitStart=performance.now();
      await page.locator('#refit').focus();await page.keyboard.press('Enter');
      await page.waitForFunction(count=>document.querySelectorAll('#history-list li').length===count,state.history.length+1);
      const refitMs=performance.now()-refitStart;
      await page.locator('#noise-sigma').fill('0');
      await page.locator('#refit').click();
      await page.locator('#error').waitFor({state:'visible'});
      assert.equal(await page.locator('#history-list li').count(),state.history.length+1,'invalid assumption must not add a revision');
      await page.locator('#session-file').setInputFiles({name:'recorded-notebook.json',mimeType:'application/json',buffer:Buffer.from(notebook)});
      await page.waitForFunction(count=>document.querySelectorAll('#history-list li').length===count,state.history.length);
      await page.screenshot({path:resolve(out,`${variant.name}-desktop.png`)});
      await page.setViewportSize({width:390,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'narrow layout must fit');
      await page.screenshot({path:resolve(out,`${variant.name}-narrow.png`)});
      await page.reload();
      await page.waitForFunction(count=>document.querySelectorAll('#history-list li').length===count,state.history.length);
      assert.equal(await page.locator('#sample-count').innerText(),String(state.discovery.observations.length));
      // New original evidence and deliberately forged derived answers are
      // received through the actual file picker. Saved fits must not survive.
      const altered=JSON.parse(notebook);
      altered.base.observations[0].jointTorque+=10;
      altered.base.source.label='Changed original numerical source';
      altered.discovery={selected:{id:'forged-answer',terms:[]}};
      const alteredText=JSON.stringify(altered), expected=restoreSession(alteredText);
      await page.locator('#session-file').setInputFiles({name:'changed-source.json',mimeType:'application/json',buffer:Buffer.from(alteredText)});
      await page.waitForFunction(label=>document.getElementById('source-name').textContent===label,altered.base.source.label);
      const alteredDownload=page.waitForEvent('download');await page.locator('#export-session').click();
      const changedPath=resolve(out,`${variant.name}-changed.json`);await (await alteredDownload).saveAs(changedPath);
      assert.equal(await readFile(changedPath,'utf8'),exportSession(expected));
      assert.notEqual(expected.discovery.selected.metrics.rmse,state.discovery.selected.metrics.rmse);
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
      records.push({variant:variant.name,openMs,refitMs,rows:state.discovery.observations.length,
        events:state.events.length,notebookSha256:hash(savedText),displayed,
        checks:['actual file reopen and all history','unchanged source-only export','keyboard noise revision',
          'invalid assumption atomic refusal','390px layout','local persistence reload','changed original source recomputed; forged fit ignored','no page errors or external requests']});
      console.log(`PASS ${variant.name}: original notebook, live refit, refusal, reload and changed source`);
    } finally {await context.close();await new Promise(resolve=>server.close(resolve));}
  }
  if(records.length===2) {
    assert.deepEqual(records[0].displayed,records[1].displayed);
    assert.equal(records[0].notebookSha256,records[1].notebookSha256);
  }
  await writeFile(resolve(out,'receipt.json'),JSON.stringify({browser:await browser.version(),records,
    scope:'Actual maintained app receiving, authored numerical original inputs, single browser timing per variant; not physical qualification.'},null,2)+'\n');
} finally {await browser.close();}
