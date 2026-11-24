import {compileBurstSchedule} from './continuous-input.mjs';
const need=(ok,message)=>{if(!ok)throw new RangeError(message);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function randomSource(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)+.5)/4294967296;};}
const phase=x=>((x+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
function specification(options) {
  const {duration,rms,peak,cycleBounds=[2,8],maxEvaluations=37,method='pattern',seed=1009}=options;
  need(Number.isFinite(duration)&&duration>0&&Number.isFinite(rms)&&rms>0&&Number.isFinite(peak)&&peak>0,'Invalid continuous design constraints');
  need(Array.isArray(cycleBounds)&&cycleBounds.length===2&&Array.from(cycleBounds).every(Number.isFinite)&&cycleBounds[0]>=.5&&cycleBounds[1]<=128&&cycleBounds[0]<cycleBounds[1],'Invalid continuous frequency bounds');
  need(Number.isInteger(maxEvaluations)&&maxEvaluations>=1&&maxEvaluations<=97&&['pattern','random-search'].includes(method),'Invalid continuous search budget');
  need(Number.isInteger(seed)&&seed>=1&&seed<=4294967295,'Invalid design seed');
  return {duration,rms,peak,cycleBounds:cycleBounds.slice(),maxEvaluations,method,seed};
}
function descriptor(parameters,spec) {
  const weights=parameters.slice(6),sum=weights.reduce((s,x)=>s+x,0);
  return {schema:'worldlaw.hann-bursts/v1',duration:spec.duration,cycles:parameters.slice(0,3),
    phases:parameters.slice(3,6),energyShares:weights.map(x=>x/sum),rms:spec.rms,peak:spec.peak};
}
/** One draw, including a retained refusal. No hidden rejection sampling. */
export function drawContinuousSchedule(options) {
  const spec=specification({...options,maxEvaluations:1}),random=randomSource(spec.seed),[lo,hi]=spec.cycleBounds;
  const parameters=[...Array.from({length:3},()=>lo+(hi-lo)*random()),
    ...Array.from({length:3},()=>-Math.PI+2*Math.PI*random()),
    ...Array.from({length:3},()=>.5+random())];
  const schedule=descriptor(parameters,spec);
  try{const proof=compileBurstSchedule(schedule);return {status:'admissible',schedule,energy:proof.totalEnergy,peakBound:proof.peakBound};}
  catch(error){if(!(error instanceof RangeError))throw error;return {status:'refused',schedule,reason:error.message};}
}
/** Bounded derivative-free coordinate search over continuous parameters.
 * Scores must use pre-acquisition evidence only. Invalid candidates consume budget.
 */
export function searchContinuousExcitation(score,options) {
  need(typeof score==='function','Require a simulation score');
  const spec=specification(options),random=randomSource(spec.seed),[lo,hi]=spec.cycleBounds;
  let center=[lo+(hi-lo)/6,(lo+hi)/2,hi-(hi-lo)/6,0,0,0,1,1,1];
  let steps=[...Array(3).fill((hi-lo)/4),...Array(3).fill(Math.PI/2),...Array(3).fill(.25)];
  const evaluations=[];let best=null,sweepImproved=false;
  function evaluate(parameters) {
    const schedule=descriptor(parameters,spec),index=evaluations.length;
    let result;
    try{
      const proof=compileBurstSchedule(schedule),value=score(schedule);
      if(!Number.isFinite(value)||value<0)throw new RangeError('Nonfinite or negative prediction separation');
      result={index,status:'scored',score:value,schedule,energy:proof.totalEnergy,peakBound:proof.peakBound};
      if(best===null||value>best.score){best=result;center=parameters.slice();sweepImproved=true;}
    }catch(error){
      if(!(error instanceof RangeError))throw error;
      result={index,status:'excluded',reason:error.message,schedule};
    }
    evaluations.push(result);
  }
  if(spec.method==='pattern'){evaluate(center);sweepImproved=false;}
  for(let trial=evaluations.length;trial<spec.maxEvaluations;trial++) {
    let candidate;
    if(spec.method==='random-search')candidate=[...Array.from({length:3},()=>lo+(hi-lo)*random()),
      ...Array.from({length:3},()=>-Math.PI+2*Math.PI*random()),...Array.from({length:3},()=>.5+random())];
    else{
      const move=(trial-1)%18,coordinate=Math.floor(move/2),sign=move%2===0?1:-1;
      if(move===0&&trial>1){if(!sweepImproved)steps=steps.map(x=>x/2);sweepImproved=false;}
      candidate=center.slice();candidate[coordinate]+=sign*steps[coordinate];
      candidate[coordinate]=coordinate<3?clamp(candidate[coordinate],lo,hi):
        coordinate<6?phase(candidate[coordinate]):clamp(candidate[coordinate],.5,1.5);
    }
    evaluate(candidate);
  }
  return {schema:'worldlaw.continuous-excitation-search/v1',status:best?'designed_in_simulation':'no_admissible_schedule',
    selected:best?.schedule??null,score:best?.score??null,selectedIndex:best?.index??null,
    evaluations,constraints:spec,scope:'Fixed-committee simulated prediction separation; no Fisher-information, global optimum or structural-identification guarantee.'};
}
