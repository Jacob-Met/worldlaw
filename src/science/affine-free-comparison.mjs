import{compareNearCriticalAffine}from'./affine-critical-comparison.mjs';import{freeAffineState}from'./affine-free-state.mjs';import{productPair}from'./split-column.mjs';
const sum=(a,b)=>{const s=a+b,v=s-a;return[s,(a-(s-v))+(b-v)];};const add=(a,b)=>{const[s,e]=sum(a[0],b[0]);return sum(s,e+a[1]+b[1]);};const mul=(a,b)=>add(productPair(a[0],b),productPair(a[1],b));
export function compareFreeAffine(model,initial,settings,trajectory){
 const prior=compareNearCriticalAffine(model,initial,settings,trajectory);if(prior.status==='compared')return prior;
 const unavailable=reason=>({status:'unavailable',reason}),pairs=new Map(['spring','rate','command','bias'].map(k=>[k,[0,0]]));
 const entries=model.schema==='worldlaw.torque-model/v1'?model.terms.map(t=>[t.id,[t.coefficient,0]]):model.schema==='worldlaw.split-torque-experiment/v1'?model.terms.map((t,i)=>[typeof t==='string'?t:t.id,model.fit.pairs[i]]):[];
 if(!entries.length||entries.some(([k])=>!pairs.has(k)))return prior;for(const[k,p]of entries)pairs.set(k,p);
 if(pairs.get('spring').some(x=>x!==0))return prior;
 if(!initial||![initial.position,initial.rate].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6)||!settings||typeof settings!=='object')return unavailable('Finite original state/settings required.');
 const inertia=settings.inertia??1,command=settings.command??0,duration=settings.duration??4;
 if(!Number.isFinite(inertia)||inertia<=0||inertia>1e12||!Number.isFinite(command)||Math.abs(command)>1e6||!Number.isFinite(duration)||duration<=0||duration>1000)return unavailable('Bounded positive inertia/duration and constant command required.');
 const drag=pairs.get('rate'),damping=-(drag[0]+drag[1])/inertia;if(!Number.isFinite(damping)||damping<0||damping*duration>700)return unavailable('Zero-restoring comparison requires nonnegative bounded damping.');
 const forcePair=add(pairs.get('bias'),mul(pairs.get('command'),command)),force=forcePair[0]/inertia+forcePair[1]/inertia;
 const displacementBound=Math.abs(initial.rate)*duration+Math.abs(force)*duration*duration/2,rateBound=Math.abs(initial.rate)+Math.abs(force)*duration;
 if(!Number.isFinite(displacementBound)||!Number.isFinite(rateBound)||Math.abs(initial.position)+displacementBound>1e6||rateBound>1e6)return unavailable('Zero-restoring original-coordinate envelope exceeds bounds.');
 if(!Array.isArray(trajectory)||!trajectory.length||trajectory.length>10001)return unavailable('Complete bounded sample count required.');
 let maxDisplacementDifference=0,maxRateDifference=0;const samples=[];
 for(const row of trajectory){if(!row||!Number.isFinite(row.time)||row.time<0||row.time>duration||!Number.isFinite(row.positionDelta)||!Number.isFinite(row.rate))return unavailable('Finite original samples required.');let s;try{s=freeAffineState({damping,force,initialRate:initial.rate,time:row.time});}catch{return unavailable('Zero-restoring comparison exceeds its finite domain.');}maxDisplacementDifference=Math.max(maxDisplacementDifference,Math.abs(s.positionDelta-row.positionDelta));maxRateDifference=Math.max(maxRateDifference,Math.abs(s.rate-row.rate));samples.push({time:row.time,positionOrigin:initial.position,positionDelta:s.positionDelta,position:initial.position+s.positionDelta,rate:s.rate});}
 return{status:'compared',method:'zero-restoring-affine-closed-form',damping,trajectory:samples,maxDisplacementDifference,maxRateDifference,meaning:'Independent-time evaluation of the same zero-restoring constant affine equation with nonnegative viscous damping. Cancellation-safe series retain the zero-damping limit. No accumulated time-stepping error; coefficient, transcendental and series rounding remain. Sampled discrepancies are not certified global errors or physical validation. Local RK4 tolerances are unchanged.'};
}
