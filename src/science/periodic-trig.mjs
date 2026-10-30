// Isolated bounded research: no shared kernel or product adoption.
import {productPair} from './split-column.mjs';
export function sum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
export function add(a,b){const [s,e]=sum(a[0],b[0]);return sum(s,e+a[1]+b[1]);}
export function neg(a){return [-a[0],-a[1]];}
export function mul(a,b){return add(add(productPair(a[0],b[0]),productPair(a[0],b[1])),add(productPair(a[1],b[0]),productPair(a[1],b[1])));}
function divInt(a,n){const q=a[0]/n,r=add(a,neg(productPair(q,n)));return add([q,0],[(r[0]+r[1])/n,0]);}
const PI2=[1.5707963267948966,6.123233995736766e-17],TAIL=-1.4973849048591698e-33;
export function trigPair(x){
 if(!Number.isFinite(x)||Math.abs(x)>1e6)throw Error('Finite original angle within one million radians required');
 const k=Math.round(x/PI2[0]);let r=add([x,0],neg(mul([k,0],PI2)));r=add(r,productPair(-k,TAIL));
 const rr=neg(mul(r,r));let st=r,ct=[1,0],s=r,c=ct;
 for(let n=1;n<=18;n++){st=divInt(mul(st,rr),(2*n)*(2*n+1));ct=divInt(mul(ct,rr),(2*n-1)*(2*n));s=add(s,st);c=add(c,ct);}
 const quadrant=((k%4)+4)%4;return quadrant===0?{sin:s,cos:c}:quadrant===1?{sin:c,cos:neg(s)}:quadrant===2?{sin:neg(s),cos:neg(c)}:{sin:neg(c),cos:s};
}
export function retainedPeriodic(anchor,delta,g,c,b){
 if(![delta,g,c,b].every(Number.isFinite)||Math.abs(delta)>1||[g,c,b].some(x=>Math.abs(x)>1e8))throw Error('Bounded retained delta and coefficients required');
 const a=trigPair(anchor),d=trigPair(delta),half=trigPair(delta/2),A=add(mul([g,0],a.cos),neg(mul([c,0],a.sin))),B=add(mul([g,0],a.sin),mul([c,0],a.cos)),base=add(B,[b,0]),change=add(mul(A,d.sin),mul(B,mul([-2,0],mul(half.sin,half.sin))));
 return {value:add(base,change),increment:change,anchorValue:base,derivative:add(mul(A,d.cos),neg(mul(B,d.sin)))};
}
