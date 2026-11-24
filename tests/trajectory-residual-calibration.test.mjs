import assert from 'node:assert/strict';
import test from 'node:test';
import {assessCalibratedTrajectory,assessForecastResidualShape} from '../src/science/trajectory-residual-calibration.mjs';
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

const mixed = [2,5,1,4,8,3,7,6], rising = [1,2,3,4,5,6,7,8];
const shapePlan = {forecastId:'frozen',alpha:{numerator:1,denominator:20},
  windows:[{start:1.5,step:.125,samples:8,channels:['position','velocity']}]};
function forecast(id, signal=mixed, plan=shapePlan) {
  return {id,forecastId:plan.forecastId,records:plan.windows.map(({start,step,samples,channels}, w)=>{
    const predicted=Array.from({length:samples},(_,t)=>[3*t*t,12-t]);
    const observed=predicted.map(([q,v],t)=>[q+signal[t],v+7]);
    return {id:id+'-'+w,start,step,channels:[...channels],predicted,observed};
  })};
}
const refs = () => Array.from({length:19}, (_,i)=>forecast('cal-'+i));

test('ordered forecast errors separate identical margins with one vote per acquisition',()=>{
  const reference=refs(), target=forecast('held',rising);
  assert.deepEqual([...mixed].sort((a,b)=>a-b),rising);
  const r=assessForecastResidualShape(reference,target,shapePlan);
  assert.equal(r.status,'serial_shape_outlier');
  assert.deepEqual(r.p,{numerator:1,denominator:20});
  assert.deepEqual(r.observed.records[0].channelScores,[{numerator:105,denominator:168},null]);
  assert.deepEqual(r.calibration[0].score,{numerator:33,denominator:168});
  reference[0]=forecast('opposite-scale',rising.map(x=>100-2*x));
  const tie=assessForecastResidualShape(reference,target,shapePlan);
  assert.deepEqual(tie.p,{numerator:2,denominator:20});
  assert.equal(tie.status,'within_calibrated_shape');
});

test('tied residuals, negative lag and record boundaries retain distinct scores',()=>{
  const plan={...shapePlan,windows:[shapePlan.windows[0],shapePlan.windows[0]]};
  const reference=Array.from({length:19},(_,i)=>forecast('cal-'+i,mixed,plan));
  const target=forecast('held',[0,0,1,1,0,0,1,1],plan);
  target.records[1]=forecast('other',[0,1,0,1,0,1,0,1],plan).records[0];
  const r=assessForecastResidualShape(reference,target,plan);
  assert.deepEqual(r.observed.records.map(x=>x.channelScores[0]),[
    {numerator:16,denominator:128},{numerator:112,denominator:128}]);
  assert.deepEqual(r.observed.score,{numerator:112,denominator:128});
  assert.deepEqual(r.p,{numerator:1,denominator:20});
  target.records[0]=forecast('constant',Array(8).fill(9),plan).records[0];
  const unresolved=assessForecastResidualShape(reference,target,plan);
  assert.equal(unresolved.status,'unresolved_target_record');
  assert.equal(unresolved.failure.recordId,'constant-0');
  assert.equal(unresolved.p,null);
});

test('mismatched metadata, coverage, lack of rank resolution, and overflow cannot qualify',()=>{
  const reference=refs(), target=forecast('held');
  const unread={...target,records:target.records.map(r=>({...r,get observed(){throw Error('read too early');}}))};
  assert.equal(assessForecastResidualShape(reference.slice(1),unread,shapePlan).status,'insufficient_calibration_resolution');
  const short={...shapePlan,windows:[{...shapePlan.windows[0],samples:3}]};
  assert.equal(assessForecastResidualShape(reference,unread,short).status,'insufficient_temporal_support');
  assert.throws(()=>assessForecastResidualShape(reference,reference[0],shapePlan),/Duplicate acquisition/);
  assert.throws(()=>assessForecastResidualShape(reference,{...target,forecastId:'other'},shapePlan),/identity/);
  const rec=target.records[0];
  for(const [field,value,pattern] of [
    ['id',reference[0].records[0].id,/unique id/],['step',.5,/grid/],
    ['start',1,/grid/],['channels',['velocity','position'],/channels/],
    ['observed',[[0,0]],/sample count/],['predicted',Array(8).fill([0]),/row/],
    ['observed',Array(8).fill([NaN,0]),/finite/]])
    assert.throws(()=>assessForecastResidualShape(reference,{...target,records:[{...rec,[field]:value}]},shapePlan),pattern);
  const constant=forecast('no-shape',Array(8).fill(100));
  assert.equal(assessForecastResidualShape([constant,...reference.slice(1)],target,shapePlan).status,'unresolved_calibration_record');
  rec.observed[0][0]=Number.MAX_VALUE; rec.predicted[0][0]=-Number.MAX_VALUE;
  assert.equal(assessForecastResidualShape(reference,target,shapePlan).failure.reason,'residual_overflow');
});

test('all 24 held-out orders give the conservative upper-tail rank at every tie',()=>{
  const plan={...shapePlan,alpha:{numerator:1,denominator:12},
    windows:[{...shapePlan.windows[0],samples:4}]};
  const permutations=xs=>xs.length ? xs.flatMap((x,i)=>
    permutations(xs.filter((_,j)=>j!==i)).map(tail=>[x,...tail])) : [[]];
  const orders=permutations([0,1,2,3]);
  const groups=orders.map((values,i)=>forecast('order-'+i,values,plan));
  // Independent pairwise win/loss form of the centered ranks.
  const lag=values=>{
    const r=values.map(x=>values.reduce((sum,y)=>sum+Math.sign(x-y),0));
    return Math.abs(r[0]*r[1]+r[1]*r[2]+r[2]*r[3]);
  };
  const scores=orders.map(lag);
  let rejected=0;
  for(const [i,target] of groups.entries()){
    const r=assessForecastResidualShape(groups.filter(g=>g!==target),target,plan);
    assert.deepEqual(r.p,{numerator:scores.filter(s=>s>=scores[i]).length,denominator:24});
    if(r.status==='serial_shape_outlier')rejected++;
  }
  assert.equal(rejected,2);
});
