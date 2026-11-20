/** Exact finite adaptive experiments with independently unknown nuisance starts.
 * The entire policy is compiled before any observation. Readouts can only move
 * through that frozen policy; they cannot change hypotheses, costs or controls.
 */
import {compileActiveLinearImages,ACTIVE_LINEAR_EXACT_ARITHMETIC as arithmetic}
  from './active-linear-family.mjs';
import {maximizeFeasibleRationalProgram} from './exact-box-envelope.mjs';

export const ACTIVE_LINEAR_ADAPTIVE_SCHEMA='worldlaw.active-linear-adaptive/v1';
export const ACTIVE_ADAPTIVE_READINGS_SCHEMA='worldlaw.active-adaptive-readings/v1';
export const ACTIVE_ADAPTIVE_RESULT_SCHEMA='worldlaw.active-adaptive-result/v1';
const {Q,Z,add,sub,mul,div,neg,dot,fmt,parseSource}=arithmetic;
const fail=message=>{throw Error('Adaptive experiment: '+message);};
const need=(condition,message)=>{if(!condition)fail(message);};
const zero=n=>Array.from({length:n},Z);
const abs=value=>value.n<0n?neg(value):value;
const maximum=values=>values.reduce((a,b)=>sub(a,b).n>=0n?a:b,Z());
const same=(a,b)=>sub(a,b).n===0n;
const exactKeys=(value,keys,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===[...keys].sort().join(','),label+' has missing or unexpected fields');
const singleton=mask=>(mask&(mask-1))===0;
const idsFor=(ids,mask)=>ids.filter((_,i)=>mask&(1<<i));
const budgetFor=limit=>({limit,nodes:0,exhausted:false,take(){
  if(this.nodes>=this.limit){this.exhausted=true;return false;}
  this.nodes++;return true;
}});

function compile(request){
  exactKeys(request,['schema','source','resetSemantics','hypotheses','experiments','noiseBound',
    'maxTotalReadings','workLimit'],'source');
  need(request.schema===ACTIVE_LINEAR_ADAPTIVE_SCHEMA,'explicit adaptive v1 source schema required');
  need(request.resetSemantics==='independent-unknown-state-per-experiment',
    'declare independent unknown initial states and fresh bounded errors for each experiment');
  need(Number.isSafeInteger(request.maxTotalReadings)&&request.maxTotalReadings>=1&&
    request.maxTotalReadings<=32,'maxTotalReadings must be 1–32');
  need(Number.isSafeInteger(request.workLimit)&&request.workLimit>=100&&request.workLimit<=50000,
    'workLimit must be 100–50000');
  need(Array.isArray(request.hypotheses)&&request.hypotheses.length>=2&&request.hypotheses.length<=5,
    'declare 2–5 persistent competing laws');
  request.hypotheses.forEach(law=>exactKeys(law,['id','A','B','C'],'law'));
  need(Array.isArray(request.experiments)&&request.experiments.length>=1&&request.experiments.length<=8,
    'offer 1–8 complete experiment bundles');
  const names=new Set();let channels=null;
  const actions=request.experiments.map(experiment=>{
    exactKeys(experiment,['id','controls','readings','actuationCost'],'experiment');
    need(typeof experiment.id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(experiment.id)&&
      !names.has(experiment.id),'experiment IDs must be distinct stable labels');
    names.add(experiment.id);
    need(Array.isArray(experiment.readings)&&experiment.readings.length>=1&&experiment.readings.length<=8,
      'each bundle needs 1–8 prescribed readings');
    let previous=-1;
    for(const reading of experiment.readings){
      exactKeys(reading,['tick','cost'],'planned reading');
      need(Number.isSafeInteger(reading.tick)&&reading.tick>previous,
        'bundle reading ticks must be distinct nonnegative increasing integers');
      previous=reading.tick;
      need(Number.isSafeInteger(reading.cost)&&reading.cost>=1&&reading.cost<=1000000000,
        'reading cost must be a positive integer at most 1000000000');
    }
    need(Number.isSafeInteger(experiment.actuationCost)&&experiment.actuationCost>=0&&
      experiment.actuationCost<=1000000000,'actuation cost must be a nonnegative integer at most 1000000000');
    const compiled=compileActiveLinearImages({schema:'worldlaw.active-linear-family/v1',source:request.source,
      hypotheses:request.hypotheses,controls:experiment.controls,
      offeredTicks:experiment.readings.map(r=>r.tick),
      costByTick:Object.fromEntries(experiment.readings.map(r=>[r.tick,r.cost])),
      maxReadings:experiment.readings.length,noiseBound:request.noiseBound,workLimit:request.workLimit});
    channels??=experiment.controls[0].length;
    need(experiment.controls[0].length===channels,'all experiments must address the same input channels');
    return {id:experiment.id,images:compiled.images,epsilon:compiled.epsilon,
      readings:experiment.readings.map(r=>({...r})),controls:experiment.controls.map(row=>row.map(value=>fmt(parseSource(value)))),
      readingCount:experiment.readings.length,
      cost:experiment.actuationCost+experiment.readings.reduce((sum,r)=>sum+r.cost,0),
      actuationCost:experiment.actuationCost};
  });
  return {actions,ids:request.hypotheses.map(h=>h.id),epsilon:actions[0].epsilon,
    fullMask:(1<<request.hypotheses.length)-1};
}

/** min_(x_h,y) max_(h,j) |O_h[j]x_h+f_h[j]-y[j]|.
 * Use x=x+−x− and y=y+−y−. M=max|f| supplies a feasible origin with
 * rho=M. Write rho=M-d, 0<=d<=M; maximizing d has nonnegative RHS.
 * For a fixed observed y, omit its free columns and shift f by that reading.
 * Every result verifies an original-space primal point and a normalized exact
 * annihilator lower bound. Numerical LP status never determines intersection.
 */
function commonRadius(images,budget,fixedReadings=null){
  const width=images[0].forced.length;
  const forcing=images.map(image=>image.forced.map((f,j)=>fixedReadings?sub(f,fixedReadings[j]):f));
  const floor=maximum(forcing.flat().map(abs));
  let slots=0;
  const stateSlots=images.map(image=>image.observable[0].map((_,j)=>
    image.observable.some(row=>row[j].n!==0n)?slots++:-1));
  const centreSlots=Array.from({length:width},()=>fixedReadings?-1:slots++);
  const count=slots*2+1,deltaColumn=count-1,A=[],b=[];
  for(let i=0;i<images.length;i++)for(let j=0;j<width;j++)for(const sign of [1n,-1n]){
    const row=zero(count),s=Q(sign);
    stateSlots[i].forEach((slot,k)=>{
      if(slot<0)return;
      const value=mul(s,images[i].observable[j][k]);row[2*slot]=value;row[2*slot+1]=neg(value);
    });
    if(!fixedReadings){row[2*centreSlots[j]]=neg(s);row[2*centreSlots[j]+1]=s;}
    row[deltaColumn]=Q(1n);A.push(row);b.push(sub(floor,mul(s,forcing[i][j])));
  }
  const cap=zero(count);cap[deltaColumn]=Q(1n);A.push(cap);b.push(floor);
  const objective=zero(count);objective[deltaColumn]=Q(1n);
  const solved=maximizeFeasibleRationalProgram(A,b,objective,budget,arithmetic);
  if(!solved.complete)return solved;
  const radius=sub(floor,solved.maximum),valueAt=slot=>slot<0?Z():sub(solved.primal[2*slot],solved.primal[2*slot+1]);
  const states=stateSlots.map(row=>row.map(valueAt));
  const centre=fixedReadings??centreSlots.map(valueAt);
  const tubeDual=solved.dual.slice(0,-1),mass=tubeDual.reduce(add,Z());
  need(radius.n>=0n,'negative common-tube radius');
  if(radius.n>0n)need(mass.n>0n,'positive radius has no separating dual');
  const weights=images.map((_,i)=>Array.from({length:width},(_,j)=>radius.n===0n?Z():
    div(sub(tubeDual[2*(i*width+j)],tubeDual[2*(i*width+j)+1]),mass)));
  need(images.every((image,i)=>image.observable.every((row,j)=>
    sub(radius,abs(sub(add(dot(row,states[i]),image.forced[j]),centre[j]))).n>=0n)),
    'original common-tube primal certificate failed');
  need(sub(Q(1n),weights.flat().map(abs).reduce(add,Z())).n>=0n,
    'common-tube dual norm exceeds one');
  need(images.every((image,i)=>image.observable[0].every((_,k)=>
    dot(weights[i],image.observable.map(row=>row[k])).n===0n)),
    'common-tube dual does not eliminate a nuisance start');
  if(!fixedReadings)need(Array.from({length:width},(_,j)=>weights.reduce((sum,row)=>add(sum,row[j]),Z()))
    .every(value=>value.n===0n),'common-tube dual does not eliminate the shared observation');
  const lower=weights.reduce((sum,row,i)=>add(sum,dot(row,forcing[i])),Z());
  need(same(lower,radius),'common-tube original primal/dual equality failed');
  return {complete:true,radius,pivots:solved.pivots,certificate:{centre:centre.map(fmt),
    initialStates:images.map((image,i)=>({hypothesis:image.id,values:states[i].map(fmt)})),
    weights:images.map((image,i)=>({hypothesis:image.id,values:weights[i].map(fmt)})),
    meaning:fixedReadings?'Exact supplied-reading distance, with a nuisance-state primal and an annihilator lower bound.':
      'Exact common-tube radius: one common observation, independently unknown starts, and a matching annihilator lower bound.'}};
}

function maximalMasks(feasible,mask){
  const subsets=feasible.filter(item=>(item&mask)===item);
  return subsets.filter(item=>!subsets.some(other=>other!==item&&(item&other)===item));
}

function staticCatalogue(actions,fullMask,budget){
  const pairs=[];
  for(let i=0;(1<<i)<=fullMask;i++)for(let j=i+1;(1<<j)<=fullMask;j++)pairs.push((1<<i)|(1<<j));
  let best=null;
  for(let mask=1;mask<(1<<actions.length);mask++){
    if(!budget.take())return null;
    const chosen=actions.filter((_,i)=>mask&(1<<i));
    if(pairs.some(pair=>chosen.every(action=>action.feasible.has(pair))))continue;
    const readings=chosen.reduce((sum,action)=>sum+action.readingCount,0),cost=chosen.reduce((sum,a)=>sum+a.cost,0);
    if(!best||readings<best.readings||(readings===best.readings&&cost<best.cost))
      best={readings,cost,experiments:chosen.map(a=>a.id),mask};
  }
  return best;
}

export function designActiveLinearAdaptive(request){
  const {actions,ids,epsilon,fullMask}=compile(request),budget=budgetFor(request.workLimit);
  const geometry=[];
  const base=()=>({schema:ACTIVE_LINEAR_ADAPTIVE_SCHEMA,source:request.source,hypothesisIds:ids,
    resetSemantics:request.resetSemantics,noiseBound:fmt(epsilon),maxTotalReadings:request.maxTotalReadings,
    sourceOnly:true,outcomeValuesUsed:false,physicalActionsPerformed:false,
    experiments:actions.map(({id,controls,readings,actuationCost,cost})=>({id,controls,readings,actuationCost,cost})),
    geometry,workLimit:budget.limit,nodes:budget.nodes,exhausted:budget.exhausted,
    workAccounting:'Common-tube mask traversals and exact LP starts/affected tableau rows, maximal-mask traversals, static catalogue subsets and memoized policy state/action checks share one hard limit.',
    worstReadings:null,worstCost:null,policy:null,staticPlan:null});
  const incomplete=()=>({...base(),status:'search_inconclusive',
    interpretation:'The declared exact-work limit was reached. Partial intersection certificates do not establish an optimal policy or an impossibility result.'});
  for(const action of actions){
    const entry={experimentId:action.id,intersections:[],complete:false};geometry.push(entry);
    action.feasible=new Set();action.maximal=new Map();
    for(let mask=1;mask<=fullMask;mask++){
      if(!budget.take())return incomplete();
      const images=action.images.filter((_,i)=>mask&(1<<i));
      const result=commonRadius(images,budget);
      if(!result.complete)return incomplete();
      const feasible=sub(result.radius,epsilon).n<=0n;
      if(feasible)action.feasible.add(mask);
      entry.intersections.push({mask,hypothesisIds:idsFor(ids,mask),radius:fmt(result.radius),feasible,
        certificate:result.certificate});
    }
    const feasible=[...action.feasible];
    for(let mask=1;mask<=fullMask;mask++){
      if(!budget.take())return incomplete();
      action.maximal.set(mask,maximalMasks(feasible,mask));
    }
    entry.complete=true;entry.maximalMasks=action.maximal.get(fullMask);
  }
  const staticPlan=staticCatalogue(actions,fullMask,budget);
  if(budget.exhausted)return incomplete();
  if(!staticPlan)return {...base(),status:'no_guaranteed_policy',
    interpretation:'At least one pair can remain compatible under every offered experiment. Fresh arbitrary nuisance states permit that ambiguity to persist for any finite policy.'};
  const memo=new Map();
  const solve=(mask,remaining)=>{
    if(singleton(mask))return {cost:0,actualReadings:0,action:null};
    const key=mask+':'+remaining;
    if(memo.has(key))return memo.get(key);
    if(!budget.take())return null;
    let winner=null;
    for(let index=0;index<actions.length;index++){
      if(!budget.take())return null;
      const action=actions[index];
      if(action.readingCount>remaining||action.feasible.has(mask))continue;
      const children=action.maximal.get(mask).map(child=>solve(child,remaining-action.readingCount));
      if(budget.exhausted)return null;
      if(children.some(child=>child===null))continue;
      const cost=action.cost+Math.max(...children.map(child=>child.cost));
      const actualReadings=action.readingCount+Math.max(...children.map(child=>child.actualReadings));
      if(!winner||cost<winner.cost)winner={cost,actualReadings,action:index};
    }
    memo.set(key,winner);return winner;
  };
  let root=null,rootBudget=null;
  for(let remaining=1;remaining<=request.maxTotalReadings;remaining++){
    root=solve(fullMask,remaining);
    if(budget.exhausted)return incomplete();
    if(root){rootBudget=remaining;break;}
  }
  if(!root)return {...base(),status:'insufficient_total_reading_budget',staticPlan,
    interpretation:'The catalogue can distinguish the family, but no adaptive policy guarantees a singleton within the declared total reading budget.'};
  const states=[];
  // Store every possible observed subset, not only worst-case maximal branches.
  // A smaller actual survivor set therefore follows a precomputed frozen node.
  for(let remaining=0;remaining<=rootBudget;remaining++)for(let mask=1;mask<=fullMask;mask++){
    if(singleton(mask))continue;
    const value=solve(mask,remaining);
    if(budget.exhausted)return incomplete();
    if(!value)continue;
    const action=actions[value.action];
    states.push({key:mask+':'+remaining,mask,hypothesisIds:idsFor(ids,mask),budget:remaining,
      action:action.id,cost:value.cost,actualReadings:value.actualReadings,
      branchMasks:action.maximal.get(mask),remainingAfterAction:remaining-action.readingCount});
  }
  need(root.actualReadings===rootBudget,'minimal root budget does not match its attained worst branch');
  return {...base(),status:'optimal_certified_adaptive_policy',worstReadings:rootBudget,worstCost:root.cost,
    staticPlan,policy:{rootKey:fullMask+':'+rootBudget,initialMask:fullMask,states},
    interpretation:'Exact minimum worst-case readings, then worst declared cost, over the frozen finite experiment catalogue and independent fresh nuisance states. This policy does not discover the candidate family or authenticate physical evidence.'};
}

export function replayActiveLinearAdaptive(request,prior){
  const expected=designActiveLinearAdaptive(request);
  need(JSON.stringify(expected)===JSON.stringify(prior),'frozen adaptive policy changed; exact replay refused');
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}

/** Scientific readout evaluation for one already replayed policy node. Byte,
 * source and transcript custody is enforced by the shared record layer. */
export function evaluateActiveAdaptiveReadings(request,plan,readout,state){
  replayActiveLinearAdaptive(request,plan);
  need(plan.status==='optimal_certified_adaptive_policy','a certified frozen policy is required');
  need(state&&Number.isSafeInteger(state.mask)&&state.mask>0&&!singleton(state.mask)&&
    Number.isSafeInteger(state.budget),'a live nonterminal frozen state is required');
  const node=plan.policy.states.find(row=>row.key===state.mask+':'+state.budget);
  need(node,'the observed survivor state has no frozen continuation');
  need(readout&&readout.schema===ACTIVE_ADAPTIVE_READINGS_SCHEMA,'explicit adaptive readings v1 required');
  need(typeof readout.source==='string'&&readout.source.trim().length>=12&&readout.source.length<=2048,
    'declare the independently obtained reading source');
  need(['synthetic','supplied'].includes(readout.acquisition),'acquisition must be synthetic or supplied');
  need(readout.experimentId===node.action,'readings name a different experiment from the frozen current node');
  const compiled=compile(request),action=compiled.actions.find(a=>a.id===node.action);
  need(Array.isArray(readout.readings)&&readout.readings.length===action.readings.length,
    'supply every reading in this complete experiment bundle before advancing');
  const values=new Map();
  for(const row of readout.readings){
    exactKeys(row,['tick','value'],'received reading');
    need(Number.isSafeInteger(row.tick)&&action.readings.some(r=>r.tick===row.tick)&&!values.has(row.tick),
      'readings must use every prescribed tick exactly once');
    values.set(row.tick,parseSource(row.value));
  }
  const fixed=action.readings.map(row=>values.get(row.tick)),budget=budgetFor(request.workLimit),checks=[];
  let nextMask=0,unresolvedMask=0;
  for(let i=0;i<compiled.ids.length;i++){
    if(!(state.mask&(1<<i)))continue;
    const result=commonRadius([action.images[i]],budget,fixed);
    if(!result.complete){unresolvedMask|=1<<i;checks.push({hypothesis:compiled.ids[i],status:'inconclusive',
      minimumNoiseRequired:null,noiseMarginExact:false,noiseLowerBound:'0'});continue;}
    const consistent=sub(result.radius,compiled.epsilon).n<=0n;
    if(consistent)nextMask|=1<<i;
    checks.push({hypothesis:compiled.ids[i],status:consistent?'consistent':'falsified',
      minimumNoiseRequired:fmt(result.radius),noiseMarginExact:true,noiseLowerBound:fmt(result.radius),certificate:result.certificate});
  }
  const status=unresolvedMask?'readout_inconclusive':nextMask===0?'all_remaining_hypotheses_falsified':
    singleton(nextMask)?'one_hypothesis_consistent':'continue_frozen_policy';
  const nextBudget=state.budget-action.readingCount;
  if(!unresolvedMask&&nextMask&&!singleton(nextMask))
    need(plan.policy.states.some(row=>row.key===nextMask+':'+nextBudget),
      'complete observations contradicted the frozen continuation guarantee');
  return {schema:ACTIVE_ADAPTIVE_RESULT_SCHEMA,source:request.source,readoutSource:readout.source,
    acquisition:readout.acquisition,sourceOnly:false,outcomeValuesUsed:true,physicalActionsPerformed:false,
    physicalProvenanceVerified:false,experimentId:action.id,priorMask:state.mask,priorBudget:state.budget,
    plannedTicks:action.readings.map(row=>row.tick),receivedTicks:action.readings.map(row=>row.tick),missingTicks:[],
    noiseBound:fmt(compiled.epsilon),checks,status,
    consistentHypothesisIds:idsFor(compiled.ids,nextMask),unresolvedHypothesisIds:idsFor(compiled.ids,unresolvedMask),
    nextMask:unresolvedMask?null:nextMask,nextBudget:unresolvedMask?null:nextBudget,
    nextStateKey:status==='continue_frozen_policy'?nextMask+':'+nextBudget:null,
    readingCount:action.readingCount,declaredCost:action.cost,nodes:budget.nodes,workLimit:budget.limit,exhausted:budget.exhausted,
    interpretation:status==='all_remaining_hypotheses_falsified'?
      'The received experiment contradicts every law that survived the preceding experiments. Keep the original transcript and investigate the family, state assumptions, input, timing or error bound.':
      'Only conditional compatibility advances the previously frozen policy. The remaining law is not authenticated physical truth.'};
}
