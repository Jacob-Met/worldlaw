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
  const input=await page.$('#notebook-file');await input.uploadFile(fileURLToPath(new URL('../examples/weak-directional-receiving.json',import.meta.url)));
  await page.waitForFunction(()=>document.querySelector('#method-badge').textContent==='WINDOW TORQUE FIT'&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#directional-quadratic-loss',e=>e.checked),false);
  const before=await page.$eval('#position-rmse',e=>e.textContent);
  await page.focus('#directional-quadratic-loss');await page.keyboard.press('Space');
  assert.equal(await page.$eval('#directional-quadratic-loss',e=>e.checked),true);
  await page.click('#refit');
  await page.waitForFunction(()=>document.querySelector('#selected-equation').textContent.includes('ω²')&&!document.querySelector('#refit').disabled);
  const after=await page.$eval('#position-rmse',e=>e.textContent);
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.exportedBlob=blob;return original.call(this,blob);};});
  await page.click('#export-notebook');
  const exported=await page.evaluate(()=>window.exportedBlob.text());
  const target=fileURLToPath(new URL('../evidence/weak-directional-export-'+width+'.json',import.meta.url));writeFileSync(target,exported);
  await page.click('input[name="method"][value="integral"]');
  assert.equal(await page.$eval('#directional-control',e=>e.hidden),true);
  await (await page.$('#notebook-file')).uploadFile(target);
  await page.waitForFunction(()=>document.querySelector('#directional-quadratic-loss').checked&&!document.querySelector('#refit').disabled);
  assert.equal(await page.$eval('#position-rmse',e=>e.textContent),after);
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('#directional-control').scrollIntoView({block:'center',behavior:'instant'});});
  await page.focus('#directional-quadratic-loss');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const viewport=await page.evaluate(()=>{
   const bounds=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
   return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollY,focused:document.activeElement?.id,control:bounds('#directional-control'),help:bounds('#directional-explanation')};
  });
  assert.equal(viewport.scrollWidth,width);assert.equal(viewport.focused,'directional-quadratic-loss');
  assert.ok(viewport.control.y>=0&&viewport.control.bottom<=viewport.height&&viewport.help.bottom<=viewport.height);
  await page.screenshot({path:fileURLToPath(new URL('../evidence/weak-directional-control-'+width+'.png',import.meta.url)),fullPage:false});
  results.push({width,before,after,reopened:true,keyboardToggle:true,unsupportedMethodHidden:true,viewport});await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
