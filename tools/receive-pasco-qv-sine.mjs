import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeAngularBundle,rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
import {rolloutAngularWithResolution} from '../src/trajectory/angular-resolution.mjs';
import {TrajectoryRolloutError} from '../src/trajectory/forward.mjs';

const research=process.env.PASCO_RESEARCH_ROOT;
assert.ok(research,'Set PASCO_RESEARCH_ROOT to the complete frozen recording-transfer research package.');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=name=>readFile(join(research,name));
const load=async name=>JSON.parse(await read(name));
const protocolBytes=await read('protocol.json'),selectionBytes=await read('selection.json');
assert.equal(hash(protocolBytes),'c8094b917a1eddd0cc05408b918768be935ffb2733045c33954a5c27358f3114');
assert.equal(hash(selectionBytes),'8df6ff1109cb98296e50ebced6fe257212496233df29d5a31e825ce4e659dff3');
const protocol=JSON.parse(protocolBytes),selection=JSON.parse(selectionBytes);
assert.equal(selection.selectedId,'sine-integrated');assert.equal(selection.refit.status,'fitted');
const training=await load('training-courses.json'),challenge=await load('challenge-courses.json');
const expected=await load('challenge-result.json');
assert.equal(hash(await read('training-courses.json')),(await load('admission-training.json')).coursesSHA256);
assert.equal(hash(await read('challenge-courses.json')),(await load('admission-challenge.json')).coursesSHA256);
assert.equal(expected.selectionSHA256,hash(selectionBytes));
const inputs=[...training.courses,...challenge.courses],sourceHashes={};
for(const record of inputs) {
  const name='public-source/'+record.source.path;
  sourceHashes[name]=hash(await read(name));assert.equal(sourceHashes[name],record.source.sha256);
}
const asAngularRun=record=>({
  id:'pasco-qv-repetition-'+record.repetition,label:'Original PASCO repetition '+record.repetition,kind:'measured',
  dynamics:'unforced_scalar_rotation',inertia:null,initialRate:record.rate[0],
  source:{label:'Pinned publisher-declared PASCO repetition; supplied original q/v evidence',recordingId:record.recordingId,
    rawSHA256:record.source.sha256,rawURL:record.source.url,originalRows:[record.source.firstOriginalRow,record.source.lastOriginalRow],
    unforcedAssumption:'Declared for this autonomous model experiment; not independently verified by absent actuator data.',
    coordinatePolicy:'Original angular zero and supplied initial rate preserved; no physical inertia or absolute torque inferred.'},
  samples:record.time.map((time,i)=>({time,position:record.position[i]})),
});
const supplied={schema:'worldlaw.angular-bundle/v1',label:'Frozen q/v-selected sine model receiving',
  units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:training.courses.map(asAngularRun),challengeRuns:challenge.courses.map(asAngularRun)};
const bundle=normalizeAngularBundle(supplied);
assert.deepEqual(bundle.trainingRuns.map(r=>r.samples),supplied.trainingRuns.map(r=>r.samples));
assert.deepEqual(bundle.challengeRuns.map(r=>r.samples),supplied.challengeRuns.map(r=>r.samples));
const {damping,stiffness}=selection.refit.fit.coefficients;
const model={schema:'worldlaw.angular-model/v1',id:'pasco-qv-frozen-sine',
  terms:[{id:'rate',coefficient:-damping,coefficientUnit:'1/s'},{id:'gravity',coefficient:-stiffness,coefficientUnit:'rad/s²'}],
  units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},
  scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',physicalInertia:null,absoluteTorqueIdentified:false};
const options={maxStep:protocol.forecast.coarseMaximumStepSeconds,maxSteps:protocol.forecast.maxStepsPerForecastExclusive-1,
  positionDomain:[...protocol.fitting.positionDomain],includeRefinedRollout:true};
const state={model,bundle,options};const before=JSON.stringify(state);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(state);
const result=rolloutAngularWithResolution(model,bundle.challengeRuns[0],options);
assert.equal(result.resolution.status,'compared');assert.ok(result.refinedRollout);
assert.deepEqual(result.refinedRollout.diagnostics.positionDomain,[-2,2]);
assert.equal(result.refinedRollout.diagnostics.maxStep,protocol.forecast.fineMaximumStepSeconds);
assert.equal(result.refinedRollout.rows.length,2001);assert.equal(result.refinedRollout.metrics.count,2000);
assert.equal(result.refinedRollout.diagnostics.physicalInertia,null);
assert.equal(result.refinedRollout.diagnostics.absoluteTorqueIdentified,false);
assert.ok(result.refinedRollout.rows.every(row=>!Object.hasOwn(row,'command')));
assert.ok(result.resolution.combinedSteps<=options.maxSteps);
let maximumPositionDifference=0,maximumRateDifference=0,maximumCoarseFineDifference=0;
for(let i=0;i<expected.predictions.length;i++) {
  const a=result.refinedRollout.rows[i],b=expected.predictions[i];assert.equal(a.time,b.time);
  maximumPositionDifference=Math.max(maximumPositionDifference,Math.abs(a.predicted-b.predicted));
  maximumRateDifference=Math.max(maximumRateDifference,Math.abs(a.rate-b.rate));
  maximumCoarseFineDifference=Math.max(maximumCoarseFineDifference,Math.abs(a.predicted-result.rollout.rows[i].predicted));
}
// Fixed beforehand as arithmetic receiving tolerance; no model refitting or challenge retuning.
assert.ok(maximumPositionDifference<=1e-12);assert.ok(maximumRateDifference<=1e-12);
assert.ok(Math.abs(result.refinedRollout.metrics.positionRMSE-expected.rmse)<=1e-12);
assert.ok(maximumCoarseFineDifference>1e-9,'The requested fine rows must not be a relabelled coarse result.');
assert.equal(maximumCoarseFineDifference,result.resolution.maxAbsPositionDifference);
assert.ok(maximumCoarseFineDifference<=protocol.forecast.maximumPositionDisagreementRad);
assert.equal(JSON.stringify(state),before);
const reopened=JSON.parse(before);
assert.deepEqual(rolloutAngularWithResolution(reopened.model,reopened.bundle.challengeRuns[0],reopened.options),result);
assert.throws(()=>rolloutAngular(model,bundle.challengeRuns[0],{...options,positionDomain:[-.9,.9]}),
  e=>e instanceof TrajectoryRolloutError&&e.code==='position_domain');
const targetPoison=structuredClone(bundle.challengeRuns[0]);targetPoison.samples.slice(1).forEach((r,i)=>{r.position=i%2?1.75:-1.75;});
const poisoned=rolloutAngularWithResolution(model,targetPoison,options);
assert.deepEqual(poisoned.refinedRollout.rows.map(r=>[r.time,r.predicted,r.rate]),result.refinedRollout.rows.map(r=>[r.time,r.predicted,r.rate]));
assert.notEqual(poisoned.refinedRollout.metrics.positionRMSE,result.refinedRollout.metrics.positionRMSE);
for(const [name,sha] of Object.entries(sourceHashes))assert.equal(hash(await read(name)),sha);
assert.equal(hash(await read('protocol.json')),hash(protocolBytes));assert.equal(hash(await read('selection.json')),hash(selectionBytes));
const receipt={status:'passed',scope:'Native real-input source admission and frozen q/v sine-model receiving through the existing angular model and shared forward/resolution route; no new fit, UI or publication claim.',
  protocolSHA256:hash(protocolBytes),selectionSHA256:hash(selectionBytes),sourceHashes,
  sourceRows:{training:4002,challenge:2001,challengeScored:2000},
  model,options,maximumPositionDifferenceFromFrozenResearch:maximumPositionDifference,maximumRateDifferenceFromFrozenResearch:maximumRateDifference,
  challengePositionRMSE:result.refinedRollout.metrics.positionRMSE,maximumCoarseFinePositionDifference:maximumCoarseFineDifference,
  stepsCoarse:result.resolution.stepsCoarse,stepsRefined:result.resolution.stepsRefined,combinedSteps:result.resolution.combinedSteps,
  inputJSONReplay:true,futureTargetPoisoningPreservesPrediction:true,outOfDomainInitialStateRefused:true,sourceAndInputsUnchanged:true,
  productSourceSHA256:Object.fromEntries(await Promise.all(['forward','resolution','angular-discovery','angular-resolution'].map(async name=>
    [name+'.mjs',hash(await readFile(new URL('../src/trajectory/'+name+'.mjs',import.meta.url)))]))),
  limitations:['Publisher-declared acquisition independence and angular-zero/rate calibration remain unresolved.','Unforced rotation is an explicit experiment assumption.','Execution bounds concern numerical states, not proof of physical reachability.','Native model receiving is not a browser workflow, maintained merge, deployment or physical-law identification.']};
await writeFile(new URL('../docs/evidence/pasco-qv-sine-ordinary-forward.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,rows:receipt.sourceRows,maximumPositionDifference,maximumRateDifference,rmse:receipt.challengePositionRMSE,combinedSteps:receipt.combinedSteps}));
