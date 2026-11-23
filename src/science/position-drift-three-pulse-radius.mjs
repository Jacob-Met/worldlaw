/** Exact closed noise threshold of every two-command prefix in a three-pulse experiment. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare,minimum,maximum,midpoint} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {planarPointHull} from './position-drift-planar-suffix.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,mixRateRows} from './position-drift-rate-polytopes.mjs';
import {prepareThreePulseHullRequest,physicalThreePulseCollision} from './position-drift-three-pulse-hulls.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n);
const generators=[[1,2],[-2,-3],[1,0],[0,1]].map(row=>row.map(x=>Q(BigInt(x))));
const absolute=x=>x.n<0n?neg(x):x;
const dot=(u,v)=>add(mul(u[0],v[0]),mul(u[1],v[1]));
const need=(ok,msg)=>{if(!ok)throw Error('Three-pulse noise certificate: '+msg);};
export const THREE_PULSE_RADIUS='worldlaw.position-drift-three-pulse-noise-certificate/v1';

function cleanImage(vertices,p,a,b,spend){
  return vertices.map(row=>{
    spend();const s=sub(row[a],row[p]);return [s,add(s,sub(row[b],row[p]))];
  });
}
function support(points,normal,spend){
  const h=points.map(v=>{spend();return dot(normal,v);}).reduce(maximum);
  const r=generators.map(g=>absolute(dot(normal,g))).reduce(add,Z());
  return [h,r];
}
function familyFacets(cat,p,a,b,law,spend){
  const hull=planarPointHull(cleanImage(cat.vertices[law],p,a,b,spend),spend);
  const edges=generators.slice();
  if(hull.length>1)for(let i=0;i<hull.length;i++){
    const next=hull[(i+1)%hull.length];edges.push(next.map((v,j)=>sub(v,hull[i][j])));
  }
  const normals=new Map();
  for(const edge of edges)for(const sign of [one,neg(one)]){
    const n=[mul(sign,edge[1]),neg(mul(sign,edge[0]))],scale=absolute(n.find(x=>x.n));
    const unit=n.map(x=>div(x,scale));normals.set(unit.map(fmt).join(','),unit);
  }
  return [...normals.values()].map(normal=>{
    const [h,r]=support(hull,normal,spend),atom={command:cat.commands[b],law:cat.ids[law],normal:normal.map(fmt)};
    return {c:normal,h,r,terms:[{atom,weight:one}]};
  });
}

// Each row says c·(s,w) <= h + r*epsilon. Scan every positive/negative
// pair; the exact nonnegative coefficients also recover the supporting proof.
function project(rows,axis,spend,emit){
  const positive=[],negative=[];
  for(const row of rows){
    spend();const weight=row.c[axis],c=row.c.filter((_,j)=>j!==axis);
    if(!weight.n){emit({...row,c});continue;}
    const divisor=absolute(weight);
    const normalized={c:c.map(x=>div(x,divisor)),h:div(row.h,divisor),r:div(row.r,divisor),
      terms:row.terms.map(t=>({atom:t.atom,weight:div(t.weight,divisor)}))};
    (weight.n>0n?positive:negative).push(normalized);
  }
  for(const lo of negative)for(const hi of positive){
    spend();emit({c:lo.c.map((x,j)=>add(x,hi.c[j])),h:add(lo.h,hi.h),r:add(lo.r,hi.r),terms:[...lo.terms,...hi.terms]});
  }
}

function prefixRadius(cat,p,a,spend){
  const facets=[],prefixRows=new Map();
  function retain(row){
    // Equal normalized slopes share one noise-dependent bound; the smaller
    // intercept is always the tighter one, including at epsilon=0.
    const magnitude=absolute(row.c[0]),scale=magnitude.n?magnitude:one;
    const normalized={c:[div(row.c[0],scale)],h:div(row.h,scale),r:div(row.r,scale),
      terms:row.terms.map(t=>({atom:t.atom,weight:div(t.weight,scale)}))};
    const key=[normalized.c[0],normalized.r].map(fmt).join(','),old=prefixRows.get(key);
    if(!old||compare(normalized.h,old.h)<0)prefixRows.set(key,normalized);
  }
  for(let b=0;b<cat.commands.length;b++){
    const branch=cat.ids.flatMap((_,law)=>familyFacets(cat,p,a,b,law,spend));facets.push(branch);
    project(branch,1,spend,retain);
  }
  let radius=Z(),lower=[];
  const rows=[...prefixRows.values()];
  project(rows,0,spend,row=>{
    if(!row.r.n){need(row.h.n>=0n,'unbounded failure threshold');return;}
    need(row.r.n>0n,'negative noise support');const bound=div(neg(row.h),row.r);
    if(compare(bound,radius)>0){radius=bound;lower=row.terms.map(t=>({...t.atom,weight:fmt(t.weight)}));}
  });
  function section(rows,axis,offset){
    let lo=null,hi=null;
    for(const row of rows){
      spend();const d=row.c[axis],rhs=sub(add(row.h,mul(radius,row.r)),offset(row));
      if(!d.n){need(rhs.n>=0n,'boundary misses a constant facet');continue;}
      const edge=div(rhs,d);
      if(d.n<0n)lo=lo===null?edge:maximum(lo,edge);
      else hi=hi===null?edge:minimum(hi,edge);
    }
    need(lo&&hi&&compare(lo,hi)<=0,'missing closed physical section');return midpoint(lo,hi);
  }
  const s=section(rows,0,()=>Z()),prefix=[cat.commands[p],cat.commands[a]],ys=[Z(),Z(),s];
  const boundaryCat={...cat,error:radius};
  const branches=facets.map((branch,b)=>{
    const w=section(branch,1,row=>mul(row.c[0],s)),command=cat.commands[b];
    const worlds=physicalThreePulseCollision(boundaryCat,[...prefix,command],[...ys,w],spend);
    return {command,reading:fmt(w),worlds};
  });
  return {prefix,radius:fmt(radius),lower,boundary:{prefixReadings:ys.map(fmt),branches}};
}

export function certifyThreePulseNoiseRadius(request){
  const {cat,canonical,control}=prepareThreePulseHullRequest(request),work=rateWorkBudget(canonical.limits.designWork);
  const base={schema:THREE_PULSE_RADIUS,source:canonical,fourPulseControl:control?.slice()??null};
  try{
    const trials=[];let best=null;
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const trial=prefixRadius(cat,p,a,work.spend);trials.push(trial);
      if(!best||compare(rational(trial.radius),rational(best.radius))>0)best=trial;
    }
    return {...base,status:'radius-certified',radius:best.radius,bestPrefix:best.prefix.slice(),trials,work:work.used,
      atRequestedNoise:compare(cat.error,rational(best.radius))<0?'separates-within-three':'common-history-refutation'};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}

function verifyBound(cat,p,a,radius,proof,spend){
  need(Array.isArray(proof)&&proof.length<=4,'invalid number of supporting inequalities');
  if(!radius.n){need(proof.length===0,'zero radius uses the nonnegative noise domain');return;}
  let shared=Z(),clean=Z(),noise=Z();const privateFinal=cat.commands.map(Z);
  for(const term of proof){
    const b=cat.commands.indexOf(term.command),law=cat.ids.indexOf(term.law);
    need(b>=0&&law>=0&&Array.isArray(term.normal)&&term.normal.length===2,'invalid support reference');
    const n=term.normal.map(rational),weight=rational(term.weight);need(weight.n>0n&&n.some(x=>x.n),'invalid weighted normal');
    const points=cleanImage(cat.vertices[law],p,a,b,spend),[h,r]=support(points,n,spend);
    shared=add(shared,mul(weight,n[0]));privateFinal[b]=add(privateFinal[b],mul(weight,n[1]));
    clean=add(clean,mul(weight,h));noise=add(noise,mul(weight,r));
  }
  need(!shared.n&&privateFinal.every(x=>!x.n)&&noise.n>0n&&!add(clean,mul(radius,noise)).n,
    'weighted source inequalities do not prove this radius');
}

export function verifyRateHullCollision(cat,commands,readings,radius,worlds,spend){
  need(worlds.length===cat.ids.length,'missing physical worlds');
  worlds.forEach((world,law)=>{
    const weights=world.weights.map(rational);
    need(world.law===cat.ids[law]&&weights.length===cat.vertices[law].length&&weights.every(w=>w.n>=0n)&&
      !sub(weights.reduce(add,Z()),one).n&&world.start.length===2&&world.positions.length===readings.length,'invalid physical state');
    const [start,drift]=world.start.map(rational),rates=mixRateRows(cat.vertices[law],weights),positions=[start];
    for(const command of commands)positions.push(add(positions.at(-1),add(drift,rates[cat.commands.indexOf(command)])));
    for(let t=0;t<positions.length;t++){
      spend();need(!sub(positions[t],rational(world.positions[t])).n&&compare(absolute(sub(positions[t],readings[t])),radius)<=0,
        'boundary states do not reproduce the common readings');
    }
  });
}

function verifyHistory(cat,prefix,radius,boundary,spend){
  const ys=boundary.prefixReadings.map(rational);
  need(ys.length===3&&!ys[0].n&&!ys[1].n&&boundary.branches.length===cat.commands.length,'invalid common prefix');
  boundary.branches.forEach((branch,b)=>{
    const commands=[...prefix,cat.commands[b]],readings=[...ys,rational(branch.reading)];
    need(branch.command===cat.commands[b]&&branch.worlds.length===cat.ids.length,'missing counterfactual branch');
    verifyRateHullCollision(cat,commands,readings,radius,branch.worlds,spend);
  });
}

/** Check bounds and raw physical worlds directly, without rerunning projection. */
export function verifyThreePulseNoiseRadius(request,saved){
  const {cat,canonical,control}=prepareThreePulseHullRequest(request),work=rateWorkBudget(canonical.limits.designWork);
  need(saved?.schema===THREE_PULSE_RADIUS&&equalPositionDriftData(saved.source,canonical)&&
    equalPositionDriftData(saved.fourPulseControl,control),'certificate source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(certifyThreePulseNoiseRadius(request),saved),'unreproducible exhaustion');return true;
  }
  need(saved.status==='radius-certified'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=canonical.limits.designWork&&
    Array.isArray(saved.trials)&&saved.trials.length===cat.commands.length**2,
    'incomplete set of ordered prefixes');
  try{
    let best=null,index=0;
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const trial=saved.trials[index++],prefix=[cat.commands[p],cat.commands[a]],radius=rational(trial.radius);
      need(radius.n>=0n&&equalPositionDriftData(trial.prefix,prefix),'invalid ordered prefix or radius');
      verifyBound(cat,p,a,radius,trial.lower,work.spend);verifyHistory(cat,prefix,radius,trial.boundary,work.spend);
      if(!best||compare(radius,rational(best.radius))>0)best=trial;
    }
    need(saved.radius===best.radius&&equalPositionDriftData(saved.bestPrefix,best.prefix)&&
      saved.atRequestedNoise===(compare(cat.error,rational(best.radius))<0?'separates-within-three':'common-history-refutation'),
      'global threshold or requested-noise verdict differs');
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Three-pulse noise certificate verification exceeded the source work budget');}
  return true;
}
