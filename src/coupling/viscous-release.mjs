import {compactReleaseTrajectory as compact,compareRetainedReleasePair,rankReleaseScores} from './release-common.mjs';
/** Propose zero-rate releases across the complete explicitly permitted set.
 * Training fixes both loss fits and every response law before any course runs.
 */
import {readCouplingNotebook} from './notebook.mjs';
import {readViscousStudy,compareViscousStudy} from './viscous-comparison.mjs';
import {discoverCoupling,requireThat,finite} from './science.mjs';
import {defaultDynamicsInputs,readDynamicsInputs,compareCoupledDynamics,reserveDynamicsSteps,STEP_BUDGET,LOSS_INPUT_SCHEMA,LOSS_INTERPRETATION} from './dynamics.mjs';

export const RELEASE_SCHEMA='worldlaw.viscous-release-study/v1';
const MAX_BYTES=10*1024*1024;
const SETTINGS=['correspondence','duration','samples','maxStep','positionTolerance','rateTolerance','minimumSeparation','tieTolerance'];
const clone=value=>JSON.parse(JSON.stringify(value));
function object(value,keys,label){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),label+' must be a plain object.');
 const own=Reflect.ownKeys(value);
 requireThat(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)),label+' contains missing or unsupported fields.');
 for(const k of keys)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)??{},'value'),label+' cannot contain accessors.');
}
export function defaultReleaseSettings(){
 const d=defaultDynamicsInputs();
 return {correspondence:'The user declares the same apparatus, angle coordinates and torque conventions for these response and motion sources.',duration:d.duration,samples:d.samples,maxStep:d.maxStep,positionTolerance:d.positionTolerance,rateTolerance:d.rateTolerance,minimumSeparation:.01,tieTolerance:.000001};
}
export function readReleaseSettings(raw){
 object(raw,SETTINGS,'Release settings');
 requireThat(typeof raw.correspondence==='string'&&raw.correspondence.trim().length>0&&raw.correspondence.length<=1000,'Declare source correspondence in at most 1000 characters.');
 const d=readDynamicsInputs({...defaultDynamicsInputs(),...Object.fromEntries(['duration','samples','maxStep','positionTolerance','rateTolerance'].map(k=>[k,raw[k]]))});
 for(const k of ['minimumSeparation','tieTolerance'])requireThat(finite(raw[k],k,1e3)>=1e-12,k+' must be at least 1e-12 radians.');
 return {correspondence:raw.correspondence,...Object.fromEntries(['duration','samples','maxStep','positionTolerance','rateTolerance'].map(k=>[k,d[k]])),minimumSeparation:raw.minimumSeparation,tieTolerance:raw.tieTolerance};
}
export function readViscousReleaseStudy(input){
 if(typeof input==='string'){
  requireThat(input.length<=MAX_BYTES&&new TextEncoder().encode(input).length<=MAX_BYTES,'Release study exceeds 10 MiB.','size_limit');
  try{input=JSON.parse(input);}catch{throw new Error('Release study must be valid JSON.');}
 }
 object(input,['schema','response','viscous','settings'],'Release study');
 requireThat(input.schema===RELEASE_SCHEMA,'Choose a WORLDLAW viscous release study.');
 const response=readCouplingNotebook(input.response);
 requireThat(response.permitted.length>0,'Supply at least one explicitly permitted angle pair.');
 return {schema:RELEASE_SCHEMA,response,viscous:readViscousStudy(input.viscous),settings:readReleaseSettings(input.settings)};
}
export function exportViscousReleaseStudy(input){
 const text=JSON.stringify(readViscousReleaseStudy(input),null,2)+'\n';
 requireThat(new TextEncoder().encode(text).length<=MAX_BYTES,'Release study exceeds 10 MiB.','size_limit');return text;
}
export function releaseDynamicsInputs(parameters,position,settings){
 const s=readReleaseSettings(settings);
 return readDynamicsInputs({...defaultDynamicsInputs(),schema:LOSS_INPUT_SCHEMA,interpretation:LOSS_INTERPRETATION,
  ...parameters,dampingCross:parameters.dampingCross??0,initialPosition:[...position],initialRate:[0,0],
  declaration:('Conditional training-fitted loss hypothesis. '+s.correspondence).slice(0,1000),
  ...Object.fromEntries(['duration','samples','maxStep','positionTolerance','rateTolerance'].map(k=>[k,s[k]]))});
}
/** Low-level comparison also serves independent analytic receiving controls.
 * Public study proposals obtain these arguments only from admitted training.
 */
export function compareReleaseCourses(models,families,positions,rawSettings,{refusedModels=[]}={}){
 const settings=readReleaseSettings(rawSettings);
 requireThat(Array.isArray(positions)&&positions.length>=1&&positions.length<=512,'Compare every one of at most 512 permitted positions.');
 requireThat(new Set(positions.map(p=>JSON.stringify(p))).size===positions.length,'Permitted release positions must be distinct.');
 requireThat(Array.isArray(models)&&models.length>=1&&models.length<=6,'Supply one to six retained executable responses.');
 requireThat(families&&families.diagonal&&families.symmetric,'Both training-fitted loss families must be executable.');
 // Admit all families and every release before reserving or executing any path.
 const inputs=positions.map(p=>['diagonal','symmetric'].map(k=>releaseDynamicsInputs(families[k],p,settings)));
 requireThat(inputs.every(pair=>pair[0].dampingCross===0),'The independent-loss family must have zero cross loss.');
 const reservation=reserveDynamicsSteps(inputs[0][0],models.length,positions.length*2);
 const releases=inputs.map((pair,index)=>{
  const [diagonal,symmetric]=pair.map(input=>compareCoupledDynamics(models,input));
  const comparisons=models.map((model,i)=>{
   const a=diagonal.results[i],b=symmetric.results[i];
   return {modelId:model.id,label:model.label??model.id,diagonal:compact(a),symmetric:compact(b),...compareRetainedReleasePair(a,b)};
  });
  const complete=comparisons.every(c=>c.screened)&&refusedModels.length===0;
  const score=complete?Math.min(...comparisons.map(c=>c.peak.separation)):null;
  return {index,position:[...positions[index]],initialRate:[0,0],status:complete?'screened':refusedModels.length?'response_incomplete':'numerically_unresolved',score,comparisons};
 });
 const {status,rankedIndices,bestIndices,proposedIndices}=rankReleaseScores(releases,settings);
 return {status,releases,rankedIndices,bestIndices,proposedIndices,refusedModels:clone(refusedModels),
  diagnostics:{reservedSteps:reservation.requiredSteps,stepBudget:STEP_BUDGET,
   candidateCount:positions.length,lossFamilyCount:2,responseCount:models.length,trajectoryCount:positions.length*2*models.length,
   objective:'For each response law, maximum Euclidean angle separation at common output times; then minimum across every retained response law.',
   minimumSeparation:settings.minimumSeparation,tieTolerance:settings.tieTolerance,
   numericalMeaning:'Two step sizes agreeing is not an error bound. Peaks are sampled, not continuous-time maxima. Thresholds are declared comparison settings, not measured uncertainty.',
   permissionMeaning:'Permitted positions come from the quasi-static notebook. Their dynamic reachability, safety and observability are not established.',
   selectedLossFamily:null,physicalValidity:'not_established'}};
}
export function proposeViscousReleases(input){
 const source=readViscousReleaseStudy(input);
 // Never use separate observations, even for selecting which response to retain.
 const discovery=discoverCoupling([...source.response.training,...source.response.revisions.map(r=>r.observation)],source.response.options);
 const comparison=compareViscousStudy({...source.viscous,challenge:null});
 const fits={diagonal:comparison.diagonal.primary,symmetric:comparison.symmetric.primary};
 const families=Object.fromEntries(Object.entries(fits).map(([k,f])=>[k,f.simulationParameters?clone(f.simulationParameters):null]));
 const training={fits:Object.fromEntries(Object.entries(fits).map(([k,f])=>[k,{status:f.status,rank:f.rank,parameters:f.parameters,coefficients:f.coefficients??null,refusal:f.refusal??null,meanTorqueBalanceRmse:f.meanTorqueBalanceRmse??null}])),
  families,responseModels:discovery.candidates.map(m=>({id:m.id,label:m.label,trainingRmse:m.metrics.rmse})),
  responseAdequacy:discovery.diagnostics.adequacy,quadratureSegments:comparison.diagnostics.reservedSegments,
  separateMotionUsed:false,separateResponseUsed:false};
 if(!families.diagonal||!families.symmetric||!discovery.candidates.length)return {
  schema:'worldlaw.viscous-release-comparison/v1',source,training,status:'unsupported_training',
  releases:source.response.permitted.map((position,index)=>({index,position:[...position],initialRate:[0,0],status:'unsupported_training',score:null,comparisons:[]})),
  rankedIndices:[],bestIndices:[],proposedIndices:[],refusedModels:discovery.refused,
  diagnostics:{reservedSteps:0,stepBudget:STEP_BUDGET,selectedLossFamily:null,physicalValidity:'not_established'}};
 return {schema:'worldlaw.viscous-release-comparison/v1',source,training,
  ...compareReleaseCourses(discovery.candidates,families,source.response.permitted,source.settings,{refusedModels:discovery.refused})};
}
