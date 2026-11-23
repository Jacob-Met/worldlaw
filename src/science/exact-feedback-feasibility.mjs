/** Exact intersection of affine halfspaces for the one-feedback planner. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
const {Q,Z,add,sub,mul,div}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const abs=x=>x<0n?-x:x;
export function feedbackGCD(a,b){
  a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;
}
const greater=(a,b)=>a.n*b.d>b.n*a.d;
function dot(a,x){
  return a.reduce((s,v,i)=>v?add(s,mul(Q(v),x[i])):s,Z());
}
export function feedbackPrimitive(a,b){
  const scale=a.reduce(feedbackGCD,0n)||1n;
  return {a:a.map(v=>v/scale),b:div(b,Q(scale)),scale};
}

// Divide positive weights by their common scale so that certificates can be
// retained as small integers even when the source rates are rational.
function integerWeights(terms){
  let denominator=1n;
  for(const [,v] of terms)denominator=denominator/feedbackGCD(denominator,v.d)*v.d;
  const out=terms.filter(([,v])=>v.n).map(([i,v])=>[i,v.n*(denominator/v.d)]);
  const g=out.reduce((s,[,v])=>feedbackGCD(s,v),0n);
  return out.map(([i,v])=>[i,v/g]);
}

// Incremental feasibility. When a new inequality cuts off the current
// solution, any remaining feasible region intersects that inequality's
// boundary: join the old solution to a hypothetical new feasible point.
export function intersectFeedbackHalfspaces(rows,width,spend){
  const strong=new Map();
  for(let i=0;i<rows.length;i++){
    spend();
    const {a,b}=rows[i],key=a.join(',');
    if(a.every(v=>v===0n)){if(b.n<0n)return {proof:[[i,1n]]};continue;}
    const old=strong.get(key);
    if(old===undefined||greater(rows[old].b,b))strong.set(key,i);
  }
  const active=[...strong.values()];
  for(const i of active){
    spend();
    const j=strong.get(rows[i].a.map(v=>-v).join(','));
    if(j!==undefined&&add(rows[i].b,rows[j].b).n<0n)return {proof:[[i,1n],[j,1n]]};
  }
  let point=Array.from({length:width},Z);
  for(const [at,i] of active.entries()){
    spend();
    const row=rows[i];
    if(!greater(dot(row.a,point),row.b))continue;
    const p=row.a.findIndex(v=>v!==0n),pivot=row.a[p],magnitude=abs(pivot),side=pivot<0n?-1n:1n;
    const previous=active.slice(0,at);
    const plane=previous.map(j=>{
      spend();
      const prior=rows[j],factor=side*prior.a[p];
      const a=prior.a.map((v,k)=>magnitude*v-factor*row.a[k]);
      a.splice(p,1);
      return feedbackPrimitive(a,sub(mul(Q(magnitude),prior.b),mul(Q(factor),row.b)));
    });
    const result=intersectFeedbackHalfspaces(plane,width-1,spend);
    if(result.proof){
      let boundary=Z();
      const lifted=result.proof.map(([k,weight])=>{
        const j=previous[k],v=Q(weight,plane[k].scale);
        boundary=sub(boundary,mul(v,Q(side*rows[j].a[p])));
        return [j,mul(v,Q(magnitude))];
      });
      // A negative boundary coefficient is impossible since the old point
      // satisfied the preceding rows and violated the boundary inequality.
      if(boundary.n<0n)throw Error('Invalid feedback infeasibility lift.');
      lifted.push([i,boundary]);return {proof:integerWeights(lifted)};
    }
    point=result.point.slice();point.splice(p,0,Z());
    point[p]=div(sub(row.b,dot(row.a,point)),Q(pivot));
  }
  return {point};
}

export function checkFeedbackContradiction(rows,width,proof){
  const left=Array(width).fill(0n);let right=Z();
  for(const [i,w] of proof){
    if(!Number.isSafeInteger(i)||!rows[i]||typeof w!=='bigint'||w<=0n)return false;
    rows[i].a.forEach((v,k)=>{left[k]+=v*w;});
    right=add(right,mul(Q(w),rows[i].b));
  }
  return left.every(x=>x===0n)&&right.n<0n;
}
