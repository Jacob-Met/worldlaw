import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_ROWS,MAX_TEXT_LENGTH} from '../src/data.mjs';
import {createStiffnessStudy} from '../src/stiffness/notebook.mjs';
import {stiffnessExperimentCourse,observeStiffnessCourse} from '../src/stiffness/experiment-fixture.mjs';
import {
  planStiffness,normalizePermittedStates,createStiffnessExperiment,
  freezeStiffnessRequest,setPendingStiffnessRequest,setPermittedStiffnessStates,receiveStiffnessObservation,
  experimentInputs,replayStiffnessExperiment,exportStiffnessExperiment,importStiffnessExperiment,
} from '../src/stiffness/experiment.mjs';

const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from independent expected ${b}`);
const state=position=>({command:0,position,rate:0});
const row=(position,jointTorque=1+2*position)=>({...state(position),jointTorque});
const observations=Array.from({length:9},(_,i)=>row((i-4)/2));
const settings={knots:[0],nuisanceTerms:['bias'],noiseSigma:1,ambiguityDelta:100};
const permitted=[state(3),state(-3),state(0)];
const study=(heldOut=[])=>createStiffnessStudy({observations,heldOut,source:{label:'Independent exact straight-line control',kind:'authored'}},settings);
const session=()=>createStiffnessExperiment(study(),permitted);
const reading=(id,index,torque)=>({id,source:{label:'Independent authored response',declaredKind:'authored-control'},observation:{...permitted[index],jointTorque:torque}});
const coefficient=(fit,id)=>fit.baseline.terms.find(t=>t.id===id).coefficient;

// Independent executable models make ranking arithmetic analytically known,
// without relying on the regression under test to generate its own oracle.
function analyticFit(){
  const global={schema:'worldlaw.stiffness-model/v1',family:'global',knot:null,terms:[{id:'position',coefficient:1}]};
  const kink={schema:'worldlaw.stiffness-model/v1',family:'piecewise',knot:0,terms:[{id:'position',coefficient:1},{id:'hinge',coefficient:2}]};
  return {schema:'worldlaw.stiffness-investigation/v1',competitive:[global,kink],selected:global,
    domain:{position:{min:-1,max:1},command:{min:0,max:0},rate:{min:0,max:0}},
    settings:{noiseSigma:.5},diagnostics:{adequacy:'not_falsified_on_training'}};
}

test('finite permitted-state spread ranking and ties match analytic torques',()=>{
  const offered=[state(-2),state(2),state(1),{command:1,position:2,rate:0}];
  const a=planStiffness(analyticFit(),offered);
  assert.equal(a.status,'proposed');assert.equal(a.selected.index,1);
  assert.deepEqual(a.ranked.map(r=>r.index),[1,3,2,0]);
  assert.deepEqual(a.ranked.map(r=>r.spread),[4,4,2,0]);
  assert.deepEqual(a.ranked[0].predictions.map(p=>p.torque),[2,6]);
  assert.deepEqual(a.ranked[0].extrapolated,['position']);
  assert.deepEqual(a.ranked[1].extrapolated,['command','position']);
  assert.deepEqual(a.selected.state,offered[1]);
});

test('heuristic boundary, mismatch, singleton and empty/unidentifiable sets withhold recommendations',()=>{
  const fit=analyticFit();fit.settings.noiseSigma=2;
  const equality=planStiffness(fit,[state(2)]);
  assert.equal(equality.ranked[0].spread,4);assert.equal(equality.threshold,4);
  assert.equal(equality.status,'uninformative');assert.equal(equality.selected,null);
  fit.settings.noiseSigma=.5;fit.diagnostics.adequacy='training_mismatch';
  assert.equal(planStiffness(fit,[state(2)]).status,'model_mismatch');
  fit.diagnostics.adequacy='not_falsified_on_training';fit.competitive=[fit.selected];
  assert.equal(planStiffness(fit,[state(2)]).status,'uninformative');
  fit.selected=null;fit.competitive=[];
  assert.equal(planStiffness(fit,[state(2)]).status,'unidentifiable');
  assert.equal(planStiffness(fit,[]).status,'no_permitted_inputs');
});

test('permitted input admission is explicit, bounded and normalized before duplicate detection',()=>{
  assert.deepEqual(normalizePermittedStates([{rate:0,position:1,command:0}]),[state(1)]);
  assert.throws(()=>normalizePermittedStates([state(1),{rate:0,command:0,position:1}]),/distinct/);
  assert.throws(()=>normalizePermittedStates([state(0),{...state(0),position:-0}]),/distinct/);
  assert.throws(()=>normalizePermittedStates([{...state(1),jointTorque:5}]),/unsupported/);
  assert.throws(()=>normalizePermittedStates([{position:1,command:0}]),/finite/);
  assert.throws(()=>normalizePermittedStates([state(Infinity)]),/finite/);
  assert.throws(()=>normalizePermittedStates(Array.from({length:513},(_,i)=>state(i))),/512/);
});

test('two actual sequential receipts score frozen forecasts before each analytic refit',()=>{
  const initial=session(),armed=setPendingStiffnessRequest(initial,0);
  const before=structuredClone(armed),request=armed.pending;
  const globalForecast=request.predictions.find(p=>p.family==='global');close(globalForecast.torque,7);
  const after=receiveStiffnessObservation(armed,request,reading('first',0,9));
  assert.deepEqual(armed,before,'receiving must not mutate the prior session');
  assert.equal(after.pending,null);assert.equal(after.study.dataset.observations.length,10);
  close(after.history[0].errors.find(p=>p.family==='global').residual,2);
  // Closed-form OLS from ten independent rows: sum x=3, sum y=18,
  // sum x²=24, sum xy=57. No fitted result is used as the oracle.
  close(coefficient(after.study.fit,'position'),172/77);
  close(coefficient(after.study.fit,'bias'),87/77);
  const second=setPendingStiffnessRequest(after,1);
  close(second.pending.predictions.find(p=>p.family==='global').torque,-429/77);
  const final=receiveStiffnessObservation(second,second.pending,reading('second',1,-5));
  close(final.history[1].errors.find(p=>p.family==='global').residual,44/77);
  close(final.history[0].errors.find(p=>p.family==='global').residual,2);
  // With symmetric ±3 additions: sum x=0, sum y=13, sum x²=33, sum xy=72.
  close(coefficient(final.study.fit,'position'),24/11);
  close(coefficient(final.study.fit,'bias'),13/11);
  assert.deepEqual(final.acquisitions.map(a=>a.id),['first','second']);
});

test('future-check changes alter evaluation only, never plans or frozen forecasts',()=>{
  const a=createStiffnessExperiment(study([row(10,21)]),permitted);
  const b=createStiffnessExperiment(study([row(-100,-999)]),permitted);
  assert.deepEqual(a.study.fit,b.study.fit);assert.deepEqual(a.plan,b.plan);
  assert.deepEqual(freezeStiffnessRequest(a,0),freezeStiffnessRequest(b,0));
  assert.notDeepEqual(a.study.checks,b.study.checks);
  const aa=setPendingStiffnessRequest(a,0),bb=setPendingStiffnessRequest(b,0);
  const nextA=receiveStiffnessObservation(aa,aa.pending,reading('one',0,9));
  const nextB=receiveStiffnessObservation(bb,bb.pending,reading('one',0,9));
  assert.deepEqual(nextA.history,nextB.history);assert.deepEqual(nextA.plan,nextB.plan);
});

test('unarmed, modified and stale requests are refused without appending observations',()=>{
  const a=session(),unarmed=freezeStiffnessRequest(a,0);
  assert.throws(()=>receiveStiffnessObservation(a,unarmed,reading('one',0,9)),/currently frozen/);
  const armed=setPendingStiffnessRequest(a,0),before=structuredClone(armed);
  for(const mutate of [r=>r.predictions[0].torque+=1,r=>r.state.position+=1,r=>r.binding+='x',r=>r.revision++,r=>r.extra=true]){
    const request=structuredClone(armed.pending);mutate(request);
    assert.throws(()=>receiveStiffnessObservation(armed,request,reading('one',0,9)),/stale or modified/);
  }
  assert.deepEqual(armed,before);
  const received=receiveStiffnessObservation(armed,armed.pending,reading('one',0,9));
  const rearmed=setPendingStiffnessRequest(received,1);
  assert.throws(()=>receiveStiffnessObservation(rearmed,armed.pending,reading('two',0,9)),/stale or modified/);
});

test('duplicate acquisition IDs and mismatched observation coordinates are refused',()=>{
  const armed=setPendingStiffnessRequest(session(),0);
  const wrong=reading('one',0,9);wrong.observation.position=3.000001;
  assert.throws(()=>receiveStiffnessObservation(armed,armed.pending,wrong),/coordinates differ/);
  const valid=receiveStiffnessObservation(armed,armed.pending,reading('one',0,9));
  const rearmed=setPendingStiffnessRequest(valid,1);
  assert.throws(()=>receiveStiffnessObservation(rearmed,rearmed.pending,reading('one',1,-5)),/IDs must be unique/);
  const forged=experimentInputs(valid);forged.acquisitions[0].source.claimedAccuracy='verified';
  assert.throws(()=>replayStiffnessExperiment(forged),/unsupported field/);
});

test('input-only experiment replay rebuilds history, pending forecasts and final fits',()=>{
  const a=setPendingStiffnessRequest(session(),0);
  const b=setPendingStiffnessRequest(receiveStiffnessObservation(a,a.pending,reading('one',0,9)),1);
  const expected=structuredClone(b);
  b.history[0].errors[0].residual=123456;b.study.fit.selected.metrics.rmse=999;b.pending.predictions[0].torque=-999;
  const serialized=exportStiffnessExperiment(b),raw=JSON.parse(serialized);
  assert.deepEqual(Object.keys(raw).sort(),['acquisitions','initial','pending','permitted','schema']);
  const reopened=importStiffnessExperiment(serialized);
  assert.deepEqual(reopened,expected);
  assert.throws(()=>replayStiffnessExperiment({...raw,history:expected.history}),/unsupported field/);
  const claimed=structuredClone(raw);claimed.initial.fit={selected:'trusted'};
  assert.throws(()=>replayStiffnessExperiment(claimed),/input-only/);
  const invalidPending=structuredClone(raw);invalidPending.pending=permitted.length;
  assert.throws(()=>replayStiffnessExperiment(invalidPending),/permitted state/);
});

test('acquisition, text and fitted-row ceilings refuse oversized replay',()=>{
  const input=experimentInputs(session());
  const acquisition=i=>({...reading('r'+i,0,9),index:0});
  assert.throws(()=>replayStiffnessExperiment({...input,acquisitions:Array.from({length:33},(_,i)=>acquisition(i))}),/32 sequential/);
  assert.throws(()=>importStiffnessExperiment(' '.repeat(MAX_TEXT_LENGTH+1)),/below 2 MB/);
  const full=structuredClone(input);full.initial.dataset.observations=Array.from({length:MAX_ROWS},(_,i)=>row((i%9-4)/2));full.acquisitions=[acquisition(0)];
  assert.throws(()=>replayStiffnessExperiment(full),/maintained observation bound/);
});

test('aggregate fit-work bound refuses before replaying a long sequential course',()=>{
  const input=experimentInputs(session());
  input.initial.dataset.observations=Array.from({length:1000},(_,i)=>row((i%41-20)/10));
  input.initial.settings.knots=Array.from({length:101},(_,i)=>(i-50)/50);
  input.acquisitions=Array.from({length:20},(_,i)=>({...reading('work-'+i,0,9),index:0}));
  assert.ok(21*1020*102>2_000_000);
  assert.throws(()=>replayStiffnessExperiment(input),/fit-work budget/);
});

test('permitted declaration cannot retroactively change frozen historical planning context',()=>{
  const declared=[state(-.7)],expanded=[...declared,state(0)];
  const initial=createStiffnessExperiment(stiffnessExperimentCourse().study,declared);
  const armed=setPendingStiffnessRequest(initial,0);
  assert.equal(armed.pending.planStatus,'uninformative');
  const editable=setPermittedStiffnessStates(armed,expanded);
  assert.equal(editable.pending,null);assert.deepEqual(editable.permitted,expanded);
  assert.equal(editable.plan.status,'proposed');
  const received=receiveStiffnessObservation(armed,armed.pending,{id:'context-control',
    source:{label:'Authored declaration-history control',declaredKind:'synthetic'},
    observation:{...declared[0],jointTorque:observeStiffnessCourse('kink',declared[0])}});
  const before=structuredClone(received);
  // An unacquired alternative changes historical plan status despite identical torques.
  const rewritten=replayStiffnessExperiment({...experimentInputs(received),permitted:expanded});
  assert.equal(rewritten.history[0].request.planStatus,'proposed');
  assert.deepEqual(rewritten.history[0].request.predictions,received.history[0].request.predictions);
  assert.throws(()=>setPermittedStiffnessStates(received,expanded),/frozen after the first acquisition/);
  assert.deepEqual(received,before);
  assert.deepEqual(setPermittedStiffnessStates(received,declared).history,received.history);
});
