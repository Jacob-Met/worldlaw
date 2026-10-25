import {saturatedProbeExample} from './probe-saturation-fixture.mjs';
// Authored controls; no future response is used by the prospective comparison.
export function saturatedRatePlanningExample(){
 const study=saturatedProbeExample(.28);study.runs=study.runs.filter(r=>r.role==='training');
 for(const run of study.runs){
  const previous=-.4*Math.tanh(run.probe.rate/.28),rate=Math.sign(run.probe.rate)*100;
  const baselineChange=-.2*(rate-run.probe.rate),response=-.4*Math.sign(rate);
  run.probe.rate=rate;
  for(const row of run.notebook.trials){row.rate=rate;row.jointTorque+=baselineChange;if(row.history==='conditioned')row.jointTorque+=response-previous;}
  run.notebook.sourceNote='Authored high-rate saturation ambiguity; independent original paired drift/noise. No physical acquisition.';
 }
 return study;
}
export function authoredSaturationObservation(request,scale=.1){
 const run=structuredClone(saturatedProbeExample(scale).runs[4]),old={...run.probe};
 const previous=-.4*Math.tanh(old.rate/scale),next=-.4*Math.tanh(request.protocol.probe.rate/scale);
 const baselineChange=-2*(Math.sin(request.protocol.probe.position)-Math.sin(old.position))-.2*(request.protocol.probe.rate-old.rate);
 run.id=request.protocol.runId;run.role='challenge';run.preparation={...request.protocol.preparation};run.probe={...request.protocol.probe};
 for(const row of run.notebook.trials){Object.assign(row,run.probe);row.jointTorque+=baselineChange;if(row.history==='conditioned')row.jointTorque+=next-previous;}
 run.notebook.sourceNote='Separate authored saturation outcome at scale '+scale+' rad/s for a frozen request. No physical acquisition or authenticity claim.';
 return {protocol:structuredClone(request.protocol),run};
}
export const SATURATION_RATE_EXAMPLE_SETTINGS={
 settings:{scaleMin:.05,scaleMax:1,scaleResolution:.001,maxBoxes:128,maxEvaluations:512},
 windows:[[.05,.2],[.5,1]],probes:[0,.1,.3,1,100].map((rate,i)=>({id:'rate-'+i,position:.6,rate,cost:1})),contrastRadius:.003,budget:1
};
