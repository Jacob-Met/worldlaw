import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {planDurationAcquisition,exportDurationPlan} from '../src/unknown-lab/duration-planner.mjs';
const training=(effect=.7)=>[.1,.2,.3].map((duration,i)=>({id:'r'+i,role:'training',duration,notebook:syntheticChallenge({duration,count:32,seed:100+i,noiseSigma:.005,effect})}));
const settings={durations:[.5,1,2,4,8],contrastRadius:.01,pairs:32,overheadPerPair:.1,budgetSeconds:300};
test('complete prediction sets choose shortest full separation within time budget',()=>{
 const r=planDurationAcquisition(training(),settings);
 assert.equal(r.status,'all-pairs-separated');assert.equal(r.selected.duration,2);
 assert.equal(r.selected.separated,10);assert.equal(r.selected.extrapolation,true);
 assert.equal(r.candidates[0].separated,0);assert.equal(r.candidates[1].separated,7);
 assert.equal(r.selected.costSeconds,67.2);
 for(const pair of r.selected.pairs){
  const [a,b]=pair.hypotheses.map(id=>r.selected.predictions.find(p=>p.id===id).interval);
  assert.ok(a[1]+.02<b[0]||b[1]+.02<a[0]);
 }
});
test('budget retains partial separation and excluded candidates without fabricated acquisition',()=>{
 const r=planDurationAcquisition(training(),{...settings,budgetSeconds:40});
 assert.equal(r.status,'partial-separation');assert.equal(r.selected.duration,1);assert.equal(r.selected.separated,7);
 assert.equal(r.candidates.find(c=>c.duration===2).withinBudget,false);
 assert.equal('observations' in r.selected,false);
});
test('zero response and large uncertainty refuse an informative request',()=>{
 assert.equal(planDurationAcquisition(training(0),settings).selected,null);
 assert.equal(planDurationAcquisition(training(),{...settings,contrastRadius:10}).selected,null);
 assert.throws(()=>exportDurationPlan(training(0),settings),/No informative/);
});
test('training only and deterministic grid ordering; complete input-based replay',()=>{
 const rows=training(),before=JSON.stringify(rows),a=planDurationAcquisition(rows,settings);
 assert.equal(planDurationAcquisition(rows,{...settings,durations:[8,2,4,1,.5]}).selected.duration,a.selected.duration);
 assert.equal(JSON.stringify(rows),before);
 const challenge={...training()[0],id:'held',role:'challenge'};
 assert.throws(()=>planDurationAcquisition([challenge],settings),/training runs only/);
 const saved=JSON.parse(exportDurationPlan(rows,settings));
 assert.deepEqual(saved,planDurationAcquisition(saved.training.runs,saved.settings));
});
test('zero budget and malformed acquisition constraints refuse without fallback',()=>{
 assert.equal(planDurationAcquisition(training(),{...settings,budgetSeconds:0}).selected,null);
 for(const patch of [{pairs:9},{pairs:6},{contrastRadius:0},{durations:[1,1]},{durations:[NaN]},{overheadPerPair:-1},{budgetSeconds:Infinity}])
  assert.throws(()=>planDurationAcquisition(training(),{...settings,...patch}));
});

test('touching uncertainty-expanded prediction sets do not count as separated',()=>{
 const base=planDurationAcquisition(training(),settings),pair=base.selected.pairs[0];
 const boundary=planDurationAcquisition(training(),{...settings,durations:[2],contrastRadius:pair.gap/2});
 assert.equal(boundary.candidates[0].pairs[0].separable,false);
});
