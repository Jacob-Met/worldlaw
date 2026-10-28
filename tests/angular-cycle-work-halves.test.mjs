import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {cycleWorkInvestigation,inspectCycleWorkHalves,replayHalfCycleWork} from '../src/trajectory/cycle-work.mjs';
const physical=JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url)));
const original=createChallenge(physical,{method:'weak',modelLimit:1}).discovery.selected;
const spring={...original,id:'half-control-spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}]};
const authored=(id,samples)=>({id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'Independent sampled-position half-cycle control',recordingId:id},samples});
function periodic(id,bias=0,step=Math.PI/64,pattern=null,A=.8){const p=pattern??Array.from({length:64},(_,i)=>bias+A*Math.cos(2*Math.PI*i/64));return authored(id,Array.from({length:p.length*10+1},(_,i)=>({time:i*step,position:p[i%p.length]})));}
const training=[periodic('train-a'),periodic('train-b')];
function input(challenge,model=spring,options={}){return cycleWorkInvestigation({...physical,label:'Half-cycle authored controls',trainingRuns:training,challengeRuns:[challenge]},model,{maxSteps:1,...options}).inputs;}
const compared=(r,id)=>r.comparisons.filter(c=>c.candidateId===id&&c.status==='compared');
test('opposing observed half-cycle losses expose cancellation hidden by complete cycles',()=>{
 const inputs=input(periodic('biased-receiving',.1)),before=JSON.stringify(inputs),r=inspectCycleWorkHalves(inputs);
 assert.equal(JSON.stringify(inputs),before);assert.deepEqual(r.investigation,cycleWorkInvestigation(inputs.bundle,inputs.restoringModel,inputs.options));
 const rows=compared(r,'restoring-only');assert.ok(rows.length>=3);
 for(const row of rows){assert.ok(Math.abs(row.halves[0].observedLoss-.64)<1e-10);assert.ok(Math.abs(row.halves[1].observedLoss+.64)<1e-10);assert.equal(row.halves[0].predictedLoss,0);assert.ok(Math.abs(row.residualSum)<1e-10);}
 assert.ok(r.records[0].cycles.every(c=>Math.abs(c.loss)<1e-10));assert.equal(r.selected,null);
 console.log(JSON.stringify({cancellation:rows[0],work:r.work}));
});
test('analytic damped positions support the frozen loss at refined sampling',()=>{
 const alpha=.04,omega=2,k=omega*omega+alpha*alpha,model={...spring,terms:[{id:'spring',coefficient:-k,coefficientUnit:'1/s²'}]};
 function run(id,A,n,periods){const dt=Math.PI/n;return {...authored(id,Array.from({length:n*periods+1},(_,i)=>{const t=i*dt;return {time:t,position:A*Math.exp(-alpha*t)*Math.cos(omega*t)};})),initialRate:-alpha*A};}
 const frozenTraining=[run('damped-train-a',1,256,4),run('damped-train-b',1.5,256,4)];const errors=[],fits=[];
 for(const n of [64,128]){
  const bundle={...physical,label:'Analytic damped half-cycle',trainingRuns:frozenTraining,challengeRuns:[run('damped-receiving',.7,n,6)]};
  const r=inspectCycleWorkHalves(cycleWorkInvestigation(bundle,model,{maxSteps:1}).inputs),rows=compared(r,'viscous');assert.ok(rows.length>=3);
  fits.push(r.investigation.fit);const maximum=Math.max(...rows.flatMap(c=>c.halves.map(h=>Math.abs(h.residual))));errors.push(maximum);assert.ok(maximum<.005);
  assert.ok(Math.abs(r.investigation.fit.candidates.find(c=>c.id==='viscous').coefficients.rate-2*alpha)<.002);
 }
 assert.deepEqual(fits[1],fits[0]);assert.ok(errors[0]>1e-7);assert.ok(errors[1]<errors[0]/4);console.log(JSON.stringify({frozenRate:fits[0].candidates.find(c=>c.id==='viscous').coefficients.rate,dampedHalfMaximumResiduals:errors}));
});
test('ambiguous minima and unavailable cubic features retain original cycles and all laws',()=>{
 const pattern=Array.from({length:64},(_,i)=>.6*Math.cos(2*Math.PI*i/64));pattern[34]=pattern[32];pattern[33]=-.5;
 const ambiguous=inspectCycleWorkHalves(input(periodic('ambiguous-minimum',0,Math.PI/64,pattern)));
 assert.ok(ambiguous.records[0].cycles.length>=3);assert.ok(ambiguous.records[0].cycles.every(c=>c.status==='admitted'&&c.halfStatus==='refused'&&/Separated equal minima/.test(c.halfReason)));
 assert.equal(ambiguous.comparisons.length,ambiguous.records[0].cycles.length*4);
 const tiny=periodic('tiny-receiving',0,2**-350,null,.6),r=inspectCycleWorkHalves(input(tiny,spring,{includeQuadratic:true,includeMixedQuadratic:true}));
 assert.ok(compared(r,'restoring-only').length);assert.ok(compared(r,'viscous').length);assert.ok(r.comparisons.filter(c=>['quadratic','viscous-quadratic'].includes(c.candidateId)).every(c=>c.status==='refused'));
 assert.ok(r.records[0].cycles.every(c=>c.status==='admitted'));
 const noCycles=inspectCycleWorkHalves(input(authored('stationary',Array.from({length:100},(_,i)=>({time:i*.01,position:.1})))));
 assert.equal(noCycles.records[0].cycles.length,0);assert.equal(noCycles.records[0].coverage.excludedPrefixSamples,100);
});
test('source wrapper recomputes; receiving changes never alter frozen fitting or original versions',()=>{
 for(const options of [{},{includeQuadratic:true},{includeQuadratic:true,includeMixedQuadratic:true}]){
  const source=input(periodic('receiving',0,Math.PI/64,null,.7),spring,options),originalReport=cycleWorkInvestigation(source.bundle,source.restoringModel,source.options),r=inspectCycleWorkHalves(source);
  assert.deepEqual(r.investigation,originalReport);assert.deepEqual(replayHalfCycleWork({...r.inputs,comparisons:[{forged:true}]}),r);
  const changed=structuredClone(source);changed.bundle.challengeRuns[0].samples.forEach(p=>p.position+=.1);
  const other=inspectCycleWorkHalves(changed);assert.deepEqual(other.investigation.fit,r.investigation.fit);assert.notDeepEqual(other.comparisons,r.comparisons);
  assert.ok(r.work.rateWindows<=8192&&r.work.intervals<=8192);
 }
 assert.throws(()=>replayHalfCycleWork({schema:'worldlaw.cycle-work-halves/v0'}),/notebook/);
});
test('retained measured receiving positions expose every frozen half-cycle comparison',()=>{
 const inputs=cycleWorkInvestigation(physical,original,{includeQuadratic:true,includeMixedQuadratic:true,maxSteps:1000000}).inputs;
 const r=inspectCycleWorkHalves(inputs);assert.deepEqual(r.investigation.fit,cycleWorkInvestigation(physical,original,inputs.options).fit);
 const count=r.records.reduce((n,x)=>n+x.cycles.length,0);assert.ok(count>0);assert.equal(r.comparisons.length,count*6);assert.equal(r.selected,null);
 console.log(JSON.stringify({measuredReceivingHalves:r.records.map(x=>({run:x.runId,cycles:x.cycles.length,supported:x.cycles.filter(c=>c.halfStatus==='compared').length,coverage:x.coverage})),firstComparisons:r.comparisons.slice(0,6).map(x=>({law:x.candidateId,status:x.status,halves:x.halves,residualSum:x.residualSum,reason:x.reason})),work:r.work}));
});
