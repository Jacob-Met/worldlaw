import test from 'node:test';import assert from 'node:assert/strict';
import {createSession,appendMeasurements,setPlanningBounds,exportSession,restoreSession,undoSession,refitSession} from '../src/session.mjs';
import {historicalTrainingContext,searchHistoricalTraining,checkHistoricalTraining} from '../src/science/historical-training.mjs';
const options={trainingRadius:.02,receivingRadius:.001,maxIterations:512,maxProducts:100000};
const radii={command:0,position:0,rate:0,jointTorque:.001};
const row=jointTorque=>({command:2,position:0,rate:0,jointTorque});
function fixture(values=[2.02]){const observations=Array.from({length:8},(_,i)=>({command:i%2?1:-1,position:0,rate:0,jointTorque:i%2?1:-1}));const s=setPlanningBounds(createSession({source:{label:'Authored prefix control'},observations,heldOut:[]},{maxTerms:1,noiseSigma:.001,ambiguityDelta:0}),radii);return appendMeasurements(s,values.map(row));}
const inspect=s=>searchHistoricalTraining(s,s.history.length-1,0,options);
test('fixed failure, one shared earlier-reading witness, and post-refit remain distinct',()=>{
 const s=fixture(),receipt=s.history.at(-1).experiment,saved=JSON.stringify(s);assert.equal(receipt.bounded.status,'all-excluded');assert.ok(receipt.after.rmse<receipt.before.rmse);const result=inspect(s);assert.equal(result.status,'verified-interior-witness');assert.equal(result.certificate.kind,'training-offsets');assert.equal(JSON.stringify(s),saved);assert.equal(historicalTrainingContext(s,2).training.length,8);
 assert.equal(checkHistoricalTraining(s,2,0,{trainingRadius:.02,receivingRadius:.001},result.certificate).status,result.status);
});
test('conflicting acquired course yields checked separation rather than a refitted rescue',()=>{const s=fixture([2.02,1.98]);assert.equal(s.history.at(-1).experiment.bounded.status,'all-excluded');assert.equal(inspect(s).status,'verified-separation');});
test('source replay is identical, future outcomes and held-out values cannot alter earlier context',()=>{
 const s=fixture(),r=inspect(s);assert.deepEqual(inspect(restoreSession(exportSession(s))),r);let later=appendMeasurements(s,[{command:3,position:0,rate:0,jointTorque:100}]);later=refitSession(later,{noiseSigma:.2});assert.deepEqual(searchHistoricalTraining(later,2,0,options),r);
 const raw=JSON.parse(exportSession(s));raw.base.heldOut=[{command:1,position:0,rate:0,jointTorque:999}];assert.deepEqual(inspect(restoreSession(JSON.stringify(raw))),r);
 assert.deepEqual(inspect(undoSession(undoSession(later))),r);assert.throws(()=>historicalTrainingContext(undoSession(s),2),/retained acquisition/);
});
test('edited original prefix refuses the old certificate, as does changing receiving error',()=>{
 const s=fixture(),cert=inspect(s).certificate,raw=JSON.parse(exportSession(s));raw.base.observations[0].jointTorque-=.01;const changed=restoreSession(JSON.stringify(raw));assert.throws(()=>checkHistoricalTraining(changed,2,0,{trainingRadius:.02,receivingRadius:.001},cert),/source/);assert.throws(()=>checkHistoricalTraining(s,2,0,{trainingRadius:.02,receivingRadius:.002},cert),/source/);
 const corrupt=structuredClone(s);corrupt.history[2].experiment.beforeCount=7;assert.throws(()=>historicalTrainingContext(corrupt,2),/prefix/);
});
test('unsupported earlier fitting and coordinate uncertainty remain unavailable',()=>{
 for(const loss of ['soft_l1','weighted_least_squares']){const s=fixture();s.history[2].experiment.options.loss=loss;assert.equal(inspect(s).status,'unavailable');}
 const s=fixture();s.history[2].experiment.bounded.radii.position=.01;assert.match(inspect(s).reason,/coordinate uncertainty/);
 const g=fixture();g.history[2].experiment.models[0].terms[0].id='generated';assert.match(inspect(g).reason,/generated terms/);
});
test('zero search budget and boundary outcomes are unresolved, never interpreted as compatibility',()=>{const s=fixture();assert.equal(searchHistoricalTraining(s,2,0,{...options,maxIterations:0}).status,'unresolved');assert.equal(searchHistoricalTraining(s,2,0,{...options,trainingRadius:0,receivingRadius:0,maxProducts:0}).status,'unresolved');});
