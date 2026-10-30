import {simulateAdaptiveDynamics}from'./studio-dynamics.mjs';
import {preparePeriodicOrigin}from'./periodic-origin-model.mjs';
import {outputIntervalCount}from'./output-grid.mjs';
// Research consumer: unchanged maintained adaptive RK4, explicit new evaluator.
export function executePeriodicOrigin(originalModel,initial,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Explicit bounded settings required');
 const original=structuredClone(originalModel),point=preparePeriodicOrigin(original,initial?.position);
 const duration=options.duration??.1,dt=options.dt??.001,maxTrials=options.maxTrials??500;
 if(!Number.isFinite(duration)||duration<=0||duration>1000||!Number.isFinite(dt)||dt<=0||dt>1||!Number.isInteger(maxTrials)||maxTrials<1||maxTrials>100000)throw Error('Bounded duration, interval and trial count required');
 const count=outputIntervalCount(duration,dt);if(count>10000)throw Error('At most10000 output intervals');
 // Include the explicit initial-point admission in addition to both output passes.
 // Two bounded periodic pair evaluations + mapping per call, conservative scalar work.
 const reservedWork=(12*maxTrials+2*(count+1)+1)*32768;if(reservedWork>250000000)throw Error('Complete periodic evaluation work exceeds250M before simulation');
 point(options.command??0,0,initial.rate);
 const model={schema:'worldlaw.periodic-origin-experiment/v1',originalModel:original,positionOrigin:initial.position,terms:[]};
 const result=simulateAdaptiveDynamics(model,{position:0,rate:initial.rate},{...options,duration,dt,maxTrials});
 return{...result,schema:'worldlaw.periodic-origin-dynamics-experiment/v1',originalModel:original,initial:structuredClone(initial),reservedWork,trajectory:result.trajectory.map(r=>({...r,positionOrigin:initial.position,positionDelta:r.position,position:initial.position+r.position,retainedResponse:point(options.command??0,r.position,r.rate).response})),interpretation:'Original retained coordinate evaluated by bounded compensated trigonometric arithmetic. Maintained adaptive RK4 local estimates are not a global error bound; rounded positions can coincide. Every stage must remain within original bounds and one radian of its original anchor; failure returns no trajectory.'};
}
