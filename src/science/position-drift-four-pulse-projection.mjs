/** Compute a full menu's exact radius using fixed-noise projections and increasing certified lower bounds. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {compare,maximum,minimum,midpoint} from './persistent-four-pulse-geometry.mjs';
import {fourPulseCourseTree,fourPulseLeafFacets} from './position-drift-four-pulse-radius.mjs';
import {compareRateHulls,mixRateRows} from './position-drift-rate-polytopes.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {physicalThreePulseCollision} from './position-drift-three-pulse-hulls.mjs';
const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const zero=Z(),one=Q(1n),absolute=x=>x.n<0n?neg(x):x;
const rhs=(row,error)=>add(row.h,mul(error,row.r));
const need=(ok,msg)=>{if(!ok)throw Error('Four-pulse projected supports: '+msg);};

function scaled(row,c,divisor){
  return {c:c.map(x=>div(x,divisor)),h:div(row.h,divisor),r:div(row.r,divisor),
    terms:row.terms.map(t=>({atom:t.atom,weight:div(t.weight,divisor)}))};
}
function sum(a,b){
  return {c:a.c.map((v,i)=>add(v,b.c[i])),h:add(a.h,b.h),r:add(a.r,b.r),terms:[...a.terms,...b.terms]};
}
export function projectFourPulseRows(rows,spend,emit){
  const lower=[],upper=[];
  for(const row of rows){
    spend();const last=row.c.at(-1),c=row.c.slice(0,-1);
    if(!last.n){emit({...row,c});continue;}
    (last.n>0n?upper:lower).push(scaled(row,c,absolute(last)));
  }
  for(const a of lower)for(const b of upper){spend();emit(sum(a,b));}
}
// Sorted upper envelope of affine lines. A missing first breakpoint means
// minus infinity. At a simultaneous crossing either adjacent line is valid.
function upperEnvelope(lines,spend){
  const slopes=new Map();
  for(const line of lines){
    spend();const key=fmt(line.m),old=slopes.get(key);
    if(!old||compare(line.b,old.b)>0)slopes.set(key,line);
  }
  const ordered=[...slopes.values()].sort((a,b)=>{spend();return compare(a.m,b.m);}),hull=[];
  for(const line of ordered){
    let start=null;
    while(hull.length){
      spend();const old=hull.at(-1);start=div(sub(old.b,line.b),sub(line.m,old.m));
      if(old.start===null||compare(start,old.start)>0)break;
      hull.pop();
    }
    hull.push({...line,start:hull.length?start:null});
  }
  return hull;
}
function direction(row){
  const pivot=row.c.find(x=>x.n),normalized=scaled(row,row.c,pivot?absolute(pivot):one);
  return [normalized.c.map(fmt).join(','),normalized];
}
// Every leaf projection is independent of the chosen error bound. Normalize
// parallel rows once, and keep their lower affine envelope for all epsilon>=0.
function prepareBranches(tree,faces,spend){
  const branches=new Map();
  tree.leaves.forEach((leaf,i)=>{
    const node=leaf.coordinates[1];if(!branches.has(node))branches.set(node,new Map());
    const groups=branches.get(node);
    projectFourPulseRows(faces[i],spend,row=>{
      const [key,normalized]=direction(row);if(!groups.has(key))groups.set(key,new Map());
      const lines=groups.get(key),slope=fmt(normalized.r),old=lines.get(slope);
      if(!old||compare(normalized.h,old.h)<0)lines.set(slope,normalized);
    });
  });
  const selectors=new Map();
  for(const [node,groups] of branches){
    const list=[];
    for(const lines of groups.values()){
      const env=upperEnvelope([...lines.values()].map(row=>({m:neg(row.r),b:neg(row.h),row})),spend);
      let first=0;while(first+1<env.length&&env[first+1].start.n<=0n)first++;
      list.push(env.slice(first));
    }
    selectors.set(node,list);
  }
  return selectors;
}
function valueAt(lines,error,spend){
  spend();let i=0;
  while(i+1<lines.length&&compare(lines[i+1].start,error)<=0){spend();i++;}
  return lines[i].row;
}
function tightAt(map,row,error){
  const [key,normalized]=direction(row),value=rhs(normalized,error),old=map.get(key);
  if(!old||compare(value,old.value)<0)map.set(key,{...normalized,value});
}
// For fixed error, feasibility is max(lower w bounds) <= min(upper w bounds).
// Only pairs that are simultaneously active somewhere along s are necessary.
function projectIntermediate(rows,error,spend,roots){
  const positive=[],negative=[];
  for(const row of rows){
    spend();const [a,b]=row.c;
    if(!b.n){tightAt(roots,{...row,c:[a]},error);continue;}
    const bound=scaled(row,[a],absolute(b));
    (b.n>0n?positive:negative).push({m:bound.c[0],b:neg(rhs(bound,error)),row:bound});
  }
  if(!positive.length||!negative.length)return;
  const lo=upperEnvelope(negative,spend),hi=upperEnvelope(positive,spend);let i=0,j=0;
  for(;;){
    spend();tightAt(roots,sum(lo[i].row,hi[j].row),error);
    const nextLo=lo[i+1]?.start,nextHi=hi[j+1]?.start;
    if(!nextLo&&!nextHi)break;
    if(!nextHi||(nextLo&&compare(nextLo,nextHi)<=0))i++;
    if(!nextLo||(nextHi&&compare(nextHi,nextLo)<=0))j++;
  }
}
function witnessCoordinate(rows,error,previous,spend){
  let lo=null,hi=null;
  for(const row of rows){
    spend();const last=row.c.at(-1),remaining=previous.reduce((v,x,j)=>sub(v,mul(x,row.c[j])),rhs(row,error));
    if(!last.n){need(remaining.n>=0n,'inconsistent boundary section');continue;}
    const edge=div(remaining,last);
    if(last.n<0n)lo=lo===null?edge:maximum(lo,edge);
    else hi=hi===null?edge:minimum(hi,edge);
  }
  need(lo&&hi&&compare(lo,hi)<=0,'empty physical section');return midpoint(lo,hi);
}
function cleanAlias(cat,tree,spend){
  const used=[...new Set(tree.leaves.flatMap(leaf=>leaf.word))];
  const rates=cat.vertices.map(vs=>vs.map(row=>used.map(i=>row[i])));
  const separation=compareRateHulls(rates[0],rates[1],spend);
  if(!separation.parameters)return null;
  const weights=separation.parameters.map(xs=>xs.map(rational));
  const both=cat.vertices.map((vs,i)=>mixRateRows(vs,weights[i]));
  const observations=Array(tree.width);
  const worlds=tree.leaves.map(({word,coordinates})=>both.map((rates,law)=>{
    const drift=neg(rates[word[0]]),positions=[zero];
    for(const c of word){spend();positions.push(add(positions.at(-1),add(drift,rates[c])));}
    coordinates.forEach((node,i)=>{
      const value=fmt(positions[i+2]);
      need(observations[node]===undefined||observations[node]===value,'alias histories disagree');observations[node]=value;
    });
    return {law:cat.ids[law],weights:separation.parameters[law].slice(),start:['0',fmt(drift)],positions:positions.map(fmt)};
  }));
  return {radius:'0',kept:[0],lower:[],jumps:[],boundary:{observations,worlds}};
}
export function projectedFourPulseMenu(cat,prefix,menu,spend){
  const tree=fourPulseCourseTree(cat,prefix,'full',spend,menu),alias=cleanAlias(cat,tree,spend);
  if(alias)return alias;
  const faces=tree.leaves.map(({word},leaf)=>fourPulseLeafFacets(cat,word,spend).map(f=>{
    const atom={leaf,law:cat.ids[f.law],normal:f.n.map(fmt)};
    return {c:f.n,h:f.h,r:f.r,terms:[{atom,weight:one}]};
  }));
  const selectors=prepareBranches(tree,faces,spend),jumps=[];
  let error=zero,active=[];
  for(;;){
    const branches=new Map(),roots=new Map(),scalars=new Map();
    for(const [node,list] of selectors){
      const rows=list.map(lines=>valueAt(lines,error,spend));branches.set(node,rows);
      projectIntermediate(rows,error,spend,roots);
    }
    projectFourPulseRows([...roots.values()],spend,row=>tightAt(scalars,row,error));
    const failure=scalars.get('');
    if(failure&&failure.value.n<0n){
      need(failure.r.n>0n&&failure.terms.length<=8,'invalid violated source support');
      const next=div(neg(failure.h),failure.r);need(compare(next,error)>0,'nonincreasing support bound');
      const combined=new Map();
      for(const {atom,weight} of failure.terms){
        const previous=combined.get(atom);combined.set(atom,previous?add(previous,weight):weight);
      }
      active=[...combined].map(([atom,weight])=>({...atom,weight:fmt(weight)}));
      jumps.push({radius:fmt(next),lower:active});error=next;continue;
    }
    const observations=Array(tree.width),s=witnessCoordinate([...roots.values()],error,[],spend);
    observations[0]=s;
    for(const [node,rows] of branches)observations[node]=witnessCoordinate(rows,error,[s],spend);
    const boundaryCat={...cat,error};
    const worlds=tree.leaves.map(({word,coordinates:[,w,v]},i)=>{
      observations[v]=witnessCoordinate(faces[i],error,[s,observations[w]],spend);
      return physicalThreePulseCollision(boundaryCat,word.map(j=>cat.commands[j]),[zero,zero,s,observations[w],observations[v]],spend);
    });
    const kept=active.length?[...new Set(active.map(t=>t.leaf))].sort((a,b)=>a-b):[0];
    need(kept.length<=4,'support exceeds four leaves');
    return {radius:fmt(error),kept,lower:active.map(t=>({...t,leaf:kept.indexOf(t.leaf)})),jumps,
      boundary:{observations:observations.map(fmt),worlds}};
  }
}
