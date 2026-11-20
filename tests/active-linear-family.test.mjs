import test from 'node:test';
import assert from 'node:assert/strict';
import {designActiveLinearFamily,replayActiveLinearFamily,ACTIVE_LINEAR_FAMILY_SCHEMA}
  from '../src/science/active-linear-family.mjs';

const fixture=(a='1/2',b='1/3',epsilon='1/1000')=>({
  schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
  source:'Explicit hypothetical two-decay, same-input experiment; no sensor has been measured',
  hypotheses:[
    {id:'half',A:[[a]],B:[[1]],C:[1]},
    {id:'third',A:[[b]],B:[[1]],C:[1]},
  ],
  controls:[[1],[0],[0],[0]],
  offeredTicks:[0,1,2,3,4],
  maxReadings:5,
  noiseBound:epsilon,
  workLimit:50000,
});
function independentRank(matrix){
  let m=matrix.map(row=>row.slice()),r=0,n=m[0]?.length??0;
  for(let c=0;c<n&&r<m.length;c++){
    let p=r;while(p<m.length&&Math.abs(m[p][c])<1e-9)p++;
    if(p===m.length)continue;
    [m[r],m[p]]=[m[p],m[r]];
    const d=m[r][c];for(let j=c;j<n;j++)m[r][j]/=d;
    for(let i=0;i<m.length;i++)if(i!==r){
      const scale=m[i][c];for(let j=c;j<n;j++)m[i][j]-=scale*m[r][j];
    }r++;
  }
  return r;
}
function numericCertificate(a,b,inputs,ticks){
  let e=[{x:1,forced:0},{x:1,forced:0}];
  const rows=[],d=[];
  for(let t=0;t<=inputs.length;t++){
    if(ticks.includes(t)){
      rows.push([e[0].x,-e[1].x]);d.push(e[1].forced-e[0].forced);
    }
    if(t<inputs.length){
      e=[{x:e[0].x*a,forced:e[0].forced*a+inputs[t]},
         {x:e[1].x*b,forced:e[1].forced*b+inputs[t]}];
    }
  }
  return independentRank(rows.map((r,i)=>[...r,d[i]]))>independentRank(rows);
}
test('first physical-law discriminator corrects the two-reading unknown-initial-state false positive',()=>{
  const x=fixture();
  const s=designActiveLinearFamily(x);
  assert.equal(s.status,'optimal_certified_schedule');
  assert.equal(s.numReadings,3);
  assert.equal(s.proof.length,1);
  assert.ok(s.proof[0].structural);
  assert.ok(s.proof[0].robustCertified);
  assert.ok(s.proof[0].witness.weights.length===3);
  assert.ok(s.selection.some(x=>x.tick===0),
    'initial-state observation anchors forced unknown-state ambiguity');
  assert.equal(s.physicalActionsPerformed,false);
  assert.equal(s.outcomeValuesUsed,false);
  assert.deepEqual(replayActiveLinearFamily(x,s),{
    valid:true,sourceOnly:true,physicalActionsPerformed:false
  });
});
test('without excitation no finite observation schedule can discriminate arbitrary independent initial states',()=>{
  const x=fixture();
  x.controls=[[0],[0],[0],[0]];
  const result=designActiveLinearFamily(x);
  assert.equal(result.status,'structurally_indistinguishable_on_offered_course');
  assert.equal(result.selection,null);
  assert.equal(result.potential[0].structural,false);
});
test('identical laws are exactly indistinguishable despite nonzero excitation',()=>{
  const result=designActiveLinearFamily(fixture('1/2','1/2'));
  assert.equal(result.status,'structurally_indistinguishable_on_offered_course');
});
test('declared adversarial noise cannot be silently classified as successful separation',()=>{
  const easy=designActiveLinearFamily(fixture('1/2','1/3','0'));
  const hard=designActiveLinearFamily(fixture('1/2','1/3','100'));
  assert.equal(easy.status,'optimal_certified_schedule');
  assert.notEqual(hard.status,'optimal_certified_schedule');
  assert.equal(hard.potential[0].structural,true);
  assert.equal(hard.potential[0].robustCertified,false);
});
test('changed stimulus changes the derived schedule, and forged replay is rejected',()=>{
  const x=fixture(),y=structuredClone(x);
  const original=designActiveLinearFamily(x);
  y.controls[0][0]=0;
  assert.equal(designActiveLinearFamily(y).status,'structurally_indistinguishable_on_offered_course');
  assert.throws(()=>replayActiveLinearFamily(y,original),/certificate or source changed/);
  const outcomes=structuredClone(x);
  outcomes.heldoutOutcome=['fake',1e99];
  outcomes.hypotheses[0].futureReadout=1234;
  assert.deepEqual(designActiveLinearFamily(outcomes),original);
  const forged=structuredClone(original);forged.proof[0].witness.signedGap='999';
  assert.throws(()=>replayActiveLinearFamily(x,forged),/certificate or source changed/);
});
test('independently computed dense rank agrees on 64 held-out parameter/control courses',()=>{
  let checked=0;
  const choices=[0.2,0.25,0.3333333333333333,0.5];
  const exact=['1/5','1/4','1/3','1/2'];
  for(let ia=0;ia<choices.length;ia++)for(let ib=0;ib<choices.length;ib++){
    for(const seq of [[1,0,0,0],[0,1,0,0],[1,1,0,0],[0,0,0,0]]){
      const x=fixture(exact[ia],exact[ib],'0');
      x.controls=seq.map(v=>[v]);
      const got=designActiveLinearFamily(x);
      const independent=numericCertificate(choices[ia],choices[ib],seq,[0,1,2,3,4]);
      assert.equal(got.potential[0].structural,independent,
        'mismatch '+ia+','+ib+','+seq);
      checked++;
    }
  }
  assert.equal(checked,64);
});
test('source and search resource bounds are explicit, not silently approximated',()=>{
  const x=fixture();
  for(const mutate of [
    req=>req.hypotheses[0].A[0][0]='0.3333333',
    req=>req.controls=[[1]],
    req=>req.offeredTicks=[1,1],
    req=>req.maxReadings=9,
    req=>req.noiseBound='-1',
    req=>req.hypotheses[1].id='half',
    req=>req.hypotheses[0].B=[[1,2]],
    req=>req.workLimit=99,
  ]){
    const y=structuredClone(x);mutate(y);
    assert.throws(()=>designActiveLinearFamily(y),/Active linear family:/);
  }
  const capped=structuredClone(x);
  capped.maxReadings=2;
  assert.equal(designActiveLinearFamily(capped).status,'insufficient_reading_budget');
});
