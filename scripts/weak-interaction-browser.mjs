import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'/home/ubuntu/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/local/bin/google-chrome',headless:true});
const errors=[];const results=[];mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage();await page.setViewport({width,height:1000});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+(process.env.PORT||18741)+'/trajectory.html');
  await page.waitForFunction(()=>!document.querySelector('#export-notebook').disabled);
  const input=await page.$('#notebook-file');await input.uploadFile(fileURLToPath(new URL('../examples/weak-interaction-receiving.json',import.meta.url)));
  await page.waitForFunction(()=>document.querySelector('#method-badge').textContent==='WINDOW TORQUE FIT'&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#command-position-interaction',e=>e.checked),false);
  const before=await page.$eval('#position-rmse',e=>e.textContent);
  await page.focus('#command-position-interaction');await page.keyboard.press('Space');
  assert.equal(await page.$eval('#command-position-interaction',e=>e.checked),true);
  await page.click('#refit');
  await page.waitForFunction(()=>document.querySelector('#selected-equation').textContent.includes('uθ')&&!document.querySelector('#refit').disabled);
  const after=await page.$eval('#position-rmse',e=>e.textContent);
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.exportedBlob=blob;return original.call(this,blob);};});
  await page.click('#export-notebook');
  const exported=await page.evaluate(()=>window.exportedBlob.text());
  const target=fileURLToPath(new URL('../evidence/weak-interaction-export-'+width+'.json',import.meta.url));writeFileSync(target,exported);
  await page.click('input[name="method"][value="integral"]');
  assert.equal(await page.$eval('#interaction-control',e=>e.hidden),true);
  await (await page.$('#notebook-file')).uploadFile(target);
  await page.waitForFunction(()=>document.querySelector('#command-position-interaction').checked&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#position-rmse',e=>e.textContent),after);
  await page.focus('#command-position-interaction');
  await page.screenshot({path:fileURLToPath(new URL('../evidence/weak-interaction-'+width+'.png',import.meta.url)),fullPage:true});
  results.push({width,before,after,reopened:true,keyboardToggle:true,unsupportedMethodHidden:true});await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
