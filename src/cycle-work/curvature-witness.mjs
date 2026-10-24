/** Necessary curvature witnesses: exact dyadic decisions on admitted binary64 inputs. */
const check=(ok,message)=>{if(!ok)throw Error('Curvature witness: '+message);};
const zero={n:0n,e:0};
function dyadic(x){
 if(x===0)return zero;
 const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,x,false);
 const bits=v.getBigUint64(0,false),negative=(bits>>63n)!==0n;
 const exponent=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);
 const n=exponent===0?fraction:(1n<<52n)|fraction;
 return {n:negative?-n:n,e:exponent===0?-1074:exponent-1023-52};
}
const abs=d=>({n:d.n<0n?-d.n:d.n,e:d.e});
function add(a,b){if(a.n===0n)return b;if(b.n===0n)return a;const e=Math.min(a.e,b.e);return {n:(a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e)),e};}
const sub=(a,b)=>add(a,{n:-b.n,e:b.e});
const mul=(a,b)=>({n:a.n*b.n,e:a.e+b.e});
const cmp=(a,b)=>{const d=sub(a,b);return d.n<0n?-1:d.n>0n?1:0;};
const exact=d=>({integer:d.n.toString(),powerOfTwo:d.e});
function display(d){
 if(d.n===0n)return '0';
 const n=abs(d).n,bits=n.toString(2).length,shift=Math.max(0,bits-53);
 const top=Number(n>>BigInt(shift)),value=top*2**(d.e+shift),sign=d.n<0n?'-':'';
 if(Number.isFinite(value)&&value!==0)return sign+value.toPrecision(7);
 return sign+(top/2**(bits-shift-1)).toPrecision(7)+' × 2^'+(d.e+bits-1);
}
export function curvatureWitness(points,maxSecondDerivative){
 check(Array.isArray(points)&&points.length===3,'three observed points are required.');
 check(typeof maxSecondDerivative==='number'&&Number.isFinite(maxSecondDerivative)&&maxSecondDerivative>=0&&maxSecondDerivative<=1e12,'invalid curvature bound.');
 for(const p of points)check(p&&typeof p.position==='number'&&Number.isFinite(p.position)&&Math.abs(p.position)<=1e6&&typeof p.jointTorque==='number'&&Number.isFinite(p.jointTorque)&&Math.abs(p.jointTorque)<=1e12&&typeof p.torqueRadius==='number'&&Number.isFinite(p.torqueRadius)&&p.torqueRadius>=0&&p.torqueRadius<=1e12,'invalid observed point or torque radius.');
 const [a,b,c]=points;
 check((a.position<b.position&&b.position<c.position)||(a.position>b.position&&b.position>c.position),'angles must be distinct and monotone within one original segment.');
 const h1=abs(sub(dyadic(b.position),dyadic(a.position))),h2=abs(sub(dyadic(c.position),dyadic(b.position))),H=add(h1,h2);
 const contrast=sub(sub(mul(H,dyadic(b.jointTorque)),mul(h2,dyadic(a.jointTorque))),mul(h1,dyadic(c.jointTorque)));
 const readingBound=add(add(mul(H,dyadic(b.torqueRadius)),mul(h2,dyadic(a.torqueRadius))),mul(h1,dyadic(c.torqueRadius)));
 const product=mul(mul(mul(dyadic(maxSecondDerivative),H),h1),h2),curvatureBound={n:product.n,e:product.e-1};
 const lower=sub(abs(contrast),readingBound),minimumMagnitude=lower.n>0n?lower:zero;
 return {status:cmp(minimumMagnitude,curvatureBound)>0?'contradicted':'not-contradicted',positions:points.map(p=>p.position),maxSecondDerivative,
  exact:{contrast:exact(contrast),readingBound:exact(readingBound),curvatureBound:exact(curvatureBound),minimumMagnitude:exact(minimumMagnitude)},
  display:{contrast:display(contrast),readingBound:display(readingBound),curvatureBound:display(curvatureBound),minimumMagnitude:display(minimumMagnitude)},
  units:'cross-multiplied contrast in N·m·rad',arithmetic:'Exact dyadic arithmetic on admitted binary64 inputs. Display values are approximate and never decide the verdict.'};
}
/** Caller supplies the already validated refinement plan and admitted keyed readings. */
export function inspectCurvatureWitnesses(plan,readings){
 const original=plan.request.cycle,segments=[],witnesses=[];
 for(const segment of plan.segments){
  if(segment.a===segment.b){segments.push({segment:segment.segment,status:'zero-angle-jump',witnesses:0});continue;}
  const i=segment.segment,observed=readings.filter(r=>r.segment===i).sort((a,b)=>a.index-b.index);
  const points=[{...original.samples[i],identity:'original:'+i},...observed.map(r=>({...r,identity:'acquisition:'+r.id})),{...original.samples[i+1],identity:'original:'+(i+1)}];
  let contradicted=false;
  for(let j=1;j<points.length-1;j++){const triple=points.slice(j-1,j+2),w=curvatureWitness(triple,segment.m);witnesses.push({segment:i,identities:triple.map(p=>p.identity),...w});contradicted ||= w.status==='contradicted';}
  segments.push({segment:i,status:contradicted?'contradicted':points.length<3?'insufficient-readings':'not-contradicted',witnesses:Math.max(0,points.length-2)});
 }
 return {status:witnesses.some(w=>w.status==='contradicted')?'contradicted':witnesses.length?'not-contradicted-by-inspected-witnesses':'insufficient-readings',
  segments,witnesses,contradictions:witnesses.filter(w=>w.status==='contradicted').length,untestedSegments:segments.filter(s=>s.status==='insufficient-readings').length,
  scope:'Consecutive triples within each original directed segment only. Compatibility is necessary, not sufficient for a joint smooth response; it does not authenticate curvature, exact angles, branch identity or acquisition.'};
}
