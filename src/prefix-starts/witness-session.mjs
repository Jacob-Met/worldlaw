import{createPrefixStartsStudy}from'./session.mjs';import{receivePrefixStartWitnesses}from'./witnesses.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createPrefixWitnessStudy(raw){
 if(raw?.schema!=='worldlaw.prefix-start-witness-inputs/v1')throw Error('Unsupported prefix-witness source');
 if(!raw.request||Object.keys(raw.request).sort().join(',')!=='maxPrefixRMSE,modelLabel,runId,times')throw Error('Declare only original course, frozen model label, residual limit and forecast times');
 const original=createPrefixStartsStudy(raw.original),source={schema:raw.schema,original:copy(original.source),request:copy(raw.request)},q=source.request;
 try{const selected=original.results.find(r=>r.label===q.modelLabel&&r.runId===q.runId);if(!selected?.fit?.model)throw Error('Selected original frozen model or prefix unavailable');const result=receivePrefixStartWitnesses(selected.fit.model,selected.fit.originalPrefix,{times:q.times},{...original.source.options,maxPrefixRMSE:q.maxPrefixRMSE});return{source,original,result,status:result.status,meaning:'A separately requested frozen law and original prefix; original fitted-state and incumbent results remain retained. Only forecast times enter the additional comparison. Source-only replay recomputes laws, prefix fits and witnesses.'};}
 catch(e){return{source,original,result:null,status:'witness_comparison_refused',error:e.message};}
}
export const savePrefixWitnessStudy=s=>JSON.stringify(s.source,null,2);
export function reopenPrefixWitnessStudy(text){if(typeof text!=='string'||text.length>3000000)throw Error('Use source JSON under3MB');return createPrefixWitnessStudy(JSON.parse(text));}
