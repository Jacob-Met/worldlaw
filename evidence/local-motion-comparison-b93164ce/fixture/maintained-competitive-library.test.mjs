import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeScalarLibrary} from '../src/science/library-proposal.mjs';
import {createSession,refitSession,sessionPlan,sessionPilotPlan,appendMeasurements,exportSession,restoreSession} from '../src/session.mjs';
import {evaluate} from '../src/science/torque-discovery.mjs';
const rows=Array.from({length:97},(_,i)=>{const position=1.8*Math.sin((i+.23)*2.17),rate=1.3*Math.cos((i+.23)*1.43),command=position**2;return {position,rate,command,jointTorque:.8*command-.3*rate-1.2*position-.65*position**3};});
const offers=[{position:1.3,command:1.69,rate:.2},{position:1.3,command:0,rate:.2},{position:-1.3,command:0,rate:.2}];
const source={schema:'worldlaw.observations/v2',observations:rows,offeredInputs:offers};
const law=(row,kind)=>.8*row.command-.3*row.rate-1.2*row.position-.65*(kind==='cubic'?row.position**3:row.command*row.position);
const held=Array.from({length:61},(_,i)=>({position:1.7*Math.sin((i+.713)*1.77),rate:1.3*Math.cos((i+.713)*.93),command:Math.sin((i+.713)*2.13)}));
function apply(state,proposal){return refitSession(state,{includeCommandPosition:proposal.proposedTerms.includes('command_position'),additionalTerms:proposal.proposedTerms.filter(id=>['cubic','cosine','rate_squared'].includes(id))});}

test('an ambiguous revision preserves competing optional laws for the maintained planner',()=>{
 const state=createSession(source,{noiseSigma:.0001}),proposal=proposeScalarLibrary(rows,state.discovery.options);
 assert.deepEqual(proposal.selectedAddedTerms,['command_position']);
 assert.deepEqual(proposal.addedTerms,['command_position','cubic']);
 const revised=apply(state,proposal),plan=sessionPlan(revised),rank=sessionPilotPlan(revised);
 assert.equal(revised.discovery.competitive.length,2);assert.equal(plan.status,'proposed');
 assert.deepEqual(plan.selected.input,offers[1]);assert.ok(Math.abs(plan.selected.disagreement-1.42805)<1e-10);
 assert.equal(rank.currentRank,8);assert.equal(rank.librarySize,9);assert.equal(rank.selected.prospectiveRank,9);
 assert.equal(rank.outcomes[0].gain,0);
 const old=refitSession(state,{includeCommandPosition:true});assert.equal(sessionPlan(old).status,'uninformative');
 assert.deepEqual(sessionPlan(restoreSession(exportSession(revised))),plan);
});

test('separate authored readings resolve either law while wrong reading remains failure',()=>{
 const state=createSession(source,{noiseSigma:.0001}),proposal=proposeScalarLibrary(rows,state.discovery.options),revised=apply(state,proposal);
 const plan=sessionPlan(revised);
 for(const kind of ['cubic','interaction']){
  const next=appendMeasurements(revised,[{...plan.selected.input,jointTorque:law(plan.selected.input,kind)}]);
  assert.equal(next.discovery.selected.id,kind==='cubic'?'command+rate+spring+cubic':'command+rate+spring+command_position');
  assert.equal(next.discovery.competitive.length,1);
  assert.ok(evaluate(next.discovery.selected,held.map(row=>({...row,jointTorque:law(row,kind)}))).rmse<1e-10);
 }
 const wrong=appendMeasurements(revised,[{...plan.selected.input,jointTorque:123}]);
 assert.equal(wrong.discovery.diagnostics.adequacy,'residual_mismatch');
});

test('no separating offer means no informative experiment and held-out values cannot choose it',()=>{
 const state=createSession(source,{noiseSigma:.0001}),proposal=proposeScalarLibrary(rows,state.discovery.options);
 const narrow=apply(createSession({...source,offeredInputs:[offers[0]]},{noiseSigma:.0001}),proposal);
 assert.equal(sessionPlan(narrow).status,'uninformative');assert.equal(sessionPilotPlan(narrow).status,'no_rank_gain');
 const changed=createSession({...source,heldOut:held.map(row=>({...row,jointTorque:999}))},{noiseSigma:.0001});
 assert.deepEqual(proposeScalarLibrary(changed.discovery.observations,changed.discovery.options),proposal);
 assert.deepEqual(sessionPlan(apply(changed,proposal)),sessionPlan(apply(state,proposal)));
});
