import {syntheticChallenge} from './paired-history.mjs';
import {DURATION_SCHEMA} from './duration-response.mjs';
// Reuse maintained matched-state/noise/order acquisition; replace only its
// declared zero-memory contrast with an independently specified duration oracle.
export function continuousDurationExample(kind='off-grid'){
 if(!['off-grid','zero','noisy','contradictory'].includes(kind))throw Error('Unknown duration control.');
 const amplitude=kind==='zero'?0:.7,tau=1.5,noiseSigma=kind==='noisy'?.2:.003;
 return {schema:DURATION_SCHEMA,runs:[.3,1,3,.6,2,6].map((duration,i)=>{
  const seed=700+i*23,notebook=syntheticChallenge({count:32,seed,noiseSigma,effect:0,duration,orderStrategy:'shuffled'});
  const contrast=kind==='contradictory'?(i%2===0?.5:-.5):amplitude*(1-Math.exp(-duration/tau));
  for(const row of notebook.trials)if(row.history==='conditioned')row.jointTorque+=contrast;
  // The original simulation block would incorrectly describe these amended
  // readings as its zero-memory oracle. Keep truthful alternate provenance.
  delete notebook.simulation;
  notebook.sourceNote=`Declared alternate duration oracle ${kind}: tau=${tau}s, coupling=${amplitude}Nm, seed=${seed}, noise=${noiseSigma}Nm; paired-history state/noise/order reused at zero effect. Synthetic only.`;
  return {id:'continuous-'+i,duration,role:i<3?'training':'challenge',notebook};
 })};
}
