/** Unrestricted four-pulse threshold and a separately exhibited five-pulse physical decision tree. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,mixRateRows,receiveChosenRateTape} from './position-drift-rate-polytopes.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {verifyRateHullCollision} from './position-drift-three-pulse-radius.mjs';
import {projectedFourPulseMenu} from './position-drift-four-pulse-projection.mjs';
import {checkFourPulseMenuProof,solvePhysicalSupportProgram} from './position-drift-four-pulse-radius.mjs';

const {Q,Z,add,sub,mul,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const zero=Z(),one=Q(1n),need=(ok,msg)=>{if(!ok)throw Error('Five-pulse certificate: '+msg);};
export const FIVE_PULSE_SOURCE='worldlaw.position-drift-five-pulse-experiment/v1';
const schema='worldlaw.position-drift-five-pulse-minimum-proof/v1';

function prepare(request){
  need(request?.schema===FIVE_PULSE_SOURCE&&Object.keys(request).sort().join(',')==='catalog,program,schema','supply a convex rate catalog and a five-pulse tree');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:request.catalog,fourPulseControl:null});
  const index=name=>{const i=cat.commands.indexOf(name);need(i>=0,'unexpected command');return i;};
  const leaves=[];
  function visit(node,before){
    need(node&&typeof node==='object'&&!Array.isArray(node)&&Object.keys(node).every(k=>['commands','alternatives'].includes(k))&&
      Array.isArray(node.commands)&&node.commands.length>0,'supply a nonempty command segment');
    const word=[...before,...node.commands.map(index)];
    need(word.length<=5&&(before.length||word.length>=2),'start with at least two commands and stop by pulse five');
    const result={commands:node.commands.slice()};
    if(node.alternatives!==undefined){
      need(word.length<5&&Array.isArray(node.alternatives)&&node.alternatives.length>0,'invalid continuations');
      const choices=node.alternatives.map(b=>b?.commands?.[0]);need(new Set(choices).size===choices.length,'third or later sibling commands must be distinct');
      result.alternatives=node.alternatives.map(child=>visit(child,word));
    }else{need(word.length===5,'all terminal paths must have five pulses');leaves.push(word);}
    return result;
  }
  const program=visit(request.program,[]);
  return {cat,leaves,source:{schema:FIVE_PULSE_SOURCE,catalog:canonical,program}};
}
function observedHistory(word,t){return word.slice(0,t).join(',');}

// Coordinates are all normalized positions after tick one that have not been
// pinned, plus each leaf/world's private mixture coordinates, start and drift.
function physicalProgram(cat,leaves,pinned,spend){
  const nodes=new Map(),paths=leaves.map(word=>word.slice(1).map((_,j)=>{
    const tick=j+2,key=observedHistory(word,tick);
    if(tick<pinned.length)return null;
    if(!nodes.has(key))nodes.set(key,nodes.size);return nodes.get(key);
  }));
  let width=nodes.size;const rows=[],states=[];
  const append=(terms,h,r)=>{spend();rows.push({terms,h,r});};
  leaves.forEach((word,leaf)=>{
    const worlds=[];states.push(worlds);
    for(const vertices of cat.vertices){
      const weights=vertices.slice(0,-1).map(()=>width++),position=width++,drift=width++;
      worlds.push({weights,position,drift});
      for(const i of weights)append([[i,neg(one)]],zero,zero);
      if(weights.length)append(weights.map(i=>[i,one]),one,zero);
      const forces=vertices.map(Z);
      for(let t=0;t<=word.length;t++){
        if(t)vertices.forEach((row,i)=>forces[i]=add(forces[i],row[word[t-1]]));
        const base=forces.at(-1),terms=weights.map((id,i)=>[id,sub(forces[i],base)]);
        terms.push([position,one],[drift,Q(BigInt(t))]);
        let reading=zero;
        if(t>=2){
          if(t<pinned.length)reading=pinned[t];
          else terms.push([paths[leaf][t-2],neg(one)]);
        }
        const h=sub(reading,base);
        append(terms,h,one);append(terms.map(([id,x])=>[id,neg(x)]),neg(h),one);
      }
    }
  });
  return {nodes,paths,states,width,rows};
}
function fiveProof(cat,leaves,spend){
  const {nodes,states,width,rows}=physicalProgram(cat,leaves,[],spend);
  const solution=solvePhysicalSupportProgram(rows,width,spend),x=solution.coordinates,radius=solution.radius;
  need(radius.n>=0n,'negative tree radius');
  const observations=x.slice(0,nodes.size),worlds=leaves.map((word,i)=>states[i].map((w,law)=>{
    const weights=w.weights.map(j=>x[j]);weights.push(sub(one,weights.reduce(add,zero)));
    const rates=mixRateRows(cat.vertices[law],weights),start=x[w.position],drift=x[w.drift],positions=[start];
    for(const j of word)positions.push(add(positions.at(-1),add(drift,rates[j])));
    return {law:cat.ids[law],weights:weights.map(fmt),start:[fmt(start),fmt(drift)],positions:positions.map(fmt)};
  }));
  return {radius:fmt(radius),observations:observations.map(fmt),worlds,
    lower:radius.n?solution.dual.map(([i,w])=>[i,fmt(w)]).sort((a,b)=>a[0]-b[0]):[]};
}
function checkFive(cat,leaves,proof,spend){
  const {nodes,paths,width,rows}=physicalProgram(cat,leaves,[],spend);
  const radius=rational(proof.radius),obs=proof.observations.map(rational);
  need(radius.n>=0n&&obs.length===nodes.size&&proof.worlds.length===leaves.length,'invalid physical tree dimensions');
  leaves.forEach((word,i)=>verifyRateHullCollision(cat,word.map(j=>cat.commands[j]),[zero,zero,...paths[i].map(j=>obs[j])],radius,proof.worlds[i],spend));
  need(Array.isArray(proof.lower)&&proof.lower.length<=2*width+1,'invalid lower proof size');
  if(!radius.n){need(!proof.lower.length,'zero radius uses the noise domain');return;}
  const balance=Array(width).fill(zero);let h=zero,r=zero,last=-1;
  for(const pair of proof.lower){
    need(Array.isArray(pair)&&pair.length===2,'invalid weighted row');const [i,value]=pair,weight=rational(value);
    need(Number.isSafeInteger(i)&&i>last&&i<rows.length&&weight.n>0n,'invalid positive multiplier');last=i;
    const row=rows[i];for(const [j,c] of row.terms){spend();balance[j]=add(balance[j],mul(weight,c));}
    h=add(h,mul(weight,row.h));r=add(r,mul(weight,row.r));
  }
  need(balance.every(v=>!v.n)&&r.n>0n&&!add(h,mul(radius,r)).n,'physical lower rows do not certify this radius');
}

function fullMenu(cat){return cat.commands.map((_,third)=>({third,last:cat.commands.map((_,i)=>i)}));}
function verdict(error,four,five){
  if(compare(error,four)<0)return 'within-four';
  return compare(error,five)<0?'minimum-five':'four-refuted-exhibited-five-refuted';
}
export function certifyFivePulseMinimum(request){
  const {cat,source,leaves}=prepare(request),work=rateWorkBudget(source.catalog.limits.designWork),base={schema,source};
  try{
    const menu=fullMenu(cat),four=[];let best=null;
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const raw=projectedFourPulseMenu(cat,[p,a],menu,work.spend);
      const course={prefix:[cat.commands[p],cat.commands[a]],radius:raw.radius,kept:raw.kept,lower:raw.lower,boundary:raw.boundary};
      four.push(course);if(!best||compare(rational(course.radius),rational(best.radius))>0)best=course;
    }
    const five=fiveProof(cat,leaves,work.spend),decision=verdict(cat.error,rational(best.radius),rational(five.radius));
    return {...base,status:'horizons-certified',four:{radius:best.radius,bestPrefix:best.prefix.slice(),courses:four},five,
      atRequestedNoise:decision,minimumPulses:decision==='minimum-five'?'5':null,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}
export function verifyFivePulseMinimum(request,saved){
  const {cat,source,leaves}=prepare(request),work=rateWorkBudget(source.catalog.limits.designWork);
  need(saved?.schema===schema&&equalPositionDriftData(saved.source,source),'source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(certifyFivePulseMinimum(request),saved),'unreproducible exhaustion');return true;
  }
  const m=cat.commands.length,menu=fullMenu(cat);
  need(saved.status==='horizons-certified'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=source.catalog.limits.designWork&&
    saved.four.courses.length===m*m,'incomplete unrestricted four-pulse search');
  try{
    let index=0,best=null;
    for(let p=0;p<m;p++)for(let a=0;a<m;a++){
      const course=saved.four.courses[index++],prefix=[cat.commands[p],cat.commands[a]];
      need(equalPositionDriftData(course.prefix,prefix)&&Array.isArray(course.kept)&&course.kept.length>=1&&course.kept.length<=4&&
        course.kept.every((j,i)=>Number.isSafeInteger(j)&&j>=0&&j<m*m&&(!i||j>course.kept[i-1]))&&course.lower.length<=8,'invalid four-pulse prefix support');
      const lower=course.lower.map(term=>{
        need(Number.isSafeInteger(term.leaf)&&term.leaf>=0&&term.leaf<course.kept.length,'unknown retained leaf');
        return {...term,leaf:course.kept[term.leaf]};
      });
      const {observations,worlds}=course.boundary;
      checkFourPulseMenuProof(cat,[p,a],menu,{prefix,radius:course.radius,lower,observations,worlds},work.spend);
      if(!best||compare(rational(course.radius),rational(best.radius))>0)best=course;
    }
    need(saved.four.radius===best.radius&&equalPositionDriftData(saved.four.bestPrefix,best.prefix),'global four-pulse optimum differs');
    checkFive(cat,leaves,saved.five,work.spend);
    const decision=verdict(cat.error,rational(best.radius),rational(saved.five.radius));
    need(saved.atRequestedNoise===decision&&saved.minimumPulses===(decision==='minimum-five'?'5':null),'incorrect minimum-horizon verdict');
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Five-pulse replay exceeded the supplied design budget');}
  return true;
}

function normalize(ys){
  if(ys.length<2)return ys.map(()=>zero);
  const slope=sub(ys[1],ys[0]);return ys.map((y,i)=>sub(sub(y,ys[0]),mul(Q(BigInt(i)),slope)));
}
export function receiveFivePulseMinimum(request,saved,values){
  verifyFivePulseMinimum(request,saved);
  const {cat,source,leaves}=prepare(request),work=rateWorkBudget(source.catalog.limits.receiverWork);
  need(saved.status==='horizons-certified'&&compare(cat.error,rational(saved.five.radius))<0,'the exhibited tree has no guaranteed separation at this bound');
  need(Array.isArray(values)&&values.length>0&&values.length<=6,'supply one through six consecutive positions');
  const ys=values.map(rational),pinned=normalize(ys),commands=[];
  let paths=leaves,next=null,surviving;
  try{
    for(let t=0;t<ys.length;t++){
      surviving=receiveChosenRateTape(cat,commands.map(i=>cat.commands[i]),ys.slice(0,t+1),work.spend);
      if(!surviving.length){need(t===ys.length-1,'extra readings follow an inconsistent course');next=null;break;}
      if(t===5){need(surviving.length<=1,'two families survived the guaranteed tree');next=null;break;}
      const choices=[...new Set(paths.map(word=>word[t]))];
      if(choices.length===1)next=choices[0];
      else{
        next=null;
        for(const choice of choices){
          const child=paths.filter(word=>word[t]===choice);
          const program=physicalProgram(cat,child,pinned.slice(0,t+1),work.spend);
          const collision=solvePhysicalSupportProgram(program.rows,program.width,work.spend);
          if(compare(collision.radius,cat.error)>0){next=choice;break;}
        }
        need(next!==null,'no guaranteed next command at the supplied prefix');
      }
      if(t<ys.length-1){commands.push(next);paths=paths.filter(word=>word[t]===next);}
    }
    return {status:'received',commands:commands.map(i=>cat.commands[i]),nextCommand:next===null?null:cat.commands[next],surviving,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {status:'receiver-budget-exhausted',surviving:null,nextCommand:null,work:work.used};}
}
