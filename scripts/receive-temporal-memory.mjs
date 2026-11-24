import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DECAYS,fitTemporalMemory,forecastTemporalMemory,relativeError} from '../src/science/temporal-memory.mjs';
const {observeStateOperatorWorld,outsideStateOperatorWorlds,stateOperatorPlan}=
  await import(pathToFileURL(resolve('.independent-state-nullgarden/src/state-operator-course.mjs')));
const original=outsideStateOperatorWorlds().find(w=>w.id==='outside_projected_lorenz');
assert.ok(original);
const local={id:'matched_local_cubic',kind:'oscillator',
  rhs:([x,v],u)=>[v,-1.1*x-.2*v-.14*x**3+.7*u]};
const dir='.receipts/temporal-memory';
mkdirSync(dir,{recursive:true});
const rows=[];
const arms=['local','transient','wrongHistory','memory'];
function fitSelect(train,sel,arm){
  let best;
  const trace=sel.observation.samples;
  const suffix=trace.slice(11),commands=suffix.map(x=>x.command);
  for(const lambda of arm==='local'?[1]:DECAYS){
    const m=fitTemporalMemory(train,arm,lambda);
    const p=forecastTemporalMemory(m,trace.slice(0,11),commands);
    const error=relativeError(p,suffix.map(x=>x.state));
    if(!best||error<best.error)best={m,error};
  }
  return best;
}
for(const world of [original,local])for(const snr of [15,25,40])for(const seed of [73001,73011,73021]){
  const episode=(label,offset)=>observeStateOperatorWorld(world,stateOperatorPlan('oscillator',label),snr,seed+offset);
  const train=[episode('train0',0),episode('train1',1)].map(e=>e.observation.samples);
  const sel=episode('selection',2);
  const fitted=Object.fromEntries(arms.map(arm=>[arm,fitSelect(train,sel,arm)]));
  const test=episode('test',3);
  const samples=test.observation.samples, prefix=samples.slice(0,11);
  const commands=samples.slice(11).map(x=>x.command);
  const predictions=Object.fromEntries(arms.map(arm=>[arm,forecastTemporalMemory(fitted[arm].m,prefix,commands)]));
  const key=[world.id,snr,seed].join('-');
  writeFileSync(dir+'/'+key+'-predictions.json',JSON.stringify(predictions));
  // Independent simulator truth first enters here, after every model and forecast has been frozen.
  const truth=test.reference.states.slice(11);
  const metrics={};
  for(const arm of arms){
    const f=fitted[arm],p=predictions[arm];
    metrics[arm]={lambda:f.m.lambda,coefficients:f.m.coefficients,sourceNuisance:f.m.trainingNuisance,
      prefixNuisance:p.g,selectionError:f.error,full:relativeError(p,truth),short:relativeError(p,truth,50),
      produced:p.states.length,diverged:p.diverged};
  }
  writeFileSync(dir+'/'+key+'-score.json',JSON.stringify({truth,metrics}));
  rows.push({world:world.id,snr,seed,metrics});
}
const summaries={};
for(const w of [original,local]){
  const sub=rows.filter(r=>r.world===w.id);
  summaries[w.id]={};
  for(const arm of arms){
    const vs=sub.map(r=>r.metrics[arm].full);
    summaries[w.id][arm]={mean:vs.reduce((a,b)=>a+b,0)/vs.length,
      worst:Math.max(...vs),shortMean:sub.reduce((s,r)=>s+r.metrics[arm].short,0)/sub.length,
      memoryWins:sub.filter(r=>r.metrics.memory.full<r.metrics[arm].full).length,
      divergences:sub.filter(r=>r.metrics[arm].diverged).length};
  }
}
const s=summaries[original.id];
const gate=arms.filter(a=>a!=='memory').every(a=>s.memory.mean<s[a].mean&&s[a].memoryWins>=7);
const report={schema:'worldlaw.temporal-memory-v1',reference:'4af7717a866e0246e7c0bcd81977cea53cddbd8c',
  trainingProfiles:['train0','train1'],selectionProfile:'selection',testProfile:'test',prefixSamples:11,
  predictedSamples:390,consultedCleanFitStates:0,decays:DECAYS,summaries,rows,gate,
  scope:'Two known mechanisms; no all-family discovery calibration or PDE qualification.'};
writeFileSync(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summaries,gate}));
