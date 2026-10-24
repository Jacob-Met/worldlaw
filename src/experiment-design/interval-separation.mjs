// Shared deterministic set-separation policy. These are assumption-conditioned
// interval screens, not confidence bounds or acquisition authorization.
export function screenIntervalPairs(predictions, contrastRadius) {
 const pairs=[];
 for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++){
  const a=predictions[i],b=predictions[j],gap=Math.max(0,a.interval[0]-b.interval[1],b.interval[0]-a.interval[1]);
  pairs.push({hypotheses:[a.id,b.id],gap,margin:gap-2*contrastRadius,separable:gap>2*contrastRadius+1e-12});
 }
 return pairs;
}
export function selectSeparatingCandidate(candidates, coordinateKey) {
 const eligible=candidates.filter(c=>c.withinBudget&&c.separated>0).sort((a,b)=>
  Number(b.allSeparated)-Number(a.allSeparated)||b.separated-a.separated||a.costSeconds-b.costSeconds||a[coordinateKey]-b[coordinateKey]);
 return eligible[0]??null;
}
