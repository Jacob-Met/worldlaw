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
