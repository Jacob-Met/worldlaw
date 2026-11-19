import test from 'node:test';
import assert from 'node:assert/strict';
import {planAdaptiveGaussianReading} from '../src/trajectory/adaptive-gaussian-sensor.mjs';

const laws=rows=>rows.map((positions,i)=>({modelId:'law-'+i,
  rows:positions.map((position,time)=>({time,position}))}));
const opts={sigma:.5,correlationTime:0,maxReadings:2,decisionThreshold:.98};

function denseGaussianPosterior(predictions,observations,sigma,tau){
  const m=observations.length;
  if(!m)return predictions.map(()=>1/predictions.length);
  const times=observations.map(o=>o.time);
  const covariance=times.map((t,i)=>times.map((u,j)=>
    sigma*sigma*(tau===0?Number(i===j):Math.exp(-Math.abs(t-u)/tau))));
  const results=[];
  for(const model of predictions){
    const matrix=covariance.map((row,i)=>[...row,
      observations[i].position-model.rows[observations[i].sampleIndex].position]);
    for(let col=0;col<m;col++){
      let pivot=col;
      for(let i=col+1;i<m;i++)if(Math.abs(matrix[i][col])>Math.abs(matrix[pivot][col]))pivot=i;
      [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
      const scale=matrix[col][col];
      assert.ok(scale>0);
      for(let j=col;j<=m;j++)matrix[col][j]/=scale;
      for(let i=0;i<m;i++)if(i!==col){
        const f=matrix[i][col];
        for(let j=col;j<=m;j++)matrix[i][j]-=f*matrix[col][j];
      }
    }
    const residual=observations.map((o,i)=>o.position-model.rows[o.sampleIndex].position);
    const energy=residual.reduce((s,r,i)=>s+r*matrix[i][m],0);
    results.push(-energy/2);
  }
  const high=Math.max(...results),weights=results.map(e=>Math.exp(e-high));
  const sum=weights.reduce((s,x)=>s+x,0);
  return weights.map(x=>x/sum);
}
const checkClose=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<=tol,
  'observed '+a+' expected '+b);

function referenceInformation(priors,means,sigma){
  const lo=-11,hi=11,n=2400,step=(hi-lo)/n;
  let total=0;
  for(let h=0;h<priors.length;h++)for(let k=0;k<=n;k++){
    const z=lo+k*step;
    const weight=k===0||k===n?1:k%2?4:2;
    const base=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
    const parts=priors.map((p,j)=>p*Math.exp(-.5*((z+(means[h]-means[j])/sigma)**2-z*z)));
    const denominator=parts.reduce((s,x)=>s+x,0);
    total+=priors[h]*weight*base*(-Math.log(denominator));
  }
  return total*step/3;
}

test('zero readings and identical laws carry neither spurious posterior nor information',()=>{
  const models=laws([[0,2,1,0],[0,2,1,0],[0,2,1,0]]);
  const result=planAdaptiveGaussianReading(models,{...opts,maxReadings:3});
  assert.equal(result.status,'no_useful_future_information');
  result.models.forEach(m=>checkClose(m.conditionalWeight,1/3));
  result.ranking.forEach(r=>assert.ok(Math.abs(r.expectedInformationNats)<1e-11));
  assert.equal(result.unobservedSensorValuesConsumed,0);
});

test('known iid two-law expected information matches independent high-resolution quadrature',()=>{
  for(const separation of [.15,.5,1,2,3,5,7]){
    const models=laws([[0,0],[0,separation]]);
    const opts={sigma:1,maxReadings:1,decisionThreshold:.9,minimumInformationNats:0,
      quadratureToleranceNats:.05};
    const actual=planAdaptiveGaussianReading(models,opts);
    const reference=referenceInformation([.5,.5],[0,separation],1);
    assert.equal(actual.status,'next_reading_proposed');
    assert.ok(Math.abs(actual.proposed.expectedInformationNats-reference)<2e-5,
      'delta='+separation+' actual='+actual.proposed.expectedInformationNats+
      ' reference='+reference);
  }
});

test('OU posterior is identical to independent dense covariance inverse on irregular acquired records',()=>{
  const models=[
    {modelId:'spring',rows:[0,.8,1.1,1.9,2.5].map((p,i)=>({time:[0,.1,.7,1.2,2][i],position:p}))},
    {modelId:'dashpot',rows:[0,1.3,1.2,1.3,2].map((p,i)=>({time:[0,.1,.7,1.2,2][i],position:p}))},
    {modelId:'contact',rows:[0,.9,.2,1.1,2.8].map((p,i)=>({time:[0,.1,.7,1.2,2][i],position:p}))}
  ];
  for(const tau of [0,.01,.3,1.5,7]){
    for(const readings of [
      [{sampleIndex:1,time:.1,position:1.1}],
      [{sampleIndex:1,time:.1,position:1.1},{sampleIndex:3,time:1.2,position:1.4}],
      [{sampleIndex:1,time:.1,position:1.1},{sampleIndex:2,time:.7,position:.7},
       {sampleIndex:4,time:2,position:2.2}]
    ]){
      const options={sigma:.7,correlationTime:tau,maxReadings:4,decisionThreshold:.9999};
      const result=planAdaptiveGaussianReading(models,options,readings);
      const reference=denseGaussianPosterior(models,readings,.7,tau);
      result.models.forEach((m,i)=>checkClose(m.conditionalWeight,reference[i],1e-10));
    }
  }
});

test('posterior never reads unmeasured future labels or changes under future forecast edits',()=>{
  const models=laws([[0,1,5,5],[0,-1,-5,-5],[0,0,10,-10]]);
  const observed=[{sampleIndex:1,time:1,position:.3}];
  const before=planAdaptiveGaussianReading(models,{...opts,maxReadings:3},observed);
  const edited=structuredClone(models);
  edited[1].rows[3].position=10000;
  const after=planAdaptiveGaussianReading(edited,{...opts,maxReadings:3},observed);
  assert.deepEqual(after.models,before.models);
  assert.notDeepEqual(after.ranking,before.ranking);
  assert.equal(after.unobservedSensorValuesConsumed,0);
});

test('three-way branch adaptive next step targets the actually remaining law pair',()=>{
  // Time 1 divides 3 groups; times 2,3,4 distinguish one pair each.
  const p=laws([
    [0,-5,4,0,0],[0,-5,-4,0,0],
    [0,0,0,4,0],[0,0,0,-4,0],
    [0,5,0,0,4],[0,5,0,0,-4],
  ]);
  const config={sigma:.35,maxReadings:2,decisionThreshold:.98};
  const first=planAdaptiveGaussianReading(p,config);
  assert.equal(first.status,'next_reading_proposed');
  assert.equal(first.proposed.sampleIndex,1);
  for(const [measured,expected]of [[-5,2],[0,3],[5,4]]){
    const second=planAdaptiveGaussianReading(p,config,
      [{sampleIndex:1,time:1,position:measured}]);
    assert.equal(second.status,'next_reading_proposed');
    assert.equal(second.proposed.sampleIndex,expected);
    assert.ok(second.proposed.expectedInformationNats>.60);
  }
  const finished=planAdaptiveGaussianReading(p,config,[
    {sampleIndex:1,time:1,position:-5},
    {sampleIndex:2,time:2,position:4}
  ]);
  assert.equal(finished.status,'conditional_decision_ready');
  assert.equal(finished.selectedModelId,'law-0');
  assert.equal(finished.actualReadingCount,2);
});

test('changed acquired measurements genuinely change posterior and conditional decision',()=>{
  const p=laws([[0,0,0],[0,5,0]]);
  const config={sigma:.5,maxReadings:2,decisionThreshold:.98};
  const a=planAdaptiveGaussianReading(p,config,[{sampleIndex:1,time:1,position:0}]);
  const b=planAdaptiveGaussianReading(p,config,[{sampleIndex:1,time:1,position:5}]);
  assert.equal(a.selectedModelId,'law-0');
  assert.equal(b.selectedModelId,'law-1');
  assert.equal(a.status,'conditional_decision_ready');
  assert.equal(b.status,'conditional_decision_ready');
});

test('unmeasured future, duplicate/acausal or inconsistent timestamps refuse',()=>{
  const p=laws([[0,1,3,4],[0,2,4,5]]);
  const o={...opts,maxReadings:3};
  for(const rows of [
    [{sampleIndex:2,time:1,position:.5}],
    [{sampleIndex:1,time:1,position:.5},{sampleIndex:1,time:1,position:2}],
    [{sampleIndex:2,time:2,position:.5},{sampleIndex:1,time:1,position:2}],
    [{sampleIndex:1,time:1,position:Infinity}],
    [{sampleIndex:4,time:4,position:1}],
  ])assert.throws(()=>planAdaptiveGaussianReading(p,o,rows),/sensor|finite|strictly|actual/i);
  assert.throws(()=>planAdaptiveGaussianReading(p,{...o,correlationTime:-1}),/nonnegative/);
  assert.throws(()=>planAdaptiveGaussianReading(p,{...o,sigma:0}),/sigma/);
  const dup=structuredClone(p);dup[1].modelId=dup[0].modelId;
  assert.throws(()=>planAdaptiveGaussianReading(dup,o),/unique/);
});

test('work exhaustion and close-spaced covariance cannot masquerade as confirmed design',()=>{
  const p=laws([[0,0,1,2],[0,2,1,0]]);
  const inconclusive=planAdaptiveGaussianReading(p,{...opts,maxReadings:3,workLimit:1});
  assert.equal(inconclusive.status,'search_inconclusive_work_limit');
  assert.equal(inconclusive.proposed,null);
  assert.throws(()=>planAdaptiveGaussianReading(
    [{modelId:'a',rows:[{time:0,position:0},{time:1,position:0},{time:1+1e-14,position:0}]},
     {modelId:'b',rows:[{time:0,position:0},{time:1,position:1},{time:1+1e-14,position:2}]}],
    {sigma:1,maxReadings:2,correlationTime:1e8},
    [{sampleIndex:1,time:1,position:.5}]),
    /covariance|unresolved/);
});


test('absolute Gaussian goodness-of-fit prevents confident false law after every candidate fails',()=>{
  const models=laws([[0,-100,-100],[0,-120,-120]]);
  const run=planAdaptiveGaussianReading(models,
    {sigma:1,maxReadings:2,decisionThreshold:.98},[
      {sampleIndex:1,time:1,position:0}
    ]);
  assert.equal(run.status,'all_offered_models_mismatch');
  assert.equal(run.proposed,null);
  assert.ok(run.maximumConditionalWeight>.999);
  assert.equal(run.modelMismatchScreen.allOfferedModelsRejected,true);
  assert.ok(run.modelMismatchScreen.minimumWhitenedSquaredResidual>
    run.modelMismatchScreen.rejectionThresholdChi2);
  assert.equal(run.modelMismatchScreen.alphaUpperBound,.001);
  const matching=planAdaptiveGaussianReading(laws([[0,0,0],[0,120,120]]),
    {sigma:1,maxReadings:2,decisionThreshold:.98},[
      {sampleIndex:1,time:1,position:0}
    ]);
  assert.equal(matching.status,'conditional_decision_ready');
  assert.equal(matching.modelMismatchScreen.allOfferedModelsRejected,false);
});

test('correct Gaussian model has conservative one-sided false-alarm control',()=>{
  const models=laws([[0,0,0],[0,12,12]]);
  let state=0x37b501cd;
  const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)+.5)/4294967296;
  let falseAlarms=0;
  for(let i=0;i<512;i++){
    const z=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
    const result=planAdaptiveGaussianReading(models,
      {sigma:1,maxReadings:2,decisionThreshold:.98},[
        {sampleIndex:1,time:1,position:z}
      ]);
    falseAlarms+=Number(result.status==='all_offered_models_mismatch');
  }
  assert.ok(falseAlarms<=3,'Realization-specific conservative Gaussian null rejected '+falseAlarms+'/512.');
});

test('negative-control false reading violates source-gated absolute model fit',()=>{
  const p=laws([[0,0,0],[0,1,1]]);
  const config={sigma:.25,maxReadings:2,decisionThreshold:.98};
  const normal=planAdaptiveGaussianReading(p,config,[{sampleIndex:1,time:1,position:0}]);
  const tampered=planAdaptiveGaussianReading(p,config,[{sampleIndex:1,time:1,position:4}]);
  assert.notEqual(normal.status,'all_offered_models_mismatch');
  assert.equal(tampered.status,'all_offered_models_mismatch');
  assert.equal(tampered.unobservedSensorValuesConsumed,0);
});
