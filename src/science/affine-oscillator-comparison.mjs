import{prepareTorquePredictor}from'./torque-discovery.mjs';
import{productPair}from'./split-column.mjs';
const sum=(a,b)=>{const s=a+b,v=s-a;return[s,(a-(s-v))+(b-v)];};
const add=(a,b)=>{const[s,e]=sum(a[0],b[0]);return sum(s,e+a[1]+b[1]);};
const mul=(a,b)=>add(productPair(a[0],b),productPair(a[1],b));
// A bounded comparison, not a replacement integrator or certified error enclosure.
export function compareAffineOscillator(model,initial,settings,trajectory){
 prepareTorquePredictor(model);
 const pairs=new Map(['spring','rate','command','bias'].map(k=>[k,[0,0]]));
 const entries=model.schema==='worldlaw.torque-model/v1'?model.terms.map(t=>[t.id,[t.coefficient,0]]):model.schema==='worldlaw.split-torque-experiment/v1'?model.terms.map((t,i)=>[typeof t==='string'?t:t.id,model.fit.pairs[i]]):[];
 const unavailable=reason=>({status:'unavailable',reason});
 if(!entries.length||entries.some(([k])=>!pairs.has(k)))return unavailable('Only affine terms are supported.');
 for(const[k,p]of entries)pairs.set(k,p);
 if(pairs.get('rate').some(x=>x!==0))return unavailable('Analytic comparison requires exactly zero rate coefficient.');
 if(!initial||![initial.position,initial.rate].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6)||!settings||typeof settings!=='object')return unavailable('Finite original initial state and settings required.');
 const k=pairs.get('spring'),inertia=settings.inertia??1;
 if(!(Number.isFinite(inertia)&&inertia>0&&inertia<=1e12)||!Number.isFinite(settings.command??0)||Math.abs(settings.command??0)>1e6)return unavailable('Bounded positive inertia and constant command required.');
 const w2=-(k[0]+k[1])/inertia;
 if(!(w2>0&&Number.isFinite(w2)))return unavailable('Resolved negative spring and positive finite inertia are required.');
 const w=Math.sqrt(w2),duration=settings.duration??4;
 if(!Number.isFinite(duration)||duration<=0||w*duration>1e6||!Array.isArray(trajectory)||!trajectory.length||trajectory.length>10001)return unavailable('Bounded phase and complete at-most10001 sample grid required.');
 const force=add(add(pairs.get('bias'),mul(k,initial.position)),mul(pairs.get('command'),settings.command??0));
 const equilibrium=(force[0]/inertia+force[1]/inertia)/w2,v=initial.rate/w;
 const envelope=2*Math.abs(equilibrium)+Math.abs(v);
 if(!Number.isFinite(envelope)||Math.abs(initial.position)+envelope>1e6||w*(Math.abs(equilibrium)+Math.abs(v))>1e6)return unavailable('Analytic original-coordinate envelope exceeds bounds.');
 let maxDisplacementDifference=0,maxRateDifference=0;
 const samples=[];
 for(const row of trajectory){const t=row.time;if(!Number.isFinite(t)||t<0||t>duration||!Number.isFinite(row.positionDelta)||!Number.isFinite(row.rate))return unavailable('Finite original samples required.');const phase=w*t,s=Math.sin(phase),c=Math.cos(phase),positionDelta=equilibrium*2*Math.sin(phase/2)**2+v*s,rate=equilibrium*w*s+initial.rate*c;maxDisplacementDifference=Math.max(maxDisplacementDifference,Math.abs(positionDelta-row.positionDelta));maxRateDifference=Math.max(maxRateDifference,Math.abs(rate-row.rate));samples.push({time:t,positionOrigin:initial.position,positionDelta,position:initial.position+positionDelta,rate});}
 return{status:'compared',method:'undamped-affine-closed-form',frequency:w,trajectory:samples,maxDisplacementDifference,maxRateDifference,meaning:'Independent-time trigonometric evaluation of the same constant affine equation; no accumulated stepping phase error. Coefficient rounding, transcendental evaluation, model error and source uncertainty remain. Differences are sampled method discrepancies, not certified global errors or physical validation. Local RK4 tolerance is unchanged.'};
}
