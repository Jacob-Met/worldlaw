/** Independently authored analytic motions and applied torques. No fit/kernel calls. */
import {VISCOUS_RECORD_SCHEMA,VISCOUS_STUDY_SCHEMA,VISCOUS_INTERPRETATION} from './viscous-comparison.mjs';

export function createViscousExample(kind='cross'){
 if(!['cross','diagonal','omitted'].includes(kind))throw new Error('Unknown authored viscous course.');
 const mass=[[1.8,.32],[.32,1.25]],drag=[[.35,kind==='diagonal'?0:.19],[kind==='diagonal'?0:.19,.52]];
 const record=shift=>({schema:VISCOUS_RECORD_SCHEMA,interpretation:VISCOUS_INTERPRETATION,units:{time:'s',position:'rad',torque:'N·m'},
  torqueDeclaration:'Authored applied torque excludes the offered viscous loss. The omitted-force control adds an undeclared cubic torque. No physical instrument or calibration.',
  source:{kind:'synthetic',label:`Authored ${kind} ${shift?'separate':'training'} motion`,description:'Closed-form mixed sinusoids and analytic derivatives generate source values independently of the weak integrator. Different frequencies are used for the separate motion; these are numerical controls.'},
  courses:[{id:'analytic-'+shift,rows:Array.from({length:1201},(_,i)=>{
   const t=i*.005,w=[1.1+shift,2.3+shift*.3,1.7+shift*.6,3.1+shift*.2];
   const q=[.6*Math.sin(w[0]*t)+.18*Math.cos(w[1]*t),.45*Math.cos(w[2]*t)+.21*Math.sin(w[3]*t)];
   const v=[.6*w[0]*Math.cos(w[0]*t)-.18*w[1]*Math.sin(w[1]*t),-.45*w[2]*Math.sin(w[2]*t)+.21*w[3]*Math.cos(w[3]*t)];
   const a=[-.6*w[0]**2*Math.sin(w[0]*t)-.18*w[1]**2*Math.cos(w[1]*t),-.45*w[2]**2*Math.cos(w[2]*t)-.21*w[3]**2*Math.sin(w[3]*t)];
   return {time:t,position:q,torque:[0,1].map(j=>mass[j][0]*a[0]+mass[j][1]*a[1]+drag[j][0]*v[0]+drag[j][1]*v[1]+(kind==='omitted'?1.7*q[j]**3:0))};
  })}]});
 return {schema:VISCOUS_STUDY_SCHEMA,training:{record:record(0),settings:{windowSamples:81,stride:40}},
  challenge:{record:record(.6),settings:{windowSamples:81,stride:40,toleranceNm:[.002,.002],correspondence:'Independently generated different-frequency analytic motion with the same authored mass/drag matrices and coordinate/torque conventions.'}}};
}
