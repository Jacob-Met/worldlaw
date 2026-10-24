import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function receiveResponseRegions({evaluate,send,check,click,text,wait,outputDir}){
 const set=async(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const keys=async(key,code,numeric,typed='')=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:numeric,nativeVirtualKeyCode:numeric,...(type==='keyDown'&&typed?{text:typed,unmodifiedText:typed}:{})});};
 const choose=async()=>evaluate("(()=>{const s=document.getElementById('response-region-model');s.value='reciprocal';s.dispatchEvent(new Event('change'));})()");
 const download=async(id,prefix)=>{const folder=await mkdtemp(path.join(outputDir,prefix));await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder});await click(id);let files=[];for(let i=0;i<100;i++){files=(await readdir(folder)).filter(f=>f.endsWith('.json'));if(files.length)break;await new Promise(r=>setTimeout(r,50));}assert.equal(files.length,1);const filename=path.join(folder,files[0]);return {filename,text:await readFile(filename,'utf8')};};
 const openFile=async filename=>{const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#response-region-open'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filename]});};
 await evaluate("document.getElementById('course').value='reciprocal'");await click('restart');
 const control=await evaluate("(async()=>{const {createCouplingCourse}=await import('/src/coupling/virtual-instrument.mjs'),{analyzeCouplingNotebook}=await import('/src/coupling/notebook.mjs'),{predictCoupling}=await import('/src/coupling/science.mjs'),{circulationExample}=await import('/src/coupling/circulation.mjs');const n=createCouplingCourse(),m=analyzeCouplingNotebook(n).discovery.candidates.find(m=>m.id==='reciprocal'),p=circulationExample(n.assumptions.coordinateConvention);p.source.label='Authored shared-training-error contradiction; not measured';p.samples=[[-1,-1],[0,-1],[0,0],[-1,0],[-1,-1]].map(q=>({q,torque:predictCoupling(m,q),torqueRadius:[.01,.01]}));p.samples[0].torque[0]+=3.779538032717862;p.samples[0].torque[1]-=3.779538032717862;return p;})()");
 const compare=async(p=control)=>{await set('circulation-input',JSON.stringify(p));await click('circulation-run');await set('response-region-radius',.05);await click('response-region-inspect');await choose();};
 await check('trusted keyboard inspection exposes a joint contradiction hidden by separate bands',async()=>{
  await set('circulation-input',JSON.stringify(control));await click('circulation-run');await set('response-region-radius',.05);await send('Page.bringToFront');await evaluate("document.getElementById('response-region-inspect').focus()");assert.equal(await evaluate('document.activeElement.id'),'response-region-inspect');await keys('Enter','Enter',13,'\r');await wait("document.getElementById('response-region-model')!==null");
  await evaluate("document.getElementById('response-region-model').focus()");assert.equal(await evaluate('document.activeElement.id'),'response-region-model');await keys('ArrowDown','ArrowDown',40);await wait("document.getElementById('response-region-model').value==='reciprocal'");
  assert.match(await text('response-region-result'),/Both separate bands overlap, but the joint response is outside/);assert.match(await text('response-region-result'),/1.456036/);assert.match(await text('response-region-result'),/per-row agreement does not establish/);
  assert.deepEqual(await evaluate("['[data-response-region]','[data-response-box]','[data-response-reading]','[data-response-separator]'].map(s=>document.querySelectorAll(s).length)"),[1,1,1,1]);
 });
 await check('setting edits invalidate old conclusions and broad receiving bounds remove the contradiction',async()=>{
  await set('response-region-radius',.1);assert.equal(await text('response-region-result'),'');assert.equal(await evaluate("document.getElementById('response-region-save').disabled"),true);
  const wide=structuredClone(control);wide.source.label='Authored broad receiving-bound control';wide.samples.forEach(s=>s.torqueRadius=[10,10]);await compare(wide);assert.doesNotMatch(await text('response-region-result'),/Both separate bands overlap, but the joint response is outside/);assert.match(await text('response-region-result'),/Row 1 · not-excluded/);
 });
 let saved;
 await check('actual raw source and setting download reopens original evidence without changing the active notebook',async()=>{
  await compare();const before=await download('save','region-active-before-');saved=await download('response-region-save','region-source-');const raw=JSON.parse(saved.text);assert.deepEqual(Object.keys(raw).sort(),['notebook','path','schema','trainingRadius']);assert.equal(raw.trainingRadius,.05);assert.equal(raw.path.source.label,control.source.label);
  const other=structuredClone(control);other.source.label='Different parent loop before region reopen';other.samples.forEach(s=>s.torqueRadius=[10,10]);await compare(other);await openFile(saved.filename);await wait("document.getElementById('response-region-status').textContent.includes('Recomputed the saved source')");await choose();assert.match(await text('response-region-result'),/Both separate bands overlap/);assert.ok((await text('response-region-result')).includes(control.source.label));assert.ok((await text('circulation-result')).includes(other.source.label));
  const after=await download('save','region-active-after-');assert.equal(after.text,before.text);
 });
 await check('stored verdicts refuse while the previous valid region remains available',async()=>{
  const altered=JSON.parse(saved.text);altered.candidates=[];const filename=path.join(outputDir,'region-rejected-cached-verdict.json');await writeFile(filename,JSON.stringify(altered));await openFile(filename);await wait("document.getElementById('response-region-status').textContent.includes('stored verdicts')");assert.match(await text('response-region-result'),/Both separate bands overlap/);assert.match(await text('response-region-status'),/Previous valid region remains visible/);
 });
 await check('late file reads cannot revive a region after setting or source replacement',async()=>{
  const startSlow=()=>evaluate("(()=>{window.regionOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-region.json')return new Promise(resolve=>window.finishRegionRead=resolve);return window.regionOriginalText.call(this);};const dt=new DataTransfer();dt.items.add(new File(['{}'],'slow-region.json'));const f=document.getElementById('response-region-open');f.files=dt.files;f.dispatchEvent(new Event('change'));})()");
  await startSlow();
  try{await set('response-region-radius',.2);await evaluate(`window.finishRegionRead(${JSON.stringify(saved.text)})`);await new Promise(r=>setTimeout(r,100));assert.equal(await text('response-region-result'),'');assert.equal(await evaluate("document.getElementById('response-region-radius').value"),'0.2');}finally{await evaluate('File.prototype.text=window.regionOriginalText');}
  await compare();await startSlow();
  try{await click('restart');await evaluate(`window.finishRegionRead(${JSON.stringify(saved.text)})`);await new Promise(r=>setTimeout(r,100));assert.equal(await evaluate("document.getElementById('response-region-result')===null"),true);}finally{await evaluate('File.prototype.text=window.regionOriginalText');}
 });
 await check('complete oversized sensitivity course refuses without a partial region',async()=>{
  const long=structuredClone(control);long.samples=Array.from({length:129},()=>structuredClone(control.samples[0]));long.samples[1]=structuredClone(control.samples[1]);long.samples[2]=structuredClone(control.samples[2]);await set('circulation-input',JSON.stringify(long));await click('circulation-run');await click('response-region-inspect');assert.match(await text('response-region-status'),/128 training \/ 128 receiving/);assert.equal(await text('response-region-result'),'');assert.equal(await evaluate("document.getElementById('response-region-save').disabled"),true);
 });
 await compare();
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
  await check(`joint region and original source controls fit ${width} CSS pixels`,async()=>{const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.querySelector('#response-region-result svg').getBoundingClientRect().width})");assert.equal(d.width,width);assert.ok(d.scroll<=width+1,JSON.stringify(d));assert.ok(d.plot>270);});
  const clip=await evaluate("(()=>{const r=document.getElementById('coupled-response-regions').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`response-region-${width}.png`),Buffer.from(shot.data,'base64'));
 }
}
