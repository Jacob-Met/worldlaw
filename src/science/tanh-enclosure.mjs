// Directed rational enclosures of tanh(x), x >= 0.
// Alternating exp series on [0,1], exact range reduction and outward dyadic
// rounding keep every intermediate bound inside the maintained arithmetic cap.
import {rational,add,sub,mul,div,cmp} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const ZERO=rational(0),ONE=rational(1),TWO=rational(2),GRID=1n<<96n;
const directed=(v,up)=>{if(v[0]<0n)throw Error('Positive rounding required');const n=v[0]*GRID,q=n/v[1],r=n%v[1];return [q+(up&&r?1n:0n),GRID];};
function expSmall(y){
 let term=ONE,sum=ONE,upper=ONE;
 for(let n=1;n<=21;n++){
  term=div(mul(term,y),rational(n));
  sum=n%2?sub(sum,term):add(sum,term);
  if(n===20)upper=sum;
 }
 return [directed(sum,false),directed(upper,true)];
}
export function tanhPositive(x){
 if(!Array.isArray(x)||x.length!==2||typeof x[0]!=='bigint'||typeof x[1]!=='bigint'||x[0]<0n||x[1]<=0n||x[0].toString(2).length>4096||x[1].toString(2).length>4096)throw Error('Use a bounded nonnegative rational argument.');
 if(!x[0])return [ZERO,ZERO];
 if(cmp(x,rational(32))>=0){
  // e > 2, hence exp(-2x) <= 2^-64 for x >= 32.
  const tail=rational(2**-64);
  return [div(sub(ONE,tail),add(ONE,tail)),ONE];
 }
 let y=mul(TWO,x),squarings=0;
 while(cmp(y,ONE)>0){y=div(y,TWO);squarings++;}
 const lo=directed(y,false),hi=directed(y,true);
 let a=expSmall(hi)[0],b=expSmall(lo)[1];
 for(let i=0;i<squarings;i++){a=directed(mul(a,a),false);b=directed(mul(b,b),true);}
 return [div(sub(ONE,b),add(ONE,b)),div(sub(ONE,a),add(ONE,a))];
}
