import {designGaussianReadings} from './gaussian-discriminator.mjs';

export const CORRELATED_SCHEMA = 'worldlaw.correlated-gaussian-discriminator/v1';
export const CORRELATED_WORK_LIMIT = 2_000_000;
const requireInput = (ok, message) => { if (!ok) throw Error(message); };

/** Mahalanobis energy for an OU covariance, using chronological innovations.
 * This consumes predictions only. No sensor outcome estimates its covariance.
 * -expm1 avoids catastrophic cancellation for closely spaced readings.
 */
export function correlatedEnergy(differences, times, indices, correlationTime) {
  if (!indices.length) return 0;
  const ordered = indices.slice().sort((a,b) => a-b);
  let previous = ordered[0], energy = differences[previous] ** 2;
  for (let i=1;i<ordered.length;i++) {
    const current = ordered[i], gap = (times[current]-times[previous])/correlationTime;
    const variance = -Math.expm1(-2*gap), rho = Math.exp(-gap);
    requireInput(variance >= 1e-12, 'Correlation covariance is numerically unresolved at this sample spacing.');
    energy += (differences[current]-rho*differences[previous]) ** 2 / variance;
    previous = current;
  }
  requireInput(Number.isFinite(energy), 'Correlated separation exceeds representable numerical range.');
  return energy;
}

export function designCorrelatedReadings(predictions, options) {
  const {sigma,targetZ,maxReadings,correlationTime} = options;
  requireInput(Number.isFinite(correlationTime) && correlationTime >= 0,
    'Declare a finite nonnegative sensor correlation time in seconds.');
  // Preserve the complete established independent contract at tau=0.
  if (correlationTime === 0) return designGaussianReadings(predictions, options);
  requireInput(Array.isArray(predictions)&&predictions.length>=2&&predictions.length<=16,'Supply two to sixteen model predictions.');
  requireInput(Number.isFinite(sigma)&&sigma>=1e-12&&sigma<=1e6&&Number.isFinite(targetZ)&&targetZ>0&&targetZ<=100,'Declare a valid Gaussian sigma and target separation.');
  const first=predictions[0]?.rows;
  requireInput(Array.isArray(first)&&first.length>=2&&first.length<=257,'Supply two to257 scheduled samples.');
  requireInput(Number.isInteger(maxReadings)&&maxReadings>=1&&maxReadings<=Math.min(32,first.length-1),'Invalid correlated reading budget.');
  requireInput(new Set(predictions.map(p=>p.modelId)).size===predictions.length,'Model identities must be unique.');
  for(const p of predictions){
    requireInput(typeof p.modelId==='string'&&Array.isArray(p.rows)&&p.rows.length===first.length,'All models must share a schedule.');
    p.rows.forEach((r,i)=>requireInput(Number.isFinite(r.position)&&Number.isFinite(r.time)&&r.time===first[i].time&&(!i||r.time>first[i-1].time),'All predictions must be finite at identical increasing timestamps.'));
  }
  const times = predictions[0].rows.slice(1).map(row=>row.time), n=times.length;
  requireInput(n <= 256 && maxReadings <= 32,
    'Correlated design supports at most 256 scheduled readings and a budget of 32.');
  for(let i=1;i<n;i++) requireInput(-Math.expm1(-2*(times[i]-times[i-1])/correlationTime)>=1e-12,
    'Correlation covariance is numerically unresolved at this sample spacing.');
  const pairs=[];
  for(let a=0;a<predictions.length;a++) for(let b=a+1;b<predictions.length;b++)
    pairs.push({a,b,d:times.map((_,i)=>(predictions[a].rows[i+1].position-predictions[b].rows[i+1].position)/sigma)});
  const workLimit=options.maxInnovationTerms??CORRELATED_WORK_LIMIT;
  requireInput(Number.isSafeInteger(workLimit)&&workLimit>=n*pairs.length&&workLimit<=CORRELATED_WORK_LIMIT,
    'The declared correlated work budget must cover one complete-grid covariance score.');
  let work=0, exhausted=false;
  const score = indices => {
    const cost=pairs.length*indices.length;
    if(work+cost>workLimit){exhausted=true;return null;}
    work+=cost;
    const energies=pairs.map(pair=>correlatedEnergy(pair.d,times,indices,correlationTime));
    return {minimum:Math.min(...energies),total:energies.reduce((a,b)=>a+b,0),energies};
  };
  const target2=targetZ*targetZ;
  const all=score(Array.from({length:n},(_,i)=>i));
  const equivalent=pairs.some(pair=>pair.d.every(x=>x===0));
  const unreachable=all.minimum<target2;
  let chosen=[], bestScore=score([]);
  for(let k=0;k<maxReadings&&!equivalent&&!unreachable;k++){
    let best=null, index=-1;
    for(let i=0;i<n;i++) if(!chosen.includes(i)){
      const candidate=score([...chosen,i]);
      if(!candidate)break;
      if(!best||candidate.minimum>best.minimum||candidate.minimum===best.minimum&&candidate.total>best.total){best=candidate;index=i;}
    }
    if(exhausted||index<0)break;
    chosen.push(index);bestScore=best;
    if(best.minimum>=target2)break;
  }
  // Correlation invalidates the diagonal top-k lower bound. Only completed
  // cardinality layers of this shared-subset enumeration certify minimality.
  let exactStatus='not_attempted', certified=null, provenInsufficient=false;
  if(n<=18&&maxReadings<=8&&!equivalent&&!unreachable&&!exhausted){
    const upper=bestScore.minimum>=target2?chosen.length:maxReadings;
    exactStatus='searching';
    for(let size=1;size<=upper;size++){
      let found=null;
      const visit=(prefix,start)=>{
        if(found||exhausted)return;
        if(prefix.length===size){const s=score(prefix);if(s&&s.minimum>=target2)found={indices:prefix.slice(),score:s};return;}
        for(let i=start;i<=n-(size-prefix.length);i++)visit([...prefix,i],i+1);
      };
      visit([],0);
      if(found){chosen=found.indices;bestScore=found.score;certified=size;exactStatus='minimum_found';break;}
      if(exhausted){exactStatus='incomplete';break;}
      if(size===upper){provenInsufficient=true;exactStatus='proved_budget_insufficient';}
    }
  }
  // Full covariance information is monotone under adding readings. This
  // all-grid bound is valid; diagonal per-reading rankings are not.
  const achieved=bestScore.minimum>=target2;
  const status=equivalent?'observationally_equivalent_on_grid':unreachable?'threshold_unreachable_on_grid':
    achieved?'distinguishable':provenInsufficient?'budget_insufficient':'search_inconclusive';
  return {schema:CORRELATED_SCHEMA,status,sigmaRad:sigma,correlationTimeSeconds:correlationTime,
    covarianceModel:'stationary_exponential',targetZ,maxReadings,scheduledPostInitialSamples:n,
    pairCount:pairs.length,minPairwiseZ:Math.sqrt(bestScore.minimum),measurementCount:chosen.length,
    readings:chosen.slice().sort((a,b)=>a-b).map(i=>({sampleIndex:i+1,time:times[i]})),
    pairwise:pairs.map((pair,p)=>({firstModelId:predictions[pair.a].modelId,secondModelId:predictions[pair.b].modelId,separationZ:Math.sqrt(bestScore.energies[p])})),
    certifiedMinimumReadings:certified,exactSubsetSearch:{status:exactStatus},
    work:{innovationTerms:work,limit:workLimit,exhausted},
    optimality:certified!==null?'finite-grid correlated cardinality optimum proved':
      provenInsufficient?'complete shared-subset search proves this reading budget insufficient':
      unreachable?'even all scheduled correlated readings miss the declared z threshold':
      equivalent?'at least one offered law pair has identical sampled predictions':
      achieved?'valid correlated witness; global minimum unproved':'bounded search unresolved; no impossibility claim',
    noiseAssumptions:'Known stationary Gaussian covariance sigma² exp(-|t-s|/correlationTime); externally declared, not fitted or physically validated.',
    interpretation:'Mahalanobis pair separation conditional on the finite offered laws and known common covariance. No hardware authorization or unknown-truth claim.'};
}
