import test from 'node:test';import assert from 'node:assert/strict';
import {freezeBranchResponses,reopenBranchResponses,normalizeBranchRequest,exportBranchResponses,importBranchResponses,BRANCH_RESPONSE_SCHEMA,BRANCH_RECEIVING_ASSUMPTION} from '../src/cycle-work/branch-response.mjs';
const near=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function record(id,grid,fn,radius=0){const positions=[...grid,...[...grid].reverse()],branches=positions.map((_,i)=>i<grid.length?1:-1);return {id,branches,cycle:{schema:'worldlaw.cycle-work/v1',source:'Independent analytic response control '+id,units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:0,samples:positions.map((position,i)=>({position,jointTorque:fn(position,branches[i]),torqueRadius:radius}))}};}
const request=(training,gate=.001)=>({training,settings:{trainingRmsTolerance:gate,receivingRmsTolerance:gate,basis:'Authored review gate; not a physical calibration'}});
const notebook=(req,receiving)=>{const normalized=normalizeBranchRequest(req);return {schema:BRANCH_RESPONSE_SCHEMA,request:normalized,acquisition:receiving?{request:structuredClone(normalized),assumption:BRANCH_RECEIVING_ASSUMPTION,records:receiving}:null};};
const linear=(x,s)=>.375-.75*x+.25*s+.125*x*s;

test('orthogonal symmetric design yields independently derived coefficients and family RMS',()=>{
 const q=.125,r=record('symmetric',[-2,-1,0,1,2],(x,s)=>linear(x,s)+q*x*x),f=freezeBranchResponses(request([r],1));
 const expected=[[.375+2*q,-.75],[.375+2*q,-.75,.25],[.375+2*q,-.75,.25,.125]];
 // E[x²]=2, Var(x²)=14/5 and branch signs are orthogonal to angle.
 const errors=[Math.sqrt(q*q*14/5+.25**2+2*.125**2),Math.sqrt(q*q*14/5+2*.125**2),q*Math.sqrt(14/5)];
 f.models.forEach((m,i)=>{m.coefficients.forEach((v,j)=>near(v,expected[i][j]));near(m.training[0].rmse,errors[i]);assert.equal(m.training[0].rows.length,10);});
});
test('a small failed cycle cannot hide inside a passing pooled RMS',()=>{
 const many=record('dense',[-1,0,1].flatMap(x=>Array(100).fill(x)),()=>0),few=record('short',[-1,1],()=>10);
 const f=freezeBranchResponses(request([many,few],1));
 for(const m of f.models){assert.equal(m.training[0].status,'compatible');assert.equal(m.training[1].status,'incompatible');assert.equal(m.status,'incompatible');
  const pooled=Math.sqrt(m.training.reduce((sum,r)=>sum+r.count*r.rmse*r.rmse,0)/604);assert.ok(pooled<1);assert.ok(m.training[1].rmse>9);}
});
test('frozen nominal reading-box intervals enclose independently computed RMS extrema',()=>{
 const req=request([record('train',[-2,-1,0,1,2],linear)],.1),rec=record('receive',[-2,-.75,.25,1.5,2],(x,s)=>linear(x,s)+.2,.05);
 const r=reopenBranchResponses(notebook(req,[rec])),a=r.receiving[2].cycles[0];near(a.rmse,.2);assert.ok(a.errorInterval[0]<=.15);assert.ok(a.errorInterval[1]>=.25);assert.equal(a.status,'incompatible');
 for(const row of a.rows){assert.ok(row.lowerError<=Math.max(0,Math.abs(row.prediction-row.observed)-.05));assert.ok(row.upperError>=Math.abs(row.prediction-row.observed)+.05);}
 const wide=structuredClone(rec);wide.cycle.samples.forEach(p=>p.torqueRadius=.25);const uncertain=reopenBranchResponses(notebook(req,[wide]));assert.equal(uncertain.receiving[2].cycles[0].status,'unresolved');assert.equal(uncertain.receiving[2].cycles[0].errorInterval[0],0);
 assert.deepEqual(uncertain.frozen,r.frozen);
});
test('equal work does not hide conservative response drift and receiving never refits or selects',()=>{
 const req=request([record('train',[-2,-1,0,1,2],linear)],.01),grid=[-2,-.5,.25,1.25,2];
 const a=reopenBranchResponses(notebook(req,[record('match',grid,linear)])),b=reopenBranchResponses(notebook(req,[record('drift',grid,(x,s)=>linear(x,s)+.5*x)]));
 assert.deepEqual(a.frozen,b.frozen);assert.equal(a.receiving[2].cycles[0].status,'compatible');assert.equal(b.receiving[2].cycles[0].status,'incompatible');
 near(a.receiving[2].cycles[0].work.observed.work,b.receiving[2].cycles[0].work.observed.work);
 assert.equal(b.receiving.length,3);assert.equal(b.selected,undefined);assert.equal(b.frozen.selected,undefined);
 const outside=record('outside',[-3,-.5,.25,1.25,3],linear),c=reopenBranchResponses(notebook(req,[outside]));
 assert.deepEqual(c.frozen,a.frozen);for(const family of c.receiving){assert.equal(family.cycles[0].status,'outside-training-range');assert.ok(family.cycles[0].rows.some(r=>r.outsideTrainingRange));}
});
test('rank failures retain observations and every candidate without inventing coefficients',()=>{
 const t=record('narrow',[999999,999999+2**-30,999999+2**-29],(x,s)=>s),f=freezeBranchResponses(request([t],.1));
 assert.equal(f.models.length,3);assert.ok(f.models.some(m=>m.status==='rank-deficient'));
 for(const m of f.models.filter(m=>m.status==='rank-deficient')){assert.equal(m.coefficients,null);assert.equal(m.training[0].count,6);assert.ok(m.training[0].work.observed);assert.equal(m.training[0].work.predicted,null);assert.deepEqual(m.training[0].rows,[]);}
});
test('identity, declared monotone legs and exact frozen request gate raw receiving',()=>{
 const req=request([record('training',[-2,0,2],linear)]),rec=record('receiving',[-2,-.5,1,2],linear),good=notebook(req,[rec]);
 for(const mutate of [x=>x.acquisition.assumption='same-record',x=>x.acquisition.request.settings.basis+='changed',x=>x.acquisition.records[0].id='training',x=>x.acquisition.records[0].branches[1]=-1,x=>x.acquisition.records[0].cycle.samples[2].position=-1,x=>x.acquisition.records[0].cycle.samples[4].position=1.9]){const x=structuredClone(good);mutate(x);assert.throws(()=>reopenBranchResponses(x));}
 const copied=structuredClone(req.training[0]);copied.id='new-id';copied.cycle.source='different claimed acquisition';copied.cycle.samples.forEach(p=>p.torqueRadius=.5);assert.throws(()=>reopenBranchResponses(notebook(req,[copied])),/identical/);
});
test('saved fits and verdicts are discarded and original sample/event identities stay immutable',()=>{
 const raw=notebook(request([record('train',[-2,0,2],linear)]),[record('receiving',[-2,-.5,1,2],linear)]),before=JSON.stringify(raw),r=reopenBranchResponses(raw);
 const forged={...r.bundle,frozen:{models:[{coefficients:[999]}]},receiving:[{status:'compatible'}],selected:'branch-affine'};
 const replay=importBranchResponses(JSON.stringify(forged));assert.deepEqual(replay,r);assert.equal(JSON.stringify(raw),before);assert.deepEqual(importBranchResponses(exportBranchResponses(raw)).bundle,r.bundle);
});
