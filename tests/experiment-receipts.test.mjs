import assert from 'node:assert/strict';
import test from 'node:test';
import {createSession,appendMeasurements,refitSession,newVirtualSession,
  runVirtualExperiment,sessionPlan,exportSession,restoreSession,undoSession} from '../src/session.mjs';
import {captureExperimentReceipt,inspectExperimentReceipt} from '../src/science/experiment-receipts.mjs';

// Independently authored by retained hamon-0e8130f6/mechanism reviewer.
// Analytic coefficient sums and raw arithmetic do not reuse product evaluation
// to produce expected values. Source: broker/experiment-receipt-independent-review.mjs.
test('independent analytic experiment receipts retain pre-update laws and all original outcomes',()=>{
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<=2e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${message}: ${a} versus ${b}`);
const basis=(id,r)=>({command:r.command,rate:r.rate,coulomb:Math.sign(r.rate),
  spring:r.position,gravity:Math.sin(r.position),quadratic:r.rate*Math.abs(r.rate),
  bias:1,command_position:r.command*r.position,rate_squared:r.rate*r.rate,
  cosine:Math.cos(r.position),cubic:r.position*r.position*r.position})[id];
const predict=(model,row)=>model.terms.reduce((sum,term)=>{
  const value=basis(term.id,row);assert.notEqual(value,undefined,'oracle must cover every term');
  return sum+term.coefficient*value;
},0);
const row=(command,jointTorque,extra={})=>({command,position:0,rate:0,jointTorque,...extra});
const training=Array.from({length:8},(_,i)=>row(i+1,2*(i+1)));
const dataset=(extra={})=>({observations:structuredClone(training),heldOut:[row(10,20)],...extra});
const receipt=state=>state.history.at(-1).experiment;
let assertions=0; const observations=[];
function independentlyCheck(r) {
  assert.ok(r.models.length>0);
  r.models.forEach((m,index)=>{
    const actual=inspectExperimentReceipt(r,index);
    assert.equal(actual.count,r.rows.length);
    const residuals=r.rows.map((reading,i)=>{
      const prediction=predict(m,reading),residual=reading.jointTorque-prediction;
      close(actual.rows[i].prediction,prediction,'frozen prediction');
      close(actual.rows[i].residual,residual,'raw residual');
      assert.equal(actual.rows[i].index,i,'source batch order');
      const outside=['command','position','rate'].filter(key=>m.domain&&(reading[key]<m.domain[key].min||reading[key]>m.domain[key].max));
      assert.deepEqual(actual.rows[i].extrapolation,outside);
      assertions+=4;
      return residual;
    });
    close(actual.rmse,Math.sqrt(residuals.reduce((sum,x)=>sum+x*x,0)/residuals.length),'complete raw RMSE');
    close(actual.maxAbsResidual,Math.max(...residuals.map(Math.abs)),'maximum raw residual');
    if(r.rows[0].torqueNoiseRatio!==undefined)
      close(actual.relativeNoiseRmse,Math.sqrt(residuals.reduce((sum,x,i)=>sum+(x/r.rows[i].torqueNoiseRatio)**2,0)/residuals.length),'declared-ratio metric');
    assertions+=2;
  });
}

// A single structure ID has two different coefficient states. A two-reading
// batch is evaluated under ONE prebatch fit; row two is not leaked into row one.
const start=createSession(dataset(),{maxTerms:1,noiseSigma:.01});
const batch=[row(2,12),row(1,-7)];
const changed=appendMeasurements(start,batch),r=receipt(changed);
assert.equal(start.discovery.selected.id,'command');
assert.equal(changed.discovery.selected.id,'command');
close(start.discovery.selected.terms[0].coefficient,2,'analytic initial slope');
close(changed.discovery.selected.terms[0].coefficient,425/209,'analytic batch slope');
const inspected=inspectExperimentReceipt(r,r.models.findIndex(m=>m.id==='command'));
close(inspected.rows[0].prediction,4,'first frozen batch prediction');
close(inspected.rows[1].prediction,2,'second frozen batch prediction');
close(inspected.rmse,Math.sqrt(72.5),'analytic prebatch RMSE');
independentlyCheck(r);
observations.push({case:'same-id batch',beforeSlope:2,afterSlope:changed.discovery.selected.terms[0].coefficient,predictions:inspected.rows.map(x=>x.prediction),rmse:inspected.rmse});

const first=appendMeasurements(start,[batch[0]]);
close(first.discovery.selected.terms[0].coefficient,27/13,'analytic first update slope');
const second=appendMeasurements(first,[batch[1]]);
close(inspectExperimentReceipt(receipt(second),0).rows[0].prediction,27/13,'sequential prediction uses earlier update');
independentlyCheck(receipt(second));
const reversed=appendMeasurements(start,[...batch].reverse());
assert.deepEqual(receipt(reversed).models,r.models);
close(inspectExperimentReceipt(receipt(reversed),0).rows[0].prediction,2,'reversed batch original state');

// Future outcomes can change residuals and the next fit, never prior hypotheses.
const altered=appendMeasurements(start,[row(2,-100),row(1,300)]);
assert.deepEqual(receipt(altered).models,r.models);
const changedHeld=createSession(dataset({heldOut:[row(10,-999)]}),{maxTerms:1,noiseSigma:.01});
assert.deepEqual(receipt(appendMeasurements(changedHeld,batch)),r);
const frozen=JSON.stringify(r);
changed.discovery.selected.terms[0].coefficient=999;
start.discovery.selected.terms[0].coefficient=-999;
assert.equal(JSON.stringify(r),frozen,'later public model mutations cannot rewrite receipt');

// Complete pre-update ensemble is retained even if every explanation loses.
const uncertain=createSession(dataset(),{maxTerms:2,noiseSigma:100,ambiguityDelta:6});
assert.deepEqual(new Set(uncertain.discovery.competitive.map(m=>m.id)),new Set(['zero','command','bias','command+bias']));
const rejected=appendMeasurements(uncertain,[row(0,1000)]),rejectReceipt=receipt(rejected);
assert.deepEqual(rejectReceipt.models.map(m=>m.id),uncertain.discovery.competitive.map(m=>m.id));
for(let i=0;i<rejectReceipt.models.length;i++)assert.ok(inspectExperimentReceipt(rejectReceipt,i).maxAbsResidual>900);
independentlyCheck(rejectReceipt);
observations.push({case:'complete all-law failure',retained:rejectReceipt.models.map(m=>m.id),errors:rejectReceipt.models.map((_,i)=>inspectExperimentReceipt(rejectReceipt,i).rmse)});

// Weight and loss assumptions do not relabel large observed errors as small raw
// errors. Weighted normalization is displayed separately and checked directly.
const weighted=createSession(dataset({schema:'worldlaw.observations/v3',observations:training.map((r,i)=>({...r,torqueNoiseRatio:i%2?.5:2}))}),{maxTerms:1,loss:'weighted_least_squares'});
const weightedNext=appendMeasurements(weighted,[row(2,100,{torqueNoiseRatio:1000})]);
const wr=receipt(weightedNext),wi=inspectExperimentReceipt(wr,0);
close(wi.rmse,96,'weighted raw failure retained');close(wi.relativeNoiseRmse,.096,'separate normalized metric');independentlyCheck(wr);
const robust=createSession(dataset(),{maxTerms:1,loss:'soft_l1',lossScale:.5});
const robustNext=appendMeasurements(robust,[row(2,100)]);
close(inspectExperimentReceipt(receipt(robustNext),0).rmse,96,'robust raw failure retained');independentlyCheck(receipt(robustNext));

// Only evidence-acquisition events own a receipt. Source-only replay derives
// comparisons again, preserves old chronology and ignores forged derived data.
const options=refitSession(weightedNext,{noiseSigma:.2});
assert.equal(options.history.at(-1).experiment,undefined);
const exported=exportSession(options),raw=JSON.parse(exported);
assert.equal(raw.history,undefined);assert.equal(raw.events[0].experiment,undefined);
raw.events[0].experiment={models:[],before:{rmse:0}};
assert.deepEqual(restoreSession(JSON.stringify(raw)).history,options.history);
assert.deepEqual(undoSession(options).history,weightedNext.history);
assert.deepEqual(restoreSession(exported).history,options.history);

const virtual=newVirtualSession(47),virtualNext=runVirtualExperiment(virtual,sessionPlan(virtual).selected.input);
independentlyCheck(receipt(virtualNext));
assert.deepEqual(restoreSession(exportSession(virtualNext)).history,virtualNext.history);
assert.throws(()=>inspectExperimentReceipt(receipt(virtualNext),-1));
assert.throws(()=>inspectExperimentReceipt(receipt(virtualNext),receipt(virtualNext).models.length));

// High-ambiguity control checks complete retention without a candidate×row
// derived table. Input rows occur once, not once per snapshot candidate.
const wideRows=Array.from({length:120},(_,i)=>({command:Math.sin(i*1.17),position:2*Math.sin(i*.31),rate:2*Math.cos(i*.79),jointTorque:0}));
const wide=createSession({observations:wideRows},{noiseSigma:1000,ambiguityDelta:100,maxTerms:4});
const wideNext=appendMeasurements(wide,wideRows.slice(0,10).map(r=>({...r,jointTorque:1}))),wideReceipt=receipt(wideNext);
assert.ok(wideReceipt.models.length>50);
assert.equal(wideReceipt.models.length,wide.discovery.competitive.length);
assert.equal(wideReceipt.rows.length,10);
assert.ok(wideReceipt.models.every(m=>!Object.hasOwn(m,'rows')));
independentlyCheck(wideReceipt);
observations.push({case:'wide ensemble compact receipt',models:wideReceipt.models.length,rows:wideReceipt.rows.length,bytes:Buffer.byteLength(JSON.stringify(wideReceipt))});
console.log(JSON.stringify({status:'passed',reviewer:'hamon-0e8130f6/mechanism',oracle:'independent coefficient sums and exact scalar controls',assertions,observations},null,2));

});

test('equal earlier domains share only immutable cloned bounds; changed domains remain distinct',()=>{
  const rows=Array.from({length:8},(_,i)=>({command:i+1,position:0,rate:0,jointTorque:2*(i+1)}));
  const start=createSession({observations:rows},{maxTerms:2,noiseSigma:100,ambiguityDelta:6});
  const next=appendMeasurements(start,[{command:10,position:0,rate:0,jointTorque:20}]);
  const r=next.history.at(-1).experiment,domain=r.models[0].domain;
  assert.ok(r.models.length>1);
  assert.ok(r.models.every(model=>model.domain===domain));
  assert.ok(Object.isFrozen(domain));
  for(const axis of ['command','position','rate'])assert.ok(Object.isFrozen(domain[axis]));
  assert.notEqual(r.selectedAfter.domain,domain);
  assert.equal(r.selectedAfter.domain.command.max,10);
  assert.equal(domain.command.max,8);
  assert.throws(()=>{domain.command.max=999;},TypeError);
  assert.throws(()=>{domain.command={min:1,max:999};},TypeError);
  start.discovery.competitive[0].domain.command.max=777;
  assert.equal(domain.command.max,8,'source range mutation cannot change copied history');

  const mixed={...start.discovery,competitive:start.discovery.competitive.map((model,index)=>({...model,
    domain:{command:{min:1,max:index?9:8},position:{min:0,max:0},rate:{min:0,max:0}}}))};
  const copied=captureExperimentReceipt(mixed,next.discovery,[{command:9,position:0,rate:0,jointTorque:18}]);
  assert.notEqual(copied.models[0].domain,copied.models[1].domain);
  assert.deepEqual(inspectExperimentReceipt(copied,0).rows[0].extrapolation,['command']);
  assert.deepEqual(inspectExperimentReceipt(copied,1).rows[0].extrapolation,[]);
  const signed={...mixed,competitive:mixed.competitive.map((model,index)=>({...model,
    domain:{command:{min:1,max:9},position:{min:0,max:0},rate:{min:index?-0:0,max:0}}}))};
  const signs=captureExperimentReceipt(signed,next.discovery,[{command:1,position:0,rate:0,jointTorque:2}]);
  assert.notEqual(signs.models[0].domain,signs.models[1].domain);
  assert.equal(Object.is(signs.models[0].domain.rate.min,0),true);
  assert.equal(Object.is(signs.models[1].domain.rate.min,-0),true);
});
