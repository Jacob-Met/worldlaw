/** Prospective independent-Gaussian measurement design.
 * No unknown-system reading or training refit is accepted here.
 * For two candidates, the maximum-information k-sample schedule and minimum
 * cardinality needed to cross the requested pairwise z threshold are exact.
 * For larger ensembles the finite greedy design carries a sound lower bound;
 * minimality is claimed only when that bound meets the constructed witness.
 */
export const GAUSSIAN_DESIGN_SCHEMA = 'worldlaw.gaussian-discriminator/v1';
const finite = x => typeof x === 'number' && Number.isFinite(x);
const requireInput = (ok, why) => {if (!ok) throw Error(why);};
const EPS = 1e-12;

export function designGaussianReadings(predictions, {sigma, targetZ, maxReadings}) {
  requireInput(Array.isArray(predictions) && predictions.length >= 2 && predictions.length <= 16,
    'Gaussian design needs two to sixteen prospective model trajectories.');
  requireInput(finite(sigma) && sigma >= 1e-12 && sigma <= 1e6,
    'Declare finite positive independent Gaussian position-reading standard deviation in radians.');
  requireInput(finite(targetZ) && targetZ > 0 && targetZ <= 100,
    'Declare a finite positive pairwise separation threshold (z units).');
  const first = predictions[0]?.rows;
  requireInput(Array.isArray(first) && first.length >= 2 && first.length <= 2001,
    'Every candidate must supply two to 2001 scheduled trajectory samples.');
  const n = first.length - 1;
  requireInput(Number.isSafeInteger(maxReadings) && maxReadings >= 1 && maxReadings <= n,
    'Reading budget must be a positive integer not exceeding the scheduled post-initial samples.');
  const times = first.map(row => row.time);
  for (const trajectory of predictions) {
    requireInput(typeof trajectory.modelId === 'string' && Array.isArray(trajectory.rows) && trajectory.rows.length === first.length,
      'All predictions must have a model ID and the same sample schedule.');
    trajectory.rows.forEach((row,i) => {
      requireInput(finite(row.position) && finite(row.time) && row.time === times[i],
        'All predicted positions and timestamps must be finite and share an identical schedule.');
      if (i) requireInput(row.time > times[i-1], 'Sample times must increase strictly.');
    });
  }
  const pairs=[];
  for (let a=0;a<predictions.length;a++) for(let b=a+1;b<predictions.length;b++) {
    const weights = new Float64Array(n);
    for(let k=0;k<n;k++) {
      const d=(predictions[a].rows[k+1].position-predictions[b].rows[k+1].position)/sigma;
      weights[k]=d*d;
      requireInput(finite(weights[k]), 'Predicted normalized separation exceeds representable numerical range.');
    }
    pairs.push({a,b,weights});
  }
  const target2=targetZ*targetZ;
  let lowerBound=0, permanentlyIndistinguishable=false;
  for(const pair of pairs){
    const decreasing=Array.from(pair.weights).sort((a,b)=>b-a);
    let sum=0, k=0;
    while(k<decreasing.length && sum+EPS*Math.max(1,target2)<target2) sum+=decreasing[k++];
    if(sum+EPS*Math.max(1,target2)<target2) {
      permanentlyIndistinguishable=true;
    } else {
      lowerBound=Math.max(lowerBound,k);
    }
  }
  // Distinct measured readings are each counted once, without using outcomes.
  const current=new Float64Array(pairs.length), used=new Uint8Array(n), chosen=[];
  const score=(candidate)=>{
    let minimum=Infinity, sum=0;
    for(let p=0;p<pairs.length;p++) {
      const x=current[p]+pairs[p].weights[candidate];
      minimum=Math.min(minimum,x);sum+=x;
    }
    return {minimum,sum};
  };
  let achieved2=0;
  for(let step=0;step<maxReadings;step++){
    let best=-1, bestMin=-1, bestSum=-1;
    for(let k=0;k<n;k++) if(!used[k]){
      const s=score(k);
      if(s.minimum>bestMin || (s.minimum===bestMin && s.sum>bestSum)){
        best=k;bestMin=s.minimum;bestSum=s.sum;
      }
    }
    requireInput(best>=0,'No unmeasured scheduled reading remains.');
    used[best]=1;chosen.push(best);
    for(let p=0;p<pairs.length;p++) current[p]+=pairs[p].weights[best];
    achieved2=bestMin;
    if(achieved2+EPS*Math.max(1,target2)>=target2) break;
  }
  const achieved=achieved2+EPS*Math.max(1,target2)>=target2;
  const ordered=chosen.slice().sort((a,b)=>a-b);
  const pairwise=pairs.map((pair,p)=>({firstModelId:predictions[pair.a].modelId,
    secondModelId:predictions[pair.b].modelId, separationZ:Math.sqrt(current[p])}));
  const exact=(achieved && (pairs.length===1 || chosen.length===lowerBound));
  return {schema:GAUSSIAN_DESIGN_SCHEMA,
    status:permanentlyIndistinguishable?'observationally_equivalent_on_grid':achieved?'distinguishable':'budget_insufficient',
    sigmaRad:sigma,targetZ,maxReadings,scheduledPostInitialSamples:n,
    pairCount:pairs.length,minPairwiseZ:Math.sqrt(achieved2),
    measurementCount:chosen.length,
    readings:ordered.map(index=>({sampleIndex:index+1,time:times[index+1]})),
    greedyOrder:chosen.map(index=>index+1),pairwise,
    lowerBoundReadings:permanentlyIndistinguishable?null:lowerBound,
    certifiedMinimumReadings:exact?chosen.length:null,
    optimality:exact?'finite-grid cardinality optimum proved':
      permanentlyIndistinguishable?'no finite subset of scheduled samples separates every offered pair':
      'bounded maximin greedy witness; lower bound only, global minimum unproved',
    noiseAssumptions:'Independent, homoscedastic Gaussian position errors with externally declared sigma; no calibration, confidence claim, hardware safety or unknown truth.',
    interpretation:'For two equally likely Gaussian hypotheses with equal known variance, observed means separated by z have equal-prior Bayes classification error Phi(-z/2). Multi-model z is only the worst pairwise separation.'};
}
