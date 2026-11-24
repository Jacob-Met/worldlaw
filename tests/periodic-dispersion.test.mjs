import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dispersiveRhs,fitDispersiveProbe,predictDispersiveProbe} from '../src/science/periodic-dispersion.mjs';
const n=32,h=.25,mu8=32,truth={a:0,b:-.06,c:-.3},twin={a:.06*mu8,b:0,c:-.3};
const maximum=a=>Math.max(...a.map(Math.abs));
function quarter(phase){
  return Array.from({length:n},(_,j)=>.3+.35*Math.sin(j*Math.PI/2+phase));
}
function obs(id,phase){
  return {id,schema:'worldlaw.state-trajectory/v1',kind:'periodic',spacing:h,
    samples:Array.from({length:201},(_,i)=>({time:i*.01,state:quarter(phase+6.96*.01*i),command:Array(n).fill(0)}))};
}
test('nonlinear quarter-mode equality persists at distinct phases and includes the Nyquist harmonic',()=>{
  for(const phase of [.1,.4,.9,1.4,2.7]){
    const f=quarter(phase),a=dispersiveRhs(f,h,truth),b=dispersiveRhs(f,h,twin);
    assert.ok(maximum(a.map((v,i)=>v-b[i]))<1e-13);
  }
  const first=obs('a',.4),second=obs('b',.9);
  const fit=fitDispersiveProbe([first,second],[[8],[8]]);
  assert.equal(fit.status,'rank_deficient');
  assert.ok(Math.abs(fit.repeatLocal.a-1.74)<2e-4);
});
test('a radius-two material change leaves the local triplet untouched and changes its derivative by −.384',()=>{
  const f=quarter(.4), changed=f.slice();changed[2]+=.2;
  assert.deepEqual([changed[31],changed[0],changed[1]],[f[31],f[0],f[1]]);
  assert.equal(dispersiveRhs(changed,h,twin)[0],dispersiveRhs(f,h,twin)[0]);
  assert.ok(Math.abs(dispersiveRhs(changed,h,truth)[0]-dispersiveRhs(f,h,truth)[0]+.384)<1e-13);
});
test('forecast has no suffix channel and invalid commands are rejected through the CLI',()=>{
  const a=obs('a',.4),p=a.samples.slice(0,11);
  const answer=predictDispersiveProbe(truth,p,h,5);
  assert.equal(answer.status,'forecast'); assert.equal(answer.states.length,5);
  assert.ok(maximum(answer.states[4].map((v,j)=>v-a.samples[15].state[j]))<.001);
  a.samples[80].command[1]=1;
  assert.throws(()=>execFileSync(process.execPath,[new URL('../scripts/periodic-dispersion.mjs',import.meta.url).pathname],
    {input:JSON.stringify({operation:'fit',recordings:[a],modes:[[8]]}),stdio:['pipe','pipe','pipe']}),/Command failed/);
});
