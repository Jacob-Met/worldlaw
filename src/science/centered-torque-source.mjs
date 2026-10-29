import {fitCenteredTorque,evaluate} from './torque-discovery.mjs';
const LIMIT=4*1024*1024;
export function openCenteredTorqueSource(raw){
 if(raw?.schema!=='worldlaw.centered-torque-source/v1')throw Error('Expected original centered torque source');
 const allowed=['schema','training','challenge','terms','scale'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw Error('Only original observations and fitting settings may be reopened');
 if(!Array.isArray(raw.challenge))throw Error('Retain a challenge array, empty when not supplied');
 for(const key of ['training','challenge','terms'])if(!Array.isArray(raw[key])||Array.from(raw[key]).some(value=>value===undefined))throw Error('Original arrays must be dense');
 const source=structuredClone(raw);
 if(new TextEncoder().encode(JSON.stringify(source)).length>LIMIT)throw Error('Source exceeds 4 MiB');
 const model=fitCenteredTorque(source.training,source.terms,source.scale);
 if(model.status!=='converged')return {source,status:model.status,model:null,training:null,challenge:null};
 return {source,status:'converged',model,training:evaluate(model,source.training),challenge:evaluate(model,source.challenge),
   interpretation:'Fixed maintained feature structure, centered soft-L1 response. Stable residuals refer to origin plus increment; solver output remains rounded. No structural discovery or physical validation.'};
}
export function serializeCenteredTorqueSource(raw){return JSON.stringify(openCenteredTorqueSource(raw).source,null,2);}
export function parseCenteredTorqueSource(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('Open at most 4 MiB of source');
 return openCenteredTorqueSource(JSON.parse(text));
}
