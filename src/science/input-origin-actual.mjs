import {openInputOriginTorqueSource,INPUT_ORIGIN_SOURCE_SCHEMA} from './input-origin-torque-source.mjs';
import {evaluate,evaluateHeterogeneousTorque,TERMS} from './torque-discovery.mjs';
import {inputOriginWork} from './input-origin-fit.mjs';
export const INPUT_ORIGIN_ACTUAL_SCHEMA='worldlaw.input-origin-actual-source/v1';
const LIMIT=4*1024*1024,MAX_WORK=250000000;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const dense=x=>Array.isArray(x)&&Array.from({length:x.length},(_,i)=>Object.hasOwn(x,i)).every(Boolean);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=600;
/** A new original reading is an explicit declaration, not inferred from a forecast. */
export function receiveInputOriginActual(raw){
 if(!exact(raw,['schema','original','actual','basis','independentlyObtained'])||raw.schema!==INPUT_ORIGIN_ACTUAL_SCHEMA||raw.independentlyObtained!==true||!text(raw.basis))throw Error('Declare one independently obtained original reading and its source basis.');
 const s=raw.original;if(!exact(s,['schema','training','challenge','terms','scale'])||s.schema!==INPUT_ORIGIN_SOURCE_SCHEMA||!dense(s.training)||s.training.length<8||s.training.length>=4096||!dense(s.challenge)||s.challenge.length>4096||!dense(s.terms)||s.terms.length<1||s.terms.length>9||!s.terms.includes('bias')||new Set(s.terms).size!==s.terms.length||!s.terms.every(id=>TERMS.some(t=>t.id===id))||!Number.isFinite(s.scale)||s.scale<1e-7||s.scale>1e6)throw Error('Retain an admitted original input-origin source with capacity for one new reading.');
 const fields=['command','position','rate','jointTorque','torqueNoiseRatio'];if(!exact(raw.actual,fields)||![...s.training,...s.challenge,raw.actual].every(r=>r&&typeof r==='object'&&Object.hasOwn(r,'torqueNoiseRatio')))throw Error('Every original and actual row must declare its noise ratio.');
 // Reuse maintained row admission without fitting or consulting fitted predictions.
 const zero={schema:'worldlaw.torque-model/v1',terms:[]};evaluate(zero,s.training);evaluate(zero,s.challenge);evaluate(zero,[raw.actual]);
 const source=structuredClone(raw);if(new TextEncoder().encode(JSON.stringify(source)).length>LIMIT)throw Error('Keep original acquisition inputs within4MiB.');
 const n=s.training.length,p=s.terms.length,h=s.challenge.length;
 // 1e6 is the admitted normalized target maximum, independent of the new value.
 // Reserve both complete fits plus every source/actual evaluation before either fit.
 const reservedWork=inputOriginWork(n,p,1e6,s.scale)+inputOriginWork(n+1,p,1e6,s.scale)+(2*n+1+2*h+2)*(256*p+128);
 if(reservedWork>MAX_WORK)return {status:'work-limit',reservedWork,source};
 const before=openInputOriginTorqueSource(source.original);if(before.status!=='converged')return {status:'original-unresolved',reason:before.status,reservedWork,source};
 const beforeActual=evaluateHeterogeneousTorque(before.model,[source.actual]);
 const revisedSource={...structuredClone(source.original),training:[...structuredClone(source.original.training),structuredClone(source.actual)]};
 const after=openInputOriginTorqueSource(revisedSource);if(after.status!=='converged')return {status:'revision-unresolved',reason:after.status,reservedWork,source,before,beforeActual};
 return {status:'converged',source,reservedWork,before,beforeActual,after,afterActual:evaluateHeterogeneousTorque(after.model,[source.actual]),meaning:'The earlier response is evaluated before reusing this newly supplied row for fitting. After-fit error on that same row is reused evidence, not a separate prediction. Original held-aside rows remain separate and unchanged. Independent acquisition, same mechanism and source basis are declarations, not authenticated facts. The ordinary selected workbench law is unchanged.'};
}
export function serializeInputOriginActual(raw){const source=receiveInputOriginActual(raw).source;return JSON.stringify(source);}
export function parseInputOriginActual(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('Open at most4MiB original acquisition inputs.');return receiveInputOriginActual(JSON.parse(text));}
