import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {defaultReleaseSettings} from '../src/coupling/viscous-release.mjs';
import {VELOCITY_RELEASE_SCHEMA} from '../src/coupling/velocity-release.mjs';

/** Caller owns the admitted sandbox, server, isolated page and download folder. */
export async function receiveVelocityReleases({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const prefix='velocity-release-',id=name=>prefix+name;
 const source={schema:VELOCITY_RELEASE_SCHEMA,response:createCouplingCourse('reciprocal'),velocity:createVelocityExample('two-frequency'),settings:defaultReleaseSettings()};
 const open=async element=>evaluate(`(()=>{let e=document.getElementById(${JSON.stringify(element)});while(e){if(e.tagName==='DETAILS')e.open=true;e=e.parentElement;}})()`);
 const navigate=async()=>{await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('velocity-release-run')");await open(id('run'));};
 const set=(element,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(element)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
 const importValue=(element,value,name='original-release-input.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById(${JSON.stringify(element)});f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 const visible=()=>wait("!document.getElementById('velocity-release-results').hidden");
 const pair=async()=>{if(!await evaluate("document.getElementById('velocity-release-paired').checked"))await click(id('paired'));};
 const run=async()=>{await pair();await click(id('run'));await visible();};
 const loadCurrent=async()=>{
  await importValue('notebook-file',source.response);await wait(`document.getElementById('source-label').textContent===${JSON.stringify(source.response.source.label)}`);
  await open('velocity-example');await importValue('velocity-file',source.velocity);
  await wait("!document.getElementById('velocity-results').hidden");await open(id('run'));await click(id('current'));await run();
 };
 const controls=()=>evaluate("({kind:document.getElementById('motion-velocity-kind').value,g:document.getElementById('motion-velocity-skew').valueAsNumber,declared:document.getElementById('motion-declared').checked,inertia:[0,1].map(i=>document.getElementById('motion-inertia-'+i).valueAsNumber),cross:document.getElementById('motion-inertia-cross').valueAsNumber,damping:[0,1].map(i=>document.getElementById('motion-damping-'+i).valueAsNumber),loss:document.getElementById('motion-damping-cross').valueAsNumber,position:[0,1].map(i=>document.getElementById('motion-position-'+i).valueAsNumber),rate:[0,1].map(i=>document.getElementById('motion-rate-'+i).valueAsNumber)})");
 const downloaded=async name=>{for(let i=0;i<100;i++){if((await readdir(downloads)).includes(name))return JSON.parse(await readFile(path.join(downloads,name),'utf8'));await delay(70);}throw Error('No actual download: '+name);};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await navigate();
 let saved,rows;
 await check('loaded current source pair retains nine releases and both baselines without automatic adoption',async()=>{
  const before=await controls();await loadCurrent();assert.deepEqual(await controls(),before);
  assert.equal(await evaluate("document.querySelectorAll('#velocity-release-rows tr').length"),9);
  assert.equal(await evaluate("document.querySelectorAll('#velocity-release-plot [data-release-trace]').length"),6);
  assert.match(await text(id('status')),/proposed release/);assert.equal(await evaluate("document.getElementById('velocity-release-family').value"),'');
  assert.equal(await evaluate("document.getElementById('velocity-release-apply').disabled"),true);
  assert.match(await text(id('lab')),/peaks may occur at different times/);assert.match(await text(id('lab')),/does not uniquely diagnose G/);
  const account=JSON.parse(await text(id('account')));assert.equal(account.diagnostics.trajectoryCount,81);assert.equal(account.training.separateMotionUsed,false);assert.equal(account.training.separateResponseUsed,false);
  rows=await text(id('rows'));
 });
 await check('actual source-only download reopens independently without overwriting fresh workspace sources',async()=>{
  await click(id('save'));saved=await downloaded('worldlaw-velocity-release.json');assert.deepEqual(Object.keys(saved).sort(),['response','schema','settings','velocity']);assert.equal(saved.schema,VELOCITY_RELEASE_SCHEMA);
  await navigate();const label=await text('source-label'),before=await controls();await importValue(id('file'),saved);await visible();
  assert.equal(await text(id('rows')),rows);assert.equal(await text('source-label'),label);assert.deepEqual(await controls(),before);
  assert.match(await text(id('source')),/Own reopened sources/);await pair();await set(id('family'),'skew','change');assert.equal(await evaluate("document.getElementById('velocity-release-apply').disabled"),true);
  await click('save');const workspace=await downloaded('worldlaw-coupling-notebook.json');assert.equal(workspace.source.label,label);
 });
 await check('all three explicit copy choices preserve their fitted parameters and require renewed motion declaration',async()=>{
  await loadCurrent();const account=JSON.parse(await text(id('account')));
  for(const family of ['skew','symmetric','diagonal']){
   await pair();await set(id('family'),family,'change');await wait("!document.getElementById('velocity-release-apply').disabled");await click(id('apply'));
   const c=await controls(),p=account.training.families[family];assert.deepEqual(c.inertia,p.inertia);assert.deepEqual(c.damping,p.damping);assert.equal(c.cross,p.inertiaCross??0);
   assert.equal(c.loss,p.dampingCross??0);assert.equal(c.g,p.velocitySkew??0);assert.equal(c.kind,family==='skew'?'skew':'none');assert.deepEqual(c.rate,[0,0]);assert.equal(c.declared,false);
   assert.equal(await evaluate("document.getElementById('velocity-release-paired').checked"),false);assert.equal(await evaluate("document.getElementById('velocity-release-apply').disabled"),true);assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);
  }
 });
 await check('settings and actual parent source changes retire proposal and pairing',async()=>{
  await pair();await set(id('duration'),2);assert.equal(await evaluate("document.getElementById('velocity-release-results').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-release-save').disabled"),true);
  await run();const changed=structuredClone(source.response);changed.source.label+=' changed';await importValue('notebook-file',changed);await wait("document.getElementById('velocity-release-results').hidden");assert.equal(await evaluate("document.getElementById('velocity-release-paired').checked"),false);
 });
 await check('late original release file cannot overwrite a newer current-source intent',async()=>{
  await loadCurrent();await evaluate("window.releaseOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-release.json')return new Promise(resolve=>window.finishRelease=resolve);return window.releaseOriginalText.call(this)}");
  try{
   await importValue(id('file'),saved,'slow-release.json');await wait("typeof window.finishRelease==='function'");assert.equal(await evaluate("document.getElementById('velocity-release-results').hidden"),true);
   await click(id('current'));await run();const before=await text(id('rows'));
   const obsolete=structuredClone(saved);obsolete.response.source.label='Obsolete delayed source';await evaluate(`window.finishRelease(${JSON.stringify(JSON.stringify(obsolete))})`);await delay(100);
   assert.equal(await text(id('rows')),before);assert.doesNotMatch(await text(id('source')),/Obsolete delayed|Own reopened/);
  }finally{await evaluate("File.prototype.text=window.releaseOriginalText;delete window.finishRelease");}
 });
 await check('unsupported training and no-separation retain all positions without an informative proposal',async()=>{
  const unsupported=structuredClone(saved);unsupported.velocity=createVelocityExample('single-uniform');await importValue(id('file'),unsupported);await visible();
  assert.match(await text(id('status')),/Unsupported training/);assert.equal(await evaluate("document.querySelectorAll('#velocity-release-rows tr').length"),9);assert.equal(await evaluate("document.querySelectorAll('#velocity-release-rows [data-release-proposed=true]').length"),0);assert.equal(await evaluate("document.getElementById('velocity-release-apply').disabled"),true);
  const noSeparation=structuredClone(saved);noSeparation.settings.minimumSeparation=1000;await importValue(id('file'),noSeparation);await visible();assert.match(await text(id('status')),/No informative release is proposed/);
  assert.equal(await evaluate("document.querySelectorAll('#velocity-release-rows tr[data-release-proposed=true]').length"),0);
 });
 await check('whole-work and wrong-schema refusals retire result/download and valid reopening clears error',async()=>{
  const costly=structuredClone(saved);costly.settings.maxStep=1e-8;await importValue(id('file'),costly);await wait("!document.getElementById('velocity-release-error').hidden");assert.match(await text(id('error')),/integration steps/);
  assert.equal(await evaluate("document.getElementById('velocity-release-results').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-release-save').disabled"),true);
  const wrong=structuredClone(saved);wrong.schema='worldlaw.viscous-release-study/v1';await importValue(id('file'),wrong);await wait("document.getElementById('velocity-release-error').textContent.includes('explicit WORLDLAW')");
  await click(id('current'));await loadCurrent();assert.equal(await evaluate("document.getElementById('velocity-release-error').hidden"),true);
  await set(id('minimum'),saved.settings.minimumSeparation);await run();assert.match(await text(id('status')),/proposed release/);
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await open(id('run'));await delay(80);
  await check('complete velocity release table, pair curves and controls fit '+width,async()=>{
   const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,rows:document.querySelectorAll('#velocity-release-rows tr').length,traces:document.querySelectorAll('#velocity-release-plot [data-release-trace]').length,plot:document.getElementById('velocity-release-plot').getBoundingClientRect().width,cells:[...document.querySelectorAll('#velocity-release-rows td,#velocity-release-rows th')].filter(e=>e.getClientRects().length).map(e=>({scroll:e.scrollWidth,width:e.clientWidth})),controls:[...document.querySelectorAll('#velocity-release-lab input:not([type=file]),#velocity-release-lab select')].filter(e=>e.getClientRects().length).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))})");
   assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));assert.equal(layout.rows,9);assert.equal(layout.traces,6);assert.ok(layout.plot>220);
   for(const c of layout.cells)assert.ok(c.scroll<=c.width+1,JSON.stringify(c));for(const c of layout.controls)assert.ok(c.left>=0&&c.right<=layout.width+1,JSON.stringify(c));
  });
  const clip=await evaluate("(()=>{const r=document.getElementById('velocity-release-lab').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`velocity-release-${width}.png`),Buffer.from(shot.data,'base64'));
 }
}
