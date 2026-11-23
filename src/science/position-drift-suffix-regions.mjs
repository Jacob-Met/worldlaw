/** Complete one-decision suffix policies when two fixed pulses precede feedback. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const two=Q(2n),four=Q(4n);
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const abs=a=>a.n<0n?neg(a):a;
const mid=(a,b)=>div(add(a,b),two);
const times=(t,x)=>mul(Q(BigInt(t)),x);
const inInterval=(x,lo,hi)=>cmp(x,lo)>=0&&cmp(x,hi)<=0;
const need=(ok,msg)=>{if(!ok)throw Error('Suffix regions: '+msg);};

export const SUFFIX_PLAN='worldlaw.position-drift-suffix-feedback-policy/v1';
export const REGION_SUFFIX_REQUEST='worldlaw.position-drift-suffix-feedback-source/v3';

export function normalizedForcing(row,actions){
  const forcing=[Z()];
  for(const u of actions)forcing.push(add(forcing.at(-1),sub(row[u],row[actions[0]])));
  return forcing;
}

export function affine(d0,d1,t){return add(d0,times(t,sub(d1,d0)));}

// Differences between the worlds' clean values at ticks zero and one lie
// in a compact polygon, regardless of the suffix's length.
export function differenceVertices(left,right,error,prefixLength,visit){
  const delta=left.map((x,t)=>sub(x,right[t])),diameter=mul(two,error);
  const lines=delta.flatMap((d,t)=>[{t,b:sub(diameter,d)},{t,b:sub(neg(diameter),d)}]);
  for(let t=0;t<=prefixLength;t++)lines.push({t,b:neg(delta[t])});
  for(let j=1;j<lines.length;j++)for(let i=0;i<j;i++){
    const a=lines[i],b=lines[j];
    if(a.t===b.t)continue;
    const slope=div(sub(b.b,a.b),Q(BigInt(b.t-a.t)));
    const d0=sub(a.b,times(a.t,slope)),d1=add(d0,slope);
    const difference=t=>add(affine(d0,d1,t),delta[t]);
    if(!delta.every((_,t)=>cmp(abs(difference(t)),diameter)<=0))continue;
    visit(d0,d1,difference);
  }
}

function projectPair(left,right,error){
  let best=null;
  differenceVertices(left,right,error,2,(d0,d1,difference)=>{
    const penalty=add(add(abs(d0),times(2,abs(d1))),abs(difference(2)));
    if(!best||cmp(penalty,best.penalty)<0)best={d0,d1,penalty};
  });
  if(!best)return null;
  const center=mid(left[2],right[2]),radius=sub(mul(four,error),div(best.penalty,two));
  return {lo:sub(center,radius),hi:add(center,radius),center,d0:best.d0,d1:best.d1};
}

function collisionAt(s,pair,cat,actions){
  const {i,j,lo,hi,center,d0,d1}=pair;
  need(inInterval(s,lo,hi),'unsafe interval does not contain the requested history');
  const forces=[i,j].map(k=>normalizedForcing(cat.rates[k],actions));
  const limit0=sub(cat.error,div(abs(d0),two)),limit1=sub(cat.error,div(abs(d1),two));
  const clip=(x,r)=>cmp(x,r)>0?r:cmp(x,neg(r))<0?neg(r):x;
  const offset=sub(s,center),contribution0=clip(offset,limit0);
  const mean0=neg(contribution0),mean1=div(clip(sub(offset,contribution0),times(2,limit1)),two);
  const worlds=[i,j].map((k,n)=>{
    const half=x=>div(n?neg(x):x,two);
    const x0=add(mean0,half(d0)),x1=add(mean1,half(d1));
    return {law:cat.ids[k],start:[fmt(x0),fmt(sub(sub(x1,x0),cat.rates[k][actions[0]]))],
      values:forces[n].map((f,t)=>add(affine(x0,x1,t),f))};
  });
  const ys=[Z(),Z(),s,...worlds[0].values.slice(3).map((v,t)=>mid(v,worlds[1].values[t+3]))];
  for(const world of worlds)need(world.values.every((v,t)=>cmp(abs(sub(v,ys[t])),cat.error)<=0),
    'constructed starts or readings violate the physical error bound');
  return {readings:ys.map(fmt),worlds:worlds.map(({law,start})=>({law,start}))};
}

export function planSuffixRegions(request){
  need(request?.schema===REGION_SUFFIX_REQUEST&&Object.keys(request).sort().join(',')==='catalog,prefix,schema,suffixes',
    'supply a catalog, two-command prefix and equal-length suffix menu');
  const source=structuredClone(request.catalog),cat=parsePositionDriftRates(source,rational);
  const prefix=structuredClone(request.prefix),suffixes=structuredClone(request.suffixes);
  const valid=word=>Array.isArray(word)&&word.every(u=>cat.commands.includes(u));
  need(cat.ids.length<=16&&valid(prefix)&&prefix.length===2&&Array.isArray(suffixes)&&suffixes.length>=1&&suffixes.length<=16&&
    suffixes.every(s=>valid(s)&&s.length===suffixes[0].length&&s.length>0&&s.length<=10),
    'use two fixed pulses, up to 16 laws, and one to 16 equal-length suffixes of at most ten pulses');
  const base={schema:SUFFIX_PLAN,source,prefix,suffixes},bounds=new Map();
  function remember(v){bounds.set(fmt(v),v);return v;}
  const actions=suffixes.map(s=>[...prefix,...s].map(u=>cat.commands.indexOf(u)));
  const forces=actions.map(word=>cat.rates.map(row=>normalizedForcing(row,word)));
  const lawRanges=forces[0].map(f=>[remember(sub(f[2],mul(four,cat.error))),remember(add(f[2],mul(four,cat.error)))]);
  const candidates=forces.map(matrix=>{
    const pairs=[];
    for(let j=1;j<matrix.length;j++)for(let i=0;i<j;i++){
      const pair=projectPair(matrix[i],matrix[j],cat.error);
      if(pair){remember(pair.lo);remember(pair.hi);pairs.push({i,j,...pair});}
    }
    return pairs;
  });
  const unsafe=candidates.map(pairs=>pairs.map(p=>({laws:[cat.ids[p.i],cat.ids[p.j]],lo:fmt(p.lo),hi:fmt(p.hi)})));
  const endpoints=[...bounds.values()].sort(cmp),regions=[];
  for(let k=0;k<endpoints.length;k++){
    const lo=endpoints[k],right=endpoints[k+1];
    for(const hi of right?[lo,right]:[lo]){
      const s=mid(lo,hi);
      if(!lawRanges.some(([a,b])=>inInterval(s,a,b)))continue;
      const collisions=candidates.map(pairs=>pairs.find(p=>inInterval(s,p.lo,p.hi)));
      const suffix=collisions.findIndex(pair=>!pair);
      if(suffix<0)return {...base,status:'suffix-refuted',unsafe,collision:{prefixReadings:['0','0',fmt(s)],
        branches:collisions.map((pair,n)=>({suffix:n,...collisionAt(s,pair,cat,actions[n])}))}};
      regions.push({lo:fmt(lo),hi:fmt(hi),suffix});
    }
  }
  return {...base,status:'suffix-certified',unsafe,regions};
}

export function chooseRegionSuffix(regions,values){
  const [a,b,c]=values.slice(0,3).map(rational),s=add(sub(c,times(2,b)),a);
  const region=regions.find(r=>{
    const lo=rational(r.lo),hi=rational(r.hi);
    return r.lo===r.hi?cmp(lo,s)===0:cmp(lo,s)<0&&cmp(s,hi)<0;
  });
  need(region,'a feasible measured prefix is missing from the policy');
  return region.suffix;
}
