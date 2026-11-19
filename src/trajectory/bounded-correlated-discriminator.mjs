/** Conservative OU time-constant envelope for prospective, finite-law design.
 *
 * For any fixed selected schedule, the OU precision quadratic is a sum of
 * chronological innovation terms. On a declared closed tau interval, each
 * term can be minimized analytically over its own rho range; summing the
 * minima is a *lower* bound on the shared-tau quadratic. A finite adaptive
 * subdivision tightens the bound without assuming score monotonicity in tau.
 * Candidate observations and measured residuals never enter this module.
 *
 * Bounds use guarded IEEE754 arithmetic; numerical threshold margins and
 * independent dense/Cholesky cold checks are required before a claim.
 * Not a formal real-number rounding certificate or sensor calibration.
 */
import {designGaussianReadings} from './gaussian-discriminator.mjs';
import {designCorrelatedReadings,correlatedEnergy,CORRELATED_WORK_LIMIT} from './correlated-gaussian-discriminator.mjs';

export const BOUNDED_CORRELATED_SCHEMA='worldlaw.bounded-correlated-discriminator/v1';
const EPS=Number.EPSILON;
const insist=(yes,message)=>{if(!yes)throw Error(message);};
const safeFinite=x=>typeof x==='number'&&Number.isFinite(x);
const SEPARATION_GUARD=2e-9;
const RHO_GUARD=32*EPS;
const ROUND_GUARD=2048*EPS;
function independentEnergy(d,indices){let result=0;for(const i of indices)result+=d[i]*d[i];return result;}
function energy(d,times,indices,tau){return tau===0?independentEnergy(d,indices):correlatedEnergy(d,times,indices,tau);}
function rho(gap,tau){return tau===0?0:Math.exp(-gap/tau);}
function innovation(a,b,r){
  const numerator=(a-b*r)**2;
  // Adding outward slack to the denominator only lowers the putative minimum.
  const denominator=1-r*r+RHO_GUARD;
  return numerator/denominator;
}
function termMinimum(a,b,lowerRho,upperRho){
  const lo=Math.max(0,lowerRho-RHO_GUARD),hi=Math.min(1-2*EPS,upperRho+RHO_GUARD);
  insist(lo<=hi&&hi<1,'Declared sensor tau produces unresolved precision correlation.');
  let minimum=Math.min(innovation(a,b,lo),innovation(a,b,hi));
  // Derivative is proportional to (a-b*r)(a*r-b): both interior
  // critical points must be checked. An endpoint-only rule is unsafe.
  const candidates=[];
  if(b!==0)candidates.push(a/b);
  if(a!==0)candidates.push(b/a);
  for(const c of candidates)if(c>=lo&&c<=hi)minimum=Math.min(minimum,innovation(a,b,c));
  insist(Number.isFinite(minimum)&&minimum>=0,'OU innovation bound exceeded numeric range.');
  return Math.max(0,minimum-ROUND_GUARD*Math.max(1,minimum));
}
function middle(a,b){return a>0?Math.sqrt(a*b):(a+b)/2;}
function pairEnclosure(d,times,ordered,minTau,maxTau,target2,consume,maxBoxes){
  if(!ordered.length)return {lower:0,upper:0,witnessTau:minTau,boxes:0,complete:true};
  const first=ordered[0];
  if(ordered.length===1){const e=d[first]*d[first];return {lower:Math.max(0,e-ROUND_GUARD*Math.max(1,e)),upper:e,witnessTau:minTau,boxes:1,complete:true};}
  const evaluate=(lo,hi)=>{
    if(!consume(4*ordered.length))return null;
    let lower=d[first]*d[first],roundBudget=Math.abs(lower);
    for(let i=1;i<ordered.length;i++){
      const previous=ordered[i-1],current=ordered[i],gap=times[current]-times[previous];
      const term=termMinimum(d[current],d[previous],rho(gap,lo),rho(gap,hi));
      lower+=term;roundBudget+=Math.abs(term);
    }
    lower=Math.max(0,lower-ROUND_GUARD*Math.max(1,roundBudget));
    let upper=Infinity,witnessTau=lo;
    for(const tau of [lo,middle(lo,hi),hi]){
      const value=energy(d,times,ordered,tau);
      insist(Number.isFinite(value),'OU covariance energy is nonfinite.');
      if(value<upper){upper=value;witnessTau=tau;}
    }
    // Round-guarded interval lower must not be above any finite witness.
    insist(lower<=upper+SEPARATION_GUARD*Math.max(1,upper),'OU uncertainty enclosure violated its witness upper bound.');
    return {lo,hi,lower:Math.min(lower,upper),upper,witnessTau};
  };
  const firstBox=evaluate(minTau,maxTau);
  if(!firstBox)return null;
  const boxes=[firstBox];let globalUpper=firstBox.upper,witnessTau=firstBox.witnessTau;
  const bound=()=>Math.min(...boxes.map(box=>box.lower));
  let globalLower=bound(),complete=false;
  while(boxes.length<maxBoxes){
    const scale=SEPARATION_GUARD*Math.max(1,target2,globalUpper);
    if(globalLower>=target2+scale||globalUpper<target2-scale||globalUpper-globalLower<=scale){complete=true;break;}
    let index=0;for(let i=1;i<boxes.length;i++)if(boxes[i].lower<boxes[index].lower)index=i;
    const box=boxes[index],mid=middle(box.lo,box.hi);
    if(!(mid>box.lo&&mid<box.hi))break;
    const left=evaluate(box.lo,mid);if(!left)break;
    const right=evaluate(mid,box.hi);if(!right)break;
    boxes.splice(index,1,left,right);
    for(const child of [left,right])if(child.upper<globalUpper){globalUpper=child.upper;witnessTau=child.witnessTau;}
    globalLower=bound();
  }
  if(globalLower>=target2+SEPARATION_GUARD*Math.max(1,target2)||
     globalUpper<target2-SEPARATION_GUARD*Math.max(1,target2))complete=true;
  return {lower:globalLower,upper:globalUpper,witnessTau,boxes:boxes.length,complete};
}
function validate(predictions,options){
  const {sigma,targetZ,maxReadings,tauMin,tauMax}=options;
  insist(safeFinite(tauMin)&&safeFinite(tauMax)&&tauMin>=0&&tauMax>=tauMin&&tauMax<=1e8,
    'Sensor memory interval needs finite nonnegative minimum and upper bound, with upper >= minimum.');
  insist(safeFinite(sigma)&&sigma>=1e-12&&sigma<=1e6&&safeFinite(targetZ)&&targetZ>0&&targetZ<=100,
    'Declare finite Gaussian scale and target separation.');
  insist(Array.isArray(predictions)&&predictions.length>=2&&predictions.length<=16,
    'Supply two to sixteen candidate laws for covariance-aware design.');
  const initial=predictions[0]?.rows;
  insist(Array.isArray(initial)&&initial.length>=2&&initial.length<=257,
    'Supply two to 257 predicted timestamps.');
  insist(Number.isInteger(maxReadings)&&maxReadings>=1&&maxReadings<=Math.min(32,initial.length-1),
    'Reading budget must be an integer between one and 32 and fit the finite schedule.');
  const ids=new Set(),times=initial.slice(1).map(r=>r.time);
  for(const law of predictions){
    insist(typeof law.modelId==='string'&&law.modelId.length>0&&!ids.has(law.modelId),
      'Each candidate law needs a distinct nonempty model identity.');
    ids.add(law.modelId);
    insist(Array.isArray(law.rows)&&law.rows.length===initial.length,'All candidate laws require identical sampled schedules.');
    for(let i=0;i<law.rows.length;i++){
      const row=law.rows[i];
      insist(safeFinite(row.position)&&safeFinite(row.time)&&row.time===initial[i].time&&
        (i===0||row.time>initial[i-1].time),
        'All predicted laws need finite positions at identical strictly increasing timestamps.');
    }
  }
  for(let i=1;i<times.length;i++)if(tauMax>0)
    insist(-Math.expm1(-2*(times[i]-times[i-1])/tauMax)>=1e-12,
      'Sensor memory interval upper bound is numerically unresolved at this sample spacing.');
}
export function designBoundedCorrelatedReadings(predictions,options){
  insist(options&&typeof options==='object','Supply an interval-valued prospective sensor declaration.');
  validate(predictions,options);
  const {sigma,targetZ,maxReadings,tauMin,tauMax}=options;
  const nominal=options.nominalCorrelationTime??tauMin;
  insist(safeFinite(nominal)&&nominal>=tauMin&&nominal<=tauMax,
    'Simulated instrument nominal sensor memory must lie in the declared interval.');
  // Equal endpoints are a strict protocol-preserving degeneration: no
  // alternate heuristic or rounding changes the established point planner.
  if(tauMin===tauMax){
    const design=tauMin===0?designGaussianReadings(predictions,options):
      designCorrelatedReadings(predictions,{...options,correlationTime:tauMin});
    return {...design,schema:BOUNDED_CORRELATED_SCHEMA,correlationTimeRangeSeconds:{min:tauMin,max:tauMax},
      correlationTimeSeconds:nominal,nominalCorrelationTimeSeconds:nominal,
      uncertaintyStatement:'Exact tau degeneration of the maintained finite-grid model; not measured sensor calibration.'};
  }
  const times=predictions[0].rows.slice(1).map(r=>r.time),n=times.length;
  const pairs=[];
  for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++)
    pairs.push({firstModelId:predictions[i].modelId,secondModelId:predictions[j].modelId,
      d:times.map((_,k)=>(predictions[i].rows[k+1].position-predictions[j].rows[k+1].position)/sigma)});
  const limit=options.maxInnovationTerms??CORRELATED_WORK_LIMIT;
  insist(Number.isSafeInteger(limit)&&limit>=4*n*pairs.length&&limit<=CORRELATED_WORK_LIMIT,
    'Declared bounded covariance score budget must cover the complete-grid interval score.');
  const maxBoxes=options.maxEnvelopeBoxes??24;
  insist(Number.isInteger(maxBoxes)&&maxBoxes>=1&&maxBoxes<=128,'Bounded tau subdivision limit must be 1 to 128.');
  let used=0,exhausted=false;
  const consume=cost=>{if(used+cost>limit){exhausted=true;return false;}used+=cost;return true;};
  const target2=targetZ*targetZ,cache=new Map();
  function score(indices){
    const ordered=indices.slice().sort((a,b)=>a-b),key=ordered.join(',');
    if(cache.has(key))return cache.get(key);
    if(!ordered.length){
      const empty={lower:0,upper:0,pairwise:pairs.map(p=>({...p,lower:0,upper:0,witnessTau:tauMin})),boxes:0};
      cache.set(key,empty);return empty;
    }
    const pairwise=[];let boxes=0;
    for(const pair of pairs){
      const envelope=pairEnclosure(pair.d,times,ordered,tauMin,tauMax,target2,consume,maxBoxes);
      if(!envelope)return null;
      pairwise.push({firstModelId:pair.firstModelId,secondModelId:pair.secondModelId,
        lower:envelope.lower,upper:envelope.upper,witnessTau:envelope.witnessTau,boxes:envelope.boxes});
      boxes+=envelope.boxes;
    }
    const result={lower:Math.min(...pairwise.map(p=>p.lower)),
      upper:Math.min(...pairwise.map(p=>p.upper)),pairwise,boxes};
    cache.set(key,result);return result;
  }
  const allIndices=Array.from({length:n},(_,i)=>i);
  const full=score(allIndices);
  insist(full,'Covariance score budget failed before a complete full-grid upper bound.');
  const guard=SEPARATION_GUARD*Math.max(1,target2);
  const equivalent=pairs.some(p=>p.d.every(x=>x===0));
  const counterexample=full.pairwise.find(p=>p.upper<target2-guard);
  const unreachable=Boolean(counterexample);
  let chosen=[],best=score([]);
  if(!equivalent&&!unreachable)for(let count=0;count<maxReadings;count++){
    let selected=-1,candidateScore=null;
    for(let i=0;i<n;i++)if(!chosen.includes(i)){
      const current=score([...chosen,i]);
      if(!current)break;
      if(!candidateScore||current.lower>candidateScore.lower||
         current.lower===candidateScore.lower&&current.upper>candidateScore.upper){
        selected=i;candidateScore=current;
      }
    }
    if(exhausted||selected<0)break;
    chosen.push(selected);best=candidateScore;
    if(best.lower>=target2+guard)break;
  }
  let certifiedMinimumReadings=null,exactStatus='not_attempted',provedInsufficient=false;
  if(n<=12&&maxReadings<=4&&!equivalent&&!unreachable&&!exhausted){
    const upper=best.lower>=target2+guard?chosen.length:maxReadings;
    let smallerRuledOut=true;
    exactStatus='searching';
    for(let size=1;size<=upper;size++){
      let witness=null,uncertain=false;
      function visit(prefix,start){
        if(witness||exhausted)return;
        if(prefix.length===size){
          const value=score(prefix);
          if(!value)return;
          if(value.lower>=target2+guard)witness={indices:prefix.slice(),value};
          else if(value.upper>=target2-guard)uncertain=true;
          return;
        }
        for(let i=start;i<=n-(size-prefix.length);i++)visit([...prefix,i],i+1);
      }
      visit([],0);
      if(witness){
        chosen=witness.indices;best=witness.value;
        if(smallerRuledOut){certifiedMinimumReadings=size;exactStatus='minimum_found';}
        else exactStatus='witness_but_smaller_subsets_unresolved';
        break;
      }
      if(exhausted){exactStatus='work_exhausted';break;}
      if(uncertain)smallerRuledOut=false;
      if(size===upper){
        provedInsufficient=smallerRuledOut;
        exactStatus=smallerRuledOut?'proved_budget_insufficient':'interval_bounds_unresolved';
      }
    }
  }
  const achieved=best.lower>=target2+guard;
  const status=equivalent?'observationally_equivalent_on_grid':
    unreachable?'threshold_unreachable_on_grid':
    achieved?'distinguishable':provedInsufficient?'budget_insufficient':'search_inconclusive';
  const pairwise=best.pairwise.map(p=>({firstModelId:p.firstModelId,secondModelId:p.secondModelId,
    lowerSeparationZ:Math.sqrt(p.lower),sampledUpperSeparationZ:Math.sqrt(p.upper),
    sampledWorstTauSeconds:p.witnessTau}));
  return {schema:BOUNDED_CORRELATED_SCHEMA,status,sigmaRad:sigma,targetZ,maxReadings,
    correlationTimeSeconds:nominal,nominalCorrelationTimeSeconds:nominal,
    correlationTimeRangeSeconds:{min:tauMin,max:tauMax},covarianceModel:'stationary_exponential',
    scheduledPostInitialSamples:n,pairCount:pairs.length,
    minPairwiseZ:Math.sqrt(best.lower),sampledUpperPairwiseZ:Math.sqrt(best.upper),
    measurementCount:chosen.length,readings:chosen.slice().sort((a,b)=>a-b)
      .map(i=>({sampleIndex:i+1,time:times[i]})),
    pairwise,certifiedMinimumReadings,exactSubsetSearch:{status:exactStatus},
    fullGridCounterexample:unreachable?{
      firstModelId:counterexample.firstModelId,secondModelId:counterexample.secondModelId,
      tauSeconds:counterexample.witnessTau,fullGridSeparationZ:Math.sqrt(counterexample.upper)
    }:null,
    work:{innovationTerms:used,limit,exhausted,enclosuresCached:cache.size,maxEnvelopeBoxes:maxBoxes},
    optimality:certifiedMinimumReadings!==null?'Conservative numeric tau-envelope lower bound; completed finite-grid cardinality proof within declared intervals and work':
      provedInsufficient?'All complete finite-grid subsets have concrete within-interval counterexample tau witnesses':
      unreachable?'At least one model pair misses target even when reading every scheduled time at one declared tau':
      equivalent?'At least two offered laws have identical sampled predictions':
      achieved?'Conservative bounded-tau witness; global reading minimum unproved':
      'Bounded search unresolved; no impossibility or certified detection claim',
    noiseAssumptions:'Externally declared stationary exponential Gaussian covariance with unknown tau in the closed interval. No training-outcome covariance fit, physical calibration, or model-completeness claim.',
    interpretation:'Mahalanobis separation lower-bounded across every declared tau with guarded double-precision interval arithmetic and finite sampled laws; this is not a formal exact real-arithmetic or hardware confidence certificate.'};
}
