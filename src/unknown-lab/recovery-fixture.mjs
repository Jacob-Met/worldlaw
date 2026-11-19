// Authored independent recovery instrument, used only as a visible demonstration.
import {syntheticChallenge} from './paired-history.mjs';
import {RECOVERY_SCHEMA} from './recovery-response.mjs';
export function recoveryRecording(kind,index,delay,{count=32,noiseSigma=.02}={}){
 if(!['decay','persistent','mismatch','two-mode','two-mode-offset','one-mode-offset'].includes(kind)||!Number.isInteger(index)||index<1||index>100000||!Number.isFinite(delay)||delay<0||delay>60)throw new Error('Unknown or out-of-range recovery instrument request.');
  const evidence=syntheticChallenge({seed:170+index,count,effect:0,noiseSigma,orderStrategy:'shuffled',driftPerReading:.01});
  // The instrument evolves an internal response with small Euler steps. It does
  // not call the fitted exponential predictor, and generated rows remain input.
  let response=.6,t=0;while(t<delay){const dt=Math.min(.002,delay-t);if(kind!=='persistent')response-=response*.5*dt;t+=dt;}
  if(kind==='two-mode'||kind==='two-mode-offset'||kind==='one-mode-offset'){
    // Two independently evolving virtual states. One second is one retention step.
    let fast=.65,slow=.8;
    for(let step=0;step<Math.floor(delay);step++){fast*=.2;slow*=.81;}
    response=kind==='one-mode-offset' ? .65+slow*.81**(delay%1) : (kind==='two-mode-offset'?0.35:0)+fast*.2**(delay%1)+slow*.81**(delay%1);
  }
  if(kind==='mismatch'&&index>=3)response+=.25;
  for(const row of evidence.trials)if(row.history==='conditioned')row.jointTorque+=response;
  delete evidence.simulation;evidence.sourceNote='Authored fixed preparation followed by simulated relaxation and independent paired instrument noise; not measured evidence.';
  return {recordingId:'virtual-recovery-'+index,protocolId:'fixed-preparation-v1',delaySeconds:delay,evidence};
}
export function recoveryFixture(kind='decay'){
 const orderCourse=kind==='two-mode'||kind==='two-mode-offset'||kind==='one-mode-offset';
 const record=(index,delay)=>recoveryRecording(kind,index,delay,orderCourse?{noiseSigma:.0001}:{});
 return {schema:RECOVERY_SCHEMA,source:'synthetic',protocolId:'fixed-preparation-v1',protocolNote:'Same preparation, then wait at matched command/position/rate before paired readout. Each virtual run has a separate noise seed.',amplitudeBounds:orderCourse?[-3,3]:[-1,1],tauSeconds:[.5,1,2,4,8],training:orderCourse?[record(1,0),record(2,2),record(5,4),...(kind==='two-mode'?[]:[record(6,6)])]:[record(1,0),record(2,1)],challenges:[record(3,3),record(4,5)]};
}
