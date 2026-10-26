import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';

export async function receiveViscousComparison({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const open=async()=>{await evaluate("document.getElementById('inertia-lab').open=true;document.getElementById('viscous-lab').open=true");};
 const importValue=async(value,name='viscous-input.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById('viscous-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('viscous-cross')");await open();
 await check('viscous alternative reaches the existing lab and exposes the original separate-motion failure',async()=>{
  await click('viscous-cross');await wait("!document.getElementById('viscous-results').hidden");
  const content=await text('viscous-models');assert.match(content,/0.138719/);assert.match(content,/Separate motion exceeds tolerance/);assert.match(content,/Within declared balance tolerance/);
  assert.match(await text('viscous-status'),/symmetric rank 6\/6.*Neither family/);
  assert.equal(await evaluate("document.querySelectorAll('#viscous-plot [data-viscous-trace]').length"),3);
  assert.match(await text('viscous-source'),/Authored synthetic/);
 });
 let saved,coefficients;
 await check('real comparison download contains original inputs only and reopens into recomputed balances',async()=>{
  coefficients=await text('viscous-coefficients');await click('viscous-save');let files=[];
  for(let i=0;i<80;i++){files=await readdir(downloads);if(files.includes('worldlaw-viscous-study.json'))break;await delay(80);}
  assert.ok(files.includes('worldlaw-viscous-study.json'));saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-viscous-study.json'),'utf8'));
  assert.deepEqual(Object.keys(saved).sort(),['challenge','schema','training']);assert.equal(saved.training.record.courses[0].rows.length,1201);
  await click('viscous-diagonal');assert.doesNotMatch(await text('viscous-models'),/exceeds tolerance/);
  await importValue(saved);await wait("document.getElementById('viscous-source').textContent.includes('Authored cross training')");
  assert.equal(await text('viscous-coefficients'),coefficients);
 });
 await check('changed separate observations change visible errors and paths without changing either training fit',async()=>{
  const before=await evaluate("document.querySelector('#viscous-plot [data-viscous-trace=supplied]').getAttribute('d')");
  const changed=structuredClone(saved);changed.challenge.record.courses[0].rows.forEach(r=>{r.torque[0]+=.3;r.torque[1]-=.4;});changed.challenge.record.source.label='Changed separate force';
  await importValue(changed);await wait("document.getElementById('viscous-receiving').textContent.includes('Changed separate force')");
  assert.equal(await text('viscous-coefficients'),coefficients);
  assert.equal((await text('viscous-models')).match(/Separate motion exceeds tolerance/g).length,2);
  assert.notEqual(await evaluate("document.querySelector('#viscous-plot [data-viscous-trace=supplied]').getAttribute('d')"),before);
 });
 await check('omitted force and rank loss remain visible without successful fallback',async()=>{
  await click('viscous-omitted');assert.equal((await text('viscous-models')).match(/Separate motion exceeds tolerance/g).length,2);
  const weak=structuredClone(saved);weak.challenge=null;weak.training.record.source.label='Unexcited authored source';weak.training.record.courses[0].rows.forEach(r=>{r.position=[.2+.1*r.time,.4-.2*r.time];r.torque=[.1,.2];});
  await importValue(weak);await wait("document.getElementById('viscous-source').textContent.includes('Unexcited')");assert.equal((await text('viscous-models')).match(/Unidentified/g).length,2);assert.doesNotMatch(await text('viscous-models'),/Within declared/);
 });
 await check('bad source and complete-work refusal invalidate the comparison while preserving the last admitted input',async()=>{
  await click('viscous-cross');const bad=structuredClone(saved);bad.challenge.record=structuredClone(bad.training.record);bad.challenge.record.source.label='Renamed training';
  await importValue(bad);await wait("!document.getElementById('viscous-error').hidden");assert.match(await text('viscous-error'),/repeats/);assert.match(await text('viscous-source'),/Authored cross training/);assert.equal(await evaluate("document.getElementById('viscous-results').hidden"),true);
  await click('viscous-run');assert.equal(await evaluate("document.getElementById('viscous-results').hidden"),false);
  const costly=structuredClone(saved);costly.training.settings.stride=4;costly.challenge.settings.stride=4;await importValue(costly);await wait("!document.getElementById('viscous-error').hidden");assert.match(await text('viscous-error'),/complete two-family/);
 });
 await check('new source intent fences a delayed file read',async()=>{
  await evaluate("window.viscousOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='viscous-slow.json')return new Promise(resolve=>window.finishViscous=resolve);return viscousOriginalText.call(this)}");
  await importValue(saved,'viscous-slow.json');await wait("typeof window.finishViscous==='function'");await click('viscous-diagonal');
  await evaluate(`window.finishViscous(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=window.viscousOriginalText`);await delay(80);assert.match(await text('viscous-source'),/Authored diagonal/);
 });
 await check('trusted keyboard comparison activation works after settings invalidate earlier results',async()=>{
  await evaluate("document.getElementById('viscous-width').value='101';document.getElementById('viscous-width').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('viscous-run').focus()");
  assert.equal(await evaluate("document.getElementById('viscous-results').hidden"),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate("document.getElementById('viscous-results').hidden"),false);
 });
 await click('viscous-cross');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await open();await delay(80);
  await check('actual viscous instrument stays legible and within the page at '+width,async()=>{
   const box=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.getElementById('viscous-plot').getBoundingClientRect().width,paths:document.querySelectorAll('#viscous-plot path').length})");assert.ok(box.scroll<=box.width+1,JSON.stringify(box));assert.ok(box.plot>220&&box.paths===3,JSON.stringify(box));
  });
  const clip=await evaluate("(()=>{const r=document.getElementById('viscous-lab').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`viscous-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 const source=createViscousExample('cross');assert.equal(source.training.record.courses[0].rows.length,saved.training.record.courses[0].rows.length);
}
