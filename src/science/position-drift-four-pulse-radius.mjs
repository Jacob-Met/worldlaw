/** Robust four-pulse experiment design for two persistent finite-vertex rate families. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare,maximum} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,receiveChosenRateTape} from './position-drift-rate-polytopes.mjs';
import {prepareThreePulseHullRequest,physicalThreePulseCollision} from './position-drift-three-pulse-hulls.mjs';
import {verifyRateHullCollision} from './position-drift-three-pulse-radius.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const zero=Z(),one=Q(1n),zeros=n=>Array(n).fill(zero);
const absolute=x=>x.n<0n?neg(x):x;
const generators=[[1,2,3],[-2,-3,-4],[1,0,0],[0,1,0],[0,0,1]].map(v=>v.map(x=>Q(BigInt(x))));
const dot=(x,y)=>x.reduce((s,v,i)=>v.n&&y[i].n?add(s,mul(v,y[i])):s,zero);
const cross=(x,y)=>[0,1,2].map(i=>sub(mul(x[(i+1)%3],y[(i+2)%3]),mul(x[(i+2)%3],y[(i+1)%3])));
const need=(ok,msg)=>{if(!ok)throw Error('Four-pulse noise certificate: '+msg);};
const modes=['fixed','late','early','full'];
const lengthFor=mode=>mode==='fixed'?4:mode==='late'?3:2;
export const FOUR_PULSE_RADIUS='worldlaw.position-drift-four-pulse-noise-certificate/v1';

function cleanPoints(vertices,word,spend){
  return vertices.map(row=>{
    spend();let displacement=zero;
    return word.slice(1).map(c=>displacement=add(displacement,sub(row[c],row[word[0]])));
  });
}
function support(points,n,spend){
  const h=points.map(p=>{spend();return dot(p,n);}).reduce(maximum);
  return {h,r:generators.reduce((s,g)=>add(s,absolute(dot(g,n))),zero)};
}

// For positive noise, a true supporting facet has two independent tangent
// directions from the exposed clean face and the orthogonal error generators.
function facetSupport(points,n,spend){
  let h=null,exposed=[];
  for(const p of points){
    spend();const value=dot(p,n),order=h===null?1:compare(value,h);
    if(order>0){h=value;exposed=[p];}else if(!order)exposed.push(p);
  }
  let r=zero;const tangents=[];
  for(const g of generators){
    const t=dot(n,g);r=add(r,absolute(t));if(!t.n)tangents.push(g);
  }
  for(const p of exposed.slice(1))tangents.push(p.map((x,i)=>sub(x,exposed[0][i])));
  let first=null;
  for(const t of tangents){
    spend();if(!t.some(x=>x.n))continue;
    if(!first)first=t;else if(cross(first,t).some(x=>x.n))return {h,r};
  }
  return null;
}

function leafFacets(cat,word,spend,facetsOnly=false){
  const tight=new Map();
  cat.vertices.forEach((vertices,law)=>{
    const points=cleanPoints(vertices,word,spend),directions=generators.slice();
    for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){
      spend();directions.push(points[i].map((v,t)=>sub(v,points[j][t])));
    }
    const normals=new Map();
    for(let i=0;i<directions.length;i++)for(let j=0;j<i;j++){
      spend();const vector=cross(directions[i],directions[j]),pivot=vector.find(x=>x.n);
      if(pivot){const normal=vector.map(x=>div(x,pivot));normals.set(normal.map(fmt).join(','),normal);}
    }
    for(const normal of normals.values())for(const n of [normal,normal.map(neg)]){
      const key=n.map(fmt).join(','),bound=facetsOnly?facetSupport(points,n,spend):support(points,n,spend),old=tight.get(key);
      if(!bound)continue;
      if(!old||compare(bound.h,old.h)<0)tight.set(key,{n,...bound,law});
    }
  });
  return [...tight.values()];
}

function courseTree(cat,prefix,mode,spend,menu=null){
  const commands=cat.commands.map((_,i)=>i),nodes=new Map(),leaves=[];
  function node(key){if(!nodes.has(key))nodes.set(key,nodes.size);return nodes.get(key);}
  const thirds=menu?menu.map(branch=>branch.third):prefix.length>=3?[prefix[2]]:commands;
  for(const [i,b] of thirds.entries())for(const c of (menu?menu[i].last:prefix.length===4?[prefix[3]]:commands)){
    spend();const word=[prefix[0],prefix[1],b,c];
    // An early-only experiment commits (b,c) together. Its adversary can
    // supply a different intermediate reading for each already-chosen suffix.
    const coordinates=[node('s'),node(mode==='early'?'w:'+b+','+c:'w:'+b),node('v:'+b+','+c)];
    leaves.push({word,coordinates});
  }
  return {leaves,width:nodes.size};
}
function eachPrefix(cat,mode,visit,spend,prefix=[]){
  spend();if(prefix.length===lengthFor(mode)){visit(prefix);return;}
  cat.commands.forEach((_,i)=>eachPrefix(cat,mode,visit,spend,[...prefix,i]));
}

// Solve the support dual from its feasible zero solution. Pairing each
// equality with its negative supplies an initial slack basis without phase I.
// Entering and leaving indices follow Bland's rule, including zero-ratio ties.
function solveTree(rows,width,spend){
  const size=2*width+1,count=rows.length,cols=rows.map(row=>{
    const col=[];
    row.terms.forEach(([i,t])=>{if(t.n)col.push([i,t],[width+i,neg(t)]);});
    col.push([size-1,row.r]);return col;
  });
  for(let i=0;i<size;i++)cols.push([[i,one]]);
  const costs=[...rows.map(row=>neg(row.h)),...zeros(size)],basis=Array.from({length:size},(_,i)=>count+i);
  const inverse=Array.from({length:size},(_,i)=>{spend();const row=zeros(size);row[i]=one;return row;});
  const values=zeros(size);values[size-1]=one;
  let prices=zeros(size);
  const colDot=(row,col)=>col.reduce((s,[i,x])=>row[i].n?add(s,mul(row[i],x)):s,zero);
  for(;;){
    let enter=-1,improvement=zero;
    for(let j=0;j<cols.length;j++){
      spend();const gain=sub(costs[j],colDot(prices,cols[j]));
      if(gain.n>0n){enter=j;improvement=gain;break;}
    }
    if(enter<0){
      const coordinates=Array.from({length:width},(_,i)=>sub(prices[i+width],prices[i]));
      return {radius:prices[size-1],coordinates,dual:basis.flatMap((j,i)=>j<count&&values[i].n?[[j,values[i]]]:[])};
    }
    const direction=inverse.map(row=>{spend();return colDot(row,cols[enter]);});
    let leave=-1,ratio;
    direction.forEach((v,i)=>{
      if(v.n<=0n)return;
      const candidate=div(values[i],v),order=leave<0?-1:compare(candidate,ratio);
      if(order<0||(!order&&basis[i]<basis[leave])){leave=i;ratio=candidate;}
    });
    need(leave>=0,'unbounded support dual');
    const row=inverse[leave].map(x=>x.n?div(x,direction[leave]):zero);
    inverse[leave]=row;values[leave]=ratio;
    for(let i=0;i<size;i++)if(i!==leave&&direction[i].n){
      spend();const factor=direction[i];
      inverse[i]=inverse[i].map((x,j)=>row[j].n?sub(x,mul(factor,row[j])):x);
      if(ratio.n)values[i]=sub(values[i],mul(factor,ratio));
    }
    prices=prices.map((v,i)=>row[i].n?add(v,mul(improvement,row[i])):v);
    basis[leave]=enter;
  }
}
function certifyCourse(cat,prefix,mode,facets,spend,menu=null){
  const tree=courseTree(cat,prefix,mode,spend,menu),rows=[];
  tree.leaves.forEach(({word,coordinates},leaf)=>{
    const key=word.join(',');
    if(!facets.has(key))facets.set(key,leafFacets(cat,word,spend));
    for(const f of facets.get(key)){
      spend();rows.push({...f,leaf,terms:f.n.map((v,j)=>[coordinates[j],v])});
    }
  });
  const {radius,coordinates,dual}=solveTree(rows,tree.width,spend);
  need(radius.n>=0n,'negative failure radius');
  const atBoundary={...cat,error:radius};
  const worlds=tree.leaves.map(({word,coordinates:ids})=>physicalThreePulseCollision(atBoundary,
    word.map(i=>cat.commands[i]),[zero,zero,...ids.map(i=>coordinates[i])],spend));
  const lower=radius.n?dual.map(([i,w])=>({leaf:rows[i].leaf,law:cat.ids[rows[i].law],normal:rows[i].n.map(fmt),weight:fmt(w)})):[];
  return {prefix:prefix.map(i=>cat.commands[i]),radius:fmt(radius),lower,observations:coordinates.map(fmt),worlds};
}
export function certifyFourPulseNoiseRadius(request){
  const {cat,canonical,control}=prepareThreePulseHullRequest(request),work=rateWorkBudget(canonical.limits.designWork);
  const base={schema:FOUR_PULSE_RADIUS,source:canonical,fourPulseControl:control?.slice()??null};
  const facets=new Map(),classes=[];
  try{
    for(const mode of modes){
      const courses=[];let best=null;
      eachPrefix(cat,mode,prefix=>{
        const c=certifyCourse(cat,prefix,mode,facets,work.spend);courses.push(c);
        if(!best||compare(rational(c.radius),rational(best.radius))>0)best=c;
      },work.spend);
      classes.push({mode,radius:best.radius,bestPrefix:best.prefix.slice(),courses,
        atRequestedNoise:compare(cat.error,rational(best.radius))<0?'separates-within-four':'common-history-refutation'});
    }
    return {...base,status:'radius-certified',classes,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}

function unsafeIntermediate(facets,s,error,spend){
  const above=[],below=[];let lo=null,hi=null,possible=true;
  function retain(a,rhs){
    if(!a.n){if(rhs.n<0n)possible=false;return;}
    const edge=div(rhs,a);
    if(a.n<0n)lo=lo===null?edge:maximum(lo,edge);
    else if(hi===null||compare(edge,hi)<0)hi=edge;
  }
  for(const row of facets){
    spend();const [x,a,b]=row.n,rhs=sub(add(row.h,mul(error,row.r)),mul(x,s));
    if(!b.n)retain(a,rhs);
    else{const scale=absolute(b);(b.n>0n?above:below).push([div(a,scale),div(rhs,scale)]);}
  }
  for(const [a,h] of above)for(const [b,k] of below){spend();retain(add(a,b),add(h,k));}
  return possible&&lo&&hi&&compare(lo,hi)<=0?[lo,hi]:null;
}
function commonBands(bands){
  if(bands.some(b=>!b))return false;
  const lo=bands.map(b=>b[0]).reduce(maximum);
  return bands.every(b=>compare(lo,b[1])<=0);
}

/** Choose from projected physical collisions after pinning each actual ancestor. */
export function receiveFourPulseMenu(cat,prefix,menu,readings,spend){
  const ys=readings.map(rational);need(ys.length>=1&&ys.length<=5,'supply one through five consecutive readings');
  let commands=prefix.slice(0,Math.min(2,ys.length-1)),next=ys.length<=2?prefix[ys.length-1]:null;
  const receive=()=>receiveChosenRateTape(cat,commands.map(i=>cat.commands[i]),ys.slice(0,commands.length+1),spend);
  let surviving=receive();
  if(!surviving.length)need(ys.length<=commands.length+1,'reading follows an inconsistent prefix');
  if(ys.length>=3&&surviving.length){
    const s=add(sub(ys[2],mul(Q(2n),ys[1])),ys[0]);
    let branch=null,bands=null;
    for(const option of menu){
      const candidate=option.last.map(c=>unsafeIntermediate(leafFacets(cat,[...prefix,option.third,c],spend),s,cat.error,spend));
      if(!commonBands(candidate)){branch=option;bands=candidate;break;}
    }
    need(branch,'no safe continuation at the supplied prefix');next=branch.third;
    if(ys.length>=4){
      commands.push(next);surviving=receive();next=null;
      if(!surviving.length)need(ys.length<=commands.length+1,'reading follows an inconsistent intermediate record');
      if(surviving.length){
        const w=add(sub(ys[3],mul(Q(3n),ys[1])),mul(Q(2n),ys[0]));
        const j=bands.findIndex(b=>!b||compare(w,b[0])<0||compare(w,b[1])>0);
        need(j>=0,'no safe last command at the supplied intermediate reading');next=branch.last[j];
        if(ys.length===5){commands.push(next);surviving=receive();next=null;need(surviving.length<=1,'both families survived the certified menu');}
      }
    }
  }
  return {status:'received',commands:commands.map(i=>cat.commands[i]),nextCommand:surviving.length&&next!==null?cat.commands[next]:null,surviving};
}

function verifyCourse(cat,prefix,mode,saved,spend,menu=null){
  const radius=rational(saved.radius),tree=courseTree(cat,prefix,mode,spend,menu);
  need(radius.n>=0n&&equalPositionDriftData(saved.prefix,prefix.map(j=>cat.commands[j])),'invalid ordered prefix or radius');
  const observed=saved.observations.map(rational);
  need(observed.length===tree.width&&saved.worlds.length===tree.leaves.length,'missing shared observations or physical worlds');
  tree.leaves.forEach(({word,coordinates},i)=>{
    verifyRateHullCollision(cat,word.map(j=>cat.commands[j]),[zero,zero,...coordinates.map(j=>observed[j])],radius,saved.worlds[i],spend);
  });
  verifySupport(cat,tree,radius,saved.lower,spend);
}
function verifySupport(cat,tree,radius,lower,spend){
  const balance=zeros(tree.width);let h=zero,r=zero;
  need(Array.isArray(lower)&&lower.length<=Math.max(8,2*tree.width+1),'invalid supporting terms');
  if(!radius.n){need(!lower.length,'zero radius uses nonnegative noise');return;}
  for(const t of lower){
    spend();const law=cat.ids.indexOf(t.law),leaf=tree.leaves[t.leaf];
    need(Number.isSafeInteger(t.leaf)&&leaf&&law>=0&&Array.isArray(t.normal)&&t.normal.length===3,'invalid support reference');
    const n=t.normal.map(rational),weight=rational(t.weight);need(weight.n>0n&&n.some(x=>x.n),'invalid normal or weight');
    const bound=support(cleanPoints(cat.vertices[law],leaf.word,spend),n,spend);
    leaf.coordinates.forEach((j,i)=>balance[j]=add(balance[j],mul(weight,n[i])));
    h=add(h,mul(weight,bound.h));r=add(r,mul(weight,bound.r));
  }
  need(balance.every(x=>!x.n)&&r.n>0n&&!add(h,mul(radius,r)).n,'weights do not cancel the actual ancestral coordinates at this radius');
}
export function verifyFourPulseNoiseRadius(request,saved){
  const {cat,canonical,control}=prepareThreePulseHullRequest(request),work=rateWorkBudget(canonical.limits.designWork);
  need(saved?.schema===FOUR_PULSE_RADIUS&&equalPositionDriftData(saved.source,canonical)&&equalPositionDriftData(saved.fourPulseControl,control),
    'certificate source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(certifyFourPulseNoiseRadius(request),saved),'unreproducible exhaustion');return true;
  }
  need(saved.status==='radius-certified'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=canonical.limits.designWork&&
    saved.classes.length===modes.length,'incomplete class results');
  try{
    modes.forEach((mode,i)=>{
      const record=saved.classes[i];need(record.mode===mode&&record.courses.length===cat.commands.length**lengthFor(mode),'incomplete policy class');
      let index=0,best=null;
      eachPrefix(cat,mode,prefix=>{
        const course=record.courses[index++];verifyCourse(cat,prefix,mode,course,work.spend);
        if(!best||compare(rational(course.radius),rational(best.radius))>0)best=course;
      },work.spend);
      need(record.radius===best.radius&&equalPositionDriftData(record.bestPrefix,best.prefix)&&record.atRequestedNoise===
        (compare(cat.error,rational(best.radius))<0?'separates-within-four':'common-history-refutation'),'incorrect class radius or noise verdict');
    });
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Four-pulse noise certificate verification exceeded the source work budget');}
  return true;
}

export {courseTree as fourPulseCourseTree};
export function buildFourPulseMenuProof(cat,prefix,menu,spend){return certifyCourse(cat,prefix,'full',new Map(),spend,menu);}
export function checkFourPulseMenuProof(cat,prefix,menu,saved,spend){return verifyCourse(cat,prefix,'full',saved,spend,menu);}

export function fourPulseSourceSupport(cat,word,law,normal,spend){return support(cleanPoints(cat.vertices[law],word,spend),normal,spend);}

export function buildFourPulseCutProof(cat,prefix,mode,spend){return certifyCourse(cat,prefix,mode,new Map(),spend);}
export function checkFourPulseCutProof(cat,prefix,mode,saved,spend){return verifyCourse(cat,prefix,mode,saved,spend);}

export function fourPulseLeafFacets(cat,word,spend){return leafFacets(cat,word,spend,true);}
export function verifyFourPulseMenuSupport(cat,prefix,menu,radius,lower,spend){
  return verifySupport(cat,courseTree(cat,prefix,'full',spend,menu),radius,lower,spend);
}

export {solveTree as solvePhysicalSupportProgram};
