import assert from 'node:assert/strict';
import {receiveBoundedScalarPlanning} from './bounded-scalar-plan.receiving.mjs';
import {receiveBoundedExperimentReceipts} from './bounded-experiment-receipts.receiving.mjs';
import {receiveGainClock} from './gain-clock.receiving.mjs';
import {affineClockExample} from '../src/science/clock-affine-example.mjs';
import {exportClockEvidence} from '../src/science/clock-evidence.mjs';
export async function receiveStackedPlanning(ctx){
 const {evaluate,report}=ctx,captures={};
 for(const [name,receive]of [['scalar',receiveBoundedScalarPlanning],['receipts',receiveBoundedExperimentReceipts],['gain-clock',receiveGainClock]]){
  if(name==='gain-clock')ctx.scalarBefore=await save('export-session');
  for(const[k,v]of Object.entries(await receive(ctx)))captures[`${name}-${k}`]=v;
 }
 assert.equal(await save('export-session'),ctx.scalarBefore,'clock-family import/compare/reopen must not change scalar session or receipt work');
 report.push('same browser: clock-family notebook leaves scalar session and cumulative receiving reservation identical');
 const clockBefore=await save('affine-save');
 await open('session-file',ctx.scalarBefore);
 assert.equal(await save('affine-save'),clockBefore,'saved independent fixed clock law survives unrelated scalar source reopen');
 report.push('scalar source reopen preserves independently saved clock-family investigation');
 const legacy=affineClockExample(),legacyText=exportClockEvidence(legacy.model,legacy.input);
 await open('affine-file',legacyText);assert.match(await evaluate("document.querySelector('#affine-status').textContent"),/complete hypotheses/);
 assert.deepEqual(JSON.parse(await save('affine-save')),JSON.parse(legacyText));
 assert.equal(await save('export-session'),ctx.scalarBefore);
 await open('affine-file',clockBefore);assert.match(await evaluate("document.querySelector('#affine-results').textContent"),/All prior families excluded/);
 report.push('natural affine-clock source notebook still round-trips between gain-family imports without scalar side effects');
 const forged=JSON.stringify({schema:'worldlaw.gain-clock-investigation/v1',model:legacy.model,input:legacy.input});await open('affine-file',forged);assert.match(await evaluate("document.querySelector('#affine-status').textContent"),/gain-clock input/);assert.equal(await evaluate("document.querySelector('#affine-save').disabled"),true);await open('affine-file',clockBefore);report.push('cross-format gain envelope refused in actual file intake; original valid gain notebook still reopens');
 return captures;
 async function save(id){return evaluate(`(async()=>{let b;const old=URL.createObjectURL;URL.createObjectURL=x=>{b=x;return old(x)};try{document.getElementById(${JSON.stringify(id)}).click()}finally{URL.createObjectURL=old}if(!b)throw Error('Save did not produce source');return b.text()})()`);}
 async function open(id,text){await evaluate(`(async()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],'source.json',{type:'application/json'}));const f=document.getElementById(${JSON.stringify(id)});f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<100&&f.value;i++)await new Promise(r=>setTimeout(r,20));if(f.value)throw Error('Open timed out');})()`);}
}
