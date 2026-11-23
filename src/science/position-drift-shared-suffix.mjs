/** One shared prefix history and independent counterfactual pair starts per offered suffix. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {certifyPositionDriftTape} from './persistent-position-drift-multiclass-minimum.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';
import {SUFFIX_PLAN} from './position-drift-suffix-regions.mjs';

const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const two=Q(2n),cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const need=(ok,msg)=>{if(!ok)throw Error('Shared-prefix suffix solver: '+msg);};
const midpoint=(a,b)=>div(add(a,b),two);
const times=(n,x)=>mul(Q(BigInt(n)),x);
export const SHARED_SUFFIX_REQUEST='worldlaw.position-drift-suffix-search-source/v1';

function forces(cat,word,k){
  const out=[Z()];
  for(const u of word)out.push(add(out.at(-1),cat.rates[k][cat.commands.indexOf(u)]));
  return out;
}

function physicalRows(cat,prefix,suffixes,choices,spend,measured){
  // With no readings fixed, a common affine translation lets the first
  // counterfactual world have zero position and drift. For a measured
  // prefix every world's two coordinates must remain free.
  const skip=measured?0:1,width=4*choices.length-2*skip;
  const worlds=choices.flatMap(([a,b],n)=>[a,b].map(k=>({k,force:forces(cat,[...prefix,...suffixes[n]],k)})));
  const rows=[];
  function row(i,j,t,bound){
    spend();
    const a=Array(width).fill(0n);
    for(const [k,sign] of [[i,1n],[j,-1n]])if(k>=skip){
      a[2*(k-skip)]=sign;a[2*(k-skip)+1]=BigInt(t)*sign;
    }
    rows.push(feedbackPrimitive(a,bound));
  }
  function same(i,j,t){
    const diff=sub(worlds[i].force[t],worlds[j].force[t]),diameter=times(2,cat.error);
    row(i,j,t,sub(diameter,diff));row(j,i,t,add(diameter,diff));
  }
  for(let t=0;t<=prefix.length;t++){
    if(measured){
      for(let i=0;i<worlds.length;i++){
        const center=sub(measured[t],worlds[i].force[t]);
        row(i,-1,t,add(cat.error,center));row(-1,i,t,sub(cat.error,center));
      }
    }else for(let j=1;j<worlds.length;j++)for(let i=0;i<j;i++)same(i,j,t);
  }
  for(let n=0;n<choices.length;n++)for(let t=prefix.length+1;t<worlds[2*n].force.length;t++)same(2*n,2*n+1,t);
  return {rows,width,worlds};
}

function refutation(point,physical,cat,prefix){
  const starts=[Z(),Z(),...point],worlds=physical.worlds.map(({k,force},i)=>({
    law:cat.ids[k],start:starts.slice(2*i,2*i+2).map(fmt),
    ys:force.map((f,t)=>add(f,add(starts[2*i],times(t,starts[2*i+1]))))
  }));
  const prefixValues=Array.from({length:prefix.length+1},(_,t)=>{
    const clean=worlds.map(w=>w.ys[t]).sort(cmp);
    return midpoint(clean[0],clean.at(-1));
  });
  const branches=[];
  for(let i=0;i<worlds.length;i+=2){
    const a=worlds[i],b=worlds[i+1],ys=[...prefixValues,...a.ys.slice(prefixValues.length).map((v,j)=>midpoint(v,b.ys[prefixValues.length+j]))];
    for(const w of [a,b])need(ys.every((v,t)=>{
      const diff=sub(v,w.ys[t]),bound=cat.error;
      return (diff.n<0n?-diff.n:diff.n)*bound.d<=bound.n*diff.d;
    }),'a reconstructed collision failed the original measurement bound');
    branches.push({suffix:i/2,readings:ys.map(fmt),worlds:[a,b].map(({law,start})=>({law,start}))});
  }
  return {prefixReadings:prefixValues.map(fmt),branches};
}

function prepare(request){
  need(request?.schema===SHARED_SUFFIX_REQUEST&&Object.keys(request).sort().join(',')==='catalog,limits,prefix,schema,suffixes',
    'supply a finite catalog, a fixed prefix, an equal-length suffix menu and proof budgets');
  const source=structuredClone(request.catalog),cat=parsePositionDriftRates(source,rational),prefix=structuredClone(request.prefix),suffixes=structuredClone(request.suffixes);
  const limits=request.limits,valid=w=>Array.isArray(w)&&w.every(u=>cat.commands.includes(u));
  need(limits&&Object.keys(limits).sort().join(',')==='assignments,linearWork'&&Object.values(limits).every(v=>Number.isSafeInteger(v)&&v>=0),
    'supply nonnegative assignment and linear-work bounds');
  need(cat.ids.length<=8&&valid(prefix)&&prefix.length<=16&&Array.isArray(suffixes)&&suffixes.length>=1&&suffixes.length<=6&&
    suffixes.every(s=>valid(s)&&s.length===suffixes[0].length&&s.length>0&&s.length<=10),
    'offer at most eight laws, sixteen prefix pulses and six equal-length suffixes of up to ten pulses');
  const candidates=suffixes.map(s=>{
    const runs=[...prefix,...s].map(command=>({command,repeats:'1'})),pairs=[];
    for(let j=1;j<cat.ids.length;j++)for(let i=0;i<j;i++){
      const trial=certifyPositionDriftTape({...source,laws:[source.laws[i],source.laws[j]]},runs);
      if(trial.status==='fixed-tape-collision')pairs.push([i,j]);
    }
    return pairs;
  });
  return {source,cat,prefix,suffixes,limits,candidates};
}

export function planSharedSuffix(request){
  const {source,cat,prefix,suffixes,limits,candidates}=prepare(request);
  const work={assignments:0,linearWork:0},exclusions=[];
  const base={schema:SUFFIX_PLAN,source,prefix,suffixes,candidates,limits:{...limits},work,exclusions};
  if(candidates.some(pairs=>!pairs.length))return {...base,status:'suffix-certified'};
  const exhausted=Symbol();
  const spend=kind=>{if(work[kind]>=limits[kind])throw exhausted;work[kind]++;};
  function search(choices){
    if(choices.length){
      spend('assignments');
      const linear=()=>spend('linearWork');
      const phys=physicalRows(cat,prefix,suffixes,choices,linear);
      const r=intersectFeedbackHalfspaces(phys.rows,phys.width,linear);
      if(r.proof){
        need(checkFeedbackContradiction(phys.rows,phys.width,r.proof),'invalid weighted exclusion');
        exclusions.push({choices:choices.map(p=>p.slice()),proof:r.proof.map(([i,w])=>[i,String(w)])});return null;
      }
      if(choices.length===candidates.length)return refutation(r.point,phys,cat,prefix);
    }
    for(const pair of candidates[choices.length]){
      const bad=search([...choices,pair]);if(bad)return bad;
    }
    return null;
  }
  try{
    const collision=search([]);
    return collision?{...base,status:'suffix-refuted',collision}:{...base,status:'suffix-certified'};
  }catch(e){
    if(e!==exhausted)throw e;
    return {...base,status:'shared-budget-exhausted'};
  }
}

export function chooseSharedSuffix(plan,values,retained){
  const cat=parsePositionDriftRates(plan.source,rational),ys=values.slice(0,plan.prefix.length+1).map(rational);
  const witnesses=retained??openPositionDriftFeedback(plan.source).receive(plan.prefix,ys.map(fmt));
  const surviving=new Set(witnesses.map(w=>w.law));
  for(const [i,pairs] of plan.candidates.entries()){
    const unsafe=pairs.some(pair=>{
      if(!pair.every(k=>surviving.has(cat.ids[k])))return false;
      const physical=physicalRows(cat,plan.prefix,[plan.suffixes[i]],[pair],()=>{},ys);
      return Boolean(intersectFeedbackHalfspaces(physical.rows,physical.width,()=>{}).point);
    });
    if(!unsafe)return i;
  }
  throw Error('Certified shared-prefix experiment has no safe suffix.');
}

/** Verify every covered counterfactual branch by substitution, without solving a feasibility problem. */
export function verifySharedSuffixPolicy(request,saved){
  const {source,cat,prefix,suffixes,limits,candidates}=prepare(request);
  need(saved?.schema===SUFFIX_PLAN&&saved.status==='suffix-certified'&&equalPositionDriftData(saved.source,source)&&
    equalPositionDriftData(saved.prefix,prefix)&&equalPositionDriftData(saved.suffixes,suffixes)&&
    equalPositionDriftData(saved.limits,limits)&&equalPositionDriftData(saved.candidates,candidates)&&Array.isArray(saved.exclusions),
    'certificate source, candidates or limits differ');
  if(candidates.some(c=>!c.length)){
    need(!saved.exclusions.length,'unused exclusions on a constant safe suffix');return true;
  }
  const proofs=new Map(saved.exclusions.map(x=>[JSON.stringify(x.choices),x.proof]));
  need(proofs.size===saved.exclusions.length&&proofs.size<=limits.assignments,'duplicate or excessive assignment exclusions');
  let visits=0,work=0,used=0;
  function check(choices){
    if(choices.length)need(++visits<=limits.assignments,'certificate exceeds assignment budget');
    const key=JSON.stringify(choices);
    if(choices.length&&proofs.has(key)){
      const encoded=proofs.get(key);used++;
      need(Array.isArray(encoded)&&encoded.length>0&&encoded.every(term=>Array.isArray(term)&&term.length===2&&
        typeof term[1]==='string'&&/^[1-9][0-9]*$/.test(term[1])),'invalid exclusion weights');
      const p=physicalRows(cat,prefix,suffixes,choices,()=>need(++work<=limits.linearWork,'certificate exceeds row budget'));
      need(checkFeedbackContradiction(p.rows,p.width,encoded.map(([i,w])=>[i,BigInt(w)])),'weighted inequalities do not contradict');
      return;
    }
    need(choices.length<candidates.length,'a possible counterfactual assignment is missing its exclusion');
    for(const pair of candidates[choices.length])check([...choices,pair]);
  }
  check([]);need(used===proofs.size,'unused assignment exclusion');return true;
}
