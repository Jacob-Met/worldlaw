import assert from 'node:assert/strict';
export async function receiveInputEnclosures({evaluate,send,report}){
 const data={schema:'worldlaw.observations/v1',source:{label:'Authored repeated-state bound control'},observations:Array.from({length:8},(_,i)=>({command:0,rate:0,position:1+Math.floor(i/2),jointTorque:1+2*i})),heldOut:[]};
 const load=()=>evaluate(`(async()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(data))}],'bounds.json',{type:'application/json'}));const i=document.querySelector('#observation-file');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));for(let n=0;n<100&&i.value;n++)await new Promise(r=>setTimeout(r,20));if(i.value)throw Error('Import timed out');})()`);
 const text=()=>evaluate("document.querySelector('#input-enclosures').textContent");
 const set=async(key,value)=>evaluate(`(()=>{const i=document.querySelector('#input-enclosures [data-radius=${key}]');i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const run=()=>evaluate("document.querySelector('#input-enclosures button').click()");
 await load();assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);
 const before=await evaluate("localStorage.getItem('worldlaw.notebook.v1')");await run();assert.match(await text(),/8 of 8 readings excluded/);
 await set('position','.3');assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);await run();assert.match(await text(),/0 of 8 readings excluded/);
 assert.equal(await evaluate("localStorage.getItem('worldlaw.notebook.v1')"),before);
 report.push('declared coordinate bounds change exclusion without refitting or notebook mutation');
 await set('position','0');await set('jointTorque','1.1');await run();assert.match(await text(),/0 of 8 readings excluded/);
 await set('jointTorque','-1');await run();assert.match(await text(),/Not computed/);assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);
 report.push('reading radius is separate; invalid radii refuse and clear stale results');
 await load();await set('position','.3');await run();await evaluate("document.querySelectorAll('#hypothesis-list button')[1].click()");assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);assert.equal(await evaluate("document.querySelector('#input-enclosures [data-radius=position]').value"),'0');
 await load();assert.equal(await evaluate("document.querySelectorAll('#input-enclosures li').length"),0);await set('position','.3');await run();
 report.push('model/evidence changes reset assumptions and invalidate former enclosure results');
 const captures={};for(const[name,width,height]of[['desktop',1280,1000],['narrow',390,844]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='narrow'});await evaluate("document.querySelector('#input-enclosures').scrollIntoView({block:'start',behavior:'instant'})");await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));captures[name]=await send('Page.captureScreenshot',{format:'png'});}await send('Emulation.clearDeviceMetricsOverride');
 await set('position','0');await evaluate("document.querySelector('#input-enclosures button').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});assert.match(await text(),/8 of 8 readings excluded/);
 report.push('desktop/narrow bounds inspection and keyboard execution pass');return captures;
}
