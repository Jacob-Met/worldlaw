import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {restoreSession} from '../src/session.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/notebook-autosave');
await mkdir(dir,{recursive:true});
if(process.platform==='linux')assert.notEqual(process.getuid(),0,'Run browser receiving as an ordinary user.');
const server=createProductServer();
await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
const origin='http://127.0.0.1:'+server.address().port, key='worldlaw.notebook.v1', checks=[],errors=[];
const sha=text=>createHash('sha256').update(text??'null').digest('hex');
const mark=name=>{checks.push(name);console.log('PASS '+name);};
let browser;
async function open(context,rows){
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(n=>document.getElementById('sample-count')?.textContent===String(n),rows);return page;
}
const saved=page=>page.evaluate(k=>localStorage.getItem(k),key);
async function acquire(page,rows,input={command:0.4,position:1.4,rate:-0.7}){
 for(const [field,value]of Object.entries(input))await page.locator('#'+field).fill(String(value));
 await page.locator('#run-experiment').click();
 await page.waitForFunction(n=>document.getElementById('sample-count').textContent===String(n),rows);
}
async function refit(page,noise){
 const settings=page.locator('.fit-settings');
 if(!await settings.evaluate(node=>node.open))await settings.locator(':scope > summary').click();
 await page.locator('#noise-sigma').fill(noise);await page.locator('#refit').click();
}
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 if(process.platform==='linux'){
  const preflight=await browser.newContext(),page=await preflight.newPage(),cdp=await preflight.newCDPSession(page);
  const sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});
  await writeFile(resolve(dir,'sandbox.json'),JSON.stringify(sandbox,null,2)+'\n');await preflight.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 const first=await open(context,64);
 await first.locator('#use-proposal').focus();await first.keyboard.press('Enter');await first.locator('#run-experiment').click();
 await first.waitForFunction(()=>document.getElementById('sample-count').textContent==='65');
 const seed=await saved(first);assert.equal(restoreSession(seed).discovery.observations.length,65);
 const older=await open(context,65);
 await acquire(first,66);
 const acquired=await saved(first),received=restoreSession(acquired);
 assert.equal(received.discovery.observations.length,66);assert.equal(received.events.at(-1).kind,'virtual');
 await refit(older,'0.023');
 assert.equal(await older.locator('#sample-count').innerText(),'65');
 const after=await saved(older),status=await older.locator('#storage-status').innerText();
 const comparison={seedSha256:sha(seed),acquiredSha256:sha(acquired),afterStaleSaveSha256:sha(after),newEvidenceRetained:after===acquired,firstRows:66,olderRows:65,storageRows:restoreSession(after).discovery.observations.length,status};
 await writeFile(resolve(dir,'comparison.json'),JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison));
 assert.equal(after,acquired,'An older tab must retain the newer saved notebook byte for byte.');
 assert.match(status,/changed outside this tab/i);assert.match(status,/not saved/i);assert.match(status,/export.*before reloading/i);
 mark('completed acquisition survives an older tab refit; its unsaved work remains visible');
 await older.locator('#storage-status').scrollIntoViewIfNeeded();await older.screenshot({path:resolve(dir,'conflict-desktop.png')});
 await older.setViewportSize({width:390,height:900});await older.locator('#storage-status').scrollIntoViewIfNeeded();
 const layout=await older.locator('#storage-status').evaluate(node=>({width:innerWidth,document:document.documentElement.scrollWidth,left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right}));
 assert.ok(layout.left>=0&&layout.right<=390,JSON.stringify(layout));
 await older.screenshot({path:resolve(dir,'conflict-narrow.png')});mark('conflict guidance remains visible at desktop and 390px with reduced motion');
 const downloadPromise=older.waitForEvent('download');await older.locator('#export-session').focus();await older.keyboard.press('Enter');
 const download=await downloadPromise,file=resolve(dir,'older-unsaved-notebook.json');await download.saveAs(file);
 const unsaved=await readFile(file,'utf8'),portable=restoreSession(unsaved);
 assert.equal(portable.discovery.observations.length,65);assert.equal(portable.options.noiseSigma,0.023);assert.equal(portable.events.at(-1).kind,'options');
 assert.equal(await saved(older),acquired);
 const isolated=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),reopen=await open(isolated,64);
 await reopen.locator('#session-file').setInputFiles(file);await reopen.waitForFunction(()=>document.getElementById('sample-count').textContent==='65');
 assert.equal(await reopen.locator('#noise-sigma').inputValue(),'0.023');assert.deepEqual(JSON.parse(await saved(reopen)),JSON.parse(unsaved));
 await isolated.close();mark('keyboard export preserves the older tab changes and opens through the ordinary file importer');
 const fresh=await open(context,66);assert.equal(await saved(fresh),acquired);
 const freshDownload=fresh.waitForEvent('download');await fresh.locator('#export-session').click();const freshFile=resolve(dir,'newer-acquired-notebook.json');await (await freshDownload).saveAs(freshFile);
 const freshText=await readFile(freshFile,'utf8');assert.deepEqual(JSON.parse(freshText),JSON.parse(acquired));assert.deepEqual(restoreSession(freshText).events.at(-1).input,{command:0.4,position:1.4,rate:-0.7});
 await older.locator('#undo').click();assert.equal(await older.locator('#history-list li').count(),2);assert.equal(Number(await older.locator('#noise-sigma').inputValue()),restoreSession(seed).options.noiseSigma);assert.equal(await saved(older),acquired);assert.match(await older.locator('#storage-status').innerText(),/changed outside this tab/i);
 await fresh.reload();await fresh.waitForFunction(()=>document.getElementById('sample-count').textContent==='66');
 await refit(first,'0.031');
 assert.match(await first.locator('#storage-status').innerText(),/Notebook saved on this browser/);
 assert.equal(restoreSession(await saved(first)).discovery.observations.length,66);
 mark('fresh visits reopen acquired evidence; repeated stale saves refuse and the current writer can still save');
 await context.close();
 const empty=await browser.newContext({viewport:{width:1440,height:1000}}),a=await open(empty,64),b=await open(empty,64);
 assert.equal(await saved(a),null);
 await refit(a,'0.019');const created=await saved(a);
 await acquire(b,65);assert.equal(await saved(b),created);assert.match(await b.locator('#storage-status').innerText(),/changed outside this tab/i);
 await empty.close();mark('a tab opened before the first stored notebook cannot overwrite its later creation');
 assert.deepEqual(errors,[]);
 await writeFile(resolve(dir,'receipt.json'),JSON.stringify({product:'WORLDLAW',platform:process.platform,browser:await browser.version(),node:process.version,uid:process.getuid?.(),checks,comparison,layout,source:'Seed17 maintained virtual instrument; controlled synthetic observations',scope:'Sequential stale-source detection and recoverable export in the actual served Studio. No atomic multi-tab locking or physical measurement claim.'},null,2)+'\n');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
