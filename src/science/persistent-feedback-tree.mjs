/** Shared original-position physics and causal reception for finite command trees. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,mixRateRows,receiveChosenRateTape} from './position-drift-rate-polytopes.mjs';
import {verifyRateHullCollision} from './position-drift-three-pulse-radius.mjs';
import {transportFeedbackDual} from './feedback-dual-transport.mjs';
import {solvePhysicalSupportProgram} from './position-drift-four-pulse-radius.mjs';

const {Q,Z,add,sub,mul,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const zero=Z(),one=Q(1n),need=(ok,msg)=>{if(!ok)throw Error('Feedback tree: '+msg);};

export function parsePulseTree(program,cat,horizon){
  const index=name=>{const i=cat.commands.indexOf(name);need(i>=0,'unexpected command');return i;};
  const leaves=[];
  function visit(node,before){
    need(node&&typeof node==='object'&&!Array.isArray(node)&&Object.keys(node).every(k=>['commands','alternatives'].includes(k))&&
      Array.isArray(node.commands)&&node.commands.length>0,'supply a nonempty command segment');
    const word=[...before,...node.commands.map(index)];
    need(word.length<=horizon&&(before.length||word.length>=2),'start with at least two commands and respect the pulse horizon');
    const result={commands:node.commands.slice()};
    if(node.alternatives!==undefined){
      need(word.length<horizon&&Array.isArray(node.alternatives)&&node.alternatives.length>0,'invalid continuations');
      const choices=node.alternatives.map(b=>b?.commands?.[0]);need(new Set(choices).size===choices.length,'third or later sibling commands must be distinct');
      result.alternatives=node.alternatives.map(child=>visit(child,word));
    }else{need(word.length===horizon,'all terminal paths must end at the declared horizon');leaves.push(word);}
    return result;
  }
  return {program:visit(program,[]),leaves};
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
export function buildPhysicalTreeProof(cat,leaves,spend){
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
export function checkPhysicalTreeProof(cat,leaves,proof,spend){
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

function normalize(ys){
  if(ys.length<2)return ys.map(()=>zero);
  const slope=sub(ys[1],ys[0]);return ys.map((y,i)=>sub(sub(y,ys[0]),mul(Q(BigInt(i)),slope)));
}
// For two retained words the verified lower proof splits into two necessary
// collision inequalities. At least one is violated below the certified radius.
function chooseFromTwoWordProof(cat,words,proof,pinned,spend){
  const {nodes,rows}=physicalProgram(cat,words,[],spend);
  const perWord=rows.length/2;
  need(words.length===2&&Number.isInteger(perWord),'expected two complete words');
  const known=new Map();
  for(let t=2;t<pinned.length;t++)known.set(nodes.get(observedHistory(words[0],t)),pinned[t]);
  const coefficients=[new Map(),new Map()],violations=[zero,zero];
  for(const [rowIndex,rawWeight] of proof.lower){
    const word=Math.floor(rowIndex/perWord),row=rows[rowIndex],weight=rational(rawWeight);
    violations[word]=sub(violations[word],mul(weight,add(row.h,mul(row.r,cat.error))));
    for(const [id,coefficient] of row.terms){
      spend();
      const sums=coefficients[word];
      sums.set(id,add(sums.get(id)??zero,mul(weight,coefficient)));
    }
  }
  for(let word=0;word<2;word++)for(const [id,coefficient] of coefficients[word]){
    if(!coefficient.n)continue;
    need(known.has(id),'branch inequality depends on an unobserved coordinate');
    violations[word]=add(violations[word],mul(coefficient,known.get(id)));
  }
  const selected=compare(violations[0],violations[1])>0?0:1;
  need(violations[selected].n>0n,'neither certified branch inequality is violated');
  return words[selected][pinned.length-1];
}

export function receivePhysicalTree(cat,leaves,radius,receiverWork,values,twoWordProof=null){
  const work=rateWorkBudget(receiverWork),horizon=leaves[0].length;
  need(compare(cat.error,rational(radius))<0,'the exhibited tree has no guaranteed separation at this bound');
  need(Array.isArray(values)&&values.length>0&&values.length<=horizon+1,'supply consecutive positions within the declared horizon');
  const ys=values.map(rational),pinned=normalize(ys),commands=[];
  let paths=leaves,next=null,surviving;
  try{
    for(let t=0;t<ys.length;t++){
      surviving=receiveChosenRateTape(cat,commands.map(i=>cat.commands[i]),ys.slice(0,t+1),work.spend);
      if(!surviving.length){need(t===ys.length-1,'extra readings follow an inconsistent course');next=null;break;}
      if(t===horizon){need(surviving.length<=1,'two families survived the guaranteed tree');next=null;break;}
      const choices=[...new Set(paths.map(word=>word[t]))];
      if(choices.length===1)next=choices[0];
      else if(twoWordProof)next=chooseFromTwoWordProof(cat,paths,twoWordProof,pinned.slice(0,t+1),work.spend);
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

export function compactPhysicalTree(cat,leaves,proof,spend){
  const raw=physicalProgram(cat,leaves,[],spend),radius=rational(proof.radius);
  const perLeaf=raw.rows.length/leaves.length;
  need(Number.isSafeInteger(perLeaf),'inconsistent leaf rows');
  const leafAt=i=>Math.floor(i/perLeaf);
  let selected={leaves:[0],lower:[]};
  if(radius.n){
    const lower=proof.lower.map(([i,w])=>[i,rational(w)]);
    const used=new Set(lower.flatMap(([i])=>raw.rows[i].terms.filter(([,v])=>v.n).map(([j])=>j)));
    const privateIds=[...used].filter(i=>i>=raw.nodes.size).sort((a,b)=>a-b);
    const reads=[...raw.nodes].filter(([,i])=>used.has(i)).map(([key,i])=>[key.split(',').length,i])
      .sort((a,b)=>b[0]-a[0]||a[1]-b[1]).map(([,i])=>i);
    selected=transportFeedbackDual(raw.rows,lower,[...privateIds,...reads],radius,leafAt,spend);
  }
  const kept=selected.leaves,words=kept.map(i=>leaves[i]),small=physicalProgram(cat,words,[],spend);
  need(kept.length<=2**(leaves[0].length-2),'scalar ancestry leaf bound exceeded');
  const remap=new Map(kept.map((i,j)=>[i,j]));
  const compact={radius:proof.radius,observations:[...small.nodes.keys()].map(k=>proof.observations[raw.nodes.get(k)]),
    worlds:kept.map(i=>proof.worlds[i]),lower:selected.lower.map(([i,w])=>[remap.get(leafAt(i))*perLeaf+i%perLeaf,w])};
  checkPhysicalTreeProof(cat,words,compact,spend);
  return {kept,proof:compact};
}
