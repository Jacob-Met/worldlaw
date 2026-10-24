import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {DURATION_SCHEMA} from '../src/unknown-lab/duration-response.mjs';
import {freezeDurationAcquisition,receiveDurationAcquisition,validateDurationRequest,exportDurationAcquisition,importDurationAcquisition} from '../src/unknown-lab/duration-acquisition.mjs';
const settings={durations:[.5,1,2,4,8],contrastRadius:.01,pairs:32,overheadPerPair:.1,budgetSeconds:300};
const study=()=>({schema:DURATION_SCHEMA,runs:[.1,.2,.3].map((duration,i)=>({id:'r'+i,role:'training',duration,notebook:syntheticChallenge({duration,count:32,seed:100+i,noiseSigma:.005})}))});
const freeze=()=>freezeDurationAcquisition(study(),settings,{runId:'future',preparation:'Same reset, preparation and sensor arrangement as training.'});
const observation=(q,options={})=>({protocol:q.protocol,run:{id:q.protocol.runId,role:'challenge',duration:q.protocol.duration,notebook:syntheticChallenge({duration:q.protocol.duration,count:32,seed:501,noiseSigma:.005,...options})}});
const clone=x=>structuredClone(x);
test('frozen request receives independent outcomes and reopens exact input-only result',()=>{
 const q=freeze(),bytes=JSON.stringify(q),r=receiveDurationAcquisition(q,observation(q));
 assert.equal(r.qualification.status,'within-declared-plan');
 assert.equal(r.challenge.predictions.filter(p=>p.status==='compatible').length,1);
 assert.equal(r.challenge.predictions.find(p=>p.id==='saturation-1.3').status,'compatible');
 assert.equal(JSON.stringify(q),bytes);
 assert.deepEqual(importDurationAcquisition(exportDurationAcquisition(q,r.observation)).result,r);
 assert.equal(importDurationAcquisition(exportDurationAcquisition(q)).result,null);
});
test('all-family contradiction remains visible and does not refit or replace frozen hypotheses',()=>{
 const q=freeze(),r=receiveDurationAcquisition(q,observation(q,{effect:10}));
 assert.ok(r.challenge.predictions.every(p=>p.status==='contradicted'));
 assert.deepEqual(r.analysis.fit,receiveDurationAcquisition(q,observation(q)).analysis.fit);
 assert.deepEqual(r.request.forecast,q.forecast);
});
test('poor precision and unbalanced order retained rather than converted to successful discrimination',()=>{
 const q=freeze(),wide=receiveDurationAcquisition(q,observation(q,{noiseSigma:.5}));
 assert.equal(wide.qualification.status,'unqualified');assert.match(wide.qualification.reasons.join(' '),/radius/);
 const one=receiveDurationAcquisition(q,observation(q,{orderStrategy:'oneway'}));
 assert.equal(one.qualification.status,'unqualified');assert.ok(one.challenge.predictions.every(p=>p.status==='order-confounded'));
});
test('stale study, changed forecasts, protocol, run, count and recycled evidence refuse',()=>{
 const q=freeze(),changed=clone(q);changed.forecast.predictions[0].interval[0]+=1;
 assert.throws(()=>validateDurationRequest(changed),/forecasts/);
 const stale=study();stale.runs[0].notebook.trials[0].jointTorque+=1;
 assert.throws(()=>receiveDurationAcquisition(q,observation(q),stale),/study changed/);
 for(const patch of [{runId:'other'},{preparation:'different'},{duration:3},{pairs:8},{source:'measured'}]){
  const o=observation(q);o.protocol={...o.protocol,...patch};assert.throws(()=>receiveDurationAcquisition(q,o),/protocol/);
 }
 assert.throws(()=>receiveDurationAcquisition(q,observation(q,{count:16})),/count/);
 const o=observation(q);o.run.notebook=clone(q.study.runs[0].notebook);delete o.run.notebook.simulation;
 assert.throws(()=>receiveDurationAcquisition(q,o),/reused/);
});
test('measured source is retained and never acquires virtual metadata',()=>{
 const s=study();for(const r of s.runs){r.notebook.source='measured';delete r.notebook.simulation;}
 const q=freezeDurationAcquisition(s,settings,{runId:'instrument-run',preparation:'Declared controlled arrangement'}),o=observation(q);o.run.notebook.source='measured';delete o.run.notebook.simulation;
 const r=receiveDurationAcquisition(q,o);assert.equal(r.study.runs.at(-1).notebook.source,'measured');assert.equal(r.study.runs.at(-1).notebook.simulation,undefined);
});

test('JSON property order does not change protocol identity',()=>{
 const q=freeze(),o=observation(q);o.protocol=Object.fromEntries(Object.entries(o.protocol).reverse());
 assert.equal(receiveDurationAcquisition(q,o).qualification.status,'within-declared-plan');
});
