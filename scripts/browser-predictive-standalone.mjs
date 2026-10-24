#!/usr/bin/env node
/** Receive the actual generated standalone file with networking disabled.
 * Uses embedded reused PASCO evidence; no hosted server or substitute app.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const htmlPath=resolve(process.env.TRAJECTORY_OFFLINE_FILE||join(root,'.receipts/trajectory-experiment-screened-standalone-92be.html'));
const out=resolve(process.env.QA_OUTPUT||join(root,'.receipts/predictive-standalone'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const require=createRequire(import.meta.url),puppeteer=require(process.env.PUPPETEER_PATH||'puppeteer');
await mkdir(out,{recursive:true});
const report={schema:'worldlaw.predictive-standalone-receiving/v1',result:'FAIL',
 scope:'Actual file:// generated consumer; previously reused measured PASCO recordings, no new acquisition or blind physical validation.',
 offline:true,tests:[],errors:[],externalRequests:[],unexpectedLocalRequests:[]};
const mark=name=>report.tests.push(name);let browser;
try{
 const bytes=await readFile(htmlPath),html=bytes.toString('utf8');
 report.artifact={path:htmlPath,bytes:bytes.length,sha256:hash(bytes)};
 const embedded=html.match(/<!-- WORLDLAW_STANDALONE_BUILD (.*?) -->/s);
 assert.ok(embedded,'Generated HTML must retain its embedded source manifest');
 const build=JSON.parse(embedded[1]);assert.equal(build.schema,'worldlaw.trajectory-standalone-build/v1');
 for(const path of ['src/predictive-selection/select.mjs','src/predictive-selection/session.mjs','src/predictive-selection/panel.mjs'])assert.ok(build.sources.some(s=>s.path===path),'Missing bundled source '+path);
 report.bundledPredictiveSources=build.sources.filter(s=>s.path.startsWith('src/predictive-selection/'));
 report.sourceMeaning=build.sourceMeaning;report.buildSourceHead=build.sourceHead;
 browser=await puppeteer.launch({executablePath:process.env.CHROME_BINARY||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run','--disable-extensions','--no-default-browser-check']});report.browser=await browser.version();
 const page=await browser.newPage(),fileURL=pathToFileURL(htmlPath).href;
 page.setDefaultTimeout(60000);await page.setViewport({width:1380,height:1000,deviceScaleFactor:1});await page.setCacheEnabled(false);await page.setOfflineMode(true);
 await page.setRequestInterception(true);page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('request',request=>{
  const url=request.url(),protocol=new URL(url).protocol;
  if(['http:','https:','ws:','wss:'].includes(protocol)){report.externalRequests.push(url);void request.abort();return;}
  if(!url.startsWith('data:')&&!url.startsWith('blob:')&&url.split('#')[0]!==fileURL){report.unexpectedLocalRequests.push(url);void request.abort();return;}
  void request.continue();
 });
 await page.goto(fileURL,{waitUntil:'load'});assert.equal(new URL(page.url()).protocol,'file:');assert.equal(await page.evaluate(()=>navigator.onLine),false);
 await page.select('#example-choice','measured');await page.click('#load-example');await page.waitForFunction(()=>document.getElementById('training-count').textContent==='4002'&&document.getElementById('challenge-workspace').getAttribute('aria-busy')==='false');
 await page.click('input[name="method"][value="weak"]');await page.click('#refit');await page.waitForFunction(()=>document.getElementById('method-badge').textContent==='WINDOW ANGULAR FIT'&&document.getElementById('challenge-workspace').getAttribute('aria-busy')==='false');
 mark('generated file opens offline and consumes its embedded measured example through actual weak-fit UI');
 await page.click('#predictive-run');await page.waitForFunction(()=>document.getElementById('predictive-status').textContent.startsWith('Structure selected'));
 const text=await page.$eval('#predictive-results',e=>e.textContent);assert.match(text,/57 structures offered; 36 complete/);assert.match(text,/Predictive selection: rate\+coulomb\+gravity\+bias/);assert.match(text,/Original weak-fit leader: gravity\+bias/);
 const rows=await page.$$eval('#predictive-results table tr',es=>es.slice(1).map(e=>[...e.querySelectorAll('td')].map(c=>c.textContent)));
 const original=rows.find(r=>r[0]==='gravity+bias'),selected=rows.find(r=>r[0]==='rate+coulomb+gravity+bias');assert.ok(original&&selected);assert.equal(original[2],'0.32297');assert.equal(selected[2],'0.08951');
 report.displayedResults={offered:57,complete:36,original:original[0],selected:selected[0],originalRMSE:original[2],selectedRMSE:selected[2]};
 const polylines=()=>page.$$eval('#predictive-chart polyline',es=>es.map(e=>({model:e.dataset.model,points:e.getAttribute('points')})));
 const before=await polylines();assert.equal(before.length,3);
 mark('offline prediction comparison retains57 offered/36 complete and selected0.08951 versus original0.32297 rad');
 await page.$eval('#predictive-selection',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:join(out,'offline-predictive-desktop.png'),fullPage:false});
 // Exercise the actual browser download, in a fresh directory so prior receipts
 // cannot be mistaken for newly exported evidence.
 const downloads=await mkdtemp(join(out,'downloads-')),cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await page.click('#predictive-save');const notebookPath=join(downloads,'worldlaw-predictive-comparison.json');let notebookBytes;
 for(let i=0;i<100;i++){try{const b=await readFile(notebookPath);JSON.parse(b.toString('utf8'));notebookBytes=b;break;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}await new Promise(ok=>setTimeout(ok,100));}
 assert.ok(notebookBytes,'Actual browser notebook download did not complete');const notebook=JSON.parse(notebookBytes.toString('utf8'));
 assert.equal(notebook.schema,'worldlaw.predictive-notebook/v1');assert.equal(Object.hasOwn(notebook,'selection'),false);assert.equal(notebook.bundle.trainingRuns.length,2);assert.equal(notebook.bundle.challengeRuns.length,1);assert.equal(notebook.options.noiseSigma,.01);
 report.notebook={path:notebookPath,bytes:notebookBytes.length,sha256:hash(notebookBytes)};
 await page.evaluate(()=>{const e=document.getElementById('predictive-noise');e.value='.02';e.dispatchEvent(new Event('input'));});assert.equal(await page.$eval('#predictive-save',e=>e.disabled),true);
 await(await page.$('#predictive-open')).uploadFile(notebookPath);await page.waitForFunction(()=>!document.getElementById('predictive-save').disabled);
 assert.equal(await page.$eval('#predictive-noise',e=>e.value),'0.01');assert.deepEqual(await polylines(),before);assert.deepEqual(await page.$$eval('#predictive-results table tr',es=>es.slice(1).map(e=>[...e.querySelectorAll('td')].map(c=>c.textContent))),rows);
 mark('actual offline download and local-file reopen recompute identical forecasts and restore applied settings');
 report.layouts=[];for(const width of [390,320]){await page.setViewport({width,height:900,deviceScaleFactor:1});await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));const dims=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));assert.ok(dims.page<=width+2,JSON.stringify(dims));report.layouts.push(dims);await page.$eval('#predictive-selection',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:join(out,`offline-predictive-${width}.png`),fullPage:false});}
 mark('offline prediction panel remains readable at390px and320px without horizontal overflow');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.unexpectedLocalRequests,[]);assert.equal(hash(await readFile(htmlPath)),report.artifact.sha256);
 mark('no browser exceptions, network requests or auxiliary local assets; exact generated HTML remained unchanged');report.result='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=error.stack||String(error);throw error;}finally{try{if(browser)await browser.close();}finally{await writeFile(join(out,'offline-browser-receipt.json'),JSON.stringify(report,null,2)+'\n');}}
