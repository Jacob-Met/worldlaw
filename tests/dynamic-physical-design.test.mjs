import test from 'node:test';
import assert from 'node:assert/strict';
import {designDynamicPhysicalReadings,replayDynamicPhysicalReadings,DYNAMIC_PHYSICAL_SCHEMA}
  from '../src/science/dynamic-physical-design.mjs';
import {propagatePhysicalObservation} from '../src/science/physical-identifiability.mjs';

const variables=['physicalRate','commonDOT','private9','private10','private11','private15','privateReference'];
const row=(id,coefficients,cost=1)=>({id,coefficients,cost,source:'Original published five-gyro channel geometry; coefficients declared, not measured'});
const dot=(id,slot)=>row(id,[1,1,...[2,3,4,5].map(i=>i===slot?1:0),0]);
const baseline=[dot('DOT9',2),dot('DOT10',3),dot('DOT11',4),dot('DOT15',5),
  row('MRUP',[1,0,0,0,0,0,1])];
const diagonal=(a,b)=>Array.from({length:7},(_,i)=>
  Array.from({length:7},(_,j)=>i===j?(i===0?a:i===1?b:1):0));
const original=(a='1/2',b='1/3')=>({
  schema:DYNAMIC_PHYSICAL_SCHEMA,variables,
  observations:structuredClone(baseline),
  futureSensors:structuredClone(baseline),
  evolution:{matrix:diagonal(a,b),
    source:'Declared controlled linear-noise hypothesis; NOT measured MAGF-ID gyro dynamics'},
  targets:[row('rate',[1,0,0,0,0,0,0]),row('common',[0,1,0,0,0,0,0])],
  horizon:2,maxReadings:2,workLimit:50000,
});
function denseRank(rows){
  let m=rows.map(r=>r.map(Number)),rank=0,n=m[0]?.length??0;
  for(let c=0;c<n;c++){
    let pivot=rank;
    while(pivot<m.length&&Math.abs(m[pivot][c])<1e-10)pivot++;
    if(pivot===m.length)continue;
    [m[rank],m[pivot]]=[m[pivot],m[rank]];
    const d=m[rank][c];for(let j=c;j<n;j++)m[rank][j]/=d;
    for(let i=0;i<m.length;i++)if(i!==rank){
      const f=m[i][c];for(let j=c;j<n;j++)m[i][j]-=f*m[rank][j];
    }
    rank++;
  }
  return rank;
}
test('original five observed gyros require exactly two future readings if two independently declared modes truly decay',()=>{
  const r=designDynamicPhysicalReadings(original());
  assert.equal(r.status,'optimal_structural_design');
  assert.equal(r.numFutureReadings,2);
  assert.equal(r.readingCost,2);
  assert.equal(r.proof.initial.equationRank,5);
  assert.equal(r.proof.achieved.equationRank,7);
  assert.equal(r.proof.achieved.allTargetsIdentifiable,true);
  assert.ok(r.schedule.some(s=>s.sensorId==='MRUP'));
  assert.ok(r.schedule.some(s=>s.sensorId.startsWith('DOT')));
  assert.equal(r.actualPhysicalActionsPerformed,false);
  assert.equal(r.scientificStatus,'conditional_structural_design_only');
  assert.equal(replayDynamicPhysicalReadings(original(),r).valid,true);
});
test('no repeated channel can resolve the two original latent gauges under an identity transition',()=>{
  const r=designDynamicPhysicalReadings(original(1,1));
  assert.equal(r.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(r.numFutureReadings,null);
  assert.equal(r.proof.initial.equationRank,5);
  assert.equal(r.proof.potential.equationRank,5);
  assert.equal(r.proof.potential.allTargetsIdentifiable,false);
});
test('rate-only drift and disturbance-only drift leave opposite structural blind directions',()=>{
  const rateOnly=designDynamicPhysicalReadings(original('1/2',1));
  assert.equal(rateOnly.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(rateOnly.proof.potential.targets.find(t=>t.id==='rate').identifiable,true);
  assert.equal(rateOnly.proof.potential.targets.find(t=>t.id==='common').identifiable,false);
  const commonOnly=designDynamicPhysicalReadings(original(1,'1/3'));
  assert.equal(commonOnly.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(commonOnly.proof.potential.targets.find(t=>t.id==='rate').identifiable,false);
  assert.equal(commonOnly.proof.potential.targets.find(t=>t.id==='common').identifiable,true);
});
test('independently priced future channels break ties only at the certified minimum reading count',()=>{
  const p=original();
  p.futureSensors=[{...baseline[0],cost:9},{...baseline[1],cost:2},{...baseline[4],cost:1}];
  const r=designDynamicPhysicalReadings(p);
  assert.equal(r.status,'optimal_structural_design');
  assert.equal(r.numFutureReadings,2);
  assert.equal(r.readingCost,3);
  assert.deepEqual(r.schedule.map(s=>s.sensorId),['DOT10','MRUP']);
});
test('original source measurement outcome fields cannot contaminate prospective design or replay',()=>{
  const p=original();
  const a=designDynamicPhysicalReadings(p);
  const changed=structuredClone(p);
  for(const s of changed.observations)s.heldoutRate=1e99;
  for(const s of changed.futureSensors)s.sampledOutcome=-100;
  assert.deepEqual(designDynamicPhysicalReadings(changed),a);
  changed.evolution.matrix[0][0]='1/5';
  const b=designDynamicPhysicalReadings(changed);
  assert.notDeepEqual(b,a);
  assert.throws(()=>replayDynamicPhysicalReadings(changed,a),/certificate or source transition changed/);
});
test('exact fractional time propagation agrees with independently multiplied rational identity and scalar examples',()=>{
  const m=diagonal('1/2','1/3');
  const initial=[1,1,0,0,0,0,0];
  const once=propagatePhysicalObservation(initial,m);
  assert.deepEqual(once.slice(0,2),['1/2','1/3']);
  const twice=propagatePhysicalObservation(once,m);
  assert.deepEqual(twice.slice(0,2),['1/4','1/9']);
  assert.deepEqual(propagatePhysicalObservation([1,0,0,0,0,0,0],m).slice(0,2),['1/2','0']);
});
test('heldout 25 transition pairs match independent dense complete-row rank oracle',()=>{
  const candidates=['0','1','1/2','1/3','2'];
  let checked=0;
  for(const a of candidates)for(const b of candidates){
    const p=original(a,b);
    p.horizon=1;
    p.offeredTicks=[1];
    p.maxReadings=2;
    const result=designDynamicPhysicalReadings(p);
    const numeric=(x)=>typeof x==='string'&&x.includes('/')?
      Number(x.split('/')[0])/Number(x.split('/')[1]):Number(x);
    const orig=baseline.map(s=>s.coefficients.map(numeric));
    const evolved=baseline.map(s=>s.coefficients.map((c,i)=>numeric(c)*(i===0?numeric(a):i===1?numeric(b):1)));
    const fullRank=denseRank([...orig,...evolved]);
    assert.equal(result.proof.potential.equationRank,fullRank, a+'/'+b);
    assert.equal(result.proof.potential.allTargetsIdentifiable,fullRank===7,a+'/'+b);
    checked++;
  }
  assert.equal(checked,25);
});
test('malformed/forged physical transition, budget, times, and sensor menus are loudly refused',()=>{
  const p=original();
  const mutations=[
    {...p,schema:'worldlaw.physical-identifiability-input/v1'},
    {...p,evolution:{...p.evolution,matrix:[[1]]}},
    {...p,evolution:{...p.evolution,source:'x'}},
    {...p,horizon:0},
    {...p,offeredTicks:[1,1]},
    {...p,offeredTicks:[3]},
    {...p,futureSensors:[{...baseline[0],cost:0}]},
    {...p,maxReadings:30},
    {...p,evolution:{...p.evolution,matrix:diagonal('0.1234567890123','1/3')}},
  ];
  for(const req of mutations)assert.throws(()=>designDynamicPhysicalReadings(req),/Dynamic physical design|Physical structural identifiability/);
});
