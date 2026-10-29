import{compareAffineWithDamping}from'./affine-damped-comparison.mjs';
import{overdampedState}from'./affine-overdamped-state.mjs';
import{productPair}from'./split-column.mjs';
const sum=(a,b)=>{const s=a+b,v=s-a;return[s,(a-(s-v))+(b-v)];};
const add=(a,b)=>{const[s,e]=sum(a[0],b[0]);return sum(s,e+a[1]+b[1]);};
const mul=(a,b)=>add(productPair(a[0],b),productPair(a[1],b));
export function compareStableAffine(model,initial,settings,trajectory){
 const prior=compareAffineWithDamping(model,initial,settings,trajectory);
 if(prior.status==='compared'||prior.reason!=='Damped comparison supports strictly underdamped restoring systems only.')return prior;
 const unavailable=reason=>({status:'unavailable',reason});
 if(!initial||![initial.position,initial.rate].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6)||!settings||typeof settings!=='object')return unavailable('Finite original state/settings required.');
 const inertia=settings.inertia??1,command=settings.command??0,duration=settings.duration??4;
 if(!Number.isFinite(inertia)||inertia<=0||inertia>1e12||!Number.isFinite(command)||Math.abs(command)>1e6||!Number.isFinite(duration)||duration<=0||duration>1000)return unavailable('Bounded positive inertia/duration and constant command required.');
 const pairs=new Map(['spring','rate','command','bias'].map(k=>[k,[0,0]]));
 const entries=model.schema==='worldlaw.torque-model/v1'?model.terms.map(t=>[t.id,[t.coefficient,0]]):model.terms.map((t,i)=>[typeof t==='string'?t:t.id,model.fit.pairs[i]]);
 for(const[k,p]of entries)pairs.set(k,p);
 const k=pairs.get('spring'),drag=pairs.get('rate'),w2=-(k[0]+k[1])/inertia,damping=-(drag[0]+drag[1])/inertia,a=damping/2,b2=a*a-w2;
 if(!Number.isFinite(w2)||!Number.isFinite(damping)||!(w2>0&&damping>0&&b2>0))return unavailable('Overdamped comparison requires separated stable real roots.');
 const b=Math.sqrt(b2);if(b/a<1e-4||!Array.isArray(trajectory)||!trajectory.length||trajectory.length>10001)return unavailable('Separated real roots and complete sample count required.');
 const f=add(add(pairs.get('bias'),mul(k,initial.position)),mul(pairs.get('command'),command)),force=f[0]/inertia+f[1]/inertia,q=force/w2;
 const displacementBound=Math.abs(q)+Math.abs(initial.rate)/damping,rateBound=Math.abs(force)/damping+Math.abs(initial.rate);
 if(!Number.isFinite(displacementBound)||!Number.isFinite(rateBound)||Math.abs(initial.position)+displacementBound>1e6||rateBound>1e6)return unavailable('Analytic original-coordinate envelope exceeds bounds.');
 let maxDisplacementDifference=0,maxRateDifference=0;const samples=[];
 for(const row of trajectory){if(!row||!Number.isFinite(row.time)||row.time<0||row.time>duration||!Number.isFinite(row.positionDelta)||!Number.isFinite(row.rate))return unavailable('Finite original samples required.');const s=overdampedState({frequencySquared:w2,damping,force,initialRate:initial.rate,time:row.time});if(!Number.isFinite(s.positionDelta)||!Number.isFinite(s.rate))return unavailable('Nonfinite analytic evaluation.');maxDisplacementDifference=Math.max(maxDisplacementDifference,Math.abs(s.positionDelta-row.positionDelta));maxRateDifference=Math.max(maxRateDifference,Math.abs(s.rate-row.rate));samples.push({time:row.time,positionOrigin:initial.position,positionDelta:s.positionDelta,position:initial.position+s.positionDelta,rate:s.rate,evaluation:s.method});}
 return{status:'compared',method:'overdamped-affine-closed-form',damping,trajectory:samples,maxDisplacementDifference,maxRateDifference,meaning:'Independent-time evaluation of the same separated overdamped constant affine equation, with a cancellation-safe small-time series. No accumulated time-stepping error; coefficient, transcendental and series rounding remain. Sampled discrepancies are not certified global errors or physical validation. Local RK4 tolerances are unchanged.'};
}
