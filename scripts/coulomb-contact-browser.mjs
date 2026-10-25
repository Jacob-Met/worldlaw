import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'/home/ubuntu/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/local/bin/google-chrome',headless:true});
const errors=[],results=[];mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage();await page.setViewport({width,height:1000});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+(process.env.PORT||18741)+'/trajectory.html');
  await page.waitForFunction(()=>!document.querySelector('#export-notebook').disabled);
  await(await page.$('#notebook-file')).uploadFile(fileURLToPath(new URL('../examples/coulomb-contact-receiving.json',import.meta.url)));
  await page.waitForFunction(()=>document.querySelector('#method-badge').textContent==='WINDOW TORQUE FIT'&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#compare-coulomb-contact',e=>e.checked),false);
  const original=await page.$eval('#position-rmse',e=>e.textContent),equation=await page.$eval('#selected-equation',e=>e.textContent);
  await page.focus('#compare-coulomb-contact');await page.keyboard.press('Space');await page.click('#refit');
  await page.waitForFunction(()=>!!document.querySelector('[data-series="contact"]')&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#position-rmse',e=>e.textContent),original);assert.equal(await page.$eval('#selected-equation',e=>e.textContent),equation);
  const contact=await page.$eval('#contact-comparison',e=>e.textContent);assert.match(contact,/0\.000457 rad RMSE/);
  assert.match(await page.$eval('#model-diagnostics',e=>e.textContent),/Residual mismatch/);
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.exportedBlob=blob;return original.call(this,blob);};});
  await page.click('#export-notebook');const saved=await page.evaluate(()=>window.exportedBlob.text());assert.equal(JSON.parse(saved).schema,'worldlaw.trajectory-notebook/v4');
  const path=fileURLToPath(new URL('../evidence/contact-export-'+width+'.json',import.meta.url));writeFileSync(path,saved);
  await page.click('#compare-coulomb-contact');await page.click('#refit');await page.waitForFunction(()=>document.querySelector('#contact-comparison').hidden&&!document.querySelector('#refit').disabled);
  await(await page.$('#notebook-file')).uploadFile(path);await page.waitForFunction(()=>document.querySelector('#compare-coulomb-contact').checked&&!!document.querySelector('[data-series="contact"]')&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#contact-comparison',e=>e.textContent),contact);
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('#contact-control').scrollIntoView({block:'center',behavior:'instant'});});await page.focus('#compare-coulomb-contact');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const viewport=await page.evaluate(()=>{const r=document.querySelector('#contact-explanation').getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,focus:document.activeElement.id,help:{top:r.top,bottom:r.bottom}};});
  assert.equal(viewport.scrollWidth,width);assert.equal(viewport.focus,'compare-coulomb-contact');assert.ok(viewport.help.top>=0&&viewport.help.bottom<=1000);
  await page.screenshot({path:fileURLToPath(new URL('../evidence/contact-control-'+width+'.png',import.meta.url))});
  await page.evaluate(()=>document.querySelector('#trajectory-chart').scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:fileURLToPath(new URL('../evidence/contact-forecast-'+width+'.png',import.meta.url))});
  results.push({width,original,contact,reopened:true,mismatchRetained:true,viewport});await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
