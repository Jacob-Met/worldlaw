import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,planExperiment,revise,evaluate,DEFAULT_TERMS} from '../src/science/torque-discovery.mjs';
import {planInputExcitation,MAX_PILOT_RANK_WORK} from '../src/science/input-excitation.mjs';
import {validateDataset,validateOfferedInputs,OFFERED_INPUT_SCHEMA} from '../src/data.mjs';
import {createSession,sessionPlan,sessionPilotPlan,appendMeasurements,exportSession,restoreSession,undoSession,runVirtualExperiment,newVirtualSession,refitSession} from '../src/session.mjs';

const truth=p=>1.3*p.command-.7*p.position-.25*p.rate;
function training(count=40){return Array.from({length:count},(_,i)=>{
  const p={command:0,position:2.7*Math.sin(i*1.7+.2),rate:1.6*Math.sin(i*.83+.4)};
  return {...p,jointTorque:truth(p)};
});}
const offered=()=>[{command:0,position:1.3,rate:.7},{command:1.2,position:.3,rate:.4},{command:0,position:1.9,rate:-.6}];
function receiving(){return Array.from({length:31},(_,i)=>{
  const p={command:.9*Math.sin(i*.43+.6),position:2.5*Math.sin(i*.91+.7),rate:1.3*Math.cos(i*1.11+.3)};
  return {...p,jointTorque:truth(p)};
});}
const dataset=()=>({schema:OFFERED_INPUT_SCHEMA,source:{label:'Authored unexcited-command control'},observations:training(),heldOut:receiving(),offeredInputs:offered()});
const measurement=p=>({...p,jointTorque:truth(p)});

test('a rank-restoring pilot enables the unchanged fitter where nominal disagreement is uninformative',()=>{
  const rows=training(),inputs=offered(),d=discover(rows),ordinary=planExperiment(d,inputs);
  const pilot=planInputExcitation(rows,d.options.terms,inputs);
  assert.equal(ordinary.status,'uninformative');assert.equal(ordinary.selected.index,0);
  assert.equal(pilot.currentRank,6);assert.equal(pilot.librarySize,7);
  assert.equal(pilot.status,'proposed');assert.equal(pilot.selected.index,1);
  assert.deepEqual(pilot.outcomes.map(row=>row.prospectiveRank),[6,7,6]);
  const old=revise(d,[measurement(ordinary.selected.input)]),next=revise(d,[measurement(pilot.selected.input)]);
  assert.ok(evaluate(old.selected,receiving()).rmse>.8);
  assert.ok(evaluate(next.selected,receiving()).rmse<1e-12);
  assert.equal(next.selected.id,'command+rate+spring');
});

test('selection uses coordinates alone and cannot use actual or forged prospective readings',()=>{
  const original=planInputExcitation(training(),DEFAULT_TERMS,offered());
  const changed=training().map((row,i)=>({...row,jointTorque:10000*Math.cos(i*.7)}));
  assert.deepEqual(planInputExcitation(changed,DEFAULT_TERMS,offered()),original);
  assert.throws(()=>planInputExcitation(training(),DEFAULT_TERMS,[{...offered()[1],jointTorque:999}]),/no future torque/);
  const first=createSession(dataset()),second=createSession({...dataset(),heldOut:receiving().map(row=>({...row,jointTorque:999}))});
  assert.deepEqual(sessionPilotPlan(first),sessionPilotPlan(second));
});

test('nonzero column confounding is resolved by an off-relation state, not another on-relation sample',()=>{
  const rows=Array.from({length:17},(_,i)=>({command:2*(i-8)/8,position:(i-8)/8,rate:0,jointTorque:i}));
  const p=planInputExcitation(rows,['command','spring'],[{command:1,position:.5,rate:0},{command:1,position:0,rate:0}]);
  assert.equal(p.currentRank,1);assert.deepEqual(p.outcomes.map(x=>x.prospectiveRank),[1,2]);
  assert.equal(p.selected.index,1);
});

test('one new row may leave directions unresolved and rank gain never certifies an adequate law',()=>{
  const rows=Array.from({length:8},()=>({command:0,position:0,rate:0,jointTorque:2}));
  const p=planInputExcitation(rows,['command','spring','bias'],[{command:1,position:0,rate:0}]);
  assert.equal(p.currentRank,1);assert.equal(p.selected.prospectiveRank,2);assert.equal(p.selected.missingDirections,1);
  const source=dataset();source.observations=source.observations.map(row=>({...row,jointTorque:truth(row)+.3*row.position**3}));
  const s=createSession(source),pilot=sessionPilotPlan(s),row=pilot.selected.input;
  const next=appendMeasurements(s,[{...row,jointTorque:truth(row)+.3*row.position**3}]);
  assert.equal(next.discovery.diagnostics.fullLibraryRank,7);
  assert.equal(next.discovery.diagnostics.adequacy,'residual_mismatch');
  assert.equal(sessionPilotPlan(next).status,'already_excited');
});

test('no useful offers, no offers and a complete design remain separate unresolved/not-needed outcomes',()=>{
  const p=planInputExcitation(training(),DEFAULT_TERMS,[offered()[0],offered()[2]]);
  assert.equal(p.status,'no_rank_gain');assert.equal(p.selected,null);assert.equal(p.examinedOffers,2);
  assert.equal(planInputExcitation(training(),DEFAULT_TERMS,[]).status,'no_offered_inputs');
  const full=planInputExcitation(training(),['rate','spring'],offered());
  assert.equal(full.status,'already_excited');assert.equal(full.selected,null);assert.equal(full.examinedOffers,0);
});

test('extreme rescaling that loses previous numerical directions cannot qualify as a pilot',()=>{
  const p=planInputExcitation(training(),['command','quadratic','cubic','bias'],[{command:1e6,position:1e6,rate:1e6}]);
  assert.equal(p.currentRank,3);assert.equal(p.status,'numerical_rescaling');
  assert.ok(p.outcomes[0].prospectiveRank<3);assert.equal(p.selected,null);
});

test('the complete prospective course is refused before partial ranking when the work bound is exceeded',()=>{
  const inputs=Array.from({length:128},(_,i)=>({command:1+i/128,position:.2,rate:.4}));
  const p=planInputExcitation(training(4096),[...DEFAULT_TERMS,'command_position','cubic'],inputs);
  assert.ok(p.estimatedRankWork>MAX_PILOT_RANK_WORK);assert.equal(p.status,'work_limit');
  assert.equal(p.examinedOffers,0);assert.deepEqual(p.outcomes,[]);assert.equal(p.selected,null);
});

test('input admission binds the explicit newer source format and preserves an empty offered set',()=>{
  const raw=dataset(),admitted=validateDataset(raw);
  assert.equal(admitted.schema,OFFERED_INPUT_SCHEMA);assert.deepEqual(admitted.offeredInputs,raw.offeredInputs);
  assert.throws(()=>validateDataset({...raw,schema:'worldlaw.observations/v1'}),/require.*v2/);
  assert.throws(()=>validateDataset({...raw,offeredInputs:undefined}),/offered input states/);
  const missing={...raw};delete missing.offeredInputs;assert.throws(()=>validateDataset(missing),/must declare/);
  const empty=createSession({...raw,offeredInputs:[]});
  assert.equal(sessionPlan(empty).selected,null);assert.equal(sessionPilotPlan(empty).status,'no_offered_inputs');
  assert.throws(()=>validateOfferedInputs([offered()[0],offered()[0]]),/repeats/);
  assert.throws(()=>validateOfferedInputs(Array(129).fill(offered()[0])),/at most 128/);
  for(const bad of [NaN,Infinity,'1',1e6+1,null])assert.throws(()=>validateOfferedInputs([{...offered()[0],command:bad}]),/must be finite/);
});

test('returned reports and admitted source rows have no writable aliases to caller inputs',()=>{
  const rows=training(),inputs=offered(),raw=dataset(),source=validateDataset(raw);
  const p=planInputExcitation(rows,DEFAULT_TERMS,inputs);
  p.selected.input.command=9;p.terms.reverse();p.domain.position.min=999;
  assert.equal(inputs[1].command,1.2);assert.deepEqual(rows,training());
  source.offeredInputs[1].command=7;source.observations[0].jointTorque=999;
  assert.equal(raw.offeredInputs[1].command,1.2);assert.equal(raw.observations[0].jointTorque,training()[0].jointTorque);
});

test('recording, input-only reopen and undo retain exact offers and exclude only already observed states',()=>{
  let s=createSession(dataset());const before=exportSession(s),p=sessionPilotPlan(s);
  assert.equal(exportSession(s),before);assert.equal(s.events.length,0);
  assert.equal(sessionPlan(s).selected.index,0);assert.equal(p.selected.sourceIndex,1);
  assert.throws(()=>runVirtualExperiment(s,p.selected.input),/only in the virtual instrument/);
  s=appendMeasurements(s,[measurement(p.selected.input)]);
  const opened=restoreSession(exportSession(s));
  assert.deepEqual(opened.base.offeredInputs,dataset().offeredInputs);assert.equal(opened.events.length,1);
  assert.equal(sessionPilotPlan(opened).previouslyObservedCount,1);
  assert.equal(sessionPilotPlan(opened).status,'already_excited');
  assert.equal(sessionPilotPlan(undoSession(opened)).selected.sourceIndex,1);
  const forged=JSON.parse(exportSession(s));forged.discovery={selected:{id:'fabricated'}};
  assert.equal(restoreSession(JSON.stringify(forged)).discovery.selected.id,'command+rate+spring');
});

test('explicit offers retain full numeric precision and cannot override a seeded virtual instrument course',()=>{
  const raw=dataset();raw.offeredInputs=[{command:1.2345678901234567,position:.3123456789012345,rate:.4123456789012345}];
  const s=createSession(raw),p=sessionPilotPlan(s);
  assert.deepEqual(p.selected.input,raw.offeredInputs[0]);
  assert.deepEqual(restoreSession(exportSession(s)).base.offeredInputs,raw.offeredInputs);
  const virtual=newVirtualSession();
  assert.throws(()=>createSession({...virtual.base,schema:OFFERED_INPUT_SCHEMA,offeredInputs:offered()},virtual.options,{labSeed:virtual.lab.seed}),/fixed candidate course/);
  assert.equal(sessionPilotPlan(virtual).inputSource,'virtual_instrument_course');
  assert.equal(sessionPlan(virtual).status,'proposed');
});

test('interaction feature histories compose with offered-input source versioning without reading outputs',()=>{
  let s=createSession(dataset());s=refitSession(s,{includeCommandPosition:true});
  const raw=JSON.parse(exportSession(s));assert.equal(raw.schema,'worldlaw.session/v2');assert.equal(raw.base.schema,OFFERED_INPUT_SCHEMA);
  const reopened=restoreSession(JSON.stringify(raw));assert.deepEqual(sessionPilotPlan(reopened),sessionPilotPlan(s));
  assert.throws(()=>planInputExcitation(training(),['unknown'],offered()),/maintained scalar terms/);
  assert.throws(()=>planInputExcitation(training(),['command','command'],offered()),/unique library/);
});
