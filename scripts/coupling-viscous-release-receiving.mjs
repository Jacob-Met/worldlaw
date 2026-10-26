import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

export async function receiveViscousRelease({evaluate,send,check,click,text,wait,outputDir,downloads,base}){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const set=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const importValue=(id,value,name='release.json')=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));const f=document.getElementById(${JSON.stringify(id)});f.files=d.files;f.dispatchEvent(new Event('change'));})()`);
 const curves=()=>evaluate("Array.from(document.querySelectorAll('#release-plot [data-release-trace]'),e=>e.getAttribute('d'))");
 const plan=async()=>{await evaluate("document.getElementById('release-paired').checked=true;document.getElementById('release-form').requestSubmit()");await wait("!document.getElementById('release-results').hidden");};
 const restart=async kind=>{await set('course',kind);await click('restart');};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await send('Emulation.setEmulatedMedia',{features:[]});
 await send('Page.navigate',{url:base+'/coupling.html'});await wait("!!document.getElementById('release-run')");
 await evaluate("document.getElementById('inertia-lab').open=true;document.getElementById('viscous-lab').open=true;document.getElementById('release-lab').open=true");await click('viscous-cross');
 let saved,bestCurves;
 await check('current source pairing and trusted keyboard compare all nine releases and all response laws',async()=>{
  await click('release-run');assert.match(await text('release-error'),/Declare the source pairing/);assert.equal(await evaluate("document.getElementById('release-results').hidden"),true);
  await click('release-paired');await evaluate("document.getElementById('release-run').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelectorAll('#release-rows tr').length===9");assert.match(await text('release-status'),/1 proposed release/);assert.match(await text('release-work'),/77760 \/ 120000/);assert.equal((await curves()).length,3);bestCurves=await curves();assert.match(await text('release-caption'),/\[-1, -1\]/);assert.equal(await evaluate("document.getElementById('release-apply').disabled"),true);
 });
 await check('inspecting another permitted release visibly changes the whole separation course',async()=>{
  await evaluate("document.querySelector('#release-rows button[data-index=\"4\"]').click()");assert.match(await text('release-caption'),/\[0, 0\]/);assert.notDeepEqual(await curves(),bestCurves);assert.match(await evaluate("document.querySelector('#release-rows tr[data-release-index=\"4\"]').textContent"),/0.00222259/);
  await evaluate("document.querySelector('#release-rows button[data-index=\"0\"]').click()");assert.deepEqual(await curves(),bestCurves);
 });
 await check('explicit loss choice copies fitted values and proposed start into the maintained motion journey',async()=>{
  await evaluate("document.getElementById('release-family').value='symmetric';document.getElementById('release-family').dispatchEvent(new Event('change'))");assert.equal(await evaluate("document.getElementById('release-apply').disabled"),false);await click('release-apply');
  const input=await evaluate("({q:[0,1].map(i=>document.getElementById('motion-position-'+i).valueAsNumber),v:[0,1].map(i=>document.getElementById('motion-rate-'+i).valueAsNumber),cross:document.getElementById('motion-damping-cross').valueAsNumber,declared:document.getElementById('motion-declared').checked})");assert.deepEqual(input.q,[-1,-1]);assert.deepEqual(input.v,[0,0]);assert.ok(Math.abs(input.cross-.19)<1e-7);assert.equal(input.declared,false);
  await click('motion-run');assert.match(await text('motion-error'),/Declare/);await evaluate("document.getElementById('motion-declared').checked=true");await click('motion-run');assert.equal(await evaluate("document.querySelectorAll('#motion-plot [data-motion-path]').length"),3);
  await click('motion-play');await delay(200);await click('motion-play');assert.ok(await evaluate("Number(document.getElementById('motion-frame').value)>0"));
 });
 await check('actual release download preserves only original sources and declared settings',async()=>{
  await click('release-save');let names=[];for(let i=0;i<70;i++){names=await readdir(downloads);if(names.includes('worldlaw-viscous-release.json'))break;await delay(80);}assert.ok(names.includes('worldlaw-viscous-release.json'));
  saved=JSON.parse(await readFile(path.join(downloads,'worldlaw-viscous-release.json'),'utf8'));assert.deepEqual(Object.keys(saved).sort(),['response','schema','settings','viscous']);assert.equal(saved.response.permitted.length,9);assert.ok(saved.viscous.challenge);assert.ok(!JSON.stringify(saved).includes('proposedIndices'));
 });
 await check('independent reopen recomputes the proposal without replacing the active source pair',async()=>{
  await restart('independent');await importValue('release-file',saved);await wait("!document.getElementById('release-results').hidden");assert.match(await text('release-source'),/Own reopened sources/);assert.equal(await evaluate("document.getElementById('course').value"),'independent');assert.deepEqual(await curves(),bestCurves);
  await click('release-paired');await evaluate("document.getElementById('release-family').value='symmetric';document.getElementById('release-family').dispatchEvent(new Event('change'))");assert.equal(await evaluate("document.getElementById('release-apply').disabled"),true);assert.match(await text('release-adoption'),/same response and viscous sources/);
 });
 await check('changed settings and complete work refusal retire all old recommendations',async()=>{
  await set('release-step',1e-8);assert.equal(await evaluate("document.getElementById('release-results').hidden"),true);assert.equal(await evaluate("document.getElementById('release-save').disabled"),true);await click('release-run');assert.match(await text('release-error'),/exceeds 120000/);assert.equal(await evaluate("document.getElementById('release-results').hidden"),true);
  const weak=structuredClone(saved);weak.viscous.training.record.courses.forEach(c=>c.rows.forEach(row=>{row.position=[0,0];row.torque=[0,0];}));await importValue('release-file',weak);await wait("document.getElementById('release-status').textContent.includes('Unsupported training')");assert.equal(await evaluate("document.querySelectorAll('#release-rows tr[data-release-status=\"unsupported_training\"]').length"),9);assert.equal(await evaluate("document.getElementById('release-apply').disabled"),true);
 });
 await check('unfamiliar permitted input set changes actual proposal population; source edits retire it',async()=>{
  const response=structuredClone(saved.response);response.permitted=[[-.37,.62],[.8,-.11]];response.source.label='Unfamiliar two-release receiving control';await importValue('notebook-file',response);await wait("document.querySelectorAll('#candidate option').length===2");await click('viscous-cross');await click('release-current');await set('release-step',.01);await plan();assert.equal(await evaluate("document.querySelectorAll('#release-rows tr').length"),2);assert.match(await text('release-work'),/17280 \/ 120000/);assert.notDeepEqual(await curves(),bestCurves);
  await set('viscous-width',101);assert.equal(await evaluate("document.getElementById('release-results').hidden"),true);assert.equal(await evaluate("document.getElementById('release-save').disabled"),true);assert.equal(await evaluate("document.getElementById('release-paired').checked"),false);
 });
 await check('late original release read cannot restore a proposal after a newer input action',async()=>{
  await evaluate("window.releaseOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='slow-release.json')return new Promise(resolve=>window.finishReleaseRead=resolve);return releaseOriginalText.call(this)}");
  await importValue('release-file',saved,'slow-release.json');await wait("typeof window.finishReleaseRead==='function'");await set('release-duration',3);await evaluate(`window.finishReleaseRead(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=window.releaseOriginalText`);await delay(100);assert.equal(await evaluate("document.getElementById('release-results').hidden"),true);
 });
 await restart('reciprocal');await click('viscous-cross');await click('release-current');for(const[id,v]of [['release-duration',4],['release-step',.01]])await set(id,v);await plan();
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:width===390});await delay(80);
  await check('complete release table and separation courses fit the actual page at '+width,async()=>{const b=await evaluate("(()=>{const t=document.querySelector('#release-results .table-wrap');return{width:innerWidth,scroll:document.documentElement.scrollWidth,tableWidth:t.clientWidth,tableScroll:t.scrollWidth,plot:document.getElementById('release-plot').getBoundingClientRect().width,paths:document.querySelectorAll('#release-plot [data-release-trace]').length,rows:document.querySelectorAll('#release-rows tr').length}})()");assert.ok(b.scroll<=b.width+1,JSON.stringify(b));assert.ok(b.tableScroll<=b.tableWidth+1,JSON.stringify(b));assert.ok(b.plot>240,JSON.stringify(b));assert.equal(b.paths,3);assert.equal(b.rows,9);});
  const clip=await evaluate("(()=>{const r=document.getElementById('release-lab').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(outputDir,`viscous-release-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 await writeFile(path.join(outputDir,'viscous-release-input.json'),JSON.stringify(saved,null,2));
}
