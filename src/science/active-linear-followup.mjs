/** A continuation keeps the same hidden state, calibration and outlier budget. */
import {compileActiveLinearImages,ACTIVE_LINEAR_EXACT_ARITHMETIC as arithmetic} from './active-linear-family.mjs';
import {maximizeFeasibleRationalProgram} from './exact-box-envelope.mjs';

export const FOLLOWUP_READINGS='worldlaw.active-linear-followup-readings/v1';
const {Q,Z,add,sub,mul,neg,fmt,parseSource}=arithmetic;
const one=()=>Q(1n);
const zero=n=>Array.from({length:n},Z);
const abs=x=>x.n<0n?neg(x):x;
const maximum=(a,b)=>sub(a,b).n>=0n?a:b;

function counter(limit){
  return {nodes:0,exhausted:false,take(){
    if(this.nodes>=limit){this.exhausted=true;return false;}
    this.nodes++;return true;
  }};
}

// For fixed bad clocks, minimize the maximum inlier error on all surviving
// rows. Historical readings are constants. Future readings have one free
// common center. Gain is shifted to its positive lower bound, so scaled
// initial state and offset are unrestricted. The tableau checks its exact
// primal and dual certificates including the original gain cap.
function sharedRadius(images,omitted,observed,future,indices,gain,budget){
  let width=0;
  const free=()=>{const slot=width;width+=2;return slot;};
  const columns=images.map(image=>({state:image.observable[0].map(free),offset:free(),gain:width++}));
  const centers=new Map(future.map(t=>[t,free()]));
  const delta=width++,terms=[];
  const pair=(row,slot,value)=>{row[slot]=value;row[slot+1]=neg(value);};
  for(const [i,image] of images.entries()){
    const v=columns[i];
    for(const t of [...observed.keys(),...future]){
      if(t===omitted[i])continue;
      const k=indices.get(t),row=zero(width);
      image.observable[k].forEach((coefficient,j)=>pair(row,v.state[j],coefficient));
      pair(row,v.offset,one());row[v.gain]=image.forced[k];
      if(centers.has(t))pair(row,centers.get(t),neg(one()));
      const shift=sub(mul(gain[0],image.forced[k]),observed.get(t)??Z());
      terms.push({row,shift});
    }
  }
  const floor=terms.reduce((bound,term)=>maximum(bound,abs(term.shift)),Z());
  const A=[],b=[];
  for(const {row,shift} of terms){
    const plus=row.slice(),minus=row.map(neg);
    plus[delta]=one();minus[delta]=one();A.push(plus,minus);
    b.push(sub(floor,shift),add(floor,shift));
  }
  for(const v of columns){
    const cap=zero(width);cap[v.gain]=one();A.push(cap);b.push(sub(gain[1],gain[0]));
  }
  const objective=zero(width);objective[delta]=one();A.push(objective);b.push(floor);
  const solved=maximizeFeasibleRationalProgram(A,b,objective,budget,arithmetic);
  if(!solved.complete)return null;
  return sub(floor,solved.maximum);
}

function setup(request,rows){
  const {ticks,epsilon,images}=compileActiveLinearImages(request);
  return {ticks,epsilon,images,indices:new Map(ticks.map((t,i)=>[t,i])),
    observed:new Map(rows.map(row=>[row.tick,parseSource(row.value)])),
    gain:request.sensorGain.map(parseSource),budget:counter(request.workLimit??50000)};
}

function* choices(menu,count,start=0,current=[]){
  if(!count){yield current;return;}
  for(let i=start;i<=menu.length-count;i++){
    yield* choices(menu,count-1,i+1,[...current,menu[i]]);
  }
}

// A known-good full history allows spending the bad clock anywhere, including
// in the future. Incomplete historical omission searches are never pruned.
function possibleOmissions(check,observed,future){
  if(check.consistentWithoutReplacement||check.unchangedTraceStatus!=='falsified'){
    return [...observed.keys(),...future];
  }
  const status=new Map(check.omissions.map(v=>[v.ignoredTick,v.status]));
  return [...observed.keys()].filter(t=>status.get(t)!=='falsified');
}

function compareFuture(c,checks,future){
  const proof=[];
  for(let i=0;i<checks.length;i++)for(let j=i+1;j<checks.length;j++){
    const pair=[checks[i],checks[j]],images=pair.map(check=>c.images.find(v=>v.id===check.hypothesis));
    const [left,right]=pair.map(check=>possibleOmissions(check,c.observed,future));
    let smallest=null,assignments=0;
    for(const a of left)for(const b of right){
      const radius=sharedRadius(images,[a,b],c.observed,future,c.indices,c.gain,c.budget);
      if(radius===null)return {status:'inconclusive'};
      assignments++;
      if(sub(radius,c.epsilon).n<=0n)return {status:'overlap',hypotheses:images.map(v=>v.id),ignoredTicks:[a,b],radius:fmt(radius)};
      if(smallest===null||sub(radius,smallest).n<0n)smallest=radius;
    }
    if(!assignments)return {status:'inconclusive'};
    proof.push({hypotheses:images.map(v=>v.id),assignments,minimumCommonRadius:fmt(smallest)});
  }
  return {status:'separated',proof};
}

export function designConditionalFuture(request,rows,prior){
  const c=setup(request,rows);
  const last=Math.max(...c.observed.keys()),menu=c.ticks.filter(t=>t>last);
  const cost=t=>request.costByTick?.[t]??1;
  const result=(status,extra={})=>({schema:'worldlaw.active-linear-followup-plan/v1',status,
    historicalTicks:[...c.observed.keys()].sort((a,b)=>a-b),eligibleTicks:menu,
    survivingHypotheses:prior.consistentHypothesisIds,noiseBound:fmt(c.epsilon),
    nodes:c.budget.nodes,exhausted:c.budget.exhausted,...extra});
  if(prior.unresolvedHypothesisIds.length)return result('search_inconclusive',{reason:'historical_readout_inconclusive',historicalWorkExhausted:prior.exhausted});
  const live=prior.checks.filter(check=>check.status==='consistent');
  if(live.length<=1)return result(live.length?'already_resolved':'no_surviving_hypothesis');
  let lastOverlap=null;
  for(let size=1;size<=Math.min(menu.length,request.maxReadings??7);size++){
    const sets=[...choices(menu,size)].map(ticks=>({ticks,cost:ticks.reduce((sum,t)=>sum+cost(t),0)}));
    sets.sort((a,b)=>a.cost-b.cost); // Generation is already in numeric source order.
    for(const selection of sets){
      const check=compareFuture(c,live,selection.ticks);
      if(check.status==='inconclusive')return result('search_inconclusive');
      if(check.status==='separated')return result('certified_future_acquisitions',{selection,proof:check.proof});
      lastOverlap={ticks:selection.ticks,...check};
    }
  }
  return result('no_separating_future_schedule',{lastOverlap});
}

export function classifyAccumulatedReadings(request,rows){
  const c=setup(request,rows),checks=[];
  for(const image of c.images){
    const test=bad=>{
      const radius=sharedRadius([image],[bad],c.observed,[],c.indices,c.gain,c.budget);
      return radius===null?'inconclusive':sub(radius,c.epsilon).n<=0n?'consistent':'falsified';
    };
    const full=test(null);
    if(full==='consistent'){checks.push({hypothesis:image.id,status:full,consistentWithoutReplacement:true});continue;}
    const omissions=[];
    for(const ignoredTick of c.observed.keys()){
      const status=test(ignoredTick);omissions.push({ignoredTick,status});
      if(status==='inconclusive')break;
    }
    const compatible=omissions.some(v=>v.status==='consistent');
    const status=compatible?'consistent':c.budget.exhausted?'inconclusive':'falsified';
    checks.push({hypothesis:image.id,status,unchangedTraceStatus:full,omissions});
  }
  return {checks,consistentHypothesisIds:checks.filter(v=>v.status==='consistent').map(v=>v.hypothesis),
    unresolvedHypothesisIds:checks.filter(v=>v.status==='inconclusive').map(v=>v.hypothesis),
    nodes:c.budget.nodes,exhausted:c.budget.exhausted};
}
