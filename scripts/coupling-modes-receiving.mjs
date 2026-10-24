import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function receiveModes({evaluate,send,check,click,text,wait,outputDir}){
 const set=async(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const run=async()=>{await evaluate("document.getElementById('motion-declared').checked=true");await click('motion-run');await wait("document.getElementById('modes-inspect')!==null");};
 const choose=async value=>evaluate(`(()=>{const s=document.getElementById('modes-model');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change'));})()`);
 await click('restart');await set('motion-inertia-0',2);await set('motion-inertia-1',.5);await set('motion-damping-0',.2);await set('motion-damping-1',.2);
 await check('declared current motion exposes retained directions and keyboard-selected reciprocal traces',async()=>{
  await run();await send('Page.bringToFront');await evaluate("document.getElementById('modes-inspect').focus()");assert.equal(await evaluate('document.activeElement.id'),'modes-inspect');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{}),windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await wait("document.getElementById('modes-model')!==null");await evaluate("document.getElementById('modes-model').focus()");assert.equal(await evaluate('document.activeElement.id'),'modes-model');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40,nativeVirtualKeyCode:40});
  await wait("document.getElementById('modes-model').value==='reciprocal'");assert.match(await text('modes-result'),/0.0997646/);assert.equal(await evaluate("document.querySelectorAll('[data-mode-trace]').length"),2);assert.equal(await evaluate("document.querySelectorAll('[data-mode-direction]').length"),2);
 });
 await check('asymmetric candidate remains visible and source/input changes discard its retained view',async()=>{
  await choose('directional');assert.match(await text('modes-result'),/not symmetric/);assert.equal(await evaluate("document.querySelectorAll('[data-mode-trace]').length"),0);
  await set('motion-inertia-0',3);assert.equal(await evaluate("document.getElementById('modes-result')===null"),true);await set('motion-inertia-0',2);await run();await click('modes-inspect');await click('restart');assert.equal(await evaluate("document.getElementById('modes-result')===null"),true);await run();await click('modes-inspect');await choose('reciprocal');
 });
 await check('actual saved motion inputs reopen the learned coordinate consumer without stored modes',async()=>{
  const dir=await mkdtemp(path.join(outputDir,'mode-inputs-'));await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await click('motion-save');let files=[];for(let i=0;i<100;i++){files=(await readdir(dir)).filter(f=>f.endsWith('.json'));if(files.length)break;await new Promise(r=>setTimeout(r,50));}assert.equal(files.length,1);
  const filename=path.join(dir,files[0]),raw=JSON.parse(await readFile(filename,'utf8'));assert.deepEqual(Object.keys(raw).sort(),['evidence','inputs','schema']);assert.deepEqual(raw.inputs.inertia,[2,.5]);
  await set('motion-inertia-0',9);await run();const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#motion-file'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filename]});await wait("document.getElementById('motion-inertia-0').value==='2'");await click('modes-inspect');await choose('reciprocal');assert.match(await text('modes-result'),/0.0997646/);assert.match(await text('modes-result'),/Authored reciprocal response instrument/);
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});
  await check(`learned-coordinate instrument fits ${width} CSS pixels`,async()=>{const d=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.querySelector('#modes-result svg').getBoundingClientRect().width})");assert.equal(d.width,width);assert.ok(d.scroll<=width+1,JSON.stringify(d));assert.ok(d.plot>270);});
  const clip=await evaluate("(()=>{const r=document.getElementById('motion-modes').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`modes-${width}.png`),Buffer.from(shot.data,'base64'));
 }
}
