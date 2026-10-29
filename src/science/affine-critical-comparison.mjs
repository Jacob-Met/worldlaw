import{compareStableAffine}from'./affine-stable-comparison.mjs';
import{criticalState}from'./affine-critical-state.mjs';
import{productPair}from'./split-column.mjs';
const sum=(a,b)=>{const s=a+b,v=s-a;return[s,(a-(s-v))+(b-v)];};
const add=(a,b)=>{const[s,e]=sum(a[0],b[0]);return sum(s,e+a[1]+b[1]);};
const mul=(a,b)=>add(productPair(a[0],b),productPair(a[1],b));
export function compareNearCriticalAffine(model,initial,settings,trajectory){
 const prior=compareStableAffine(model,initial,settings,trajectory);
 if(prior.status==='compared'||!['Overdamped comparison requires separated stable real roots.','Separated real roots and complete sample count required.','Analytic original-coordinate envelope exceeds bounds.'].includes(prior.reason))return prior;
 const unavailable=reason=>({status:'unavailable',reason});
 const inertia=settings.inertia??1,command=settings.command??0,duration=settings.duration??4;
 const pairs=new Map(['spring','rate','command','bias'].map(k=>[k,[0,0]]));
 const entries=model.schema==='worldlaw.torque-model/v1'?model.terms.map(t=>[t.id,[t.coefficient,0]]):model.terms.map((t,i)=>[typeof t==='string'?t:t.id,model.fit.pairs[i]]);
 for(const[k,p]of entries)pairs.set(k,p);
 const k=pairs.get('spring'),drag=pairs.get('rate'),w2=-(k[0]+k[1])/inertia,damping=-(drag[0]+drag[1])/inertia,a=damping/2,g2=a*a-w2;
 if(!(w2>0&&damping>0)||!Number.isFinite(g2)||Math.abs(g2*duration*duration)>.25||a*duration>700)return unavailable('Bounded near-critical stable comparison required.');
 if(!Array.isArray(trajectory)||!trajectory.length||trajectory.length>10001)return unavailable('Complete bounded sample count required.');
 const f=add(add(pairs.get('bias'),mul(k,initial.position)),mul(pairs.get('command'),command)),force=f[0]/inertia+f[1]/inertia;
 // |C| <= cosh(.5), |S(t)| <= t*cosh(.5); integrate the impulse
 // directly, without an ill-conditioned reciprocal root separation.
 const c=Math.cosh(.5),displacementBound=c*(Math.abs(force)*duration*duration/2+Math.abs(initial.rate)*duration),rateBound=c*(Math.abs(force)*duration+Math.abs(initial.rate)*(1+a*duration));
 if(!Number.isFinite(displacementBound)||!Number.isFinite(rateBound)||Math.abs(initial.position)+displacementBound>1e6||rateBound>1e6)return unavailable('Near-critical original-coordinate envelope exceeds bounds.');
 let maxDisplacementDifference=0,maxRateDifference=0;const samples=[];
 for(const row of trajectory){
  if(!row||!Number.isFinite(row.time)||row.time<0||row.time>duration||!Number.isFinite(row.positionDelta)||!Number.isFinite(row.rate))return unavailable('Finite original samples required.');
  let s;try{s=criticalState({frequencySquared:w2,damping,force,initialRate:initial.rate,time:row.time});}catch{return unavailable('Near-critical comparison exceeds its finite domain.');}
  maxDisplacementDifference=Math.max(maxDisplacementDifference,Math.abs(s.positionDelta-row.positionDelta));maxRateDifference=Math.max(maxRateDifference,Math.abs(s.rate-row.rate));samples.push({time:row.time,positionOrigin:initial.position,positionDelta:s.positionDelta,position:initial.position+s.positionDelta,rate:s.rate,evaluation:s.method});
 }
 return{status:'compared',method:'near-critical-affine-entire-functions',damping,trajectory:samples,maxDisplacementDifference,maxRateDifference,meaning:'Independent-time evaluation of the same stable affine equation near repeated decay roots, using bounded entire-function series. No accumulated time-stepping error; coefficient, transcendental and series rounding remain. Sampled discrepancies are not certified global errors or physical validation. Local RK4 tolerances are unchanged.'};
}
