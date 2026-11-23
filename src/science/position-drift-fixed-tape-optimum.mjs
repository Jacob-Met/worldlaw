/** Maximum sure-identification noise radius over every fixed tape in the grouped catalogue. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,mixRateRows} from './position-drift-rate-polytopes.mjs';
import {bindGroupedRateRoles} from './position-drift-reference-calibration.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const suffix=['y0','x0','z0','y1','x1','z1'];
const vertexPairs=[[0,0],[1,0],[1,1],[2,2],[3,2],[3,3]];
const sourceSchema='worldlaw.position-drift-fixed-tape-optimum/v1';
const proofSchema='worldlaw.position-drift-fixed-tape-optimum-proof/v1';
function requireTrue(ok,reason){if(!ok)throw Error('Fixed tape: '+reason);}

function prepare(input){
  requireTrue(input?.schema===sourceSchema&&Object.keys(input).sort().join(',')==='catalog,pulseBudget,schema','invalid source');
  const budget=rational(input.pulseBudget);
  requireTrue(budget.d===1n&&budget.n>=0n,'pulse budget must be a nonnegative integer');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:input.catalog,fourPulseControl:null});
  requireTrue(cat.commands.length===8,'the universal upper bound requires the eight registered commands');
  return {h:budget.n,cat,source:{schema:sourceSchema,pulseBudget:String(budget.n),catalog:canonical}};
}

function allocation(h){
  if(h<7n)return {k:0n,m:h,radius:Z(),optimalDwells:[]};
  const max=(h-1n)/6n;
  const clip=k=>k<1n?1n:(k>max?max:k);
  const candidates=[...new Set([clip(h/12n),clip(h/12n+1n)])];
  const value=k=>k*(h-6n*k);
  let best=0n,optimal=[];
  for(const k of candidates){
    const v=value(k);
    if(v>best){best=v;optimal=[k];}else if(v===best)optimal.push(k);
  }
  const k=optimal[0];
  return {k,m:h-6n*k,radius:Q(best,4n*h),optimalDwells:optimal.map(String)};
}

function coordinates(cat,role,masses){
  const weights=cat.vertices[role.family].map(Z);
  role.indices.forEach((idx,i)=>{weights[idx]=Q(BigInt(masses[i]),6n);});
  return {law:cat.ids[role.family],weights:weights.map(fmt),rates:mixRateRows(cat.vertices[role.family],weights)};
}

export function certifyFixedTapeOptimum(input){
  const {h,cat,source}=prepare(input),work=rateWorkBudget(source.catalog.limits.designWork);
  try{
    const roles=bindGroupedRateRoles(cat,work.spend);
    requireTrue(roles[0].family!==roles[1].family,'two different physical families are required');
    const {m,k,radius,optimalDwells}=allocation(h);
    const pairs=vertexPairs.map(([i,j],index)=>{
      const a=roles[0].indices[i],b=roles[1].indices[j];
      const x=cat.vertices[roles[0].family][a],y=cat.vertices[roles[1].family][b];
      work.spend();
      requireTrue(cat.commands.every((c,q)=>compare(sub(x[q],y[q]),Q(c===suffix[index]?1n:0n))===0),'a single-coordinate pair differs');
      return {command:suffix[index],a,b};
    });
    const a=coordinates(cat,roles[0],[1,2,1,2]),b=coordinates(cat,roles[1],[2,1,2,1]);
    requireTrue(cat.commands.every((c,i)=>compare(sub(a.rates[i],b.rates[i]),suffix.includes(c)?Q(1n,6n):Z())===0),'the fixed mixtures differ');
    const runs=m?[{command:'ref',repeats:String(m)}]:[];
    if(k)runs.push(...suffix.map(command=>({command,repeats:String(k)})));
    const worlds=[{law:a.law,weights:a.weights,origin:fmt(radius),drift:fmt(k?Q(-k,h):Z())},
      {law:b.law,weights:b.weights,origin:fmt(neg(radius)),drift:'0'}];
    return {schema:proofSchema,source,status:'fixed-optimum-certified',radius:fmt(radius),
      atRequestedNoise:compare(cat.error,radius)<0?'policy-separates':'closed-collision',
      references:String(m),dwell:String(k),optimalDwells,runs,readAt:(k?[0n,m,h]:(h?[0n,h]:[0n])).map(String),
      roles:[a.law,b.law],singleCoordinatePairs:pairs,boundaryWorlds:worlds,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {schema:proofSchema,source,status:'design-budget-exhausted',work:work.used};
  }
}

export function verifyFixedTapeOptimum(input,saved){
  requireTrue(equalPositionDriftData(certifyFixedTapeOptimum(input),saved),'saved optimum or physical evidence differs');
  return true;
}

export function receiveFixedTapeOptimum(input,saved,values){
  verifyFixedTapeOptimum(input,saved);
  requireTrue(saved.status==='fixed-optimum-certified','certification exhausted its work limit');
  requireTrue(Array.isArray(values)&&values.length>0&&values.length<=saved.readAt.length,'supply consecutive declared checkpoints');
  const {h,cat}=prepare(input),ys=values.map(rational);
  const m=BigInt(saved.references),k=BigInt(saved.dwell),work=rateWorkBudget(saved.source.catalog.limits.receiverWork);
  const result={status:'received',readings:ys.map(fmt),ticks:saved.readAt.slice(0,ys.length),
    surviving:saved.roles.slice(),score:null,nextAt:saved.readAt[ys.length]??null,
    nextRuns:ys.length===1?saved.runs.slice(0,1):ys.length===2?saved.runs.slice(1):[]};
  try{
    work.spend();
    if(ys.length===3){
      const score=add(sub(mul(Q(m),ys[2]),mul(Q(h),ys[1])),mul(Q(6n*k),ys[0]));
      const width=mul(Q(2n*h),cat.error);
      result.score=fmt(score);
      result.surviving=saved.roles.filter((_,i)=>{
        const delta=sub(score,i?Z():Q(m*k));
        return compare(delta,neg(width))>=0&&compare(delta,width)<=0;
      });
    }
    return {...result,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {status:'receiver-budget-exhausted',surviving:null,nextAt:null,nextRuns:null,work:work.used};
  }
}

const largeMinimumSource='worldlaw.position-drift-large-noise-minimum/v1';
const largeMinimumProof='worldlaw.position-drift-large-noise-minimum-proof/v1';

export function certifyLargeNoiseMinimum(input){
  requireTrue(input?.schema===largeMinimumSource&&Object.keys(input).sort().join(',')==='catalog,schema','invalid minimum-horizon source');
  const error=rational(input.catalog.noiseBound);
  requireTrue(compare(error,Q(11n,16n))>=0,'this minimum-horizon theorem requires noise at least 11/16');
  requireTrue(input.catalog.laws.length===2&&input.catalog.laws.every(l=>l.vertices.length===4),'the minimum requires the registered two four-vertex families');
  const floor=8n*error.n/error.d;
  const ceil=(8n*error.n+error.d-1n)/error.d;
  const candidates=[...new Set([floor,ceil])].filter(k=>k*error.d>4n*error.n).map(k=>{
    const denominator=k*error.d-4n*error.n;
    const numerator=6n*k*k*error.d;
    return {dwell:String(k),firstStrictHorizon:String(numerator/denominator+1n)};
  });
  const h=candidates.map(c=>BigInt(c.firstStrictHorizon)).reduce((a,b)=>a<b?a:b);
  const course=certifyFixedTapeOptimum({schema:sourceSchema,pulseBudget:String(h),catalog:input.catalog});
  const source={schema:largeMinimumSource,catalog:course.source.catalog};
  if(course.status==='design-budget-exhausted')return {schema:largeMinimumProof,source,status:course.status,work:course.work};
  const predecessor=h-1n,upper=predecessor===66n?Q(11n,16n):allocation(predecessor).radius;
  requireTrue(h>=67n&&compare(upper,error)<=0&&course.atRequestedNoise==='policy-separates','the two adjacent horizons do not bracket the requested noise');
  return {schema:largeMinimumProof,source,status:'adaptive-minimum-certified',minimum:String(h),candidates,course,
    predecessor:{source:{...course.source,pulseBudget:String(predecessor)},upper:fmt(upper),
      method:predecessor===66n?'balanced-midpoint':'all-large-horizon-transfer'}};
}

export function verifyLargeNoiseMinimum(input,saved){
  requireTrue(equalPositionDriftData(certifyLargeNoiseMinimum(input),saved),'saved minimum, predecessor, or measured course differs');
  return true;
}

export function receiveLargeNoiseMinimum(input,saved,values){
  verifyLargeNoiseMinimum(input,saved);
  requireTrue(saved.status==='adaptive-minimum-certified','minimum design exhausted its work limit');
  return receiveFixedTapeOptimum(saved.course.source,saved.course,values);
}
