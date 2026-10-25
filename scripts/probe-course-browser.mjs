import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createProductServer} from '../server.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_PATH?pathToFileURL(process.env.PUPPETEER_PATH).href:'puppeteer');
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const out=process.env.BROWSER_ARTIFACT_DIR||'/tmp/worldlaw-probe-course-browser';await mkdir(out,{recursive:true});
let browser;const errors=[];
try{
 browser=await puppeteer.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});
 await page.goto('http://127.0.0.1:'+server.address().port+'/unknown-lab.html',{waitUntil:'networkidle0'});
 await page.waitForSelector('#probe-choice-mode');
 await page.click('#probe-example');
 await page.waitForFunction(()=>document.querySelector('#probe-state').textContent!=='NO STUDY');
 await page.evaluate(()=>{
  document.querySelector('#probe-choice-offered').lastElementChild.querySelector('button').click();
  const rows=[...document.querySelector('#probe-choice-offered').children];
  for(let i=0;i<2;i++)for(const [key,value]of Object.entries({position:Math.asin(.5),rate:i?.53:.47,cost:1})){const el=rows[i].querySelector('[data-field="'+key+'"]');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
  document.querySelector('#probe-choice-budget').value=2;document.querySelector('#probe-choice-radius').value=.001;
  document.querySelector('#probe-choice-form').requestSubmit();
 });
 assert.match(await page.$eval('#probe-choice-status',e=>e.textContent),/overlapping/);
 await page.select('#probe-choice-mode','course');await page.click('#probe-choice-run');
 await page.waitForFunction(()=>document.querySelector('#probe-choice-status').textContent.startsWith('ALL PAIRS SEPARATED'));
 assert.match(await page.$eval('#probe-choice-detail',e=>e.textContent),/Joint-only separations.*drag \/ restoring/);
 assert.equal(await page.$eval('#probe-choice-export',e=>e.disabled),false);
 // Capture the actual exported Blob without downloading a substitute file.
 await page.evaluate(()=>{
  window.courseBlob=null;const create=URL.createObjectURL.bind(URL);
  URL.createObjectURL=blob=>{window.courseBlob=blob;return create(blob);};
  document.querySelector('#probe-choice-export').click();
 });
 const exported=await page.evaluate(()=>window.courseBlob.text()),raw=JSON.parse(exported);
 assert.equal(raw.schema,'worldlaw.probe-course/v1');assert.deepEqual(Object.keys(raw).sort(),['schema','settings','training']);
 assert.ok(raw.training.runs.every(r=>r.role==='training'));
 raw.selected={ids:['forged']};raw.courses=[];
 await page.$eval('#probe-choice-budget',e=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.evaluate(raw=>{
  const input=document.querySelector('#probe-choice-file'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(raw)],'course.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 },raw);
 await page.waitForFunction(()=>document.querySelector('#probe-choice-status').textContent.startsWith('ALL PAIRS SEPARATED'));
 assert.doesNotMatch(await page.$eval('#probe-choice-status',e=>e.textContent),/forged/);
 await page.$eval('.probe-choice',e=>e.scrollIntoView());await (await page.$('.probe-choice')).screenshot({path:path.join(out,'desktop.png')});
 // Keyboard focus and stale-result retirement use actual DOM events.
 await page.focus('#probe-choice-mode');await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'probe-choice-budget');
 assert.notEqual(await page.$eval('#probe-choice-budget',e=>getComputedStyle(e).outlineStyle),'none');
 await page.$eval('#probe-choice-budget',e=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.$eval('#probe-choice-export',e=>e.disabled),true);
 assert.equal(await page.$$eval('#probe-choice-results tr',es=>es.length),0);
 await page.click('#probe-choice-run');assert.match(await page.$eval('#probe-choice-status',e=>e.textContent),/NO INFORMATIVE COURSE/);
 // An invalid family has no cached recommendation after the failed calculation.
 await page.$eval('#probe-choice-budget',e=>{e.value=2;e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.$eval('#probe-choice-radius',e=>{e.value=1;e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.click('#probe-choice-run');assert.match(await page.$eval('#probe-choice-status',e=>e.textContent),/NO INFORMATIVE COURSE/);
 assert.match(await page.$eval('#probe-choice-detail',e=>e.textContent),/exact coefficient witness/);
 await page.$eval('#probe-choice-radius',e=>{e.value=.001;e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#probe-choice-run');
 await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.$eval('.probe-choice',e=>e.scrollIntoView());
 const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));
 await (await page.$('.probe-choice')).screenshot({path:path.join(out,'narrow.png')});
 assert.deepEqual(errors,[]);
 const receipt={pass:true,groups:8,source:'actual served UNKNOWN LAB panel',screenshots:out,errors,
  requestSha256:createHash('sha256').update(exported).digest('hex'),
  trainingSha256:createHash('sha256').update(JSON.stringify(raw.training)).digest('hex')};
 await writeFile(path.join(out,'request.json'),exported);
 await writeFile(path.join(out,'receiving.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
