// Authored controls, never measured evidence. Independent oracle from model fitting.
import {PROBE_SCHEMA} from './probe-response.mjs';
export function probeExample(kind='drag'){
 if(!['drag','offset','restoring','mixed','ambiguous'].includes(kind))throw Error('Unknown authored probe control.');
 const preparation={id:'authored-preparation',duration:2,recovery:0};
 const states=kind==='ambiguous'?[[.1,.1],[.2,.2],[.3,.3],[-.6,.6],[.6,-.4],[.8,.8]]:[[.2,-.4],[-.3,.2],[.5,.6],[-.6,-.7],[.8,.3],[-.2,.9]];
 const runs=states.map(([position,rate],i)=>{
  const probe={command:0,position,rate};
  const effect=kind==='offset'?.4:kind==='restoring'?-.7*Math.sin(position):kind==='mixed'?.4-.7*rate:-.7*rate;
  const trials=[];
  for(let j=0;j<16;j++){
   const first=j%2===0,referenceIndex=2*j+(first?0:1),conditionedIndex=2*j+(first?1:0);
   const base=-2*Math.sin(position)-.2*rate;
   for(const [history,index]of [['reference',referenceIndex],['conditioned',conditionedIndex]]){
    const noise=.001*Math.sin((i+1)*71+(j+1)*23+(history==='reference'?0:11));
    trials.push({pairId:'pair-'+j,history,...probe,sampleIndex:index,jointTorque:base+(history==='conditioned'?effect:0)+.002*index+noise});
   }
  }
  return {id:'authored-'+kind+'-'+i,role:i<3?'training':'challenge',preparation,probe,notebook:{schema:'worldlaw.history-challenge/v1',source:'synthetic',sourceNote:'Authored '+kind+' cross-probe control; fixed preparation, linear sensor drift and deterministic perturbation. No physical acquisition.',noiseSigma:kind==='ambiguous'?.01:.002,trials}};
 });
 return {schema:PROBE_SCHEMA,preparation,runs};
}
