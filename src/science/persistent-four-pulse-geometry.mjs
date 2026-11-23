/** Exact fourth-pulse decision geometry in the three observation contrasts. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';

const {Q, Z, add, sub, mul, div, fmt} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
export const compare = (a,b) => a.n*b.d < b.n*a.d ? -1 : a.n*b.d > b.n*a.d ? 1 : 0;
export const minimum = (a,b) => compare(a,b)<=0 ? a : b;
export const maximum = (a,b) => compare(a,b)>=0 ? a : b;
export const midpoint = (a,b) => div(add(a,b),Q(2n));
export const contains = ([a,b],x) => compare(a,x)<=0 && compare(x,b)<=0;
const times = (n,v) => mul(Q(BigInt(n)),v);
const equalPoint = (p,q) => compare(p[0],q[0])===0 && compare(p[1],q[1])===0;
const dot = (v,w) => v.reduce((n,x,i)=>n+x*w[i],0);
const cross = ([x,y,z],[a,b,c]) => [y*c-z*b,z*a-x*c,x*b-y*a];
const generators=[[1,2,3],[-2,-3,-4],[1,0,0],[0,1,0],[0,0,1]];
function gcd(a,b){return b?gcd(b,a%b):Math.abs(a);}
const normals=new Map();
for(let i=0;i<generators.length;i++) for(let j=0;j<i;j++){
  const raw=cross(generators[i],generators[j]);
  const divisor=raw.reduce(gcd,0);
  if(!divisor)continue;
  for(const sign of [-1,1]){
    const v=raw.map(x=>sign*x/divisor);
    normals.set(v.join(','),{v,width:generators.reduce((s,g)=>s+Math.abs(dot(v,g)),0)});
  }
}
export function fourPulseCenter([a,b,c,d]) {
  const s=sub(b,a),t=add(s,sub(c,a));
  return [s,t,add(t,sub(d,a))];
}
function halfspaces(center,error) {
  return [...normals.values()].map(({v,width})=>({
    v, bound:v.reduce((s,n,k)=>add(s,times(n,center[k])),times(width,error)),
  }));
}
function uniquePoints(ps) {
  const seen=new Set();
  return ps.filter(p=>{
    const key=p.map(fmt).join(',');
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function clip(points,a,b,cap) {
  if(!points.length)return [];
  const residual=([x,y])=>sub(cap,add(times(a,x),times(b,y)));
  const result=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];
    const v=residual(p),w=residual(q);
    if(v.n>=0n)result.push(p);
    if((v.n<0n && w.n>0n)||(v.n>0n && w.n<0n)){
      const fraction=div(v,sub(v,w));
      result.push(p.map((x,k)=>add(x,mul(fraction,sub(q[k],x)))));
    }
  }
  return uniquePoints(result);
}
export function pairFourPulseProjection(left,right,error) {
  // Retain each normal once. A translated noise zonotope has the same
  // facet normals under every law; pair intersection takes the tighter cap.
  const first=halfspaces(left,error),second=halfspaces(right,error);
  const planes=first.map(({v,bound},i)=>({v,bound:minimum(bound,second[i].bound)}));
  const lows=planes.filter(p=>p.v[2]<0), highs=planes.filter(p=>p.v[2]>0);
  const x0=sub(maximum(left[0],right[0]),times(4,error)), x1=add(minimum(left[0],right[0]),times(4,error));
  const y0=sub(maximum(left[1],right[1]),times(6,error)), y1=add(minimum(left[1],right[1]),times(6,error));
  if(compare(x0,x1)>0 || compare(y0,y1)>0)return null;
  let polygon=uniquePoints([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  const cuts=new Map();
  function cut(a,b,cap){
    const d=gcd(Math.abs(a),Math.abs(b))||1,key=[a/d,b/d].join(',');
    const bound=div(cap,Q(BigInt(d)));
    const old=cuts.get(key);
    if(!old || compare(bound,old.bound)<0)cuts.set(key,{a:a/d,b:b/d,bound});
  }
  for(const p of planes)if(p.v[2]===0)cut(p.v[0],p.v[1],p.bound);
  // Eliminate w. Each positive combination cancels w and compares one
  // lower bound with one upper bound. Include equality throughout.
  for(const l of lows)for(const h of highs){
    const m=h.v[2],n=-l.v[2];
    cut(m*l.v[0]+n*h.v[0],m*l.v[1]+n*h.v[1],add(times(m,l.bound),times(n,h.bound)));
  }
  for(const {a,b,bound} of cuts.values()){
    polygon=clip(polygon,a,b,bound);
    if(!polygon.length)return null;
  }
  return {polygon,planes};
}
export function commonFourthReading(planes,s,t) {
  const lower=planes.filter(p=>p.v[2]<0).map(({v,bound})=>
    div(sub(sub(bound,times(v[0],s)),times(v[1],t)),Q(BigInt(v[2]))));
  return lower.reduce(maximum);
}
export function section(polygon,x) {
  const ys=[];
  for(let i=0;i<polygon.length;i++){
    const [a,b]=polygon[i],[c,d]=polygon[(i+1)%polygon.length];
    if(compare(a,x)===0)ys.push(b);
    if(compare(a,c)===0 || !contains([minimum(a,c),maximum(a,c)],x))continue;
    ys.push(add(b,mul(div(sub(x,a),sub(c,a)),sub(d,b))));
  }
  return ys.length?[ys.reduce(minimum),ys.reduce(maximum)]:null;
}
export function sortedCuts(xs) {
  const values=xs.slice().sort(compare);
  return values.filter((s,i)=>i===0 || compare(s,values[i-1])!==0);
}
export function mergedBands(bands) {
  const sorted=bands.slice().sort((a,b)=>compare(a[0],b[0])||compare(a[1],b[1]));
  const union=[];
  for(const [lo,hi] of sorted){
    const last=union.at(-1);
    if(last && compare(lo,last[1])<=0)last[1]=maximum(last[1],hi);
    else union.push([lo,hi]);
  }
  return union;
}
function intersect(left,right) {
  const out=[];
  let i=0,j=0;
  while(i<left.length && j<right.length){
    const lo=maximum(left[i][0],right[j][0]),hi=minimum(left[i][1],right[j][1]);
    if(compare(lo,hi)<=0)out.push([lo,hi]);
    if(compare(left[i][1],right[j][1])<0)i++;else j++;
  }
  return out;
}
// A prefix t defeats the entire final menu precisely when it is inside at
// least one pair polygon for each possible final command.
export function trappedSections(byFinal,s) {
  let common=null;
  for(const pairs of byFinal){
    const band=mergedBands(pairs.map(p=>section(p.polygon,s)).filter(Boolean));
    common=common===null?band:intersect(common,band);
    if(!common.length)break;
  }
  return common??[];
}
function boundaryCuts(polygons) {
  const xs=[],edges=new Map();
  for(const poly of polygons)for(let i=0;i<poly.length;i++){
    const [a,b]=poly[i],[c,d]=poly[(i+1)%poly.length];xs.push(a);
    if(compare(a,c)===0)continue;
    const slope=div(sub(d,b),sub(c,a)),offset=sub(b,mul(slope,a));
    const range=[minimum(a,c),maximum(a,c)];
    edges.set([slope,offset,...range].map(fmt).join(','),{slope,offset,range});
  }
  const lines=[...edges.values()];
  for(let j=1;j<lines.length;j++)for(let i=0;i<j;i++){
    const p=lines[i],q=lines[j];
    if(compare(p.slope,q.slope)===0)continue;
    const x=div(sub(q.offset,p.offset),sub(p.slope,q.slope));
    if(contains(p.range,x)&&contains(q.range,x))xs.push(x);
  }
  return sortedCuts(xs);
}
export function unsafeThirdBands(byFinal) {
  if(byFinal.some(pairs=>!pairs.length))return [];
  const cuts=boundaryCuts(byFinal.flatMap(pairs=>pairs.map(p=>p.polygon)));
  const bands=[];
  for(let i=0;i<cuts.length;i++){
    const lo=cuts[i],hi=cuts[i+1];
    if(trappedSections(byFinal,lo).length)bands.push([lo,lo]);
    if(hi && trappedSections(byFinal,midpoint(lo,hi)).length)bands.push([lo,hi]);
  }
  // Finite unions/intersections of these compact polygons have closed
  // projections. A trapped open slab therefore includes its endpoints.
  return mergedBands(bands);
}
