import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export async function receiveCirculationBoxes({evaluate,send,check,click,text,wait,outputDir,downloads}){
 const set=raw=>evaluate(`(()=>{const x=document.getElementById('circulation-box-input');x.value=${JSON.stringify(JSON.stringify(raw))};x.dispatchEvent(new Event('input'));})()`);
 const raw=()=>evaluate("JSON.parse(document.getElementById('circulation-box-input').value)");
 await click('circulation-load');await click('circulation-run');
 await evaluate("document.getElementById('circulation-angle-boxes').open=true");
 const counts=await text('counts');
 await check('coordinate boxes use original loop and preserve nominal model receiving',async()=>{
  await click('circulation-box-run');assert.match(await text('circulation-box-result'),/positive-work/);assert.match(await text('circulation-box-result'),/2.0000000/);assert.equal(await text('counts'),counts);
  const r=await raw();r.positionRadii=r.positionRadii.map(()=>[1,1]);r.radiusSource='Authored broad coordinate control';await set(r);
  assert.equal(await text('circulation-box-result'),'');assert.equal(await evaluate("document.getElementById('circulation-box-save').disabled"),true);
  await click('circulation-box-run');assert.match(await text('circulation-box-result'),/zero-compatible/);assert.match(await text('circulation-result'),/Observed polygon work 2 J/);
 });
 await check('keyboard inspection and extremal original row witness',async()=>{
  await set(await raw());assert.equal(await text('circulation-box-result'),'');
  await send('Page.bringToFront');await evaluate("document.getElementById('circulation-box-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await wait("document.getElementById('circulation-box-status').textContent.includes('Complete bounded')");
  await evaluate("(()=>{const x=document.getElementById('circulation-box-extreme');x.value='maximum';x.dispatchEvent(new Event('change'));const r=document.getElementById('circulation-box-row');r.value='5';r.dispatchEvent(new Event('input'));})()");
  const witness=JSON.parse(await text('circulation-box-witness'));assert.equal(witness.row,5);assert.equal(witness.coordinates.length,2);assert.equal(witness.extremum,'maximum');assert.ok(witness.work.integer);
 });
 await check('actual download and fresh reopen preserve declarations without cached conclusions',async()=>{
  await click('circulation-box-save');let file;
  for(let i=0;i<100;i++){file=(await readdir(downloads)).find(n=>n==='worldlaw-coupled-angle-boxes.json');if(file)break;await new Promise(r=>setTimeout(r,40));}assert.ok(file);
  const saved=JSON.parse(await readFile(path.join(downloads,file),'utf8'));assert.equal(saved.schema,'worldlaw.coupling-circulation-angle-boxes/v1');assert.equal(saved.conclusion,undefined);assert.equal(saved.radiusSource,'Authored broad coordinate control');
  await click('circulation-run');await evaluate("document.getElementById('circulation-angle-boxes').open=true");
  const doc=await send('DOM.getDocument'),target=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#circulation-box-open'});await send('DOM.setFileInputFiles',{nodeId:target.nodeId,files:[path.join(downloads,file)]});
  await wait("document.getElementById('circulation-box-status').textContent.includes('Loaded independent')");assert.equal(await text('circulation-box-result'),'');await click('circulation-box-run');assert.match(await text('circulation-box-result'),/zero-compatible/);
 });
 await check('invalid closure radii refuse and valid retry remains available',async()=>{
  const r=await raw();r.positionRadii[0][0]=2;await set(r);await click('circulation-box-run');assert.match(await text('circulation-box-status'),/matching endpoint/);assert.equal(await text('circulation-box-result'),'');
  r.positionRadii[0][0]=1;await set(r);await click('circulation-box-run');assert.match(await text('circulation-box-result'),/zero-compatible/);
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
  await check('coordinate witness layout '+width,async()=>{const dimensions=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,input:document.getElementById('circulation-box-input').getBoundingClientRect().width})");assert.ok(dimensions.scroll<=width+1,JSON.stringify(dimensions));assert.ok(dimensions.input>250);});
  const clip=await evaluate("(()=>{const r=document.getElementById('circulation-angle-boxes').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'coordinate-boxes-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
 await check('source replacement removes bounded-work claim and pending detached import',async()=>{
  await evaluate("(()=>{window.boxOldText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.boxRead=()=>resolve('{}'));};const d=new DataTransfer();d.items.add(new File(['{}'],'slow.json'));const e=document.getElementById('circulation-box-open');e.files=d.files;e.dispatchEvent(new Event('change'));})()");
  await click('restart');await evaluate("window.boxRead();File.prototype.text=window.boxOldText");assert.equal(await text('circulation-result'),'');
 });
}
