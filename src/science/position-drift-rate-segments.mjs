/** Persistent affine rate segments under unknown initial position and drift. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {CATALOG_SCHEMA,parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {positionDriftStateRegion} from './persistent-position-drift.mjs';
const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const abs=x=>x.n<0n?Q(-x.n,x.d):x;
function need(ok,reason){if(!ok)throw Error('Persistent rate segments: '+reason);}
export const SEGMENT_SOURCE='worldlaw.position-drift-rate-segments/v1';
function parse(source){
  need(source?.schema===SEGMENT_SOURCE&&Object.keys(source).sort().join(',')==='commands,laws,noiseBound,schema'&&
    Array.isArray(source.laws)&&source.laws.every(l=>l&&Object.keys(l).sort().join(',')==='endpoints,id'&&
      Array.isArray(l.endpoints)&&l.endpoints.length===2),'supply two ordered endpoint rows per law');
  const ends=[0,1].map(i=>parsePositionDriftRates({schema:CATALOG_SCHEMA,commands:source.commands,noiseBound:source.noiseBound,
    laws:source.laws.map(l=>({id:l.id,rates:l.endpoints[i]}))},rational));
  return {commands:ends[0].commands,ids:ends[0].ids,error:ends[0].error,
    rates:ends[0].rates.map((first,k)=>[first,ends[1].rates[k]])};
}


// A law segment is parametrized by one persistent t in [0,1].
const dot=(a,b)=>a.reduce((v,x,i)=>add(v,mul(x,b[i])),Z());
const minus=(a,b)=>a.map((x,i)=>sub(x,b[i]));
const shift=(a,b,t)=>a.map((x,i)=>add(x,mul(t,b[i])));
const one=Q(1n),neg=x=>sub(Z(),x);
const bounded=x=>cmp(x,Z())<0?Z():cmp(x,one)>0?one:x;
const inside=x=>cmp(x,Z())>=0&&cmp(x,one)<=0;
function nearest(first,second){
  const projected=row=>row.slice(1).map(x=>sub(x,row[0]));
  const [a,b]=first.map(projected),[c,d]=second.map(projected);
  const origin=minus(a,c),u=minus(b,a),v=minus(c,d);
  const uu=dot(u,u),vv=dot(v,v),uv=dot(u,v);
  const p=dot(origin,u),q=dot(origin,v);
  const candidates=[];
  function addCandidate(t,s){
    const difference=shift(shift(origin,u,t),v,s);
    candidates.push({t,s,difference,squared:dot(difference,difference)});
  }
  // The union of these edges also covers a collapsed segment or point.
  for(const t of [Z(),one])addCandidate(t,vv.n?bounded(div(neg(add(q,mul(uv,t))),vv)):Z());
  for(const s of [Z(),one])addCandidate(uu.n?bounded(div(neg(add(p,mul(uv,s))),uu)):Z(),s);
  const determinant=sub(mul(uu,vv),mul(uv,uv));
  if(determinant.n){
    const t=div(sub(mul(uv,q),mul(vv,p)),determinant);
    const s=div(sub(mul(uv,p),mul(uu,q)),determinant);
    if(inside(t)&&inside(s))addCandidate(t,s);
  }
  return candidates.reduce((best,item)=>cmp(item.squared,best.squared)<0?item:best);
}

function rateAt(endpoints,t){return shift(endpoints[0],minus(endpoints[1],endpoints[0]),t);}
function sum(list){return list.reduce(add,Z());}
/** Certify one equal-block experiment from a uniform separating functional. */
export function weightedRateBlocks(weights,responseBands,error){
  const gap=sub(responseBands[0][0],responseBands[1][1]);
  need(gap.n>0n,'weighted rate intervals must be strictly separated');
  const readings=[neg(weights[0]),...weights.slice(0,-1).map((v,k)=>sub(v,weights[k+1])),weights.at(-1)];
  const noiseRadius=mul(error,sum(readings.map(abs))),threshold=div(add(noiseRadius,noiseRadius),gap);
  return {repetitions:threshold.n/threshold.d+1n,certificate:{weights:weights.map(fmt),checkpointWeights:readings.map(fmt),
    unitResponseBands:responseBands.map(b=>b.map(fmt)),unitGap:fmt(gap),noiseRadius:fmt(noiseRadius)}};
}

export function equalRateSchedule(commands,repetitions){
  return {status:'finite-schedule',runs:commands.map(command=>({command,repeats:String(repetitions)})),
    readAt:Array.from({length:commands.length+1},(_,k)=>String(BigInt(k)*repetitions)),
    pulseUpperBound:String(BigInt(commands.length)*repetitions)};
}

export const SEGMENT_PLAN='worldlaw.position-drift-rate-segment-policy/v1';
export function planRateSegments(source){
  const cat=parse(source),certificates=[],aliases=[];
  let repetitions=1n;
  for(let j=1;j<cat.ids.length;j++)for(let i=0;i<j;i++){
    const closest=nearest(cat.rates[i],cat.rates[j]),laws=[cat.ids[i],cat.ids[j]];
    if(!closest.squared.n){
      const left=rateAt(cat.rates[i],closest.t),right=rateAt(cat.rates[j],closest.s),delta=sub(left[0],right[0]);
      need(left.every((v,k)=>cmp(sub(v,right[k]),delta)===0),'invalid constant-offset witness');
      aliases.push({laws,parameters:[fmt(closest.t),fmt(closest.s)],driftShift:fmt(delta)});
      continue;
    }
    const weights=[neg(sum(closest.difference)),...closest.difference];
    const responseBands=[i,j].map(k=>{
      const ends=cat.rates[k].map(row=>dot(weights,row));
      return cmp(ends[0],ends[1])<=0?ends:ends.reverse();
    });
    const gap=sub(responseBands[0][0],responseBands[1][1]);
    need(cmp(gap,closest.squared)===0,'closest-pair certificate disagrees with endpoint response bands');
    const block=weightedRateBlocks(weights,responseBands,cat.error);
    if(block.repetitions>repetitions)repetitions=block.repetitions;
    certificates.push({laws,closestParameters:[fmt(closest.t),fmt(closest.s)],...block.certificate});
  }
  const canonical={schema:SEGMENT_SOURCE,commands:cat.commands.slice(),noiseBound:fmt(cat.error),
    laws:cat.ids.map((id,i)=>({id,endpoints:cat.rates[i].map(row=>row.map(fmt))}))};
  const base={schema:SEGMENT_PLAN,source:canonical,aliases,certificates};
  if(aliases.length)return {...base,status:'indistinguishable'};
  return {...base,...equalRateSchedule(cat.commands,repetitions)};
}

function receiveSegment(endpoints,ticks,values,error,repetitions){
  const residuals=values.slice(),slopes=[Z()];
  let base=Z(),slope=Z();
  for(let k=1;k<values.length;k++){
    base=add(base,mul(repetitions,endpoints[0][k-1]));
    slope=add(slope,mul(repetitions,sub(endpoints[1][k-1],endpoints[0][k-1])));
    residuals[k]=sub(values[k],base);slopes.push(slope);
  }
  let lo=Z(),hi=one;
  // At a fixed parameter, all strips in (initial position, drift) meet
  // exactly when each triple meets. Intersect their closed parameter intervals.
  for(let k=2;k<values.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
    const w=[ticks[k]-ticks[j],ticks[i]-ticks[k],ticks[j]-ticks[i]].map(x=>Q(x));
    const scale=mul(Q(2n*(ticks[k]-ticks[i])),error);
    const contrast=dot(w,[residuals[i],residuals[j],residuals[k]]);
    const coeff=dot(w,[slopes[i],slopes[j],slopes[k]]);
    if(!coeff.n){
      if(cmp(contrast,neg(scale))<0||cmp(contrast,scale)>0)return null;
      continue;
    }
    const left=div(sub(contrast,scale),coeff),right=div(add(contrast,scale),coeff);
    const [lower,upper]=cmp(left,right)<=0?[left,right]:[right,left];
    if(cmp(lower,lo)>0)lo=lower;
    if(cmp(upper,hi)<0)hi=upper;
    if(cmp(lo,hi)>0)return null;
  }
  const centers=residuals.map((r,i)=>sub(r,mul(slopes[i],lo)));
  const state=positionDriftStateRegion(centers,error,ticks.map(t=>String(t)));
  if(!state)throw Error('Parameter interval produced no physical start');
  return {parameterRange:[fmt(lo),fmt(hi)],witnessParameter:fmt(lo),initialWitness:state.initialWitness};
}

export function openRateAlias(plan,commands,ratesFor){
  function trace(first,second,runs,origin=['0','0']){
    const laws=[first,second];
    const alias=plan.aliases.find(a=>first!==second&&a.laws.includes(first)&&a.laws.includes(second));
    need(alias&&Array.isArray(runs)&&Array.isArray(origin)&&origin.length===2,'supply an alias and physical origin');
    const parameters=laws.map(id=>{
      const value=alias.parameters[alias.laws.indexOf(id)];return Array.isArray(value)?value.slice():value;
    });
    const driftShift=first===alias.laws[0]?rational(alias.driftShift):neg(rational(alias.driftShift));
    const [p,v]=origin.map(rational),starts=[v,add(v,driftShift)];
    const rates=laws.map((id,i)=>ratesFor(id,parameters[i]));
    const position=[p,p],readings=[[fmt(p)],[fmt(p)]],ticks=['0'];
    let tick=0n;
    const word=runs.map(run=>{
      need(run&&Object.keys(run).sort().join(',')==='command,repeats','malformed command run');
      const command=commands.indexOf(run.command),n=rational(run.repeats);
      need(command>=0&&n.d===1n&&n.n>0n,'unknown command or invalid repeat count');
      for(let i=0;i<2;i++){
        position[i]=add(position[i],mul(n,add(starts[i],rates[i][command])));
        readings[i].push(fmt(position[i]));
      }
      need(cmp(position[0],position[1])===0,'alias failed physical replay');
      tick+=n.n;ticks.push(String(tick));return {command:run.command,repeats:fmt(n)};
    });
    return {laws:[...laws],parameters,driftShift:fmt(driftShift),origin:[fmt(p),fmt(v)],starts:starts.map(x=>[fmt(p),fmt(x)]),word,ticks,readings};
  }
  return {trace,replay:record=>{
    const actual=trace(...record.laws,record.word,record.origin);
    need(equalPositionDriftData(actual,record),'saved alias trace differs from physical replay');return actual;
  }};
}

export function openRateSegments(source,policy){
  const plan=planRateSegments(source),cat=parse(plan.source);
  need(equalPositionDriftData(plan,policy),'saved policy differs from source');
  if(plan.status==='indistinguishable')return openRateAlias(plan,cat.commands,(id,t)=>rateAt(cat.rates[cat.ids.indexOf(id)],rational(t)));
  const observe=values=>observeRateSegmentSchedule(plan,values);
  return {observe,replay:record=>{
    const actual=observe(record.readings);
    need(equalPositionDriftData(actual,record),'saved record differs from physical replay');return actual;
  }};
}

/** Receive the command blocks from an already verified plan. */
export function observeRateSegmentSchedule(plan,values){
  const cat=parse(plan.source);
  need(Array.isArray(values)&&values.length>=1&&values.length<=plan.readAt.length,'supply consecutive checkpoint readings');
  const ys=values.map(rational),ticks=plan.readAt.slice(0,ys.length),times=ticks.map(BigInt),rep=rational(plan.runs[0].repeats);
  const surviving=cat.ids.flatMap((law,i)=>{
    const region=receiveSegment(cat.rates[i],times,ys,cat.error,rep);
    return region?[{law,...region}]:[];
  });
  need(ys.length!==plan.readAt.length||surviving.length<=1,'full schedule left a pair unresolved');
  return {ticks,readings:ys.map(fmt),surviving,nextTick:surviving.length?(plan.readAt[ys.length]??null):null};
}
