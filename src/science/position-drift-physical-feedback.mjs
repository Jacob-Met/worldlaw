import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {RATE_WORK_EXHAUSTED,rateWorkBudget} from './position-drift-rate-polytopes.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {parsePulseTree,buildPhysicalTreeProof,checkPhysicalTreeProof,receivePhysicalTree,compactPhysicalTree} from './persistent-feedback-tree.mjs';

export const FEEDBACK_TREE_SOURCE='worldlaw.position-drift-physical-feedback-tree/v1';
const schema='worldlaw.position-drift-physical-feedback-proof/v1';
function need(ok,message){if(!ok)throw Error('Feedback experiment: '+message);}

function prepare(input){
  need(input?.schema===FEEDBACK_TREE_SOURCE&&Object.keys(input).sort().join(',')==='catalog,horizon,program,schema',
    'supply a horizon, catalog and finite tree');
  const horizon=input.horizon;
  need(Number.isSafeInteger(horizon)&&horizon>=2&&horizon<=16,'supported horizons are two through sixteen');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:input.catalog,fourPulseControl:null});
  const {leaves,program}=parsePulseTree(input.program,cat,horizon);
  return {cat,leaves,source:{schema:FEEDBACK_TREE_SOURCE,catalog:canonical,horizon,program}};
}
function verdict(cat,radius){return compare(cat.error,rational(radius))<0?'policy-separates':'tree-refuted';}
export function certifyPhysicalFeedbackTree(input){
  const {cat,leaves,source}=prepare(input),work=rateWorkBudget(source.catalog.limits.designWork);
  try{
    // The revised-simplex inverse is dense. Check its size before allocating it.
    const histories=new Set();
    for(const word of leaves)for(let tick=2;tick<=word.length;tick++){
      work.spend();histories.add(word.slice(0,tick).join(','));
    }
    const privateWidth=cat.vertices.reduce((n,vertices)=>n+vertices.length+1,0);
    const basisSize=2*(histories.size+privateWidth*leaves.length)+1;
    if(basisSize*basisSize>source.catalog.limits.designWork)throw RATE_WORK_EXHAUSTED;
    const tree=buildPhysicalTreeProof(cat,leaves,work.spend);
    const compact=compactPhysicalTree(cat,leaves,tree,work.spend);
    return {schema,source,status:'tree-certified',tree,compact,atRequestedNoise:verdict(cat,tree.radius),work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {schema,source,status:'design-budget-exhausted',work:work.used};
  }
}
export function verifyPhysicalFeedbackTree(input,saved){
  const {cat,source,leaves}=prepare(input);
  need(saved?.schema===schema&&equalPositionDriftData(source,saved.source),'source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(saved,certifyPhysicalFeedbackTree(input)),'unreproducible exhaustion');
    return true;
  }
  need(saved.status==='tree-certified'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&
    saved.work<=source.catalog.limits.designWork,'invalid solved report');
  const work=rateWorkBudget(source.catalog.limits.designWork);
  try{
    checkPhysicalTreeProof(cat,leaves,saved.tree,work.spend);
    const kept=saved.compact?.kept;
    need(Array.isArray(kept)&&kept.length>=1&&kept.length<=2**(source.horizon-2)&&kept.every((j,i)=>
      Number.isSafeInteger(j)&&j>=0&&j<leaves.length&&(!i||j>kept[i-1])),'invalid retained leaf indices');
    need(saved.compact.proof.radius===saved.tree.radius,'the restricted tree has a different radius');
    checkPhysicalTreeProof(cat,kept.map(i=>leaves[i]),saved.compact.proof,work.spend);
  }
  catch(error){if(error!==RATE_WORK_EXHAUSTED)throw error;throw Error('Feedback proof exceeds its replay budget');}
  need(saved.atRequestedNoise===verdict(cat,saved.tree.radius),'incorrect noise verdict');
  return true;
}
export function receivePhysicalFeedbackTree(input,saved,readings,{twoWordRule=false}={}){
  verifyPhysicalFeedbackTree(input,saved);
  const {cat,leaves,source}=prepare(input);
  need(saved.status==='tree-certified','receiver requires a solved tree');
  need(!twoWordRule||saved.compact.kept.length===2,'the two-word rule requires exactly two retained words');
  return receivePhysicalTree(cat,saved.compact.kept.map(i=>leaves[i]),saved.tree.radius,
    source.catalog.limits.receiverWork,readings,twoWordRule?saved.compact.proof:null);
}
