import {inspectCoupledResponseRegions} from './response-region.mjs';
const SCHEMA='worldlaw.coupled-response-region-inputs/v1',MAX_BYTES=4*1024*1024;
export function serializeResponseRegionInputs(notebook,path,trainingRadius){
 const report=inspectCoupledResponseRegions(notebook,path,trainingRadius);
 const text=JSON.stringify({schema:SCHEMA,notebook:report.notebook,path:report.path,trainingRadius:report.trainingRadius});
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Response-region inputs exceed 4 MiB.');return text;
}
export function reopenResponseRegionInputs(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Choose response-region JSON inputs of at most 4 MiB.');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('Response-region inputs must be valid JSON.');}
 if(!raw||Array.isArray(raw)||raw.schema!==SCHEMA||Object.keys(raw).sort().join(',')!=='notebook,path,schema,trainingRadius')throw Error('Choose input-only response-region data; stored verdicts or unknown fields are not admitted.');
 return inspectCoupledResponseRegions(raw.notebook,raw.path,raw.trainingRadius);
}
