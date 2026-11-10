// Independent receiver authored from CONTRACT/API before reading implementation.
// Synthetic declarations and mathematical controls, not acquired evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PROBE_CHOICE_SCHEMA,planProbeChoice,exportProbeChoice,importProbeChoice} from '../src/unknown-lab/probe-choice.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
import {compareProbeCourse,planProbeCourses} from '../src/unknown-lab/probe-course.mjs';
import {planProbeAcquisition} from '../src/unknown-lab/probe-planner.mjs';
import {screenIntervalPairs} from '../src/experiment-design/interval-separation.mjs';
const training=(kind='ambiguous')=>{const t=probeExample(kind);t.runs=t.runs.filter(r=>r.role==='training');return t;};
const cheap=()=>({contrastRadius:.01,budget:6,probes:[{id:'single',position:.6,rate:0,cost:2},{id:'extra',position:.6,rate:-.6,cost:4}]});
const joint=()=>({contrastRadius:.001,budget:2,probes:[{id:'slower',position:Math.asin(.5),rate:.47,cost:1},{id:'faster',position:Math.asin(.5),rate:.53,cost:1}]});
const cmp=(a,b)=>a<b?-1:a>b?1:0;
function checkFamily(plan,n){
 assert.equal(plan.schema,PROBE_CHOICE_SCHEMA);
 assert.equal(plan.options.length,n*(n+1)/2);
 const ids=plan.settings.probes.map(x=>x.id).sort(cmp),expected=ids.map(id=>[id]);
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)expected.push([ids[i],ids[j]]);
 assert.deepEqual(plan.options.map(x=>x.ids),expected);
 const work={count:0,limit:200000};
 for(const option of plan.options){
  assert.deepEqual(option.states.map(x=>x.id),option.ids);
  assert.equal(option.cost,option.ids.reduce((sum,id)=>sum+plan.settings.probes.find(p=>p.id===id).cost,0));
  assert.equal(option.withinBudget,option.cost<=plan.settings.budget);
  const comparisons=compareProbeCourse(plan.models,option.states.map(x=>x.probe),plan.settings.contrastRadius,work);
  assert.deepEqual(option.comparisons,comparisons);
  assert.equal(option.total,plan.models.length*(plan.models.length-1)/2);
  assert.equal(option.separated,comparisons.filter(x=>x.separable).length);
  assert.equal(option.allSeparated,option.separated===option.total);
  for(const state of option.states){
   const single=plan.options.find(x=>x.ids.length===1&&x.ids[0]===state.id);
   assert.deepEqual(state.comparisons,single.comparisons);
   assert.equal(state.separated,single.separated);
   assert.equal(state.total,single.total);
   assert.equal(state.allSeparated,single.allSeparated);
  }
  const expectedJoint=option.ids.length===1?[]:comparisons.filter(x=>x.separable&&option.states.every(s=>!s.comparisons.find(y=>JSON.stringify(y.hypotheses)===JSON.stringify(x.hypotheses)).separable)).map(x=>x.hypotheses);
  assert.deepEqual(option.jointOnly,expectedJoint);
 }
 // Same unchanged primitive is an exact policy/work-accounting consistency oracle,
 // not independent geometry proof or forced planner-budget exhaustion.
 assert.equal(plan.work,work.count);
 assert.ok(plan.work>0&&plan.work<=200000);
 if(plan.selected)assert.ok(plan.options.includes(plan.selected));
}

test('one informative state avoids a costlier equally discriminating pair',()=>{
 const t=training(),input=cheap(),before=structuredClone({t,input});
 const p=planProbeChoice(t,input);checkFamily(p,2);
 assert.deepEqual(p.models.map(x=>x.id),['drag','restoring']);
 assert.deepEqual(p.options.map(x=>x.separated),[1,1,1]);
 assert.deepEqual(p.selected.ids,['single']);assert.equal(p.selected.cost,2);
 assert.equal(p.options.find(x=>x.ids.length===2).cost,6);
 assert.equal(p.status,'all-pairs-separated');assert.deepEqual({t,input},before);
});

test('joint-only information is retained and an unaffordable pair is not hidden',()=>{
 const p=planProbeChoice(training(),joint());checkFamily(p,2);
 assert.deepEqual(p.options.map(x=>x.separated),[0,0,1]);
 assert.deepEqual(p.selected.ids,['faster','slower']);assert.equal(p.selected.cost,2);
 assert.deepEqual(p.selected.jointOnly,[['drag','restoring']]);
 const denied=planProbeChoice(training(),{...joint(),budget:1});checkFamily(denied,2);
 assert.equal(denied.selected,null);assert.equal(denied.status,'no-informative-choice');
 assert.equal(denied.options[2].withinBudget,false);assert.equal(denied.options[2].separated,1);
});

test('zero effort, fewer-state tie and ASCII IDs are invariant to offered ordering',()=>{
 const probes=[{id:'z',position:.6,rate:0,cost:0},{id:'A',position:.7,rate:0,cost:0},{id:'_',position:.8,rate:0,cost:0},{id:'a',position:.9,rate:0,cost:0}];
 const input={probes,contrastRadius:.01,budget:0};const p=planProbeChoice(training(),input);checkFamily(p,4);
 assert.deepEqual(p.selected.ids,['A']);assert.equal(p.selected.cost,0);
 for(const offered of [probes.toReversed(),[probes[2],probes[0],probes[3],probes[1]]]){
  const q=planProbeChoice(training(),{...input,probes:offered});
  assert.deepEqual(q.options,p.options);assert.deepEqual(q.selected,p.selected);assert.equal(q.work,p.work);
  assert.deepEqual(q.settings.probes.map(x=>x.id),offered.map(x=>x.id));
 }
});

test('complete 1/8-state family and invalid declarations fail honestly',()=>{
 const t=training(),input=cheap();checkFamily(planProbeChoice(t,{...input,probes:input.probes.slice(0,1)}),1);
 const eight=Array.from({length:8},(_,i)=>({id:'p'+i,position:.4+i*.1,rate:0,cost:i}));
 const p=planProbeChoice(t,{...input,probes:eight,budget:0});checkFamily(p,8);assert.equal(p.options.length,36);
 assert.ok(p.options.some(x=>!x.withinBudget));
 for(const bad of [{...input,probes:[]},{...input,probes:[...eight,{id:'p8',position:2,rate:0,cost:0}]},{...input,probes:[input.probes[0],input.probes[0]]},{...input,probes:[input.probes[0],{...input.probes[0],id:'different'}]},{...input,contrastRadius:0},{...input,contrastRadius:NaN},{...input,budget:-1},{...input,probes:[{...input.probes[0],cost:Infinity}]}])assert.throws(()=>planProbeChoice(t,bad));
 assert.throws(()=>planProbeChoice(probeExample('ambiguous'),input),/training runs only/);
});

test('uninformative, partial, and unavailable are distinct outcomes',()=>{
 const p=planProbeChoice(training(),{contrastRadius:1000,budget:6,probes:cheap().probes});checkFamily(p,2);
 assert.equal(p.selected,null);assert.ok(p.options.every(x=>x.separated===0));assert.equal(p.status,'no-informative-choice');
 const t=training();t.runs.forEach(r=>r.notebook.noiseSigma=.1);
 const partial=planProbeChoice(t,{contrastRadius:.01,budget:1,probes:[{id:'zero',position:0,rate:0,cost:1}]});checkFamily(partial,1);
 assert.equal(partial.models.length,3);assert.equal(partial.selected.separated,2);assert.equal(partial.selected.total,3);assert.equal(partial.status,'partial-separation');
 for(const kind of ['drag','mixed']){const q=planProbeChoice(training(kind),cheap());assert.equal(q.status,'unavailable');assert.equal(q.selected,null);assert.deepEqual(q.options,[]);assert.equal(q.work,0);}
});

test('source-only export/reopen ignores forged derived values without altering legacy source',()=>{
 for(const input of [cheap(),joint(),{...joint(),budget:0}]){
  const t=training(),p=planProbeChoice(t,input),text=exportProbeChoice(t,input),raw=JSON.parse(text);
  assert.deepEqual(Object.keys(raw).sort(),['schema','settings','training']);assert.equal(raw.schema,'worldlaw.probe-choice/v1');
  assert.deepEqual(importProbeChoice(text),p);
  Object.assign(raw,{selected:{ids:['forged']},options:[],models:[],work:0,status:'all-pairs-separated'});
  assert.deepEqual(importProbeChoice(JSON.stringify(raw)),p);
 }
 const raw=JSON.parse(exportProbeChoice(training(),joint()));raw.settings.budget=1;assert.equal(importProbeChoice(JSON.stringify(raw)).selected,null);
 for(const text of ['{','{}',JSON.stringify({schema:'worldlaw.probe-plan/v1'}),' '.repeat(4000001)])assert.throws(()=>importProbeChoice(text));
});

test('declared saturation family and exact count/work consistency survive choice',()=>{
 const t=training();t.schema='worldlaw.probe-response/v2';t.rateSaturationScales=[.5,1,2];
 const old=planProbeAcquisition(t,cheap()),p=planProbeChoice(t,cheap());
 assert.deepEqual(p.models,old.models);assert.deepEqual(p.training.rateSaturationScales,[.5,1,2]);checkFamily(p,2);
 assert.ok(p.models.some(m=>m.id.startsWith('saturated-rate:')),'control must exercise a surviving declared saturation model');
 assert.deepEqual(importProbeChoice(exportProbeChoice(t,cheap())),p);
});

test('unchanged exact primitive distinguishes touch and legacy sub-epsilon policy',()=>{
 const models=[{id:'offset',coefficientInterval:[1,1]},{id:'drag',coefficientInterval:[2,2]}];
 assert.equal(compareProbeCourse(models,[{position:0,rate:.625}],.125)[0].separable,false);
 const rate=.625+2**-42;assert.equal(compareProbeCourse(models,[{position:0,rate}],.125)[0].separable,true);
 assert.equal(screenIntervalPairs([{id:'offset',interval:[1,1]},{id:'drag',interval:[2*rate,2*rate]}],.125)[0].separable,false);
});

test('unchanged primitive joint geometry, degeneracy and shared-work exhaustion only',()=>{
 const models=[{id:'drag',coefficientInterval:[1,2]},{id:'restoring',coefficientInterval:[1,2]}];
 const states=[{position:Math.asin(.75),rate:.5},{position:Math.asin(.5),rate:.75}];
 for(const state of states)assert.equal(compareProbeCourse(models,[state],.01)[0].separable,false);
 assert.equal(compareProbeCourse(models,states,.01)[0].separable,true);
 assert.equal(compareProbeCourse(models,states,1)[0].separable,false);
 assert.equal(compareProbeCourse(models.map(m=>({...m,coefficientInterval:[0,2]})),states,.01)[0].separable,false);
 assert.throws(()=>compareProbeCourse(models,states,.01,{count:0,limit:0}),/capacity/);
 const work={count:0,limit:200000};compareProbeCourse(models,states,.01,work);work.limit=work.count;
 assert.throws(()=>compareProbeCourse(models,states,.01,work),/capacity/);
});

test('legacy one-state and two-state recommendations are retained',()=>{
 const input={contrastRadius:.01,budget:4,probes:[{id:'correlated',position:.6,rate:.6,cost:1},{id:'zero-rate',position:.6,rate:0,cost:2},{id:'reversed',position:.6,rate:-.6,cost:4}]};
 assert.equal(planProbeAcquisition(training(),input).selected.id,'zero-rate');
 const old=planProbeCourses(training(),joint());assert.deepEqual(old.selected.jointOnly,[['drag','restoring']]);assert.ok(old.selected.states.every(s=>s.separated===0));
});
