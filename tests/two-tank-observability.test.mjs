import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTwoTankExcitation,comparePairedPhysicalRuns} from '../src/science/two-tank-observability.mjs';
function run(id,constantValve=true){
  const samples=Array.from({length:20},(_,i)=>({time:i,valid:i!==9,
    level:(30+i*.5)/100,pump:(10+Math.sin(i))/100,valve:(constantValve?50:50+i)/100}));
  return{id,group:'Baseline',samples};
}
test('original-file within-run fixed valve is explicitly diagnosed; pump varies and gaps are retained',()=>{
  const r=summarizeTwoTankExcitation([run('baseline'),run('changing',false)]);
  assert.equal(r.counts.runs,2);
  assert.equal(r.counts.valveFixedWithinRun,1);
  assert.equal(r.counts.valveChangingWithinRun,1);
  assert.equal(r.counts.pumpChangingWithinRun,2);
  assert.equal(r.perRun[0].valve.range,0);
  assert.equal(r.perRun[0].contiguousTransitions,17);
});
test('exact four-run sign flip enumerates each world once and has honest limited inference',()=>{
  const a={byRun:[1,2,3,4].map((v,i)=>({id:'run'+i,horizons:{120:{rmse:6+v}}}))};
  const b={byRun:[1,2,3,4].map((v,i)=>({id:'run'+i,horizons:{120:{rmse:6}}}))};
  const out=comparePairedPhysicalRuns(a,b);
  assert.equal(out.meanDifference,2.5);
  assert.equal(out.signFlip.enumerated,16);
  assert.equal(out.signFlip.oneSidedUpper,1/16);
  assert.equal(out.signFlip.twoSided,2/16);
  const wrong=structuredClone(b);wrong.byRun[0].id='new origin';
  assert.throws(()=>comparePairedPhysicalRuns(a,wrong),/aligned original source ID/);
});
