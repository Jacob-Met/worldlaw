import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function receiveMatrixCalibration({evaluate,send,check,click,text,wait,outputDir,downloads}){
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await click('circulation-load');await click('circulation-run');await evaluate("document.getElementById('circulation-matrix').open=true");
 const get=()=>evaluate("JSON.parse(document.getElementById('matrix-input').value)");
 const set=r=>evaluate(`(()=>{const e=document.getElementById('matrix-input');e.value=${JSON.stringify(JSON.stringify(r))};e.dispatchEvent(new Event('input'));})()`);
 await check('same original weak-directional readings admit zero under channel mixing',async()=>{
  const r=await get();r.matrix=[[[1,1],[-.01,.01]],[[-.01,.01],[1,1]]];r.path.samples.forEach(s=>{s.torque=[s.q[0],2*s.q[1]+.02*s.q[0]];s.torqueRadius=[.001,.001];});r.calibrationSource='Authored cross-channel calibration control';await set(r);await click('matrix-run');
  const content=await text('matrix-result');assert.match(content,/zero-compatible/);assert.match(content,/All16 matrix vertices/);
 });
 await check('keyboard recomputation and shared-original-reading matrix witness',async()=>{
  await set(await get());assert.equal(await text('matrix-result'),'');await send('Page.bringToFront');await evaluate("document.getElementById('matrix-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await wait("document.getElementById('matrix-status').textContent.includes('Complete matrix')");const witness=JSON.parse(await text('matrix-witness'));assert.equal(witness.matrix.length,2);assert.equal(witness.torque.length,2);assert.equal(witness.torqueEndpoints.length,2);
 });
 await check('actual matrix download and fresh input-only reopen',async()=>{
  await click('matrix-save');let file;for(let i=0;i<100;i++){file=(await readdir(downloads)).find(n=>n==='worldlaw-matrix-calibration.json');if(file)break;await new Promise(r=>setTimeout(r,40));}assert.ok(file);
  const saved=JSON.parse(await readFile(path.join(downloads,file),'utf8'));assert.equal(saved.minimum,undefined);assert.equal(saved.schema,'worldlaw.coupling-matrix-calibration/v1');assert.equal(saved.calibrationSource,'Authored cross-channel calibration control');
  await click('circulation-run');await evaluate("document.getElementById('circulation-matrix').open=true");const doc=await send('DOM.getDocument'),target=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#matrix-open'});await send('DOM.setFileInputFiles',{nodeId:target.nodeId,files:[path.join(downloads,file)]});await wait("document.getElementById('matrix-status').textContent.includes('Independent saved')");assert.equal(await text('matrix-result'),'');await click('matrix-run');assert.match(await text('matrix-result'),/zero-compatible/);
 });
 await check('singular matrix possibility clears claims and retry retains negative result',async()=>{const r=await get();r.matrix=[[[0,1],[0,0]],[[0,0],[1,1]]];await set(r);await click('matrix-run');assert.match(await text('matrix-status'),/positive determinant/);assert.equal(await text('matrix-result'),'');r.matrix=[[[1,1],[-.01,.01]],[[-.01,.01],[1,1]]];await set(r);await click('matrix-run');assert.match(await text('matrix-result'),/zero-compatible/);});
 for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await check('matrix layout '+width,async()=>{assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));});const clip=await evaluate("(()=>{const r=document.getElementById('circulation-matrix').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'matrix-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 await check('source replacement prevents late detached matrix import',async()=>{await evaluate("(()=>{window.oldMatrixText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.finishMatrixRead=()=>resolve('{}'));};const d=new DataTransfer();d.items.add(new File(['{}'],'late.json'));const e=document.getElementById('matrix-open');e.files=d.files;e.dispatchEvent(new Event('change'));})()");await click('restart');await evaluate('window.finishMatrixRead();File.prototype.text=window.oldMatrixText');assert.equal(await text('circulation-result'),'');});
}
