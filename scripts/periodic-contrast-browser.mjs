import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'/home/ubuntu/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js');
const dir=process.env.BROWSER_ARTIFACT_DIR||'/tmp/hamon-a08b-worldlaw-browser';await fs.mkdir(dir,{recursive:true});
const inputPath=path.join(dir,'authored-pairs.json');
const notebook=syntheticChallenge({effect:0,cycleDriftAmplitude:.3,orderStrategy:'alternating'});
await fs.writeFile(inputPath,JSON.stringify(notebook));
const browser=await puppeteer.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||'/usr/bin/google-chrome-stable',args:['--disable-dev-shm-usage']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];let sandboxReceipt=null;const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const text=selector=>page.$eval(selector,e=>e.textContent);
const set=async(selector,value)=>page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
try{
 const admission=await browser.newPage();
 try{
  await admission.goto('chrome://sandbox',{timeout:8000});
  await admission.waitForFunction(()=>document.body.innerText.includes('You are adequately sandboxed.'),{timeout:8000}).catch(()=>{});
  const raw=await admission.evaluate(()=>({url:location.href,text:document.body.innerText}));
  const required=['PID namespaces','Network namespaces','Seccomp-BPF sandbox','Seccomp-BPF sandbox supports TSYNC'];
  const rows=raw.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const checks=Object.fromEntries(required.map(label=>[label,rows.filter((line,i)=>line===label?rows[i+1]==='Yes':line.startsWith(label)&&/^[\t ]+Yes$/.test(line.slice(label.length))).length===1]));
  checks.layer1=rows.some((line,i)=>line==='Layer 1 Sandbox'?['Namespace','SUID'].includes(rows[i+1]):/^Layer 1 Sandbox[\t ]+(Namespace|SUID)$/.test(line));
  checks.adequate=rows.includes('You are adequately sandboxed.');
  checks.internalURL=['chrome://sandbox','chrome://sandbox/'].includes(raw.url);
  const cdp=await admission.createCDPSession();
  sandboxReceipt={schema:'worldlaw.browser-sandbox-receipt/v1',browser:await cdp.send('Browser.getVersion'),observedAt:new Date().toISOString(),...raw,checks,admitted:Object.values(checks).every(Boolean)};
  await fs.writeFile(path.join(dir,'sandbox.json'),JSON.stringify(sandboxReceipt,null,2));
  assert.equal(sandboxReceipt.admitted,true,'Actual chrome://sandbox did not report every required protection; see sandbox.json');
 }finally{await admission.close();}
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setViewport({width:1280,height:1000});await page.goto((process.env.WORLDLAW_URL||'http://127.0.0.1:4193')+'/unknown-lab.html');await page.waitForSelector('#periodic-inspect');
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await check('source intake and keyboard inspect preserve original result',async()=>{
  await (await page.$('#file')).uploadFile(inputPath);await page.waitForFunction(()=>document.querySelector('#storage').textContent.includes('Imported a user-declared notebook'));assert.equal(await text('#status'),'CHALLENGED');
  await set('#periodic-basis','Authored independent periodic bound; no physical calibration');
  await page.focus('#periodic-inspect');await page.keyboard.press('Enter');
  assert.match(await text('#periodic-status'),/artifact-sensitive-or-unresolved/);assert.match(await text('#periodic-result'),/0.424264/);assert.equal(await text('#status'),'CHALLENGED');
  assert.equal(await page.$eval('#periodic-result svg',e=>e.getAttribute('role')),'img');
 });
 await check('witness is inspectable and explicitly constructed',async()=>{await page.click('#periodic-result summary');assert.match(await text('#periodic-result pre'),/sensorOffset/);assert.match(await text('#periodic-result'),/never a measured or fitted/);await page.click('#periodic-result summary');await page.$eval('#periodic-contrast',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'desktop.png')});});
 const saved=path.join(dir,'worldlaw-periodic-contrast.json');
 await check('actual download and raw-source reopen recompute the same evidence',async()=>{
  await page.click('#periodic-save');for(let i=0;i<100;i++){try{await fs.access(saved);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const raw=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(raw.schema,'worldlaw.periodic-contrast/v1');assert.deepEqual(raw.notebook.trials,notebook.trials);assert.equal(raw.original,undefined);
  await page.reload();await page.waitForSelector('#periodic-open');await (await page.$('#periodic-open')).uploadFile(saved);await page.waitForFunction(()=>document.querySelector('#periodic-status').textContent.includes('Reopened evidence snapshot'));
  assert.match(await text('#periodic-result'),/0.424264/);
 });
 await check('declaration edit and source replacement retire stale result and save',async()=>{
  await set('#periodic-components','[{"period":4,"amplitudeBound":0}]');assert.equal(await text('#periodic-result'),'');assert.equal(await page.$eval('#periodic-save',e=>e.disabled),true);
  await page.click('#periodic-inspect');await (await page.$('#file')).uploadFile(inputPath);await page.waitForFunction(()=>document.querySelector('#periodic-save').disabled);assert.equal(await text('#periodic-result'),'');
  await page.click('#periodic-inspect');assert.match(await text('#periodic-status'),/contrast-remains-outside-screen/);
 });
 await check('invalid reopen clears its file selection and cannot retain prior output',async()=>{
  const bad=path.join(dir,'invalid-periodic.json');await fs.writeFile(bad,JSON.stringify({schema:'wrong'}));
  await (await page.$('#periodic-open')).uploadFile(bad);await page.waitForFunction(()=>document.querySelector('#periodic-status').textContent.includes('Expected periodic-contrast'));
  assert.equal(await page.$eval('#periodic-open',e=>e.value),'');assert.equal(await text('#periodic-result'),'');assert.equal(await page.$eval('#periodic-save',e=>e.disabled),true);
 });
 await check('invalid input refuses and narrow instrument remains within viewport',async()=>{
  await set('#periodic-components','[{"period":4,"amplitudeBound":-1}]');await page.click('#periodic-inspect');assert.match(await text('#periodic-status'),/Amplitude bounds/);assert.equal(await page.$eval('#periodic-save',e=>e.disabled),true);
  await set('#periodic-components','[{"period":4,"amplitudeBound":0.3}]');await page.click('#periodic-inspect');await page.setViewport({width:390,height:844});await page.$eval('#periodic-contrast',e=>e.scrollIntoView({behavior:'instant',block:'start'}));
  const overflow=await page.$eval('#periodic-contrast',e=>e.scrollWidth-e.clientWidth);assert.ok(overflow<=1,`panel overflow ${overflow}`);await page.screenshot({path:path.join(dir,'narrow-controls.png')});await page.$eval('#periodic-result',e=>e.scrollIntoView({behavior:'instant',block:'start'}));await page.screenshot({path:path.join(dir,'narrow-result.png')});
 });
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({results,pageErrors:errors,sandbox:sandboxReceipt},null,2));
}finally{await browser.close();}
