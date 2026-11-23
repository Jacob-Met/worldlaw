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

const dwellSchema='worldlaw.position-drift-dwell-calibration/v1';
const dwellProofSchema='worldlaw.position-drift-dwell-calibration-proof/v1';

function integerRoot(n){
  if(n<2n)return n;
  let x=1n<<BigInt(Math.ceil(n.toString(2).length/2));
  for(;;){
    const y=(x+n/x)/2n;
    if(y>=x)return x;
    x=y;
  }
}

function dwellRadius(m,k){return Q(k*m,10n*(m+2n*k));}

function chooseBudget(h){
  need(h>=6n,'the total pulse budget must be at least six');
  const largest=h/6n;
  // sqrt(2)*h is irrational. Its integer floor resolves floor((2-sqrt(2))*h/4) exactly.
  const below=(2n*h-integerRoot(2n*h*h)-1n)/4n;
  const valid=k=>k<1n?1n:(k>largest?largest:k);
  const candidates=[...new Set([valid(below),valid(below+1n)])];
  let best=Z(),optimal=[];
  for(const k of candidates){
    const radius=dwellRadius(h-4n*k,k),order=compare(radius,best);
    if(order>0){best=radius;optimal=[k];}
    else if(order===0)optimal.push(k);
  }
  const k=optimal[0];
  return {m:h-4n*k,k,selector:{budget:String(h),checkedDwells:candidates.map(String),optimalDwells:optimal.map(String)}};
}

function positiveInteger(raw,label){
  const value=rational(raw);
  need(value.d===1n&&value.n>0n,label+' must be a positive integer');
  return value.n;
}

function prepare(input){
  const keys=Object.keys(input??{}).sort().join(',');
  const standard=input?.schema===sourceSchema&&keys==='catalog,references,schema';
  const explicit=input?.schema===dwellSchema&&keys==='catalog,dwell,references,schema';
  const budget=input?.schema===dwellSchema&&keys==='catalog,pulseBudget,schema';
  need(standard||explicit||budget,'supply a reference count, an explicit dwell, or a total pulse budget');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:input.catalog,fourPulseControl:null});
  if(budget){
    const h=positiveInteger(input.pulseBudget,'pulse budget');
    return {cat,...chooseBudget(h),source:{schema:dwellSchema,pulseBudget:String(h),catalog:canonical}};
  }
  const count=rational(input.references),k=explicit?positiveInteger(input.dwell,'dwell'):1n;
  need(count.d===1n&&count.n>=2n*k,'the reference count must be an integer of at least twice the dwell');
  const source={schema:input.schema,references:String(count.n),catalog:canonical};
  if(explicit)source.dwell=String(k);
  return {m:count.n,k,cat,source,selector:null};
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

function ticksFor(m,k){return [0n,m,m+k,m+2n*k,m+3n*k,m+4n*k].map(String);}
function runsFor(m,k,tail){return [{command:'ref',repeats:String(m)},...['group',...tail].map(command=>({command,repeats:String(k)}))];}

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

function boundaryWorlds(cat,roles,m,k,spend){
  const d=10n*(m+2n*k),q=n=>Q(n,d),radius=q(m*k);
  const shared=[Z(),q(-2n*m*k),q(k*(4n*m+4n*k))];
  const masses=[
    [[0n,2n*m+12n*k,0n,8n*m+8n*k],[4n*m+12n*k,4n*k,0n,6n*m+4n*k]],
    [[6n*m+14n*k,0n,4n*m+2n*k,4n*k],[4n*m+16n*k,0n,6n*m+2n*k,2n*k]],
  ];
  const branches=tails.map((commands,b)=>{
    const worlds=roles.map(({family,indices},l)=>{
      const weights=cat.vertices[family].map(Z);
      indices.forEach((j,i)=>{weights[j]=q(masses[b][l][i]);});
      return {law:cat.ids[family],weights:weights.map(fmt),origin:fmt(l?neg(radius):radius),
        drift:fmt(l?Z():q((b?-2n:-4n)*k))};
    });
    const clean=worlds.map(w=>trajectory(cat,w,runsFor(m,k,commands),spend));
    const after=clean[0].slice(3).map((x,i)=>div(add(x,clean[1][i+3]),two));
    const readings=[...shared,...after];
    for(const path of clean)path.forEach((x,t)=>{
      const error=sub(readings[t],x);
      need(compare(error,neg(radius))>=0&&compare(error,radius)<=0,'boundary left an original position tube');
    });
    return {commands:commands.slice(),after:after.map(fmt),worlds};
  });
  const step=q(-2n*k);
  need(compare(add(shared[0],mul(Q(m),step)),shared[1])===0,'reference line misses its endpoint');
  return {reference:{origin:fmt(shared[0]),perTick:fmt(step),through:String(m)},shared:shared.map(fmt),branches};
}

function leastReferences(error,k){
  const room=sub(Q(k),mul(Q(10n),error));
  if(room.n<=0n)return null;
  const bound=div(mul(Q(20n*k),error),room),n=bound.n/bound.d+1n;
  return n<2n*k?2n*k:n;
}

export function certifyReferenceCalibration(input){
  const {cat,m,k,source,selector}=prepare(input),work=rateWorkBudget(source.catalog.limits.designWork);
  const schema=source.schema===sourceSchema?proofSchema:dwellProofSchema;
  try{
    const roles=bindRoles(cat,work.spend);
    need(roles[0].family!==roles[1].family,'the two physical roles must use different families');
    const radius=dwellRadius(m,k),least=leastReferences(cat.error,k);
    const boundary=boundaryWorlds(cat,roles,m,k,work.spend);
    const extra=source.schema===sourceSchema?{familyCeiling:'1/10'}:
      {references:String(m),dwell:String(k),fixedDwellCeiling:fmt(Q(k,10n)),
        interpolation:'affine-on-each-command-run',selector};
    return {schema,source,status:'calibration-certified',horizon:String(m+4n*k),readAt:ticksFor(m,k),
      radius:fmt(radius),atRequestedNoise:compare(cat.error,radius)<0?'policy-separates':'closed-collision',
      leastReferencesAtNoise:least===null?null:String(least),...extra,boundary,work:work.used};
  }catch(error){
    if(error!==RATE_WORK_EXHAUSTED)throw error;
    return {schema,source,status:'design-budget-exhausted',work:work.used};
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
  const {cat,m,k,source}=prepare(input),ys=values.map(rational),work=rateWorkBudget(source.catalog.limits.receiverWork);
  let score=null,cutoff=null,tail=[];
  if(ys.length>=3){
    score=add(sub(mul(Q(k),ys[0]),mul(Q(m+k),ys[1])),mul(Q(m),ys[2]));
    cutoff=add(Q(m*k,2n),mul(Q(m-4n*k),cat.error));
    tail=tails[compare(score,cutoff)<0?0:1];
  }
  const program=runsFor(m,k,tail),taken=program.slice(0,ys.length-1);
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
