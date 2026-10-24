import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitCycleWork,cycleWorkInvestigation,replayCycleWork} from '../src/trajectory/cycle-work.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
const physical=JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url)));
const base=createChallenge(physical,{method:'weak',modelLimit:1}).discovery.selected;
const spring={...base,id:'analytic-spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}]};
function run(id,position,rate=0,dt=.01,count=4001){return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:rate,source:{label:'Authored analytic oscillator',recordingId:id},samples:Array.from({length:count},(_,i)=>({time:i*dt,position:position(i*dt)}))};}
const viscous=c=>t=>Math.exp(-c*t/2)*(Math.cos(Math.sqrt(4-c*c/4)*t)+c/(2*Math.sqrt(4-c*c/4))*Math.sin(Math.sqrt(4-c*c/4)*t));
const damped=run('damped',viscous(.08));
const bundle=training=>({...physical,label:'Analytic cycle controls',trainingRuns:[training],challengeRuns:[run('receiving',t=>.7*Math.cos(2*t+.3),-.7*2*Math.sin(.3),.02,501)]});
test('analytic viscous oscillator recovers work coefficient with sampled endpoint kinetic correction',()=>{
 const result=fitCycleWork(spring,[damped]);assert.ok(result.admittedCycleCount>=8);
 const candidate=result.candidates.find(c=>c.id==='viscous');assert.equal(candidate.status,'admitted');assert.ok(Math.abs(candidate.coefficients.rate-.08)<.0002);
 assert.ok(result.records[0].cycles.some(c=>Math.abs(c.kineticCorrection)>1e-7));assert.equal(result.selected,null);
});
test('analytic Coulomb half-cycles recover coefficient without supplying rate observations',()=>{
 const f=.025,period=Math.PI/2;
 const position=t=>{const n=Math.floor(t/period),amplitude=1-2*n*f/4,sign=n%2?-1:1;return sign*((amplitude-f/4)*Math.cos(2*(t-n*period))+f/4);};
 const fit=fitCycleWork(spring,[run('coulomb',position)]),candidate=fit.candidates.find(c=>c.id==='coulomb');
 assert.equal(candidate.status,'admitted');assert.ok(Math.abs(candidate.coefficients.coulomb-f)<.0002);
});
test('conservative oscillator yields negligible inferred loss and exposes unsupported joint coefficients',()=>{
 const result=fitCycleWork(spring,[run('conservative',t=>Math.cos(2*t))]);
 assert.ok(result.candidates[0].coefficients.rate<1e-6);assert.ok(result.candidates[1].coefficients.coulomb<1e-6);
 const joint=result.candidates[2];assert.ok(joint.status==='refused'||joint.normalizedQRPivotRatio>10||joint.lossRMSE<1e-6);
});
test('quantized contiguous maximum plateau has an explicit endpoint rule and interval',()=>{
 const r=run('quantized',t=>Math.round(viscous(.08)(t)*1000)/1000),fit=fitCycleWork(spring,[r]);
 assert.match(fit.declaration.turningPointRule,/contiguous_maximum_plateau/);assert.ok(fit.admittedCycleCount>0);
 assert.ok(fit.records[0].cycles.some(c=>c.endpointPlateaus?.some(([a,b])=>b>a)));
});
test('no cycles, undersampling and unresolved disjoint maxima retain refusals',()=>{
 const flat=fitCycleWork(spring,[run('flat',()=>1)]);assert.equal(flat.cycleCount,0);assert.ok(flat.candidates.every(c=>c.status==='refused'));assert.equal(flat.records[0].coverage.excludedPrefixSamples,4001);
 const coarse=fitCycleWork(spring,[run('undersampled',t=>Math.cos(2*t),0,.5,81)],{windowSize:9});assert.ok(coarse.cycleCount>0);assert.equal(coarse.admittedCycleCount,0);
 const altered=structuredClone(damped);for(let i=1;i<altered.samples.length-2;i++){if(altered.samples[i].position>altered.samples[i-1].position&&altered.samples[i].position>altered.samples[i+1].position){altered.samples[i+2].position=altered.samples[i].position;}}
 const ambiguous=fitCycleWork(spring,[altered]);assert.ok(ambiguous.records[0].cycles.some(c=>c.reason?.includes('Separated equal maxima')));
});
test('fitting ignores all receiving positions and export replays the executable population',()=>{
 const b=bundle(damped),a=cycleWorkInvestigation(b,spring),changed=structuredClone(b);changed.challengeRuns[0].samples.slice(1).forEach((r,i)=>r.position+=.2*Math.sin(i));
 const other=cycleWorkInvestigation(changed,spring);assert.deepEqual(a.fit,other.fit);assert.deepEqual(replayCycleWork(a.inputs),a);assert.equal(a.receiving.length,4);assert.equal(a.selected,null);
 assert.notEqual(a.receiving[0].rollout.metrics.positionRMSE,other.receiving[0].rollout.metrics.positionRMSE);
});
test('complete coarse/refined receiving reservation refuses every declared model without survivor metrics',()=>{
 const r=cycleWorkInvestigation(bundle(damped),spring,{maxSteps:1});assert.equal(r.receiving.length,4);assert.ok(r.receiving.every(row=>row.status==='refused'&&!row.rollout));assert.ok(r.solver.requiredSteps>1);
 const exact=cycleWorkInvestigation(bundle(damped),spring,{maxSteps:r.solver.requiredSteps});assert.ok(exact.receiving.every(row=>row.status==='compared'));
});
test('existing drag, incompatible units, copied evidence and invalid declarations refuse',()=>{
 assert.throws(()=>fitCycleWork({...spring,terms:[...spring.terms,{id:'rate',coefficient:-.1,coefficientUnit:'1/s'}]},[damped]),/restoring-only/);
 assert.throws(()=>fitCycleWork({...spring,units:{...spring.units,position:'degree'}},[damped]),/units/);
 assert.throws(()=>fitCycleWork(spring,[damped],{windowSize:4}),/odd/);
 const b=bundle(damped);b.challengeRuns[0]={...structuredClone(damped),id:'copied'};assert.throws(()=>cycleWorkInvestigation(b,spring),/recording|repeats/);
 const invalid=structuredClone(damped);invalid.samples[30].time=invalid.samples[29].time;assert.throws(()=>fitCycleWork(spring,[invalid]),/increase/);
});
test('physical reused-data disagreement and joint boundary remain visible; no winner selected',()=>{
 const r=cycleWorkInvestigation(physical,base);assert.equal(r.fit.cycleCount,35);assert.equal(r.fit.admittedCycleCount,35);
 const [v,c,j]=r.fit.candidates;assert.ok(v.lossRMSE<c.lossRMSE);assert.equal(j.boundary,true);assert.ok(j.unconstrainedCoefficients.some(x=>x<0));assert.deepEqual(j.coefficients,v.coefficients);
 const vr=r.receiving.find(x=>x.candidateId==='viscous'),cr=r.receiving.find(x=>x.candidateId==='coulomb');assert.ok(vr.rollout.metrics.positionRMSE>cr.rollout.metrics.positionRMSE);assert.equal(r.selected,null);assert.equal(r.fit.selected,null);
});
