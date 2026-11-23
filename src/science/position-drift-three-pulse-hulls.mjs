/** Complete two- and three-pulse search over two persistent convex rate families. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {compare,minimum,maximum,midpoint,contains,section} from './persistent-four-pulse-geometry.mjs';
import {planarPointHull} from './position-drift-planar-suffix.mjs';
import {parseRatePolytopeSource,rateWorkBudget,RATE_WORK_EXHAUSTED,receiveChosenRateTape,primitiveRateInequality,mixRateRows} from './position-drift-rate-polytopes.mjs';
import {intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';
const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),two=Q(2n),three=Q(3n);
const need=(ok,msg)=>{if(!ok)throw Error('Continuous three-pulse planner: '+msg);};
export const THREE_HULL_SOURCE='worldlaw.position-drift-three-pulse-hulls/v1';
export const THREE_HULL_PLAN='worldlaw.position-drift-three-pulse-hull-policy/v1';

function prepare(request){
  need(request?.schema===THREE_HULL_SOURCE&&Object.keys(request).sort().join(',')==='catalog,fourPulseControl,schema',
    'supply a binary catalog and an optional four-pulse fixed control');
  const cat=parseRatePolytopeSource(request.catalog),control=request.fourPulseControl;
  need(cat.ids.length===2&&(control===null||(Array.isArray(control)&&control.length===4&&control.every(c=>cat.commands.includes(c)))),
    'use two families and either four known control commands or null');
  const canonical={schema:request.catalog.schema,commands:cat.commands.slice(),noiseBound:fmt(cat.error),limits:{...request.catalog.limits},
    laws:cat.ids.map((id,i)=>({id,vertices:cat.vertices[i].map(row=>row.map(fmt))}))};
  return {cat,control,canonical};
}
const minus=(p,q)=>p.map((v,i)=>sub(v,q[i]));
const cross=(p,q)=>sub(mul(p[0],q[1]),mul(p[1],q[0]));
const turn=(a,b,c)=>cross(minus(b,a),minus(c,a));
const between=(x,a,b)=>contains([minimum(a,b),maximum(a,b)],x);
function inside(poly,p,spend){
  if(poly.length===1)return p.every((x,i)=>compare(x,poly[0][i])===0);
  if(poly.length===2)return turn(poly[0],poly[1],p).n===0n&&p.every((x,i)=>between(x,poly[0][i],poly[1][i]));
  return poly.every((a,i)=>{spend();return turn(a,poly[(i+1)%poly.length],p).n>=0n;});
}
// Convex intersection vertices are contained input vertices or edge crossings.
// Collinear contacts are already among the contained endpoints.
function overlapAxis(A,B,spend){
  let lo=null,hi=null;
  function include(x){lo=lo===null?x:minimum(lo,x);hi=hi===null?x:maximum(hi,x);}
  for(const p of A)if(inside(B,p,spend))include(p[0]);
  for(const p of B)if(inside(A,p,spend))include(p[0]);
  const edgeCount=poly=>poly.length<=2?poly.length-1:poly.length;
  for(let i=0;i<edgeCount(A);i++)for(let j=0;j<edgeCount(B);j++){
    spend();const a=A[i],b=B[j],u=minus(A[(i+1)%A.length],a),v=minus(B[(j+1)%B.length],b);
    const determinant=cross(u,v);if(!determinant.n)continue;
    const d=minus(b,a),s=div(cross(d,v),determinant),t=div(cross(d,u),determinant);
    if(contains([Z(),one],s)&&contains([Z(),one],t))include(add(a[0],mul(s,u[0])));
  }
  return lo===null?null:[lo,hi];
}
function noiseImage(error,spend){
  const points=[];
  for(let mask=0;mask<16;mask++){
    spend();const [a,b,c,d]=Array.from({length:4},(_,i)=>mask&(1<<i)?error:neg(error));
    points.push([add(sub(c,mul(two,b)),a),add(sub(d,mul(three,b)),mul(two,a))]);
  }
  return planarPointHull(points,spend);
}
function reachable(vertices,p,a,b,noise,spend){
  const points=[];
  for(const row of vertices){
    const z=sub(row[a],row[p]),w=add(z,sub(row[b],row[p]));
    for(const [s,t] of noise){spend();points.push([add(z,s),add(w,t)]);}
  }
  return planarPointHull(points,spend);
}
function joint(bands){
  if(bands.some(x=>x===null))return null;
  const lo=bands.map(b=>b[0]).reduce(maximum),hi=bands.map(b=>b[1]).reduce(minimum);
  return compare(lo,hi)<=0?[lo,hi]:null;
}
function physical(cat,commands,values,spend){
  const worlds=receiveChosenRateTape(cat,commands,values,spend);
  need(worlds.length===2,'both persistent worlds must fit a reported collision');
  return worlds.map(w=>{
    const rates=mixRateRows(cat.vertices[cat.ids.indexOf(w.law)],w.weightWitness.map(rational));
    const [p,v]=w.initialWitness.map(rational),clean=[p];
    for(const c of commands)clean.push(add(clean.at(-1),add(v,rates[cat.commands.indexOf(c)])));
    need(clean.every((x,i)=>{const e=sub(x,values[i]);return compare(e,cat.error)<=0&&compare(e,neg(cat.error))>=0;}),'raw physical replay failed');
    return {law:w.law,weights:w.weightWitness,start:w.initialWitness,positions:clean.map(fmt)};
  });
}

function checkFour(cat,commands,spend){
  if(!commands)return null;
  const groups=cat.vertices,counts=groups.map(v=>v.length-1),width=counts[0]+counts[1]+2;
  const rows=[],zero=()=>Array.from({length:width},Z);
  const append=(a,b)=>{spend();rows.push(primitiveRateInequality(a,b));};
  let offset=0;
  for(const count of counts){
    const total=zero();
    for(let k=0;k<count;k++){const a=zero();a[offset+k]=neg(one);append(a,Z());total[offset+k]=one;}
    if(count)append(total,one);offset+=count;
  }
  const forces=groups.map(v=>v.map(Z)),radius=mul(two,cat.error);
  for(let t=0;t<=commands.length;t++){
    if(t)groups.forEach((vs,k)=>vs.forEach((row,j)=>{forces[k][j]=add(forces[k][j],row[cat.commands.indexOf(commands[t-1])]);}));
    const [l,r]=forces,base=sub(l.at(-1),r.at(-1));
    const a=[...l.slice(0,-1).map(x=>sub(x,l.at(-1))),...r.slice(0,-1).map(x=>sub(r.at(-1),x)),one,Q(BigInt(t))];
    append(a,sub(radius,base));append(a.map(neg),add(radius,base));
  }
  const fit=intersectFeedbackHalfspaces(rows,width,spend);
  if(fit.proof){
    need(checkFeedbackContradiction(rows,width,fit.proof),'invalid fixed-control contradiction');
    return {commands:commands.slice(),status:'separates',proof:fit.proof.map(([i,w])=>[i,String(w)])};
  }
  const point=fit.point;offset=0;
  const rates=groups.map((vertices,k)=>{
    const weights=point.slice(offset,offset+counts[k]);offset+=counts[k];
    weights.push(sub(one,weights.reduce(add,Z())));return mixRateRows(vertices,weights);
  });
  const pos=[point[width-2],Z()],drift=[point[width-1],Z()],ys=[midpoint(...pos)];
  for(const cmd of commands){for(let k=0;k<2;k++)pos[k]=add(pos[k],add(drift[k],rates[k][cat.commands.indexOf(cmd)]));ys.push(midpoint(...pos));}
  return {commands:commands.slice(),status:'collision',readings:ys.map(fmt),worlds:physical(cat,commands,ys,spend)};
}

export function planThreePulseHulls(request){
  const {cat,control,canonical}=prepare(request),work=rateWorkBudget(canonical.limits.designWork);
  const base={schema:THREE_HULL_PLAN,source:canonical,fourPulseControl:control?.slice()??null};
  try{
    const noise=noiseImage(cat.error,work.spend),trials=[];
    let winning=null,twoPulse=null,fixedThree=null;
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const prefix=[cat.commands[p],cat.commands[a]],prefixBands=cat.vertices.map(vs=>{
        const zs=vs.map(row=>{work.spend();return sub(row[a],row[p]);}).sort(compare);
        const radius=mul(Q(4n),cat.error);return [sub(zs[0],radius),add(zs.at(-1),radius)];
      });
      if(!joint(prefixBands)&&!twoPulse)twoPulse=prefix.slice();
      const polygons=[],unsafe=[];
      for(let b=0;b<cat.commands.length;b++){
        const pair=cat.vertices.map(vs=>reachable(vs,p,a,b,noise,work.spend));
        polygons.push(pair);const band=overlapAxis(...pair,work.spend);unsafe.push(band);
        if(!band&&!fixedThree)fixedThree=[...prefix,cat.commands[b]];
      }
      const trap=joint(unsafe),record={prefix,prefixBands:prefixBands.map(x=>x.map(fmt)),unsafe:unsafe.map(x=>x?.map(fmt)??null),
        trap:trap?.map(fmt)??null};
      if(!trap&&!winning)winning=record;
      trials.push({record,polygons});
    }
    const fixedControl=checkFour(cat,control,work.spend),fixedMinimum=twoPulse?'2':fixedThree?'3':fixedControl?.status==='separates'?'4':null;
    if(twoPulse||winning)return {...base,status:twoPulse?'two-certified':'three-certified',minimumPulses:twoPulse?'2':'3',prefix:twoPulse??winning.prefix,
      unsafe:twoPulse?[]:winning.unsafe,fixedMinimum,fixedTape:twoPulse??fixedThree??(fixedMinimum==='4'?fixedControl.commands:null),fixedControl,
      trials:trials.map(t=>t.record),work:work.used};
    const refusals=trials.map(({record,polygons})=>{
      const s=midpoint(...record.trap.map(rational)),prefixReadings=[Z(),Z(),s];
      const branches=polygons.map(([A,B],i)=>{
        const common=joint([section(A,s),section(B,s)]);need(common,'missing conditional fourth-reading overlap');
        const ys=[...prefixReadings,midpoint(...common)],command=cat.commands[i];
        return {command,reading:fmt(ys.at(-1)),worlds:physical(cat,[...record.prefix,command],ys,work.spend)};
      });
      return {...record,collision:{prefixReadings:prefixReadings.map(fmt),branches}};
    });
    return {...base,status:'three-refuted',minimumPulses:fixedMinimum==='4'?'4':null,fixedMinimum,
      fixedTape:fixedMinimum==='4'?fixedControl.commands:null,fixedControl,trials:refusals,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}

export function receiveThreePulseHulls(plan,values){
  need(['two-certified','three-certified'].includes(plan.status)&&Array.isArray(values)&&values.length>0&&values.length<=Number(plan.minimumPulses)+1,
    'supply consecutive readings of a certified two- or three-pulse course');
  const cat=parseRatePolytopeSource(plan.source),ys=values.map(rational),work=rateWorkBudget(plan.source.limits.receiverWork);
  const prefix=plan.prefix,commands=prefix.slice(0,Math.min(2,ys.length-1));
  let nextCommand=ys.length<=2?prefix[ys.length-1]:null,surviving;
  try{
    surviving=receiveChosenRateTape(cat,commands,ys.slice(0,3),work.spend);
    if(!surviving.length)need(ys.length<=3,'no continuation follows an inconsistent prefix');
    if(surviving.length&&ys.length>=3&&plan.status==='three-certified'){
      const s=add(sub(ys[2],mul(two,ys[1])),ys[0]);
      const choice=plan.unsafe.findIndex(b=>!b||!contains(b.map(rational),s));
      need(choice>=0,'no safe final command at the measured prefix');
      if(ys.length===3)nextCommand=cat.commands[choice];
      else{commands.push(cat.commands[choice]);surviving=receiveChosenRateTape(cat,commands,ys,work.spend);}
    }
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {status:'receiver-budget-exhausted',work:work.used,commands,surviving:null,nextCommand:null};}
  if(!surviving.length)nextCommand=null;
  if(ys.length===Number(plan.minimumPulses)+1)need(surviving.length<=1,'certified horizon retained a pair');
  return {status:'received',work:work.used,commands,surviving,nextCommand};
}

export function replayThreePulseHulls(request,saved){
  const rebuilt=planThreePulseHulls(request);need(equalPositionDriftData(rebuilt,saved),'saved policy or physical collision differs from source');return rebuilt;
}

export {prepare as prepareThreePulseHullRequest,physical as physicalThreePulseCollision};
