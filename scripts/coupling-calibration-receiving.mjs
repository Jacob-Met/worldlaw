import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function receiveCalibration({evaluate,send,check,click,text,wait,outputDir,downloads}){
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await click('circulation-load');await click('circulation-run');await evaluate("document.getElementById('circulation-calibration').open=true");
 const get=()=>evaluate("JSON.parse(document.getElementById('calibration-input').value)");
 const set=r=>evaluate(`(()=>{const e=document.getElementById('calibration-input');e.value=${JSON.stringify(JSON.stringify(r))};e.dispatchEvent(new Event('input'));})()`);
 await check('same original weak-directional readings retain both gain hypotheses',async()=>{
  const r=await get();r.gain=[.99,1.01];r.path.samples.forEach(s=>{s.torque=[s.q[1],1.02*s.q[0]];s.torqueRadius=[.001,.001];});r.calibrationSource='Authored gain dependence control';await set(r);await click('calibration-run');
  const content=await text('calibration-result');assert.match(content,/shared-gain:.*positive-work/);assert.match(content,/independent-gains:.*zero-compatible/);
 });
 await check('keyboard recomputation and common-gain original-row witness',async()=>{
  await set(await get());assert.equal(await text('calibration-result'),'');await send('Page.bringToFront');await evaluate("document.getElementById('calibration-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await wait("document.getElementById('calibration-status').textContent.includes('Both calibration')");const witness=JSON.parse(await text('calibration-witness'));assert.equal(witness.gains[0],witness.gains[1]);assert.equal(witness.torqueWitness.length,2);
 });
 await check('actual calibration download and fresh input-only reopen',async()=>{
  await click('calibration-save');let file;for(let i=0;i<100;i++){file=(await readdir(downloads)).find(n=>n==='worldlaw-encoder-calibration.json');if(file)break;await new Promise(r=>setTimeout(r,40));}assert.ok(file);
  const saved=JSON.parse(await readFile(path.join(downloads,file),'utf8'));assert.equal(saved.shared,undefined);assert.equal(saved.calibrationSource,'Authored gain dependence control');
  await click('circulation-run');await evaluate("document.getElementById('circulation-calibration').open=true");const doc=await send('DOM.getDocument'),target=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#calibration-open'});await send('DOM.setFileInputFiles',{nodeId:target.nodeId,files:[path.join(downloads,file)]});await wait("document.getElementById('calibration-status').textContent.includes('Independent saved')");assert.equal(await text('calibration-result'),'');await click('calibration-run');assert.match(await text('calibration-result'),/independent-gains:.*zero-compatible/);
 });
 await check('invalid gain clears claims and retry retains negative result',async()=>{const r=await get();r.gain=[0,1];await set(r);await click('calibration-run');assert.match(await text('calibration-status'),/positive ordered/);assert.equal(await text('calibration-result'),'');r.gain=[.99,1.01];await set(r);await click('calibration-run');assert.match(await text('calibration-result'),/zero-compatible/);});
 for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await check('calibration layout '+width,async()=>{assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));});const clip=await evaluate("(()=>{const r=document.getElementById('circulation-calibration').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,'calibration-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 await check('source replacement prevents late detached calibration import',async()=>{await evaluate("(()=>{window.oldCalibrationText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.finishCalibrationRead=()=>resolve('{}'));};const d=new DataTransfer();d.items.add(new File(['{}'],'late.json'));const e=document.getElementById('calibration-open');e.files=d.files;e.dispatchEvent(new Event('change'));})()");await click('restart');await evaluate('window.finishCalibrationRead();File.prototype.text=window.oldCalibrationText');assert.equal(await text('circulation-result'),'');});
}
