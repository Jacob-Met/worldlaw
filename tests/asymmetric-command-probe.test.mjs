import test from 'node:test';
import assert from 'node:assert/strict';
import {compareAsymmetricCommandDeadzones as fit} from '../src/science/asymmetric-command-deadzone.mjs';
import {planAsymmetricCommandExperiment as plan} from '../src/science/asymmetric-command-probe.mjs';
import {rankPredictionRanges} from '../src/science/prediction-range-plan.mjs';
const training=Array.from({length:97},(_,i)=>{const command=.05+2*Math.abs(Math.sin(i*1.719)),position=.7*Math.cos(i*2.139),rate=1.2*Math.sin(i*.811);return {command,position,rate,jointTorque:1.61*Math.max(0,command-.23)-1.37*position-.231*rate+.17};});
const options={terms:['command','spring','rate','bias'],maxTerms:4,noiseSigma:.001};
const offers=[{command:1,position:0,rate:0},{command:-1,position:0,rate:0}];
test('original offered command separates training-indistinguishable negative thresholds',()=>{
 const r=fit(training,[0,.23,.71],options),before=JSON.stringify(r),p=plan(r,offers);
 assert.equal(p.status,'proposed');assert.equal(p.selected.index,1);assert.equal(p.ensemble.length,3);
 assert.ok(Math.abs(p.selected.disagreement-1.1431)<1e-10);assert.deepEqual(p.selected.extrapolation,['command']);
 assert.deepEqual(p.ranked[1].input,offers[0]);assert.equal(p.ranked[1].disagreement,0);assert.equal(JSON.stringify(r),before);
 assert.equal(plan(r,[offers[0]]).status,'uninformative');
});
test('complete global ensemble includes competitive nonwinning structures',()=>{
 const r=fit(training,[0,.23,.71],{...options,noiseSigma:.5,ambiguityDelta:100});
 const expected=r.candidates.reduce((n,c)=>n+c.competitiveModels.filter(m=>m.metrics.score-r.selected.model.metrics.score<=r.options.ambiguityDelta).length,0);
 const p=plan(r,offers);assert.equal(p.ensemble.length,expected);assert.ok(expected>3);
 assert.ok(p.ranked.every(row=>row.predictions.length===expected));
});
test('future outcomes and partial courses cannot masquerade as original offers',()=>{
 const r=fit(training,[0,.23,.71],options),p=plan(r,offers);
 assert.throws(()=>plan(r,[{...offers[0],jointTorque:99}]),/no future torque reading/);
 assert.throws(()=>plan(r,[offers[0],offers[0]]),/repeats/);
 assert.throws(()=>plan(r,offers,{maxWork:p.work.reserved-1}),/no shortlist/);
 assert.deepEqual(plan(r,offers,{maxWork:p.work.reserved}).ranked,p.ranked);
});
test('shared ranker retains stable tie order and refuses incomplete or nonfinite predictions',()=>{
 const rows=[1,0].map(index=>({index,input:{command:index},predictions:[{modelId:'a',value:0},{modelId:'b',value:3}]}));
 assert.equal(rankPredictionRanges(rows,['a','b'],1).selected.index,0);
 assert.throws(()=>rankPredictionRanges([{...rows[0],predictions:rows[0].predictions.slice(0,1)}],['a','b'],1),/Incomplete/);
 assert.throws(()=>rankPredictionRanges([{...rows[0],predictions:[{modelId:'a',value:Infinity},{modelId:'b',value:0}]}],['a','b'],1),/nonfinite/);
});

test('complete shared range ranking preserves existing ordinary scalar planner behavior',async()=>{
 const {discover,planExperiment,predict}=await import('../src/science/torque-discovery.mjs');
 const r=discover(training,options),actual=planExperiment(r,offers);
 const expected=offers.map((input,index)=>{const predictions=r.competitive.map(m=>({modelId:m.id,value:predict(m,input)}));const values=predictions.map(p=>p.value);return {index,predictions,range:Math.max(...values)-Math.min(...values)};}).sort((a,b)=>b.range-a.range||a.index-b.index);
 assert.deepEqual(actual.ranked.map(x=>({index:x.index,predictions:x.predictions,range:x.disagreement})),expected);
});
