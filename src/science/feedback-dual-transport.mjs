/** Extract one tight scalar-tree proof by matching positive and negative coefficient mass. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const zero=Z(),one=Q(1n);
function need(ok,message){if(!ok)throw Error('Scalar feedback proof: '+message);}

function scaledSum(a,u,b,v,spend){
  const out=new Map();
  for(const [terms,scale] of [[a,u],[b,v]])for(const [key,value] of terms){
    spend();const z=add(out.get(key)??zero,mul(value,scale));
    if(z.n)out.set(key,z);else out.delete(key);
  }
  return out;
}

/** Input rows use sum(c_j x_j) <= h + r epsilon. The caller supplies a checked tight dual. */
export function transportFeedbackDual(rows,lower,order,radius,leafAt,spend){
  need(lower.length>0,'a positive-radius proof must have source weights');
  let terms=lower.map(([atom,weight])=>{
    need(weight.n>0n,'source weights must be positive');
    const row=rows[atom],coeffs=new Map();
    for(const [j,c] of row.terms){const z=add(coeffs.get(j)??zero,mul(weight,c));if(z.n)coeffs.set(j,z);else coeffs.delete(j);}
    if(row.h.n)coeffs.set('h',mul(weight,row.h));
    if(row.r.n)coeffs.set('r',mul(weight,row.r));
    return {coeffs,atoms:new Map([[atom,weight]])};
  });
  for(const coordinate of order){
    const positive=[],negative=[],rest=[];
    for(const term of terms){
      spend();const c=term.coeffs.get(coordinate);
      if(!c){rest.push(term);continue;}
      (c.n>0n?positive:negative).push({term,c:c.n>0n?c:neg(c),remaining:one});
    }
    while(positive.length&&negative.length){
      const a=positive.at(-1),b=negative.at(-1);
      const supply=mul(a.c,a.remaining),demand=mul(b.c,b.remaining);
      const flow=compare(supply,demand)<=0?supply:demand;
      const u=div(flow,a.c),v=div(flow,b.c);
      const coeffs=scaledSum(a.term.coeffs,u,b.term.coeffs,v,spend);
      need(!coeffs.has(coordinate),'transport did not eliminate the coordinate');
      rest.push({coeffs,atoms:scaledSum(a.term.atoms,u,b.term.atoms,v,spend)});
      a.remaining=sub(a.remaining,u);b.remaining=sub(b.remaining,v);
      if(!a.remaining.n)positive.pop();
      if(!b.remaining.n)negative.pop();
    }
    need(!positive.length&&!negative.length,'source weights do not cancel');
    terms=rest;
  }
  let best=null;
  for(const {coeffs,atoms} of terms){
    need([...coeffs.keys()].every(k=>k==='h'||k==='r'),'uneliminated coordinate');
    const r=coeffs.get('r')??zero,h=coeffs.get('h')??zero;
    need(r.n>=0n&&!add(h,mul(r,radius)).n,'transported source row is not tight');
    if(!r.n)continue;
    const leaves=[...new Set([...atoms.keys()].map(leafAt))].sort((a,b)=>a-b);
    if(!best||leaves.length<best.leaves.length||(leaves.length===best.leaves.length&&atoms.size<best.lower.length)){
      best={leaves,lower:[...atoms].sort((a,b)=>a[0]-b[0]).map(([i,w])=>[i,fmt(div(w,r))])};
    }
  }
  need(best,'no positive-noise row survives');return best;
}
