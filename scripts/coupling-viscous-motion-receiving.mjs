import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';

export async function receiveViscousMotion({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const set=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const importMotion=async value=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'motion-loss-input.json',{type:'application/json'}));const f=document.getElementById('motion-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 const paths=()=>evaluate("Array.from(document.querySelectorAll('#motion-plot [data-motion-path]'),p=>p.getAttribute('d'))");
 const run=async()=>{await evaluate("document.getElementById('motion-declared').checked=true;document.getElementById('motion-form').requestSubmit()");await wait("!document.getElementById('motion-results').hidden");};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[]});
 await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('motion-loss-kind')");
 await click('use-proposal');await click('acquire-virtual');await click('use-proposal');await click('acquire-virtual');
 await evaluate("document.getElementById('inertia-lab').open=true;document.getElementById('viscous-lab').open=true");
 let copied,saved,originalPaths;
 await check('inferred cross loss reaches the actual motion controls only after explicit source pairing',async()=>{
  await click('viscous-cross');assert.equal(await evaluate("document.getElementById('viscous-apply').disabled"),true);
  await click('viscous-apply');assert.equal(await evaluate("document.getElementById('motion-loss-kind').value"),'diagonal');
  await click('viscous-same-apparatus');await click('viscous-apply');
  copied=await evaluate("({inertia:[0,1].map(i=>document.getElementById('motion-inertia-'+i).valueAsNumber),cross:document.getElementById('motion-inertia-cross').valueAsNumber,damping:[0,1].map(i=>document.getElementById('motion-damping-'+i).valueAsNumber),loss:document.getElementById('motion-damping-cross').valueAsNumber})");
  assert.ok(Math.abs(copied.loss-.19)<1e-7);assert.ok(Math.abs(copied.cross-.32)<1e-7);
  assert.equal(await evaluate("document.getElementById('motion-loss-kind').value"),'symmetric');assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);
  await click('motion-run');assert.match(await text('motion-error'),/Declare the dynamic interpretation/);assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);
 });
 await check('declared inferred loss executes all retained response models and visibly changes a new trajectory',async()=>{
  for(const [id,value]of [['motion-position-0',-.41],['motion-position-1',.76],['motion-rate-0',.33],['motion-rate-1',-.24]])await set(id,value);
  await run();assert.match(await text('motion-status'),/Symmetric cross loss 0.19/);assert.match(await text('motion-equation'),/M q″ \+ D q′/);
  originalPaths=await paths();assert.equal(originalPaths.length,3);await click('modes-inspect');assert.match(await text('modes-result'),/Transformed damping matrix/);assert.equal(await evaluate("document.querySelectorAll('#modes-result [data-mode-trace]').length"),2);
  await set('motion-loss-kind','diagonal');assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);await run();assert.notDeepEqual(await paths(),originalPaths);
  await set('motion-loss-kind','symmetric');await run();assert.deepEqual(await paths(),originalPaths);
 });
 await check('actual v3 motion download contains source inputs and reopens with the same computed cross-loss path',async()=>{
  await click('motion-save');let files=[];
  for(let i=0;i<80;i++){files=await readdir(downloads);if(files.includes('worldlaw-coupled-motion.json'))break;await delay(80);}
  assert.ok(files.includes('worldlaw-coupled-motion.json'));saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-coupled-motion.json'),'utf8'));
  assert.equal(saved.schema,'worldlaw.coupling-dynamics-notebook/v3');assert.equal(saved.inputs.dampingCross,copied.loss);assert.deepEqual(Object.keys(saved).sort(),['evidence','inputs','schema']);
  await set('motion-damping-cross',-.19);await run();assert.notDeepEqual(await paths(),originalPaths);
  await importMotion(saved);await wait("document.getElementById('motion-damping-cross').valueAsNumber>0");assert.deepEqual(await paths(),originalPaths);
 });
 await check('invalid PSD inputs and obsolete schemas retain refusals instead of a fallback path',async()=>{
  await set('motion-damping-cross',2);await click('motion-run');assert.match(await text('motion-error'),/semidefinite/);assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);assert.deepEqual(await paths(),[]);
  const old={...saved,schema:'worldlaw.coupling-dynamics-notebook/v2'};await importMotion(old);await wait("document.getElementById('motion-error').textContent.includes('versions')");assert.deepEqual(await paths(),[]);
  await importMotion(saved);await wait("!document.getElementById('motion-results').hidden");assert.deepEqual(await paths(),originalPaths);
 });
 await check('changed source context revokes pairing and failed training has no copyable law',async()=>{
  await click('viscous-cross');await click('viscous-same-apparatus');assert.equal(await evaluate("document.getElementById('viscous-apply').disabled"),false);
  await click('restart');assert.equal(await evaluate("document.getElementById('viscous-apply').disabled"),true);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);assert.deepEqual(await paths(),[]);
  await set('viscous-width',101);assert.equal(await evaluate("document.getElementById('viscous-results').hidden"),true);assert.equal(await evaluate("document.getElementById('viscous-apply').disabled"),true);
  const weak=createViscousExample('cross');weak.challenge=null;weak.training.record.source.label='Rank-loss copy refusal';weak.training.record.courses[0].rows.forEach(r=>{r.position=[.2+.1*r.time,.4-.2*r.time];r.torque=[.1,.2];});
  await evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(weak))}],'rank-loss.json',{type:'application/json'}));const f=document.getElementById('viscous-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
  await wait("document.getElementById('viscous-source').textContent.includes('Rank-loss')");assert.equal(await evaluate("document.getElementById('viscous-apply-controls').hidden"),true);assert.equal(await evaluate("document.getElementById('viscous-apply').disabled"),true);
  await importMotion(saved);await wait("!document.getElementById('motion-results').hidden");
 });
 await check('trusted keyboard motion activation and actual playback use the inferred-loss samples',async()=>{
  await set('motion-position-0',-.53);await evaluate("document.getElementById('motion-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate("document.getElementById('motion-results').hidden"),false);assert.notDeepEqual(await paths(),originalPaths);
  await click('motion-play');await delay(250);await click('motion-play');assert.ok(await evaluate("Number(document.getElementById('motion-frame').value)>0"));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait("document.getElementById('motion-play').disabled");
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await delay(80);
  await check('cross-loss motion and editable declaration remain within the actual page at '+width,async()=>{
   const box=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,paths:document.querySelectorAll('#motion-plot [data-motion-path]').length,plot:document.getElementById('motion-plot').getBoundingClientRect().width,cross:document.getElementById('motion-damping-cross').getBoundingClientRect().width})");
   assert.ok(box.scroll<=box.width+1,JSON.stringify(box));assert.equal(box.paths,3);assert.ok(box.plot>240&&box.cross>150,JSON.stringify(box));
  });
  const clip=await evaluate("(()=>{const r=document.querySelector('#coupled-dynamics .motion-layout').getBoundingClientRect(),s=document.getElementById('motion-status').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:s.bottom-r.top,scale:1}})()");
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`viscous-motion-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 await writeFile(path.join(outputDir,'viscous-motion-input.json'),JSON.stringify(saved,null,2));
}
