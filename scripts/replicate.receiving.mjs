import assert from 'node:assert/strict';
export async function receiveReplicateDiagnosis({evaluate,send,report}) {
 const fixture={schema:'worldlaw.observations/v1',source:{label:'Authored repeated-state browser control'},observations:Array.from({length:8},(_,i)=>({command:0,rate:0,position:1+Math.floor(i/2),jointTorque:1+2*i})),heldOut:[]};
 const importFile=async(id,value)=>evaluate(`(async()=>{const file=new File([${JSON.stringify(JSON.stringify(value))}],'replicate-control.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.getElementById(${JSON.stringify(id)});input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<100&&input.value;i++)await new Promise(r=>setTimeout(r,20));if(input.value)throw Error('Import did not complete');})()`);
 const text=()=>evaluate("document.querySelector('#replicate-diagnostics').textContent");
 await importFile('observation-file',fixture);const initial=await text();
 assert.match(initial,/8 rows in 4 repeated states/);assert.match(initial,/1\.414/);assert.match(initial,/4 degrees of freedom/);
 report.push('replicate actual JSON import displays independently known scatter and full denominator');
 const count=await evaluate("document.querySelectorAll('#hypothesis-list button').length");let changed=false;
 for(let i=1;i<count;i++){await evaluate(`document.querySelectorAll('#hypothesis-list button')[${i}].click()`);const value=await text();assert.match(value,/1\.414/);assert.match(value,/8 rows in 4 repeated states/);if(value!==initial){changed=true;break;}}
 assert.ok(changed,'alternate must change mismatch while retaining scatter');
 report.push('alternative inspection changes mismatch while scatter stays fixed');
 const notebook=await evaluate(`(async()=>{const original=URL.createObjectURL;let exported;URL.createObjectURL=function(blob){exported=blob;return original.call(this,blob)};try{document.querySelector('#export-session').click();}finally{URL.createObjectURL=original;}if(!exported)throw Error('Export did not produce Blob');return await exported.text();})()`);
 await importFile('session-file',JSON.parse(notebook));assert.equal(await text(),initial);
 report.push('real export Blob reopens through file input and recomputes diagnosis');
 const invalid=structuredClone(fixture);invalid.observations[0].position='invalid';await importFile('observation-file',invalid);assert.equal(await text(),initial);assert.equal(await evaluate("document.querySelector('#error').hidden"),false);
 report.push('invalid import preserves valid diagnosis');
 const unique=structuredClone(fixture);unique.observations.forEach((r,i)=>r.position=i+1);await importFile('observation-file',unique);assert.match(await text(),/No exact repeated states/);
 report.push('unique states report unavailable scatter');await importFile('observation-file',fixture);
 const captures={};
 for(const [name,width,height] of [['desktop',1280,1000],['narrow',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='narrow'});
  await evaluate("document.querySelector('#replicate-diagnostics').scrollIntoView({block:'center',behavior:'instant'})");await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));assert.ok(await evaluate("(()=>{const r=document.querySelector('#replicate-diagnostics').getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})()"));
  captures[name]=await send('Page.captureScreenshot',{format:'png'});
 }
 await send('Emulation.clearDeviceMetricsOverride');await evaluate("document.querySelector('#hypothesis-list button').focus()");assert.equal(await evaluate("document.activeElement.matches('#hypothesis-list button')"),true);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.match(await text(),/8 rows in 4 repeated states/);
 report.push('desktop/narrow viewport and keyboard model interaction pass');return captures;
}
