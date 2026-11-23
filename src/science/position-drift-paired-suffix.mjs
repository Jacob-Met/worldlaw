/** Measured choice between two suffixes after probing both x commands. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {bindGroupedRateRoles} from './position-drift-reference-calibration.mjs';
import {mixRateRows,receiveChosenRateRuns,rateWorkBudget,RATE_WORK_EXHAUSTED} from './position-drift-rate-polytopes.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const branches=[['y0','y1'],['z1','z0']];
const probe=['x1','x0'];
const schema='worldlaw.position-drift-paired-suffix/v1';
function requireTrue(ok,why){if(!ok)throw Error('Paired suffix: '+why);}

function prepare(input){
  requireTrue(input?.schema===schema&&Object.keys(input).sort().join(',')==='catalog,references,schema',
    'supply the catalog and reference count');
  const count=rational(input.references);
  requireTrue(count.d===1n&&count.n>0n,'the reference count must be a positive integer');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:input.catalog,fourPulseControl:null});
  return {cat,m:count.n,source:{schema,references:String(count.n),catalog:canonical}};
}

function runList(m,tail=[]){
  return [{command:'ref',repeats:String(m)},...[...probe,...tail].map(command=>({command,repeats:'1'}))];
}

export function certifyPairedSuffix(input){
  const {cat,m,source}=prepare(input),work=rateWorkBudget(source.catalog.limits.designWork);
  try{
    const roles=bindGroupedRateRoles(cat,work.spend);
    requireTrue(roles[0].family!==roles[1].family,'physical roles must be distinct');
    for(const [i,{family}] of roles.entries()){
      for(const vertex of cat.vertices[family]){
        work.spend();
        const rate=c=>vertex[cat.commands.indexOf(c)];
        const total=commands=>commands.reduce((a,c)=>add(a,rate(c)),Z());
        const x=total(probe),y=total(branches[0]),z=total(branches[1]);
        requireTrue(rate('ref').n===0n&&(i===0?compare(add(x,y),Q(1n))===0&&z.n===0n:
          y.n===0n&&add(x,z).n===0n),'a vertex violates a paired-suffix rate identity');
      }
    }
    const radius=Q(m,8n*(m+3n)),gA=Q(m+4n,2n*(m+3n)),gB=Q(m+2n,2n*(m+3n));
    const worlds=roles.map(({family,indices},law)=>{
      const canonical=law?[gA,gB,gA,gB]:[gB,gA,gB,gA];
      const weights=cat.vertices[family].map(Z);
      indices.forEach((vertex,j)=>{weights[vertex]=div(canonical[j],Q(2n));});
      return {law:cat.ids[family],weights:weights.map(fmt),origin:fmt(law?neg(radius):radius),
        drift:fmt(Q(law?2n:-2n,8n*(m+3n)))};
    });
    const midpoint=tail=>{
      const clean=worlds.map((world,l)=>{
        const rates=mixRateRows(cat.vertices[roles[l].family],world.weights.map(rational));
        const ys=[rational(world.origin)];
        for(const run of runList(m,tail)){
          work.spend();
          ys.push(add(ys.at(-1),mul(rational(run.repeats),add(rational(world.drift),rates[cat.commands.indexOf(run.command)]))));
        }
        return ys;
      });
      return clean[0].map((a,i)=>{
        const b=clean[1][i],delta=sub(a,b);
        requireTrue(compare(delta,neg(mul(Q(2n),radius)))>=0&&compare(delta,mul(Q(2n),radius))<=0,
          'physical boundary worlds disagree');
        return fmt(div(add(a,b),Q(2n)));
      });
    };
    const readings=branches.map(midpoint);
    requireTrue(equalPositionDriftData(readings[0].slice(0,4),readings[1].slice(0,4)),
      'boundary worlds need different past readings');
    return {schema:'worldlaw.position-drift-paired-suffix-proof/v1',source,status:'paired-suffix-certified',
      horizon:String(m+4n),readAt:[0n,m,m+1n,m+2n,m+3n,m+4n].map(String),radius:fmt(radius),
      atRequestedNoise:compare(cat.error,radius)<0?'policy-separates':'closed-collision',
      boundary:{worlds,reference:{origin:'0',perTick:'0',through:String(m)},branches:branches.map((commands,i)=>({commands,readings:readings[i]}))},work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {schema:'worldlaw.position-drift-paired-suffix-proof/v1',source,status:'design-budget-exhausted',work:work.used};
  }
}

export function verifyPairedSuffix(input,saved){
  requireTrue(equalPositionDriftData(certifyPairedSuffix(input),saved),'saved plan or physical witnesses differ');
  return true;
}

export function receivePairedSuffix(input,saved,values){
  verifyPairedSuffix(input,saved);
  requireTrue(saved.status==='paired-suffix-certified'&&saved.atRequestedNoise==='policy-separates',
    'the strict policy requires noise below its first collision');
  requireTrue(Array.isArray(values)&&values.length>=1&&values.length<=6,'supply consecutive declared checkpoint readings');
  const {cat,m,source}=prepare(input),ys=values.map(rational),work=rateWorkBudget(source.catalog.limits.receiverWork);
  const cutoff=Q(m,2n);
  const score=ys.length>=4?add(sub(mul(Q(2n),ys[0]),mul(Q(m+2n),ys[1])),mul(Q(m),ys[3])):null;
  const tail=score===null?[]:branches[compare(score,cutoff)<0?0:1];
  const program=runList(m,tail),taken=program.slice(0,ys.length-1);
  try{
    const surviving=receiveChosenRateRuns(cat,taken,ys,work.spend);
    requireTrue(ys.length<6||surviving.length<=1,'two families survived the strict policy');
    return {status:'received',ticks:saved.readAt.slice(0,ys.length),readings:ys.map(fmt),runs:taken,surviving,
      score:score===null?null:fmt(score),cutoff:fmt(cutoff),nextRun:surviving.length?program[ys.length-1]??null:null,
      nextTick:surviving.length?saved.readAt[ys.length]??null:null,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {status:'receiver-budget-exhausted',surviving:null,nextRun:null,nextTick:null,work:work.used};
  }
}
