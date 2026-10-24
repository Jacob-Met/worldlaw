import assert from 'node:assert/strict';
export async function receiveJointInputEnclosures({evaluate,send,report}){
 const data={schema:'worldlaw.observations/v1',source:{label:'Authored shared-coordinate cancellation control'},observations:[-3,-2,-1,-.5,.5,1,2,3,0].map(x=>({command:0,position:x,rate:0,jointTorque:x===0?.001:x-Math.sin(x)})),heldOut:[]};
 await evaluate(`(async()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(data))}],'joint.json',{type:'application/json'}));const i=document.querySelector('#observation-file');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));for(let n=0;n<100&&i.value;n++)await new Promise(r=>setTimeout(r,20));if(i.value)throw Error('Import timed out');})()`);
 await evaluate("(()=>{const b=[...document.querySelectorAll('#hypothesis-list button')].find(b=>b.querySelector('.hypothesis-name').textContent==='Linear spring + Sinusoidal gravity');if(!b)throw Error('Required candidate absent');b.click();const i=document.querySelector('#input-enclosures [data-radius=position]');i.value='.1';i.dispatchEvent(new Event('input',{bubbles:true}));})()");
 const text=()=>evaluate("document.querySelector('#input-enclosures').textContent");
 const choose=async n=>evaluate(`(()=>{const s=document.querySelector('#input-enclosures [data-refinement=segments]');s.value='${n}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const run=()=>evaluate("document.querySelector('#input-enclosures button').click()");
 const before=await evaluate("localStorage.getItem('worldlaw.notebook.v1')");
 await choose(0);await run();assert.match(await text(),/0 of 9 readings excluded/);
 await choose(1);assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);await run();assert.match(await text(),/1 of 9 readings excluded/);assert.match(await text(),/Joint position enclosure applied to 9 rows/);
 assert.equal(await evaluate("localStorage.getItem('worldlaw.notebook.v1')"),before);
 report.push('same Studio refinement excludes cancellation observation while retaining explicit independent baseline and frozen notebook');
 await choose(64);await run();const last=await evaluate("[...document.querySelectorAll('#input-enclosures li')].at(-1).textContent");assert.match(last,/0\.000166705/);assert.match(last,/0\.199833/);
 report.push('64segment consumer approaches analytic extrema and displays original independent enclosure');
 await evaluate("[...document.querySelectorAll('#hypothesis-list button')].find(b=>b.getAttribute('aria-pressed')!=='true').click()");assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);assert.equal(await evaluate("document.querySelector('#input-enclosures [data-refinement=segments]').value"),'1');
 report.push('model change invalidates refined results and resets complete-course declaration');
 await evaluate("(()=>{[...document.querySelectorAll('#hypothesis-list button')].find(b=>b.querySelector('.hypothesis-name').textContent==='Linear spring + Sinusoidal gravity').click();const i=document.querySelector('#input-enclosures [data-radius=position]');i.value='.1';i.dispatchEvent(new Event('input',{bubbles:true}));})()");await choose(64);await run();
 const captures={};for(const[name,width,height]of[['desktop',1280,1000],['narrow',390,844]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='narrow'});await evaluate("document.querySelector('#input-enclosures').scrollIntoView({block:'start',behavior:'instant'})");await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));captures[name]=await send('Page.captureScreenshot',{format:'png'});}await send('Emulation.clearDeviceMetricsOverride');return captures;
}
