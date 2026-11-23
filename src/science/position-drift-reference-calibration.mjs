/** Exact repeated-reference calibration for the grouped two-family rate experiment. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {mixRateRows,receiveChosenRateRuns,rateWorkBudget,RATE_WORK_EXHAUSTED} from './position-drift-rate-polytopes.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),two=Q(2n);
const sourceSchema='worldlaw.position-drift-reference-calibration/v1';
const proofSchema='worldlaw.position-drift-reference-calibration-proof/v1';
const actions=['ref','group','x0','y0','z0','x1','y1','z1'];
const tails=[['y0','x0','z0'],['z1','x1','y1']];
const anchors=[
  [[0,0,0,1,0,0,0,0],[0,0,1,0,0,0,0,0],[0,1,0,0,0,0,1,0],[0,1,0,0,0,1,0,0]],
  [[0,0,0,0,0,0,0,0],[0,0,1,0,-1,0,0,0],[0,1,0,0,0,0,0,0],[0,1,0,0,0,1,0,-1]],
];
const sum=xs=>xs.reduce(add,Z());
function need(ok,message){if(!ok)throw Error('Reference calibration: '+message);}

function prepare(input){
  need(input?.schema===sourceSchema&&Object.keys(input).sort().join(',')==='catalog,references,schema',
    'supply the reference count and source catalog');
  const count=rational(input.references);
  need(count.d===1n&&count.n>=2n,'the reference count must be an integer of at least two');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:input.catalog,fourPulseControl:null});
  return {m:count.n,cat,source:{schema:sourceSchema,references:String(count.n),catalog:canonical}};
}

// The lower conditions hold at every supplied vertex, hence throughout each hull.
// The upper construction needs four named rate projections in each of those hulls.
function bindRoles(cat,spend){
  const ids=actions.map(c=>cat.commands.indexOf(c));
  need(ids.every(i=>i>=0),'catalog omits a calibration command');
  const projected=cat.vertices.map(vertices=>vertices.map(vertex=>{spend();return ids.map(i=>vertex[i]);}));
  const keys=projected.map(vs=>new Map(vs.map((v,i)=>[v.map(fmt).join(','),i])));
  return anchors.map((template,role)=>{
    const family=keys.findIndex(map=>template.every(row=>map.has(row.join(','))));
    need(family>=0,'a required boundary vertex is missing');
    for(const row of projected[family]){
      spend();
      const [ref,g,x0,y0,z0,x1,y1,z1]=row,l=sum([y0,x0,z0]),r=sum([z1,x1,y1]);
      need(!ref.n&&(role===0?compare(add(g,l),one)===0&&compare(r,g)===0:!l.n&&!r.n),
        'a source vertex violates a terminal rate identity');
    }
    return {family,indices:template.map(row=>keys[family].get(row.join(',')))};
  });
}

function ticksFor(m){return [0n,m,m+1n,m+2n,m+3n,m+4n].map(String);}
function runsFor(m,tail){return [{command:'ref',repeats:String(m)},...['group',...tail].map(command=>({command,repeats:'1'}))];}

function trajectory(cat,world,runs,spend){
  const i=cat.ids.indexOf(world.law),weights=world.weights.map(rational);
  need(i>=0&&weights.length===cat.vertices[i].length&&weights.every(w=>w.n>=0n)&&compare(sum(weights),one)===0,
    'invalid constant physical mixture');
  const rates=mixRateRows(cat.vertices[i],weights),v=rational(world.drift),ys=[rational(world.origin)];
  for(const run of runs){
    spend();
    ys.push(add(ys.at(-1),mul(rational(run.repeats),add(v,rates[cat.commands.indexOf(run.command)]))));
  }
  return ys;
}

function boundaryWorlds(cat,roles,m,spend){
  const d=10n*(m+2n),q=k=>Q(k,d),radius=q(m);
  const shared=[Z(),q(-2n*m),q(4n*m+4n)];
  const masses=[
    [[0n,2n*m+12n,0n,8n*m+8n],[4n*m+12n,4n,0n,6n*m+4n]],
    [[6n*m+14n,0n,4n*m+2n,4n],[4n*m+16n,0n,6n*m+2n,2n]],
  ];
  const branches=tails.map((commands,b)=>{
    const worlds=roles.map(({family,indices},l)=>{
      const weights=cat.vertices[family].map(Z);
      indices.forEach((j,k)=>{weights[j]=q(masses[b][l][k]);});
      return {law:cat.ids[family],weights:weights.map(fmt),origin:fmt(l?neg(radius):radius),
        drift:fmt(l?Z():q(b?-2n:-4n))};
    });
    const clean=worlds.map(w=>trajectory(cat,w,runsFor(m,commands),spend));
    const after=clean[0].slice(3).map((x,k)=>div(add(x,clean[1][k+3]),two));
    const readings=[...shared,...after];
    for(const path of clean)path.forEach((x,t)=>{
      const error=sub(readings[t],x);
      need(compare(error,neg(radius))>=0&&compare(error,radius)<=0,'boundary left an original position tube');
    });
    return {commands:commands.slice(),after:after.map(fmt),worlds};
  });
  const step=q(-2n);
  need(compare(add(shared[0],mul(Q(m),step)),shared[1])===0,'reference line misses its endpoint');
  return {reference:{origin:fmt(shared[0]),perTick:fmt(step),through:String(m)},shared:shared.map(fmt),branches};
}

function leastReferences(error){
  const room=sub(one,mul(Q(10n),error));
  if(room.n<=0n)return null;
  const bound=div(mul(Q(20n),error),room),n=bound.n/bound.d+1n;
  return n<2n?2n:n;
}

export function certifyReferenceCalibration(input){
  const {cat,m,source}=prepare(input),work=rateWorkBudget(source.catalog.limits.designWork);
  try{
    const roles=bindRoles(cat,work.spend);
    need(roles[0].family!==roles[1].family,'the two physical roles must use different families');
    const radius=Q(m,10n*(m+2n)),least=leastReferences(cat.error);
    const boundary=boundaryWorlds(cat,roles,m,work.spend);
    return {schema:proofSchema,source,status:'calibration-certified',horizon:String(m+4n),readAt:ticksFor(m),
      radius:fmt(radius),atRequestedNoise:compare(cat.error,radius)<0?'policy-separates':'closed-collision',
      leastReferencesAtNoise:least===null?null:String(least),familyCeiling:'1/10',boundary,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {schema:proofSchema,source,status:'design-budget-exhausted',work:work.used};
  }
}

export function verifyReferenceCalibration(input,saved){
  need(equalPositionDriftData(certifyReferenceCalibration(input),saved),'saved plan or boundary worlds differ');
  return true;
}

export function receiveReferenceCalibration(input,saved,values){
  verifyReferenceCalibration(input,saved);
  need(saved.status==='calibration-certified'&&saved.atRequestedNoise==='policy-separates',
    'this reference count has no guaranteed separation at the requested noise');
  need(Array.isArray(values)&&values.length>=1&&values.length<=6,'supply consecutive declared checkpoints');
  const {cat,m,source}=prepare(input),ys=values.map(rational),work=rateWorkBudget(source.catalog.limits.receiverWork);
  let score=null,cutoff=null,tail=[];
  if(ys.length>=3){
    score=add(sub(ys[0],mul(Q(m+1n),ys[1])),mul(Q(m),ys[2]));
    cutoff=add(Q(m,2n),mul(Q(m-4n),cat.error));
    tail=tails[compare(score,cutoff)<0?0:1];
  }
  const program=runsFor(m,tail),taken=program.slice(0,ys.length-1);
  try{
    const surviving=receiveChosenRateRuns(cat,taken,ys,work.spend);
    need(ys.length<6||surviving.length<=1,'two families survived the strict calibration rule');
    return {status:'received',ticks:saved.readAt.slice(0,ys.length),readings:ys.map(fmt),runs:taken,surviving,
      score:score===null?null:fmt(score),cutoff:cutoff===null?null:fmt(cutoff),
      nextRun:surviving.length?program[ys.length-1]??null:null,
      nextTick:surviving.length?saved.readAt[ys.length]??null:null,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {status:'receiver-budget-exhausted',surviving:null,nextRun:null,nextTick:null,work:work.used};
  }
}
