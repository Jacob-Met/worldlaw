/** Byte-bound experiment records shared by the CLI and browser.
 * Hashes identify supplied bytes and replayed claims. They do not authenticate
 * a sensor, actuation, calibration, the time of planning or physical origin.
 */
import {
  ACTIVE_LINEAR_FAMILY_SCHEMA, ACTIVE_LINEAR_ERASURE_SCHEMA, ACTIVE_LINEAR_REPLACEMENT_SCHEMA, ACTIVE_LINEAR_CALIBRATED_REPLACEMENT_SCHEMA, ACTIVE_LINEAR_CALIBRATED_MIXED_LOSS_SCHEMA, ACTIVE_LINEAR_CALIBRATION_SCHEMA, ACTIVE_INTERVENTION_SCHEMA, ACTIVE_LINEAR_CONTROL_BOX_SCHEMA, ACTIVE_LINEAR_JOINT_CONTROL_SCHEMA,
  designActiveLinearFamily, designActiveInterventionFamily, designActiveLinearControlBox, designActiveLinearJointControl,
  replayActiveLinearFamily, replayActiveInterventionFamily, replayActiveLinearControlBox, replayActiveLinearJointControl,
  evaluateActiveLinearReadings,
} from './active-linear-family.mjs';
import {ACTIVE_LINEAR_ADAPTIVE_SCHEMA,ACTIVE_ADAPTIVE_READINGS_SCHEMA,
  designActiveLinearAdaptive,evaluateActiveAdaptiveReadings}
  from './active-linear-adaptive.mjs';

import {designConditionalFuture,classifyAccumulatedReadings,FOLLOWUP_READINGS} from './active-linear-followup.mjs';
import {ACTIVE_ACTUATOR_TIMELINE_SCHEMA,ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,designActiveVandermondeNonlinear,replayActiveVandermondeNonlinear,evaluateActiveVandermondeReadings} from './active-vandermonde-nonlinear.mjs';

import {TWO_PULSE_SCHEMA,designTwoPulse,receiveTwoPulse} from './active-integrator-two-pulse.mjs';

import {CATALOG_SCHEMA} from './persistent-position-drift-planner.mjs';
import {planAllHorizonPositionDrift} from './persistent-position-drift-all-horizon.mjs';
import {ACTIVE_DRIFT_PLAN,evaluateActiveDriftInput,parseActiveOriginalJSON} from './active-position-drift-readout.mjs';

export const ACTIVE_EXPERIMENT_NOTEBOOK_SCHEMA='worldlaw.active-experiment-notebook/v1';
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{ignoreBOM:true});
const planEvidence='source-conditional exact rational proof; no physical observation, acquisition, calibration or identified law';
const readingEvidence='Conditional exact consistency of supplied readings; physical origin, actuation and error calibration are not verified';
const clone=value=>JSON.parse(JSON.stringify(value));
const need=(condition,message)=>{if(!condition)throw Error(message);};
const bytesOf=value=>{
  need(typeof value==='string'||value instanceof Uint8Array,'Supply original UTF-8 source or readout bytes.');
  return typeof value==='string'?encoder.encode(value):new Uint8Array(value);
};
export async function activeBytesSHA256(value){
  const result=await crypto.subtle.digest('SHA-256',bytesOf(value));
  return [...new Uint8Array(result)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function source(bytes){
  const request=parseActiveOriginalJSON(decoder.decode(bytes));
  const multiple=request?.schema===ACTIVE_INTERVENTION_SCHEMA;
  const bounded=request?.schema===ACTIVE_LINEAR_CONTROL_BOX_SCHEMA;
  const joint=request?.schema===ACTIVE_LINEAR_JOINT_CONTROL_SCHEMA;
  const adaptive=request?.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA;
  const vandermonde=request?.schema===ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA||request?.schema===ACTIVE_ACTUATOR_TIMELINE_SCHEMA;
  need(multiple||bounded||joint||adaptive||vandermonde||request?.schema===CATALOG_SCHEMA||request?.schema===TWO_PULSE_SCHEMA||request?.schema===ACTIVE_LINEAR_FAMILY_SCHEMA||request?.schema===ACTIVE_LINEAR_ERASURE_SCHEMA||request?.schema===ACTIVE_LINEAR_REPLACEMENT_SCHEMA||request?.schema===ACTIVE_LINEAR_CALIBRATION_SCHEMA||request?.schema===ACTIVE_LINEAR_CALIBRATED_REPLACEMENT_SCHEMA||request?.schema===ACTIVE_LINEAR_CALIBRATED_MIXED_LOSS_SCHEMA,
    'Unrecognized active experiment source schema; choose linear family, intervention family, control box, joint control, one erasure, one replaced reading, affine sensor or adaptive v1');
  return {request,multiple,bounded,joint,adaptive,vandermonde};
}
function pick(value,keys){return Object.fromEntries(keys.map(key=>[key,value?.[key]]));}

/** Create a new prospective plan, or reproduce a saved plan exactly. */
export async function sealActivePlan(original,{prior=null,sourcePath}={}){
  const bytes=bytesOf(original),{request,multiple,bounded,joint,adaptive,vandermonde}=source(bytes);
  const saved=prior==null?null:clone(prior);
  const core=request.schema===CATALOG_SCHEMA?planAllHorizonPositionDrift(request):request.schema===TWO_PULSE_SCHEMA?designTwoPulse(request):multiple?designActiveInterventionFamily(request):bounded?
    designActiveLinearControlBox(request):joint?designActiveLinearJointControl(request):
    adaptive?designActiveLinearAdaptive(request):vandermonde?
    designActiveVandermondeNonlinear(request):designActiveLinearFamily(request);
  const sourceSHA256=await activeBytesSHA256(bytes);
  let frozen=core,planSHA256=await activeBytesSHA256(JSON.stringify(core));
  if(saved){
    need(saved.sourceSHA256===sourceSHA256,
      'Original source bytes changed; cannot replay experiment certificate');
    const previous=pick(saved,Object.keys(core));
    need(saved.planSHA256===await activeBytesSHA256(JSON.stringify(previous)),
      'Prospective plan digest changed; cannot replay experiment certificate');
    if(request.schema===CATALOG_SCHEMA){
      const allowed=new Set([...Object.keys(core),'sourceSHA256','planSHA256','sourcePath','evidenceLevel']);
      need(Object.keys(saved).every(key=>allowed.has(key)) && JSON.stringify(core)===JSON.stringify(previous),
        'Position/drift schedule or gauge witness changed; exact replay refused.');
    }
    else if(request.schema===TWO_PULSE_SCHEMA)need(JSON.stringify(core)===JSON.stringify(previous),'Two-pulse frozen policy changed.');
    else if(multiple)replayActiveInterventionFamily(request,previous);
    else if(bounded)replayActiveLinearControlBox(request,previous);
    else if(joint)replayActiveLinearJointControl(request,previous);
    else if(adaptive)need(JSON.stringify(core)===JSON.stringify(previous),
      'Adaptive experiment: frozen adaptive policy changed; exact replay refused');
    else if(vandermonde)replayActiveVandermondeNonlinear(request,previous);
    else replayActiveLinearFamily(request,previous);
    frozen=previous;planSHA256=saved.planSHA256;
  }
  return {sourceSHA256,planSHA256,...(sourcePath!==undefined?{sourcePath}:{}),
    ...frozen,evidenceLevel:planEvidence};
}

/** Readouts are a separate input and always replay the frozen plan first. */
export async function sealActiveReadout(original,plan,readings,{prior=null,sourcePath,planPath,readingsPath}={}){
  const sourceBytes=bytesOf(original),readingBytes=bytesOf(readings);
  const saved=prior==null?null:clone(prior);
  const frozen=await sealActivePlan(sourceBytes,{prior:plan});
  const {request,vandermonde}=source(sourceBytes);
  need(request.schema!==ACTIVE_LINEAR_ADAPTIVE_SCHEMA&&request.schema!==TWO_PULSE_SCHEMA,
    'Adaptive readings require the original portable notebook and its complete preceding transcript.');
  const supplied=parseActiveOriginalJSON(decoder.decode(readingBytes));
  need(supplied.sourceSHA256===frozen.sourceSHA256&&supplied.planSHA256===frozen.planSHA256,
    'Readout source or plan digest does not match the frozen prospective certificate.');
  const core=Object.fromEntries(Object.entries(frozen).filter(([key])=>
    !['sourceSHA256','planSHA256','evidenceLevel'].includes(key)));
  let result=frozen.schema===ACTIVE_DRIFT_PLAN?evaluateActiveDriftInput(request,core,supplied):vandermonde?evaluateActiveVandermondeReadings(request,core,supplied):evaluateActiveLinearReadings(request,core,supplied);
  if(request.schema===ACTIVE_ACTUATOR_TIMELINE_SCHEMA&&saved?.schema==='worldlaw.active-actuator-timeline-result/v1'){
    // Reproduce all historical witness estimates exactly from the supplied source and readings.
    result={...result,schema:saved.schema,estimates:result.estimates.map(({coefficients,estimate,interval})=>
      ({coefficients,estimate,interval}))};
  }
  const report={sourceSHA256:frozen.sourceSHA256,planSHA256:frozen.planSHA256,
    readingsSHA256:await activeBytesSHA256(readingBytes),
    ...(sourcePath!==undefined?{sourcePath}:{}),...(planPath!==undefined?{planPath}:{}),
    ...(readingsPath!==undefined?{readingsPath}:{}),...result,evidenceLevel:readingEvidence};
  if(saved){
    const keys=['sourceSHA256','planSHA256','readingsSHA256',...Object.keys(result)];
    if(frozen.schema===ACTIVE_DRIFT_PLAN){
      const allowed=new Set([...keys,'sourcePath','planPath','readingsPath','evidenceLevel']);
      need(Object.keys(saved).every(k=>allowed.has(k)), 'Unexpected position/drift readout result fields.');
    }
    need(JSON.stringify(pick(saved,keys))===JSON.stringify(pick(report,keys)),
      'Readout bytes, source, plan or result changed; exact readout replay refused.');
  }
  return report;
}

function sourceText(value){
  need(typeof value==='string'&&encoder.encode(value).byteLength<=524288,
    'A portable source must contain at most 512 KiB of original UTF-8 text.');
  return value;
}
function notebookObject(raw){
  const text=typeof raw==='string'?raw:JSON.stringify(raw);
  need(typeof text==='string'&&encoder.encode(text).byteLength<=8388608,
    'An experiment notebook must be at most 8 MiB.');
  const book=parseActiveOriginalJSON(text);
  need(book&&typeof book==='object'&&!Array.isArray(book)&&
    book.schema===ACTIVE_EXPERIMENT_NOTEBOOK_SCHEMA,'Choose an active experiment notebook v1.');
  need(Object.keys(book).sort().join(',')==='plan,readouts,schema,sourceText',
    'Unexpected experiment notebook fields.');
  sourceText(book.sourceText);
  need(book.plan&&typeof book.plan==='object'&&!Array.isArray(book.plan),'The notebook needs its frozen plan.');
  need(Array.isArray(book.readouts)&&book.readouts.length<=16,'Keep at most 16 received reading sets in one notebook.');
  for(const row of book.readouts){
    need(row&&typeof row==='object'&&!Array.isArray(row)&&
      Object.keys(row).sort().join(',')==='readingsText,result','A received reading set needs its original text and result.');
    need(typeof row.readingsText==='string'&&encoder.encode(row.readingsText).byteLength<=524288,
      'A received reading file must be at most 512 KiB.');
    need(row.result&&typeof row.result==='object'&&!Array.isArray(row.result),'A received reading set needs its sealed result.');
  }
  return book;
}
export async function createActiveNotebook(original,{plan=null}={}){
  const text=sourceText(original);
  const book={schema:ACTIVE_EXPERIMENT_NOTEBOOK_SCHEMA,sourceText:text,
    plan:await sealActivePlan(text,{prior:plan}),readouts:[]};
  if(book.plan.schema===ACTIVE_DRIFT_PLAN)notebookObject(book);
  return book;
}

/** Display/custody metadata from an already verified notebook. It never solves
 * or chooses a new policy. Public receiving always replays the book first. */
export function adaptiveNotebookState(book){
  if(book?.plan?.schema!==ACTIVE_LINEAR_ADAPTIVE_SCHEMA)return null;
  const plan=book.plan,last=book.readouts.at(-1)?.result;
  const started=plan.status==='optimal_certified_adaptive_policy';
  const stopped=Boolean(last&&last.status!=='continue_frozen_policy');
  const mask=last?last.nextMask:plan.policy?.initialMask??null;
  const budget=last?last.nextBudget:plan.worstReadings;
  const node=started&&!stopped?plan.policy.states.find(row=>row.key===(last?.nextStateKey??plan.policy.rootKey)):null;
  const action=node?plan.experiments.find(row=>row.id===node.action):null;
  return {status:!started?plan.status:stopped?last.status:'awaiting_readings',
    mask,budget,node,action,round:book.readouts.length+1,
    ...(plan.requiredExperimentMask?{coveredMask:last?.nextCoveredMask??last?.priorCoveredMask??0}:{}),
    previousReadingsSHA256:last?.readingsSHA256??null,
    spentReadings:book.readouts.reduce((sum,row)=>sum+row.result.readingCount,0),
    spentCost:book.readouts.reduce((sum,row)=>sum+row.result.declaredCost,0),
    consistentHypothesisIds:last?.consistentHypothesisIds??plan.hypothesisIds};
}

/** Seal exactly one continuation against the complete already replayed prefix. */
async function sealAdaptiveRound(book,originalReadings,{prior=null}={}){
  const current=adaptiveNotebookState(book),supplied=JSON.parse(originalReadings);
  need(current?.node&&current.action,'This notebook has no pending frozen experiment; retain its terminal outcome.');
  const fields=['schema','source','acquisition','sourceSHA256','planSHA256','round',
    'previousReadingsSHA256','stateKey','experimentId','readings'];
  need(supplied&&typeof supplied==='object'&&!Array.isArray(supplied)&&
    Object.keys(supplied).sort().join(',')===fields.sort().join(','),'Adaptive reading document has missing or unexpected fields.');
  need(supplied.schema===ACTIVE_ADAPTIVE_READINGS_SCHEMA,'Choose an adaptive reading document v1.');
  need(supplied.sourceSHA256===book.plan.sourceSHA256&&supplied.planSHA256===book.plan.planSHA256,
    'Adaptive readout source or policy digest does not match the frozen notebook.');
  need(supplied.round===current.round&&supplied.previousReadingsSHA256===current.previousReadingsSHA256&&
    supplied.stateKey===current.node.key,'Adaptive readout round, preceding original or frozen state does not match this transcript.');
  const metadata=new Set(['sourceSHA256','planSHA256','sourcePath','evidenceLevel']);
  const core=Object.fromEntries(Object.entries(book.plan).filter(([key])=>!metadata.has(key)));
  const result=evaluateActiveAdaptiveReadings(JSON.parse(book.sourceText),core,supplied,
    {mask:current.mask,budget:current.budget,...(book.plan.requiredExperimentMask?{coveredMask:current.coveredMask}:{})});
  const report={sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    readingsSHA256:await activeBytesSHA256(originalReadings),round:current.round,
    previousReadingsSHA256:current.previousReadingsSHA256,stateKey:current.node.key,
    ...result,evidenceLevel:readingEvidence};
  if(prior){
    const keys=Object.keys(report);
    need(Object.keys(prior).sort().join(',')===[...keys].sort().join(',')&&
      JSON.stringify(pick(prior,keys))===JSON.stringify(report),
      'Adaptive original readings, chain, decision or result changed; exact replay refused.');
  }
  return report;
}
function historicalRows(row){
  return row.result.accumulatedReadings??JSON.parse(row.readingsText).readings;
}

function conditionalSource(book){
  need([ACTIVE_LINEAR_CALIBRATED_REPLACEMENT_SCHEMA,ACTIVE_LINEAR_CALIBRATED_MIXED_LOSS_SCHEMA].includes(book.plan.schema),
    'Future acquisition requires a calibrated experiment with one possible wrong reading.');
  return JSON.parse(book.sourceText);
}

async function recommendVerified(book,index,{legacyInitialHorizon=false}={}){
  const request=conditionalSource(book),row=book.readouts[index];
  need(Number.isSafeInteger(index)&&row,'Select an existing received reading set.');
  const core={sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    historySHA256:row.result.readingsSHA256,...designConditionalFuture(request,historicalRows(row),legacyInitialHorizon?{...row.result,plannedTicks:[]}:row.result)};
  return {...core,followupSHA256:await activeBytesSHA256(JSON.stringify(core))};
}

/** Choose future readings only after replaying the selected historical dataset. */
export async function recommendActiveFollowup(raw,index){
  return recommendVerified(await replayActiveNotebook(raw),index);
}

async function sealFollowup(book,text,prior){
  const supplied=JSON.parse(text),request=conditionalSource(book);
  const keys=['schema','source','acquisition','sourceSHA256','planSHA256','historySHA256','followupSHA256','readings'];
  const declaresErasure=Object.hasOwn(supplied,'erasedTicks');
  if(declaresErasure)keys.push('erasedTicks');
  need(Object.keys(supplied).sort().join(',')===keys.sort().join(',')&&
    supplied.schema===FOLLOWUP_READINGS&&typeof supplied.source==='string'&&supplied.source.trim().length>=12&&
    supplied.source.length<=2048&&['synthetic','supplied'].includes(supplied.acquisition),
    'A future dataset needs its original source, acquisition kind and bound identifiers.');
  const index=book.readouts.findIndex(row=>row.result.readingsSHA256===supplied.historySHA256);
  let plan=await recommendVerified(book,index);
  // Older notebook hashes include clocks now known to have elapsed. Recompute
  // their original proof only on replay, and only accept the same selection
  // independently certified by today's physical horizon.
  if(prior && plan.status==='certified_future_acquisitions' && supplied.followupSHA256!==plan.followupSHA256){
    const historical=await recommendVerified(book,index,{legacyInitialHorizon:true});
    if(historical.followupSHA256===supplied.followupSHA256 &&
      JSON.stringify(historical.selection)===JSON.stringify(plan.selection))plan=historical;
  }
  need(supplied.sourceSHA256===plan.sourceSHA256&&supplied.planSHA256===plan.planSHA256&&
    supplied.followupSHA256===plan.followupSHA256&&plan.status==='certified_future_acquisitions',
    'The follow-up does not match the recomputed recommendation and original history.');
  const ticks=plan.selection.ticks,parent=book.readouts[index],erased=supplied.erasedTicks??[];
  if(declaresErasure){
    need(book.plan.schema===ACTIVE_LINEAR_CALIBRATED_MIXED_LOSS_SCHEMA&&
      Array.isArray(erased)&&erased.length===1&&ticks.includes(erased[0]),
      'A mixed-loss follow-up can acknowledge one missing recommended tick.');
    // Older complete follow-ups recorded only their received ticks. Inspect the
    // bound history as well so a previously spent erasure cannot be spent again.
    for(let ancestor=parent;ancestor;ancestor=book.readouts.find(row=>row.result.readingsSHA256===ancestor.result.historySHA256))
      need(!ancestor.result.missingTicks.length,'The preceding trajectory already used its one missing tick.');
  }
  const expected=ticks.filter(t=>!erased.includes(t));
  need(Array.isArray(supplied.readings)&&supplied.readings.length===expected.length&&supplied.readings.every(row=>
    row&&Object.keys(row).sort().join(',')==='tick,value'&&expected.includes(row.tick))&&
    new Set(supplied.readings.map(row=>row.tick)).size===expected.length,'Account for every distinct recommended future tick.');
  const rows=[...historicalRows(parent),...supplied.readings].sort((a,b)=>a.tick-b.tick);
  const missing=declaresErasure?erased:(parent.result.futureTicks?parent.result.missingTicks:[]);
  const checked=classifyAccumulatedReadings(request,rows);
  const status=readingStatus(checked);
  const result={schema:'worldlaw.active-linear-followup-result/v1',sourceSHA256:plan.sourceSHA256,
    planSHA256:plan.planSHA256,historySHA256:plan.historySHA256,followupSHA256:plan.followupSHA256,
    readingsSHA256:await activeBytesSHA256(text),readoutSource:supplied.source,
    acquisition:parent.result.acquisition==='synthetic'&&supplied.acquisition==='synthetic'?'synthetic':'supplied',
    extensionAcquisition:supplied.acquisition,noiseBound:plan.noiseBound,status,...checked,
    plannedTicks:[...rows.map(r=>r.tick),...missing].sort((a,b)=>a-b),receivedTicks:rows.map(r=>r.tick),missingTicks:missing,accumulatedReadings:rows,
    futureTicks:ticks,physicalProvenanceVerified:false,
    interpretation:'The accumulated readings use one fixed gain and offset per law and at most one wrong value across both stages.'};
  if(prior)need(JSON.stringify(result)===JSON.stringify(prior),'Follow-up history, readings or decision changed; replay refused.');
  return result;
}

async function sealHistoricalReadings(book,text,prior){
  const request=conditionalSource(book),raw=JSON.parse(text);
  const keys=['schema','source','acquisition','sourceSHA256','planSHA256','readings'];
  need(Object.keys(raw).sort().join(',')===keys.sort().join(',')&&
    typeof raw.source==='string'&&raw.source.trim().length>=12&&raw.source.length<=2048&&
    ['synthetic','supplied'].includes(raw.acquisition)&&raw.sourceSHA256===book.plan.sourceSHA256&&
    raw.planSHA256===book.plan.planSHA256,'Historical readings need a valid source, acquisition and matching frozen source identifiers.');
  const menu=book.plan.offeredTicks;
  need(Array.isArray(raw.readings)&&raw.readings.length>0&&raw.readings.length<=menu.length&&
    raw.readings.every(row=>row&&Object.keys(row).sort().join(',')==='tick,value'&&menu.includes(row.tick))&&
    new Set(raw.readings.map(row=>row.tick)).size===raw.readings.length,'Supply distinct historical ticks from the offered source course.');
  const rows=raw.readings.slice().sort((a,b)=>a.tick-b.tick),checked=classifyAccumulatedReadings(request,rows);
  const result={schema:'worldlaw.active-linear-historical-result/v1',sourceSHA256:book.plan.sourceSHA256,
    planSHA256:book.plan.planSHA256,readingsSHA256:await activeBytesSHA256(text),readoutSource:raw.source,
    acquisition:raw.acquisition,noiseBound:book.plan.noiseBound,status:readingStatus(checked),...checked,
    plannedTicks:[],receivedTicks:rows.map(row=>row.tick),missingTicks:[],accumulatedReadings:rows,
    physicalProvenanceVerified:false,interpretation:'These independently supplied historical measurements precede any conditional follow-up.'};
  if(prior)need(JSON.stringify(result)===JSON.stringify(prior),'Historical bytes or conditional result changed; replay refused.');
  return result;
}

function readingStatus(checked){
  if(checked.unresolvedHypothesisIds.length)return 'readout_inconclusive';
  const count=checked.consistentHypothesisIds.length;
  return count===0?'all_hypotheses_falsified':count===1?'one_hypothesis_consistent':'multiple_hypotheses_consistent';
}

async function sealTwoPulseReadings(book,text,prior){
  const supplied=JSON.parse(text),previous=book.readouts.at(-1)?.result??null;
  need(supplied.sourceSHA256===book.plan.sourceSHA256&&supplied.planSHA256===book.plan.planSHA256&&
    supplied.previousReadingsSHA256===(previous?.readingsSHA256??null),'Two-pulse readings do not match the preceding notebook.');
  const metadata=new Set(['evidenceLevel','planSHA256','sourceSHA256','sourcePath']);
  const core=Object.fromEntries(Object.entries(book.plan).filter(([k])=>!metadata.has(k)));
  const result=receiveTwoPulse(JSON.parse(book.sourceText),core,supplied,previous);
  const report={...result,sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    previousReadingsSHA256:supplied.previousReadingsSHA256,readingsSHA256:await activeBytesSHA256(text),evidenceLevel:readingEvidence};
  if(prior)need(JSON.stringify(prior)===JSON.stringify(report),'Two-pulse source, readings or decision changed; exact replay refused.');
  return report;
}

function sealNotebookRow(book,text,prior=null){
  if(book.plan.schema===TWO_PULSE_SCHEMA)return sealTwoPulseReadings(book,text,prior);
  const schema=JSON.parse(text)?.schema;
  if(schema==='worldlaw.active-linear-historical-readings/v1')return sealHistoricalReadings(book,text,prior);
  if(schema===FOLLOWUP_READINGS)return sealFollowup(book,text,prior);
  return book.plan.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA?sealAdaptiveRound(book,text,{prior}):
    sealActiveReadout(book.sourceText,book.plan,text,{prior});
}

/** Recompute every scientific claim before a caller replaces its current state. */
export async function replayActiveNotebook(raw){
  const book=notebookObject(raw);
  const plan=await sealActivePlan(book.sourceText,{prior:book.plan});
  const readouts=[];
  for(const row of book.readouts){
    const result=await sealNotebookRow({...book,plan,readouts},row.readingsText,row.result);
    readouts.push({readingsText:row.readingsText,result});
  }
  return {schema:book.schema,sourceText:book.sourceText,plan,readouts};
}
/** Append a separate reading set; never replace or silently merge earlier values. */
export async function receiveActiveNotebook(raw,originalReadings){
  const text=sourceText(originalReadings),book=await replayActiveNotebook(raw);
  need(book.readouts.length<16,'This notebook already contains 16 reading sets; save it and start a separate notebook.');
  const result=await sealNotebookRow(book,text);
  need(!book.readouts.some(row=>row.result.readingsSHA256===result.readingsSHA256),
    'These exact reading bytes are already recorded.');
  const next={...book,readouts:[...book.readouts,{readingsText:text,result}]};
  if(book.plan.schema===ACTIVE_DRIFT_PLAN)notebookObject(next);
  return next;
}
