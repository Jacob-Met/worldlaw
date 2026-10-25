import {probeExample} from './probe-fixture.mjs';
import {SATURATED_PROBE_SCHEMA} from './probe-response.mjs';
// Authored constitutive response, preserving the original independent drift/noise.
export function saturatedProbeExample(scale=.2){
 if(!Number.isFinite(scale)||scale<=0)throw Error('Use a positive authored response scale.');
 const study=probeExample('drag');
 for(const [i,run] of study.runs.entries()){
  run.id='authored-saturated-'+i;
  const previous=-.7*run.probe.rate,response=-.4*Math.tanh(run.probe.rate/scale);
  for(const row of run.notebook.trials)if(row.history==='conditioned')row.jointTorque+=response-previous;
  run.notebook.sourceNote='Authored smooth saturated-rate control; original paired drift and deterministic perturbations retained. No physical acquisition.';
 }
 return {...study,schema:SATURATED_PROBE_SCHEMA,rateSaturationScales:[.1,.2,.4]};
}
