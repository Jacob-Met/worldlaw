// Complete equal-mass joint-state assignment; only the replayed coupling cost is certified.
import {rational,add,sub,mul,div,neg,cmp,enclosure,serial} from './chronos-exact-halfplanes.mjs';
export function transportWitness(left,right,sensitivity){
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length||left.length<1||left.length>128)throw Error('Use equal populations of 1–128 states');
 if(!Array.isArray(sensitivity)||sensitivity.length!==3||Array.from(sensitivity).some(v=>!Number.isFinite(v)||v<0||v>1e6))throw Error('Declare three nonnegative bounded sensitivities');
 for(const p of [...left,...right])if(!Array.isArray(p)||p.length!==3||Array.from(p).some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))throw Error('Bounded original state required');
 const n=left.length,cost=left.map(a=>right.map(b=>a.reduce((s,x,k)=>s+sensitivity[k]*Math.abs(x-b[k]),0)));
 const u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  do{used[j0]=true;let i0=p[j0],delta=Infinity,j1=0;
   for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
   for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
 }
 const assignment=Array(n);for(let j=1;j<=n;j++)assignment[p[j]-1]=j-1;
 // Numerical optimizer never certifies the bound: replay the complete bijection
 // and original binary64 coordinates with the maintained exact arithmetic.
 if(new Set(assignment).size!==n||assignment.some(j=>!Number.isInteger(j)||j<0||j>=n))throw Error('Invalid assignment');
 let exact=rational(0);for(let i=0;i<n;i++)for(let k=0;k<3;k++){let d=sub(rational(left[i][k]),rational(right[assignment[i]][k]));if(cmp(d,rational(0))<0)d=neg(d);exact=add(exact,mul(rational(sensitivity[k]),d));}
 exact=div(exact,rational(n));
 return {assignment,exact:serial(exact),bound:enclosure(exact),qualification:'An explicit source-replayed coupling upper bound; numerical assignment optimality is not certified.'};
}
