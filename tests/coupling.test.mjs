import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverCoupling,predictCoupling,evaluateCoupling,planCoupling} from '../src/coupling/science.mjs';
import {createCouplingCourse,observeVirtualCoupling} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook,addCouplingObservation,readCouplingNotebook,exportCouplingNotebook} from '../src/coupling/notebook.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
// Independent algebraic truth; never use inference feature generation for evidence.
function rows(matrix,bias=[.13,-.09],n=91) {
  return Array.from({length:n},(_,i)=>{
    const x=Math.sin(i*1.371)*.93,y=Math.cos(i*2.143)*.81;
    return {id:`row-${i}`,q:[x,y],torque:[matrix[0][0]*x+matrix[0][1]*y+bias[0],matrix[1][0]*x+matrix[1][1]*y+bias[1]]};
  });
}
for(const [id,matrix] of [['independent',[[-2,0],[0,-1.4]]],['reciprocal',[[-2,.8],[.8,-1.4]]],['directional',[[-2,.8],[-.3,-1.4]]]]) {
  test(`independent analytic ${id} law selects its structure and coefficients`,()=>{
    const d=discoverCoupling(rows(matrix),{noiseSigma:1e-6});assert.equal(d.selected.id,id);
    matrix.forEach((row,i)=>row.forEach((v,j)=>near(d.selected.matrix[i][j],v)));near(d.selected.bias[0],.13);near(d.selected.bias[1],-.09);
    const predicted=predictCoupling(d.selected,[-.37,.42]);near(predicted[0],matrix[0][0]*-.37+matrix[0][1]*.42+.13);near(predicted[1],matrix[1][0]*-.37+matrix[1][1]*.42-.09);
  });
}
test('unchanged collinear evidence cannot identify cross terms; new permitted pilot restores rank',()=>{
  const n=createCouplingCourse('collinear'),a=analyzeCouplingNotebook(n);
  assert.equal(a.discovery.diagnostics.fullRank,4);assert.equal(a.plan.status,'needs_excitation');assert.equal(a.plan.selected.rankGain,2);
  assert.deepEqual(a.discovery.refused.map(x=>x.id),['reciprocal','directional']);
  const q=a.plan.selected.q;
  const next=analyzeCouplingNotebook(addCouplingObservation(n,a.plan.selected.index,observeVirtualCoupling(q,{kind:'collinear',index:1000})));
  assert.equal(next.discovery.diagnostics.fullRank,6);assert.equal(next.discovery.selected.id,'reciprocal');
  assert.equal(a.discovery.diagnostics.fullRank,4,'original remains unchanged');
});
test('constant two-coordinate data retains unidentifiable models without fabricated coefficients',()=>{
  const d=discoverCoupling(Array.from({length:8},(_,i)=>({id:`c${i}`,q:[1,1],torque:[2,3]})));
  assert.equal(d.selected,null);assert.equal(d.refused.length,3);assert.equal(d.diagnostics.adequacy,'unidentifiable');
  const p=planCoupling(d,[[1,1]]);assert.equal(p.status,'insufficient_excitation');
});
test('unoffered nonlinear law remains a residual failure',()=>{
  const d=discoverCoupling(rows([[-2,.8],[.8,-1.4]]).map(r=>({...r,torque:[r.torque[0]+1.8*r.q[0]**3,r.torque[1]+1.5*r.q[1]**2]})),{noiseSigma:.01});
  assert.equal(d.diagnostics.adequacy,'residual_mismatch');assert.equal(planCoupling(d,[[1,-1]]).status,'model_mismatch');
});
test('two independently acquired probes revise reciprocal structure while preserving first-probe loss',()=>{
  let n=createCouplingCourse(),a=analyzeCouplingNotebook(n);const initial=a.evaluations.find(x=>x.modelId===a.discovery.selected.id).rmse;
  assert.equal(a.discovery.selected.id,'independent');assert.equal(a.plan.status,'proposed');
  n=addCouplingObservation(n,a.plan.selected.index,observeVirtualCoupling(a.plan.selected.q,{index:1000}));a=analyzeCouplingNotebook(n);
  assert.ok(a.evaluations.find(x=>x.modelId===a.discovery.selected.id).rmse>initial,'the first probe does not guarantee improvement');
  n=addCouplingObservation(n,a.plan.selected.index,observeVirtualCoupling(a.plan.selected.q,{index:1001}));a=analyzeCouplingNotebook(n);
  assert.equal(a.discovery.selected.id,'reciprocal');assert.ok(a.evaluations.find(x=>x.modelId==='reciprocal').rmse<.002);
  assert.equal(a.history.length,2);assert.equal(a.history[1].beforeModel,'independent');assert.equal(a.history[1].afterModel,'reciprocal');
  assert.ok(a.history[1].frozen.find(x=>x.modelId==='independent').rmse>.5);
});
test('directional instrument can reject reciprocity; diagonal negative control keeps no-coupling family',()=>{
  let n=createCouplingCourse('directional');
  for(let i=0;i<2;i++){const a=analyzeCouplingNotebook(n);n=addCouplingObservation(n,a.plan.selected.index,observeVirtualCoupling(a.plan.selected.q,{kind:'directional',index:1000+i}));}
  assert.equal(analyzeCouplingNotebook(n).discovery.selected.id,'directional');
  const negative=analyzeCouplingNotebook(createCouplingCourse('independent'));assert.equal(negative.discovery.selected.id,'independent');assert.equal(negative.plan.status,'uninformative');
});
test('separate-check counterfactual cannot change fitting, ranking, proposals or frozen revision history',()=>{
  const n=createCouplingCourse(),a=analyzeCouplingNotebook(n),changed=structuredClone(n);
  changed.challenges=changed.challenges.map(r=>({...r,torque:[100+r.torque[0],-200+r.torque[1]]}));
  const b=analyzeCouplingNotebook(changed);assert.deepEqual(b.discovery,a.discovery);assert.deepEqual(b.plan,a.plan);assert.deepEqual(b.history,a.history);assert.notDeepEqual(b.evaluations,a.evaluations);
});
test('JSON replay recomputes from inputs and refuses renamed evidence reuse',()=>{
  const n=createCouplingCourse(),a=analyzeCouplingNotebook(n),next=addCouplingObservation(n,a.plan.selected.index,observeVirtualCoupling(a.plan.selected.q,{index:1000}));
  assert.deepEqual(analyzeCouplingNotebook(exportCouplingNotebook(next)),analyzeCouplingNotebook(next));
  const injected={...next,discovery:{selected:{id:'directional'}},result:'not trusted'};assert.deepEqual(readCouplingNotebook(injected),readCouplingNotebook(next));
  const reused=structuredClone(n);reused.challenges=[{...structuredClone(n.training[0]),id:'renamed'}];assert.throws(()=>readCouplingNotebook(reused),/repeats fitting evidence/);
  const p=analyzeCouplingNotebook(next).plan;assert.throws(()=>addCouplingObservation(next,a.plan.selected.index,{...next.revisions[0].observation,id:'renamed-again'}),/repeats retained evidence/);
  assert.ok(p.selected);
});
test('matched input, units and quasi-static declaration are mandatory and invalid edits are atomic',()=>{
  const n=createCouplingCourse(),before=JSON.stringify(n),a=analyzeCouplingNotebook(n);
  assert.throws(()=>addCouplingObservation(n,a.plan.selected.index,{id:'new',q:[.2,.3],torque:[1,2]}),/does not match/);
  for(const mutate of [x=>x.units.position='deg',x=>x.assumptions.quasiStatic=false,x=>x.options.noiseSigma=0,x=>x.training[0].torque[0]=NaN,x=>x.training[0].id='',x=>x.revisions=[{candidateIndex:-1,observation:x.training[0]}]]){
    const broken=structuredClone(n);mutate(broken);assert.throws(()=>readCouplingNotebook(broken));
  }
  assert.equal(JSON.stringify(n),before);
});
test('no separate observations means absent error, not perfect validation',()=>{
  const n=createCouplingCourse();n.challenges=[];const a=analyzeCouplingNotebook(n);
  assert.equal(a.evaluations[0].rmse,null);assert.deepEqual(a.evaluations[0].axisRmse,[null,null]);
  assert.equal(evaluateCoupling(a.discovery.selected,[]).maxAbsResidual,null);
});
test('caller permission is an explicit finite set, never silently expanded',()=>{
  const n=createCouplingCourse();n.permitted=[];assert.equal(analyzeCouplingNotebook(n).plan.status,'no_permitted_inputs');
  assert.throws(()=>planCoupling(analyzeCouplingNotebook(n).discovery,Array.from({length:513},()=>[0,0])),/512/);
  n.permitted=[[0,0],[0,0]];assert.throws(()=>readCouplingNotebook(n),/distinct/);
});
test('source class and supplied references survive measured import without oracle promotion',()=>{
  const n=createCouplingCourse();n.source={kind:'measured',label:'Operator-provided run',reference:'user-declared fixture A, acquisition 17'};
  const reopened=readCouplingNotebook(exportCouplingNotebook(n));assert.equal(reopened.source.kind,'measured');assert.deepEqual(reopened.source,n.source);
  assert.ok(!('virtual' in reopened));
});
test('identity and size bounds prevent unbounded replay',()=>{
  const n=createCouplingCourse();n.training[1].id=n.training[0].id;assert.throws(()=>readCouplingNotebook(n),/IDs overlap/);
  assert.throws(()=>readCouplingNotebook(' '.repeat(2*1024*1024+1)),/2 MB/);
  const tooMany=createCouplingCourse();tooMany.revisions=Array(65).fill({});assert.throws(()=>readCouplingNotebook(tooMany),/64/);
});

test('full-rank but unexecutable coefficient scales do not become an uninformative success',()=>{
  const input=rows([[-2,.8],[.8,-1.4]]).map(r=>({...r,q:r.q.map(v=>v*1e-10),torque:r.torque.map(v=>v*1e10)}));
  const d=discoverCoupling(input);assert.equal(d.diagnostics.fullRank,6);assert.equal(d.selected,null);
  assert.equal(planCoupling(d,[[0,1e-10]]).status,'unexecutable_models');
});
