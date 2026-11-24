import test from 'node:test';
import assert from 'node:assert/strict';
import {prefixForecast,shrinkPeriodicPrefix,independentTemporalEvidence} from '../src/science/temporal-evidence.mjs';

const n=8, model={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree:'field',weight:-.3}]};
function curve(){
  return {kind:'periodic',schema:'worldlaw.state-trajectory/v1',id:'blind',spacing:.25,
    samples:Array.from({length:260},(_,i)=>({time:.025*i,command:Array(n).fill(0),
      state:Array.from({length:n},(_,j)=>(.5+.3*Math.sin(j*2*Math.PI/n))*Math.exp(-.3*.025*i))}))};
}
test('post-prefix mutation cannot influence either forecast',()=>{
  const origin=curve(), altered=structuredClone(origin);
  for(const row of altered.samples.slice(11))row.state=row.state.map(x=>x+10);
  for(const shrink of [true,false]){
    const a=prefixForecast(model,origin,shrink),b=prefixForecast(model,altered,shrink);
    assert.deepEqual(a,b);assert.equal('rmse' in a,false);
  }
});
test('flat predictions offer no temporal information, and perfect ordered motion is detected',()=>{
  const r=curve(),matched=independentTemporalEvidence(model,r);
  assert.equal(matched.information,true);
  const zero={...model,terms:[]};
  assert.equal(independentTemporalEvidence(zero,r).information,false);
});
test('spatial shrink preserves mean, shifts and noiseless real Nyquist mode',()=>{
  const init=Array.from({length:n},(_,j)=>.7+.3*(-1)**j+.25*Math.cos(2*Math.PI*j/n));
  const rows=Array.from({length:11},()=>({state:init}));
  const clean=shrinkPeriodicPrefix(init,rows);
  assert.ok(init.every((v,i)=>Math.abs(v-clean[i])<1e-12));
  const probe=Array.from({length:11},(_,t)=>({state:init.map((x,i)=>x+.3*Math.sin(t*t+i))}));
  const shift=a=>[a.at(-1),...a.slice(0,-1)];
  const base=shrinkPeriodicPrefix(init,probe), moved=shrinkPeriodicPrefix(shift(init),probe.map(x=>({state:shift(x.state)})));
  assert.ok(shift(base).every((x,i)=>Math.abs(x-moved[i])<1e-12));
  assert.ok(Math.abs(init.reduce((a,b)=>a+b,0)-base.reduce((a,b)=>a+b,0))<1e-12);
});
