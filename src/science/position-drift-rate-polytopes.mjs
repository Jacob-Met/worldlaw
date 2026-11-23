/** Exact uniform identification for persistent convex mixtures of rate rows. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {CATALOG_SCHEMA,parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {feedbackGCD,feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';
import {openRateAlias,weightedRateBlocks,equalRateSchedule} from './position-drift-rate-segments.mjs';
const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),neg=x=>sub(Z(),x);
const sum=xs=>xs.reduce(add,Z()),dot=(a,b)=>sum(a.map((x,i)=>mul(x,b[i])));
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
function need(ok,reason){if(!ok)throw Error('Persistent rate polytopes: '+reason);}
export const POLYTOPE_SOURCE='worldlaw.position-drift-rate-polytopes/v1';
export const POLYTOPE_PLAN='worldlaw.position-drift-rate-polytope-policy/v1';

function parse(source){
  need(source?.schema===POLYTOPE_SOURCE&&Object.keys(source).sort().join(',')==='commands,laws,limits,noiseBound,schema'&&
    Array.isArray(source.laws)&&source.laws.every(l=>l&&Object.keys(l).sort().join(',')==='id,vertices'&&
      Array.isArray(l.vertices)&&l.vertices.length&&l.vertices.every(r=>Array.isArray(r)&&r.length===source.commands?.length)),
    'supply a nonempty ordered list of exact rate rows per family');
  need(source.limits&&Object.keys(source.limits).sort().join(',')==='designWork,receiverWork'&&
    Object.values(source.limits).every(n=>Number.isSafeInteger(n)&&n>=0),'supply nonnegative design and receiving work limits');
  const names=parsePositionDriftRates({schema:CATALOG_SCHEMA,commands:source.commands,noiseBound:source.noiseBound,
    laws:source.laws.map(l=>({id:l.id,rates:l.vertices[0]}))},rational);
  return {...names,vertices:source.laws.map(l=>l.vertices.map(row=>row.map(rational)))};
}

const exhausted=Symbol('proof budget exhausted');
function budget(limit){
  let used=0;
  return {spend(){if(used>=limit)throw exhausted;used++;},get used(){return used;}};
}

// multiplier takes the original rational inequality to the returned primitive normal.
function exactRow(coefficients,rhs){
  const denominator=coefficients.reduce((l,x)=>l/feedbackGCD(l,x.d)*x.d,1n);
  const row=feedbackPrimitive(coefficients.map(x=>x.n*(denominator/x.d)),mul(Q(denominator),rhs));
  return {...row,multiplier:Q(denominator,row.scale)};
}
function mixture(vertices,weights){return vertices[0].map((_,k)=>sum(vertices.map((row,i)=>mul(row[k],weights[i]))));}
function compareFamilies(left,right,spend){
  const gauge=row=>row.slice(1).map(x=>sub(x,row[0]));
  const L=left.map(gauge),R=right.map(gauge),width=L[0].length;
  // w·(L_i−R_j) ≥ 1 at all vertex pairs is equivalent to strict separation.
  const rows=L.flatMap(a=>R.map(b=>{spend();return exactRow(a.map((x,k)=>sub(b[k],x)),Q(-1n));}));
  const solved=intersectFeedbackHalfspaces(rows,width,spend);
  if(solved.proof){
    need(checkFeedbackContradiction(rows,width,solved.proof),'invalid infeasibility certificate');
    const leftWeights=left.map(Z),rightWeights=right.map(Z);
    for(const [index,weight] of solved.proof){
      const mass=mul(Q(weight),rows[index].multiplier);
      const i=Math.floor(index/right.length),j=index%right.length;
      leftWeights[i]=add(leftWeights[i],mass);rightWeights[j]=add(rightWeights[j],mass);
    }
    const total=sum(leftWeights);
    const parameters=[leftWeights,rightWeights].map(xs=>xs.map(x=>div(x,total)));
    const a=mixture(left,parameters[0]),b=mixture(right,parameters[1]),driftShift=sub(a[0],b[0]);
    need(a.every((v,k)=>cmp(sub(v,b[k]),driftShift)===0),'alias mixture failed raw increment replay');
    return {parameters:parameters.map(xs=>xs.map(fmt)),driftShift:fmt(driftShift)};
  }
  const weights=[neg(sum(solved.point)),...solved.point];
  const bands=[left,right].map(vs=>{
    const values=vs.map(row=>dot(weights,row)).sort(cmp);return [values[0],values.at(-1)];
  });
  const gap=sub(bands[0][0],bands[1][1]);need(cmp(gap,one)>=0,'vertex separator missed its unit margin');
  return {weights,bands};
}

export function planRatePolytopes(source){
  const cat=parse(source),aliases=[],certificates=[],work=budget(source.limits.designWork);
  const canonical={schema:POLYTOPE_SOURCE,commands:cat.commands.slice(),noiseBound:fmt(cat.error),limits:{...source.limits},
    laws:cat.ids.map((id,i)=>({id,vertices:cat.vertices[i].map(row=>row.map(fmt))}))};
  const base={schema:POLYTOPE_PLAN,source:canonical};
  let n=1n;
  try{
    for(let j=1;j<cat.ids.length;j++)for(let i=0;i<j;i++){
      const laws=[cat.ids[i],cat.ids[j]],p=compareFamilies(cat.vertices[i],cat.vertices[j],work.spend);
      if(p.parameters){aliases.push({laws,...p});continue;}
      const block=weightedRateBlocks(p.weights,p.bands,cat.error);
      if(block.repetitions>n)n=block.repetitions;
      certificates.push({laws,...block.certificate});
    }
  }catch(e){if(e!==exhausted)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
  const common={...base,work:work.used,aliases,certificates};
  if(aliases.length)return {...common,status:'indistinguishable'};
  return {...common,...equalRateSchedule(cat.commands,n)};
}

function receiveFamily(vertices,ys,ticks,runs,error,spend){
  // Eliminate the last weight by sum(weights)=1. The two final coordinates
  // represent the same initial position and drift in every observation strip.
  const count=vertices.length-1,width=count+2,rows=[];
  const append=(a,b)=>{spend();rows.push(exactRow(a,b));};
  for(let k=0;k<count;k++){const a=Array.from({length:width},Z);a[k]=neg(one);append(a,Z());}
  if(count)append([...Array(count).fill(one),Z(),Z()],one);
  const forcing=vertices.map(Z);
  for(let i=0;i<ys.length;i++){
    if(i){const {command,repeats}=runs[i-1];vertices.forEach((v,j)=>{forcing[j]=add(forcing[j],mul(repeats,v[command]));});}
    const base=forcing.at(-1),a=[...forcing.slice(0,-1).map(y=>sub(y,base)),one,Q(ticks[i])];
    const b=sub(ys[i],base);
    append(a,add(b,error));append(a.map(neg),sub(error,b));
  }
  const fit=intersectFeedbackHalfspaces(rows,width,spend);
  if(fit.proof){need(checkFeedbackContradiction(rows,width,fit.proof),'invalid physical exclusion');return null;}
  const point=fit.point;
  need(rows.every(r=>cmp(sum(r.a.map((v,i)=>mul(Q(v),point[i]))),r.b)<=0),'invalid physical point');
  const weights=point.slice(0,count);weights.push(sub(one,sum(weights)));
  return {weightWitness:weights.map(fmt),initialWitness:point.slice(count).map(fmt),
    jointRegion:{weightCoordinates:count,lastWeight:'one-minus-sum',remainingCoordinates:['initialPosition','drift'],
      inequalities:rows.map(row=>({coefficients:row.a.map(String),upper:fmt(row.b)}))}};
}

export function observeRatePolytopeSchedule(plan,values){
  need(['finite-schedule','minimum-certified','horizon-bounded'].includes(plan.status)&&Array.isArray(values)&&values.length>=1&&values.length<=plan.readAt.length,
    'supply an ordered prefix of a finite schedule');
  const cat=parse(plan.source),ys=values.map(rational),ticks=plan.readAt.slice(0,ys.length),times=ticks.map(BigInt);
  const base={ticks,readings:ys.map(fmt)},work=budget(plan.source.limits.receiverWork);
  const runs=plan.runs.map(run=>({command:cat.commands.indexOf(run.command),repeats:rational(run.repeats)}));
  let surviving;
  try{surviving=cat.ids.flatMap((law,i)=>{
    const region=receiveFamily(cat.vertices[i],ys,times,runs,cat.error,work.spend);return region?[{law,...region}]:[];
  });}catch(e){if(e!==exhausted)throw e;return {...base,status:'receiver-budget-exhausted',work:work.used,surviving:null,nextTick:null};}
  need(ys.length!==plan.readAt.length||surviving.length<=1,'full schedule left a pair unresolved');
  return {...base,status:'received',work:work.used,surviving,nextTick:surviving.length?(plan.readAt[ys.length]??null):null};
}

export function openRatePolytopes(source,policy){
  const plan=planRatePolytopes(source);
  need(equalPositionDriftData(plan,policy),'saved policy differs from source');
  if(plan.status==='indistinguishable'){
    const cat=parse(plan.source);
    return openRateAlias(plan,cat.commands,(id,weights)=>mixture(cat.vertices[cat.ids.indexOf(id)],weights.map(rational)));
  }
  need(plan.status==='finite-schedule','design work ended without a complete policy');
  const observe=values=>observeRatePolytopeSchedule(plan,values);
  return {observe,replay:record=>{
    const actual=observe(record.readings);
    need(equalPositionDriftData(actual,record),'saved physical region differs from source and readings');return actual;
  }};
}

export {compareFamilies as compareRateHulls,parse as parseRatePolytopeSource,exactRow as primitiveRateInequality,mixture as mixRateRows,budget as rateWorkBudget,exhausted as RATE_WORK_EXHAUSTED};
