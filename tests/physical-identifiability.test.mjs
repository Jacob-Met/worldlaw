import test from 'node:test';
import assert from 'node:assert/strict';
import {designPhysicalAnchors,replayPhysicalAnchorCertificate,
  PHYSICAL_IDENTIFIABILITY_SCHEMA} from '../src/science/physical-identifiability.mjs';

// Seven scalar latent physical quantities: true angular rate, DOT-common
// disturbance, four independent private DOT errors and private MRU error.
// Five original gyro channels are linear combinations of these 7 values.
// All tests model a single instant, NOT stochastic covariance or dynamics.
const latent=['trueRate','sharedDotError','dot9','dot10','dot11','dot15','mrup'];
const row=(id,coefficients,cost=1)=>({id,coefficients,cost,
  source:'Declared anchor only; no authenticated physical measurement.'});
const dot=(id,slot)=>row(id,[1,1,...[2,3,4,5].map(i=>i===slot?1:0),0]);
const obs=[dot('DOT9',2),dot('DOT10',3),dot('DOT11',4),dot('DOT15',5),
  row('MRUP',[1,0,0,0,0,0,1])];
const anchors=[
  row('KNOWN_STILLNESS',[1,0,0,0,0,0,0],1),
  row('CALIBRATED_DOT9_PRIVATE',[0,0,1,0,0,0,0],2),
  row('CALIBRATED_MRUP_PRIVATE',[0,0,0,0,0,0,1],5),
  row('DUPLICATE_DOT9',[1,1,1,0,0,0,0],1),
  row('CALIBRATED_DOT10_PRIVATE',[0,0,0,1,0,0,0],4),
];
const base={
  variables:latent,observations:obs,anchors,
  targets:[row('shared',[0,1,0,0,0,0,0]),
           row('rate',[1,0,0,0,0,0,0])],
  maxAnchors:4,
};
function nullWitness(result, id, observations=obs, target=base.targets.find(x=>x.id===id)){
  const t=result.targets.find(x=>x.id===id);
  assert.ok(t&&!t.identifiable);
  const floats=t.counterexample.direction.map(x=>{
    const [a,b]=x.split('/');return Number(a)/Number(b||1);
  });
  for(const r of observations){
    const residual=r.coefficients.reduce((sum,v,i)=>sum+v*floats[i],0);
    assert.equal(residual,0,'exact nullspace direction violates source row '+r.id);
  }
  const value=target.coefficients.reduce((sum,v,i)=>sum+v*floats[i],0);
  assert.notEqual(value,0,'null direction does not alter claimed target');
}

test('actual five-gyro physical observation geometry leaves shared error and physical rate unidentifiable',()=>{
  const p=designPhysicalAnchors({...base,anchors:[],maxAnchors:0});
  assert.equal(p.schema,PHYSICAL_IDENTIFIABILITY_SCHEMA);
  assert.equal(p.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(p.initial.equationRank,5);
  assert.equal(p.initial.unresolvedDimensions,2);
  assert.equal(p.potential.allTargetsIdentifiable,false);
  nullWitness(p.initial,'shared');
  nullWitness(p.initial,'rate');
  assert.equal(p.sourceOnly,true);
  assert.equal(p.fitUsesNumericReadings,false);
});

test('calibrated reference alone cannot distinguish DOT-shared error from independent private DOT errors',()=>{
  const p=designPhysicalAnchors({...base,anchors:[anchors[2]],maxAnchors:1});
  assert.equal(p.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(p.potential.targets.find(x=>x.id==='rate').identifiable,true);
  assert.equal(p.potential.targets.find(x=>x.id==='shared').identifiable,false);
  nullWitness(p.potential,'shared',[...obs,anchors[2]]);
});

test('source-authenticated physical stillness alone cannot identify a common error from unknown private DOT errors',()=>{
  const p=designPhysicalAnchors({...base,anchors:[anchors[0]],maxAnchors:1});
  assert.equal(p.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(p.potential.targets.find(x=>x.id==='rate').identifiable,true);
  assert.equal(p.potential.targets.find(x=>x.id==='shared').identifiable,false);
});

test('exact minimum two independent anchors, with known physical costs, is certified over the complete offered search',()=>{
  const p=designPhysicalAnchors(base);
  assert.equal(p.status,'optimal_structural_design');
  assert.equal(p.exactMinimalAnchors,2);
  assert.deepEqual(p.selection.map(x=>x.id),['KNOWN_STILLNESS','CALIBRATED_DOT9_PRIVATE']);
  assert.equal(p.totalCost,3);
  assert.equal(p.achieved.allTargetsIdentifiable,true);
  assert.equal(p.achieved.equationRank,7);
  assert.equal(p.work.exhausted,false);
  assert.ok(p.work.nodes>5);
  assert.equal(replayPhysicalAnchorCertificate(base,p).valid,true);
  assert.notEqual(p.interpretation.includes('not execute'),false);
});

test('no amount of the same duplicated DOT channel removes the structural gauge',()=>{
  const p=designPhysicalAnchors({...base,anchors:[
    row('duplicate_1',[1,1,1,0,0,0,0]),
    row('duplicate_2',[2,2,2,0,0,0,0]),
    row('duplicate_3',['1/3','1/3','1/3',0,0,0,0]),
  ],maxAnchors:3});
  assert.equal(p.status,'fundamentally_unidentifiable_with_offered_anchors');
  assert.equal(p.initial.equationRank,p.potential.equationRank);
  nullWitness(p.potential,'shared');
});

test('finite one-anchor budget is proved insufficient, without claiming all physical actions are impossible',()=>{
  const p=designPhysicalAnchors({...base,maxAnchors:1});
  assert.equal(p.status,'insufficient_anchor_budget');
  assert.equal(p.potential.allTargetsIdentifiable,true);
  assert.equal(p.selection,null);
  assert.equal(p.exactMinimalAnchors,null);
  assert.equal(p.work.exhausted,false);
});

test('when only target physical rate is requested a known rate anchor wins in one exact experiment',()=>{
  const p=designPhysicalAnchors({...base,targets:[base.targets[1]],maxAnchors:1});
  assert.equal(p.status,'optimal_structural_design');
  assert.equal(p.exactMinimalAnchors,1);
  assert.deepEqual(p.selection.map(x=>x.id),['KNOWN_STILLNESS']);
  assert.equal(p.totalCost,1);
});

test('fixed, exact decimal and fractional source coefficients preserve rank and reproducibility',()=>{
  const row1=row('mix',['1/3','2/6']);
  const row2=row('separating_anchor',[1,0]);
  const request={variables:['x','y'],observations:[row1],
    anchors:[row2],targets:[row('contrast',[1,-1])],maxAnchors:1};
  const p=designPhysicalAnchors(request);
  assert.equal(p.status,'optimal_structural_design');
  assert.equal(p.exactMinimalAnchors,1);
  assert.equal(replayPhysicalAnchorCertificate(request,p).valid,true);
  const exact=designPhysicalAnchors({...request,observations:[row('mix',['0.333333333333','0.333333333333'])]});
  assert.equal(exact.status,p.status);
  assert.equal(exact.initial.equationRank,p.initial.equationRank);
  const near=designPhysicalAnchors({
    variables:['x','y'],
    observations:[row('almost',[1000000000000,1]),row('slightly',[999999999999,1])],
    anchors:[],targets:[row('x',[1,0]),row('y',[0,1])],maxAnchors:0,
  });
  assert.equal(near.status,'already_identifiable','exact BigInt must not confuse huge but distinct coefficients with collinearity');
});

test('numeric heldout readings are categorically absent from physical design',()=>{
  const p=designPhysicalAnchors(base);
  const changed={...base, observations:base.observations.map(x=>({...x,
    measuredRate:1e100,finalTestLabel:'WRONG'})),
    anchors:base.anchors.map(x=>({...x,
      simulatedOutcome:-3e9})),
    targets:base.targets.map(x=>({...x,
      historicalScore:999}))};
  assert.deepEqual(designPhysicalAnchors(changed),p);
  const mutated=structuredClone(p);
  mutated.totalCost=0;
  assert.throws(()=>replayPhysicalAnchorCertificate(base,mutated),
    /certificate or source changed/);
});

test('source mutation and changed physical model change exact certificate, never recycle stale evidence',()=>{
  const a=designPhysicalAnchors(base);
  const changed={...base,observations:[...obs.slice(0,4),
    row('MRUP',[1,1,0,0,0,0,1])]};
  const b=designPhysicalAnchors(changed);
  assert.notDeepEqual(b.initial,a.initial);
  assert.throws(()=>replayPhysicalAnchorCertificate(changed,a));
});

test('full-union feasibility is not confused with bounded search exhaustion',()=>{
  const many=Array.from({length:26},(_,i)=>row('v_'+i,
    i%3===0?[1,0,0]:i%3===1?[0,1,0]:[0,0,1],i+1));
  const request={variables:['x','y','z'],
    observations:[row('x',[1,0,0])],
    anchors:many,targets:[row('y',[0,1,0]),row('z',[0,0,1])],
    maxAnchors:3,workLimit:100};
  const p=designPhysicalAnchors(request);
  assert.equal(p.potential.allTargetsIdentifiable,true);
  assert.equal(p.status,'valid_design_uncertified');
  assert.equal(p.exactMinimalAnchors,null);
  assert.equal(p.work.exhausted,true);
  assert.ok(p.selection.length===2,'a witness may exist even if all minimum candidates were not exhausted');
});

test('equal-cost anchor ties after decimal index 9 retain original numerical source order',()=>{
  const actions=Array.from({length:12},(_,i)=>row('candidate'+i,
    i===2||i===10?[0,1]:[1,0],1));
  const input={variables:['x','y'],
    observations:[row('read_x',[1,0])],
    anchors:actions,
    targets:[row('want_y',[0,1])],
    maxAnchors:1};
  const r=designPhysicalAnchors(input);
  assert.equal(r.status,'optimal_structural_design');
  assert.equal(r.exactMinimalAnchors,1);
  assert.equal(r.totalCost,1);
  assert.deepEqual(r.selection.map(x=>x.id),['candidate2']);
});

test('refuse malformed or imprecisely represented physical source inputs',()=>{
  const bad=[
    {...base,variables:['s','s']},
    {...base,targets:[]},
    {...base,observations:[row('zero',Array(7).fill(0))]},
    {...base,observations:[row('decimal',[.1,0,0,0,0,0,0])]},
    {...base,observations:[row('denominator',['1/0',0,0,0,0,0,0])]},
    {...base,observations:[row('infinite',[Infinity,0,0,0,0,0,0])]},
    {...base,maxAnchors:20},
    {...base,workLimit:200000000},
    {...base,anchors:[row('negativeCost',[1,0,0,0,0,0,0],0)]},
  ];
  for(const problem of bad)assert.throws(()=>designPhysicalAnchors(problem),
    /Physical structural identifiability/);
});
