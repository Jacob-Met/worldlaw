import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAngleBoxes,evaluateAngleBoxWitness} from '../src/cycle-work/angle-boxes.mjs';

// Independent exhaustive vertex oracle, using a fixed exact unit of 2^-1074
// for each binary64 input. Work uses 2^-2149. No production DP, endpoint helper,
// common-exponent selection, displayed decimal, or float oracle conversion.
function units(value){const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,value);const b=d.getBigUint64(0),e=Number((b>>52n)&2047n),f=b&((1n<<52n)-1n);return (b>>63n?-1n:1n)*(e?(f+(1n<<52n))<<BigInt(e-1):f);}
const workUnits=v=>BigInt(v.integer)<<BigInt(v.powerOfTwo+2149);
function endpoints(raw){return raw.cycle.samples.map((r,i)=>({x:[units(r.position)-units(raw.positionRadii[i]),units(r.position)+units(raw.positionRadii[i])],y:[units(r.jointTorque)-units(r.torqueRadius),units(r.jointTorque)+units(r.torqueRadius)]}));}
function path(data,flags){let sum=0n;for(let i=1;i<data.length;i++)sum+=(data[i].x[flags[i]>>1]-data[i-1].x[flags[i-1]>>1])*(data[i].y[flags[i]&1]+data[i-1].y[flags[i-1]&1]);return sum;}
function exhaustive(raw){const data=endpoints(raw),flags=Array(data.length);let lo=null,hi=null,visits=0;
 function visit(i){if(i===flags.length){if((flags[0]>>1)!==(flags.at(-1)>>1))return;const w=path(data,flags);if(lo===null||w<lo)lo=w;if(hi===null||w>hi)hi=w;visits++;return;}for(let c=0;c<4;c++){flags[i]=c;visit(i+1);}}
 visit(0);return {lo,hi,visits,data};}
function check(raw){const before=JSON.stringify(raw),expected=exhaustive(raw),actual=analyzeAngleBoxes(raw);
 assert.equal(workUnits(actual.minimum.work),expected.lo);assert.equal(workUnits(actual.maximum.work),expected.hi);
 const allowance=units(raw.cycle.integrationAllowance)<<1075n;
 assert.equal(workUnits(actual.interval[0]),expected.lo-allowance);assert.equal(workUnits(actual.interval[1]),expected.hi+allowance);
 for(const key of ['minimum','maximum']){const w=actual[key];assert.equal(w.corners.length,raw.cycle.samples.length);assert.equal(w.corners[0]>>1,w.corners.at(-1)>>1);assert.equal(path(expected.data,w.corners),workUnits(w.work));assert.equal(workUnits(evaluateAngleBoxWitness(raw,w.corners)),workUnits(w.work));}
 assert.equal(actual.conclusion,expected.lo-allowance>0n?'positive-work':expected.hi+allowance<0n?'negative-work':'zero-compatible');assert.equal(JSON.stringify(raw),before);
 return {expected,actual};}
const fixture=(samples,radii,allowance=0)=>({schema:'worldlaw.cycle-angle-boxes/v1',assumption:'independent-row-boxes-with-shared-first-last-angle',radiusSource:'Independent exact box fixture',positionRadii:radii,cycle:{schema:'worldlaw.cycle-work/v1',source:'Authored numerical control',units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:allowance,samples:samples.map(([position,jointTorque,torqueRadius=0])=>({position,jointTorque,torqueRadius}))}});

test('exact exhaustive corners agree across48 seeded three-to-six-row paths',()=>{
 let seed=418617;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let k=0;k<48;k++){const n=3+k%4,rows=Array.from({length:n},()=>[(next()%17-8)/4,(next()%25-12)/8,(next()%5)/16]),r=Array.from({length:n},()=>next()%4/16);rows.at(-1)[0]=rows[0][0];rows[1][0]=rows[0][0]+1;r[n-1]=r[0];check(fixture(rows,r,k%3/8));}
});
test('interior repeated nominal angles remain independent while return angle is shared',()=>{
 check(fixture([[0,1,.25],[1,4,.5],[1,-3,.25],[0,2,.75]],[.125,.25,.5,.125]));
 check(fixture([[0,1,2],[1,0,1],[0,8,4]],[.5,.25,.5]));
});
test('sub-ulp endpoints and mixed subnormal/large scales preserve exact extrema',()=>{
 check(fixture([[999999,1e12,Number.MIN_VALUE],[1e6,-1e12,1],[999999,Number.MIN_VALUE,1e12]],[Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE]));
 check(fixture([[0,0,Number.MIN_VALUE],[Number.MIN_VALUE,Number.MIN_VALUE,0],[0,-Number.MIN_VALUE,Number.MIN_VALUE]],[Number.MIN_VALUE,0,Number.MIN_VALUE],Number.MIN_VALUE));
});
test('reversal negates extrema and zero-radius degenerate boxes still close',()=>{
 const raw=fixture([[0,1,.25],[2,4,.5],[-1,-2,.125],[0,3,1]],[.25,.5,.125,.25],.5),a=check(raw).actual;
 raw.cycle.samples.reverse();raw.positionRadii.reverse();const b=check(raw).actual;
 assert.equal(workUnits(b.minimum.work),-workUnits(a.maximum.work));assert.equal(workUnits(b.maximum.work),-workUnits(a.minimum.work));
 check(fixture([[0,1],[1,3],[0,1]],[0,0,0]));
});
