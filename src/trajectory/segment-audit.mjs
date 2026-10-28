import {residualStructure} from './residual-structure.mjs';
/** Descriptive integrations of two declared interpolation conventions, not intersample measurements. */
export function segmentAudit(rows){
  const original=residualStructure(rows,{lags:[1]}); // Reuse unchanged original-source admission and receiving score.
  const source=rows.map((r,index)=>({index,time:r.time,observed:r.observed,predicted:r.predicted,residual:r.observed-r.predicted}));
  const span=source.at(-1).time-source[0].time;
  const scale=source.reduce((s,r)=>Math.max(s,Math.abs(r.residual)),0);
  let linearNorm=0,squaredNorm=0,differenceNorm=0;
  const segments=[];
  for(let i=1;i<source.length;i++){
    const earlier=source[i-1],later=source[i],duration=later.time-earlier.time,weight=duration/span;
    // Taking roots before the ratio retains a representable RMS contribution even when dt/span underflows.
    const rootWeight=Math.sqrt(duration)/Math.sqrt(span);
    const a=scale?earlier.residual/scale:0,b=scale?later.residual/scale:0;
    const linear=Math.hypot(rootWeight*(a+b)/2,rootWeight/Math.sqrt(12)*(a-b));
    const squared=Math.hypot(rootWeight/Math.SQRT2*a,rootWeight/Math.SQRT2*b);
    const difference=rootWeight/Math.sqrt(6)*Math.abs(b-a);
    linearNorm=Math.hypot(linearNorm,linear);squaredNorm=Math.hypot(squaredNorm,squared);differenceNorm=Math.hypot(differenceNorm,difference);
    segments.push({earlier,later,duration,spanFraction:weight,linearContributionRMS:linear*scale,squaredContributionRMS:squared*scale,conventionDifferenceRMS:difference*scale});
  }
  return {source,original,span,segments,linearResidualRMS:linearNorm*scale,linearSquaredResidualRMS:squaredNorm*scale,conventionDifferenceRMS:differenceNorm*scale,
    meaning:'Every original adjacent segment retained, including the initial-condition interval. Two declared curves bridge unobserved intervals: linear residual or linear squared residual. Their descriptive integrals do not bound actual intersample error. Original noninitial row scores remain unchanged.'};
}
