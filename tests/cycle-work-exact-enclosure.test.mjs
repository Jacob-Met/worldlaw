import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCycle,cycleExample} from '../src/cycle-work/core.mjs';

// Every finite binary64 is an integer multiple of 2^-1074. Keep all oracle
// operations in that integer domain, including the returned interval endpoints.
// In particular, never round the exact work or bound through Number().
function exactUnits(value) {
  assert.ok(Number.isFinite(value),'Oracle inputs and interval endpoints must be finite.');
  const view=new DataView(new ArrayBuffer(8));
  view.setFloat64(0,value);
  const bits=view.getBigUint64(0),negative=bits>>63n;
  const exponent=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);
  const magnitude=exponent?((1n<<52n)+fraction)<<BigInt(exponent-1):fraction;
  return negative?-magnitude:magnitude;
}

function assertExactEnclosure(input,label) {
  const rows=input.samples,n=rows.length;
  const angles=rows.map(s=>exactUnits(s.position));
  const torques=rows.map(s=>exactUnits(s.jointTorque));
  const radii=rows.map(s=>exactUnits(s.torqueRadius));
  // These integer products represent work and its bound in units 2^-2149:
  // two factors of 2^-1074, followed by the coefficient's division by two.
  let work=0n,bound=0n;
  for(let i=0;i<n;i++){
    const delta=angles[Math.min(i+1,n-1)]-angles[Math.max(i-1,0)];
    work+=delta*torques[i];
    bound+=(delta<0n?-delta:delta)*radii[i];
  }
  bound+=exactUnits(input.integrationAllowance)<<1075n;
  const result=evaluateCycle(input);
  const lower=exactUnits(result.interval[0])<<1075n;
  const upper=exactUnits(result.interval[1])<<1075n;
  assert.ok(lower<=work-bound,`${label}: lower endpoint failed exact enclosure`);
  assert.ok(upper>=work+bound,`${label}: upper endpoint failed exact enclosure`);
}

test('160 exact binary64 enclosure cases retain mixed scales, subnormals and 4096 samples',()=>{
  let seed=418617;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const value=max=>{
    const kind=random();
    if(kind<.3)return (random()*2-1)*max;
    if(kind<.6)return (random()*2-1)*2**(-Math.floor(random()*1074));
    return (random()*2-1)*max*2**(-Math.floor(random()*60));
  };
  let subnormalInputs=0,maximumSamples=0;
  for(let trial=0;trial<160;trial++){
    const input=cycleExample(),n=trial===159?4096:3+Math.floor(random()*38);
    input.samples=Array.from({length:n},()=>({position:value(1e6),jointTorque:value(1e12),torqueRadius:Math.abs(value(1e12))}));
    input.samples.at(-1).position=input.samples[0].position;
    input.integrationAllowance=trial%3?0:Math.abs(value(1e12));
    for(const row of input.samples)for(const x of Object.values(row))if(x!==0&&Math.abs(x)<2**-1022)subnormalInputs++;
    maximumSamples=Math.max(maximumSamples,n);
    assertExactEnclosure(input,`seed 418617 trial ${trial}`);
  }
  assert.ok(subnormalInputs>0,'The deterministic course must exercise nonzero subnormal input values.');
  assert.equal(maximumSamples,4096);
});
