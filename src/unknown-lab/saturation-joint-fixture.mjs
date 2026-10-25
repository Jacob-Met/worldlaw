import{saturatedProbeExample}from'./probe-saturation-fixture.mjs';
// Synthetic adversarial control: each challenge separately permits a saturation
// scale, but they cannot share one amplitude/scale with the original training.
export function incompatibleSaturationChallenges(){
 const s=saturatedProbeExample(.28);s.runs=s.runs.slice(0,5);
 for(const [i,r]of s.runs.entries()){
  const previous=-.4*Math.tanh(r.probe.rate/.28),rate=i<3?Math.sign(r.probe.rate)*100:i===3?.1:.3;
  const response=i<3?-.4*Math.sign(rate):-.4*Math.tanh(rate/(i===3?.1:.5));
  r.probe.rate=rate;
  for(const t of r.notebook.trials){t.rate=rate;if(t.history==='conditioned')t.jointTorque+=response-previous;}
  r.notebook.sourceNote='Authored inconsistent continuous saturation control. Independent paired noise/drift retained; no physical acquisition.';
 }
 return s;
}
