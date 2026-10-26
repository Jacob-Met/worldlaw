/** Plan a complete permitted course against both frozen loss-only alternatives. */
import {readCouplingNotebook} from './notebook.mjs';
import {readVelocityStudy,compareVelocityStudy} from './velocity-comparison.mjs';
import {readReleaseSettings} from './viscous-release.mjs';
import {discoverCoupling,requireThat} from './science.mjs';
import {defaultDynamicsInputs,readDynamicsInputs,compareCoupledDynamics,reserveDynamicsSteps,STEP_BUDGET,SKEW_INPUT_SCHEMA,SKEW_INTERPRETATION} from './dynamics.mjs';
import {compactReleaseTrajectory,compareRetainedReleasePair,rankReleaseScores} from './release-common.mjs';

export const VELOCITY_RELEASE_SCHEMA='worldlaw.velocity-release-study/v1';
const FAMILY_KEYS=['diagonal','symmetric','skew'],MAX_BYTES=10*1024*1024;
const NUMERICAL=['duration','samples','maxStep','positionTolerance','rateTolerance'];
const clone=x=>JSON.parse(JSON.stringify(x));
function object(value,keys,label,{optional=[]}={}){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),label+' must be a plain object.');
 const own=Reflect.ownKeys(value);
 requireThat(keys.every(k=>own.includes(k))&&own.every(k=>typeof k==='string'&&[...keys,...optional].includes(k)),label+' contains missing or unsupported fields.');
 for(const k of own)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)??{},'value'),label+' cannot contain accessors.');
}

export function readVelocityReleaseStudy(input){
 if(typeof input==='string'){
  requireThat(input.length<=MAX_BYTES&&new TextEncoder().encode(input).length<=MAX_BYTES,'Velocity release study exceeds 10 MiB.','size_limit');
  try{input=JSON.parse(input);}catch{throw Error('Velocity release study must be valid JSON.');}
 }
 object(input,['schema','response','velocity','settings'],'Velocity release study');
 requireThat(input.schema===VELOCITY_RELEASE_SCHEMA,'Choose an explicit WORLDLAW velocity release study.');
 const response=readCouplingNotebook(input.response);
 requireThat(response.permitted.length>0,'Supply at least one explicitly permitted angle pair.');
 return {schema:VELOCITY_RELEASE_SCHEMA,response,velocity:readVelocityStudy(input.velocity),settings:readReleaseSettings(input.settings)};
}

export function exportVelocityReleaseStudy(input){
 const text=JSON.stringify(readVelocityReleaseStudy(input),null,2)+'\n';
 requireThat(new TextEncoder().encode(text).length<=MAX_BYTES,'Velocity release study exceeds 10 MiB.','size_limit');return text;
}

export function velocityReleaseDynamicsInputs(parameters,position,rawSettings){
 object(parameters,['inertia','damping'],'Velocity family parameters',{optional:['inertiaCross','dampingCross','velocitySkew']});
 const settings=readReleaseSettings(rawSettings),d=defaultDynamicsInputs();
 return readDynamicsInputs({...d,schema:SKEW_INPUT_SCHEMA,interpretation:SKEW_INTERPRETATION,
  units:{...d.units,velocitySkew:'N·m·s/rad'},inertia:parameters.inertia,inertiaCross:parameters.inertiaCross??0,
  damping:parameters.damping,dampingCross:parameters.dampingCross??0,velocitySkew:parameters.velocitySkew??0,
  initialPosition:position,initialRate:[0,0],
  declaration:('Conditional training-fitted velocity hypothesis. '+settings.correspondence).slice(0,1000),
  ...Object.fromEntries(NUMERICAL.map(k=>[k,settings[k]]))});
}

/** The same released state, clocks and solver for every family. The public
 * proposal supplies these parameters only from the original training fits.
 */
export function compareVelocityReleaseCourses(models,families,positions,rawSettings,{refusedModels=[]}={}){
 const settings=readReleaseSettings(rawSettings);
 object(families,FAMILY_KEYS,'Complete velocity family comparison');
 requireThat(Array.isArray(positions)&&positions.length>=1&&positions.length<=512,'Compare every one of at most 512 permitted positions.');
 requireThat(new Set(positions.map(p=>JSON.stringify(p))).size===positions.length,'Permitted release positions must be distinct.');
 requireThat(Array.isArray(models)&&models.length>=1&&models.length<=6,'Supply one to six retained executable responses.');
 // Every family and position is admitted before reserving the entire product.
 const inputs=positions.map(q=>FAMILY_KEYS.map(k=>velocityReleaseDynamicsInputs(families[k],q,settings)));
 requireThat(inputs.every(a=>a[0].dampingCross===0&&a[0].velocitySkew===0&&a[1].velocitySkew===0),'Loss-only alternatives must retain their declared diagonal/symmetric structures and zero skew.');
 const reservation=reserveDynamicsSteps(inputs[0][0],models.length,positions.length*FAMILY_KEYS.length);
 const releases=inputs.map((course,index)=>{
  const [diagonal,symmetric,skew]=course.map(input=>compareCoupledDynamics(models,input));
  const comparisons=models.flatMap((model,i)=>[['diagonal',diagonal],['symmetric',symmetric]].map(([baselineFamily,baseline])=>{
   const a=baseline.results[i],b=skew.results[i];
   return {modelId:model.id,label:model.label??model.id,baselineFamily,
    baseline:compactReleaseTrajectory(a),skew:compactReleaseTrajectory(b),...compareRetainedReleasePair(a,b)};
  }));
  const complete=comparisons.every(c=>c.screened)&&refusedModels.length===0;
  return {index,position:[...positions[index]],initialRate:[0,0],
   status:complete?'screened':refusedModels.length?'response_incomplete':'numerically_unresolved',
   score:complete?Math.min(...comparisons.map(c=>c.peak.separation)):null,comparisons};
 });
 return {...rankReleaseScores(releases,settings),releases,refusedModels:clone(refusedModels),
  diagnostics:{reservedSteps:reservation.requiredSteps,stepBudget:STEP_BUDGET,
   candidateCount:positions.length,velocityFamilyCount:3,responseCount:models.length,
   trajectoryCount:positions.length*3*models.length,pairCountPerRelease:2*models.length,
   objective:'For each response law and each loss-only alternative, maximum sampled Euclidean angle separation from the skew alternative; then minimum across every such pair.',
   minimumSeparation:settings.minimumSeparation,tieTolerance:settings.tieTolerance,
   numericalMeaning:'Peaks may occur at different times: this proposes a whole sampled course, not one simultaneously separating reading. Step agreement is not an error bound. Thresholds are declared comparison settings, not measured uncertainty.',
   interpretation:'All fitted M, D and G values may differ. Separation of these complete fitted explanations does not uniquely identify G or its cause.',
   permissionMeaning:'Permitted quasi-static positions do not establish dynamic reachability, safety or observability.',
   selectedVelocityFamily:null,physicalValidity:'not_established'}};
}

export function proposeVelocityReleases(input){
 const source=readVelocityReleaseStudy(input);
 const discovery=discoverCoupling([...source.response.training,...source.response.revisions.map(r=>r.observation)],source.response.options);
 // Held motion and response observations are retained in source, never fitted
 // or used to remove an alternative, rank a release, or tune settings here.
 const comparison=compareVelocityStudy({...source.velocity,challenge:null});
 const fits=Object.fromEntries(FAMILY_KEYS.map(k=>[k,comparison[k].primary]));
 const families={diagonal:fits.diagonal.simulationParameters?clone(fits.diagonal.simulationParameters):null,
  symmetric:fits.symmetric.simulationParameters?clone(fits.symmetric.simulationParameters):null,
  skew:fits.skew.candidateParameters?clone(fits.skew.candidateParameters):null};
 const training={fits:Object.fromEntries(Object.entries(fits).map(([k,f])=>[k,{status:f.status,rank:f.rank,parameters:f.parameters,
  coefficients:f.coefficients??null,refusal:f.refusal??null,conditionEstimate:f.conditionEstimate??null,
  meanTorqueBalanceRmse:f.meanTorqueBalanceRmse??null}])),families,
  responseModels:discovery.candidates.map(m=>({id:m.id,label:m.label,trainingRmse:m.metrics.rmse})),
  responseAdequacy:discovery.diagnostics.adequacy,quadratureSegments:comparison.diagnostics.reservedSegments,
  separateMotionUsed:false,separateResponseUsed:false};
 if(FAMILY_KEYS.some(k=>!families[k])||!discovery.candidates.length)return {
  schema:'worldlaw.velocity-release-comparison/v1',source,training,status:'unsupported_training',
  releases:source.response.permitted.map((position,index)=>({index,position:[...position],initialRate:[0,0],status:'unsupported_training',score:null,comparisons:[]})),
  rankedIndices:[],bestIndices:[],proposedIndices:[],refusedModels:discovery.refused,
  diagnostics:{reservedSteps:0,stepBudget:STEP_BUDGET,selectedVelocityFamily:null,physicalValidity:'not_established'}};
 return {schema:'worldlaw.velocity-release-comparison/v1',source,training,
  ...compareVelocityReleaseCourses(discovery.candidates,families,source.response.permitted,source.settings,{refusedModels:discovery.refused})};
}
