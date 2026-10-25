/** Internal arithmetic for admitted original residual-pair index populations. */
export function residualNorm(values){
  if(values.length<=20000)return Math.hypot(...values);
  let result=0;for(const value of values)result=Math.hypot(result,value);return result;
}
export function residualPairStatistics(normalized,centered,indices){
  const left=indices.map(([i])=>centered[i-1]),right=indices.map(([,j])=>centered[j-1]);
  const leftNorm=residualNorm(left),rightNorm=residualNorm(right);
  const correlation=indices.length>=2&&leftNorm&&rightNorm?Math.max(-1,Math.min(1,left.reduce((sum,value,i)=>sum+(value/leftNorm)*(right[i]/rightNorm),0))):null;
  const differenceNorm=residualNorm(indices.map(([i,j])=>normalized[j-1]-normalized[i-1]));
  const pairNorm=residualNorm([...indices.map(([i])=>normalized[i-1]),...indices.map(([,j])=>normalized[j-1])]);
  return {correlation,differenceRatio:pairNorm?(differenceNorm/pairNorm)**2:null};
}
