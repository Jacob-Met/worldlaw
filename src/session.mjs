import {retainScalarQuestion,receiveScalarQuestion} from './science/scalar-question.mjs';
import {captureScalarChallenge} from './science/scalar-challenge.mjs';
import {measurementSource} from './measurement-batch.mjs';
import {planTrainingResponse,receiveTrainingResponse} from './science/training-response-plan.mjs';
import {summarizeBoundedReceipt} from './science/bounded-experiment-receipts.mjs';
import {planBoundedScalarExperiment} from './science/bounded-scalar-plan.mjs';
import {inspectInputEnclosures} from './science/input-enclosure.mjs';
import {discover, refitDiscovery, evaluate, revise, planExperiment, DEFAULT_TERMS, TERMS, discoveryRobustWork} from './science/torque-discovery.mjs';
import {createLab, executeLab} from './science/virtual-lab.mjs';
import {validateDataset, validateRows, validateOfferedInputs, candidateGrid, FIELDS, MAX_ROWS, MAX_TEXT_LENGTH} from './data.mjs';
import {planInputExcitation} from './science/input-excitation.mjs';
import {captureExperimentReceipt} from './science/experiment-receipts.mjs';

export const SESSION_SCHEMA='worldlaw.session/v1';
export const INTERACTION_SESSION_SCHEMA='worldlaw.session/v2';
export const ROBUST_SESSION_SCHEMA='worldlaw.session/v3';
export const LIBRARY_SESSION_SCHEMA='worldlaw.session/v5';
export const WEIGHTED_SESSION_SCHEMA='worldlaw.session/v4';
const usesLibrary = raw => Object.hasOwn(raw.initialOptions??{},'additionalTerms') || raw.events.some(event=>event?.kind==='options' && Object.hasOwn(event.options??{},'additionalTerms'));
const usesInteraction = raw => raw.initialOptions?.includeCommandPosition===true || raw.events.some(event=>event?.kind==='options' && event.options?.includeCommandPosition===true);
const usesRobust = raw => raw.initialOptions?.loss==='soft_l1' || raw.events.some(event=>event?.kind==='options' && event.options?.loss==='soft_l1');
const usesWeighted = raw => raw.base?.observations?.some(row=>row&&Object.hasOwn(row,'torqueNoiseRatio')) || raw.base?.heldOut?.some(row=>row&&Object.hasOwn(row,'torqueNoiseRatio')) || raw.initialOptions?.loss==='weighted_least_squares' || raw.events.some(event=>event?.options?.loss==='weighted_least_squares'||event?.rows?.some(row=>row&&Object.hasOwn(row,'torqueNoiseRatio')));
export const DEFAULT_OPTIONS=Object.freeze({noiseSigma:0.01,maxTerms:4,ambiguityDelta:6});
const MAX_EVENTS=128;
// UTF-8 needs at most three bytes per UTF-16 code unit. The parser still
// enforces MAX_TEXT_LENGTH after reading a notebook file.
export const MAX_SESSION_FILE_BYTES=3*MAX_TEXT_LENGTH;
export const MAX_ROBUST_NOTEBOOK_WORK=2_000_000_000;
function validSeed(seed){if(!Number.isSafeInteger(seed)||Math.abs(seed)>1e9)throw new Error('Invalid virtual instrument seed. Use an integer between −1000000000 and 1000000000.');return seed;}
function matchesVirtualSeed(rows,expected) {
  // Math.sin/cos can differ by a few rounding bits between JS runtimes. This is
  // only a seed-baseline compatibility check; the supplied evidence is retained.
  return rows.length===expected.length && rows.every((row,i)=>FIELDS.every(field=>
    Number.isFinite(row[field]) && Number.isFinite(expected[i][field]) &&
    Math.abs(row[field]-expected[i][field])<=16*Number.EPSILON*Math.max(1,Math.abs(row[field]),Math.abs(expected[i][field]))));
}
const cleanOptions = options => {
  const result={...DEFAULT_OPTIONS};
  for (const key of Object.keys(DEFAULT_OPTIONS)) if(options?.[key] !== undefined) result[key]=options[key];
  if(!Number.isFinite(result.noiseSigma) || result.noiseSigma<1e-7 || result.noiseSigma>1000) throw new Error('Assumed sensor noise must be between 0.0000001 and 1000 N·m.');
  if(!Number.isInteger(result.maxTerms) || result.maxTerms<1 || result.maxTerms>7 || !Number.isFinite(result.ambiguityDelta) || result.ambiguityDelta<0 || result.ambiguityDelta>100) throw new Error('Unsupported discovery options.');
  if(options?.includeCommandPosition !== undefined){
    if(typeof options.includeCommandPosition !== 'boolean')throw new Error('Explicit interaction choice must be boolean.');
    result.includeCommandPosition=options.includeCommandPosition;
  }
  if(options?.additionalTerms !== undefined){
    const allowed=TERMS.filter(term=>term.optional&&term.id!=='command_position').map(term=>term.id);
    if(!Array.isArray(options.additionalTerms)||new Set(options.additionalTerms).size!==options.additionalTerms.length||options.additionalTerms.some(id=>!allowed.includes(id)))throw new Error('Additional terms must be unique maintained optional scalar features.');
    result.additionalTerms=[...options.additionalTerms];
  }
  if(options?.loss !== undefined){
    if(!['least_squares','soft_l1','weighted_least_squares'].includes(options.loss))throw new Error('Choose least squares, soft-L1, or declared-ratio weighted least squares.');
    result.loss=options.loss;
  }
  if(options?.lossScale !== undefined){
    if(typeof options.lossScale!=='number'||!Number.isFinite(options.lossScale)||options.lossScale<1e-7||options.lossScale>1e6)throw new Error('Soft-L1 scale must be between 0.0000001 and 1000000 N·m.');
    result.lossScale=options.lossScale;
  }
  if(result.loss==='soft_l1'&&result.lossScale===undefined)throw new Error('Declare a soft-L1 torque scale.');
  return result;
};
function discoveryOptions(options){return {...options,terms:[...DEFAULT_TERMS,...(options.includeCommandPosition?['command_position']:[]),...(options.additionalTerms??[])]};}
function assertReplayWork(base,initialOptions,events){
  if(!Array.isArray(base?.observations))throw new Error('Notebook needs its original observations.');
  let count=base.observations.length,options=cleanOptions(initialOptions);
  let total=discoveryRobustWork(count,discoveryOptions(options));
  for(const event of events){
    if(event?.kind==='measurement'){
      if(!Array.isArray(event.rows))throw new Error('Measurement history needs its original rows.');
      count+=event.rows.length;
    }else if(event?.kind==='virtual')count++;
    else if(event?.kind==='planning-bounds'||event?.kind==='challenge'||event?.kind==='scalar-question'||event?.kind==='condition-question'||event?.kind==='conditional-offers'||event?.kind==='assess-deviation'||event?.kind==='assess-achieved-bounds')continue;
    else if(event?.kind==='options')options=cleanOptions({...options,...event.options});
    else throw new Error('Notebook contains an unknown event.');
    total+=discoveryRobustWork(count,discoveryOptions(options));
    if(total>MAX_ROBUST_NOTEBOOK_WORK)throw new Error(`Complete soft-L1 notebook replay exceeds ${MAX_ROBUST_NOTEBOOK_WORK} reserved work units. Export the current notebook before starting a new one.`);
  }
}
function summary(discovery,heldOut,label,kind) {
  return {label,kind,count:discovery.observations.length,modelId:discovery.selected.id,equation:discovery.selected.equation,rmse:discovery.selected.metrics.rmse,heldOutRMSE:evaluate(discovery.selected,heldOut).rmse,
    ...(discovery.options.loss==='weighted_least_squares'?{loss:'weighted_least_squares',relativeNoiseRmse:discovery.selected.metrics.weighted.relativeNoiseRmse}:{})};
}
export function createSession(dataset,options=DEFAULT_OPTIONS,{labSeed=null}={}) {
  const base=validateDataset(dataset,dataset?.source?.label); const lab=labSeed === null ? null : {seed:validSeed(labSeed)};
  if(lab) {
    if(base.observations.some(row=>row.torqueNoiseRatio!==undefined)||base.heldOut.some(row=>row.torqueNoiseRatio!==undefined))throw new Error('Virtual instrument source does not declare per-reading torque-noise ratios.');
    if(Object.hasOwn(base,'offeredInputs')) throw new Error('Explicit offered inputs are for imported observations; the virtual instrument retains its fixed candidate course.');
    const fixture=createLab({seed:labSeed});
    if(!matchesVirtualSeed(base.observations,validateRows(fixture.initialSamples)) || !matchesVirtualSeed(base.heldOut,validateRows(fixture.evaluationSamples,{allowEmpty:true}))) throw new Error('Virtual instrument data does not match its declared seed.');
    base.source={label:fixture.label,kind:'synthetic-virtual-instrument',units:{...base.source.units}};
  }
  const initialOptions=cleanOptions(options); const discovery=discover(base.observations,discoveryOptions(initialOptions));
  return {schema:SESSION_SCHEMA,base,lab,initialOptions,options:initialOptions,events:[],discovery,history:[summary(discovery,base.heldOut,'Initial observations','initial')]};
}
export function newVirtualSession(seed=17) {
  validSeed(seed);const lab=createLab({seed});
  return createSession({source:{label:lab.label},observations:lab.initialSamples,heldOut:lab.evaluationSamples},lab.options,{labSeed:seed});
}
function eventState(state,event,discovery,options=state.options) {
  if(state.events.length>=MAX_EVENTS) throw new Error(`This notebook supports ${MAX_EVENTS} revisions. Export it before starting a new notebook.`);
  const entry=summary(discovery,state.base.heldOut,event.label,event.kind);
  if(event.kind==='measurement'||event.kind==='virtual')
    entry.experiment=captureExperimentReceipt(state.discovery,discovery,discovery.observations.slice(state.discovery.observations.length));
  if(entry.experiment&&state.planningRadii){
    const used=state.history.reduce((sum,h)=>sum+(h.experiment?.bounded?.evaluations??0),0);
    entry.experiment.bounded=summarizeBoundedReceipt(entry.experiment,state.planningRadii,used);
  }
  if(entry.experiment&&state.planningTrainingRadius!=null){
   const used=state.history.reduce((n,h)=>n+(h.experiment?.trainingResponse?.evaluations??0),0);
   entry.experiment.trainingResponse=receiveTrainingResponse(state.discovery,entry.experiment.rows,state.planningRadii,state.planningTrainingRadius,used);
  }
  if(entry.experiment&&event.reusedChallenge===undefined){const outcome=receiveScalarQuestion(state,entry.experiment.rows,entry.experiment);if(outcome)entry.questionOutcome=outcome;}
  const next={...state,options,discovery,events:[...state.events,event],history:[...state.history,entry]};
  if(['measurement','virtual','options','planning-bounds'].includes(event.kind)){delete next.conditionedPlanning;delete next.conditionalOffers;}
  return next;
}
export function appendMeasurements(state,rows,label='Measured outcome',source=null){return appendMeasurementSource(state,rows,label,source);}
function appendMeasurementSource(state,rows,label,source,reusedChallenge=undefined) {
  if(state.lab) throw new Error('This notebook is connected to a virtual instrument. Import measured observations to start an instrument notebook.');
  rows=validateRows(rows,{allowEmpty:true});
  if(!rows.length || state.discovery.observations.length+rows.length>MAX_ROWS) throw new Error('The measurement batch is empty or exceeds the observation limit.');
  const admittedSource=source===null?null:measurementSource(source);
  if(admittedSource&&(rows[0].torqueNoiseRatio!==undefined)!==(admittedSource.units.torqueNoiseRatio==='1'))throw Error('Acquisition source units must match the complete torque-noise-ratio declaration.');
  const event={kind:'measurement',label:String(label).slice(0,160),rows,...(admittedSource?{source:admittedSource}:{}),...(reusedChallenge!==undefined?{reusedChallenge}:{})};
  assertReplayWork(state.base,state.initialOptions,[...state.events,event]);
  return eventState(state,event,revise(state.discovery,rows));
}
export function receiveScalarChallenge(state,rows,source){
 if(state.lab)throw Error('Import an instrument notebook before receiving an external challenge.');
 rows=validateRows(rows,{allowEmpty:true});if(!rows.length)throw Error('A challenge needs actual readings.');
 const admittedSource=measurementSource(source);
 if((rows[0].torqueNoiseRatio!==undefined)!==(admittedSource.units.torqueNoiseRatio==='1'))throw Error('Challenge source units must match its ratio declarations.');
 const usedWork=state.history.reduce((n,h)=>n+(h.challenge?.work??0),0),usedRows=state.history.reduce((n,h)=>n+(h.challenge?.rows.length??0),0);
 const challenge=captureScalarChallenge(state.discovery,rows,{usedWork,usedRows});
 const event={kind:'challenge',label:'External challenge: '+admittedSource.label,rows,source:admittedSource};
 const next=eventState(state,event,state.discovery);next.history[next.history.length-1].challenge=challenge;const outcome=receiveScalarQuestion(state,rows,challenge);if(outcome)next.history.at(-1).questionOutcome=outcome;return next;
}
export function reuseScalarChallenge(state,challengeEvent){
 if(!Number.isInteger(challengeEvent)||challengeEvent<0||challengeEvent>=state.events.length||state.events[challengeEvent].kind!=='challenge')throw Error('Choose an earlier retained external challenge.');
 if(state.events.some(e=>e.reusedChallenge===challengeEvent))throw Error('This complete challenge has already been reused for training.');
 const original=state.events[challengeEvent];
 const next=appendMeasurementSource(state,original.rows,'Reused challenge for training: '+original.source.label,original.source,challengeEvent);
 // Existing outcomes cannot execute a later prospective question or consume its screen work.
 return next;
}
export function runVirtualExperiment(state,input) {
  if(!state.lab) throw new Error('Virtual experiments are available only in the virtual instrument notebook. Enter a measured outcome for your imported data.');
  const experimentIndex=state.events.filter(e=>e.kind==='virtual').length;
  const row=executeLab(input,{experimentIndex,seed:state.lab.seed});
  if(state.discovery.observations.length+1>MAX_ROWS) throw new Error('Observation limit reached. Export this notebook before starting another.');
  const event={kind:'virtual',label:`Virtual experiment ${experimentIndex+1}`,input:{command:row.command,position:row.position,rate:row.rate}};
  assertReplayWork(state.base,state.initialOptions,[...state.events,event]);
  return eventState(state,event,revise(state.discovery,[row]));
}
export function refitSession(state,options) {
  options=cleanOptions({...state.options,...options});
  const lossChanged=(options.loss??'least_squares')!==(state.options.loss??'least_squares') ||
    (options.loss==='soft_l1'&&options.lossScale!==state.options.lossScale);
  const label=Boolean(options.includeCommandPosition)!==Boolean(state.options.includeCommandPosition)||JSON.stringify(options.additionalTerms??[])!==JSON.stringify(state.options.additionalTerms??[])?'Revised scalar feature library':lossChanged?'Revised reading-loss assumption':'Revised noise assumption';
  const event={kind:'options',label,options};
  assertReplayWork(state.base,state.initialOptions,[...state.events,event]);
  return eventState(state,event,refitDiscovery(state.discovery,discoveryOptions(options)),options);
}
function candidateCourse(state,includeConditional=false) {
  const explicit=!state.lab && Object.hasOwn(state.base,'offeredInputs');
  let source=state.lab ? createLab({seed:state.lab.seed}).candidateInputs : explicit?state.base.offeredInputs:candidateGrid(state.base.observations);
  if(includeConditional&&state.conditionedPlanning&&state.conditionalOffers)source=[...source,...state.conditionalOffers];
  const key = explicit ? p=>JSON.stringify(['command','position','rate'].map(f=>p[f]))
    : p => ['command','position','rate'].map(f=>p[f].toPrecision(12)).join('|');
  const observed=new Set(state.discovery.observations.map(key));
  const indices=source.flatMap((p,i)=>observed.has(key(p))?[]:[i]);
  return {candidates:indices.map(i=>source[i]),indices,offeredCount:source.length,explicit};
}
export function setPlanningBounds(state,radii,trainingRadius=null,tiePolicy='offered-order'){
 if(!['offered-order','remaining-overlap'].includes(tiePolicy)||tiePolicy==='remaining-overlap'&&(radii===null||trainingRadius!==null))throw Error('Remaining-overlap ties require fixed-law declared-bound planning.');
 if(trainingRadius!==null&&(!Number.isFinite(trainingRadius)||trainingRadius<0||trainingRadius>1e6))throw Error('Declare a valid training-reading radius.');
 if(radii===null)trainingRadius=null;
 const normalized=radii===null?null:inspectInputEnclosures(state.discovery.selected,[],radii).radii;
 const next=eventState(state,{kind:'planning-bounds',label:normalized?'Declared experiment error bounds':'Restored nominal experiment planning',radii:normalized,...(trainingRadius!==null?{trainingRadius}:{}),...(tiePolicy==='remaining-overlap'?{tiePolicy}:{})},state.discovery);
 const result={...next,planningRadii:normalized,...(trainingRadius!==null?{planningTrainingRadius:trainingRadius}:{planningTrainingRadius:null})};if(tiePolicy==='remaining-overlap')result.planningTiePolicy=tiePolicy;else delete result.planningTiePolicy;return result;
}
export function sessionPlan(state) {
  const {candidates}=candidateCourse(state,true);
  if(state.conditionedPlanning){
   const models=state.discovery.competitive.filter(m=>state.conditionedPlanning.modelIds.includes(m.id));
   if(models.length<2)return {status:models.length?'one-unexcluded-original-law':'all-original-laws-excluded',reason:models.length?'One original fixed law remains unexcluded under the declared screen; pair discrimination stops. This is not validation.':'All original fixed laws were excluded under the declared screen. Revise the hypotheses or assumptions before a new discrimination claim.',selected:null,ranked:[],modelIds:models.map(m=>m.id),conditioned:true};
   if(!candidates.length)return {status:'no_unobserved_inputs',selected:null,ranked:[],modelIds:models.map(m=>m.id),conditioned:true};
   const result=planBoundedScalarExperiment({...state.discovery,competitive:models},candidates,state.planningRadii,{tiePolicy:state.planningTiePolicy});
   return {...result,conditioned:true,conditionedBy:state.conditionedPlanning.outcomeEvent};
  }

  if(!candidates.length)return {status:'no_unobserved_inputs',selected:null,ranked:[],modelIds:[]};
 if(state.planningRadii){try{return state.planningTrainingRadius!=null?planTrainingResponse(state.discovery,candidates,state.planningRadii,state.planningTrainingRadius):planBoundedScalarExperiment(state.discovery,candidates,state.planningRadii,{tiePolicy:state.planningTiePolicy});}catch(error){return {status:'bounds-unavailable',reason:error.message,selected:null,ranked:[],modelIds:[]};}}
 return planExperiment(state.discovery,candidates);
}
export function freezeScalarQuestion(state){
 if(state.lab)throw Error('Freeze actual acquisition questions only in an imported instrument notebook.');
 const course=candidateCourse(state,true),models=state.conditionedPlanning?.modelIds.length??state.discovery.competitive.length;
 const requested={evaluations:models*course.candidates.length,products:state.planningTrainingRadius!=null?models*course.candidates.length*state.discovery.observations.length:0,pairComparisons:course.candidates.length*models*(models-1)/2};
 for(const [key,limit]of Object.entries({evaluations:8192,products:1048576,pairComparisons:65536}))if(state.history.reduce((n,h)=>n+(h.question?.[key]??0),0)+requested[key]>limit)throw Error('Complete cumulative frozen-question planning course exceeds its work limit.');
 const question=retainScalarQuestion(sessionPlan(state));
 const next=eventState(state,{kind:'scalar-question',label:'Frozen scalar question',input:{...question.input},method:question.method},state.discovery);next.history.at(-1).question=question;return next;
}
export function assessRecordedDeviation(state){return assessQuestionEvidence(state,null,null,'assess-deviation');}
export function assessAchievedQuestionBounds(state,radii,source){
 const admitted=measurementSource(source);
 if(!radii||!['command','position','rate','jointTorque'].every(k=>typeof radii[k]==='number'&&Number.isFinite(radii[k])&&radii[k]>=0&&radii[k]<=1e6))throw Error('Declare four finite achieved absolute radii from0to1000000 in original SI units.');
 return assessQuestionEvidence(state,Object.fromEntries(['command','position','rate','jointTorque'].map(k=>[k,radii[k]])),admitted,'assess-achieved-bounds');
}
function assessQuestionEvidence(state,achievedRadii,source,kind){
 const h=state.history.at(-1),outcome=h?.questionOutcome;
 const allowed=kind==='assess-deviation'?['coordinate-deviation']:['coordinate-deviation','exact-coordinate-match'];
 if(!h?.challenge||!allowed.includes(outcome?.status)||h.challenge.rows.length!==1)throw Error('Assess only the latest single off-target or exact question challenge without refitting; repeated assessment is unavailable.');
 const question=state.history[outcome.questionEvent+1]?.question;
 if(question?.method!=='declared_input_box_interval_separation'||question.trainingRadius!=null)throw Error('Retrospective assessment requires original fixed-law bounds; marginal training response is unsupported.');
 const ids=question.intervals.map(x=>x.id),models=h.challenge.models.filter(m=>ids.includes(m.id));
 if(models.length!==ids.length)throw Error('Original fixed-law population is incomplete.');
 const used=state.history.reduce((n,x)=>n+(x.questionOutcome?.screen?.evaluations??0)+(x.retrospectiveQuestion?.screen?.evaluations??0),0);
 const radii=achievedRadii??question.radii,screen=summarizeBoundedReceipt({...h.challenge,models},radii,used);
 const event={kind,label:achievedRadii?'Retrospective screen with achieved measurement bounds':'Retrospective screen at recorded off-target state',questionEvent:outcome.questionEvent,challengeEvent:state.events.length-1,...(achievedRadii?{radii,source}:{})};
 const requirements=achievedRadii?Object.fromEntries(['command','position','rate','jointTorque'].map(k=>[k,{promised:question.radii[k],achieved:radii[k],status:radii[k]>question.radii[k]?'wider-than-promised':radii[k]<question.radii[k]?'narrower-than-promised':'same-as-promised'}])):null;
 const next=eventState(state,event,state.discovery);next.history.at(-1).retrospectiveQuestion={questionEvent:event.questionEvent,challengeEvent:event.challengeEvent,screen,...(achievedRadii?{achievedBounds:{source,requirements},qualification:'Retrospective evaluation at actual recorded coordinates using explicitly sourced achieved error bounds and original fixed laws. The original promised-bound screen and execution status remain unchanged. This does not establish that achieved bounds are calibrated or that the original prospective separation was achieved.'}:{qualification:'Retrospective evaluation at the separately recorded actual coordinates using original fixed coefficients and declared error radii. The original prospective question remains unfulfilled; its promised separation and overlap bound are not claimed for this reading.'})};return next;
}
export function conditionScalarQuestion(state){
 const retrospective=state.history.at(-1)?.retrospectiveQuestion;
 const outcome=retrospective?{...retrospective,status:'retrospective-deviation'}:state.history.at(-1)?.questionOutcome;
 if(!retrospective&&(!state.history.at(-1)?.challenge||outcome?.status!=='exact-coordinate-match'))throw Error('Continue only from the latest exact executed question received as a challenge without refitting.');
 const question=state.history[outcome.questionEvent+1]?.question;
 if(question?.method!=='declared_input_box_interval_separation'||question.trainingRadius!=null)throw Error('Only fixed-coefficient question screens support this continuation. Marginal training-response envelopes are not common training support.');
 if(!outcome.screen||outcome.screen.status==='unavailable'||!Array.isArray(outcome.screen.models))throw Error('The complete original-question model screen must be available.');
 const prior=state.conditionedPlanning?.modelIds??state.discovery.competitive.map(m=>m.id);
 const tested=outcome.screen.models.map(m=>m.modelId);
 if(tested.length!==prior.length||prior.some(id=>!tested.includes(id)))throw Error('The original question does not screen the complete active fixed-law population.');
 const modelIds=prior.filter(id=>outcome.screen.models.find(m=>m.modelId===id).excludedCount===0);
 const next=eventState(state,{kind:'condition-question',label:'Continue conditional fixed-law discrimination',questionEvent:outcome.questionEvent,...(retrospective?{assessmentEvent:state.events.length-1}:{})},state.discovery);
 next.conditionedPlanning={modelIds,outcomeEvent:state.events.length-1};return next;
}
export function extendConditionalOffers(state,inputs,source){
 if(state.lab||!state.conditionedPlanning||state.conditionedPlanning.modelIds.length<2||!Object.hasOwn(state.base,'offeredInputs'))throw Error('Extend explicitly offered states only for an active conditional investigation with at least two original laws.');
 if(!source||typeof source.label!=='string'||!source.label.trim()||source.label.length>500||source.units?.command!=='N·m'||source.units?.position!=='rad'||source.units?.rate!=='rad/s')throw Error('Declare the permission/source basis and exact SI coordinate units for additional offers.');
 const admitted=validateOfferedInputs(inputs);if(!admitted.length)throw Error('Supply at least one newly permitted state.');
 const used=state.events.reduce((n,e)=>n+(e.kind==='conditional-offers'?e.inputs.length:0),0);if(used+admitted.length>4096)throw Error('Complete cumulative additional-offer source exceeds4096 states.');
 const combined=validateOfferedInputs([...state.base.offeredInputs,...(state.conditionalOffers??[]),...admitted]);
 const event={kind:'conditional-offers',label:'Additional permitted states: '+source.label,inputs:admitted,source:{label:source.label,units:{command:'N·m',position:'rad',rate:'rad/s'}}};
 const next=eventState(state,event,state.discovery);next.conditionalOffers=combined.slice(state.base.offeredInputs.length);
 return next;
}
export function sessionPilotPlan(state) {
  const course=candidateCourse(state);
  const result=planInputExcitation(state.discovery.observations,state.discovery.options.terms,course.candidates);
  const outcomes=result.outcomes.map(row=>({...row,sourceIndex:course.indices[row.index]}));
  return {...result,outcomes,selected:result.selected?outcomes[result.selected.index]:null,
    inputSource:course.explicit?'explicitly_offered':state.lab?'virtual_instrument_course':'observed_range_grid',
    originalOfferedCount:course.offeredCount,previouslyObservedCount:course.offeredCount-course.candidates.length};
}
export function exportSession(state) {
  const notebook={schema:usesLibrary(state)?LIBRARY_SESSION_SCHEMA:usesWeighted(state)?WEIGHTED_SESSION_SCHEMA:usesRobust(state)?ROBUST_SESSION_SCHEMA:usesInteraction(state)?INTERACTION_SESSION_SCHEMA:SESSION_SCHEMA,base:state.base,lab:state.lab,initialOptions:state.initialOptions,events:state.events};
  const readable=JSON.stringify(notebook,null,2);
  if(readable.length<=MAX_TEXT_LENGTH)return readable;
  // Formatting must not make an otherwise supported notebook impossible to reopen.
  const compact=JSON.stringify(notebook);
  if(compact.length>MAX_TEXT_LENGTH)throw new Error('Notebook exceeds the supported text size and cannot be exported.');
  return compact;
}
export function restoreSession(text) {
  if(typeof text!=='string' || text.length>MAX_TEXT_LENGTH) throw new Error('Notebook must be JSON smaller than 2 MB.');
  let raw; try{raw=JSON.parse(text);}catch{throw new Error('The notebook JSON could not be read.');}
  if(![SESSION_SCHEMA,INTERACTION_SESSION_SCHEMA,ROBUST_SESSION_SCHEMA,WEIGHTED_SESSION_SCHEMA,LIBRARY_SESSION_SCHEMA].includes(raw?.schema) || !Array.isArray(raw.events) || raw.events.length>MAX_EVENTS) throw new Error('Unsupported or incomplete WORLDLAW notebook.');
  if(raw.schema===SESSION_SCHEMA && usesInteraction(raw))throw new Error('Interaction feature history requires the v2 notebook envelope.');
  if(![ROBUST_SESSION_SCHEMA,WEIGHTED_SESSION_SCHEMA,LIBRARY_SESSION_SCHEMA].includes(raw.schema) && usesRobust(raw))throw new Error('Soft-L1 fitting history requires the v3 notebook envelope.');
  if(![WEIGHTED_SESSION_SCHEMA,LIBRARY_SESSION_SCHEMA].includes(raw.schema) && usesWeighted(raw))throw new Error('Declared torque-noise ratios and weighted history require the v4 notebook envelope.');
  if(raw.schema!==LIBRARY_SESSION_SCHEMA && usesLibrary(raw))throw new Error('Expanded scalar library history requires the v5 notebook envelope.');
  assertReplayWork(raw.base,raw.initialOptions,raw.events);
  if(raw.lab) validSeed(raw.lab.seed);
  let state=createSession(raw.base,raw.initialOptions,{labSeed:raw.lab?.seed??null});
  for(const event of raw.events) {
    if(event?.kind==='virtual') state=runVirtualExperiment(state,event.input);
    else if(event?.kind==='condition-question'){const next=conditionScalarQuestion(state);if(event.questionEvent!==next.events.at(-1).questionEvent||event.assessmentEvent!==next.events.at(-1).assessmentEvent)throw Error('Conditioning reference differs from the latest executed question.');state=next;}
    else if(event?.kind==='scalar-question'){const next=freezeScalarQuestion(state),e=next.events.at(-1);if(!event.input||['command','position','rate'].some(k=>event.input[k]!==e.input[k])||event.method!==e.method)throw Error('Frozen question differs from the original source-planned suggestion.');state=next;}
    else if(event?.kind==='challenge') state=receiveScalarChallenge(state,event.rows,event.source);
    else if(event?.kind==='measurement') {
      if(Object.hasOwn(event,'reusedChallenge')){
        const original=state.events[event.reusedChallenge];
        if(!original||original.kind!=='challenge'||JSON.stringify(validateRows(event.rows,{allowEmpty:true}))!==JSON.stringify(original.rows)||JSON.stringify(measurementSource(event.source))!==JSON.stringify(original.source))throw Error('Reused challenge source differs from the retained original event.');
        state=reuseScalarChallenge(state,event.reusedChallenge);
      }else state=appendMeasurements(state,event.rows,event.label,event.source??null);
    }
    else if(event?.kind==='assess-achieved-bounds'){const next=assessAchievedQuestionBounds(state,event.radii,event.source),e=next.events.at(-1);if(event.questionEvent!==e.questionEvent||event.challengeEvent!==e.challengeEvent)throw Error('Achieved-bound assessment reference differs from original question/reading.');state=next;}
    else if(event?.kind==='assess-deviation'){const next=assessRecordedDeviation(state),e=next.events.at(-1);if(event.questionEvent!==e.questionEvent||event.challengeEvent!==e.challengeEvent)throw Error('Retrospective assessment source reference differs from original question/reading.');state=next;}
    else if(event?.kind==='conditional-offers') state=extendConditionalOffers(state,event.inputs,event.source);
    else if(event?.kind==='planning-bounds') state=setPlanningBounds(state,event.radii,event.trainingRadius??null,event.tiePolicy??'offered-order');
    else if(event?.kind==='options') state=refitSession(state,event.options);
    else throw new Error('Notebook contains an unknown event.');
  }
  return state;
}
export function undoSession(state) {
  if(!state.events.length) return state;
  const raw=JSON.parse(exportSession(state)); raw.events.pop(); return restoreSession(JSON.stringify(raw));
}


