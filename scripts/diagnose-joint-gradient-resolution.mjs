import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(process.argv[1]?.startsWith('--')?1:2), flags=new Map();
for(let i=0;i<args.length;i+=2){assert(['--input-json','--source-root','--reference-code','--python'].includes(args[i]));assert(i+1<args.length&&!flags.has(args[i]));flags.set(args[i],args[i+1]);}
assert(flags.has('--source-root'),'Pass the pinned original source root.');
const payloadText=flags.get('--input-json')??fs.readFileSync(new URL('../docs/receipts/joint-gradient-resolution-7912183a/source-input.json',import.meta.url),'utf8');
const pythonSource=flags.get('--reference-code')??fs.readFileSync(new URL('./reference-joint-gradient-resolution.py',import.meta.url),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(payloadText),'68e3cfa5f21ad26483ab1d71d2e28ee7ebbabc4e35a9df1847e736f5d41b671b');
assert.equal(hash(pythonSource),'cbdfb9672f4ec5c167a363d9196a7d83b1449e8a78ecdb6382a961e950291e33');
const p=JSON.parse(payloadText),root=flags.get('--source-root');
assert.equal(p.schema,'worldlaw.joint-state-gradient-resolution-study/v1');
assert.equal(p.originalSourceCommit,'0a7ba12e58d714a52fd8f5385b87a1a8600c927e');
assert.equal(p.combinedSourceCommit,'3f70a51626e31b70751271d3bbf8d7ee5456cc5d');
const FIT='src/joint-state/fit.mjs',HELPER='src/science/bounded-lm.mjs';
assert.equal(hash(p.candidateFit),'2915796fe51f98401461f2f084cc5e0836f1ec149a7c9288166f9c6e28a992a9');
assert.equal(hash(p.correctedHelper),'f9a86ac2529a38d83a9e039c5b43912bf493b681d0464dd299503c4e9e67632b');
assert.equal(hash(p.fixtureTest),'a9856cab403b5c7408eab293135957d2e197c8fd37f2bde0d392e10c008e4ccd');
assert.equal(p.originalSourcePins.length,29);
const sources=new Map();
for(const pin of p.originalSourcePins){const bytes=fs.readFileSync(path.join(root,pin.path));assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256,pin.path);assert(!sources.has(pin.path));sources.set(pin.path,bytes.toString('utf8'));}
const fixtureStart=p.fixtureTest.indexOf('function fixture() {'),fixtureEnd=p.fixtureTest.indexOf('\n\nfunction assertScreened',fixtureStart);
assert(fixtureStart>=0&&fixtureEnd>fixtureStart);
const fixtureSource=p.fixtureTest.slice(fixtureStart,fixtureEnd);
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from('export '+fixtureSource).toString('base64'));
const original=fixture(),originalText=JSON.stringify(original);
assert.equal(hash(originalText),p.historicalInputSHA256);
assert.deepEqual(p.snapshots.map(s=>s.index),[5,35]);
assert.deepEqual(p.snapshots.map(s=>s.values),[[-0.24604286839907222,-3.85],[-0.19259937353078452,-3.85]]);
assert.deepEqual(p.maxSteps,[.02,.01,.005]);
const fitImports=p.candidateFit.slice(0,p.candidateFit.indexOf('export function fitJointState'));
const evaluateStart=p.candidateFit.indexOf('const modelFor='),evaluateEnd=p.candidateFit.indexOf('\nconst {best,iterations}=fitBoundedLM',evaluateStart);
assert(evaluateStart>0&&evaluateEnd>evaluateStart);
const evaluateBody=p.candidateFit.slice(evaluateStart,evaluateEnd);
const factory=fitImports+'\nexport function makeFixedEvaluator(seed,rawRuns,options){const runs=normalizeAngularRuns(rawRuns),o=copy(options),trials=[];\n'+evaluateBody+'\nreturn{evaluate,trials};}\n';
const prefixEnd=p.correctedHelper.indexOf('\n    const free =');
assert(prefixEnd>0);
const helperPrefix=p.correctedHelper.slice(0,prefixEnd);
function once(text,a,b){assert.equal(text.split(a).length,2,a);return text.replace(a,b);}
let inspector=once(helperPrefix,'export function fitBoundedLM(','export function inspectColumns(');
inspector=once(inspector,'const iterations = [];','const iterations = [];\n  const geometry = [];');
inspector=once(inspector,'const plus = evaluate(a), other = evaluate(b);','geometry.push({coordinate:j,x,lo,hi,nominal,h,central,a:[...a],b:[...b],da,db,symmetric,denominator,weight});\n      const plus = evaluate(a), other = evaluate(b);');
inspector+='\n    return {status:"resolved",best,columns,gradients,geometry,iterations};\n  }\n  return {status:"unresolved",best,geometry,iterations};\n}\n';
assert(!inspector.includes('fitLinearColumns('),'No least-squares solve or proposal path is included.');
const diag=new Map([['src/joint-state/__fixed-evaluation-diagnostic.mjs',factory],['src/science/__column-diagnostic.mjs',inspector]]);
const loads=[];
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('worldlaw-gradient://'))return{url:specifier,shortCircuit:true};if(context.parentURL?.startsWith('worldlaw-gradient://')&&specifier.startsWith('.'))return{url:new URL(specifier,context.parentURL).href,shortCircuit:true};return next(specifier,context);},
 load(url,context,next){if(!url.startsWith('worldlaw-gradient://'))return next(url,context);const file=new URL(url).pathname.slice(1);assert(diag.has(file)||sources.has(file),'Unpinned import: '+file);const source=diag.get(file)??(file===HELPER?p.correctedHelper:sources.get(file));loads.push({path:file,sha256:hash(source),diagnostic:diag.has(file)});return{format:'module',source,shortCircuit:true};}
});
const {makeFixedEvaluator}=await import('worldlaw-gradient://study/src/joint-state/__fixed-evaluation-diagnostic.mjs');
const {inspectColumns}=await import('worldlaw-gradient://study/src/science/__column-diagnostic.mjs');
const {reservePredictionWork}=await import('worldlaw-gradient://study/src/predictive-selection/select.mjs');
const reservationRows=p.maxSteps.map(maxStep=>({maxStep,...reservePredictionWork(original.runs,maxStep,10)}));
const reserved={steps:reservationRows.reduce((s,r)=>s+r.steps,0),rows:reservationRows.reduce((s,r)=>s+r.rows,0),receiverCalls:90,modelVectorEvaluations:30,scaledResidualEntries:reservationRows.reduce((s,r)=>s+2*r.rows,0)};
assert.deepEqual(reserved,p.expectedReservation);assert(reserved.steps<=p.stepCap&&reserved.rows<=p.predictionRowCap);
const started=new Date().toISOString();
console.log(JSON.stringify({phase:'admitted',started,node:process.version,pid:process.pid,reservation:reserved,stepCap:p.stepCap,predictionRowCap:p.predictionRowCap}));
const cases=[];
for(const snapshot of p.snapshots){
 for(const maxStep of p.maxSteps){
  const input=fixture();input.options.maxStep=maxStep;const before=JSON.stringify(input);
  const {evaluate,trials}=makeFixedEvaluator(input.seed,input.runs,input.options);
  const result=inspectColumns(snapshot.values,input.options.bounds,1,evaluate);
  assert.equal(JSON.stringify(input),before);assert.equal(trials.length,5);
  assert.equal(result.status,'resolved','Diagnostic must not construct columns from incomplete probes.');
  assert(result.best.status==='complete'&&trials.every(t=>t.status==='complete'));
  const columns=result.columns;
  assert.equal(columns.length,2);assert(columns.every(c=>c.length===756));
  if(maxStep===.02)assert.equal(result.best.rmse,snapshot.rmse,'Saved center must reproduce exactly.');
  if(snapshot.index===35)assert.deepEqual(trials.slice(1).map(t=>t.values),[[-0.19258011359343144,-3.85],[-0.1926186334681376,-3.85],[-0.19259937353078452,-3.849615],[-0.19259937353078452,-3.84923]]);
  const pointResults=[];
  for(const t of trials){
   t.values.forEach((v,j)=>assert(Number.isFinite(v)&&v>=input.options.bounds[j][0]&&v<=input.options.bounds[j][1]));
   assert.equal(t.runs.length,3);
   for(const run of t.runs){assert.equal(run.resolution.status,'compared');assert.equal(run.resolution.initialSampleExcluded,true);assert(run.resolution.maxAbsPositionDifference<=input.options.screen);assert(run.resolution.maxAbsRateDifference!==null&&run.resolution.maxAbsRateDifference<=input.options.rateScreen);assert.equal(run.resolution.combinedSteps,run.resolution.stepsCoarse+run.resolution.stepsRefined);assert(run.resolution.combinedSteps<=run.resolution.maxSteps);}
   pointResults.push(t);
  }
  cases.push({snapshot:snapshot.name,trial:snapshot.index,maxStep,geometry:result.geometry,center:result.best,columns,gradients:result.gradients,points:pointResults});
 }
}
const refSnapshots=p.snapshots.map(s=>{const c=cases.find(c=>c.trial===s.index);return{name:s.name,index:s.index,values:s.values,probes:c.points.slice(1).map(t=>({values:t.values})),geometry:c.geometry};});
for(const c of cases)assert.deepEqual(c.geometry,refSnapshots.find(s=>s.index===c.trial).geometry);
const referenceInput={fixture:original,snapshots:refSnapshots,lastProposals:p.lastProposals.map(t=>({index:t.index,values:t.values,recordedRMSE:t.rmse}))};
const referenceText=JSON.stringify(referenceInput);
console.log(JSON.stringify({phase:'native-evaluations-complete',receiverCalls:90,modelVectorEvaluations:30,allScreensPass:true,referenceInputSHA256:hash(referenceText)}));
const child=spawnSync(flags.get('--python')??'python',['-B','-c',pythonSource],{input:referenceText,encoding:'utf8',maxBuffer:12*1024*1024,timeout:45000});
assert.equal(child.error,undefined,String(child.error));assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
const reference=JSON.parse(child.stdout);
assert.equal(reference.inputSHA256,hash(referenceText));
const nums=[];for(const run of original.runs){nums.push(run.initialRate);for(const r of run.samples)nums.push(r.time,r.position,r.rate);}
const numBytes=Buffer.alloc(nums.length*8);nums.forEach((x,i)=>numBytes.writeDoubleBE(x,8*i));
assert.equal(reference.binary64OriginalNumericSHA256,hash(numBytes));
function compare(a,b,channel){const differences=[];for(let i=channel;i<a.length;i+=2)differences.push(a[i]-Number(b[i]));return{count:differences.length,maxAbs:Math.max(...differences.map(Math.abs)),rms:Math.hypot(...differences)/Math.sqrt(differences.length)};}
function compactTrial(t){return{index:t.index,values:t.values,status:t.status,rmse:t.rmse,runs:t.runs.map(r=>({id:r.id,status:r.status,positionRMSE:r.positionRMSE,suppliedRateRMSE:r.suppliedRateRMSE,resolution:{status:r.resolution.status,coarseMaxStep:r.resolution.coarseMaxStep,refinedMaxStep:r.resolution.refinedMaxStep,positionRMSEDifference:r.resolution.positionRMSEDifference,maxAbsPositionDifference:r.resolution.maxAbsPositionDifference,maxAbsRateDifference:r.resolution.maxAbsRateDifference,stepsCoarse:r.resolution.stepsCoarse,stepsRefined:r.resolution.stepsRefined,combinedSteps:r.resolution.combinedSteps,maxSteps:r.resolution.maxSteps,count:r.resolution.count,initialSampleExcluded:r.resolution.initialSampleExcluded}}))};}
const summaries=cases.map(c=>{
 const a=reference.snapshots.find(a=>a.name===c.snapshot);assert(a);
 const analyticGradient=a.gradients.map(Number),analyticStencilGradient=a.stencilGradients.map(Number);
 return{
 snapshot:c.snapshot,acceptedTrial:c.trial,maxStep:c.maxStep,geometry:c.geometry,
 nativeCenterRMSE:c.center.rmse,analyticCenterRMSE:a.rms,nativeMinusAnalyticRMS:c.center.rmse-Number(a.rms),
 residualDiscrepancy:{position:compare(c.center.residuals,a.residuals,0),rate:compare(c.center.residuals,a.residuals,1)},
 gradients:{native:c.gradients,analytic:a.gradients,analyticSameNodeStencil:a.stencilGradients,nativeMinusAnalytic:c.gradients.map((v,i)=>v-analyticGradient[i]),nativeMinusAnalyticSameNodeStencil:c.gradients.map((v,i)=>v-analyticStencilGradient[i]),signAgrees:c.gradients.map((v,i)=>Math.sign(v)===Math.sign(analyticGradient[i])),analyticStencilSignAgrees:analyticStencilGradient.map((v,i)=>Math.sign(v)===Math.sign(analyticGradient[i])),nativeSpringActive:c.gradients[1]>0,analyticSpringActive:analyticGradient[1]>0},
 columns:c.columns.map((col,j)=>({parameter:j===0?'rate':'spring',nativeVsAnalytic:{position:compare(col,a.columns[j],0),rate:compare(col,a.columns[j],1)},nativeVsAnalyticSameNodeStencil:{position:compare(col,a.stencilColumns[j],0),rate:compare(col,a.stencilColumns[j],1)},analyticSameNodeStencilVsDerivative:{position:compare(a.stencilColumns[j].map(Number),a.columns[j],0),rate:compare(a.stencilColumns[j].map(Number),a.columns[j],1)}})),
 rawNativeCenterAndColumnsSHA256:hash(JSON.stringify({residuals:c.center.residuals,columns:c.columns})),
 points:c.points.map(compactTrial)
 };
});
const actualSteps=cases.reduce((sum,c)=>sum+c.points.reduce((sum,t)=>sum+t.runs.reduce((sum,r)=>sum+r.resolution.combinedSteps,0),0),0);
assert.equal(actualSteps,reserved.steps);
for(const pin of p.originalSourcePins)assert.equal(hash(fs.readFileSync(path.join(root,pin.path))),pin.sha256,pin.path);
assert.equal(JSON.stringify(original),originalText);
const index=process.execArgv.indexOf('-e');const executed=index>=0?process.execArgv[index+1]:fs.readFileSync(new URL(import.meta.url),'utf8');
const referenceSummary={...reference,snapshots:reference.snapshots.map(({residuals,columns,stencilColumns,...r})=>r)};
const receipt={
experiment:'fixed-state-joint-gradient-resolution',
node:process.version,pid:process.pid,started,finished:new Date().toISOString(),
source:{originalCommit:p.originalSourceCommit,combinedCommit:p.combinedSourceCommit,receivingCommit:p.receivingCommit,sourcePins:p.originalSourcePins,actualLoads:loads,fitSHA256:hash(p.candidateFit),helperSHA256:hash(p.correctedHelper),fixtureTestSHA256:hash(p.fixtureTest),fixtureFunctionSHA256:hash(fixtureSource),inputSHA256:hash(originalText),capsuleSHA256:hash(payloadText),driverSHA256:hash(executed),pythonReferenceSHA256:hash(pythonSource),extractedEvaluatorSHA256:hash(evaluateBody),extractedHelperPrefixSHA256:hash(helperPrefix),diagnosticFactorySHA256:hash(factory),diagnosticColumnModuleSHA256:hash(inspector)},
admission:{reservationRows,reserved,actualSteps,stepCap:p.stepCap,predictionRowCap:p.predictionRowCap},
protocol:{snapshots:p.snapshots.map(s=>({name:s.name,trial:s.index,values:s.values})),maxSteps:p.maxSteps,originalFixture:original,probeConstruction:'Exact corrected helper source prefix through gradient construction; diagnostic return before free-set selection, least-squares solve or proposals.',evaluation:'Exact candidate fitter modelFor and evaluate bodies in a diagnostic factory, using the real pinned receiver; saved boundary states are evaluated directly, not admitted as new fitter seeds.',reference:'Analytically differentiated continuous underdamped oscillator; same-node finite-difference reference; fixed original binary64 rows and starts; Decimal80 and120 digits with independent181-term ODE Taylor controls.'},
checks:{allOriginalInputsPreserved:true,all29SourceFilesUnchanged:true,all30ModelVectorsComplete:true,all90ReceiverCallsScreened:true,actualStepsEqualReservation:true,savedCentersReproducedExactlyAtOriginalStep:true,finalProbeCoordinatesEqualHistoricalTrials36To39:true,sameProbesAtAllResolutions:true,helperPrefixExcludesLeastSquaresAndProposals:true,pythonReceivedExactBinary64OriginalNumbers:true},
cases:summaries,reference:{...referenceSummary,inputBytes:Buffer.byteLength(referenceText),outputBytes:Buffer.byteLength(child.stdout),outputSHA256:hash(child.stdout)},
historicalLastProposals:p.lastProposals.map(t=>({index:t.index,values:t.values,rmse:t.rmse,rmsMinusBest:t.rmse-p.snapshots[1].rmse})),
limits:'Fixed-state diagnostic only: no optimizer rerun, model/source/admission change, new stopping rule, crossover or generalized derivative policy. Full residual and column arrays were used in memory and hashed; summaries and exact reproducible source are retained. Decimal precision agreement is not interval certification. No browser, clean checkout, physical validity, predictive improvement or global optimum claim.'
};
console.log(JSON.stringify({phase:'complete',receipt}));
