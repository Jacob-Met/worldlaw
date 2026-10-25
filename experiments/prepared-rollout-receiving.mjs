/** Compare a pinned pre-change source directory with this maintained consumer. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rollout} from '../src/trajectory/forward.mjs';
import {refineForwardCoefficients} from '../src/predictive-selection/refine.mjs';
import {selectPredictiveStructure} from '../src/predictive-selection/select.mjs';
import {ANGULAR_COEFFICIENT_UNITS,ANGULAR_MODEL_UNITS} from '../src/trajectory/angular-discovery.mjs';

assert.ok(process.env.WORLDLAW_BASELINE_DIR,'Provide a separately received pinned WORLDLAW_BASELINE_DIR.');
const baselineRoot=resolve(process.env.WORLDLAW_BASELINE_DIR);
const load=path=>import(pathToFileURL(resolve(baselineRoot,path)));
const oldRollout=(await load('src/trajectory/forward.mjs')).rollout;
const oldRefine=(await load('src/predictive-selection/refine.mjs')).refineForwardCoefficients;
const oldSelect=(await load('src/predictive-selection/select.mjs')).selectPredictiveStructure;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const errorRecord=e=>({name:e.name,code:e.code,message:e.message,...(e.cause?{cause:errorRecord(e.cause)}:{})});
const execute=(fn,...args)=>{try{return {status:'ok',value:fn(...args)};}catch(error){return {status:'failed',error:errorRecord(error)};}};
let seed=0x4a1ede0c;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)+.5)/4294967296;
const termIds=['command','rate','coulomb','spring','gravity','quadratic','bias','command_position','rate_squared','cosine','cubic'];
const comparisons=[];
for(let i=0;i<180;i++){
  const terms=termIds.filter(()=>random()>.45).map(id=>({id,coefficient:(id==='coulomb'?-.2:(random()-.5)*.4)}));
  if(i%2)terms.reverse();
  const model={schema:'worldlaw.torque-model/v1',id:'authored-'+i,terms};
  const run={id:'source-'+i,label:'Independently authored changed-input course',kind:'synthetic',inertia:.7+random(),initialRate:random()-.5,source:{label:'Seeded original course 4a1ede0c'},samples:Array.from({length:49},(_,j)=>({time:1e6+j*.025,position:.3*Math.sin(j*.1+i*.01),command:j<17?.2:j<33?-.3:.1}))};
  const options={maxStep:.007,maxSteps:20000,...(i%4===1?{commandTiming:{delaySeconds:.037,responseTimeSeconds:0,beforeStart:-.1}}:i%4===2?{commandTiming:{delaySeconds:.021,responseTimeSeconds:.08,beforeStart:-.1}}:i%4===3?{coulombContact:true}:{})};
  const before=JSON.stringify({model,run,options}),old=execute(oldRollout,model,run,options),current=execute(rollout,model,run,options);
  assert.equal(current.status,'ok','The changed-input course must actually execute: '+i);
  assert.deepEqual(current,old,'Complete receipt mismatch for course '+i);
  assert.equal(JSON.stringify({model,run,options}),before,'Source mutated for course '+i);
  comparisons.push({case:i,status:current.status,sha256:hash(current)});
}
const baseModel={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-4},{id:'rate',coefficient:-.2}]};
const baseRun={id:'negatives',label:'Explicit failure controls',kind:'synthetic',inertia:1,initialRate:0,source:{label:'Authored failure control'},samples:[{time:0,position:1,command:0},{time:1,position:0,command:0}]};
const negatives=[
  ['work limit',baseModel,baseRun,{maxStep:.0001,maxSteps:1}],
  ['stage state bound',{...baseModel,terms:[{id:'spring',coefficient:1e18}]},baseRun,{maxStep:.001}],
  ['invalid source coordinate',baseModel,{...baseRun,initialRate:Infinity},{}],
  ['invalid model', {...baseModel,terms:[{id:'spring',coefficient:NaN}]},baseRun,{}],
  ['invalid contact timing',baseModel,baseRun,{coulombContact:true,commandTiming:{delaySeconds:0}}],
  ['unresolved command response',baseModel,baseRun,{maxStep:.01,commandTiming:{delaySeconds:0,responseTimeSeconds:.001,beforeStart:0}}],
];
for(const [name,model,run,options] of negatives){
  const old=execute(oldRollout,model,run,options),current=execute(rollout,model,run,options);
  assert.equal(current.status,'failed',name);assert.deepEqual(current,old,name);comparisons.push({name,status:current.status,error:current.error});
}
function oscillator(id,amplitude,rate,count=501){
  const d=.1,w=2.1;
  return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:rate,source:{label:'Analytic damped oscillator authored independently',recordingId:id},samples:Array.from({length:count},(_,i)=>{const t=i*.02;return {time:t,position:Math.exp(-d*t)*(amplitude*Math.cos(w*t)+(rate+d*amplitude)/w*Math.sin(w*t))};})};
}
const angular={schema:'worldlaw.angular-model/v1',id:'rate+spring',terms:[{id:'rate',coefficient:-.16},{id:'spring',coefficient:-4.3}].map(t=>({...t,coefficientUnit:ANGULAR_COEFFICIENT_UNITS[t.id]})),units:ANGULAR_MODEL_UNITS,physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown'};
const training=[oscillator('original-training-a',.7,-.07)],options={sweeps:10,maxStep:.005};
let incumbent,candidate;
const timings={baselineMs:[],candidateMs:[]};
for(let repetition=0;repetition<6;repetition++){
  const order=repetition%2?['candidate','baseline']:['baseline','candidate'];
  for(const which of order){const start=performance.now();const result=(which==='baseline'?oldRefine:refineForwardCoefficients)(angular,training,options);const elapsed=performance.now()-start;if(which==='baseline')incumbent=result;else candidate=result;if(repetition)timings[which+'Ms'].push(elapsed);}
  assert.deepEqual(candidate,incumbent,'Complete refinement trials/selection changed');
}
const heldTraining=[oscillator('training-fold-a',.5,.2,241),oscillator('training-fold-b',-.7,-.1,241)];
const selectionOptions={terms:['rate','spring','bias'],maxTerms:3,noiseSigma:.001,windowDuration:1,windowStride:.25,maxStep:.01};
const originalSelection=oldSelect(heldTraining,selectionOptions),selection=selectPredictiveStructure(heldTraining,selectionOptions);
assert.deepEqual(selection,originalSelection,'Complete cross-recording selection changed');
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const report={schema:'worldlaw.prepared-rollout-receiving/v1',baselineCommit:process.env.WORLDLAW_BASELINE_COMMIT||null,environment:{node:process.version,platform:process.platform,arch:process.arch},caseCount:comparisons.length,successfulChangedCourses:comparisons.slice(0,180).filter(r=>r.status==='ok').length,comparisons,
  refinement:{sourceSha256:hash({angular,training,options}),status:candidate.status,trials:candidate.trials.length,reservation:candidate.reservation,receiptSha256:hash(candidate),timings,baselineMedianMs:median(timings.baselineMs),candidateMedianMs:median(timings.candidateMs)},
  crossRecording:{status:selection.status,selectedId:selection.selectedId,offeredStructureCount:selection.offeredStructureCount,receiptSha256:hash(selection)},limits:['Authored software/behavior courses, not physical accuracy or production deployment.','Timing excludes startup and compares alternating calls on one named runtime.','Every complete returned receipt is compared exactly; no tolerance hides result changes.']};
if(process.env.WORLDLAW_RECEIPT_PATH)await writeFile(process.env.WORLDLAW_RECEIPT_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:report.caseCount,successfulChangedCourses:report.successfulChangedCourses,refinement:report.refinement,crossRecording:report.crossRecording},null,2));
