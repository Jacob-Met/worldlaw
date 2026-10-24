/** Complete-output numerical evidence, reusing maintained bounded search/checks. */
import {inspectCoupledResponseRegions} from './response-region.mjs';
import {analyzeCouplingNotebook} from './notebook.mjs';
import {discoverCoupling,predictCoupling,requireThat} from './science.mjs';
import {checkLinearEnvelopeSeparator,checkLinearEnvelopeOffsets} from '../science/shared-training-check.mjs';
import {searchPreparedLinearEnvelope,SHARED_SEARCH_MAX_ITERATIONS,SHARED_SEARCH_MAX_PRODUCTS} from '../science/shared-training-search.mjs';
export const COUPLED_COURSE_SOURCE='worldlaw.coupled-shared-course-source/v1';
export const COUPLED_COURSE_CERTIFICATE='worldlaw.coupled-shared-course-certificate/v1';
export const COUPLED_COURSE_REPLAY='worldlaw.coupled-shared-course-replay/v1';
export const COUPLED_COURSE_MAX_BYTES=4*1024*1024;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const accepted=s=>['verified-interior-witness','verified-separation'].includes(s);
const qualification='Checked numerical evidence for the computed fixed-coordinate, fixed-structure least-squares sensitivity family. Engineering screens do not certify all QR error, probability, physical feasibility or law adequacy. Search exhaustion is unresolved.';
function prepare(rawNotebook,rawPath,trainingRadius,modelId){
 const report=inspectCoupledResponseRegions(rawNotebook,rawPath,trainingRadius),candidate=report.candidates.find(c=>c.modelId===modelId);
 requireThat(candidate?.status==='computed',candidate?.reason??'Select an available retained fitted structure.');
 const source={schema:COUPLED_COURSE_SOURCE,notebook:report.notebook,path:report.path,trainingRadius:report.trainingRadius,modelId},sourceKey=JSON.stringify(source);
 const rows=candidate.rows.flatMap(r=>[0,1].map(axis=>({index:r.index*2+axis,sourceRow:r.index,axis,influence:r.generators.map(g=>g[axis]),observedTorque:r.observed[axis],refittedPrediction:r.center[axis],independentCoefficientBoxRadius:r.generators.reduce((s,g)=>s+Math.abs(g[axis]),0),numericalTolerance:r.witness.numericalTolerance})));
 const receivingRadii=candidate.rows.flatMap(r=>r.readingRadius),training=report.trainingIds.flatMap((id,index)=>[0,1].map(axis=>({id,index,axis})));
 // Unit-box coordinates consume already scaled generators, including radius0.
 const context={status:'prepared',source,sourceKey,report,candidate,training,receivingRadii,marginal:{rows,settings:{trainingRadius:1}}};
 return context;
}
function admitSource(source){
 requireThat(exact(source,['schema','notebook','path','trainingRadius','modelId'])&&source.schema===COUPLED_COURSE_SOURCE,'Retain original coupled course source fields only.');
 return prepare(source.notebook,source.path,source.trainingRadius,source.modelId);
}
function checkPrepared(context,certificate){
 requireThat(exact(certificate,['schema','sourceKey','kind','values'])&&certificate.schema===COUPLED_COURSE_CERTIFICATE&&['training-offsets','receiving-separator'].includes(certificate.kind),'Malformed coupled course candidate; cached verdicts are not accepted.');
 requireThat(certificate.sourceKey===context.sourceKey,'The original notebook, loop order, structure or bounds changed. Recompute the candidate.');
 const expected=certificate.kind==='training-offsets'?context.training.length:context.marginal.rows.length;
 requireThat(Array.isArray(certificate.values)&&certificate.values.length===expected&&certificate.values.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1),'Keep one bounded finite value for every original source coordinate.');
 const rows=context.marginal.rows,values=certificate.values;
 if(certificate.kind==='receiving-separator'){
  requireThat(values.some(v=>v!==0),'A receiving separator must be nonzero.');
  return {...checkLinearEnvelopeSeparator(rows,values,1,context.receivingRadii),qualification};
 }
 const analysis=analyzeCouplingNotebook(context.source.notebook),physicalOffsets=values.map(v=>v*context.source.trainingRadius);
 let model,refittedPredictions;
 try{
  const training=analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+physicalOffsets[2*i+a])}));
  model=discoverCoupling(training,context.source.notebook.options).candidates.find(m=>m.id===context.source.modelId);
  if(!model)return {status:'unresolved',reason:'independent-coupled-refit-unavailable',qualification};
  refittedPredictions=context.report.path.samples.flatMap(r=>predictCoupling(model,r.q));
 }catch{return {status:'unresolved',reason:'independent-coupled-refit-refused',qualification};}
 const coefficients=[...model.matrix.flat(),...model.bias];
 return {...checkLinearEnvelopeOffsets(rows,values,context.receivingRadii,refittedPredictions,coefficients),physicalOffsets,refittedModel:model,qualification};
}
export function checkCoupledCourseCertificate(source,certificate){return checkPrepared(admitSource(source),certificate);}
export function searchCoupledSharedCourse(notebook,path,trainingRadius,modelId,options={}){
 requireThat(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(k=>['maxIterations','maxProducts'].includes(k)),'Declare only iteration and matrix-term search budgets.');
 const declared={maxIterations:options.maxIterations??512,maxProducts:options.maxProducts??16777216};
 requireThat(Number.isSafeInteger(declared.maxIterations)&&declared.maxIterations>=0&&declared.maxIterations<=SHARED_SEARCH_MAX_ITERATIONS&&Number.isSafeInteger(declared.maxProducts)&&declared.maxProducts>=0&&declared.maxProducts<=SHARED_SEARCH_MAX_PRODUCTS,'Search budgets must be bounded nonnegative integers.');
 const context=prepare(notebook,path,trainingRadius,modelId);
 const base={schema:'worldlaw.coupled-shared-course/v1',source:context.source,modelId,label:context.candidate.label,settings:{trainingRadius,...declared},trainingCoordinateCount:context.training.length,receivingCoordinateCount:context.marginal.rows.length,status:'unresolved',certificate:null,check:null,iterationsPerformed:0,matrixTermsUsed:0,interpretation:qualification};
 return searchPreparedLinearEnvelope(context,declared,base,{
  makeCertificate:(kind,values)=>({schema:COUPLED_COURSE_CERTIFICATE,sourceKey:context.sourceKey,kind,values:[...values]}),
  checkCandidate:certificate=>checkPrepared(context,certificate),
  recheck:certificate=>checkCoupledCourseCertificate(context.source,certificate),
 });
}
export function serializeCoupledCourseCertificate(source,certificate){
 const check=checkCoupledCourseCertificate(source,certificate);requireThat(accepted(check.status),`Candidate did not pass fresh source checking: ${check.reason}.`);
 const text=JSON.stringify({schema:COUPLED_COURSE_REPLAY,source,certificate},null,2);requireThat(new TextEncoder().encode(text).length<=COUPLED_COURSE_MAX_BYTES,'Coupled course replay exceeds4MiB.');return text;
}
export function reopenCoupledCourseCertificate(text){
 requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=COUPLED_COURSE_MAX_BYTES,'Coupled course replay exceeds4MiB.');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('Coupled course replay must be valid JSON.');}
 requireThat(exact(raw,['schema','source','certificate'])&&raw.schema===COUPLED_COURSE_REPLAY,'Retain source and candidate only; cached verdicts are not accepted.');
 const check=checkCoupledCourseCertificate(raw.source,raw.certificate);requireThat(accepted(check.status),`Candidate did not pass fresh source checking: ${check.reason}.`);
 return {source:raw.source,certificate:raw.certificate,check,interpretation:qualification};
}
