// Bounded native research prototype. Fixed 80-bit directed grid; no flow solver.
import {rational,add,sub,mul,div,cmp,enclosure} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const S=1n<<80n, CAP=100000, RESERVE=80000;
const floor=(n,d)=>n>=0n?n/d:-((-n+d-1n)/d);
export function confineDampedSine(input){
 let work=0,maxBits=0,potentials=0;
 const use=()=>{if(++work>CAP)throw Error('operation_budget');};
 const box=(lo,hi)=>{use();for(const n of [lo,hi]){const bits=(n<0n?-n:n).toString(2).length;maxBits=Math.max(maxBits,bits);if(bits>256)throw Error('endpoint_bits');}if(lo>hi)throw Error('interval_order');return [lo,hi];};
 const from=q=>box(floor(q[0]*S,q[1]),-floor(-q[0]*S,q[1]));
 const point=n=>from(rational(n));
 const plus=(a,b)=>{use();return box(a[0]+b[0],a[1]+b[1]);};
 const neg=a=>{use();return box(-a[1],-a[0]);};
 const minus=(a,b)=>plus(a,neg(b));
 const times=(a,b)=>{use();const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]],lo=v.reduce((x,y)=>x<y?x:y),hi=v.reduce((x,y)=>x>y?x:y);return box(floor(lo,S),-floor(-hi,S));};
 const divide=(a,n)=>{use();return box(floor(a[0],n),-floor(-a[1],n));};
 const output=a=>[enclosure([a[0],S]).lower,enclosure([a[1],S]).upper];
 const maxQ=(a,b)=>cmp(a,b)>=0?a:b,abs=q=>[q[0]<0n?-q[0]:q[0],q[1]];
 const decode=x=>{if(!x||typeof x.numerator!=='string'||typeof x.denominator!=='string'||x.numerator.length>1235||x.denominator.length>1235||!/^[-]?\d+$/.test(x.numerator)||!/^\d+$/.test(x.denominator))throw Error('rational_input');const q=[BigInt(x.numerator),BigInt(x.denominator)];if(q[1]<=0n||abs(q)[0].toString(2).length>4096||q[1].toString(2).length>4096)throw Error('rational_bits');return q;};
 function cosine(q){
  const a=from(q),x=box(a[0],a[0]),z=times(x,x);let term=point(1),total=term;
  for(let j=1;j<=64;j++){term=divide(neg(times(term,z)),BigInt((2*j-1)*(2*j)));total=plus(total,term);}
  let tail=point(1);const magnitude=box(x[0]<0n?-x[0]:x[0],x[0]<0n?-x[0]:x[0]);
  for(let j=1;j<=129;j++)tail=divide(times(tail,magnitude),BigInt(j));
  const error=tail[1]+a[1]-a[0];return box(total[0]-error < -S?-S:total[0]-error,total[1]+error>S?S:total[1]+error);
 }
 const receipt=(status,reason,fields={})=>({status,reason,operations:work,maxEndpointBits:maxBits,potentialEvaluations:potentials,reservation:RESERVE,cap:CAP,...fields});
 try{
  if(!input?.law)throw Error('unsupported_terms');
  const lawKeys=Object.keys(input.law);if(lawKeys.length!==2||lawKeys.sort().join(',')!=='gravity,rate')throw Error('unsupported_terms');
  const {rate,gravity}=input.law;if(typeof rate!=='number'||typeof gravity!=='number'||!Number.isFinite(rate)||!Number.isFinite(gravity)||rate>0||gravity>=0)throw Error('unsupported_law');
  const positionBounds=input?.box?.position?.covered,rateBounds=input?.box?.rate?.covered;
  if(!Array.isArray(positionBounds)||positionBounds.length!==2||!Array.isArray(rateBounds)||rateBounds.length!==2)throw Error('box_shape');
  const q=positionBounds.map(decode),v=rateBounds.map(decode);if(cmp(q[0],q[1])>0||cmp(v[0],v[1])>0)throw Error('box_order');
  const M=maxQ(abs(q[0]),abs(q[1])),V=maxQ(abs(v[0]),abs(v[1]));
  // Fixed bounded preprocessing uses maintained exact rationals; count separately.
  function atan(n){const x=[1n,n];let t=x,sum=[0n,1n];for(let j=0;j<32;j++){const term=div(t,[BigInt(2*j+1),1n]);sum=j%2?sub(sum,term):add(sum,term);t=mul(t,mul(x,x));}return [sum,add(sum,div(t,[65n,1n]))];}
  const a=atan(5n),b=atan(239n),pi=from(sub(mul([16n,1n],a[0]),mul([4n,1n],b[1]))),piLo=[pi[0],S];
  if(cmp(M,piLo)>=0)throw Error('principal_well_not_proven');
  const k=point(-gravity);if(k[0]<=0n)throw Error('coefficient_resolution');
  const potential=q=>{potentials++;return times(k,minus(point(1),cosine(q)));};
  const vi=from(V),energy=plus(divide(times(vi,vi),2n),potential(M)),barrier=times(k,point(2));
  if(energy[1]>=barrier[0])throw Error('strict_energy_barrier_not_proven');
  const radicand=2n*energy[1]*S;let lo=0n,hi=1n<<BigInt(Math.ceil(radicand.toString(2).length/2));let sqrtIterations=0;
  while(hi-lo>1n){if(++sqrtIterations>256)throw Error('sqrt_budget');const mid=(lo+hi)/2n;if(mid*mid>=radicand)hi=mid;else lo=mid;}
  const speed=radicand===0n?0n:hi;if(speed*speed<radicand)throw Error('sqrt_proof');
  let Q=M,U=null,steps=0;
  if(V[0]){let lower=[0n,1n],upper=piLo;U=potential(upper);if(U[0]<energy[1])throw Error('angle_barrier_resolution');for(let j=0;j<64;j++){const mid=div(add(lower,upper),[2n,1n]),p=potential(mid);steps++;if(p[0]>=energy[1]){upper=mid;U=p;}else if(p[1]<energy[1])lower=mid;else break;}Q=upper;}
  const angle=from(Q),position=box(-angle[1],angle[1]),velocity=box(-speed,speed);
  if(work>RESERVE||potentials>66)throw Error('reservation');
  return receipt('confined','conditional exact autonomous law',{position:output(position),rate:output(velocity),energy:output(energy),positionRaw:position.map(String),rateRaw:velocity.map(String),energyRaw:energy.map(String),barrierRaw:barrier.map(String),upperPotentialRaw:U?.map(String)??null,angleSteps:steps,sqrtIterations,preprocessing:{atanTerms:32,atanSeries:2,sqrtIterationCap:256},meaning:'All-time exact-law conditional region, not phase, numerical-flow error, physical validation or joules.'});
 }catch(e){return receipt('unresolved',e.message,{position:null,rate:null});}
}
