import {fitSplitTorque,evaluate} from './torque-discovery.mjs';
export const SPLIT_SOURCE_SCHEMA='worldlaw.split-torque-source/v1';
const keys=['schema','training','challenge','terms','scale'];
export function openSplitTorqueSource(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k))||raw.schema!==SPLIT_SOURCE_SCHEMA)throw Error('Open original split-response inputs, not derived results.');
 if(!Array.isArray(raw.challenge)||Array.from(raw.challenge).some(r=>r===undefined))throw Error('Supply dense original challenge rows.');
 const source=structuredClone(raw);if(new TextEncoder().encode(JSON.stringify(source)).length>4*1024*1024)throw Error('Original inputs exceed 4 MiB.');
 const model=fitSplitTorque(source.training,source.terms,source.scale);
 // Validate original challenge even when the fit is unresolved.
 evaluate({schema:'worldlaw.torque-model/v1',terms:[]},source.challenge);
 if(model.status!=='converged')return {status:model.status,source};
 return {status:'converged',source,model,training:evaluate(model,source.training),challenge:evaluate(model,source.challenge)};
}
export function parseSplitTorqueSource(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>4*1024*1024)throw Error('Open at most 4 MiB of original inputs.');return openSplitTorqueSource(JSON.parse(text));}
export function serializeSplitTorqueSource(raw){const text=JSON.stringify(openSplitTorqueSource(raw).source,null,2);if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('Original inputs exceed 4 MiB.');return text;}
