/**
 * Exact, bounded finite-grid Gaussian sensor schedule search.
 *
 * Unlike per-pair sorted lower bounds, this tests one *shared* subset against
 * all model pairs. Enumeration is only attempted on small finite grids; an
 * exhausted search budget is never converted into an impossibility proof.
 * Inputs have already passed the public Gaussian discriminator's validation.
 */
export const EXACT_MAX_SAMPLES = 24;
export const EXACT_MAX_READINGS = 8;
export const EXACT_NODE_BUDGET = 200000;

/**
 * @param {Float64Array[]} weights - nonnegative squared normalized model-pair
 *   separation per prospective reading
 * @param {number} target2 - squared worst-pair required separation
 * @param {number} lowerBound - sound single-pair lower bound on reading count
 * @param {number} maxReadings - available measurement count
 * @param {number|null} incumbentCount - feasible greedy count, if one exists
 * @returns {{status:string, selection:number[]|null, visited:number}}
 */
export function exactGaussianSubsetSchedule(weights,target2,lowerBound,maxReadings,incumbentCount) {
  const n=weights[0]?.length||0;
  if(!n||n>EXACT_MAX_SAMPLES||maxReadings>EXACT_MAX_READINGS||
      weights.length<2||weights.some(w=>w.length!==n))
    return {status:'skipped',selection:null,visited:0};
  const upper=incumbentCount===null?maxReadings:Math.min(maxReadings,incumbentCount-1);
  if(upper<lowerBound)
    return {status:incumbentCount===null?'pairwise_bound_insufficient':'optimal_incumbent',
      selection:null,visited:0};
  // Exact top-j sums from each suffix provide a VALID optimistic bound for
  // every pair independently. If even that is insufficient, no common subset
  // of j points can succeed. The converse is deliberately not assumed.
  const tails=weights.map(w=>{
    const t=Array.from({length:n+1},()=>new Float64Array(upper+1));
    for(let j=1;j<=upper;j++)t[n][j]=-Infinity;
    for(let i=n-1;i>=0;i--){
      t[i][0]=0;
      for(let j=1;j<=upper;j++)
        t[i][j]=Math.max(t[i+1][j],w[i]+t[i+1][j-1]);
    }
    return t;
  });
  let visited=0,exhausted=false;
  const partial=new Float64Array(weights.length),selected=[];
  const reached=()=>partial.every(value=>value>=target2);
  const search=(start,slots)=>{
    if(++visited>EXACT_NODE_BUDGET){exhausted=true;return null;}
    if(reached())return selected.slice();
    if(!slots||n-start<slots)return null;
    for(let p=0;p<weights.length;p++){
      const upperEnergy=partial[p]+tails[p][start][slots];
      // Roundoff can make a tight optimistic bound appear slightly short.
      // Only prune when the deficit exceeds a conservative numerical margin.
      if(upperEnergy<target2 &&
         target2-upperEnergy>1e-10*Math.max(1,Math.abs(target2)))
        return null;
    }
    for(let i=start;i<=n-slots;i++){
      selected.push(i);
      for(let p=0;p<weights.length;p++)partial[p]+=weights[p][i];
      const match=search(i+1,slots-1);
      for(let p=0;p<weights.length;p++)partial[p]-=weights[p][i];
      selected.pop();
      if(match||exhausted)return match;
    }
    return null;
  };
  for(let k=lowerBound;k<=upper;k++){
    partial.fill(0);selected.length=0;
    const selection=search(0,k);
    if(selection)return {status:'minimum_found',selection,visited};
    if(exhausted)return {status:'incomplete',selection:null,visited};
  }
  return {status:incumbentCount===null?'proved_budget_insufficient':'optimal_incumbent',
    selection:null,visited};
}

/**
 * Wide-grid deterministic one-exchange repair, without a global-optimum claim.
 * Finds a *real* witness whenever the original greedy set can be made feasible
 * by a bounded sequence of single-time replacements. Complete alternative
 * schedules are never called impossible when this local search fails.
 *
 * The budget counts evaluated (model-pair, candidate-time, removed-time)
 * products, not merely outer iterations. Oversized passes are skipped in
 * their entirety so no arbitrary partial candidate order is confused with
 * an exhaustive neighborhood search.
 */
export const REPAIR_MAX_PAIR_PRODUCTS = 2_000_000;
export const REPAIR_MAX_PASSES = 4;

export function repairGaussianGreedySchedule(weights,greedyIndices,target2){
  const pairCount=weights.length,n=weights[0]?.length||0,k=greedyIndices.length;
  if(pairCount<2||k<2||n<k||new Set(greedyIndices).size!==k||
     greedyIndices.some(i=>!Number.isInteger(i)||i<0||i>=n)||
     weights.some(w=>w.length!==n))
    return {status:'not_applicable',selection:null,passes:0,pairProducts:0};
  const perPass=pairCount*k*(n-k);
  if(perPass>REPAIR_MAX_PAIR_PRODUCTS)
    return {status:'work_limit',selection:null,passes:0,pairProducts:0};
  const chosen=greedyIndices.slice();
  const current=new Float64Array(pairCount);
  const recalc=()=>{
    current.fill(0);
    for(const index of chosen)for(let p=0;p<pairCount;p++)current[p]+=weights[p][index];
    return Math.min(...current);
  };
  let worst=recalc(),work=0,passes=0;
  if(!Number.isFinite(worst))
    return {status:'numerical_unresolved',selection:null,passes:0,pairProducts:0};
  while(passes<REPAIR_MAX_PASSES && work+perPass<=REPAIR_MAX_PAIR_PRODUCTS && worst<target2){
    passes++;
    const occupied=new Uint8Array(n);
    for(const index of chosen)occupied[index]=1;
    let bestWorst=worst,bestTotal=-Infinity,bestSlot=-1,bestCandidate=-1;
    for(let slot=0;slot<k;slot++) {
      const removed=chosen[slot];
      for(let candidate=0;candidate<n;candidate++)if(!occupied[candidate]){
        let score=Infinity,total=0;
        for(let p=0;p<pairCount;p++){
          const projected=current[p]-weights[p][removed]+weights[p][candidate];
          score=Math.min(score,projected);total+=projected;
        }
        work+=pairCount;
        if(score>bestWorst ||
          (score===bestWorst && bestSlot!==-1 && total>bestTotal)){
          bestWorst=score;bestTotal=total;
          bestSlot=slot;bestCandidate=candidate;
        }
      }
    }
    if(bestSlot<0)break;
    chosen[bestSlot]=bestCandidate;
    worst=recalc();
  }
  return {status:worst>=target2?'repaired_witness':
      work>=REPAIR_MAX_PAIR_PRODUCTS?'work_limit':'no_one_exchange_witness',
    selection:worst>=target2?chosen:null,passes,pairProducts:work};
}
