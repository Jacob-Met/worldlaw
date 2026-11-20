/** Byte-bound experiment records shared by the CLI and browser.
 * Hashes identify supplied bytes and replayed claims. They do not authenticate
 * a sensor, actuation, calibration, the time of planning or physical origin.
 */
import {
  ACTIVE_LINEAR_FAMILY_SCHEMA, ACTIVE_INTERVENTION_SCHEMA, ACTIVE_LINEAR_CONTROL_BOX_SCHEMA, ACTIVE_LINEAR_JOINT_CONTROL_SCHEMA,
  designActiveLinearFamily, designActiveInterventionFamily, designActiveLinearControlBox, designActiveLinearJointControl,
  replayActiveLinearFamily, replayActiveInterventionFamily, replayActiveLinearControlBox, replayActiveLinearJointControl,
  evaluateActiveLinearReadings,
} from './active-linear-family.mjs';
import {ACTIVE_LINEAR_ADAPTIVE_SCHEMA,ACTIVE_ADAPTIVE_READINGS_SCHEMA,
  designActiveLinearAdaptive,replayActiveLinearAdaptive,evaluateActiveAdaptiveReadings}
  from './active-linear-adaptive.mjs';

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
  const request=JSON.parse(decoder.decode(bytes));
  const multiple=request?.schema===ACTIVE_INTERVENTION_SCHEMA;
  const bounded=request?.schema===ACTIVE_LINEAR_CONTROL_BOX_SCHEMA;
  const joint=request?.schema===ACTIVE_LINEAR_JOINT_CONTROL_SCHEMA;
  const adaptive=request?.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA;
  need(multiple||bounded||joint||adaptive||request?.schema===ACTIVE_LINEAR_FAMILY_SCHEMA,
    'Unrecognized active experiment source schema; choose linear family, intervention family, control box, joint control or adaptive v1');
  return {request,multiple,bounded,joint,adaptive};
}
function pick(value,keys){return Object.fromEntries(keys.map(key=>[key,value?.[key]]));}

/** Create a new prospective plan, or reproduce a saved plan exactly. */
export async function sealActivePlan(original,{prior=null,sourcePath}={}){
  const bytes=bytesOf(original),{request,multiple,bounded,joint,adaptive}=source(bytes);
  const saved=prior==null?null:clone(prior);
  const core=multiple?designActiveInterventionFamily(request):bounded?
    designActiveLinearControlBox(request):joint?designActiveLinearJointControl(request):
    adaptive?designActiveLinearAdaptive(request):designActiveLinearFamily(request);
  const sourceSHA256=await activeBytesSHA256(bytes);
  let frozen=core,planSHA256=await activeBytesSHA256(JSON.stringify(core));
  if(saved){
    need(saved.sourceSHA256===sourceSHA256,
      'Original source bytes changed; cannot replay experiment certificate');
    const previous=pick(saved,Object.keys(core));
    need(saved.planSHA256===await activeBytesSHA256(JSON.stringify(previous)),
      'Prospective plan digest changed; cannot replay experiment certificate');
    if(multiple)replayActiveInterventionFamily(request,previous);
    else if(bounded)replayActiveLinearControlBox(request,previous);
    else if(joint)replayActiveLinearJointControl(request,previous);
    else if(adaptive)replayActiveLinearAdaptive(request,previous);
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
  const {request}=source(sourceBytes);
  need(request.schema!==ACTIVE_LINEAR_ADAPTIVE_SCHEMA,
    'Adaptive readings require the original portable notebook and its complete preceding transcript.');
  const supplied=JSON.parse(decoder.decode(readingBytes));
  need(supplied.sourceSHA256===frozen.sourceSHA256&&supplied.planSHA256===frozen.planSHA256,
    'Readout source or plan digest does not match the frozen prospective certificate.');
  const core=Object.fromEntries(Object.entries(frozen).filter(([key])=>
    !['sourceSHA256','planSHA256','evidenceLevel'].includes(key)));
  const result=evaluateActiveLinearReadings(request,core,supplied);
  const report={sourceSHA256:frozen.sourceSHA256,planSHA256:frozen.planSHA256,
    readingsSHA256:await activeBytesSHA256(readingBytes),
    ...(sourcePath!==undefined?{sourcePath}:{}),...(planPath!==undefined?{planPath}:{}),
    ...(readingsPath!==undefined?{readingsPath}:{}),...result,evidenceLevel:readingEvidence};
  if(saved){
    const keys=['sourceSHA256','planSHA256','readingsSHA256',...Object.keys(result)];
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
  const book=JSON.parse(text);
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
  return {schema:ACTIVE_EXPERIMENT_NOTEBOOK_SCHEMA,sourceText:text,
    plan:await sealActivePlan(text,{prior:plan}),readouts:[]};
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
  const node=started&&!stopped?plan.policy.states.find(row=>row.key===mask+':'+budget):null;
  const action=node?plan.experiments.find(row=>row.id===node.action):null;
  return {status:!started?plan.status:stopped?last.status:'awaiting_readings',
    mask,budget,node,action,round:book.readouts.length+1,
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
    {mask:current.mask,budget:current.budget});
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
/** Recompute every scientific claim before a caller replaces its current state. */
export async function replayActiveNotebook(raw){
  const book=notebookObject(raw);
  const plan=await sealActivePlan(book.sourceText,{prior:book.plan});
  const readouts=[];
  for(const row of book.readouts){
    const result=plan.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA?
      await sealAdaptiveRound({...book,plan,readouts},row.readingsText,{prior:row.result}):
      await sealActiveReadout(book.sourceText,plan,row.readingsText,{prior:row.result});
    readouts.push({readingsText:row.readingsText,result});
  }
  return {schema:book.schema,sourceText:book.sourceText,plan,readouts};
}
/** Append a separate reading set; never replace or silently merge earlier values. */
export async function receiveActiveNotebook(raw,originalReadings){
  const text=sourceText(originalReadings),book=await replayActiveNotebook(raw);
  need(book.readouts.length<16,'This notebook already contains 16 reading sets; save it and start a separate notebook.');
  const result=book.plan.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA?await sealAdaptiveRound(book,text):
    await sealActiveReadout(book.sourceText,book.plan,text);
  need(!book.readouts.some(row=>row.result.readingsSHA256===result.readingsSHA256),
    'These exact reading bytes are already recorded.');
  return {...book,readouts:[...book.readouts,{readingsText:text,result}]};
}
