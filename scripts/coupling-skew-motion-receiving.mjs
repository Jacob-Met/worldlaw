import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

export async function receiveSkewMotion({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const open=async id=>evaluate(`(()=>{let e=document.getElementById(${JSON.stringify(id)});while(e){if(e.tagName==='DETAILS')e.open=true;e=e.parentElement;}})()`);
 const navigate=async()=>{await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('motion-velocity-kind')&&!!document.getElementById('velocity-example')");await open('velocity-example');};
 const set=(id,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
 const importValue=(id,value)=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'original-input.json',{type:'application/json'}));const f=document.getElementById(${JSON.stringify(id)});f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 const example=async kind=>{await set('velocity-example-kind',kind);await click('velocity-example');await wait("!document.getElementById('velocity-results').hidden");};
 const controls=()=>evaluate("({kind:document.getElementById('motion-velocity-kind').value,g:document.getElementById('motion-velocity-skew').value,inertia:[0,1].map(i=>document.getElementById('motion-inertia-'+i).value),cross:document.getElementById('motion-inertia-cross').value,damping:[0,1].map(i=>document.getElementById('motion-damping-'+i).value),loss:document.getElementById('motion-damping-cross').value})");
 const paths=()=>evaluate("[...document.querySelectorAll('#motion-plot [data-motion-path]')].map(p=>p.getAttribute('d'))");
 const run=async()=>{await evaluate("document.getElementById('motion-declared').checked=true;document.getElementById('motion-form').requestSubmit()");await wait("!document.getElementById('motion-results').hidden");};
 const inspectFit=async()=>{await evaluate("document.getElementById('velocity-inspect').open=true");await wait("document.getElementById('velocity-details').textContent.length>0");return JSON.parse(await text('velocity-details'));};
 const downloaded=async name=>{for(let i=0;i<100;i++){if((await readdir(downloads)).includes(name))return JSON.parse(await readFile(path.join(downloads,name),'utf8'));await delay(70);}throw Error('No actual download: '+name);};
 const importSaved=async()=>{await importValue('motion-file',saved);await wait("!document.getElementById('motion-results').hidden&&document.getElementById('motion-velocity-kind').value==='skew'");};
 let saved,responseSource,originalPaths,copiedG;
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await send('Emulation.setEmulatedMedia',{features:[]});await navigate();
 await click('use-proposal');await click('acquire-virtual');await click('use-proposal');await click('acquire-virtual');
 await click('save');responseSource=await downloaded('worldlaw-coupling-notebook.json');
 await check('fitting never adopts G; explicit source pairing copies only controls and clears declaration',async()=>{
  const before=await controls();await example('two-frequency');assert.deepEqual(await controls(),before);assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),true);
  await click('velocity-apply');assert.deepEqual(await controls(),before);
  const fit=await inspectFit();assert.equal(fit.skew.primary.status,'candidate');assert.equal(fit.challenge.skew.status,'within_declared_tolerance');
  await click('velocity-same-apparatus');assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),false);await click('velocity-apply');
  const actual=await controls(),expected=fit.skew.primary.candidateParameters;copiedG=expected.velocitySkew;assert.equal(actual.kind,'skew');assert.equal(Number(actual.g),copiedG);assert.deepEqual(actual.inertia.map(Number),expected.inertia);assert.deepEqual(actual.damping.map(Number),expected.damping);assert.equal(Number(actual.cross),expected.inertiaCross);assert.equal(Number(actual.loss),expected.dampingCross);
  assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);assert.deepEqual(await inspectFit(),fit);
  await click('motion-run');assert.match(await text('motion-error'),/Declare the dynamic interpretation/);assert.deepEqual(await paths(),[]);
 });
 await check('declared G changes actual retained trajectories and exposes transformed coupling and power',async()=>{
  for(const [id,v]of [['motion-position-0',-.41],['motion-position-1',.76],['motion-rate-0',.33],['motion-rate-1',-.24]])await set(id,v);
  await run();originalPaths=await paths();assert.equal(originalPaths.length,3);await click('modes-inspect');assert.match(await text('modes-result'),/skew/i);assert.match(await text('modes-result'),/stiffness.only/i);assert.equal(await evaluate("document.querySelectorAll('#modes-result [data-mode-trace]').length"),2);
  await click('velocity-power-inspect');assert.match(await text('velocity-power-result'),/skew/i);assert.match(await text('velocity-power-result'),/loss|dissipat/i);assert.match(await text('velocity-power-result'),/numerical|floating|diagnostic/i);
  await set('motion-velocity-skew',-copiedG);assert.equal(await evaluate("document.getElementById('motion-results').hidden"),true);await run();assert.notDeepEqual(await paths(),originalPaths);
  await set('motion-velocity-skew',copiedG);await run();assert.deepEqual(await paths(),originalPaths);
 });
 await check('actual v4 source-only download reopens on a fresh page with identical computed paths',async()=>{
  await click('motion-save');saved=await downloaded('worldlaw-coupled-motion.json');assert.equal(saved.schema,'worldlaw.coupling-dynamics-notebook/v4');assert.equal(saved.inputs.schema,'worldlaw.coupling-dynamics-input/v4');assert.equal(saved.inputs.units.velocitySkew,'N·m·s/rad');assert.equal(saved.inputs.velocitySkew,copiedG);assert.deepEqual(Object.keys(saved).sort(),['evidence','inputs','schema']);assert.deepEqual(saved.evidence,responseSource);
  await navigate();assert.equal(await evaluate("document.getElementById('motion-velocity-kind').value"),'none');assert.deepEqual(await paths(),[]);await importSaved();assert.deepEqual(await paths(),originalPaths);
 });
 await check('bad numeric and old-schema skew inputs refuse without a fallback trajectory',async()=>{
  await set('motion-velocity-skew','');await click('motion-run');assert.match(await text('motion-error'),/finite|velocitySkew/i);assert.deepEqual(await paths(),[]);
  const mismatch=structuredClone(saved);mismatch.schema='worldlaw.coupling-dynamics-notebook/v3';await importValue('motion-file',mismatch);await wait("document.getElementById('motion-error').textContent.includes('versions')");assert.deepEqual(await paths(),[]);
  const legacy=structuredClone(saved);legacy.schema='worldlaw.coupling-dynamics-notebook/v3';legacy.inputs.schema='worldlaw.coupling-dynamics-input/v3';legacy.inputs.interpretation='position-torque-with-declared-symmetric-inertia-and-symmetric-loss';await importValue('motion-file',legacy);await wait("/unknown|unsupported/i.test(document.getElementById('motion-error').textContent)");assert.deepEqual(await paths(),[]);
  await importSaved();assert.deepEqual(await paths(),originalPaths);
 });
 await check('setting and response-source changes revoke pairing while retaining independent fit evidence',async()=>{
  await example('two-frequency');await click('velocity-same-apparatus');assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),false);await set('velocity-training-width',101);assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),true);assert.equal(await evaluate("document.getElementById('velocity-same-apparatus').checked"),false);
  await click('velocity-run');await wait("!document.getElementById('velocity-results').hidden");const fitted=await inspectFit();await click('velocity-same-apparatus');await click('restart');assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),true);assert.equal(await evaluate("document.getElementById('velocity-same-apparatus').checked"),false);assert.deepEqual(await inspectFit(),fitted);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);
 });
 await check('failed held receiving stays visible during conditional copy; unsupported training has no copy',async()=>{
  await example('single-irregular');assert.match(await evaluate("document.querySelector('[data-family=skew]').textContent"),/candidate.*exceeds_declared_tolerance/s);await click('velocity-same-apparatus');await click('velocity-apply');assert.equal(await evaluate("document.getElementById('motion-velocity-kind').value"),'skew');assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);assert.match(await evaluate("document.querySelector('[data-family=skew]').textContent"),/exceeds_declared_tolerance/);
  await example('single-uniform');assert.equal(await evaluate("document.getElementById('velocity-apply-controls').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-apply').disabled"),true);await example('omitted-force');assert.equal(await evaluate("document.getElementById('velocity-apply-controls').hidden"),true);
 });
 await check('legacy parameter copy and explicitly selected release clear old G',async()=>{
  await importSaved();await open('viscous-cross');await click('viscous-cross');await click('viscous-same-apparatus');await click('viscous-apply');assert.equal(await evaluate("document.getElementById('motion-velocity-kind').value"),'none');assert.equal(await evaluate("document.getElementById('motion-velocity-skew').valueAsNumber"),0);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);
  await set('motion-velocity-kind','skew');await set('motion-velocity-skew',.8);await open('release-current');await click('release-current');for(const[id,v]of [['release-duration',1],['release-samples',41],['release-step',.02]])await set(id,v);await click('release-paired');await click('release-run');await wait("!document.getElementById('release-results').hidden");await set('release-family','symmetric','change');await wait("!document.getElementById('release-apply').disabled");await click('release-apply');assert.equal(await evaluate("document.getElementById('motion-velocity-kind').value"),'none');assert.equal(await evaluate("document.getElementById('motion-velocity-skew').valueAsNumber"),0);assert.equal(await evaluate("document.getElementById('motion-declared').checked"),false);
 });
 await check('trusted keyboard run and actual playback use retained v4 samples',async()=>{
  await importSaved();await set('motion-position-0',-.53);await evaluate("document.getElementById('motion-run').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("!document.getElementById('motion-results').hidden");assert.notDeepEqual(await paths(),originalPaths);await click('motion-play');await delay(250);await click('motion-play');assert.ok(await evaluate("Number(document.getElementById('motion-frame').value)>0"));await click('modes-inspect');await click('velocity-power-inspect');
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await delay(80);
  await check('actual skew controls, power and modes remain within '+width,async()=>{const box=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,paths:document.querySelectorAll('#motion-plot [data-motion-path]').length,plot:document.getElementById('motion-plot').getBoundingClientRect().width,g:document.getElementById('motion-velocity-skew').getBoundingClientRect().width})");assert.ok(box.scroll<=box.width+1,JSON.stringify(box));assert.equal(box.paths,3);assert.ok(box.plot>240&&box.g>150,JSON.stringify(box));});
  for(const[id,label]of [['coupled-dynamics','motion'],['velocity-power-result','power'],['modes-result','modes']]){const clip=await evaluate(`(()=>{const id=${JSON.stringify(id)},r=(id==='coupled-dynamics'?document.querySelector('#coupled-dynamics .motion-layout'):document.getElementById(id)).getBoundingClientRect(),bottom=id==='coupled-dynamics'?document.getElementById('motion-status').getBoundingClientRect().bottom:r.bottom;return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:bottom-r.top,scale:1}})()`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`skew-${label}-${width}.png`),Buffer.from(shot.data,'base64'));}
 }
 await writeFile(path.join(outputDir,'skew-motion-input.json'),JSON.stringify(saved,null,2));
}
