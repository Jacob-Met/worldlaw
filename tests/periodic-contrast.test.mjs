import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge,evaluateHistory} from '../src/unknown-lab/paired-history.mjs';
import {inspectPeriodicContrast as inspect,PERIODIC_CONTRAST_SCHEMA} from '../src/unknown-lab/periodic-contrast.mjs';
const request=(options={})=>({schema:PERIODIC_CONTRAST_SCHEMA,notebook:syntheticChallenge({count:16,effect:0,cycleDriftAmplitude:.3,orderStrategy:'alternating',...options}),sourceNote:'Authored sensor amplitude bound; not calibration.',periodUnit:'acquisition_steps',amplitudeUnit:'N*m',components:[{period:4,amplitudeBound:.3}]});
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('retains original zero-memory false challenge while admitting bounded artifact explanation',()=>{
 const input=request(),before=JSON.stringify(input),r=inspect(input);
 assert.equal(r.original.verdict,'challenged');assert.equal(r.status,'artifact-sensitive-or-unresolved');
 close(r.biasBound,.3*Math.SQRT2);assert.ok(r.screenedInterval[0]<0);
 assert.deepEqual(r.original,evaluateHistory(input.notebook));assert.equal(JSON.stringify(input),before);
 assert.deepEqual(inspect(JSON.parse(JSON.stringify(r.inputs))),r);
});
test('phase witness attains summed bound on actual recorded indices; direct phase sweep agrees',()=>{
 const input=request();input.components.push({period:5.2,amplitudeBound:.17});const r=inspect(input);
 close(r.witnessContrast,r.biasBound);close(r.witnessResidual,0);
 const n=input.notebook.trials;const ab=n.filter(x=>x.history==='reference'&&n.find(y=>y.pairId===x.pairId&&y.history==='conditioned').sampleIndex>x.sampleIndex).length;
 for(const artifact of r.artifacts){
  let best=0;
  for(let j=0;j<10000;j++){
   let plus=0,minus=0;
   for(const ref of n.filter(x=>x.history==='reference')){
    const c=n.find(y=>y.pairId===ref.pairId&&y.history==='conditioned');
    const f=i=>artifact.amplitudeBound*Math.cos(2*Math.PI*(i-r.origin)/artifact.period+j*2*Math.PI/10000);
    const d=f(c.sampleIndex)-f(ref.sampleIndex);if(ref.sampleIndex<c.sampleIndex)plus+=d;else minus+=d;
   }
   best=Math.max(best,(plus/ab+minus/(n.length/2-ab))/2);
  }
  close(best,artifact.biasBound,1e-7);
 }
});
test('larger genuine contrast survives; zero bounds reproduce original screen and changed periods matter',()=>{
 const r=inspect(request({effect:2}));assert.equal(r.status,'contrast-remains-outside-screen');
 const raw=request();raw.components[0].amplitudeBound=0;const zero=inspect(raw);
 assert.equal(zero.biasBound,0);assert.deepEqual(zero.screenedInterval,zero.original.interval);
 raw.components[0]={period:4.2,amplitudeBound:.3};assert.notEqual(inspect(raw).biasBound,inspect(request()).biasBound);
});
test('origin translation preserves gain, gapped indices use actual spacing, input edits are recomputed',()=>{
 const raw=request(),r=inspect(raw);for(const t of raw.notebook.trials)t.sampleIndex+=100000;
 close(inspect(raw).biasBound,r.biasBound);
 for(const t of raw.notebook.trials)t.sampleIndex+=Math.floor((t.sampleIndex-100000)/2)*2;
 const next=inspect(raw);assert.notEqual(next.biasBound,r.biasBound);
 close(next.witnessContrast,next.biasBound);
});
test('refuses inadequate order, stale unit declarations and malformed bounds without dropping observations',()=>{
 const cases=[x=>x.notebook=syntheticChallenge({orderStrategy:'oneway'}),x=>x.periodUnit='seconds',x=>x.amplitudeUnit='Nm',x=>x.components[0].period=NaN,x=>x.components[0].amplitudeBound=-1,x=>x.components.push({...x.components[0]}),x=>x.components=Array(2),x=>x.sourceNote='',x=>x.notebook.trials.forEach(t=>delete t.sampleIndex),x=>x.notebook.trials.slice(-2).forEach(t=>t.sampleIndex+=1000001)];
 for(const edit of cases){const x=request();edit(x);assert.throws(()=>inspect(x));}
});
test('unequal counterbalance uses group means and a constant sampled component cancels',()=>{
 const raw=request();
 for(let i=0;i<raw.notebook.trials.length/2;i++){
  const ref=raw.notebook.trials[2*i],conditioned=raw.notebook.trials[2*i+1];
  ref.sampleIndex=2*i+(i<12?0:1);conditioned.sampleIndex=2*i+(i<12?1:0);
 }
 raw.components=[{period:1,amplitudeBound:10},{period:5.3,amplitudeBound:.7}];
 const r=inspect(raw);close(r.artifacts[0].gain,0);
 let ab=0,ba=0;
 for(let i=0;i<16;i++){
  const ref=r.witness.find(w=>w.sampleIndex===raw.notebook.trials[2*i].sampleIndex);
  const conditioned=r.witness.find(w=>w.sampleIndex===raw.notebook.trials[2*i+1].sampleIndex);
  if(i<12)ab+=conditioned.sensorOffset-ref.sensorOffset;else ba+=conditioned.sensorOffset-ref.sensorOffset;
 }
 close((ab/12+ba/4)/2,r.biasBound);
});
