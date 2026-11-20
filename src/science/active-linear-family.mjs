/**
 * Exact prospective excitation design for finite linear dynamical hypotheses.
 *
 * Each law has x[t+1] = A x[t] + B u[t], y[t] = C x[t]. The initial
 * state x[0] is UNKNOWN and can differ across laws. For a selected time
 * schedule, pair i/j can be separated for every possible initial state only
 * when the known-input response difference is outside col([O_i,-O_j]).
 *
 * Minimal-support left-nullspace circuits compute the EXACT l-infinity
 * distance between these affine output families. Their bounded-error
 * tubes are disjoint iff this distance is strictly greater than 2 epsilon.
 * The prospective designer never reads outcomes; the separate readout
 * evaluator checks supplied values against a replayed, frozen design.
 */
export const ACTIVE_LINEAR_FAMILY_SCHEMA='worldlaw.active-linear-family/v1';
const err=s=>{throw Error('Active linear family: '+s);};
const need=(ok,s)=>{if(!ok)err(s);};
const abs=x=>x<0n?-x:x;
const gcd=(aa,bb)=>{let a=abs(aa),b=abs(bb);while(b)[a,b]=[b,a%b];return a;};
const Q=(n,d=1n)=>{
  need(d!==0n,'zero denominator');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d)||1n;return {n:n/g,d:d/g};
};
const Z=()=>Q(0n);
const add=(a,b)=>Q(a.n*b.d+b.n*a.d,a.d*b.d);
const neg=a=>Q(-a.n,a.d);
const sub=(a,b)=>add(a,neg(b));
const mul=(a,b)=>Q(a.n*b.n,a.d*b.d);
const div=(a,b)=>{need(b.n!==0n,'singular rational pivot');return Q(a.n*b.d,a.d*b.n);};
const fmt=a=>a.d===1n?String(a.n):String(a.n)+'/'+String(a.d);
const number=x=>{
  if(typeof x==='number'){need(Number.isSafeInteger(x),'numbers must be exact safe integers; pass rationals as strings');x=String(x);}
  need(typeof x==='string'&&x.length<=36&&/^[+-]?\d+(?:\/[1-9]\d*)?$/.test(x),
    'coefficients must be exact integer or rational strings');
  const p=x.split('/'),n=BigInt(p[0]),d=BigInt(p[1]??'1');
  need(abs(n)<=1000000000000n&&d<=1000000000000n,'source rational exceeds input budget');
  return Q(n,d);
};
const dot=(a,b)=>a.reduce((s,v,i)=>add(s,mul(v,b[i])),Z());
const zero=n=>Array.from({length:n},Z);
const rowTimes=(r,m)=>m[0].map((_,j)=>dot(r,m.map(t=>t[j])));
const matTimes=(m,v)=>m.map(r=>dot(r,v));
const sumVectors=(a,b)=>a.map((v,i)=>add(v,b[i]));
function matrix(raw,n,col,label){
  need(Array.isArray(raw)&&raw.length===n&&raw.every(r=>Array.isArray(r)&&r.length===col),
    label+' must be '+n+'x'+col);
  return raw.map(r=>r.map(number));
}
function rref(matrix){
  const a=matrix.map(r=>r.slice()),m=a.length,n=a[0]?.length??0;
  let k=0,pivots=[];
  for(let c=0;c<n&&k<m;c++){
    let p=k;while(p<m&&a[p][c].n===0n)p++;
    if(p===m)continue;
    [a[k],a[p]]=[a[p],a[k]];
    const scale=a[k][c];a[k]=a[k].map(x=>div(x,scale));
    for(let i=0;i<m;i++)if(i!==k&&a[i][c].n!==0n){
      const f=a[i][c];a[i]=a[i].map((v,j)=>sub(v,mul(f,a[k][j])));
    }
    pivots.push(c);k++;
  }
  return {rows:a.slice(0,k),pivots,rank:k};
}
function nullBasis(m){
  if(!m.length)return [];
  const k=m.length,p=m[0].length;
  const t=Array.from({length:p},(_,j)=>m.map(row=>row[j]));
  const reduced=rref(t);
  const piv=new Set(reduced.pivots),out=[];
  for(let f=0;f<k;f++)if(!piv.has(f)){
    const w=zero(k);w[f]=Q(1n);
    for(let j=reduced.rank-1;j>=0;j--){
      const c=reduced.pivots[j];
      let v=Z();for(let x=c+1;x<k;x++)v=add(v,mul(reduced.rows[j][x],w[x]));
      w[c]=neg(v);
    }
    out.push(w);
  }
  return out;
}
const l1=vector=>vector.reduce((sum,value)=>add(sum,Q(abs(value.n),value.d)),Z());
const rankCompleteCircuits=Object.freeze({
  acceptsSupport:(size,rank)=>size===rank+1,
  acceptsKernel:()=>true,
  workAccounting:'Affine rank checks, rank-complete circuit extensions and schedule traversal nodes share one hard limit.'
});
// Saved v1 certificates include their exact work count and exhaustion boundary.
// Replay that historical enumeration through the same rational core; new plans
// always use rankCompleteCircuits. This is not an input-selectable solver mode.
const historicalCircuitsV1=Object.freeze({
  acceptsSupport:(size,rank)=>size<=rank+1,
  acceptsKernel:kernel=>kernel.every(value=>value.n!==0n),
  workAccounting:'Affine rank checks, candidate circuit supports and schedule traversal nodes share one hard limit.'
});
function workBudget(limit){
  return {limit,nodes:0,exhausted:false,take(){
    if(this.nodes>=this.limit){this.exhausted=true;return false;}
    this.nodes++;return true;
  }};
}

/**
 * min_x ||delta - rows*x||_infinity equals
 * max_{rows^T*w=0, ||w||_1<=1} |w^T*delta| by finite LP duality.
 * Every nonzero extreme point of this section of the l1 ball is a circuit:
 * its support has a one-dimensional left kernel with no zero coordinates.
 * Otherwise a kernel perturbation preserving the active l1 face would
 * express it as a nontrivial convex combination. Circuit size is at most
 * rank(rows)+1. Every circuit can be extended by independent rows to a set
 * of rank+1 rows with a one-dimensional kernel. Enumerate those extensions,
 * remove zero coordinates and deduplicate their minimal supports. This
 * recovers every circuit without solving all the smaller row subsets.
 *
 * Cache full-menu circuits once. Restricting to circuits supported on a
 * selected schedule gives its exact optimum, including zero. No floating
 * rank tolerance, statistical noise assumption, or basis-dependent pruning.
 */
function affineCircuits(rows,delta,budget,enumeration=rankCompleteCircuits){
  if(!budget.take())return {complete:false,structural:null,circuits:[]};
  const basis=nullBasis(rows);
  const structural=basis.some(w=>dot(w,delta).n!==0n);
  if(!structural)return {complete:true,structural:false,circuits:[]};
  return enumerateCircuitSupports(rows,basis,budget,enumeration,(weights,mask)=>{
    const gap=dot(weights,delta);
    if(gap.n===0n)return null;
    const norm=l1(weights),margin=div(Q(abs(gap.n),gap.d),norm);
    return {mask,weights,gap,norm,margin};
  });
}
/** Shared exact support enumeration. The measure callback determines the
 * forcing objective; old fixed-course certificate order and work counts stay
 * unchanged. A callback may consume the same hard work budget. */
function enumerateCircuitSupports(rows,basis,budget,enumeration,measure){
  const circuits=new Map(),count=rows.length,rank=count-basis.length;
  const inventory=complete=>({complete,structural:true,
    circuits:[...circuits.values()].sort((a,b)=>a.mask-b.mask)});
  for(let mask=1;mask<2**count;mask++){
    const support=[];
    for(let i=0;i<count;i++)if(mask&(1<<i))support.push(i);
    if(!enumeration.acceptsSupport(support.length,rank))continue;
    if(!budget.take())return inventory(false);
    const subrows=support.map(i=>rows[i]);
    const kernel=nullBasis(subrows);
    if(kernel.length!==1||!enumeration.acceptsKernel(kernel[0]))continue;
    const minimalMask=support.reduce((bits,index,i)=>
      kernel[0][i].n===0n?bits:bits|(1<<index),0);
    if(circuits.has(minimalMask))continue;
    const scale=kernel[0].findLast(value=>value.n!==0n);
    const weights=zero(count);
    support.forEach((index,i)=>{weights[index]=div(kernel[0][i],scale);});
    const circuit=measure(weights,minimalMask);
    if(budget.exhausted)return inventory(false);
    if(!circuit)continue;
    need(rows[0].every((_,col)=>dot(weights,rows.map(row=>row[col])).n===0n),
      'internal circuit annihilation failure');
    circuits.set(minimalMask,circuit);
  }
  return inventory(true);
}
function affineDistance(inventory,indices){
  const mask=indices.reduce((bits,index)=>bits|(1<<index),0);
  let winner=null;
  for(const circuit of inventory.circuits){
    if((circuit.mask&mask)!==circuit.mask)continue;
    if(!winner||sub(circuit.margin,winner.margin).n>0n)winner=circuit;
  }
  return {margin:winner?.margin??Z(),exact:inventory.complete,
    witness:winner?{
      weights:indices.map(index=>fmt(winner.weights[index])),
      signedGap:fmt(winner.gap),l1Norm:fmt(winner.norm),
      meaning:'Exact unknown-state annihilator; maximum |gap|/||weights||1 over all circuits is the affine l-infinity distance.'
    }:null};
}
function pairProof(pair,indices,epsilon){
  const result=affineDistance(pair.inventory,indices);
  const structural=result.margin.n!==0n?true:result.exact?false:null;
  return {pair:pair.id,structural,
    robustCertified:sub(result.margin,mul(Q(2n),epsilon)).n>0n,
    marginLowerBound:fmt(result.margin),noiseMarginExact:result.exact,
    ...(result.witness?{witness:result.witness}:result.exact?
      {counterexample:'Known forcing is absorbable by independent unknown initial states.'}:
      {inconclusive:'Circuit enumeration reached the declared work limit.'})};
}
function compileFamily(request){
  need(request&&typeof request==='object'&&!Array.isArray(request),
    'provide a source-declared linear hypothesis family');
  need(request.schema===ACTIVE_LINEAR_FAMILY_SCHEMA,
    'explicit worldlaw.active-linear-family/v1 schema is required');
  need(typeof request.source==='string'&&request.source.trim().length>=12&&request.source.length<=2048,
    'declare an independent source or explicitly hypothetical excitation contract');
  const hs=request.hypotheses;
  need(Array.isArray(hs)&&hs.length>=2&&hs.length<=5,'offer 2–5 competing linear dynamical hypotheses');
  const ids=new Set();
  const controls=request.controls;
  need(Array.isArray(controls)&&controls.length>=2&&controls.length<=10,
    'declare 2–10 time-ordered known control vectors');
  need(Array.isArray(controls[0])&&controls[0].length>=1&&controls[0].length<=4,
    'control input dimension must be 1–4');
  const u=controls.map(r=>{
    need(Array.isArray(r)&&r.length===controls[0].length,
      'all control vectors must use the same dimension');
    return r.map(number);
  });
  const length=controls.length,cols=u[0].length;
  const tickMenu=request.offeredTicks??Array.from({length:length+1},(_,i)=>i);
  need(Array.isArray(tickMenu)&&tickMenu.length>=1&&tickMenu.length<=12&&
    tickMenu.every(t=>Number.isSafeInteger(t)&&t>=0&&t<=length)&&
    new Set(tickMenu).size===tickMenu.length,
    'offer 1–12 distinct integer observation ticks from 0 through control horizon');
  const offered=[...tickMenu].sort((a,b)=>a-b);
  const maxReadings=request.maxReadings??Math.min(offered.length,7);
  const workLimit=request.workLimit??50000;
  need(Number.isSafeInteger(maxReadings)&&maxReadings>=1&&maxReadings<=Math.min(8,offered.length),
    'maxReadings must be 1–8 within offered menu');
  need(Number.isSafeInteger(workLimit)&&workLimit>=100&&workLimit<=50000,
    'workLimit must be 100–50000');
  const eps=number(request.noiseBound??0);
  need(eps.n>=0n,'noiseBound must be nonnegative');
  const cost=request.costByTick??{};
  need(cost&&typeof cost==='object'&&!Array.isArray(cost),'costByTick must map ticks to positive integer costs');
  for(const [tick,c] of Object.entries(cost))
    need(offered.includes(Number(tick))&&Number.isSafeInteger(c)&&c>=1&&c<=1000000000,
      'costByTick has unknown tick or invalid positive integer cost');
  const laws=hs.map((h,i)=>{
    need(h&&typeof h==='object'&&typeof h.id==='string'&&
      /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(h.id)&&!ids.has(h.id),
      'hypothesis IDs must be distinct stable labels');
    ids.add(h.id);
    const n=h.A?.length;
    need(Number.isSafeInteger(n)&&n>=1&&n<=5,'hypothesis '+h.id+' needs 1–5 latent dimensions');
    const A=matrix(h.A,n,n,'A for '+h.id);
    const B=matrix(h.B,n,cols,'B for '+h.id);
    need(Array.isArray(h.C)&&h.C.length===n,'C for '+h.id+' must be one latent observation row');
    const C=h.C.map(number);
    let unknown=C.slice(),forced=zero(n);
    const schedule=[];
    for(let t=0;t<=length;t++){
      schedule.push({observable:unknown.slice(),forced:dot(C,forced)});
      if(t<length){unknown=rowTimes(unknown,A);forced=sumVectors(matTimes(A,forced),matTimes(B,u[t]));}
    }
    return {id:h.id,schedule};
  });
  return {laws,offered,maxReadings,workLimit,eps,cost};
}
export function designActiveLinearFamily(request){
  return designLinearFamily(request,rankCompleteCircuits);
}
function designLinearFamily(request,enumeration){
  const {laws,offered,maxReadings,workLimit,eps,cost}=compileFamily(request);
  const budget=workBudget(workLimit),pairs=[];
  for(let i=0;i<laws.length;i++)for(let j=i+1;j<laws.length;j++)
    pairs.push({id:laws[i].id+'__'+laws[j].id,
      inventory:affineCircuits(offered.map(t=>[
        ...laws[i].schedule[t].observable,...laws[j].schedule[t].observable.map(neg)]),
      offered.map(t=>sub(laws[j].schedule[t].forced,laws[i].schedule[t].forced)),budget,enumeration)});
  const evaluate=ticks=>pairs.map(pair=>pairProof(pair,ticks.map(t=>offered.indexOf(t)),eps));
  const potential=evaluate(offered);
  const impossible=potential.filter(p=>p.structural===false);
  const base={schema:ACTIVE_LINEAR_FAMILY_SCHEMA,source:request.source,
    hypothesisIds:laws.map(l=>l.id),offeredTicks:offered,
    observationUnits:'Declared scalar output units; unknown initial states are independent for each hypothesis',
    noiseBound:fmt(eps),sourceOnly:true,physicalActionsPerformed:false,
    outcomeValuesUsed:false,
    potential,pairCount:pairs.length,maxReadings,workLimit,
    noiseMethod:'exact-affine-linf-circuits/v1',
    workAccounting:enumeration.workAccounting};
  if(impossible.length)return {...base,status:'structurally_indistinguishable_on_offered_course',
    selection:null,proof:null,nodes:budget.nodes,exhausted:budget.exhausted,
    interpretation:'Exact row-space no-go for at least one pair even with every proposed measurement; control or sensors must change.'};
  if(budget.exhausted)return {...base,status:'search_inconclusive',selection:null,proof:null,
    nodes:budget.nodes,exhausted:true,
    interpretation:'Circuit enumeration interrupted at the declared limit; partial lower bounds do not prove impossibility or optimality.'};
  if(potential.some(p=>!p.robustCertified))return {...base,
    status:'noise_separation_not_certified',noiseOverlapProven:true,selection:null,proof:null,
    nodes:budget.nodes,exhausted:false,
    interpretation:'Exact affine distance is at most twice the declared error bound for at least one pair, even with every offered reading. Their closed error tubes overlap; no subset can guarantee separation.'};
  let best=null,structuralCandidates=0;
  for(let size=1;size<=maxReadings;size++){
    let winner=null;
    const walk=(next,chosen,expense)=>{
      if(!budget.take())return;
      if(chosen.length===size){
        const cases=evaluate(chosen);
        if(cases.every(p=>p.structural))structuralCandidates++;
        if(cases.every(p=>p.robustCertified)){
          if(!winner||expense<winner.expense||
            (expense===winner.expense&&chosen.join(',')<winner.chosen.join(',')))
            winner={chosen:chosen.slice(),expense,proof:cases};
        }
        return;
      }
      const remaining=size-chosen.length;
      for(let i=next;i<=offered.length-remaining;i++){
        walk(i+1,[...chosen,offered[i]],expense+(cost[offered[i]]??1));
        if(budget.exhausted)return;
      }
    };
    walk(0,[],0);
    if(winner){best=winner;break;}
    if(budget.exhausted)break;
  }
  const status=best?(budget.exhausted?'candidate_uncertified':'optimal_certified_schedule'):
    budget.exhausted?'search_inconclusive':
    structuralCandidates>0?'noise_separation_not_certified':'insufficient_reading_budget';
  return {...base,status,
    selection:best?best.chosen.map(t=>({tick:t,cost:cost[t]??1})):null,
    proof:best?.proof??null,
    numReadings:best?.chosen.length??null,totalCost:best?.expense??null,
    nodes:budget.nodes,exhausted:budget.exhausted,
    interpretation:best?
      (budget.exhausted?
        'Pairwise robust schedule found, but search stopped before cost or cardinality optimality could be certified.':
        'Exact finite-choice minimum number and declared cost under the optimal adversarial noise margin; source-only design, not a performed experiment.'):
      budget.exhausted?'Finite search interrupted before exhaustive optimality; no optimal claim.':
      'No pairwise separating schedule exists within the declared reading budget and bounded-error model.'};
}
function verifyLinearCertificate(request,prior){
  const enumeration=prior?.workAccounting===historicalCircuitsV1.workAccounting?
    historicalCircuitsV1:rankCompleteCircuits;
  const fresh=designLinearFamily(request,enumeration);
  need(prior?.schema===ACTIVE_LINEAR_FAMILY_SCHEMA&&JSON.stringify(prior)===JSON.stringify(fresh),
    'certificate or source changed; exact prospective replay refused');
  return enumeration;
}
export function replayActiveLinearFamily(request,prior){
  verifyLinearCertificate(request,prior);
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}


/**
 * Search real proposed intervention choices, not merely readout times.
 *
 * The menu is source-declared and finite. Ineligible/no-op interventions
 * remain as explicit negative controls; no selected course is executed.
 * Each course inherits the same independently frozen hypothesis family,
 * sensor menu and noise bound. Minimum reading cardinality takes priority;
 * declared intervention + reading costs break ties.
 */
export const ACTIVE_INTERVENTION_SCHEMA='worldlaw.active-linear-interventions/v1';
export function designActiveInterventionFamily(request){
  return designInterventionFamily(request,rankCompleteCircuits);
}
function designInterventionFamily(request,enumeration){
  need(request&&typeof request==='object'&&!Array.isArray(request)&&
    request.schema===ACTIVE_INTERVENTION_SCHEMA,
    'explicit worldlaw.active-linear-interventions/v1 schema is required');
  const menu=request.interventions;
  need(Array.isArray(menu)&&menu.length>=2&&menu.length<=8,
    'declare 2–8 independently specified intervention choices');
  const ids=new Set();
  const runs=[];
  let totalNodes=0;
  for(const intervention of menu){
    need(intervention&&typeof intervention==='object'&&!Array.isArray(intervention)&&
      typeof intervention.id==='string'&&/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(intervention.id)&&
      !ids.has(intervention.id),
      'interventions require unique stable IDs');
    ids.add(intervention.id);
    need(Number.isSafeInteger(intervention.actionCost)&&
      intervention.actionCost>=0&&intervention.actionCost<=1000000000,
      'each intervention needs a nonnegative declared integer actionCost');
    const course={...request,schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
      controls:intervention.controls,
      workLimit:request.workLimitPerCourse??request.workLimit??50000};
    delete course.interventions;
    delete course.workLimitPerCourse;
    const proof=designLinearFamily(course,enumeration);
    totalNodes+=proof.nodes;
    runs.push({id:intervention.id,actionCost:intervention.actionCost,
      status:proof.status,selection:proof.selection,
      numReadings:proof.numReadings??null,readingCost:proof.totalCost??null,
      totalDeclaredCost:proof.totalCost==null?null:
        proof.totalCost+intervention.actionCost,
      proof:proof.proof,potential:proof.potential,
      workNodes:proof.nodes,workExhausted:proof.exhausted??false});
  }
  const successes=runs.filter(r=>r.selection!=null);
  successes.sort((a,b)=>a.numReadings-b.numReadings||
    a.totalDeclaredCost-b.totalDeclaredCost||a.id.localeCompare(b.id));
  const selected=successes[0]??null;
  const anyExhausted=runs.some(r=>r.workExhausted);
  const status=selected?
    (anyExhausted?'candidate_uncertified':'optimal_certified_intervention'):
    anyExhausted?'search_inconclusive':
    runs.some(r=>r.status==='noise_separation_not_certified')?
      'noise_separation_not_certified':
    'no_offered_intervention_certified';
  return {
    schema:ACTIVE_INTERVENTION_SCHEMA,
    source:request.source,
    sourceOnly:true,physicalActionsPerformed:false,outcomeValuesUsed:false,
    hypothesisIds:request.hypotheses.map(h=>h.id),
    noiseBound:fmt(number(request.noiseBound??0)),
    interventionMenu:runs,
    chosenIntervention:selected?.id??null,
    chosenReadings:selected?.selection??null,
    numReadings:selected?.numReadings??null,
    totalDeclaredCost:selected?.totalDeclaredCost??null,
    pairProof:selected?.proof??null,
    status,totalNodes,exhausted:anyExhausted,
    interpretation:selected?
      (anyExhausted?
        'Robust finite-menu candidate; at least one course exhausted its work budget, so global optimality is not certified.':
        'Exhaustive finite-menu minimum number of readings, with declared action and sensor cost tie-breaking, under exact affine bounded-error separation. No intervention, measurement or physical calibration occurred.'):
      'No offered source-declared intervention achieves certified pairwise separation within the current menu and work budget. No claim is made about unoffered physical controls.'
  };
}
function verifyInterventionCertificate(request,prior){
  need(prior?.schema===ACTIVE_INTERVENTION_SCHEMA,
    'intervention certificate or source changed; exact replay refused');
  for(const enumeration of [rankCompleteCircuits,historicalCircuitsV1]){
    const fresh=designInterventionFamily(request,enumeration);
    if(JSON.stringify(prior)===JSON.stringify(fresh))return enumeration;
  }
  err('intervention certificate or source changed; exact replay refused');
}
export function replayActiveInterventionFamily(request,prior){
  verifyInterventionCertificate(request,prior);
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}

export const ACTIVE_LINEAR_CONTROL_BOX_SCHEMA='worldlaw.active-linear-control-box/v1';
const controlBoxFields=new Set(['schema','source','hypotheses','controlBounds','offeredTicks',
  'maxReadings','noiseBound','costByTick','workLimit']);
function compileControlBox(request){
  need(request&&typeof request==='object'&&!Array.isArray(request)&&
    request.schema===ACTIVE_LINEAR_CONTROL_BOX_SCHEMA,
    'explicit worldlaw.active-linear-control-box/v1 schema is required');
  need(Object.keys(request).every(key=>controlBoxFields.has(key)),
    'control-box sources accept only declared dynamics, independent bounds, scalar reading ticks, costs, noise and work limit; remove unknown or competing control fields');
  need(Array.isArray(request.hypotheses)&&request.hypotheses.length===2,
    'bounded-control synthesis requires exactly two competing hypotheses');
  const raw=request.controlBounds;
  need(Array.isArray(raw)&&raw.length>=2&&raw.length<=10,
    'declare 2–10 time-ordered independent control bounds');
  const channels=raw[0]?.min?.length;
  need(Number.isSafeInteger(channels)&&channels>=1&&channels<=4,
    'bounded control input dimension must be 1–4');
  const bounds=raw.map(row=>{
    need(row&&typeof row==='object'&&!Array.isArray(row)&&
      Object.keys(row).sort().join(',')==='max,min'&&
      Array.isArray(row.min)&&Array.isArray(row.max)&&
      row.min.length===channels&&row.max.length===channels,
      'each control bound needs only same-dimension min and max vectors');
    return row.min.map((lo,i)=>{
      const lower=number(lo),upper=number(row.max[i]);
      need(sub(upper,lower).n>=0n,'each closed control interval needs min <= max');
      return {lower,upper};
    });
  });
  const family=compileFamily({...request,schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
    controls:raw.map(row=>row.min)});
  const Bs=request.hypotheses.map(law=>law.B.map(row=>row.map(number)));
  const rows=family.offered.map(t=>[...family.laws[0].schedule[t].observable,
    ...family.laws[1].schedule[t].observable.map(neg)]);
  // The coefficient of u[k,c] at output t is C A^(t-k-1) B[:,c].
  // These rows do not depend on observations or on a guessed initial state.
  const response=family.offered.map(t=>bounds.flatMap((_,k)=>
    Array.from({length:channels},(_,c)=>{
      if(k>=t)return Z();
      const effect=index=>dot(family.laws[index].schedule[t-k-1].observable,
        Bs[index].map(row=>row[c]));
      return sub(effect(1),effect(0));
    })));
  return {...family,rows,response,bounds:bounds.flat(),channels};
}
const closestToZero=bound=>bound.lower.n>0n?bound.lower:
  bound.upper.n<0n?bound.upper:Z();
/** A linear functional reaches its maximum and minimum at box endpoints.
 * Both orientations matter for noncentered boxes. Zero coefficients choose
 * the admissible value nearest zero, without asserting an actuation cost. */
function extremizeBox(weights,response,bounds,budget){
  const coefficients=bounds.map((_,column)=>dot(weights,response.map(row=>row[column])));
  const choices=[];
  for(const orientation of [1,-1]){
    if(!budget.take())return null;
    const controls=coefficients.map((value,i)=>value.n===0n?closestToZero(bounds[i]):
      (value.n>0n)===(orientation===1)?bounds[i].upper:bounds[i].lower);
    choices.push({controls,gap:dot(coefficients,controls)});
  }
  const magnitude=gap=>Q(abs(gap.n),gap.d);
  const winner=sub(magnitude(choices[0].gap),magnitude(choices[1].gap)).n>=0n?choices[0]:choices[1];
  return {...winner,coefficients};
}
function controlBoxCircuits(rows,response,bounds,budget){
  const empty=(complete,structural)=>({complete,structural,circuits:[]});
  if(!budget.take())return empty(false,null);
  const basis=nullBasis(rows);
  let structural=false;
  for(const weights of basis){
    const extremum=extremizeBox(weights,response,bounds,budget);
    if(!extremum)return empty(false,null);
    if(extremum.gap.n!==0n){structural=true;break;}
  }
  if(!structural)return empty(true,false);
  return enumerateCircuitSupports(rows,basis,budget,rankCompleteCircuits,(weights,mask)=>{
    const extremum=extremizeBox(weights,response,bounds,budget);
    if(!extremum||extremum.gap.n===0n)return null;
    const norm=l1(weights),margin=div(Q(abs(extremum.gap.n),extremum.gap.d),norm);
    return {mask,weights,...extremum,norm,margin};
  });
}
const controlVectors=(flat,channels)=>Array.from({length:flat.length/channels},
  (_,t)=>flat.slice(t*channels,(t+1)*channels).map(fmt));
function controlBoxProof(id,circuit,indices,eps,complete,channels){
  const margin=circuit?.margin??Z();
  return {pair:id,structural:margin.n!==0n?true:complete?false:null,
    robustCertified:sub(margin,mul(Q(2n),eps)).n>0n,
    marginLowerBound:fmt(margin),noiseMarginExact:complete,
    ...(circuit?{witness:{weights:indices.map(i=>fmt(circuit.weights[i])),
      signedGap:fmt(circuit.gap),l1Norm:fmt(circuit.norm),
      controlCoefficients:controlVectors(circuit.coefficients,channels),
      extremizingControls:controlVectors(circuit.controls,channels),
      meaning:complete?
        'Exact initial-state annihilator with both signed box extrema; maximum |gap|/||weights||1 is the greatest attainable affine l-infinity distance on these readings.':
        'Exact initial-state annihilator and an admissible box input; |gap|/||weights||1 is an attainable separation lower bound. The greatest attainable distance remains unknown.'}}:
      complete?{counterexample:'Every admissible control response is absorbable by independent unknown initial states.'}:
      {inconclusive:'Circuit or signed endpoint enumeration reached the declared work limit.'})};
}
const numericTickOrder=(a,b)=>{
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];
  return 0;
};
/** Exact prospective binary experiment synthesis over a continuous box.
 *
 * max_u min_z ||Fz+Du||inf = max_u max_w w^T Du over the l1-bounded
 * annihilator, hence max_w max_u. Its nonzero vertices are signed circuits.
 * A separating optional reading schedule contains a separating circuit;
 * deleting other readings preserves this circuit and the common control box.
 * Thus minimum reading count is attained by a qualifying circuit support.
 * This argument does not solve the multi-hypothesis max-min problem, coupled
 * initial-state constraints, or reading-dependent dynamics/control bounds.
 */
export function designActiveLinearControlBox(request){
  const {laws,offered,maxReadings,workLimit,eps,cost,rows,response,bounds,channels}=compileControlBox(request);
  const budget=workBudget(workLimit),inventory=controlBoxCircuits(rows,response,bounds,budget);
  const pair=laws[0].id+'__'+laws[1].id,indices=offered.map((_,i)=>i);
  let maximum=null;
  for(const circuit of inventory.circuits)
    if(!maximum||sub(circuit.margin,maximum.margin).n>0n)maximum=circuit;
  const potential=[controlBoxProof(pair,maximum,indices,eps,inventory.complete,channels)];
  const base={schema:ACTIVE_LINEAR_CONTROL_BOX_SCHEMA,source:request.source,
    hypothesisIds:laws.map(law=>law.id),offeredTicks:offered,
    controlBounds:Array.from({length:bounds.length/channels},(_,t)=>({
      min:bounds.slice(t*channels,(t+1)*channels).map(b=>fmt(b.lower)),
      max:bounds.slice(t*channels,(t+1)*channels).map(b=>fmt(b.upper))})),
    observationUnits:'Declared scalar output units; unknown initial states are independent for each hypothesis',
    noiseBound:fmt(eps),sourceOnly:true,physicalActionsPerformed:false,outcomeValuesUsed:false,
    potential,pairCount:1,maxReadings,workLimit,noiseMethod:'exact-box-affine-linf-circuits/v1',
    objective:'Minimum reading count, then declared reading cost, then numeric tick order; maximum box margin for the selected support.',
    workAccounting:'Full affine kernel, rank-complete circuit extensions and each signed box endpoint share one hard limit.'};
  const refused=(status,interpretation,extra={})=>({...base,status,selection:null,
    chosenControls:null,proof:null,numReadings:null,totalCost:null,nodes:budget.nodes,
    exhausted:budget.exhausted,interpretation,...extra});
  if(!inventory.complete)return refused('search_inconclusive',
    'Circuit or box endpoint search interrupted; partial lower bounds do not prove impossibility or optimality.');
  if(!potential[0].structural)return refused('structurally_indistinguishable_on_control_box',
    'For every admissible input, independent unknown initial states can make both laws agree on every offered reading.');
  if(!potential[0].robustCertified)return refused('noise_separation_not_certified',
    'Even the greatest attainable affine distance is at most twice the declared error bound. For every admissible control the closed error tubes overlap.',
    {noiseOverlapProven:true});
  const candidates=[];
  for(const circuit of inventory.circuits){
    if(sub(circuit.margin,mul(Q(2n),eps)).n<=0n)continue;
    const selected=indices.filter(i=>circuit.mask&(1<<i)),ticks=selected.map(i=>offered[i]);
    if(ticks.length<=maxReadings)candidates.push({circuit,indices:selected,ticks,
      expense:ticks.reduce((sum,t)=>sum+(cost[t]??1),0)});
  }
  candidates.sort((a,b)=>a.ticks.length-b.ticks.length||a.expense-b.expense||numericTickOrder(a.ticks,b.ticks));
  const best=candidates[0];
  if(!best)return refused('insufficient_reading_budget',
    'Every qualifying circuit needs more readings than the declared budget; no admissible input can separate the laws within that budget.');
  return {...base,status:'optimal_certified_control_box',
    selection:best.ticks.map(tick=>({tick,cost:cost[tick]??1})),
    chosenControls:controlVectors(best.circuit.controls,channels),
    proof:[controlBoxProof(pair,best.circuit,best.indices,eps,true,channels)],
    numReadings:best.ticks.length,totalCost:best.expense,nodes:budget.nodes,exhausted:false,
    interpretation:'Exact continuous-box actuation and minimum optional reading schedule for two source-declared laws. The chosen input maximizes separation on that support. No actuator, measurement or physical calibration was performed.'};
}
function verifyControlBoxCertificate(request,prior){
  const fresh=designActiveLinearControlBox(request);
  need(prior?.schema===ACTIVE_LINEAR_CONTROL_BOX_SCHEMA&&JSON.stringify(prior)===JSON.stringify(fresh),
    'bounded-control certificate or source changed; exact prospective replay refused');
  return rankCompleteCircuits;
}
export function replayActiveLinearControlBox(request,prior){
  verifyControlBoxCertificate(request,prior);
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}

export const ACTIVE_LINEAR_READINGS_SCHEMA='worldlaw.active-linear-readings/v1';
export const ACTIVE_LINEAR_READOUT_RESULT_SCHEMA='worldlaw.active-linear-readout-result/v1';

/** Test supplied outcomes only after replaying the prospective plan. Missing
 * planned readings remain explicit; extra, duplicate and wrong-course values
 * are refused. A surviving model is conditional compatibility, never truth. */
export function evaluateActiveLinearReadings(request,plan,readout){
  const multiple=request?.schema===ACTIVE_INTERVENTION_SCHEMA;
  const bounded=request?.schema===ACTIVE_LINEAR_CONTROL_BOX_SCHEMA;
  const enumeration=multiple?verifyInterventionCertificate(request,plan):
    bounded?verifyControlBoxCertificate(request,plan):verifyLinearCertificate(request,plan);
  need(plan.status===(multiple?'optimal_certified_intervention':bounded?'optimal_certified_control_box':'optimal_certified_schedule'),
    'readout evaluation requires a replayed certified prospective plan');
  need(readout&&readout.schema===ACTIVE_LINEAR_READINGS_SCHEMA,
    'explicit worldlaw.active-linear-readings/v1 schema is required');
  need(typeof readout.source==='string'&&readout.source.trim().length>=12&&readout.source.length<=2048,
    'declare the readout source separately from the prospective hypotheses');
  need(['synthetic','supplied'].includes(readout.acquisition),
    'readout acquisition must be synthetic or supplied; physical provenance is not verified');
  if(multiple)need(readout.interventionId===plan.chosenIntervention,
    'readouts must name the frozen chosen intervention');
  else need(readout.interventionId==null,'fixed-course readouts cannot name a different intervention');
  const selected=multiple?plan.chosenReadings:plan.selection;
  const plannedTicks=selected.map(row=>row.tick);
  need(Array.isArray(readout.readings)&&readout.readings.length>=1&&
    readout.readings.length<=plannedTicks.length,'supply a nonempty subset of planned readings');
  const values=new Map();
  for(const row of readout.readings){
    need(row&&Number.isSafeInteger(row.tick)&&plannedTicks.includes(row.tick)&&!values.has(row.tick),
      'readouts must use distinct ticks from the frozen selected schedule');
    values.set(row.tick,number(row.value));
  }
  const ticks=plannedTicks.filter(t=>values.has(t));
  const intervention=multiple?request.interventions.find(item=>item.id===plan.chosenIntervention):null;
  const course=multiple?{...request,schema:ACTIVE_LINEAR_FAMILY_SCHEMA,controls:intervention.controls,
    workLimit:request.workLimitPerCourse??request.workLimit??50000}:
    bounded?{...request,schema:ACTIVE_LINEAR_FAMILY_SCHEMA,controls:plan.chosenControls}:request;
  const {laws,eps,workLimit}=compileFamily(course),budget=workBudget(workLimit);
  const checks=laws.map(law=>{
    const rows=ticks.map(t=>law.schedule[t].observable);
    const delta=ticks.map(t=>sub(values.get(t),law.schedule[t].forced));
    const inventory=affineCircuits(rows,delta,budget,enumeration);
    const result=affineDistance(inventory,ticks.map((_,i)=>i));
    const falsified=sub(result.margin,eps).n>0n;
    return {hypothesis:law.id,status:falsified?'falsified':result.exact?'consistent':'inconclusive',
      minimumNoiseRequired:result.exact?fmt(result.margin):null,
      noiseLowerBound:fmt(result.margin),noiseMarginExact:result.exact,
      ...(result.witness?{witness:result.witness}:{})};
  });
  const consistent=checks.filter(row=>row.status==='consistent').map(row=>row.hypothesis);
  const unresolved=checks.filter(row=>row.status==='inconclusive').map(row=>row.hypothesis);
  const status=unresolved.length?'readout_inconclusive':consistent.length===0?
    'all_hypotheses_falsified':consistent.length===1?'one_hypothesis_consistent':'multiple_hypotheses_consistent';
  return {schema:ACTIVE_LINEAR_READOUT_RESULT_SCHEMA,source:request.source,
    readoutSource:readout.source,acquisition:readout.acquisition,
    sourceOnly:false,outcomeValuesUsed:true,physicalActionsPerformed:false,physicalProvenanceVerified:false,
    chosenIntervention:multiple?plan.chosenIntervention:null,plannedTicks,receivedTicks:ticks,
    missingTicks:plannedTicks.filter(t=>!values.has(t)),
    noiseBound:fmt(eps),checks,consistentHypothesisIds:consistent,unresolvedHypothesisIds:unresolved,
    status,nodes:budget.nodes,workLimit,exhausted:budget.exhausted,
    interpretation:status==='all_hypotheses_falsified'?
      'Every offered law contradicts the supplied readings under the declared error bound. Revise the model family or investigate the input, timing, calibration and bound; do not force a winning law.':
      'Compatibility is conditional on the frozen controls, reading identity and declared error bound. A remaining candidate is not empirical identification or verified physical truth.'};
}
