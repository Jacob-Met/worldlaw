import test from 'node:test';import assert from 'node:assert/strict';
import {planRefinement,reopenRefinement} from '../src/cycle-work/refinement.mjs';
import {refinementExample,receiveAuthoredRefinement} from '../src/cycle-work/refinement-example.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('bounded actual refinement separates branch work while conservative artifact stays enclosed',()=>{
 for(const kind of ['branch','conservative']){const raw=refinementExample(kind),before=JSON.stringify(raw);const initial=reopenRefinement(raw);assert.equal(initial.refined,null);assert.equal(initial.pending,12);assert.equal(initial.coarse.conclusion,'zero-compatible');near(initial.plan.coarseBound,11/12);
 const received=reopenRefinement(receiveAuthoredRefinement(raw,kind));assert.equal(received.pending,0);assert.equal(received.refined.conclusion,kind==='branch'?'positive-work':'zero-compatible');assert.equal(JSON.stringify(raw),before);assert.equal(received.refined.input.samples.length,18);assert.deepEqual(reopenRefinement(JSON.parse(JSON.stringify(received.bundle))),received);}
});
test('zero-angle jumps remain separate original rows and receive no requests',()=>{const raw=refinementExample();const r=reopenRefinement(receiveAuthoredRefinement(raw));assert.equal(r.plan.segments[2].bound,0);assert.equal(r.plan.requests.some(p=>p.segment===2),false);const at2=r.refined.input.samples.filter(s=>s.position===2);assert.equal(at2.length,2);assert.notEqual(at2[0].jointTorque,at2[1].jointTorque);});
test('deterministic greedy allocation matches exhaustive ideal small-budget objective',()=>{
 const raw=refinementExample('conservative');raw.request.budget=3;const p=planRefinement(...[raw.request.cycle,raw.request.curvature,3]);assert.deepEqual(p.segments.map(s=>s.subdivisions),[2,2,1,2,1]);near(p.refinedBound,47/192);
 const c=[1/6,1/6,27/48,1/48];let best=Infinity;for(let a=0;a<=3;a++)for(let b=0;b<=3-a;b++)for(let d=0;d<=3-a-b;d++){const e=3-a-b-d;best=Math.min(best,c[0]/(a+1)**2+c[1]/(b+1)**2+c[2]/(d+1)**2+c[3]/(e+1)**2);}near(p.refinedBound,best);
});
test('missing readings stay pending; duplicate, wrong angle and stale frozen input refuse',()=>{
 const raw=receiveAuthoredRefinement(refinementExample());const partial=structuredClone(raw);partial.acquisition.readings.pop();assert.equal(reopenRefinement(partial).refined,null);assert.equal(reopenRefinement(partial).pending,1);
 for(const change of [x=>x.acquisition.readings[1]=x.acquisition.readings[0],x=>x.acquisition.readings[0].position+=.01,x=>x.request.cycle.source+='changed',x=>x.request.curvature[0].maxSecondDerivative=3,x=>delete x.acquisition.branchAssumption,x=>x.acquisition.readings[0].jointTorque=null]){const x=structuredClone(raw);change(x);assert.throws(()=>reopenRefinement(x));}
});
test('budget and full declarations are bounded; zero curvature leaves unused budget',()=>{
 for(const change of [x=>x.request.budget=129,x=>x.request.budget=-1,x=>x.request.curvature.pop(),x=>delete x.request.curvature[0].assumption,x=>x.request.curvature[0].maxSecondDerivative=Infinity,x=>x.request.curvature[2].kind='bounded-curvature']){const x=refinementExample();change(x);assert.throws(()=>reopenRefinement(x));}
 const x=refinementExample();for(const c of x.request.curvature)if(c.kind==='bounded-curvature')c.maxSecondDerivative=0;const p=reopenRefinement(x).plan;assert.equal(p.usedBudget,0);assert.equal(p.unusedBudget,12);
});
test('adjacent represented angles refuse midpoint acquisition rather than inventing samples',()=>{const x=refinementExample();x.request.cycle.samples=[{position:1e6-2**-33,jointTorque:0,torqueRadius:0},{position:1e6,jointTorque:0,torqueRadius:0},{position:1e6-2**-33,jointTorque:0,torqueRadius:0}];x.request.curvature=x.request.curvature.slice(0,2);x.request.budget=1;assert.throws(()=>reopenRefinement(x),/representable/);});
test('wide actual reading bounds can leave a refined branch result inconclusive',()=>{const x=receiveAuthoredRefinement(refinementExample());x.acquisition.readings.forEach(r=>r.torqueRadius=10);assert.equal(reopenRefinement(x).refined.conclusion,'zero-compatible');});
test('false curvature declaration demonstrates conditional guarantee, not inferred smoothness',()=>{const x=refinementExample('conservative');x.request.budget=0;for(const c of x.request.curvature)if(c.kind==='bounded-curvature')c.maxSecondDerivative=0;assert.equal(reopenRefinement(x).coarse.conclusion,'negative-work');});
