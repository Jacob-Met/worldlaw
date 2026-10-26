/** Conditional acquisition-order investigation; never identifies a physical cause. */
import {predict, evaluate} from './torque-discovery.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
export const ORDERED_CHANGE_WORK_LIMIT=3000000;
export function investigateOrderedChange(input){
 if(input?.schema!==undefined&&input.schema!=='worldlaw.ordered-law-change/v1')throw Error('Unsupported ordered investigation schema.');
 const {observations,terms,noiseSigma,minimumSegmentRows,orderSource}=input??{};
 if(typeof orderSource!=='string'||!orderSource.trim()||orderSource.length>2000)throw Error('Declare the source supporting acquisition order.');
 if(!Array.isArray(observations)||observations.length<16||observations.length>512)throw Error('Supply 16..512 ordered original observations.');
 if(!Array.isArray(terms)||!terms.length||terms.length>4||new Set(terms).size!==terms.length)throw Error('Supply one fixed structure of 1..4 distinct terms.');
 if(typeof noiseSigma!=='number'||!Number.isFinite(noiseSigma)||noiseSigma<1e-12||noiseSigma>1e6)throw Error('Declare a positive finite torque noise floor.');
 if(!Number.isInteger(minimumSegmentRows)||minimumSegmentRows<Math.max(8,terms.length+1)||minimumSegmentRows*2>observations.length)throw Error('Invalid minimum segment support.');
 const n=observations.length,k=terms.length,count=n-2*minimumSegmentRows+1;
 const work=(count+1)*n*k*k;
 if(work>ORDERED_CHANGE_WORK_LIMIT)throw Error('Complete ordered split search exceeds work limit; no partial search.');
 const zero={schema:'worldlaw.torque-model/v1',terms:[]};
 const rows=evaluate(zero,observations).rows.map(({prediction,residual,...r})=>r);
 if(rows.some(r=>r.torqueNoiseRatio!==undefined))throw Error('Ordered comparison currently requires unweighted original readings.');
 const columns=terms.map(id=>rows.map(row=>predict({schema:zero.schema,terms:[{id,coefficient:1}]},row)));
 function fit(start,end){
  const fitted=fitLinearColumns(columns.map(c=>c.slice(start,end)),rows.slice(start,end).map(r=>r.jointTorque));
  if(!fitted||fitted.coefficients.some(c=>Math.abs(c)>1e18))return null;
  const model={schema:zero.schema,terms:terms.map((id,i)=>({id,coefficient:fitted.coefficients[i]}))};
  const error=evaluate(model,rows.slice(start,end));
  return {model,sse:error.rmse**2*(end-start),conditionEstimate:fitted.conditionEstimate};
 }
 const baseline=fit(0,n);
 if(!baseline)throw Error('Constant structure is not estimable.');
 const score=(sse,p)=>n*Math.log(Math.max(sse/n,noiseSigma**2))+p*Math.log(n);
 baseline.score=score(baseline.sse,k);
 const splits=[];
 for(let split=minimumSegmentRows;split<=n-minimumSegmentRows;split++){
  const before=fit(0,split),after=fit(split,n);
  splits.push(!before||!after?{split,status:'unestimable'}:{split,status:'computed',before,after,score:score(before.sse+after.sse,2*k+1)});
 }
 const ranked=splits.filter(s=>s.status==='computed').slice().sort((a,b)=>a.score-b.score||a.split-b.split);
 const best=ranked[0]??null;
 // A failed member means the complete proposed family has not been compared.
 const complete=ranked.length===splits.length;
 const preferred=complete&&best&&best.score<baseline.score?'split':'constant';
 const bestScore=Math.min(baseline.score,best?.score??Infinity);
 const competitiveSplits=ranked.filter(s=>s.score-bestScore<=6).map(s=>s.split);
 return {status:complete?'computed':'incomplete',input:{schema:'worldlaw.ordered-law-change/v1',observations:rows,terms:[...terms],noiseSigma,minimumSegmentRows,orderSource},work,baseline,splits,bestSplit:best?.split??null,preferred:complete?preferred:null,
  competitiveSplits,constantCompetitive:baseline.score-bestScore<=6,ambiguityDelta:6,
  scoreMeaning:'heuristic noise-floor penalized residual; not a changepoint probability',
  limitation:'A split may represent omitted structure, operating-range changes or instrument artifacts; it does not identify physical change.'};
}
