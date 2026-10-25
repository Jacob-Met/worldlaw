import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitCycleWork,cycleWorkInvestigation,replayCycleWork} from '../src/trajectory/cycle-work.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
const physical=JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url)));
const base=createChallenge(physical,{method:'weak',modelLimit:1}).discovery.selected;
const spring={...base,id:'quadratic-control-spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}]};
// Independent fine-step RK4, no maintained solver or fitted coefficients.
function oscillator(id,drag,initial=1){
 const dt=.0005, stride=20, count=60000;let q=initial,v=0;const samples=[];
 const f=(q,v)=>[v,-4*q-drag*v*Math.abs(v)];
 for(let i=0;i<=count;i++){
  if(i%stride===0)samples.push({time:i*dt,position:q});
  if(i===count)break;
  const a=f(q,v),b=f(q+dt*a[0]/2,v+dt*a[1]/2),c=f(q+dt*b[0]/2,v+dt*b[1]/2),d=f(q+dt*c[0],v+dt*c[1]);
  q+=dt*(a[0]+2*b[0]+2*c[0]+d[0])/6;v+=dt*(a[1]+2*b[1]+2*c[1]+d[1])/6;
 }
 return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'Independent fine-step quadratic oscillator',recordingId:id},samples};
}
const train=oscillator('quadratic-training',.12),receive=oscillator('quadratic-receiving',.12,.65);
const bundle={...physical,label:'Independent authored quadratic control',trainingRuns:[train],challengeRuns:[receive]};
test('quadratic work recovers independent damping and leaves original families intact',()=>{
 const old=fitCycleWork(spring,[train]);const result=fitCycleWork(spring,[train],{includeQuadratic:true});
 assert.equal(old.candidates.length,3);assert.equal(result.candidates.length,4);
 const q=result.candidates[3];assert.equal(q.id,'quadratic');assert.equal(q.status,'admitted');
 assert.ok(Math.abs(q.coefficients.quadratic-.12)<.001,JSON.stringify(q.coefficients));
 assert.deepEqual(q.activeTerms,['quadratic']);assert.equal(q.model.terms.at(-1).id,'quadratic');assert.ok(q.model.terms.at(-1).coefficient<0);
 assert.ok(result.records[0].cycles.filter(x=>x.status==='admitted').every(x=>x.quadraticWork>0));
 for(let i=0;i<3;i++){assert.equal(old.candidates[i].lossRMSE,result.candidates[i].lossRMSE);assert.deepEqual(old.candidates[i].predictions,result.candidates[i].predictions);}
});
test('opt-in receiving is frozen, complete-budgeted and v2 source-only replayed',()=>{
 const r=cycleWorkInvestigation(bundle,spring,{includeQuadratic:true,maxSteps:1000000});assert.equal(r.inputs.schema,'worldlaw.cycle-work-inputs/v2');assert.equal(r.receiving.length,5);
 const q=r.receiving.find(x=>x.candidateId==='quadratic');assert.equal(q.status,'compared');assert.ok(q.rollout.metrics.positionRMSE<.01);
 assert.deepEqual(replayCycleWork(r.inputs),r);assert.equal(r.selected,null);
 const changed=structuredClone(bundle);changed.challengeRuns[0].samples.slice(1).forEach((x,i)=>x.position+=.02*Math.sin(i));
 assert.deepEqual(cycleWorkInvestigation(changed,spring,{includeQuadratic:true,maxSteps:1000000}).fit,r.fit);
 const denied=cycleWorkInvestigation(bundle,spring,{includeQuadratic:true,maxSteps:1});assert.equal(denied.receiving.length,5);assert.ok(denied.receiving.every(x=>x.status==='refused'&&!x.rollout));
 const downgraded=structuredClone(r.inputs);downgraded.schema='worldlaw.cycle-work-inputs/v1';assert.throws(()=>replayCycleWork(downgraded),/v2/);
 assert.throws(()=>fitCycleWork(spring,[train],{includeQuadratic:'true'}),/boolean/);
});
test('retained measured input admits explicit comparison without winner or new physical claim',()=>{
 const old=cycleWorkInvestigation(physical,base),r=cycleWorkInvestigation(physical,base,{includeQuadratic:true});
 assert.equal(old.inputs.schema,'worldlaw.cycle-work-inputs/v1');assert.equal(r.fit.admittedCycleCount,35);assert.equal(r.fit.candidates.length,4);assert.equal(r.receiving.length,5);
 assert.equal(r.fit.selected,null);assert.equal(r.selected,null);assert.deepEqual(replayCycleWork(r.inputs),r);
 for(let i=0;i<3;i++)assert.equal(old.fit.candidates[i].lossRMSE,r.fit.candidates[i].lossRMSE);
 console.log(JSON.stringify({measuredQuadratic:{status:r.fit.candidates[3].status,coefficient:r.fit.candidates[3].coefficients?.quadratic,lossRMSE:r.fit.candidates[3].lossRMSE},receiving:r.receiving.map(x=>({id:x.candidateId,status:x.status,rmse:x.rollout?.metrics.positionRMSE}))}));
});
