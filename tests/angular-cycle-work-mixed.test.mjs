import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitCycleWork,cycleWorkInvestigation,replayCycleWork} from '../src/trajectory/cycle-work.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
const physical=JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url)));
const base=createChallenge(physical,{method:'weak',modelLimit:1}).discovery.selected;
const spring={...base,id:'mixed-control-spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}]};
const options={includeQuadratic:true,includeMixedQuadratic:true,maxSteps:1000000};
function authored(id,samples){return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'Independent authored mixed-loss control',recordingId:id},samples};}
// Independent fine-step ODE integration: fitting receives positions only.
function oscillator(id,c,b,A=1,duration=30){
 const h=.0005,stride=20,count=Math.round(duration/h);let q=A,v=0;const samples=[];const f=(q,v)=>[v,-4*q-c*v-b*v*Math.abs(v)];
 for(let i=0;i<=count;i++){if(i%stride===0)samples.push({time:i*h,position:q});if(i===count)break;const a=f(q,v),bb=f(q+h*a[0]/2,v+h*a[1]/2),cc=f(q+h*bb[0]/2,v+h*bb[1]/2),d=f(q+h*cc[0],v+h*cc[1]);q+=h*(a[0]+2*bb[0]+2*cc[0]+d[0])/6;v+=h*(a[1]+2*bb[1]+2*cc[1]+d[1])/6;}
 return authored(id,samples);
}
const training=[oscillator('mix-a',.04,.08,1),oscillator('mix-b',.04,.08,2)],receiving=oscillator('mix-challenge',.04,.08,.65,15);
const bundle={...physical,label:'Independent mixed damping controls',trainingRuns:training,challengeRuns:[receiving]};
const mixed=fit=>fit.candidates.find(c=>c.id==='viscous-quadratic');
test('sampled-position mixed fit recovers both losses and predicts separate motion',()=>{
 const result=cycleWorkInvestigation(bundle,spring,options),c=mixed(result.fit);assert.equal(c.status,'admitted');assert.equal(c.boundary,false);assert.deepEqual(c.activeTerms,['rate','quadratic']);
 assert.ok(Math.abs(c.coefficients.rate-.04)<.001,JSON.stringify(c.coefficients));assert.ok(Math.abs(c.coefficients.quadratic-.08)<.001,JSON.stringify(c.coefficients));
 assert.ok(c.lossRMSE<result.fit.candidates.find(x=>x.id==='quadratic').lossRMSE/20);const forecast=result.receiving.find(x=>x.candidateId===c.id);assert.equal(forecast.status,'compared');assert.ok(forecast.rollout.metrics.positionRMSE<.01);assert.equal(result.selected,null);
 console.log(JSON.stringify({control:c.coefficients,workRMSE:c.lossRMSE,pivot:c.normalizedQRPivotRatio,receivingRMSE:forecast.rollout.metrics.positionRMSE}));
});
test('pure components and negative observed loss retain nonnegative boundary semantics',()=>{
 for(const [c,b]of [[.08,0],[0,.12]]){const f=mixed(fitCycleWork(spring,[oscillator('pure-'+c+'-'+b,c,b)],options));assert.equal(f.status,'admitted');assert.ok(Math.abs(f.coefficients.rate-c)<.001);assert.ok(Math.abs(f.coefficients.quadratic-b)<.001);}
 const growing=authored('negative-loss',Array.from({length:3001},(_,i)=>({time:i*.01,position:Math.exp(.02*i*.01)*Math.cos(2*i*.01)})));
 const f=mixed(fitCycleWork(spring,[growing],options));assert.equal(f.status,'admitted');assert.equal(f.boundary,true);assert.deepEqual(f.activeTerms,[]);assert.equal(f.coefficients.rate,0);assert.equal(f.coefficients.quadratic,0);assert.ok(f.lossRMSE>0);
});
test('repeated amplitude cannot identify two work coefficients; cubic overflow preserves older families',()=>{
 const pattern=Array.from({length:32},(_,i)=>Math.cos(2*Math.PI*i/32));const repeat=step=>authored('repeat-'+step,Array.from({length:321},(_,i)=>({time:i*step,position:pattern[i%32]})));
 const repeated=fitCycleWork(spring,[repeat(1/32)],options);assert.ok(repeated.admittedCycleCount>=3);assert.equal(mixed(repeated).status,'refused');assert.match(mixed(repeated).reason,/rank deficient|pivot ratio/);
 const tiny=repeat(2**-350),old=fitCycleWork(spring,[tiny],{includeQuadratic:true}),expanded=fitCycleWork(spring,[tiny],options);
 assert.equal(expanded.admittedCycleCount,old.admittedCycleCount);assert.deepEqual(expanded.candidates.slice(0,4),old.candidates);assert.equal(mixed(expanded).status,'refused');assert.match(mixed(expanded).reason,/without dropping cycles/);
});
test('v3 replay and complete budgets retain all laws and exclude receiving from fitting',()=>{
 const r=cycleWorkInvestigation(bundle,spring,options);assert.equal(r.inputs.schema,'worldlaw.cycle-work-inputs/v3');assert.equal(r.receiving.length,6);assert.deepEqual(replayCycleWork(r.inputs),r);
 const changed=structuredClone(bundle);changed.challengeRuns[0].samples.slice(1).forEach((x,i)=>x.position+=.01*Math.sin(i));assert.deepEqual(cycleWorkInvestigation(changed,spring,options).fit,r.fit);
 const denied=cycleWorkInvestigation(bundle,spring,{...options,maxSteps:1});assert.equal(denied.receiving.length,6);assert.ok(denied.receiving.every(x=>x.status==='refused'&&!x.rollout));
 for(const version of ['v1','v2']){const input=structuredClone(r.inputs);input.schema='worldlaw.cycle-work-inputs/'+version;assert.throws(()=>replayCycleWork(input),/v2|v3/);}
 assert.throws(()=>fitCycleWork(spring,training,{includeMixedQuadratic:true}),/quadratic admission/);assert.throws(()=>fitCycleWork(spring,training,{includeQuadratic:true,includeMixedQuadratic:'true'}),/boolean/);
 const old=cycleWorkInvestigation(bundle,spring,{includeQuadratic:true,maxSteps:1000000});assert.deepEqual(r.fit.candidates.slice(0,4),old.fit.candidates);assert.deepEqual(r.fit.records,old.fit.records);
});
test('measured comparison retains all original candidates and reports mixed support honestly',()=>{
 const old=cycleWorkInvestigation(physical,base,{includeQuadratic:true}),r=cycleWorkInvestigation(physical,base,options);assert.equal(r.fit.admittedCycleCount,35);assert.deepEqual(r.fit.candidates.slice(0,4),old.fit.candidates);assert.equal(r.receiving.length,6);assert.equal(r.selected,null);
 const c=mixed(r.fit);console.log(JSON.stringify({measured:{status:c.status,coefficients:c.coefficients,boundary:c.boundary,pivot:c.normalizedQRPivotRatio,workRMSE:c.lossRMSE},receiving:r.receiving.map(x=>({id:x.candidateId,status:x.status,rmse:x.rollout?.metrics.positionRMSE}))}));
});
