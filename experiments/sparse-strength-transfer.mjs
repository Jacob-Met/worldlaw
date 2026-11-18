// Preregistered source 77dc69a8, attachment att-mwmh9bu3npqwuh.
// Run with node experiments/sparse-strength-transfer.mjs > report.json.
import {planSparseStrength, fitSparseStrength} from '../src/trajectory/sparse-strength.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const scales = [.75,.875,1,1.125,1.25], seeds = [991721,991733,991747,991771];
const nominal = {schema:'worldlaw.torque-model/v1', id:'gravity+rate', units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'},
  terms:[{id:'gravity',coefficient:-2.2},{id:'rate',coefficient:-.24}]};
const evaluation = {initialPosition:1.65,initialRate:-.4};
function integrate(scale, release, indices) {
  let q = release.initialPosition, w = release.initialRate;
  const dt=.0005, result=[];
  const acceleration=(angle,velocity)=>scale*(-2.2*Math.sin(angle)-.24*velocity)/.8;
  for (let i=1; i<=indices.at(-1)*100; i++) {
    const k1=acceleration(q,w), v2=w+dt*k1/2, k2=acceleration(q+dt*w/2,v2);
    const v3=w+dt*k2/2, k3=acceleration(q+dt*v2/2,v3);
    const v4=w+dt*k3, k4=acceleration(q+dt*v3,v4);
    q+=dt*(w+2*v2+2*v3+v4)/6;
    w+=dt*(k1+2*k2+2*k3+k4)/6;
    if (i%100===0 && indices.includes(i/100)) result.push(q);
  }
  return result;
}
function randomNormal(seed) {
  let s=seed;
  const uniform=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)+.5)/4294967296;
  return ()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
}
function acquire(plan, truth, seed) {
  return plan.releases.map(({request},j)=>{
    const indices=request.sampleIndices, values=integrate(truth,request,indices), normal=randomNormal(seed+1009*j);
    return {schema:'worldlaw.virtual-pendulum-sparse/v1',kind:'synthetic',units:{time:'s',position:'rad',initialRate:'rad/s',command:'N·m',inertia:'kg·m²'},
      inertia:.8,initialPosition:request.initialPosition,initialRate:request.initialRate,measurementCount:indices.length,
      source:{instrumentId:'independent-explicit-scale-oscillator/v1',recordingId:'release-'+j, duration:2,sampleInterval:.05,
        positionNoiseSigma:plan.noiseSigma,sampleIndices:indices,measuredSampleCount:indices.length,
        noise:{noiseStreamId:String(seed+1009*j),selectedOnly:true,measurementDrawCount:indices.length}},
      readings:values.map((value,i)=>({sampleIndex:indices[i],time:indices[i]/20,command:0,position:value+normal()*plan.noiseSigma}))};
  });
}
const grid=Array.from({length:48},(_,i)=>i+1);
const forecasts=new Map(scales.map(scale=>{
  const model={...nominal,terms:nominal.terms.map(term=>({...term,coefficient:scale*term.coefficient}))};
  const run={id:'reserved-release',label:'Held-out release',kind:'synthetic',source:{label:'Prediction inputs'},inertia:.8,initialRate:evaluation.initialRate,
    samples:[0,...grid].map(i=>({time:i/20,position:evaluation.initialPosition,command:0}))};
  return [scale,rollout(model,run,{maxStep:.0025}).rows.slice(1).map(row=>row.predicted)];
}));
const rmse=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0)/a.length);
const trials=[];
for (const sigma of [.002,.012]) {
  const plan=planSparseStrength(nominal,sigma), uniformPlan=planSparseStrength(nominal,sigma,'uniform');
  for (const truth of [...scales,.8125,1.1875]) for(const [j,seed] of seeds.entries()) {
    const readings=acquire(plan,truth,seed), uniformReadings=acquire(uniformPlan,truth,seed);
    const sham=readings.map(r=>({...r,readings:r.readings.map((reading,i)=>({...reading,position:r.readings.at(-1-i).position}))}));
    const fits={paired:fitSparseStrength(plan,readings),first:fitSparseStrength(plan,[readings[0]]),
      uniform:fitSparseStrength(uniformPlan,uniformReadings),sham:fitSparseStrength(plan,sham)};
    const withheld=integrate(truth,evaluation,grid);
    const report=Object.fromEntries(Object.entries(fits).map(([key,f])=>[key,{selected:f.selectedScale,status:f.status,
      compatible:f.compatibleScales,readings:f.readings,profile:f.profile,rmse:rmse(forecasts.get(f.selectedScale??1),withheld)}]));
    const rotated=scales.includes(truth)?scales[(scales.indexOf(truth)+1+(j+(sigma===.012?1:0))%4)%5]:null;
    trials.push({truth,sigma,seed,rotated,nominalRMSE:rmse(forecasts.get(1),withheld),...report});
  }
}
function median(xs){const ys=[...xs].sort((a,b)=>a-b);return (ys[(ys.length-1)>>1]+ys[ys.length>>1])/2;}
const primary=trials.filter(r=>r.rotated!==null),offgrid=trials.filter(r=>r.rotated===null);
function summary(rows){
  return Object.fromEntries(['paired','uniform','first','sham'].map(key=>[key,{
    correct:rows.filter(r=>r[key].selected===r.truth).length,abstained:rows.filter(r=>r[key].selected===null).length,
    medianRMSE:median(rows.map(r=>r[key].rmse)),worseByOver02:rows.filter(r=>r[key].rmse-r.nominalRMSE>.02).length,
    nullMatches:rows.filter(r=>r.rotated!==null && r[key].selected===r.rotated).length}]));
}
const scores=summary(primary),baseline=median(primary.map(r=>r.nominalRMSE));
console.log(JSON.stringify({source:'77dc69a8128f2aa38ba925c375e24c7ce1e797e5',qualification:'conditional synthetic common multiplier',
  missingSelection:'Revert to the nominal forecast for prediction risk; an abstention is an identification failure.',
  noise:'Matched ordinal Gaussian perturbations between prospective strategies; four draws per release.',
  null:'Prespecified nonzero cyclic rotations per seed and noise condition; a label-alignment control.',
  primary:scores,offgrid:summary(offgrid),nominalMedianRMSE:baseline,passes:scores.paired.correct>=32 &&
    scores.paired.medianRMSE<=.8*baseline && scores.paired.worseByOver02<=4 && scores.paired.nullMatches<=16,trials},null,2));
