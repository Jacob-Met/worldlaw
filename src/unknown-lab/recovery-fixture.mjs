// Authored independent recovery instrument, used only as a visible demonstration.
import {syntheticChallenge} from './paired-history.mjs';
import {RECOVERY_SCHEMA} from './recovery-response.mjs';
export function recoveryFixture(kind='decay'){
 if(!['decay','persistent','mismatch'].includes(kind))throw new Error('Unknown recovery demonstration.');
 function record(index,delay){
  const evidence=syntheticChallenge({seed:170+index,count:32,effect:0,noiseSigma:.02,orderStrategy:'shuffled',driftPerReading:.01});
  // The instrument evolves an internal response with small Euler steps. It does
  // not call the fitted exponential predictor, and generated rows remain input.
  let response=.6,t=0;while(t<delay){const dt=Math.min(.002,delay-t);if(kind!=='persistent')response-=response*.5*dt;t+=dt;}
  if(kind==='mismatch'&&index>=3)response+=.25;
  for(const row of evidence.trials)if(row.history==='conditioned')row.jointTorque+=response;
  delete evidence.simulation;evidence.sourceNote='Authored fixed preparation followed by simulated relaxation and independent paired instrument noise; not measured evidence.';
  return {recordingId:'virtual-recovery-'+index,protocolId:'fixed-preparation-v1',delaySeconds:delay,evidence};
 }
 return {schema:RECOVERY_SCHEMA,source:'synthetic',protocolId:'fixed-preparation-v1',protocolNote:'Same preparation, then wait at matched command/position/rate before paired readout. Each virtual run has a separate noise seed.',amplitudeBounds:[-1,1],tauSeconds:[.5,1,2,4,8],training:[record(1,0),record(2,1)],challenges:[record(3,3),record(4,5)]};
}
