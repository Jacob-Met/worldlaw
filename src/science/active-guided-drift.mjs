import {SEGMENT_SOURCE,SEGMENT_PLAN,planRateSegments,observeRateSegmentSchedule} from './position-drift-rate-segments.mjs';
export {SEGMENT_SOURCE,SEGMENT_PLAN};
import {ONE_FEEDBACK_REQUEST,ONE_FEEDBACK_PLAN,planOneFeedback,receiveOneFeedback} from './persistent-position-drift-one-feedback.mjs';
import {SHARED_SUFFIX_REQUEST,PLANAR_SUFFIX_REQUEST,REGION_SUFFIX_REQUEST,HISTORY_SUFFIX_REQUEST,SUFFIX_REQUEST,SUFFIX_PLAN,planSuffixFeedback,receiveSuffixFeedback} from './position-drift-suffix-feedback.mjs';
import {EXACT_TREE_REQUEST,TREE_REQUEST,TREE_PLAN,planFeedbackTree,receiveFeedbackTree} from './position-drift-feedback-tree.mjs';
export {ONE_FEEDBACK_REQUEST,ONE_FEEDBACK_PLAN,SUFFIX_REQUEST,HISTORY_SUFFIX_REQUEST,SUFFIX_PLAN,TREE_PLAN};
export const isSuffixRequest=request=>request?.schema===SUFFIX_REQUEST||request?.schema===HISTORY_SUFFIX_REQUEST||request?.schema===REGION_SUFFIX_REQUEST||request?.schema===PLANAR_SUFFIX_REQUEST||request?.schema===SHARED_SUFFIX_REQUEST||request?.schema===TREE_REQUEST||request?.schema===EXACT_TREE_REQUEST;
export const driftFeedbackInconclusive=p=>(p.schema===ONE_FEEDBACK_PLAN&&p.status!=='one-feedback-certified')||
  (p.schema===SUFFIX_PLAN&&p.status!=='suffix-certified')||(p.schema===TREE_PLAN&&p.status!=='tree-certified');
/** Measurement-led notebook continuations for minimum and case-12 drift plans. */
import {planAllHorizonPositionDrift,planBinaryPositionDriftMinimum,observeCertifiedPositionDriftTape} from './persistent-position-drift-all-horizon.mjs';
import {certifyMulticlassPositionDriftMinimum} from './persistent-position-drift-multiclass-minimum.mjs';
import {planCaseTwelveOneFeedback,openCaseTwelveOneFeedback} from './position-drift-case-twelve-feedback.mjs';

export const CASE_TWELVE_REQUEST='worldlaw.active-case-twelve-source/v1';
export const CASE_TWELVE_PLAN='worldlaw.case-twelve-one-feedback/v1';
export const BINARY_PLAN='worldlaw.position-drift-binary-minimum/v1';
export const MULTICLASS_PLAN='worldlaw.multiclass-position-drift-minimum/v1';
export const GUIDED_INPUT='worldlaw.active-guided-drift-readings/v1';
export const GUIDED_RESULT='worldlaw.active-guided-drift-result/v1';
export const isGuidedPlan=p=>[BINARY_PLAN,MULTICLASS_PLAN,CASE_TWELVE_PLAN,ONE_FEEDBACK_PLAN,SUFFIX_PLAN,TREE_PLAN,SEGMENT_PLAN].includes(p?.schema);
const need=(ok,msg)=>{if(!ok)throw Error('Guided position/drift: '+msg);};
const fields=(o,ks)=>o && typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===[...ks].sort().join(',');

export function designCatalog(request,design={}){
  if(request.schema===SEGMENT_SOURCE)return planRateSegments(request);
  if(request.schema===TREE_REQUEST||request.schema===EXACT_TREE_REQUEST)return planFeedbackTree(request);
  if(isSuffixRequest(request))return planSuffixFeedback(request);
  if(request.schema===ONE_FEEDBACK_REQUEST)return planOneFeedback(request);
  if(request.schema===CASE_TWELVE_REQUEST){
    need(fields(request,['schema','first']),'supply exactly the source schema and first command');
    return planCaseTwelveOneFeedback(request.first);
  }
  if(design.method===BINARY_PLAN)return planBinaryPositionDriftMinimum(request);
  if(design.method===MULTICLASS_PLAN)return certifyMulticlassPositionDriftMinimum(request,design.limits);
  need(!design.method||design.method==='worldlaw.position-drift-all-horizon-policy/v1','unknown catalog planner');
  return planAllHorizonPositionDrift(request);
}

export function fixedDriftRuns(p){return (p.schema===BINARY_PLAN||p.schema===SEGMENT_PLAN)?p.runs:p.tape.runs;}
export function pendingDriftSteps(plan,last){
  if(driftFeedbackInconclusive(plan)||plan.status==='indistinguishable'||(last&&!last.checked.surviving.length))return [];
  const count=last?.checked.values.length??0;
  const initial={tick:'0',command:null,repeats:'0'};
  if(plan.schema===TREE_PLAN){
    const word=last?.checked.committed??(plan.nodes?plan.nodes[0].commands:plan.tables[plan.entry].commands);
    return [initial,...word.map((command,i)=>({tick:String(i+1),command,repeats:'1'}))].slice(count);
  }
  if(plan.schema===SUFFIX_PLAN){
    const steps=[initial,...plan.prefix.map((command,i)=>({tick:String(i+1),command,repeats:'1'}))];
    if(count>=steps.length){
      const suffix=plan.suffixes[last.checked.suffix],start=steps.length;
      steps.push(...suffix.map((command,i)=>({tick:String(start+i),command,repeats:'1'})));
    }
    return steps.slice(count);
  }
  if(plan.schema===CASE_TWELVE_PLAN||plan.schema===ONE_FEEDBACK_PLAN){
    const lastTick=plan.prefix.length+1;
    if(count===lastTick)return [{tick:String(lastTick),command:last.checked.nextCommand,repeats:'1'}];
    if(count>lastTick)return [];
    return [initial,...plan.prefix.map((command,i)=>({tick:String(i+1),command,repeats:'1'}))].slice(count);
  }
  let tick=0n;
  return [initial,...fixedDriftRuns(plan).map(r=>{
    tick+=BigInt(r.repeats);return {tick:String(tick),...r};
  })].slice(count);
}

export function receiveGuidedDrift(book,input){
  const p=book.plan,last=book.readouts.at(-1)?.result;
  need(fields(input,['schema','sourceSHA256','planSHA256','previousReadingsSHA256','source','acquisition','readings'])&&
    input.schema===GUIDED_INPUT,'choose a guided reading packet with its original binding fields');
  need(input.sourceSHA256===p.sourceSHA256&&input.planSHA256===p.planSHA256&&
    input.previousReadingsSHA256===(last?.readingsSHA256??null),'packet does not continue this frozen notebook');
  need(typeof input.source==='string'&&input.source.trim().length>=12&&input.source.length<=2048&&
    ['supplied','synthetic'].includes(input.acquisition),'give the run a source description and acquisition kind');
  need(!last||(last.acquisition===input.acquisition&&last.readoutSource===input.source),'continue the same declared run and acquisition kind');
  const pending=pendingDriftSteps(p,last);
  need(Array.isArray(input.readings)&&input.readings.length>0&&input.readings.length<=pending.length,
    'enter consecutive pending ticks; receive the fixed prefix before its last command');
  const values=[...(last?.checked.values??[])],ticks=[...(last?.checked.ticks??[])],commands=[...(last?.checked.commands??[])];
  for(const [i,row] of input.readings.entries()){
    const step=pending[i];
    need(fields(row,['tick','command','value'])&&row.tick===step.tick&&row.command===step.command&&typeof row.value==='string',
      'each reading must match the pending tick and applied command and carry an exact value string');
    ticks.push(row.tick);values.push(row.value);
    if(row.command!==null)commands.push(row.command);
  }
  let surviving,nextCommand,suffix,tree;
  if(p.schema===CASE_TWELVE_PLAN||p.schema===ONE_FEEDBACK_PLAN||p.schema===SUFFIX_PLAN||p.schema===TREE_PLAN){
    const checked=p.schema===TREE_PLAN?receiveFeedbackTree(p,values):p.schema===SUFFIX_PLAN?receiveSuffixFeedback(p,values):p.schema===CASE_TWELVE_PLAN?openCaseTwelveOneFeedback(p.prefix[0]).receive(values):receiveOneFeedback(p,values);
    need(JSON.stringify(checked.commands)===JSON.stringify(commands),'applied commands disagree with the retained readings');
    surviving=checked.witnesses.map(w=>({law:w.law,initialWitness:w.start}));nextCommand=checked.nextCommand;suffix=checked.suffix;
    if(p.schema===TREE_PLAN)tree={committed:checked.committed,decisions:checked.decisions};
  }else{
    const checked=p.schema===SEGMENT_PLAN?observeRateSegmentSchedule(p,values):observeCertifiedPositionDriftTape(p.source,fixedDriftRuns(p),values);
    surviving=checked.surviving;nextCommand=surviving.length?(pending[input.readings.length]?.command??null):null;
  }
  const checked={values,ticks,commands,surviving,nextCommand};
  if(p.schema===SUFFIX_PLAN)checked.suffix=suffix;
  if(tree)Object.assign(checked,tree);
  const remaining=pendingDriftSteps(p,{checked});checked.nextTick=remaining[0]?.tick??null;
  return {schema:GUIDED_RESULT,acquisition:input.acquisition,readoutSource:input.source,
    consistentHypothesisIds:surviving.map(w=>w.law),checked,status:surviving.length===0?'all_hypotheses_falsified':
      surviving.length===1?'one_hypothesis_consistent':'multiple_hypotheses_consistent'};
}
