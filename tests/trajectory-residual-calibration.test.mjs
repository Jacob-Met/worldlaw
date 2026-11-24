import assert from 'node:assert/strict';
import test from 'node:test';
import {assessCalibratedTrajectory} from '../src/science/trajectory-residual-calibration.mjs';
import {verifyEvolutionRollout} from '../src/science/operator-rollout.mjs';

const model={kind:'oscillator',schema:'worldlaw.symbolic-evolution/v1',terms:[]};
const gate={alpha:{numerator:1,denominator:20},resolutionTolerance:1e-12};
function acquisition(i,magnitude=i/1000){
  return {id:'physical-'+i,records:[0,1].map(w=>{
    const course={id:'window-'+i+'-'+w,initial:[0,0],step:.125,steps:16,
      forcing:{offset:0,amplitude:0,startFrequency:0,endFrequency:0}};
    const observations=Array.from({length:17},()=>[0,0]);
    if(w===i%2)observations[1+i%16][0]=magnitude;
    return {course,observations};
  })};
}
test('twenty exchangeable whole acquisitions have one rejected rank, despite dependent sensor coordinates',()=>{
  const groups=Array.from({length:20},(_,i)=>acquisition(i+1));
  const order=groups.map((target,i)=>assessCalibratedTrajectory(model,groups.filter(g=>g!==target),target,gate));
  assert.deepEqual(order.map(r=>r.p.numerator),Array.from({length:20},(_,i)=>20-i));
  assert.equal(order.filter(r=>r.status==='residual_outlier').length,1);
  // A 95th percentile pooled over scalar sensor residuals is zero here.
  const pooled=groups.flatMap(g=>g.records.flatMap(r=>r.observations.flat().map(Math.abs))).sort((a,b)=>a-b);
  const cutoff=pooled[Math.ceil(.95*pooled.length)-1];
  assert.equal(cutoff,0);
  assert.equal(groups.filter(g=>g.records.some(r=>!verifyEvolutionRollout(model,r.course,r.observations,
    {maxError:cutoff,resolutionTolerance:1e-12}).accepted)).length,20);
  const tie=acquisition(99,.02);
  const result=assessCalibratedTrajectory(model,groups.slice(1),tie,gate);
  assert.deepEqual(result.p,{numerator:2,denominator:20});
  assert.equal(result.status,'within_calibrated_residual');
});
test('frozen physical model, different law and an unresolved integration have distinct outcomes',()=>{
  const calibration=Array.from({length:19},(_,i)=>acquisition(i+1)),target=acquisition(88);
  for(const {course,observations} of target.records)
    for(let i=0;i<observations.length;i++){const t=i*course.step;observations[i]=[.25*t*t,.5*t];}
  const changed=assessCalibratedTrajectory(model,calibration,target,gate);
  assert.deepEqual(changed.p,{numerator:1,denominator:20});assert.equal(changed.status,'residual_outlier');
  const tiny=acquisition(90);
  for(const {course,observations} of tiny.records)
    for(let i=0;i<observations.length;i++){const t=i*course.step;observations[i]=[.00005*t*t,.0001*t];}
  const unresolved=assessCalibratedTrajectory(model,calibration,tiny,gate);
  assert.equal(unresolved.status,'within_calibrated_residual');
  assert.deepEqual(unresolved.p,{numerator:20,denominator:20});
  const unread={...target,records:target.records.map(r=>({course:r.course,get observations(){throw Error('too early');}}))};
  assert.deepEqual(assessCalibratedTrajectory(model,calibration.slice(1),unread,gate),
    {status:'insufficient_calibration_resolution',minimumP:{numerator:1,denominator:19},p:null});
  const bad=acquisition(89);bad.records[1].course.forcing={offset:0,amplitude:1,startFrequency:1e10,endFrequency:1e10};
  assert.equal(assessCalibratedTrajectory(model,[...calibration.slice(1),bad],target,gate).status,'unresolved_calibration_course');
  assert.equal(assessCalibratedTrajectory(model,calibration,bad,gate).status,'unresolved_target_course');
  assert.throws(()=>assessCalibratedTrajectory(model,calibration,calibration[2],gate),/unique/);
  const reused={...target,records:[calibration[0].records[0]]};
  assert.throws(()=>assessCalibratedTrajectory(model,calibration,reused,gate),/one acquisition/);
});
