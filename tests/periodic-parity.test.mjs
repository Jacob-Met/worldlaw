import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chooseParityProbe,fitParityDecay,modeRow,predictParityModes} from '../src/science/periodic-parity.mjs';

const n=32,h=.25,dt=.02,law={diffusivity:.08,halfShift:.3};
function record(id,modes,model=law) {
  return {id,schema:'worldlaw.state-trajectory/v1',kind:'periodic',spacing:h,
    samples:Array.from({length:201},(_,i)=>({time:i*dt,command:Array(n).fill(0),
      state:Array.from({length:n},(_,j)=>.6+modes.reduce((s,k)=>{
        const [mu,p]=modeRow(k,n,h);
        return s+.3*Math.sin(2*Math.PI*k*j/n+.2)*Math.exp(-i*dt*(mu*model.diffusivity+p*model.halfShift));
      },0))}))};
}
test('repeating one decay mode cannot resolve both mechanisms',()=>{
  const k=modeRow(3,n,h)[0],local={diffusivity:law.diffusivity+.6/k,halfShift:0};
  const a=record('a',[3]),b=record('b',[3],local);
  assert.ok(Math.max(...a.samples.map((r,i)=>Math.max(...r.state.map((x,j)=>Math.abs(x-b.samples[i].state[j])))))<1e-14);
  assert.equal(fitParityDecay([a,b],[[3],[3]]).status,'rank_deficient');
  assert.equal(chooseParityProbe([3],[[3],[2,3]],n,h).selected,1);
  assert.equal(chooseParityProbe([3],[[3]],n,h).selected,null);
});
test('a changed acquisition recovers both coefficients and predicts an unseen mode',()=>{
  const a=record('a',[3]),b=record('b',[2,3]),t=record('c',[1]);
  const r=fitParityDecay([a,b],[[3],[2,3]]);
  assert.equal(r.status,'two_rates_resolved');
  assert.ok(Math.abs(r.mixed.diffusivity-.08)<1e-8);
  assert.ok(Math.abs(r.mixed.halfShift-.3)<1e-8);
  const pred=predictParityModes(r.mixed,t.samples.slice(0,11),[t.samples[50].time],h,[1]);
  assert.ok(Math.max(...pred[0].map((x,j)=>Math.abs(x-t.samples[50].state[j])))<1e-8);
});
test('constant recordings, unsupported and malformed data refuse',()=>{
  assert.equal(fitParityDecay([record('empty',[])],[[1,2]]).status,'unresolved_decay_evidence');
  const fo=record('forced',[3]);fo.samples[0].command[5]=1;
  assert.throws(()=>fitParityDecay([fo],[[3]]),/zero command/);
  const fresh=record('first',[3]);
  assert.throws(()=>fitParityDecay([fresh,fresh],[[3],[3]]),/Duplicate/);
  assert.throws(()=>modeRow(16,n,h),/Nyquist/);
  assert.throws(()=>modeRow(2,31,h),/even/);
});
test('ordinary stdin CLI selects the rank-breaking experiment',()=>{
  const inp={operation:'design',observedModes:[3],menu:[[3],[2,3]],n,spacing:h};
  const cmd=new URL('../scripts/periodic-parity.mjs',import.meta.url);
  const out=JSON.parse(execFileSync(process.execPath,[cmd.pathname],{input:JSON.stringify(inp)}));
  assert.equal(out.selected,1);
});
