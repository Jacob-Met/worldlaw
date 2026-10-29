import{affineEnvelopes,selectAffineEnvelope}from'./affine-envelope.mjs';
// Isolated executable adapter: the maintained RK4 kernel is unchanged.
import {simulateAdaptiveDynamics} from './studio-dynamics.mjs';
import {prepareTorquePredictor} from './torque-discovery.mjs';
import {productPair} from './split-column.mjs';
const ids=['command','spring','rate','bias'];
function twoSum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
function add(a,b){const[s,e]=twoSum(a[0],b[0]);return twoSum(s,e+a[1]+b[1]);}
function mul(a,b){return add(productPair(a[0],b),productPair(a[1],b));}
function finite(x,b=1e6){return typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=b;}
function need(ok,message){if(!ok)throw new TypeError(message);}
export function executeAffineOrigin(model,initial,options={}){
 // Clone and validate through the original executable admission before mapping.
 const original=structuredClone(model);prepareTorquePredictor(original);
 need(initial&&finite(initial.position)&&finite(initial.rate),'Admit original finite state.');
 need(options&&typeof options==='object'&&!Array.isArray(options),'Use explicit settings.');
 const anchor=initial.position,pairs=new Map(ids.map(id=>[id,[0,0]]));
 let entries;
 if(original.schema==='worldlaw.torque-model/v1')entries=original.terms.map(t=>[t.id,[t.coefficient,0]]);
 else if(original.schema==='worldlaw.split-torque-experiment/v1')entries=original.terms.map((t,i)=>[typeof t==='string'?t:t.id,original.fit.pairs[i]]);
 else throw new TypeError('Only original v1 or compensated affine torque is supported.');
 need(entries.every(([id,p])=>ids.includes(id)&&Array.isArray(p)&&p.length===2&&p.every(x=>finite(x,1e18))),'Only affine command, spring, rate and bias terms are supported.');
 for(const[id,p]of entries)pairs.set(id,[...p]);
 pairs.set('bias',add(pairs.get('bias'),mul(pairs.get('spring'),anchor)));
 need([...pairs.values()].flat().every(x=>finite(x,1e18)),'Mapped affine coefficients exceed supported bounds.');
 const duration=options.duration??4,dt=options.dt??.01,inertia=options.inertia??1,command=options.command??0;
 need(finite(duration,1000)&&duration>0&&finite(dt,1)&&dt>0&&finite(inertia,1e12)&&inertia>0&&finite(command),'Admit bounded positive dynamics settings.');
 const force=add(mul(pairs.get('command'),command),pairs.get('bias'));
 const bounds=affineEnvelopes(pairs,inertia,force,initial.rate,duration,dt),selected=selectAffineEnvelope(bounds,anchor);
 need(selected,'Original-coordinate envelope unavailable; no shifted execution.');
 const transformed={schema:'worldlaw.split-torque-experiment/v1',status:'converged',terms:ids,fit:{schema:'worldlaw.split-continuation-research/v1',status:'converged',pairs:ids.map(id=>pairs.get(id))}};
 const result=simulateAdaptiveDynamics(transformed,{position:0,rate:initial.rate},options);
 return{schema:'worldlaw.affine-origin-dynamics-experiment/v1',originalModel:original,initial:{position:anchor,rate:initial.rate},trajectory:result.trajectory.map(row=>({...row,positionOrigin:anchor,positionDelta:row.position,position:anchor+row.position})),diagnostics:{...result.diagnostics,positionToleranceCoordinates:'displacement from original initial position',coordinateEnvelope:selected,interpretation:'Maintained RK4 on an affine translated equation. Position origin plus displacement is executable; ordinary summed position is rounded. Local error estimates and conservative arithmetic margin are not a certified enclosure, global error bound or physical validation.'}};
}
