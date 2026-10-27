import {MAX_ROWS,MAX_TEXT_LENGTH,validateRows} from '../data.mjs';
import {createStiffnessStudy,exportStiffnessStudy,importStiffnessStudy} from './notebook.mjs';
import {predictStiffness} from './science.mjs';
export const EXPERIMENT_SCHEMA='worldlaw.stiffness-experiment/v1';
export const REVISED_EXPERIMENT_SCHEMA='worldlaw.stiffness-experiment/v2';
export const REQUEST_SCHEMA='worldlaw.stiffness-request/v1';
export const REVISED_REQUEST_SCHEMA='worldlaw.stiffness-request/v2';
const axes=['command','position','rate'];
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const copy=value=>structuredClone(value);
function exactKeys(value,allowed,label){
 need(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object.');
 need(Object.keys(value).every(k=>allowed.includes(k)),label+' contains an unsupported field.');
}
function label(value,name,max=240){
 need(typeof value==='string'&&value.trim().length>0&&value.length<=max,name+' needs a nonempty label of at most '+max+' characters.');
 return value;
}
export function normalizePermittedStates(raw){
 need(Array.isArray(raw)&&raw.length<=512,'Declare at most 512 permitted input states.');
 const states=raw.map((state,index)=>{
  exactKeys(state,axes,'Permitted state '+index);
  return Object.fromEntries(axes.map(axis=>{
   const value=state[axis];need(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e6,axis+' must be finite within ±1,000,000.');
   return [axis,value];
  }));
 });
 need(new Set(states.map(s=>JSON.stringify(s))).size===states.length,'Permitted input states must be distinct.');
 return states;
}
export function planStiffness(fit,rawPermitted){
 need(['worldlaw.stiffness-investigation/v1','worldlaw.stiffness-investigation/v2'].includes(fit?.schema),'Expected the current training investigation.');
 const permitted=normalizePermittedStates(rawPermitted),models=fit.competitive;
 const ranked=permitted.map((state,index)=>{
  const predictions=models.map(model=>({family:model.family,knot:model.knot,...(model.family==='cubic'?{origin:model.origin}:{}),torque:predictStiffness(model,state)}));
  const values=predictions.map(p=>p.torque),spread=values.length?Math.max(...values)-Math.min(...values):0;
  return {index,state,predictions,spread,extrapolated:axes.filter(k=>state[k]<fit.domain[k].min||state[k]>fit.domain[k].max)};
 });
 ranked.sort((a,b)=>b.spread-a.spread||a.index-b.index);
 const status=!ranked.length?'no_permitted_inputs':!fit.selected?'unidentifiable':
  fit.diagnostics.adequacy==='training_mismatch'?'model_mismatch':
  models.length<2||ranked[0].spread<=2*fit.settings.noiseSigma?'uninformative':'proposed';
 return {status,selected:status==='proposed'?ranked[0]:null,ranked,
  threshold:2*fit.settings.noiseSigma,method:'finite_training_model_spread',
  interpretation:'Spread above twice the declared noise is a heuristic. This is not information gain, confidence, physical safety or authority to actuate.'};
}
function stateBinding(session){
 return JSON.stringify({observations:session.study.dataset.observations,settings:session.study.settings,
  permitted:session.permitted,initialObservations:session.initial.dataset.observations,
  initialSettings:session.initial.settings,acquisitions:session.acquisitions,
  ...(session.revisions?.length?{familyRevisions:session.revisions}:{})});
}
function frozenRequest(session,index,fit=session.study.fit){
 need(Number.isInteger(index)&&index>=0&&index<session.permitted.length,'Select an explicitly permitted state.');
 const plan=planStiffness(fit,session.permitted),row=plan.ranked.find(r=>r.index===index);
 return {schema:session.revisions?.length?REVISED_REQUEST_SCHEMA:REQUEST_SCHEMA,revision:session.acquisitions.length,index,state:copy(row.state),
  predictions:copy(row.predictions),spread:row.spread,extrapolated:[...row.extrapolated],planStatus:plan.status,
  binding:stateBinding(session)};
}
export function freezeStiffnessRequest(session,index){
 const input=experimentInputs(session);input.pending=null;
 const canonical=replayStiffnessExperiment(input);
 need(JSON.stringify(canonical.study.dataset.observations)===JSON.stringify(session.study.dataset.observations)&&
  JSON.stringify(canonical.study.settings)===JSON.stringify(session.study.settings)&&
  JSON.stringify(canonical.history)===JSON.stringify(session.history),
  'The session inputs or displayed training state were modified; reopen canonical inputs before freezing.');
 return frozenRequest(canonical,index);
}
function normalizeAcquisition(raw,permitted){
 exactKeys(raw,['id','index','source','observation'],'Acquisition');
 const id=label(raw.id,'Acquisition ID',100),index=raw.index;
 need(Number.isInteger(index)&&index>=0&&index<permitted.length,'Acquisition references an undeclared input.');
 exactKeys(raw.source,['label','declaredKind'],'Acquisition source');
 const source={label:label(raw.source.label,'Acquisition source'),declaredKind:label(raw.source.declaredKind,'Acquisition source kind',100)};
 exactKeys(raw.observation,[...axes,'jointTorque'],'Acquisition observation');
 const [observation]=validateRows([raw.observation],{allowEmpty:true});
 need(axes.every(k=>observation[k]===permitted[index][k]),'Received coordinates differ from the frozen permitted state.');
 return {id,index,source,observation};
}
function workLimit(initial,acquisitionCount,revisionCount=0){
 need(acquisitionCount<=32,'At most 32 sequential acquisitions are supported.');
 need(initial.dataset.observations.length+acquisitionCount<=MAX_ROWS,'Acquisition exceeds the maintained observation bound.');
 const work=(acquisitionCount+1+revisionCount)*(initial.dataset.observations.length+acquisitionCount)*(initial.settings.knots.length+1+revisionCount);
 need(work<=2_000_000,'The replay exceeds its declared fit-work budget; reduce the grid, initial rows or acquisitions.');
}
/** Read-only capacity for one additional reading; reuse replay admission without inventing an outcome. */
export function stiffnessAcquisitionAvailability(session){
 try{
  workLimit(session.initial,session.acquisitions.length+1,session.revisions?.length??0);
  return {available:true,reason:null};
 }catch(error){return {available:false,reason:error.message};}
}
export function createStiffnessExperiment(study,rawPermitted){
 const {cubicOrigin,...originalSettings}=study.settings;
 const revised=Object.hasOwn(study.settings,'cubicOrigin');
 const original=revised?createStiffnessStudy(study.dataset,originalSettings):study;
 return replayStiffnessExperiment({schema:revised?REVISED_EXPERIMENT_SCHEMA:EXPERIMENT_SCHEMA,
  initial:JSON.parse(exportStiffnessStudy(original)),permitted:rawPermitted,acquisitions:[],pending:null,
  ...(revised?{revisions:[{at:0,kind:'smooth_cubic',origin:cubicOrigin,reason:'Explicit cubic declaration retained from the supplied study.'}]}:{})});
}
function normalizeRevisions(raw,count){
 need(Array.isArray(raw)&&raw.length===1,'A revised experiment must retain exactly one explicit family expansion.');
 return raw.map(revision=>{
  exactKeys(revision,['at','kind','origin','reason'],'Family revision');
  need(Number.isInteger(revision.at)&&revision.at>=0&&revision.at<=count,'Family revision must name a retained acquisition boundary.');
  need(revision.kind==='smooth_cubic','Unsupported stiffness family revision.');
  need(typeof revision.origin==='number'&&Number.isFinite(revision.origin)&&Math.abs(revision.origin)<=1e6,'Cubic origin must be finite within ±1,000,000 radians.');
  return {at:revision.at,kind:'smooth_cubic',origin:revision.origin,reason:label(revision.reason,'Family revision reason')};
 });
}
const fitSnapshot=fit=>({status:fit.status,adequacy:fit.diagnostics.adequacy,
 family:fit.selected?.family??null,knot:fit.selected?.knot??null,trainingRmse:fit.selected?.metrics.rmse??null});
export function replayStiffnessExperiment(raw){
 const revised=raw?.schema===REVISED_EXPERIMENT_SCHEMA;
 exactKeys(raw,['schema','initial','permitted','acquisitions','pending',...(revised?['revisions']:[])],'Experiment notebook');
 need(revised||raw.schema===EXPERIMENT_SCHEMA,'Expected an input-only stiffness experiment notebook.');
 const initialStudy=importStiffnessStudy(JSON.stringify(raw.initial));
 need(!Object.hasOwn(initialStudy.settings,'cubicOrigin'),'The initial experiment must retain the original family; declare its expansion as an explicit revision.');
 const initial=JSON.parse(exportStiffnessStudy(initialStudy)),permitted=normalizePermittedStates(raw.permitted);
 need(Array.isArray(raw.acquisitions)&&raw.acquisitions.length<=32,'Retain at most 32 sequential acquisitions.');
 const acquisitions=raw.acquisitions.map(a=>normalizeAcquisition(a,permitted));
 need(new Set(acquisitions.map(a=>a.id)).size===acquisitions.length,'Acquisition IDs must be unique.');
 const revisions=revised?normalizeRevisions(raw.revisions,acquisitions.length):[];
 workLimit(initial,acquisitions.length,revisions.length);
 let study=initialStudy;const session={schema:EXPERIMENT_SCHEMA,initial,permitted,acquisitions:[],study,history:[],pending:null};
 for(let index=0;index<=acquisitions.length;index++){
  if(revisions[0]?.at===index){
   const revision=revisions[0],before=fitSnapshot(study.fit);
   study=createStiffnessStudy(study.dataset,{...initial.settings,cubicOrigin:revision.origin});
   session.schema=REVISED_EXPERIMENT_SCHEMA;session.revisions=copy(revisions);session.study=study;
   session.revisionEvidence={...copy(revision),before,after:fitSnapshot(study.fit)};
  }
  if(index===acquisitions.length)break;
  const acquisition=acquisitions[index];
  const request=frozenRequest(session,acquisition.index);
  const errors=request.predictions.map(p=>({...p,residual:acquisition.observation.jointTorque-p.torque}));
  session.history.push({request,acquisition:copy(acquisition),errors});
  session.acquisitions.push(copy(acquisition));
  const dataset=copy(study.dataset);dataset.observations.push(copy(acquisition.observation));
  study=createStiffnessStudy(dataset,study.settings);session.study=study;
 }
 need(raw.pending===null||Number.isInteger(raw.pending),'Pending request must be a permitted-state index or null.');
 session.pending=raw.pending===null?null:frozenRequest(session,raw.pending);
 session.plan=planStiffness(study.fit,permitted);return session;
}
export function addStiffnessCubicRevision(session,origin,reason){
 const input=experimentInputs(session);
 need(!input.revisions?.length,'This experiment already records a family expansion. Start a new experiment to change that declaration.');
 input.schema=REVISED_EXPERIMENT_SCHEMA;input.revisions=[{at:input.acquisitions.length,kind:'smooth_cubic',origin,reason}];
 input.pending=null;return replayStiffnessExperiment(input);
}
export function setPendingStiffnessRequest(session,index){
 const input=experimentInputs(session);input.pending=index;
 return replayStiffnessExperiment(input);
}
export function setPermittedStiffnessStates(session,rawPermitted){
 const permitted=normalizePermittedStates(rawPermitted),input=experimentInputs(session);
 need(input.acquisitions.length===0||JSON.stringify(permitted)===JSON.stringify(input.permitted),
  'Permitted states are frozen after the first acquisition. Load a new observation source or start a new authored course to change the declaration.');
 input.permitted=permitted;input.pending=null;
 return replayStiffnessExperiment(input);
}
export function receiveStiffnessObservation(session,request,rawReading){
 need([REQUEST_SCHEMA,REVISED_REQUEST_SCHEMA].includes(request?.schema),'Freeze a request before receiving an observation.');
 const expected=freezeStiffnessRequest(session,request.index);
 need(JSON.stringify(request)===JSON.stringify(expected),'The request is stale or modified; freeze the current training forecast first.');
 need(session.pending&&JSON.stringify(request)===JSON.stringify(session.pending),'Receive only the currently frozen request.');
 exactKeys(rawReading,['id','source','observation'],'Received reading');
 const acquisition=normalizeAcquisition({...rawReading,index:request.index},session.permitted);
 const input=experimentInputs(session);input.acquisitions.push(acquisition);input.pending=null;
 return replayStiffnessExperiment(input);
}
export function experimentInputs(session){
 return {schema:session.revisions?.length?REVISED_EXPERIMENT_SCHEMA:EXPERIMENT_SCHEMA,initial:copy(session.initial),permitted:copy(session.permitted),
  acquisitions:copy(session.acquisitions),pending:session.pending?.index??null,
  ...(session.revisions?.length?{revisions:copy(session.revisions)}:{})};
}
export function exportStiffnessExperiment(session){
 const text=JSON.stringify(experimentInputs(session));
 need(text.length<=MAX_TEXT_LENGTH,'Experiment notebook exceeds 2 MB.');return text;
}
export function importStiffnessExperiment(text){
 need(typeof text==='string'&&text.length<=MAX_TEXT_LENGTH,'Experiment notebook must be text below 2 MB.');
 return replayStiffnessExperiment(JSON.parse(text));
}

