import {simulateAdaptiveDynamics} from './studio-dynamics.mjs';
import {openInputOriginTorqueSource,INPUT_ORIGIN_SOURCE_SCHEMA} from './input-origin-torque-source.mjs';
import {executePeriodicOrigin} from './periodic-origin-dynamics.mjs';
import {inputOriginWork} from './input-origin-fit.mjs';
import {evaluate} from './torque-discovery.mjs';
import {outputIntervalCount} from './output-grid.mjs';
export const PERIODIC_ORIGIN_SCHEMA='worldlaw.periodic-origin-execution-source/v1';
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const number=(x,low,high)=>typeof x==='number'&&Number.isFinite(x)&&x>=low&&x<=high;
const limit=4*1024*1024;
export function openPeriodicOriginSource(raw){
 if(!exact(raw,['schema','original','initial','settings','basis'])||raw.schema!==PERIODIC_ORIGIN_SCHEMA||typeof raw.basis!=='string'||!raw.basis.trim()||raw.basis.length>600)throw Error('Declare original response inputs, initial state and dynamical interpretation.');
 const s=raw.original,o=raw.settings;
 if(!exact(s,['schema','training','challenge','terms','scale'])||s.schema!==INPUT_ORIGIN_SOURCE_SCHEMA||!dense(s.training)||s.training.length<8||s.training.length>4096||!dense(s.challenge)||s.challenge.length>4096||!dense(s.terms)||s.terms.length<1||s.terms.length>6||!s.terms.includes('bias')||!s.terms.some(t=>['gravity','cosine'].includes(t))||new Set(s.terms).size!==s.terms.length||!s.terms.every(t=>['command','spring','rate','bias','gravity','cosine'].includes(t))||!number(s.scale,1e-7,1e6))throw Error('Retain an original periodic input-origin response including its existing bias.');
 if(![...s.training,...s.challenge].every(r=>r&&Object.hasOwn(r,'torqueNoiseRatio')))throw Error('Retain each original declared noise ratio.');
 const zero={schema:'worldlaw.torque-model/v1',terms:[]};evaluate(zero,s.training);evaluate(zero,s.challenge);
 if(!exact(raw.initial,['position','rate'])||!Object.values(raw.initial).every(x=>number(x,-1e6,1e6)))throw Error('Declare finite original initial position and rate.');
 if(!exact(o,['duration','dt','inertia','command','relativeTolerance','positionTolerance','rateTolerance','maxTrials'])||!number(o.duration,Number.MIN_VALUE,1000)||!number(o.dt,Number.MIN_VALUE,1)||!number(o.inertia,Number.MIN_VALUE,1e12)||!number(o.command,-1e6,1e6)||!['relativeTolerance','positionTolerance','rateTolerance'].every(k=>number(o[k],1e-14,.01))||!Number.isSafeInteger(o.maxTrials)||o.maxTrials<1||o.maxTrials>100000||outputIntervalCount(o.duration,o.dt)>10000)throw Error('Declare bounded complete dynamics settings.');
 const source=structuredClone(raw);if(new TextEncoder().encode(JSON.stringify(source)).length>limit)throw Error('At most4MiB original execution inputs.');
 // Reserve both complete maintained numerical courses and final retained outputs.
 const evaluations=12*o.maxTrials+2*(outputIntervalCount(o.duration,o.dt)+1);
 const reservedWork=inputOriginWork(s.training.length,s.terms.length,1e6,s.scale)+(s.training.length+s.challenge.length)*(256*s.terms.length+128)+evaluations*(32768+576);
 if(reservedWork>250000000)return {status:'work-limit',reservedWork,source};
 const response=openInputOriginTorqueSource(source.original);
 if(response.status!=='converged')return {status:'fit-unresolved',reason:response.status,reservedWork,source};
 const execution=executePeriodicOrigin(response.model,source.initial,source.settings);
 const comparison=simulateAdaptiveDynamics(response.model,source.initial,source.settings);
 return {status:'executed',source,reservedWork,response,execution,comparison,meaning:'The original response is refitted before interpreting its torque as the complete right-hand side of declared inertia times acceleration. No additional force, damping, physical calibration or acquisition is inferred. Initial state and constant command are declarations. Held-aside readings do not fit or reset the trajectory. The comparison uses the ordinary original-coordinate evaluator. Periodic execution requires each retained displacement and every stage to remain within one radian of its initial anchor. Origin plus displacement is retained; the summed physical coordinate is rounded. This does not replace the selected workbench law.'};
}
export function serializePeriodicOriginSource(raw){return JSON.stringify(openPeriodicOriginSource(raw).source);}
export function parsePeriodicOriginSource(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>limit)throw Error('At most4MiB original execution inputs.');return openPeriodicOriginSource(JSON.parse(text));}
