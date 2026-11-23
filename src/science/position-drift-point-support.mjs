/** Exact zero-noise command support for a point versus a convex rate family. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {openRateAlias} from './position-drift-rate-segments.mjs';
import {parseRatePolytopeSource,compareRateHulls,mixRateRows,rateWorkBudget,RATE_WORK_EXHAUSTED,observeRatePolytopeSchedule} from './position-drift-rate-polytopes.mjs';
const {Q,Z,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const sum=xs=>xs.reduce(add,Z()),dot=(a,b)=>sum(a.map((v,i)=>mul(v,b[i])));
function need(ok,message){if(!ok)throw Error('Zero-noise point-family support: '+message);}
export const SUPPORT_SOURCE='worldlaw.position-drift-point-support-source/v1';
export const SUPPORT_PLAN='worldlaw.position-drift-point-support-policy/v1';
function prepare(request){
  need(request?.schema===SUPPORT_SOURCE&&Object.keys(request).sort().join(',')==='catalog,schema,subsetLimit'&&
    Number.isSafeInteger(request.subsetLimit)&&request.subsetLimit>=0,'supply a catalog and a nonnegative subset limit');
  return pointRateCatalog(request.catalog);
}

export function pointRateCatalog(source){
  const cat=parseRatePolytopeSource(source);
  need(cat.ids.length===2&&cat.error.n===0n,'supply two families and an exact zero error bound');
  const reference=cat.vertices.findIndex(vs=>vs.every(v=>v.every((x,i)=>
    cmp(sub(x,vs[0][i]),sub(v[0],vs[0][0]))===0)));
  need(reference>=0,'one family must be a point after subtracting first-command rates');
  const other=1-reference,canonical={schema:source.schema,commands:cat.commands.slice(),noiseBound:'0',
    limits:{...source.limits},laws:cat.ids.map((id,i)=>({id,vertices:cat.vertices[i].map(v=>v.map(fmt))}))};
  return {cat,reference,other,canonical};
}

function* subsets(n,k){
  const ids=Array.from({length:k},(_,i)=>i);
  for(;;){
    yield ids.slice();
    let i=k-1;while(i>=0&&ids[i]===n-k+i)i--;
    if(i<0)return;
    ids[i]++;for(let j=i+1;j<k;j++)ids[j]=ids[j-1]+1;
  }
}

export function planPointSupport(request){
  const {cat,reference,other,canonical}=prepare(request),limit=request.subsetLimit,work=rateWorkBudget(canonical.limits.designWork);
  const all=cat.commands.map((_,i)=>i),base={schema:SUPPORT_PLAN,source:canonical,referenceLaw:cat.ids[reference],subsetLimit:limit};
  let visited=0,completeThrough=0,full,preceding=[];
  const exhausted=Symbol('subset limit');
  function classify(ids){
    if(visited>=limit)throw exhausted;
    visited++;
    const restrict=row=>ids.map(i=>row[i]);
    const outcome=compareRateHulls([restrict(cat.vertices[reference][0])],cat.vertices[other].map(restrict),work.spend);
    const commands=ids.map(i=>cat.commands[i]),laws=[cat.ids[reference],cat.ids[other]];
    if(outcome.parameters){
      const parameters=[cat.vertices[reference].map((_,i)=>i?'0':'1'),outcome.parameters[1]];
      return {commands,alias:{laws,parameters,driftShift:outcome.driftShift}};
    }
    return {commands,laws,weights:outcome.weights.map(fmt),rateBands:outcome.bands.map(b=>b.map(fmt))};
  }
  try{
    // An all-command alias defeats every experiment. A full-menu separator supplies an upper bound.
    full=classify(all);
    if(full.alias)return {...base,status:'indistinguishable',aliases:[full.alias],subsetsVisited:visited,work:work.used};
    for(let k=1;k<=all.length;k++){
      const current=[];
      for(const ids of subsets(all.length,k)){
        const result=k===all.length?full:classify(ids);
        if(result.alias){current.push(result);continue;}
        const runs=result.commands.map(command=>({command,repeats:'1'}));
        return {...base,status:'minimum-certified',minimumPulses:String(k),pulseUpperBound:String(k),
          preceding,separator:result,runs,readAt:Array.from({length:k+1},(_,i)=>String(i)),subsetsVisited:visited,work:work.used};
      }
      preceding=current;completeThrough=k;
    }
    throw Error('The full-menu separator was lost.');
  }catch(err){
    if(err!==exhausted&&err!==RATE_WORK_EXHAUSTED)throw err;
    return {...base,status:'design-budget-exhausted',reason:err===exhausted?'subsets':'linear-work',
      completeThrough,knownUpper:full&&!full.alias?String(all.length):null,subsetsVisited:visited,work:work.used};
  }
}

function combinations(n,k){
  let out=1n;
  for(let i=1;i<=Math.min(k,n-k);i++)out=out*BigInt(n-i+1)/BigInt(i);
  return out;
}

/** Verify a minimum certificate using only rational substitution and finite subset coverage. */
export function verifyPointSupport(request,saved){
  const {cat,reference,other,canonical}=prepare(request),N=cat.commands.length;
  need(saved?.schema===SUPPORT_PLAN&&saved.status==='minimum-certified'&&saved.referenceLaw===cat.ids[reference]&&
    saved.subsetLimit===request.subsetLimit&&equalPositionDriftData(saved.source,canonical),'certificate source differs');
  const size=saved.separator?.commands?.length,seen=new Set(),lawOrder=[cat.ids[reference],cat.ids[other]];
  need(Number.isSafeInteger(size)&&size>=2&&size<=N&&saved.minimumPulses===String(size)&&saved.pulseUpperBound===String(size)&&
    Array.isArray(saved.preceding)&&saved.preceding.length<=request.subsetLimit&&BigInt(saved.preceding.length)===combinations(N,size-1),
    'incomplete preceding level or wrong minimum');
  function indices(commands,k){
    need(Array.isArray(commands)&&commands.length===k,'invalid command subset size');
    const ids=commands.map(x=>cat.commands.indexOf(x));
    need(ids.every((v,i)=>v>=0&&(!i||v>ids[i-1])),'unknown, reordered or repeated command in subset');
    return ids;
  }
  const refRow=cat.vertices[reference][0];
  for(const {commands,alias} of saved.preceding){
    const ids=indices(commands,size-1),key=ids.join(',');
    need(!seen.has(key)&&equalPositionDriftData(alias?.laws,lawOrder),'duplicate subset or wrong alias pair');seen.add(key);
    need(Array.isArray(alias.parameters)&&alias.parameters.length===2&&
      equalPositionDriftData(alias.parameters[0],cat.vertices[reference].map((_,i)=>i?'0':'1')),'lower witness must follow the fixed reference member');
    const otherWeights=alias.parameters[1].map(rational);
    need(otherWeights.length===cat.vertices[other].length&&otherWeights.every(w=>w.n>=0n)&&cmp(sum(otherWeights),Q(1n))===0,'invalid competing mixture');
    const otherRow=mixRateRows(cat.vertices[other],otherWeights),shift=rational(alias.driftShift);
    need(ids.every(i=>cmp(sub(refRow[i],otherRow[i]),shift)===0),'lower witness cannot produce the reference readings');
  }
  const sep=saved.separator,ids=indices(sep.commands,size),w=sep.weights.map(rational);
  need(equalPositionDriftData(sep.laws,lawOrder)&&w.length===size&&sum(w).n===0n,'separator must cancel constant drift');
  const bands=[reference,other].map(f=>{
    const values=cat.vertices[f].map(row=>dot(w,ids.map(i=>row[i]))).sort(cmp);
    return [fmt(values[0]),fmt(values.at(-1))];
  });
  need(cmp(rational(bands[0][0]),rational(bands[1][1]))>0&&equalPositionDriftData(sep.rateBands,bands),'closed response bands fail strict separation');
  need(equalPositionDriftData(saved.runs,sep.commands.map(command=>({command,repeats:'1'})))&&
    equalPositionDriftData(saved.readAt,Array.from({length:size+1},(_,i)=>String(i))),'schedule differs from the verified command subset');
  return true;
}

export function openPointSupport(request,policy){
  const plan=planPointSupport(request);need(equalPositionDriftData(plan,policy),'saved support plan differs from source');
  const {cat,reference}=pointRateCatalog(plan.source),ratesFor=(id,ws)=>mixRateRows(cat.vertices[cat.ids.indexOf(id)],ws.map(rational));
  if(plan.status==='indistinguishable')return openRateAlias(plan,cat.commands,ratesFor);
  need(plan.status==='minimum-certified','design work ended without a minimum');
  verifyPointSupport(request,plan);
  const referenceAdversary=(origin=['0','0'])=>replayReferenceBranch(cat,reference,plan.separator.commands.length,
    used=>plan.preceding.find(item=>[...used].every(c=>item.commands.includes(c))),ratesFor,origin);
  const observe=values=>observeRatePolytopeSchedule(plan,values);
  return {referenceAdversary,observe,replay:record=>{
    const actual=observe(record.readings);need(equalPositionDriftData(actual,record),'saved physical region differs from readings');return actual;
  }};
}

export function replayReferenceBranch(cat,reference,size,findCover,ratesFor,origin){
  need(Array.isArray(origin)&&origin.length===2,'supply a physical starting position and drift');
  const [start,drift]=origin.map(rational),row=cat.vertices[reference][0],used=new Set(),word=[],readings=[fmt(start)];
  let position=start;
  function pulse(command,repeats='1'){
    const index=cat.commands.indexOf(command),n=rational(repeats);
    need(index>=0&&n.d===1n&&n.n>0n,'supply a known command and positive integer repetitions');
    need(used.has(command)||used.size+1<size,'distinct-command lower-bound budget exceeded');
    used.add(command);position=add(position,mul(n,add(row[index],drift)));
    const y=fmt(position);word.push({command,repeats:fmt(n)});readings.push(y);return y;
  }
  function collision(){
    const leaf=findCover(used);
    need(leaf,'no covering lower-bound subset');
    const r=openRateAlias({aliases:[leaf.alias]},cat.commands,ratesFor).trace(...leaf.alias.laws,word,origin);
    need(equalPositionDriftData(r.readings[0],readings),'physical transcript differs from the causal reference');
    return {...r,coveredBy:leaf.commands.slice()};
  }
  return {initialReading:fmt(start),pulse,collision};
}

