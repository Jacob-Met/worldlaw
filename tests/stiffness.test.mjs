import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateStiffness,predictStiffness,evaluateStiffness,defaultKnots} from '../src/stiffness/science.mjs';
import {createStiffnessStudy,exportStiffnessStudy,importStiffnessStudy,replaceStiffnessChecks} from '../src/stiffness/notebook.mjs';
import {stiffnessExample,exampleSettings} from '../src/stiffness/fixture.mjs';
const approx=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,a+' != '+b);
const rows=Array.from({length:41},(_,i)=>{const position=(i-20)/10;return {position,command:0,rate:0,jointTorque:2-3*position-5*Math.max(0,position-.4)}});
const settings={knots:[-.8,-.4,0,.4,.8],nuisanceTerms:['bias'],noiseSigma:.001};
test('recovers independently specified continuous change and both executable slopes',()=>{
 const fit=investigateStiffness(rows,settings);
 assert.equal(fit.status,'piecewise_preferred');approx(fit.selected.knot,.4);
 approx(fit.selected.slopeLeft,-3);approx(fit.selected.slopeRight,-8);
 approx(predictStiffness(fit.selected,{position:.7,rate:0,command:0}),-1.6);
 assert.ok(fit.baseline.metrics.rmse>.5);assert.ok(fit.selected.metrics.rmse<1e-12);
});
test('continuity holds at the searched knot and changed-input predictions remain live',()=>{
 const m=investigateStiffness(rows,settings).selected;
 approx(predictStiffness(m,{position:.4,rate:0,command:0}),.8);
 approx(predictStiffness(m,{position:.4+1e-8,rate:0,command:0}),.8-8e-8);
});
test('global response prefers baseline despite executable flexible alternatives',()=>{
 const data=rows.map(r=>({...r,jointTorque:2-3*r.position}));
 const fit=investigateStiffness(data,settings);
 assert.equal(fit.status,'global_preferred');assert.equal(fit.selected.family,'global');
 assert.ok(fit.profile.length>1);
});
test('joint nuisance coefficients recover independently varied inputs',()=>{
 const study=createStiffnessStudy(stiffnessExample(),exampleSettings());
 assert.equal(study.fit.selected.knot,.4);
 const coeff=Object.fromEntries(study.fit.selected.terms.map(t=>[t.id,t.coefficient]));
 approx(coeff.bias,.3,.001);approx(coeff.command,.8,.001);approx(coeff.rate,-.25,.001);
 assert.ok(study.checks.find(c=>c.knot===.4).rmse<.002);
});
test('repeated rows cannot replace distinct support on both sides',()=>{
 const data=Array.from({length:20},(_,i)=>({position:i%2?1:-1,command:0,rate:0,jointTorque:i%2?-3:2}));
 const fit=investigateStiffness(data,{...settings,knots:[0]});
 assert.equal(fit.profile[1].status,'insufficient_side_support');
 assert.equal(fit.selected.family,'global');
});
test('rank-deficient nuisance terms stay refused instead of being silently dropped',()=>{
 const fit=investigateStiffness(rows,{...settings,nuisanceTerms:['bias','command']});
 assert.equal(fit.status,'unidentifiable');assert.equal(fit.selected,null);
 assert.ok(fit.profile.every(p=>p.status==='rank_deficient'));
});
test('one-sided observations cannot locate an unobserved change angle',()=>{
 const data=rows.filter(r=>r.position<.4);
 const fit=investigateStiffness(data,{...settings,knots:[.4,.8]});
 assert.ok(fit.profile.slice(1).every(p=>p.status==='insufficient_side_support'));
 assert.equal(fit.selected.family,'global');
});
test('changing checks does not alter training fits, grid or ranking',()=>{
 const data=stiffnessExample(),a=createStiffnessStudy(data,exampleSettings());
 data.heldOut=data.heldOut.map(r=>({...r,jointTorque:1000}));
 const b=createStiffnessStudy(data,exampleSettings());
 assert.deepEqual(a.fit,b.fit);assert.ok(b.checks[0].rmse>900);
 const c=replaceStiffnessChecks(a,{observations:data.heldOut,source:{label:'separate instrument'}});
 assert.deepEqual(a.fit,c.fit);assert.equal(c.dataset.source.metadata.separateCheckSource.label,'separate instrument');
});
test('smooth omitted law retains training mismatch rather than certifying a physical kink',()=>{
 const study=createStiffnessStudy(stiffnessExample('smooth'),exampleSettings());
 assert.equal(study.fit.diagnostics.adequacy,'training_mismatch');
 assert.ok(study.fit.selected.metrics.rmse>3*study.settings.noiseSigma);
});
test('finite grid limitations remain visible for off-grid changes',()=>{
 const f=investigateStiffness(rows,{...settings,knots:[.1,.3,.5,.7]});
 assert.ok(f.selected.metrics.rmse>.02);
 assert.ok([.3,.5].includes(f.selected.knot));
 assert.ok(!f.profile.some(p=>p.knot===.4));
});
test('extrapolation accounting includes positions and nuisance inputs',()=>{
 const m=investigateStiffness(rows,settings).selected;
 const e=evaluateStiffness(m,[{position:5,command:1,rate:0,jointTorque:0}]);
 assert.equal(e.extrapolationCount,1);assert.deepEqual(e.rows[0].extrapolation,['position','command']);
 assert.equal(evaluateStiffness(m,[]).rmse,null);
});
test('input-only save/reopen recomputes and rejects supplied claimed results',()=>{
 const study=createStiffnessStudy(stiffnessExample(),exampleSettings()),text=exportStiffnessStudy(study);
 assert.ok(!text.includes('"fit"'));assert.deepEqual(importStiffnessStudy(text).fit,study.fit);
 const tampered=JSON.parse(text);tampered.fit={selected:'physical truth'};
 assert.throws(()=>importStiffnessStudy(JSON.stringify(tampered)),/input-only/);
});
test('finite bounds, complete rows, repeated knots and unsupported settings refuse',()=>{
 assert.throws(()=>investigateStiffness(rows,{...settings,knots:[0,0]}),/distinct/);
 assert.throws(()=>investigateStiffness(rows,{...settings,knots:[NaN]}),/finite/);
 assert.throws(()=>investigateStiffness(rows,{...settings,noiseSigma:0}),/at least/);
 assert.throws(()=>investigateStiffness(rows,{...settings,results:{}}),/Unknown/);
 assert.throws(()=>investigateStiffness([...rows,{position:1}],settings),/finite/);
 assert.throws(()=>investigateStiffness(rows,{...settings,knots:Array.from({length:102},(_,i)=>i)}),/101/);
});
test('default grid depends only on training positions; narrow ranges retain honest support',()=>{
 assert.equal(defaultKnots(rows).length,21);
 const data=stiffnessExample('narrow'),fit=investigateStiffness(data.observations,exampleSettings());
 assert.equal(fit.selected.family,'global');
 assert.ok(fit.profile.some(p=>p.knot===.4&&p.status==='insufficient_side_support'));
});
test('a two-kink mechanism can fail the single-change family',()=>{
 const data=rows.map(r=>({...r,jointTorque:-r.position-4*Math.max(0,r.position+.7)-6*Math.max(0,r.position-.8)}));
 const fit=investigateStiffness(data,settings);
 assert.equal(fit.diagnostics.adequacy,'training_mismatch');
});
