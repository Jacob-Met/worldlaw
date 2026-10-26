import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {admitCourseBrowser} from './course-browser-sandbox.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'/home/ubuntu/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
const dir=process.env.BROWSER_ARTIFACT_DIR||'/tmp/hamon-a08b-worldlaw-range-browser';await fs.mkdir(dir,{recursive:true});
const exact=(orderStrategy,h=.25)=>{const n=syntheticChallenge({orderStrategy});delete n.simulation;for(const t of n.trials)t.jointTorque=(t.history==='conditioned'?h:0)+.04*t.sampleIndex+.3*Math.sin(Math.PI*t.sampleIndex/2);n.sourceNote='Authored exact fixed-period model control, not physical acquisition.';return n;};
const shuffled=exact('shuffled'),alternating=exact('alternating'),failure=exact('alternating',0);failure.trials[1].jointTorque+=.08;failure.trials[5].jointTorque-=.08;
for(const [name,n]of [['shuffled',shuffled],['alternating',alternating],['failure',failure]])await fs.writeFile(path.join(dir,name+'.json'),JSON.stringify(n));
const browser=await puppeteer.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',args:['--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));let sandbox;
const text=s=>page.$eval(s,e=>e.textContent),set=(s,v)=>page.$eval(s,(e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},String(v));
const status=()=>page.$eval('#range-status',e=>e.dataset.status);
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
async function prepare(name){
 await page.$eval('#storage',e=>e.textContent='Waiting for requested source intake');
 await (await page.$('#file')).uploadFile(path.join(dir,name+'.json'));await page.waitForFunction(()=>document.querySelector('#storage').textContent.includes('Imported a user-declared notebook'));
 await set('#periodic-basis','Authored exact-period common sensor bound');await page.click('#periodic-inspect');
 await set('#course-history',.8);await set('#course-basis','Authored pair error .01 and constant-offset/drift bounds');await page.click('#course-run');
}
try{
 sandbox=await admitCourseBrowser(browser,dir);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setViewport({width:1280,height:1000});await page.goto((process.env.WORLDLAW_URL||'http://127.0.0.1:4193')+'/unknown-lab.html');await page.waitForSelector('#range-run');
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await check('original observations reach a conditional offset bracket through actual parent instruments and keyboard',async()=>{
  await prepare('shuffled');await page.focus('#range-run');await page.keyboard.press('Enter');assert.equal(await status(),'bracketed');
  assert.match(await text('#range-result'),/Witness-supported inner interval/);assert.match(await text('#range-result'),/Conservative outer bracket/);assert.match(await text('#range-result'),/not confidence intervals/);
  await page.$eval('#periodic-history-range',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'desktop-range.png')});
 });
 await check('endpoint witness drawer exposes named coefficient units and original row checks',async()=>{
  await page.click('#range-result details summary');const body=await text('#range-result pre');assert.match(body,/historyOffsetNm/);assert.match(body,/cosineCoefficientNm/);assert.match(body,/phaseOriginAcquisitionIndex/);assert.match(body,/witnessCheck/);await page.click('#range-result details summary');
 });
 const saved=path.join(dir,'worldlaw-periodic-history-range.json');
 await check('actual raw-source download and independent reopen retain declared work settings',async()=>{
  await page.click('#range-save');for(let i=0;i<100;i++){try{await fs.access(saved);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const raw=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(raw.schema,'worldlaw.periodic-history-range/v1');assert.deepEqual(raw.course.evidence.notebook.trials,shuffled.trials);assert.equal(raw.inner,undefined);assert.equal(raw.settings.maxQueries,32);
  await page.reload();await page.waitForSelector('#range-open');await (await page.$('#range-open')).uploadFile(saved);await page.waitForFunction(()=>document.querySelector('#range-status').dataset.status==='bracketed');assert.match(await text('#range-status'),/parent inspectors are unchanged/);
 });
 await check('reopened source can be recomputed after range-setting edits without a parent course',async()=>{
  const original=JSON.parse(await fs.readFile(saved,'utf8'));
  await set('#range-resolution',.002);await set('#range-queries',40);await page.click('#range-run');
  assert.equal(await status(),'bracketed');assert.match(await text('#range-status'),/Recomputed reopened independent snapshot; parent inspectors are unchanged/);
  await fs.unlink(saved);await page.click('#range-save');for(let i=0;i<100;i++){try{await fs.access(saved);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const recomputed=JSON.parse(await fs.readFile(saved,'utf8'));assert.deepEqual(recomputed.course,original.course);
  assert.equal(recomputed.settings.resolution,.002);assert.equal(recomputed.settings.maxQueries,40);assert.equal(recomputed.inner,undefined);assert.equal(recomputed.outer,undefined);
  await set('#course-radius',.02);assert.equal(await text('#range-result'),'');assert.equal(await page.$eval('#range-save',e=>e.disabled),true);
  await page.click('#range-run');assert.match(await text('#range-status'),/Check the complete pair course first/);assert.equal(await text('#range-result'),'');
 });
 await check('parent edits invalidate dependent bounds; aliased course exposes prior-limited edge',async()=>{
  await set('#course-radius',.02);assert.equal(await text('#range-result'),'');assert.equal(await page.$eval('#range-save',e=>e.disabled),true);await set('#course-radius',.01);
  await prepare('alternating');await page.click('#range-run');assert.equal(await status(),'bracketed');assert.match(await text('#range-result'),/Upper edge is limited by the declared prior/);
 });
 await check('contradictory course gives no invented interval and work exhaustion stays unresolved',async()=>{
  await prepare('failure');await page.click('#range-run');assert.equal(await status(),'incompatible-course');assert.doesNotMatch(await text('#range-result'),/Witness-supported inner interval/);
  await prepare('shuffled');await set('#range-products',0);await page.click('#range-run');assert.equal(await status(),'unresolved-initial-search');assert.match(await text('#range-result'),/No compatible point or narrower range is claimed/);
  await set('#range-products',16777216);await set('#range-queries',0);await page.click('#range-run');assert.equal(await status(),'unresolved-boundary');assert.match(await text('#range-result'),/query limit reached/);
 });
 await check('frequency-band declaration refuses; final narrow bounds remain readable',async()=>{
  const bad=JSON.parse(await fs.readFile(saved,'utf8'));bad.course.evidence.components[0].band=[3.8,4.2];const file=path.join(dir,'nonconvex-band.json');await fs.writeFile(file,JSON.stringify(bad));await (await page.$('#range-open')).uploadFile(file);await page.waitForFunction(()=>document.querySelector('#range-status').textContent.includes('fixed-period components only'));assert.equal(await text('#range-result'),'');assert.equal(await page.$eval('#range-save',e=>e.disabled),true);
  await set('#range-queries',32);await page.click('#range-run');assert.equal(await status(),'bracketed');await page.setViewport({width:390,height:844});await page.$eval('#periodic-history-range',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'narrow-controls.png')});
  assert.ok(await page.$eval('#periodic-history-range',e=>e.scrollWidth-e.clientWidth)<=1);await page.$eval('#range-result',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'narrow-result.png')});
 });
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({results,errors,sandbox},null,2));
}finally{await browser.close();}
