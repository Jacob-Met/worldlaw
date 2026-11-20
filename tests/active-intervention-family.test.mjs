import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_INTERVENTION_SCHEMA,
  designActiveInterventionFamily,
  replayActiveInterventionFamily,
} from '../src/science/active-linear-family.mjs';

const source=()=>({
  schema:ACTIVE_INTERVENTION_SCHEMA,
  source:'Explicitly hypothetical scalar decay machine with bounded observation error, no hardware recording.',
  hypotheses:[
    {id:'slow',A:[['1/2']],B:[[1]],C:[1]},
    {id:'fast',A:[['1/3']],B:[[1]],C:[1]}
  ],
  interventions:[
    {id:'no_actuation',actionCost:0,controls:[[0],[0],[0],[0]]},
    {id:'late_impulse',actionCost:5,controls:[[0],[1],[0],[0]]},
    {id:'early_impulse',actionCost:1,controls:[[1],[0],[0],[0]]}
  ],
  offeredTicks:[0,1,2,3,4],
  maxReadings:5,
  noiseBound:'1/1000',
  workLimitPerCourse:50000,
});
test('select jointly over intervention and observation time, rejecting an observationally indistinguishable idle control',()=>{
  const x=source(),r=designActiveInterventionFamily(x);
  assert.equal(r.status,'optimal_certified_intervention');
  assert.equal(r.chosenIntervention,'early_impulse');
  assert.equal(r.numReadings,3);
  assert.equal(r.totalDeclaredCost,4);
  assert.equal(r.pairProof.length,1);
  assert.equal(r.pairProof[0].robustCertified,true);
  assert.equal(r.interventionMenu[0].status,'structurally_indistinguishable_on_offered_course');
  assert.equal(r.interventionMenu[0].selection,null);
  assert.equal(r.physicalActionsPerformed,false);
  assert.equal(r.outcomeValuesUsed,false);
  assert.equal(replayActiveInterventionFamily(x,r).valid,true);
});
test('different source-stated effort selects cheaper actual action without hiding cost',()=>{
  const x=source();
  x.interventions[1].actionCost=0;
  const r=designActiveInterventionFamily(x);
  assert.equal(r.chosenIntervention,'late_impulse');
  assert.equal(r.totalDeclaredCost,3);
  assert.equal(r.numReadings,3);
});
test('unobservable family and unachievable uncertainty are unambiguously reported',()=>{
  const x=source();x.hypotheses[1].A[0][0]='1/2';
  const s=designActiveInterventionFamily(x);
  assert.equal(s.status,'no_offered_intervention_certified');
  assert.equal(s.chosenIntervention,null);
  const y=source();y.noiseBound='100';
  const n=designActiveInterventionFamily(y);
  assert.equal(n.status,'noise_separation_not_certified');
  assert.equal(n.chosenIntervention,null);
});
test('sealed planned intervention refuses changed input and forged or outcome-dependent claim',()=>{
  const a=source(),r=designActiveInterventionFamily(a);
  const b=structuredClone(a);b.interventions[2].controls[0][0]=0;
  assert.notDeepEqual(designActiveInterventionFamily(b),r);
  assert.throws(()=>replayActiveInterventionFamily(b,r),/intervention certificate or source changed/);
  const forgery=structuredClone(r);forgery.totalDeclaredCost=0;
  assert.throws(()=>replayActiveInterventionFamily(a,forgery),/intervention certificate or source changed/);
  const outcomes=structuredClone(a);outcomes.hiddenTrueLaw='slow';
  outcomes.interventions[1].measuredSample=[1e9,1e9];
  assert.deepEqual(designActiveInterventionFamily(outcomes),r,
    'candidate cannot see future outcomes while selecting interventions');
});
test('rejects unsafe or unconstrained source representations before arithmetic',()=>{
  const x=source();
  for(const mutate of [
    q=>q.interventions[1].id='early_impulse',
    q=>q.interventions[1].actionCost=-1,
    q=>{q.interventions.pop();q.interventions.pop();},
    q=>q.interventions[0].controls=[['0.1'],[0],[0],[0]],
    q=>q.interventions[1].controls=[[1,2],[0],[0],[0]],
    q=>q.workLimitPerCourse=1,
  ]){
    const req=structuredClone(x);mutate(req);
    assert.throws(()=>designActiveInterventionFamily(req),/Active linear family:/);
  }
});

test('coupled 2D position/hidden-velocity laws require active input and a source-only three-tick dual witness',()=>{
  const req={
    schema:ACTIVE_INTERVENTION_SCHEMA,
    source:'Hypothetical two-mode coupled position and hidden-velocity system, no lab action',
    hypotheses:[
      {id:'unit',A:[[1,1],[0,1]],B:[[0],[1]],C:[1,0]},
      {id:'double',A:[[1,2],[0,1]],B:[[0],[1]],C:[1,0]},
    ],
    interventions:[
      {id:'idle',actionCost:0,controls:[[0],[0],[0],[0]]},
      {id:'pulse',actionCost:2,controls:[[1],[0],[0],[0]]},
    ],
    offeredTicks:[0,1,2,3,4],
    maxReadings:5,noiseBound:'1/100',workLimitPerCourse:50000,
  };
  const received=designActiveInterventionFamily(req);
  assert.equal(received.status,'optimal_certified_intervention');
  assert.equal(received.chosenIntervention,'pulse');
  assert.deepEqual(received.chosenReadings.map(v=>v.tick),[0,1,2]);
  assert.equal(received.numReadings,3);
  assert.equal(received.interventionMenu[0].status,
    'structurally_indistinguishable_on_offered_course');
  assert.equal(received.pairProof[0].marginLowerBound,'1/4');
  const read=(coupling,position,velocity,input)=>{
    const y0=position,y1=position+coupling*velocity;
    const y2=position+2*coupling*velocity+coupling*input;
    return [y0,y1,y2];
  };
  // Independent physical kinematics oracle: the discrete second difference
  // cancels BOTH independently unknown initial position and hidden velocity.
  for(const p of [-9,-1,0,7,19])for(const v of [-7,-2,0,3,23]){
    const y1=read(1,p,v,1),y2=read(2,p+10,v-4,1);
    assert.equal(y1[0]-2*y1[1]+y1[2],1);
    assert.equal(y2[0]-2*y2[1]+y2[2],2);
    const noInput=read(1,p,v,0);
    assert.equal(noInput[0]-2*noInput[1]+noInput[2],0);
  }
  assert.equal(replayActiveInterventionFamily(req,received).valid,true);
});
