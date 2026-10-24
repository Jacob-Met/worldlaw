import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateStiffness,predictStiffness,stiffnessSlope} from '../src/stiffness/science.mjs';
import {createStiffnessStudy,exportStiffnessStudy,importStiffnessStudy} from '../src/stiffness/notebook.mjs';
import {stiffnessExperimentCourse,observeStiffnessCourse} from '../src/stiffness/experiment-fixture.mjs';
import {addStiffnessCubicRevision,setPendingStiffnessRequest,receiveStiffnessObservation,freezeStiffnessRequest,
 experimentInputs,replayStiffnessExperiment,exportStiffnessExperiment,importStiffnessExperiment} from '../src/stiffness/experiment.mjs';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} differs from independent ${b}`);
const state=position=>({position,command:0,rate:0});
const settings={knots:[-.5,0,.5],nuisanceTerms:['bias'],noiseSigma:.001,ambiguityDelta:6};
const smooth=()=>stiffnessExperimentCourse('smooth');
function observe(session,index,id){
 const frozen=setPendingStiffnessRequest(session,index);
 return receiveStiffnessObservation(frozen,frozen.pending,{id,source:{label:'Separate authored reading',declaredKind:'authored control'},
  observation:{...frozen.pending.state,jointTorque:observeStiffnessCourse('smooth',frozen.pending.state)}});
}

test('declared cubic recovers independent nuisance coefficients, conditional predictions and derivative',()=>{
 const origin=.4,rows=[];
 for(let i=0;i<25;i++)for(const command of [-1,1])for(const rate of [-.7,.7]){
  const position=-1.2+i/10;
  rows.push({position,command,rate,jointTorque:.7+.2*command-.3*rate-1.5*position-2*(position-origin)**3});
 }
 const fit=investigateStiffness(rows,{...settings,nuisanceTerms:['bias','command','rate'],cubicOrigin:origin});
 assert.equal(fit.selected.family,'cubic');assert.equal(fit.selected.schema,'worldlaw.stiffness-model/v2');
 const coefficients=Object.fromEntries(fit.selected.terms.map(t=>[t.id,t.coefficient]));
 for(const [id,value]of Object.entries({bias:.7,command:.2,rate:-.3,position:-1.5,cubic:-2}))near(coefficients[id],value);
 for(const position of [-.9,.4,1.1]){
  near(predictStiffness(fit.selected,{position,command:.3,rate:-.2}),.7+.06+.06-1.5*position-2*(position-.4)**3);
  near(stiffnessSlope(fit.selected,position),-1.5-6*(position-.4)**2);
 }
 assert.equal(fit.selected.slopeLeft,null);assert.equal(fit.selected.slopeRight,null);
 assert.ok(fit.originalSelected.metrics.rmse>.01);
 const wrong=investigateStiffness(rows,{...settings,nuisanceTerms:['bias','command','rate'],cubicOrigin:0});
 assert.ok(wrong.selected.metrics.rmse>.01);assert.equal(wrong.profile.find(p=>p.family==='cubic').origin,0);
});

test('default family and saved version remain unchanged until explicit expansion',()=>{
 const original=smooth(),input=experimentInputs(original);
 assert.equal(input.schema,'worldlaw.stiffness-experiment/v1');assert.ok(!Object.hasOwn(input,'revisions'));
 assert.equal(original.study.fit.schema,'worldlaw.stiffness-investigation/v1');
 assert.ok(original.study.fit.candidates.every(m=>m.family!=='cubic'));
 assert.equal(original.plan.status,'model_mismatch');
 const expanded=addStiffnessCubicRevision(original,0,'Test the declared smooth alternative.');
 assert.equal(expanded.schema,'worldlaw.stiffness-experiment/v2');
 assert.equal(expanded.revisionEvidence.before.adequacy,'training_mismatch');
 assert.equal(expanded.study.fit.selected.family,'cubic');assert.ok(expanded.study.fit.selected.metrics.rmse<.006);
 assert.ok(expanded.study.checks.find(c=>c.family==='cubic').rmse<.003);
 assert.equal(expanded.revisionEvidence.at,0);assert.equal(original.schema,'worldlaw.stiffness-experiment/v1');
});

test('late family expansion retains exact earlier requests, observed errors and source inputs',()=>{
 let original=observe(smooth(),2,'before-1');original=observe(original,3,'before-2');
 const history=JSON.stringify(original.history),initial=JSON.stringify(original.initial),acquisitions=JSON.stringify(original.acquisitions);
 const pending=setPendingStiffnessRequest(original,0),oldRequest=pending.pending;
 let revised=addStiffnessCubicRevision(pending,0,'Original explanations miss the observed smooth response.');
 assert.equal(revised.pending,null);assert.equal(revised.revisionEvidence.at,2);
 assert.equal(JSON.stringify(revised.history),history);assert.equal(JSON.stringify(revised.initial),initial);
 assert.equal(JSON.stringify(revised.acquisitions),acquisitions);
 assert.throws(()=>receiveStiffnessObservation(revised,oldRequest,{id:'stale'}),/stale|modified/);
 revised=observe(revised,0,'after-1');
 assert.equal(JSON.stringify(revised.history.slice(0,2)),history);
 assert.equal(revised.history[2].request.schema,'worldlaw.stiffness-request/v2');
 assert.ok(revised.history[2].request.predictions.some(p=>p.family==='cubic'&&p.origin===0));
 assert.deepEqual(importStiffnessExperiment(exportStiffnessExperiment(revised)),revised);
 assert.throws(()=>addStiffnessCubicRevision(revised,.2,'Change the past.'),/already records/);
});

test('check values never choose family fits, revision evidence, plans, pending forecasts or earlier errors',()=>{
 let original=addStiffnessCubicRevision(observe(smooth(),2,'before'),0,'Explicit declared alternative.');
 original=observe(original,0,'after');original=setPendingStiffnessRequest(original,7);
 const input=experimentInputs(original);input.initial.dataset.heldOut=input.initial.dataset.heldOut.map(r=>({...r,jointTorque:999}));
 const changed=replayStiffnessExperiment(input);
 for(const key of ['history','pending','plan','revisionEvidence'])assert.deepEqual(changed[key],original[key]);
 assert.deepEqual(changed.study.fit,original.study.fit);assert.ok(changed.study.checks[0].rmse>990);
});

test('linear and weak-curvature controls retain complexity preference and family ambiguity',()=>{
 const rows=Array.from({length:21},(_,i)=>{const position=(i-10)/10;return{...state(position),jointTorque:.2-1.3*position}});
 const fit=investigateStiffness(rows,{...settings,cubicOrigin:0,noiseSigma:.02});
 assert.equal(fit.selected.family,'global');assert.equal(fit.status,'structure_ambiguous');
 assert.ok(fit.competitive.some(m=>m.family==='cubic'));
 const weak=investigateStiffness(rows.map(r=>({...r,jointTorque:r.jointTorque+1e-5*r.position**3})),{...settings,cubicOrigin:0,noiseSigma:.02});
 assert.equal(weak.selected.family,'global');assert.equal(weak.status,'structure_ambiguous');
});

test('distinct-angle and joint numerical rank failures remain explicit',()=>{
 const repeated=Array.from({length:30},(_,i)=>({...state(i%3-1),jointTorque:i%3}));
 const insufficient=investigateStiffness(repeated,{...settings,cubicOrigin:0});
 assert.equal(insufficient.profile.find(p=>p.family==='cubic').status,'insufficient_distinct_positions');
 const rows=Array.from({length:21},(_,i)=>{const position=(i-10)/10;return{...state(position),command:position,jointTorque:1-position-position**3}});
 const rank=investigateStiffness(rows,{...settings,nuisanceTerms:['bias','command'],cubicOrigin:0});
 assert.equal(rank.status,'unidentifiable');assert.ok(rank.profile.every(p=>p.status==='rank_deficient'));
});

test('omitted fifth-order response still falsifies the expanded finite family',()=>{
 const rows=Array.from({length:41},(_,i)=>{const position=(i-20)/20;return{...state(position),jointTorque:.3-1.2*position-8*position**5}});
 const fit=investigateStiffness(rows,{...settings,cubicOrigin:0,noiseSigma:.02});
 assert.equal(fit.diagnostics.adequacy,'training_mismatch');assert.ok(fit.selected.metrics.rmse>.06);
});

test('versioned input-only study export and imported expanded study preserve the explicit origin',()=>{
 const source=smooth().study,study=createStiffnessStudy(source.dataset,{...source.settings,cubicOrigin:.25});
 const raw=JSON.parse(exportStiffnessStudy(study));assert.equal(raw.schema,'worldlaw.stiffness-notebook/v2');
 assert.deepEqual(importStiffnessStudy(JSON.stringify(raw)),study);
 raw.schema='worldlaw.stiffness-notebook/v1';assert.throws(()=>importStiffnessStudy(JSON.stringify(raw)),/version/);
 const old=JSON.parse(exportStiffnessStudy(source));old.schema='worldlaw.stiffness-notebook/v2';
 assert.throws(()=>importStiffnessStudy(JSON.stringify(old)),/version/);
});

test('malformed, repeated, future-boundary and silently downgraded revision records refuse',()=>{
 const input=experimentInputs(addStiffnessCubicRevision(observe(smooth(),2,'before'),0,'A declared alternative.'));
 const variants=[v=>delete v.revisions,v=>v.revisions=[],v=>v.revisions.push({...v.revisions[0]}),
  v=>v.revisions[0].at=-1,v=>v.revisions[0].at=.5,v=>v.revisions[0].at=2,
  v=>v.revisions[0].kind='arbitrary polynomial',v=>v.revisions[0].origin=null,v=>v.revisions[0].origin=Infinity,
  v=>v.revisions[0].origin=1e6+1,v=>v.revisions[0].reason='',v=>v.revisions[0].reason='x'.repeat(241),
  v=>v.revisions[0].conclusion='truth',v=>v.schema='worldlaw.stiffness-experiment/v1',v=>v.cachedFit={}];
 for(const change of variants){const copy=structuredClone(input);change(copy);assert.throws(()=>replayStiffnessExperiment(copy));}
 const disguised=structuredClone(input);disguised.initial.schema='worldlaw.stiffness-notebook/v2';disguised.initial.settings.cubicOrigin=0;
 assert.throws(()=>replayStiffnessExperiment(disguised),/initial experiment/);
});

test('canonical freeze refuses tampered history boundaries and ignores substituted cached fits',()=>{
 const revised=addStiffnessCubicRevision(observe(smooth(),2,'before'),0,'A declared alternative.');
 const expected=freezeStiffnessRequest(revised,0),cached=structuredClone(revised);
 cached.study.fit.selected.terms[0].coefficient=999;assert.deepEqual(freezeStiffnessRequest(cached,0),expected);
 const moved=structuredClone(revised);moved.revisions[0].at=0;
 assert.throws(()=>freezeStiffnessRequest(moved,0),/modified/);
 const history=structuredClone(revised);history.history[0].errors[0].residual=123;
 assert.throws(()=>freezeStiffnessRequest(history,0),/modified/);
});

test('expanded replay fit-work budget remains enforced before sequential replay',()=>{
 const input=experimentInputs(addStiffnessCubicRevision(smooth(),0,'A declared alternative.'));
 input.initial.settings.knots=Array.from({length:101},(_,i)=>-.9+i*.018);
 input.initial.dataset.observations=Array.from({length:1000},(_,i)=>({...state((i%100)/50-1),jointTorque:0}));
 input.acquisitions=Array.from({length:20},(_,i)=>({id:'a'+i,index:0,source:{label:'bounded authored control',declaredKind:'authored'},observation:{...input.permitted[0],jointTorque:0}}));
 assert.throws(()=>replayStiffnessExperiment(input),/fit-work budget/);
});
