import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
const args=process.argv.slice(process.argv[1]?.startsWith('--')?1:2),flags=new Map();
for(let i=0;i<args.length;i+=2){
 assert(['--input-json','--source-root'].includes(args[i]),'unsupported argument');
 assert(i+1<args.length&&!flags.has(args[i]),'missing or repeated argument');
 flags.set(args[i],args[i+1]);
}
assert(flags.has('--source-root'),'Pass --source-root for the pinned original source checkout.');
const payloadText=flags.has('--input-json')?flags.get('--input-json'):fs.readFileSync(new URL('../docs/receipts/joint-spacing-composition-7912183a/source-input.json',import.meta.url),'utf8');
const payload=JSON.parse(payloadText);
assert(!Object.hasOwn(payload,'root'),'Source location belongs to --source-root, not the capsule.');
payload.root=flags.get('--source-root');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const FIT='src/joint-state/fit.mjs',HELPER='src/science/bounded-lm.mjs';
const FIT_OLD='52629bd0b4edaed3dde1970f41700d2fbd95a9524683b6fb0e2b9f0e2fed6fb0';
const FIT_NEW='2915796fe51f98401461f2f084cc5e0836f1ec149a7c9288166f9c6e28a992a9';
const HELPER_OLD='26536292d6fbdfc5bb26d7fa557fc01c6e80138c42d6b32b4d6cc947e9618a92';
const HELPER_NEW='f9a86ac2529a38d83a9e039c5b43912bf493b681d0464dd299503c4e9e67632b';
assert.equal(payload.baselineCommit,'0a7ba12e58d714a52fd8f5385b87a1a8600c927e');
assert.equal(payload.combinedCommit,'3f70a51626e31b70751271d3bbf8d7ee5456cc5d');
assert.equal(hash(payload.candidateFit),FIT_NEW);
assert.equal(hash(payload.correctedHelper),HELPER_NEW);
assert.equal(hash(payload.testSource),'a9856cab403b5c7408eab293135957d2e197c8fd37f2bde0d392e10c008e4ccd');
assert.equal(payload.pins.length,29);
const sources=new Map();
for(const pin of payload.pins){
 const bytes=fs.readFileSync(path.join(payload.root,pin.path));
 assert.equal(bytes.length,pin.bytes,pin.path);
 assert.equal(hash(bytes),pin.sha256,pin.path);
 assert(!sources.has(pin.path));
 sources.set(pin.path,bytes.toString('utf8'));
}
assert.equal(hash(sources.get(FIT)),FIT_OLD);
assert.equal(hash(sources.get(HELPER)),HELPER_OLD);
const fixtureStart=payload.testSource.indexOf('function fixture() {');
const fixtureEnd=payload.testSource.indexOf('\n\nfunction assertScreened',fixtureStart);
assert(fixtureStart>=0&&fixtureEnd>fixtureStart);
const fixtureSource=payload.testSource.slice(fixtureStart,fixtureEnd);
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from('export '+fixtureSource).toString('base64'));
const initial=fixture(),inputText=JSON.stringify(initial),inputSHA256=hash(inputText);
assert.equal(inputSHA256,'86efee448961acd995afe70ef052837d071a00ab39392f738d30281bd6d60a89');
const names=['original-loop','delegated-old-helper','delegated-corrected-helper'];
const actualLoads=[];
function selectedSource(arm,file){
 assert(names.includes(arm),'unrecognized arm');
 assert(sources.has(file),'source outside pinned closure: '+file);
 if(file===FIT&&arm!=='original-loop')return payload.candidateFit;
 if(file===HELPER&&arm==='delegated-corrected-helper')return payload.correctedHelper;
 return sources.get(file);
}
registerHooks({
 resolve(specifier,context,next){
  if(specifier.startsWith('worldlaw-composition://'))return{url:specifier,shortCircuit:true};
  if(context.parentURL?.startsWith('worldlaw-composition://')&&specifier.startsWith('.'))return{url:new URL(specifier,context.parentURL).href,shortCircuit:true};
  return next(specifier,context);
 },
 load(url,context,next){
  if(!url.startsWith('worldlaw-composition://'))return next(url,context);
  const u=new URL(url),file=u.pathname.slice(1),source=selectedSource(u.hostname,file);
  actualLoads.push({arm:u.hostname,path:file,sha256:hash(source)});
  return{format:'module',source,shortCircuit:true};
 }
});
const finite=v=>Number.isFinite(v);
function invariant(result,input,strict){
 const {runs,options}=input;
 assert.deepEqual(result.runs,runs);
 assert.deepEqual(result.options,options);
 assert.equal(result.maximumEvaluations,65);
 assert.deepEqual(result.reservation,{steps:186810,rows:24570});
 assert(result.reservation.rows*2<=262144);
 assert(result.trials.length<=result.maximumEvaluations);
 for(const trial of result.trials){
  assert.equal(trial.values.length,options.bounds.length);
  trial.values.forEach((v,i)=>assert(finite(v)&&v>=options.bounds[i][0]&&v<=options.bounds[i][1]));
 }
 if(strict){
  assert.equal(result.status,'seed_unresolved');assert.equal(result.model,null);
  assert.equal(result.trials.length,1);assert.equal(result.best.status,'incomplete');
  assert.deepEqual(result.iterations,[]);
  assert.equal(result.best.runs.length,3);
  for(const r of result.best.runs){
   assert.equal(r.status,'unresolved');assert.equal(r.resolution.status,'compared');
   const p=r.resolution.maxAbsPositionDifference,v=r.resolution.maxAbsRateDifference;
   assert(finite(p)&&p>=0&&p<=options.screen);
   assert(finite(v)&&v>options.rateScreen);
  }
 }else{
  assert.equal(result.status,'training_improved');assert(result.model);
  assert.equal(result.best.status,'complete');assert.equal(result.best.runs.length,3);
  for(const r of result.best.runs){
   assert.equal(r.status,'screened');assert.equal(r.resolution.status,'compared');
   for(const [v,limit]of[[r.resolution.maxAbsPositionDifference,options.screen],[r.resolution.maxAbsRateDifference,options.rateScreen]])
    assert(finite(v)&&v>=0&&v<=limit);
   assert(finite(r.positionRMSE)&&finite(r.suppliedRateRMSE));
  }
  const objective=Math.sqrt(result.best.runs.reduce((s,r)=>s+(r.positionRMSE/options.channelScales.positionRad)**2+(r.suppliedRateRMSE/options.channelScales.rateRadPerSecond)**2,0)/6);
  assert(Math.abs(objective-result.best.rmse)<=1e-12*Math.max(1,result.best.rmse));
 }
}
function compactRun(r){return{id:r.id,status:r.status,positionRMSE:r.positionRMSE,suppliedRateRMSE:r.suppliedRateRMSE,resolutionStatus:r.resolution?.status,maxAbsPositionDifference:r.resolution?.maxAbsPositionDifference,maxAbsRateDifference:r.resolution?.maxAbsRateDifference};}
function compactTrial(t){return{index:t.index,values:t.values,status:t.status,rmse:t.rmse,runs:t.runs.map(compactRun)};}
const output={},allResults={};
const started=new Date().toISOString();
for(const arm of names){
 const {fitJointState}=await import('worldlaw-composition://'+arm+'/'+FIT);
 const input=fixture(),before=JSON.stringify(input);
 assert.equal(hash(before),inputSHA256);
 const result=fitJointState(input.seed,input.runs,input.options);
 assert.equal(JSON.stringify(input),before);
 invariant(result,input,false);
 const strictInput=fixture();strictInput.options.rateScreen=1e-16;
 const strictBefore=JSON.stringify(strictInput);
 const strict=fitJointState(strictInput.seed,strictInput.runs,strictInput.options);
 assert.equal(JSON.stringify(strictInput),strictBefore);
 invariant(strict,strictInput,true);
 const boundaryIteration=result.iterations.find(row=>row.status==='improved'&&result.trials[row.bestTrial].values[1]===input.options.bounds[1][0]);
 assert(boundaryIteration);
 const boundary=result.trials[boundaryIteration.bestTrial];
 if(arm!=='original-loop'){
  assert(result.best.index>boundary.index);
  assert(result.iterations.some(row=>row.iteration>boundaryIteration.iteration&&row.status==='improved'));
  assert.equal(result.best.values[1],input.options.bounds[1][0]);
  assert(result.best.rmse<.9*boundary.rmse);
  for(const run of result.best.runs){
   const prior=boundary.runs.find(r=>r.id===run.id);assert(prior);
   assert(run.positionRMSE<prior.positionRMSE&&run.suppliedRateRMSE<prior.suppliedRateRMSE);
  }
 }
 allResults[arm]=result;
 output[arm]={status:result.status,fitSHA256:hash(selectedSource(arm,FIT)),helperSHA256:hash(selectedSource(arm,HELPER)),helperUsed:actualLoads.some(x=>x.arm===arm&&x.path===HELPER),evaluations:result.trials.length,maximumEvaluations:result.maximumEvaluations,reservation:result.reservation,model:result.model,best:result.best,boundaryIteration,firstAcceptedBoundary:compactTrial(boundary),iterations:result.iterations,trials:result.trials.map(compactTrial),strictRate:{inputSHA256:hash(strictBefore),status:strict.status,model:strict.model,evaluations:strict.trials.length,maximumEvaluations:strict.maximumEvaluations,reservation:strict.reservation,iterations:strict.iterations,best:strict.best}};
}
const baseline=allResults['original-loop'];
for(const arm of names.slice(1)){
 const result=allResults[arm];
 assert(result.best.rmse<baseline.best.rmse);
 for(const r of result.best.runs){const b=baseline.best.runs.find(x=>x.id===r.id);assert(b);assert(r.positionRMSE<b.positionRMSE&&r.suppliedRateRMSE<b.suppliedRateRMSE);}
}
for(const arm of names){
 assert(actualLoads.some(x=>x.arm===arm&&x.path===FIT));
 for(const row of actualLoads.filter(x=>x.arm===arm))assert.equal(row.sha256,hash(selectedSource(arm,row.path)));
 if(arm!=='original-loop')assert(actualLoads.some(x=>x.arm===arm&&x.path===HELPER&&x.sha256===(arm==='delegated-old-helper'?HELPER_OLD:HELPER_NEW)));
}
const changed=[];
for(const pin of payload.pins)if(hash(fs.readFileSync(path.join(payload.root,pin.path)))!==pin.sha256)changed.push(pin.path);
assert.deepEqual(changed,[]);
const evalIndex=process.execArgv.indexOf('-e');
const executedSource=evalIndex>=0?process.execArgv[evalIndex+1]:fs.readFileSync(new URL(import.meta.url),'utf8');
const receipt={experiment:'joint-state-three-course-helper-composition',runnerSHA256:hash(executedSource),capsuleSHA256:hash(payloadText),node:process.version,pid:process.pid,started,finished:new Date().toISOString(),baselineCommit:payload.baselineCommit,combinedCommit:payload.combinedCommit,inputSerialization:'JSON.stringify(fixture()) with the exact maintained fixture body; properties seed,runs,options',inputSHA256,fixtureSourceSHA256:hash(fixtureSource),fixtureTestSHA256:hash(payload.testSource),inputSummary:{seed:initial.seed,courses:initial.runs.map(r=>({id:r.id,source:r.source,rateObservation:r.rateObservation,rows:r.samples.length,first:r.samples[0],last:r.samples.at(-1)})),options:initial.options},sourceClosure:payload.pins,actualLoads,checks:{exactHistoricalInput:true,allInputsAndReturnedOriginalsPreserved:true,identicalWorkReservationAndCap:true,allTrialCoordinatesFiniteAndBounded:true,acceptedPostBoundaryProgressBothDelegatedArms:true,eachCourseBothChannelsImproveFromBoundaryAndOriginalLoop:true,separateNumericalScreensPass:true,strictRateRefusalAllThreeArms:true,dimensionlessObjectiveReconstructs:true,sourceFilesUnchanged:true},arms:output,limits:'Native source-module composition receiving via Node hooks and exact existing local closure. One joint training fit over three authored courses per arm; no clean checkout, browser, notebook workflow, physical-validity, held-out, peak-memory, wall-time speedup, global-optimum or compiled-artifact claim.'};
console.log(JSON.stringify(receipt));
