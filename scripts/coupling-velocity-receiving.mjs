import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {independentVelocityStudy} from '../tests/support/velocity-control.mjs';

export async function receiveVelocityComparison({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const open=()=>evaluate("(()=>{let p=document.getElementById('velocity-lab');while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}})()");
 const navigate=async()=>{await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('velocity-example')");await open();};
 const loadExample=async kind=>{await evaluate(`document.getElementById('velocity-example-kind').value=${JSON.stringify(kind)}`);await click('velocity-example');await wait("!document.getElementById('velocity-results').hidden");};
 const importValue=(value,name='velocity-input.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById('velocity-file');f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 const fitText=family=>evaluate(`document.querySelector('[data-family=${family}]').textContent`);
 const inspect=async()=>{await evaluate("document.getElementById('velocity-inspect').open=true");await wait("document.getElementById('velocity-details').textContent.length>0");return JSON.parse(await text('velocity-details'));};
 const setInput=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await navigate();
 await check('velocity comparison exposes all three laws and separate receiving without adopting motion',async()=>{
  await loadExample('two-frequency');assert.equal(await evaluate("document.querySelectorAll('#velocity-families .velocity-family').length"),3);
  assert.match(await fitText('skew'),/candidate.*rank 7\/7/);assert.match(await fitText('skew'),/within_declared_tolerance/);
  assert.match(await fitText('symmetric'),/exceeds_declared_tolerance/);
  assert.equal(await evaluate("document.querySelectorAll('#velocity-plot polyline').length"),3);
  assert.match(await text('velocity-status'),/no family selected/);
  assert.match(await text('velocity-results'),/No family is automatically selected/);
 });
 await check('uniform rank loss and irregular false numerical identification remain different visible failures',async()=>{
  await loadExample('single-uniform');assert.match(await fitText('skew'),/unidentified.*rank 4\/7/);assert.match(await fitText('skew'),/unsupported_training/);
  await loadExample('single-irregular');assert.match(await fitText('skew'),/candidate.*rank 7\/7/);assert.match(await fitText('skew'),/exceeds_declared_tolerance/);
  assert.match(await text('velocity-results'),/Numerical full rank and admissible matrices do not establish identification/);
 });
 let saved,originalCards;
 await check('actual source-only download reopens in a fresh page and rederives identical coefficient tables',async()=>{
  await loadExample('two-frequency');originalCards=await text('velocity-families');await click('velocity-save');
  let files=[];for(let i=0;i<100;i++){files=await readdir(downloads);if(files.includes('worldlaw-velocity-study.json'))break;await delay(70);}
  assert.ok(files.includes('worldlaw-velocity-study.json'));
  saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-velocity-study.json'),'utf8'));
  assert.deepEqual(Object.keys(saved).sort(),['challenge','schema','training']);assert.equal(saved.training.record.courses.length,2);
  assert.equal(saved.training.record.courses[0].rows.length,401);assert.equal(saved.schema,'worldlaw.coupled-velocity-study/v1');
  await navigate();assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);
  await importValue(saved);await wait("!document.getElementById('velocity-results').hidden");assert.equal(await text('velocity-families'),originalCards);
 });
 await check('independent coupled-inertia source receives reversed mixed motion and held changes never refit training',async()=>{
  const independent=independentVelocityStudy();await importValue(independent);await wait("document.getElementById('velocity-source').textContent.includes('independent training')");
  const before=await inspect();assert.equal(before.challenge.skew.outside,0);assert.ok(before.challenge.symmetric.outside>0);
  const changed=structuredClone(independent);changed.challenge.record.source.label='Changed held torque';for(const row of changed.challenge.record.courses[0].rows)row.torque[0]+=1;
  await importValue(changed);await wait("document.getElementById('velocity-source').textContent.includes('Changed held torque')");const after=await inspect();
  for(const family of ['diagonal','symmetric','skew'])assert.deepEqual(after[family],before[family]);
  assert.equal(after.challenge.skew.status,'exceeds_declared_tolerance');
 });
 await check('zero skew remains a conditional explanation and indefinite fit retires previous successful receiving',async()=>{
  await loadExample('no-skew');assert.match(await fitText('symmetric'),/within_declared_tolerance/);assert.match(await fitText('skew'),/within_declared_tolerance/);
  await loadExample('omitted-force');assert.match(await fitText('skew'),/outside_supported_family/);assert.match(await fitText('skew'),/unsupported_training/);assert.doesNotMatch(await fitText('skew'),/within_declared_tolerance/);
 });
 await check('unsupported or repeated sources retire results and download until explicit retained-source recomparison',async()=>{
  await loadExample('two-frequency');const bad=structuredClone(saved);bad.training.record.schema='unsupported-old-schema';await importValue(bad);
  await wait("document.getElementById('velocity-error').textContent.length>0");assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-save').disabled"),true);
  await click('velocity-run');await wait("!document.getElementById('velocity-results').hidden");assert.equal(await text('velocity-error'),'');
  const repeated=structuredClone(saved);repeated.challenge.record=structuredClone(repeated.training.record);repeated.challenge.record.source.label='Renamed training';
  await importValue(repeated);await wait("document.getElementById('velocity-error').textContent.includes('repeats')");assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);
 });
 await check('complete three-family work exhaustion refuses the result and a new valid source clears the alert',async()=>{
  const costly=createVelocityExample('single-irregular');for(const side of [costly.training,costly.challenge])side.settings={...side.settings,windowSamples:101,stride:1};
  await importValue(costly);await wait("document.getElementById('velocity-error').textContent.includes('complete three-family')");
  assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-save').disabled"),true);
  await loadExample('two-frequency');assert.equal(await text('velocity-error'),'');
 });
 await check('settings invalidate prior comparison and trusted keyboard activation recomputes it',async()=>{
  await setInput('velocity-training-width',101);assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);assert.equal(await evaluate("document.getElementById('velocity-save').disabled"),true);
  await evaluate("document.getElementById('velocity-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("!document.getElementById('velocity-results').hidden");assert.equal(await text('velocity-error'),'');
 });
 const slowStart=async()=>{
  await evaluate("window.velocityOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='velocity-slow.json')return new Promise(resolve=>window.finishVelocity=resolve);return window.velocityOriginalText.call(this)}");
  await importValue(saved,'velocity-slow.json');await wait("typeof window.finishVelocity==='function'");
  assert.equal(await evaluate("document.getElementById('velocity-run').disabled"),true);assert.equal(await evaluate("document.getElementById('velocity-save').disabled"),true);assert.equal(await evaluate("document.getElementById('velocity-results').hidden"),true);
 };
 const slowFinish=async()=>{await evaluate(`window.finishVelocity(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=window.velocityOriginalText;delete window.finishVelocity`);await delay(100);};
 await check('new authored source intent fences a late original-file response',async()=>{
  await slowStart();await loadExample('no-skew');await slowFinish();assert.match(await text('velocity-source'),/no-skew/);assert.match(await fitText('symmetric'),/within_declared_tolerance/);
 });
 await check('settings changes cancel a pending file read and re-enable explicit retained-source comparison',async()=>{
  await slowStart();await setInput('velocity-training-width',101);assert.equal(await evaluate("document.getElementById('velocity-run').disabled"),false);
  await click('velocity-run');await wait("!document.getElementById('velocity-results').hidden");await slowFinish();
  assert.match(await text('velocity-source'),/no-skew/);assert.equal(await evaluate("document.getElementById('velocity-training-width').value"),'101');
 });
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await open();
  for(const kind of ['two-frequency','single-irregular']){
   await loadExample(kind);await delay(80);
   await check('velocity cards, coefficient tables and page stay within '+width+' for '+kind,async()=>{
    const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,plot:document.getElementById('velocity-plot').getBoundingClientRect().width,tables:[...document.querySelectorAll('#velocity-families table')].map(t=>({width:t.clientWidth,scroll:t.scrollWidth,left:t.getBoundingClientRect().left,right:t.getBoundingClientRect().right})),cells:[...document.querySelectorAll('#velocity-families td')].filter(c=>c.getClientRects().length).map(c=>({text:c.textContent,width:c.clientWidth,scroll:c.scrollWidth}))})");
    assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));assert.ok(layout.plot>220,JSON.stringify(layout));assert.ok(layout.tables.length>0);
    for(const table of layout.tables){assert.ok(table.scroll<=table.width+1,JSON.stringify(table));assert.ok(table.left>=0&&table.right<=layout.width+1,JSON.stringify(table));}
    assert.ok(layout.cells.length>0);for(const cell of layout.cells)assert.ok(cell.scroll<=cell.width,JSON.stringify(cell));
   });
   const clip=await evaluate("(()=>{const r=document.getElementById('velocity-lab').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`velocity-${kind}-${width}.png`),Buffer.from(shot.data,'base64'));
  }
 }
}
