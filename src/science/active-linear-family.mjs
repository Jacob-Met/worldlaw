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
 * rank(rows)+1. Exhaustive support enumeration therefore proves the optimum.
 *
 * Cache full-menu circuits once. Restricting to circuits supported on a
 * selected schedule gives its exact optimum, including zero. No floating
 * rank tolerance, statistical noise assumption, or basis-dependent pruning.
 */
function affineCircuits(rows,delta,budget){
  if(!budget.take())return {complete:false,structural:null,circuits:[]};
  const basis=nullBasis(rows);
  const structural=basis.some(w=>dot(w,delta).n!==0n);
  if(!structural)return {complete:true,structural:false,circuits:[]};
  const circuits=[],count=rows.length,rank=count-basis.length;
  for(let mask=1;mask<2**count;mask++){
    const support=[];
    for(let i=0;i<count;i++)if(mask&(1<<i))support.push(i);
    if(support.length>rank+1)continue;
    if(!budget.take())return {complete:false,structural:true,circuits};
    const subrows=support.map(i=>rows[i]);
    const kernel=nullBasis(subrows);
    if(kernel.length!==1||kernel[0].some(value=>value.n===0n))continue;
    const weights=zero(count);
    support.forEach((index,i)=>{weights[index]=kernel[0][i];});
    const gap=dot(weights,delta);
    if(gap.n===0n)continue;
    need(rows[0].every((_,col)=>dot(weights,rows.map(row=>row[col])).n===0n),
      'internal circuit annihilation failure');
    const norm=l1(weights),margin=div(Q(abs(gap.n),gap.d),norm);
    circuits.push({mask,weights,gap,norm,margin});
  }
  return {complete:true,structural:true,circuits};
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
  const {laws,offered,maxReadings,workLimit,eps,cost}=compileFamily(request);
  const budget=workBudget(workLimit),pairs=[];
  for(let i=0;i<laws.length;i++)for(let j=i+1;j<laws.length;j++)
    pairs.push({id:laws[i].id+'__'+laws[j].id,
      inventory:affineCircuits(offered.map(t=>[
        ...laws[i].schedule[t].observable,...laws[j].schedule[t].observable.map(neg)]),
      offered.map(t=>sub(laws[j].schedule[t].forced,laws[i].schedule[t].forced)),budget)});
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
    workAccounting:'Affine rank checks, candidate circuit supports and schedule traversal nodes share one hard limit.'};
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
export function replayActiveLinearFamily(request,prior){
  const fresh=designActiveLinearFamily(request);
  need(prior?.schema===ACTIVE_LINEAR_FAMILY_SCHEMA&&JSON.stringify(prior)===JSON.stringify(fresh),
    'certificate or source changed; exact prospective replay refused');
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
    const proof=designActiveLinearFamily(course);
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
export function replayActiveInterventionFamily(request,prior){
  const fresh=designActiveInterventionFamily(request);
  need(prior?.schema===ACTIVE_INTERVENTION_SCHEMA&&
    JSON.stringify(prior)===JSON.stringify(fresh),
    'intervention certificate or source changed; exact replay refused');
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}

export const ACTIVE_LINEAR_READINGS_SCHEMA='worldlaw.active-linear-readings/v1';
export const ACTIVE_LINEAR_READOUT_RESULT_SCHEMA='worldlaw.active-linear-readout-result/v1';

/** Test supplied outcomes only after replaying the prospective plan. Missing
 * planned readings remain explicit; extra, duplicate and wrong-course values
 * are refused. A surviving model is conditional compatibility, never truth. */
export function evaluateActiveLinearReadings(request,plan,readout){
  const multiple=request?.schema===ACTIVE_INTERVENTION_SCHEMA;
  if(multiple)replayActiveInterventionFamily(request,plan);
  else replayActiveLinearFamily(request,plan);
  need(plan.status===(multiple?'optimal_certified_intervention':'optimal_certified_schedule'),
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
    workLimit:request.workLimitPerCourse??request.workLimit??50000}:request;
  const {laws,eps,workLimit}=compileFamily(course),budget=workBudget(workLimit);
  const checks=laws.map(law=>{
    const rows=ticks.map(t=>law.schedule[t].observable);
    const delta=ticks.map(t=>sub(values.get(t),law.schedule[t].forced));
    const inventory=affineCircuits(rows,delta,budget);
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
