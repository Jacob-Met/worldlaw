import assert from 'node:assert/strict';
import {writeFile,mkdtemp,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
export async function receiveObservables({evaluate,send,check,click,text,wait,outputDir}){
 const setPath=async value=>evaluate(`(()=>{const el=document.getElementById('circulation-input');el.value=${JSON.stringify(JSON.stringify(value))};el.dispatchEvent(new Event('input'));})()`);
 const control=await evaluate(`(async()=>{const {createCouplingCourse}=await import('/src/coupling/virtual-instrument.mjs');const {analyzeCouplingNotebook}=await import('/src/coupling/notebook.mjs');const {predictCoupling}=await import('/src/coupling/science.mjs');const {circulationExample}=await import('/src/coupling/circulation.mjs');const n=createCouplingCourse(),p=circulationExample(n.assumptions.coordinateConvention),m=analyzeCouplingNotebook(n).discovery.candidates.find(m=>m.id==='independent');p.source.label='Authored independent-field receiving control, not measured data';p.samples.forEach(s=>{s.torque=predictCoupling(m,s.q);s.torqueRadius=[.01,.01];});return p;})()`);
 await check('supplied response contradictions remain visible when integrated work passes',async()=>{
  await setPath(control);await click('circulation-run');assert.equal(await text('observable-result'),'');await click('observable-inspect');
  assert.match(await text('observable-result'),/Work does not separate this model, but the individual responses contradict it/);assert.match(await text('observable-result'),/row 3, torque coordinate 1/);assert.match(await text('observable-result'),/6 coordinate readings/);assert.match(await text('observable-result'),/witness is outside the training coordinate ranges/);
  assert.match(await text('observable-result'),/zero for every polygon/);assert.match(await text('observable-result'),/1.439103/);
 });
 await check('new observable counterexample reopens from its actual input-only file without changing active training',async()=>{
  const download=async(id,prefix)=>{const folder=await mkdtemp(path.join(outputDir,prefix));await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder});await click(id);let files=[];for(let i=0;i<100;i++){files=(await readdir(folder)).filter(f=>f.endsWith('.json'));if(files.length)break;await new Promise(resolve=>setTimeout(resolve,50));}assert.equal(files.length,1,`Expected an actual download for ${id}`);const filename=path.join(folder,files[0]);return {filename,text:await readFile(filename,'utf8')};};
  const activeBefore=await download('save','observable-active-before-');
  const saved=await download('circulation-save','observable-source-inputs-'),raw=JSON.parse(saved.text);
  assert.deepEqual(Object.keys(raw).sort(),['notebook','path','schema']);assert.equal(raw.path.source.label,control.source.label);assert.equal(raw.report,undefined);assert.equal(raw.candidates,undefined);assert.equal(raw.path.derived,undefined);
  const different=structuredClone(control);different.source.label='Different active comparison before reopening';different.samples.forEach(s=>s.torqueRadius=[10,10]);await setPath(different);await click('circulation-run');await click('observable-inspect');assert.doesNotMatch(await text('observable-result'),/individual responses contradict it/);
  const doc=await send('DOM.getDocument'),fileNode=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#circulation-open'});await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[saved.filename]});
  await wait("document.getElementById('circulation-status').textContent.includes('Recomputed')");await click('observable-inspect');
  assert.match(await text('observable-result'),/6 coordinate readings/);assert.match(await text('observable-result'),/row 3, torque coordinate 1/);assert.ok((await text('circulation-result')).includes(control.source.label));assert.doesNotMatch(await text('circulation-result'),/Different active comparison/);
  const activeAfter=await download('save','observable-active-after-');assert.equal(activeAfter.text,activeBefore.text,'Retained observable receiving must not mutate active training or acquisition history.');
 });
 await check('wide reading bounds retain failure history in source but do not assert a contradiction',async()=>{
  const wide=structuredClone(control);wide.samples.forEach(s=>s.torqueRadius=[10,10]);await setPath(wide);assert.equal(await evaluate("document.getElementById('coupled-observable-inspector')!==null"),false);await click('circulation-run');await click('observable-inspect');
  assert.doesNotMatch(await text('observable-result'),/individual responses contradict it/);assert.match(await text('observable-result'),/1.439103/);
 });
 await setPath(control);await click('circulation-run');
 await check('keyboard inspection and source replacement preserve the current comparison boundary',async()=>{
  await evaluate("document.getElementById('observable-inspect').focus()");assert.equal(await evaluate("document.activeElement.id"),'observable-inspect');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await wait("document.getElementById('observable-result').textContent.includes('individual responses contradict it')");
  await click('restart');assert.equal(await evaluate("document.getElementById('observable-result')===null"),true);
 });
 await setPath(control);await click('circulation-run');await click('observable-inspect');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
  await check(`source witness and alternative observable remain readable at ${width}`,async()=>{const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,models:document.querySelectorAll('[data-observable-model]').length})");assert.equal(d.width,width);assert.ok(d.scroll<=width+1);assert.equal(d.models,3);});
  const clip=await evaluate("(()=>{const r=document.getElementById('coupled-observable-inspector').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`observable-${width}.png`),Buffer.from(shot.data,'base64'));
 }
}
