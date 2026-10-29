import{prepareReferenceObservations}from'./nonlinear-reference-observations.mjs';
import{checkNonlinearCommonReference}from'./nonlinear-common-reference.mjs';
import{checkLinearEnvelopeSeparator,checkLinearEnvelopeOffsets}from'./shared-training-check.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
const SCHEMA='worldlaw.nonlinear-reference-observer/v1',CERT='worldlaw.nonlinear-reference-observer-certificate/v1',text=x=>typeof x==='string'&&x.trim()&&x.length<=1000;
export function prepareReferenceObserver(raw){
 if(raw?.schema!==SCHEMA||raw.sameObserver!==true||!text(raw.instrumentId)||!text(raw.basis)||!Number.isFinite(raw.offsetRadius)||raw.offsetRadius<0||raw.offsetRadius>1e6)throw Error('Declare one unchanged original observing instrument, additive offset bound and source basis.');
 const p=prepareReferenceObservations(raw.inquiry),c=p.c;
 if(c.rows.length+p.extra.length>128)throw Error('Complete original law and reference course exceeds128 rows.');
 const radius=raw.offsetRadius,rows=c.rows.map(r=>({...r,influence:[...r.influence,0]})),extra=p.extra.map(r=>({...r,influence:[...r.influence,-radius],independentCoefficientBoxRadius:r.independentCoefficientBoxRadius+radius,numericalTolerance:r.numericalTolerance+512*Number.EPSILON*radius}));
 const source={schema:SCHEMA,sameObserver:true,instrumentId:raw.instrumentId.trim(),basis:raw.basis.trim(),offsetRadius:radius,inquiry:p.source};
 return{p,c,source,sourceKey:JSON.stringify(source),rows:[...rows,...extra],extra,radii:[...c.radii,...p.source.observations.map(x=>x.absoluteError)],latentCount:c.latentCount+1};
}
export function checkReferenceObserver(raw,certificate){
 const p=prepareReferenceObserver(raw),z=certificate?.values,witness=certificate?.kind==='components';
 if(certificate?.schema!==CERT||certificate.sourceKey!==p.sourceKey||!['components','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(witness?p.latentCount:p.rows.length)||z.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||!witness&&!z.some(x=>x!==0))throw Error('Retain the complete original observing source and bounded certificate.');
 let result;
 if(!witness)result=checkLinearEnvelopeSeparator(p.rows,z,1,p.radii);
 else{
  const original=z.slice(0,p.c.latentCount),physical=checkNonlinearCommonReference(p.c.source,{schema:'worldlaw.nonlinear-common-reference-certificate/v1',sourceKey:p.c.sourceKey,kind:'components',values:original});
  const offset=z.at(-1)*p.source.offsetRadius,referenceValues=p.c.source.references.map((r,i)=>r.nominalTorque+r.absoluteError*original[p.c.p.latentCount+i]);
  const predicted=p.p.source.observations.map(x=>referenceValues[p.c.referenceIndex.get(x.referenceId)]-offset);
  const observed=checkLinearEnvelopeOffsets(p.extra,z,p.p.source.observations.map(x=>x.absoluteError),predicted,referenceValues);
  const ok=physical.status==='verified-interior-witness'&&observed.status==='verified-interior-witness';result={status:ok?'verified-interior-witness':'unresolved',reason:ok?'one-original-observer-offset-passes-law-and-all-reference-observations':'complete-original-recheck-not-interior',physical,observed,observerOffset:offset,referenceValues};
 }
 return{...result,qualification:'Conditional on one explicitly unchanged additive correction shared by every independent reference observation from the declared instrument. Each observation retains its own original residual bound. Original law/report/reference components are jointly checked; no independent row widening, source authentication, failure attribution or adoption is inferred.'};
}
export function searchReferenceObserver(raw,budgets={}){if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use maintained bounded controls.');const p=prepareReferenceObserver(raw);return searchPreparedLinearEnvelope({training:Array(p.latentCount),receivingRadii:p.radii,marginal:{rows:p.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...p.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:p.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:p.sourceKey,kind:kind==='training-offsets'?'components':'separator',values:[...values]}),checkCandidate:x=>checkReferenceObserver(p.source,x),recheck:x=>checkReferenceObserver(p.source,x)});}
export function serializeReferenceObserver(certificate){const source=JSON.parse(certificate.sourceKey),check=checkReferenceObserver(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Only checked original observing-source evidence can be saved.');const raw=JSON.stringify({source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete original source exceeds2MB.');return raw;}
export function replayReferenceObserver(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original evidence up to2MB.');const x=JSON.parse(raw),check=checkReferenceObserver(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Original source does not recheck.');return{source:prepareReferenceObserver(x.source).source,certificate:x.certificate,check};}
