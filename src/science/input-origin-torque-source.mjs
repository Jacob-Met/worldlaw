import {fitInputOriginTorque,evaluateHeterogeneousTorque,evaluate} from './torque-discovery.mjs';
export const INPUT_ORIGIN_SOURCE_SCHEMA='worldlaw.input-origin-torque-source/v1';
const keys=['schema','training','challenge','terms','scale'];
export function openInputOriginTorqueSource(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k))||raw.schema!==INPUT_ORIGIN_SOURCE_SCHEMA)throw Error('Open original unequal-noise response inputs, not results.');
 for(const key of ['training','challenge'])if(!Array.isArray(raw[key])||Array.from(raw[key]).some(r=>!r||typeof r!=='object'||!Object.hasOwn(r,'torqueNoiseRatio')))throw Error('Every original row must declare its noise ratio.');
 const source=structuredClone(raw);if(new TextEncoder().encode(JSON.stringify(source)).length>4*1024*1024)throw Error('Original inputs exceed 4 MiB.');
 evaluate({schema:'worldlaw.torque-model/v1',terms:[]},source.challenge);
 const model=fitInputOriginTorque(source.training,source.terms,source.scale);
 if(model.status!=='converged')return {status:model.status,source};
 const score=rows=>{const s=evaluateHeterogeneousTorque(model,rows);return {...s.physical,normalizedRmse:s.normalizedRmse,normalizedResiduals:s.normalizedResiduals};};
 return {status:'converged',source,model,training:score(source.training),challenge:score(source.challenge)};
}
export function parseInputOriginTorqueSource(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Open at most 4 MiB of original inputs.');return openInputOriginTorqueSource(JSON.parse(text));}
export function serializeInputOriginTorqueSource(raw){const source=openInputOriginTorqueSource(raw).source,pretty=JSON.stringify(source,null,2);return new TextEncoder().encode(pretty).length<=4*1024*1024?pretty:JSON.stringify(source);}
