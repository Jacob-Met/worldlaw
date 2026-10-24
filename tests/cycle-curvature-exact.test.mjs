import test from 'node:test';
import assert from 'node:assert/strict';
import {curvatureWitness,inspectCurvatureWitnesses} from '../src/cycle-work/curvature-witness.mjs';
import {planRefinement,BRANCH_ASSUMPTION} from '../src/cycle-work/refinement.mjs';

// Independent oracle: rational divided differences, not the implementation's
// dyadic cross contrast. No rounded float conversion of expected quantities.
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b)[a,b]=[b,a%b];return a;};
const q=(n,d=1n)=>{if(d===0n)throw Error('zero denominator');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};};
const add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d),neg=a=>q(-a.n,a.d),sub=(a,b)=>add(a,neg(b));
const mul=(a,b)=>q(a.n*b.n,a.d*b.d),div=(a,b)=>q(a.n*b.d,a.d*b.n);
const cmp=(a,b)=>{const v=a.n*b.d-b.n*a.d;return v<0n?-1:v>0n?1:0;};
const dyad=(n,p)=>p>=0?q(n<<BigInt(p)):q(n,1n<<BigInt(-p));
function exact(x){
 assert.ok(Number.isFinite(x));const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,x,false);
 const b=d.getBigUint64(0,false),e=Number((b>>52n)&2047n),f=b&((1n<<52n)-1n);
 return dyad((b>>63n?-1n:1n)*(e?f+(1n<<52n):f),e?e-1075:-1074);
}
function divided(points,ys){
 const h0=sub(exact(points[1].position),exact(points[0].position)),h1=sub(exact(points[2].position),exact(points[1].position));
 return div(mul(q(2n),sub(div(sub(ys[2],ys[1]),h1),div(sub(ys[1],ys[0]),h0))),add(h0,h1));
}
function oracle(points,M){
 const corners=Array.from({length:8},(_,mask)=>divided(points,points.map((p,i)=>add(exact(p.jointTorque),mul(q(mask&(1<<i)?1n:-1n),exact(p.torqueRadius))))));
 const lo=corners.reduce((a,b)=>cmp(a,b)<0?a:b),hi=corners.reduce((a,b)=>cmp(a,b)>0?a:b);
 return {corners,lo,hi,contradicted:cmp(lo,exact(M))>0||cmp(hi,neg(exact(M)))<0};
}
function check(points,M){
 const expected=oracle(points,M),actual=curvatureWitness(points,M);
 assert.equal(actual.status,expected.contradicted?'contradicted':'not-contradicted',JSON.stringify({points,M}));
 for(const v of Object.values(actual.exact)){assert.equal(typeof v.integer,'string');assert.ok(Number.isInteger(v.powerOfTwo));}
 const decoded=v=>dyad(BigInt(v.integer),v.powerOfTwo);
 const h0=sub(exact(points[1].position),exact(points[0].position)),h1=sub(exact(points[2].position),exact(points[1].position));
 const absolute=v=>v.n<0n?neg(v):v;
 const factor=div(absolute(mul(mul(h0,h1),add(h0,h1))),q(2n));
 const nominal=divided(points,points.map(p=>exact(p.jointTorque)));
 assert.equal(cmp(decoded(actual.exact.contrast),neg(mul(nominal,factor))),0);
 assert.equal(cmp(decoded(actual.exact.readingBound),mul(div(sub(expected.hi,expected.lo),q(2n)),factor)),0);
 assert.equal(cmp(decoded(actual.exact.curvatureBound),mul(exact(M),factor)),0);
 return {expected,actual};
}
const points=(xs,ys,rs=[0,0,0])=>xs.map((position,i)=>({position,jointTorque:ys[i],torqueRadius:rs[i]}));

test('exact unequal spacings, equality, strict contradiction and monotone reversal',()=>{
 const p=points([0,1,3],[0,1,9]);
 assert.equal(check(p,2).actual.status,'not-contradicted');
 assert.equal(check(p,2-2**-52).actual.status,'contradicted');
 check([...p].reverse(),2);check([...p].reverse(),2-2**-52);
 const wide=points([-100,1,700],[-200,2,1400]);assert.equal(check(wide,0).actual.status,'not-contradicted');
});
test('torque boxes attain all eight exact rational corner values',()=>{
 const p=points([0,1,3],[0,1,9],[1,1,1]),o=check(p,0).expected;
 assert.equal(cmp(o.lo,q(0n)),0);assert.equal(cmp(o.hi,q(4n)),0);
 for(let mask=0;mask<8;mask++){
  const corner=p.map((r,i)=>({...r,jointTorque:r.jointTorque+(mask&(1<<i)?1:-1),torqueRadius:0}));
  const r=check(corner,2);assert.equal(cmp(r.expected.lo,o.corners[mask]),0);
 }
});
test('large common offsets, adjacent floats and subnormals retain exact decisions',()=>{
 for(const offset of [0,2**39,-(2**39)])check(points([0,1,3],[offset,offset+1,offset+9]),2);
 check(points([1e6-2**-32,1e6-2**-33,1e6],[0,1,0]),1e12);
 check(points([0,Number.MIN_VALUE,2*Number.MIN_VALUE],[0,Number.MIN_VALUE,0]),1e12);
 check(points([0,Number.MIN_VALUE,2*Number.MIN_VALUE],[0,0,0]),0);
 check(points([-1e6,0,1e6],[1e12,-1e12,1e12],[1e12,1e12,1e12]),0);
});
test('deterministic mixed-scale boxes agree with independent rational interval oracle',()=>{
 let seed=418617;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<160;i++){
  const scale=2**((next()%36)-20),h0=(1+next()%8)*scale,h1=(1+next()%8)*scale;
  const xs=[0,h0,h0+h1],ys=xs.map(()=>((next()%65)-32)*2**((next()%41)-20));
  const rs=xs.map(()=>next()%3===0?0:(next()%8)*2**((next()%41)-20));
  const p=points(xs,ys,rs),M=(next()%16)*2**((next()%41)-20);check(p,M);check([...p].reverse(),M);
 }
});
test('turning and repeated-angle triples cannot be treated as one smooth branch',()=>{
 for(const xs of [[0,1,0],[0,0,1],[0,1,1]])assert.throws(()=>curvatureWitness(points(xs,[0,1,2]),2));
});
test('maintained plan witness identities stay inside original directed spans and do not bridge jumps',()=>{
 const cycle={schema:'worldlaw.cycle-work/v1',source:'Independent exact span control',units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:0,
  samples:points([0,2,2,0],[0,4,104,100],[0,0,0,0])};
 const curvature=[0,1,2].map(segment=>segment===1?{segment,kind:'zero-angle-jump'}:{segment,kind:'bounded-curvature',assumption:BRANCH_ASSUMPTION,maxSecondDerivative:2,source:'Declared exact polynomial control'});
 const plan=planRefinement(cycle,curvature,2);
 const readings=plan.requests.map((r,i)=>({...r,id:'independent-'+i,source:'Exact polynomial evaluation',jointTorque:r.position**2+(r.segment===2?100:0),torqueRadius:0}));
 const out=inspectCurvatureWitnesses(plan,[...readings].reverse());
 assert.equal(out.status,'not-contradicted-by-inspected-witnesses');assert.equal(out.witnesses.length,2);
 assert.deepEqual(out.witnesses.map(w=>w.identities),[['original:0','acquisition:independent-0','original:1'],['original:2','acquisition:independent-1','original:3']]);
 assert.equal(out.segments[1].status,'zero-angle-jump');
 const partial=inspectCurvatureWitnesses(plan,readings.slice(0,1));assert.equal(partial.untestedSegments,1);
 assert.equal(inspectCurvatureWitnesses(plan,[]).status,'insufficient-readings');
});
