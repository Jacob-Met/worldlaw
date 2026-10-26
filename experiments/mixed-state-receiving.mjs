// Independent authored observations, not physical apparatus measurements.
import {performance} from 'node:perf_hooks';
import {analyzeMixedStudy,MIXED_SCHEMA} from '../src/unknown-lab/mixed-state-response.mjs';
function observations(seed,law,drift=.04){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
 const trials=[];const order=Array.from({length:48},(_,i)=>i<24?1:-1);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 for(let i=0;i<48;i++){
  const p={command:2*random()-1,position:2.4*random()-1.2,rate:3*random()-1.5},base=1.1*p.command-2*Math.sin(p.position)-.13*p.rate;
  const ri=2*i+(order[i]<0?1:0),ci=2*i+(order[i]<0?0:1);
  trials.push({pairId:'p'+i,history:'reference',...p,sampleIndex:ri,jointTorque:base+drift*ri+.01*(random()-.5)},
   {pairId:'p'+i,history:'conditioned',...p,sampleIndex:ci,jointTorque:base+law(p)+drift*ci+.01*(random()-.5)});
 }
 return {schema:'worldlaw.history-challenge/v1',source:'synthetic',sourceNote:'Independently authored mixed-state evaluation; known equations are experiment ground truth only.',noiseSigma:.003,trials};
}
const cases=[['sign-changing',p=>.6*p.rate],['mixed',p=>.2+1.1*p.command-.8*Math.sin(p.position)],['unchanged',()=>0],['omitted',p=>Math.sin(7*p.rate)]];
const results=[];
for(const[name,law]of cases){const selected=[],baseline=[],terms={},durations=[];for(let seed=0;seed<32;seed++){
 const source={schema:MIXED_SCHEMA,protocol:'Authored matched preparation/readout; training and challenge seeds are distinct.',training:observations(4901+seed,law),challenge:observations(78017+seed,law)};
 const start=performance.now(),r=analyzeMixedStudy(source);durations.push(performance.now()-start);
 selected.push(r.tests.find(t=>t.id===r.fit.selected.id).rmse);baseline.push(r.tests.find(t=>t.id==='offset').rmse);terms[r.fit.selected.id]=(terms[r.fit.selected.id]??0)+1;
 }const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;results.push({name,courses:32,selectedMeanRMSE:mean(selected),constantMeanRMSE:mean(baseline),selectedMaxRMSE:Math.max(...selected),selectedStructures:terms,meanMilliseconds:mean(durations)});}
console.log(JSON.stringify({authored:true,challengeSeedsExcludedFromSelection:true,results},null,2));
