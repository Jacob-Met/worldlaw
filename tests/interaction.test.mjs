import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,refitSession,appendMeasurements,exportSession,restoreSession,undoSession,sessionPlan} from '../src/session.mjs';
import {predict,simulate,DEFAULT_TERMS} from '../src/science/torque-discovery.mjs';
import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';
const sample=(command,position)=>({command,position,rate:0,jointTorque:2*command-3*position+command*position});
const dataset={source:{label:'Authored interaction control; not measured'},observations:[-1,0,1].flatMap(u=>[-1,0,1].map(p=>sample(u,p))),heldOut:[-.75,.25,.8].flatMap(u=>[-.6,.4,.9].map(p=>sample(u,p)))};
test('explicit revision retains failed baseline, separate heldout evidence and executable dynamics',()=>{
 const start=createSession(dataset),next=refitSession(start,{includeCommandPosition:true});
 assert.equal(DEFAULT_TERMS.includes('command_position'),false);
 assert.equal(start.discovery.selected.id,'command+spring');
 assert.ok(start.history[0].heldOutRMSE>.4);
 assert.equal(next.discovery.selected.id,'command+spring+command_position');
 assert.ok(next.history[1].heldOutRMSE<1e-12);
 assert.deepEqual(next.history[0],start.history[0]);
 assert.deepEqual(next.discovery.observations,start.discovery.observations);
 const contaminated=createSession({...dataset,heldOut:dataset.heldOut.map(row=>({...row,jointTorque:1e6}))},{includeCommandPosition:true});
 assert.deepEqual(contaminated.discovery.selected.terms,next.discovery.selected.terms);
 const trace=simulate(next.discovery.selected,{position:.5,rate:0},{duration:.4,dt:.01,inertia:1,command:.25});
 // Independent analytic solution for theta''=.5-2.75theta.
 const equilibrium=.5/2.75,w=Math.sqrt(2.75);
 assert.ok(Math.abs(trace.at(-1).position-(equilibrium+(.5-equilibrium)*Math.cos(w*.4)))<1e-9);
 assert.ok(Math.abs(trace.at(-1).rate-(-(.5-equilibrium)*w*Math.sin(w*.4)))<1e-9);
 const plan=sessionPlan(next);assert.ok(plan.ranked.length>0);
 for(const row of plan.ranked)for(const p of row.predictions)assert.equal(p.value,predict(next.discovery.competitive.find(m=>m.id===p.modelId),row.input));
});
test('interaction history requires explicit newer envelope and survives append, disable, undo and replay',()=>{
 const start=createSession(dataset),enabled=refitSession(start,{includeCommandPosition:true});
 const appended=appendMeasurements(enabled,[sample(.5,.2)]),disabled=refitSession(appended,{includeCommandPosition:false});
 assert.equal(JSON.parse(exportSession(start)).schema,'worldlaw.session/v1');
 for(const state of [enabled,appended,disabled]){
  const text=exportSession(state),raw=JSON.parse(text);
  assert.equal(raw.schema,'worldlaw.session/v2');
  assert.deepEqual(restoreSession(text).history,state.history);
  assert.equal(Object.hasOwn(raw.events[0].options,'terms'),false);
  raw.schema='worldlaw.session/v1';assert.throws(()=>restoreSession(JSON.stringify(raw)),/v2/);
 }
 assert.deepEqual(undoSession(disabled).history,appended.history);
 assert.deepEqual(undoSession(enabled).history,start.history);
 assert.throws(()=>refitSession(start,{includeCommandPosition:'true'}),/boolean/);
});
test('interaction enclosure includes signed coordinate products, including position refinement',()=>{
 const models=[{schema:'worldlaw.torque-model/v1',terms:[{id:'command_position',coefficient:1}]},{schema:'worldlaw.torque-model/v1',terms:[{id:'command_position',coefficient:-2},{id:'spring',coefficient:3},{id:'cubic',coefficient:.5}]}];
 const exact=inspectInputEnclosures(models[0],[{command:2,position:3,rate:0,jointTorque:6}],{command:0,position:0,rate:0,jointTorque:0});
 assert.equal(exact.excludedCount,0);assert.ok(exact.rows[0].prediction[0]<=6&&exact.rows[0].prediction[1]>=6);
 for(const model of models)for(const command of [-2,0,2])for(const position of [-2,0,2])for(const radius of [0,.5,3]){
  const row={command,position,rate:0,jointTorque:predict(model,{command,position,rate:0})};
  for(const refinementSegments of [0,1,4,16,64]){
   const result=inspectInputEnclosures(model,[row],{command:radius,position:radius,rate:0,jointTorque:0},{refinementSegments});
   const [lo,hi]=result.rows[0].prediction;
   for(const u of [command-radius,command,command+radius])for(const p of [position-radius,position,position+radius]){
    const value=predict(model,{command:u,position:p,rate:0});assert.ok(lo<=value&&value<=hi,JSON.stringify({model,row,radius,refinementSegments,lo,hi,value}));
   }
  }
 }
});
test('admitting interaction does not force it, and constant-command alias remains unidentified',()=>{
 const additive={...dataset,observations:dataset.observations.map(r=>({...r,jointTorque:2*r.command-3*r.position})),heldOut:[]};
 const state=createSession(additive,{includeCommandPosition:true});
 assert.equal(state.discovery.selected.id,'command+spring');
 assert.equal(state.discovery.selected.terms.some(t=>t.id==='command_position'),false);
 const alias={source:{label:'Authored constant-command alias'},observations:Array.from({length:12},(_,i)=>sample(2,-1+i/5)),heldOut:[]};
 const aliased=createSession(alias,{includeCommandPosition:true});
 assert.equal(aliased.discovery.diagnostics.identifiability,'insufficient_excitation');
 assert.equal(aliased.discovery.diagnostics.selectionAmbiguous,true);
 assert.ok(aliased.discovery.competitive.some(m=>m.terms.some(t=>t.id==='command_position')));
 assert.ok(aliased.discovery.competitive.some(m=>!m.terms.some(t=>t.id==='command_position')));
});
