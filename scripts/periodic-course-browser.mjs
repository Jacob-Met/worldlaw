import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {admitCourseBrowser} from './course-browser-sandbox.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'/home/ubuntu/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
const dir=process.env.BROWSER_ARTIFACT_DIR||'/tmp/hamon-a08b-worldlaw-course-browser';await fs.mkdir(dir,{recursive:true});
const baseline=syntheticChallenge({effect:0,cycleDriftAmplitude:.3,orderStrategy:'alternating',noiseSigma:1e-8});
const failed=structuredClone(baseline);failed.trials[1].jointTorque+=.08;failed.trials[5].jointTorque-=.08;delete failed.simulation;failed.sourceNote='Authored common-periodic-model failure; two same-phase pair differences changed in opposite directions.';
for(const [name,n]of [['baseline',baseline],['failure',failed]])await fs.writeFile(path.join(dir,name+'.json'),JSON.stringify(n));
const browser=await puppeteer.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',args:['--disable-dev-shm-usage']});
const results=[],errors=[];let sandbox;
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const text=selector=>page.$eval(selector,e=>e.textContent),set=(selector,value)=>page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
const familyStatuses=()=>page.$$eval('#course-result .course-family',items=>items.map(item=>item.dataset.status));
const inspect=async name=>{
 await (await page.$('#file')).uploadFile(path.join(dir,name+'.json'));
 await page.waitForFunction(()=>document.querySelector('#storage').textContent.includes('Imported a user-declared notebook'));
 await set('#periodic-basis','Authored fixed-period common-sensor bound');await page.click('#periodic-inspect');
 await set('#course-basis','Authored total pair error and constant-effect bounds, not noise sigma');
 await page.focus('#course-run');await page.keyboard.press('Enter');
};
try{
 sandbox=await admitCourseBrowser(browser,dir);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setViewport({width:1280,height:1000});
 await page.goto((process.env.WORLDLAW_URL||'http://127.0.0.1:4193')+'/unknown-lab.html');await page.waitForSelector('#course-run');
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await check('aggregate-compatible failure is rejected by both all-pair families through keyboard',async()=>{
  await inspect('failure');assert.match(await text('#periodic-status'),/artifact-sensitive-or-unresolved/);assert.deepEqual(await familyStatuses(),['verified-course-separation','verified-course-separation']);assert.match(await text('#course-result'),/maximum declared support/);
  await page.$eval('#periodic-course',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'desktop-failure.png')});
 });
 await check('full original pair witness and rank limits remain inspectable on compatible evidence',async()=>{
  // Wait for source-specific observed difference instead of a stale generic import label.
  await (await page.$('#file')).uploadFile(path.join(dir,'baseline.json'));
  await page.waitForFunction(()=>document.querySelector('#course-save').disabled);
  await page.click('#periodic-inspect');await page.click('#course-run');
  assert.deepEqual(await familyStatuses(),['verified-course-witness','verified-course-witness']);assert.equal(await page.$$eval('#course-result svg',es=>es.length),2);
  await page.click('#course-result details summary');assert.match(await text('#course-result pre'),/originalPairs/);await page.click('#course-result details summary');
  await page.$eval('#periodic-course',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'desktop-witness.png')});
 });
 const saved=path.join(dir,'worldlaw-periodic-course.json');
 await check('actual raw-input download and reopen retain model bounds and original source',async()=>{
  await page.click('#course-save');for(let i=0;i<100;i++){try{await fs.access(saved);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const raw=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(raw.schema,'worldlaw.periodic-course/v1');assert.deepEqual(raw.evidence.notebook.trials,baseline.trials);assert.equal(raw.zero,undefined);assert.equal(raw.search.maxIterations,1024);
  await page.reload();await page.waitForSelector('#course-open');await (await page.$('#course-open')).uploadFile(saved);await page.waitForFunction(()=>document.querySelector('#course-status').textContent.includes('Reopened course snapshot'));
  assert.deepEqual(await familyStatuses(),['verified-course-witness','verified-course-witness']);
 });
 await check('parent declarations invalidate dependent course and budget exhaustion never becomes a witness',async()=>{
  await set('#periodic-components','[{"period":4,"amplitudeBound":0.3}]');assert.equal(await text('#course-result'),'');assert.equal(await page.$eval('#course-save',e=>e.disabled),true);
  await inspect('failure');await set('#course-iterations',0);await page.click('#course-run');assert.deepEqual(await familyStatuses(),['unresolved','unresolved']);assert.deepEqual(await page.$$eval('#course-result .course-family',items=>items.map(item=>item.dataset.reason)),['iteration-budget','iteration-budget']);assert.doesNotMatch(await text('#course-result'),/verified-course-/);
  await set('#course-iterations',1024);await page.click('#course-run');
 });
 await check('invalid bound and forged-unit reopen refuse without stale certificates',async()=>{
  await set('#course-radius',-1);await page.click('#course-run');assert.match(await text('#course-status'),/pairRadius/);assert.equal(await text('#course-result'),'');
  const wrong=JSON.parse(await fs.readFile(saved,'utf8'));wrong.boundUnits.drift='N*m/s';const file=path.join(dir,'wrong-units.json');await fs.writeFile(file,JSON.stringify(wrong));await (await page.$('#course-open')).uploadFile(file);await page.waitForFunction(()=>document.querySelector('#course-status').textContent.includes('Declare N*m'));assert.equal(await page.$eval('#course-open',e=>e.value),'');
 });
 await check('390px controls and full-pair evidence fit without clipping',async()=>{
  await set('#course-radius',.01);await page.click('#course-run');assert.deepEqual(await familyStatuses(),['verified-course-separation','verified-course-separation']);
  await page.setViewport({width:390,height:844});await page.$eval('#periodic-course',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'narrow-controls.png')});
  assert.ok(await page.$eval('#periodic-course',e=>e.scrollWidth-e.clientWidth)<=1);await page.$eval('#course-result',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'narrow-result.png')});
 });
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({results,errors,sandbox},null,2));
}finally{await browser.close();}
