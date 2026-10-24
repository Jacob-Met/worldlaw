import assert from 'node:assert/strict';
export async function receiveStateSupport({evaluate,send,report}){
 const fixture=xs=>({schema:'worldlaw.observations/v1',source:{label:'Authored state-support control'},observations:xs.map(x=>({command:0,rate:0,position:x,jointTorque:4*x+1})),heldOut:[]});
 const importFile=async value=>evaluate(`(async()=>{const f=new File([${JSON.stringify(JSON.stringify(value))}],'support.json',{type:'application/json'}),dt=new DataTransfer();dt.items.add(f);const input=document.querySelector('#observation-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<100&&input.value;i++)await new Promise(r=>setTimeout(r,20));if(input.value)throw Error('Import timed out');})()`);
 const text=()=>evaluate("document.querySelector('#state-support').textContent");
 const inspectAffine=()=>evaluate("(()=>{const button=[...document.querySelectorAll('#hypothesis-list button')].find(b=>b.querySelector('.hypothesis-name').textContent==='Linear spring + Bias');if(!button)throw Error('Expected fixed affine hypothesis unavailable');button.click();})()");
 const run=()=>evaluate("document.querySelector('#state-support button').click()");
 await importFile(fixture(Array.from({length:18},(_,i)=>i===17?1:0)));await inspectAffine();
 assert.match(await text(),/Refit the inspected structure/);
 assert.equal(await evaluate("document.querySelectorAll('#state-support li').length"),0);
 const before=await evaluate("localStorage.getItem('worldlaw.notebook.v1')");
 await run();const sparse=await text();
 assert.match(sparse,/0 of 2 omissions/);assert.match(sparse,/17 retained.*could not return this exact structure/);
 assert.match(sparse,/1 retained.*Fewer than eight/);
 assert.equal(await evaluate("localStorage.getItem('worldlaw.notebook.v1')"),before);
 report.push('explicit state-omission action retains unavailable-structure and insufficient-row outcomes without changing notebook');
 await evaluate("document.querySelector('#hypothesis-list button').click()");
 assert.equal(await evaluate("document.querySelectorAll('#state-support li').length"),0);
 assert.match(await text(),/Refit the inspected structure/);
 report.push('model inspection clears prior deletion results until explicitly recomputed');
 await importFile(fixture(Array.from({length:30},(_,i)=>i%5)));await inspectAffine();
 assert.equal(await evaluate("document.querySelectorAll('#state-support li').length"),0);
 await run();assert.match(await text(),/5 of 5 omissions/);
 assert.equal(await evaluate("document.querySelectorAll('#state-support li').length"),5);
 report.push('changed input clears previous results and rich design completes all five fixed-structure omissions');
 await importFile(fixture(Array.from({length:40},(_,i)=>i)));await run();
 assert.match(await text(),/Not computed: 40 states/);assert.equal(await evaluate("document.querySelectorAll('#state-support li').length"),0);
 report.push('actual consumer refuses oversized whole course without partial results');
 await importFile(fixture(Array.from({length:18},(_,i)=>i===17?1:0)));await inspectAffine();
 await evaluate("document.querySelector('#state-support button').focus()");
 await send('Input.dispatchKeyEvent',{type:'keyDown',text:'\r',unmodifiedText:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.match(await text(),/0 of 2 omissions/);
 const captures={};
 for(const [name,width,height] of [['desktop',1280,1000],['narrow',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='narrow'});
  await evaluate("document.querySelector('#state-support').scrollIntoView({block:'center',behavior:'instant'})");
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  captures[name]=await send('Page.captureScreenshot',{format:'png'});
 }
 await send('Emulation.clearDeviceMetricsOverride');
 report.push('keyboard action and desktop/narrow displayed failure course remain usable');return captures;
}
