import{prepareReferenceObservations}from'./nonlinear-reference-observations.mjs';
import{checkNonlinearCommonReference}from'./nonlinear-common-reference.mjs';
import{checkLinearEnvelopeSeparator,checkLinearEnvelopeOffsets}from'./shared-training-check.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
const SCHEMA='worldlaw.nonlinear-reference-observer/v1',CERT='worldlaw.nonlinear-reference-observer-certificate/v1',text=x=>typeof x==='string'&&x.trim()&&x.length<=1000;
export function admitOriginalObserverGroups(raw,observations){
 const partitioned=raw?.schema==='worldlaw.nonlinear-reference-observer-partitions/v1';
 if(!text(raw?.basis)||(!partitioned&&(raw?.schema!==SCHEMA||raw.sameObserver!==true))||!Array.isArray(observations)||!observations.length||observations.length>128)throw Error('Retain complete original observing assignments.');
 const ids=new Set();for(const x of observations){if(!text(x?.id)||ids.has(x.id))throw Error('Retain unique original observation identities.');ids.add(x.id);}
 const bounded=g=>{const center=g.offsetCenter===undefined?0:g.offsetCenter;if(!text(g.instrumentId)||!text(g.basis)||!Number.isFinite(g.offsetRadius)||g.offsetRadius<0||g.offsetRadius>1e6||!Number.isFinite(center)||Math.abs(center)>1e6)throw Error('Retain a sourced finite original observing center and radius.');return{instrumentId:g.instrumentId.trim(),basis:g.basis.trim(),offsetRadius:g.offsetRadius,...(g.offsetCenter===undefined?{}:{offsetCenter:center})};};
 let groups,assignment;
 if(partitioned){
  if(raw.sameAssignedObservers!==true||!Array.isArray(raw.observers)||raw.observers.length<2||raw.observers.length>16)throw Error('Explicitly associate2–16 original observing instruments.');
  const identities=new Set(),byId=new Map(observations.map((x,i)=>[x.id,i]));assignment=Array(observations.length).fill(-1);let count=0;
  groups=raw.observers.map((g,j)=>{const admitted=bounded(g);if(identities.has(admitted.instrumentId))throw Error('Each original instrument must have one correction declaration.');identities.add(admitted.instrumentId);if(!Array.isArray(g.observationIds)||!g.observationIds.length||g.observationIds.length>observations.length)throw Error('Retain every original observation identity in its instrument assignment.');const ids=g.observationIds.map(id=>{const i=byId.get(id);if(i===undefined||assignment[i]!==-1)throw Error('Original observing assignments must be disjoint and contain only retained readings.');assignment[i]=j;count++;return id;});return{...admitted,observationIds:ids};});
  if(count!==observations.length||assignment.some(x=>x<0))throw Error('Assign the complete original reference-observation course.');
 }else{groups=[bounded(raw)];assignment=observations.map(()=>0);}
 return{groups,assignment,partitioned};
}
export function prepareReferenceObserver(raw){
 const partitioned=raw?.schema==='worldlaw.nonlinear-reference-observer-partitions/v1';
 if(!text(raw?.basis)||(!partitioned&&(raw?.schema!==SCHEMA||raw.sameObserver!==true)))throw Error('Declare the complete original observing source.');
 const p=prepareReferenceObservations(raw.inquiry),c=p.c;
 if(c.rows.length+p.extra.length>128)throw Error('Complete original law and reference course exceeds128 rows.');
 const{groups,assignment}=admitOriginalObserverGroups(raw,p.source.observations);
 const rows=c.rows.map(r=>({...r,influence:[...r.influence,...groups.map(()=>0)]})),extra=p.extra.map((r,i)=>{const g=groups[assignment[i]],center=g.offsetCenter??0,radius=g.offsetRadius;return{...r,refittedPrediction:r.refittedPrediction-center,influence:[...r.influence,...groups.map((_,j)=>j===assignment[i]?-radius:0)],independentCoefficientBoxRadius:r.independentCoefficientBoxRadius+radius,numericalTolerance:r.numericalTolerance+512*Number.EPSILON*(radius+Math.abs(center))};});
 const source=partitioned?{schema:raw.schema,sameAssignedObservers:true,basis:raw.basis.trim(),observers:groups,inquiry:p.source}:{schema:SCHEMA,sameObserver:true,...groups[0],inquiry:p.source};
 return{p,c,source,sourceKey:JSON.stringify(source),groups,assignment,partitioned,rows:[...rows,...extra],extra,radii:[...c.radii,...p.source.observations.map(x=>x.absoluteError)],latentCount:c.latentCount+groups.length};
}
export function checkReferenceObserver(raw,certificate){
 const p=prepareReferenceObserver(raw),z=certificate?.values,witness=certificate?.kind==='components';
 if(certificate?.schema!==CERT||certificate.sourceKey!==p.sourceKey||!['components','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(witness?p.latentCount:p.rows.length)||z.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||!witness&&!z.some(x=>x!==0))throw Error('Retain the complete original observing source and bounded certificate.');
 let result;
 if(!witness)result=checkLinearEnvelopeSeparator(p.rows,z,1,p.radii);
 else{
  const original=z.slice(0,p.c.latentCount),physical=checkNonlinearCommonReference(p.c.source,{schema:'worldlaw.nonlinear-common-reference-certificate/v1',sourceKey:p.c.sourceKey,kind:'components',values:original});
  const offsets=p.groups.map((g,i)=>(g.offsetCenter??0)+z[p.c.latentCount+i]*g.offsetRadius),referenceValues=p.c.source.references.map((r,i)=>r.nominalTorque+r.absoluteError*original[p.c.p.latentCount+i]);
  const predicted=p.p.source.observations.map((x,i)=>referenceValues[p.c.referenceIndex.get(x.referenceId)]-offsets[p.assignment[i]]);
  const observed=checkLinearEnvelopeOffsets(p.extra,z,p.p.source.observations.map(x=>x.absoluteError),predicted,referenceValues);
  const ok=physical.status==='verified-interior-witness'&&observed.status==='verified-interior-witness';result={status:ok?'verified-interior-witness':'unresolved',reason:ok?(p.partitioned?'complete-original-instrument-assignment-passes-law-and-all-reference-observations':'one-original-observer-offset-passes-law-and-all-reference-observations'):'complete-original-recheck-not-interior',physical,observed,...(p.partitioned?{observerOffsets:p.groups.map((g,i)=>({instrumentId:g.instrumentId,offset:offsets[i]}))}:{observerOffset:offsets[0]}),referenceValues};
 }
 return{...result,qualification:p.partitioned?'Conditional on the complete explicit original instrument-to-reading partition. One correction per instrument is shared only by its assigned original readings; all original law/report/reference components are jointly checked, residual bounds unchanged. No cross-instrument correlation, authentication, failure attribution or adoption is inferred.':'Conditional on one explicitly unchanged additive correction shared by every independent reference observation from the declared instrument. Each observation retains its own original residual bound. Original law/report/reference components are jointly checked; no independent row widening, source authentication, failure attribution or adoption is inferred.'};
}
export function searchReferenceObserver(raw,budgets={}){if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use maintained bounded controls.');const p=prepareReferenceObserver(raw);return searchPreparedLinearEnvelope({training:Array(p.latentCount),receivingRadii:p.radii,marginal:{rows:p.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...p.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:p.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:p.sourceKey,kind:kind==='training-offsets'?'components':'separator',values:[...values]}),checkCandidate:x=>checkReferenceObserver(p.source,x),recheck:x=>checkReferenceObserver(p.source,x)});}
export function serializeReferenceObserver(certificate){const source=JSON.parse(certificate.sourceKey),check=checkReferenceObserver(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Only checked original observing-source evidence can be saved.');const raw=JSON.stringify({source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete original source exceeds2MB.');return raw;}
export function replayReferenceObserver(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original evidence up to2MB.');const x=JSON.parse(raw),check=checkReferenceObserver(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Original source does not recheck.');return{source:prepareReferenceObserver(x.source).source,certificate:x.certificate,check};}
