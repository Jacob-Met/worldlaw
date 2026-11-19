/**
 * Source-level excitation and cautious paired-run uncertainty diagnostics.
 * These describe available observational support; they do NOT establish a
 * randomized experiment or causal identifiability.
 *
 * No model parameters, feature search, or development selection uses these
 * diagnostics. In particular, they are posthoc characterization after the
 * 2026-11-19 first original Disturbance receiving.
 */
const must=(ok,reason)=>{if(!ok)throw Error('measured observability: '+reason);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function describe(samples,key){
  let n=0,mean=0,ss=0,min=Infinity,max=-Infinity;
  for(const s of samples){
    if(!s.valid||!finite(s[key]))continue;
    const x=s[key]*100;n++;
    const delta=x-mean;mean+=delta/n;ss+=delta*(x-mean);
    min=Math.min(min,x);max=Math.max(max,x);
  }
  return {count:n,mean:n?mean:null,standardDeviation:n>1?Math.sqrt(ss/(n-1)):null,
    min:n?min:null,max:n?max:null,range:n?max-min:null};
}
export function summarizeTwoTankExcitation(runs){
  must(Array.isArray(runs)&&runs.length,'source runs are required');
  const byRun=[];
  for(const run of runs){
    const s=run.samples;
    must(Array.isArray(s)&&s.length>=6,'malformed source run');
    const level=describe(s,'level'),pump=describe(s,'pump'),valve=describe(s,'valve');
    const valveFixedWithinRun=valve.range!==null&&valve.range<=1e-9;
    let pumpTransitions=0,valveTransitions=0,comparable=0;
    for(let i=1;i<s.length;i++){
      if(!(s[i].valid&&s[i-1].valid&&Math.abs(s[i].time-s[i-1].time-1)<=0.01))continue;
      comparable++;
      if(Math.abs(s[i].pump-s[i-1].pump)>1e-8)pumpTransitions++;
      if(Math.abs(s[i].valve-s[i-1].valve)>1e-8)valveTransitions++;
    }
    byRun.push({id:run.id,group:run.group,level,pump,valve,valveFixedWithinRun,
      contiguousTransitions:comparable,pumpTransitions,valveTransitions});
  }
  return {perRun:byRun,counts:{runs:byRun.length,
    valveFixedWithinRun:byRun.filter(r=>r.valveFixedWithinRun).length,
    valveChangingWithinRun:byRun.filter(r=>r.valveTransitions>0).length,
    pumpChangingWithinRun:byRun.filter(r=>r.pumpTransitions>0).length},
    interpretation:'Valve with zero within-run variation cannot be identified via within-run changes after arbitrary per-run offsets; between-run settings and feedback confound causal valve effect. Nonzero pump variation alone cannot establish exogenous excitation.'};
}
export function comparePairedPhysicalRuns(hypothesis,baseline,horizon=120){
  must(hypothesis?.byRun?.length===baseline?.byRun?.length,'paired run length mismatch');
  const diffs=[];
  for(let i=0;i<hypothesis.byRun.length;i++){
    const a=hypothesis.byRun[i],b=baseline.byRun[i];
    must(a.id===b.id,'aligned original source ID required');
    const x=a.horizons[horizon]?.rmse,y=b.horizons[horizon]?.rmse;
    if(finite(x)&&finite(y))diffs.push({id:a.id,difference:x-y});
  }
  const n=diffs.length;
  must(n>0&&n<=16,'1..16 independent declared recording-level pairs required');
  const observed=diffs.reduce((a,b)=>a+b.difference,0)/n;
  // Exact conditional sign-flip enumeration (not a randomly held-out p
  // value): the four distinct condition runs are NOT exchangeable biological
  // replicates; quote only with that explicit assumption.
  let upper=0,absolute=0;
  const cases=1<<n;
  for(let mask=0;mask<cases;mask++){
    let sum=0;for(let i=0;i<n;i++)sum+=diffs[i].difference*((mask>>i)&1?1:-1);
    const v=sum/n;
    if(v>=observed-1e-12)upper++;
    if(Math.abs(v)>=Math.abs(observed)-1e-12)absolute++;
  }
  return {horizon,paired:diffs,meanDifference:observed,
    signFlip:{enumerated:cases,oneSidedUpper:upper/cases,twoSided:absolute/cases,
      assumption:'conditional exchangeability and independent comparable original run effects; not proven in the one-apparatus closed-loop source'},
    interpretation:'A descriptive exactly enumerable paired-run uncertainty diagnostic, NOT a preregistered new mechanism gate or a source of model selection.'};
}
