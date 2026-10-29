import{prepareAffineObserver}from'./nonlinear-affine-observer.mjs';
import{checkNonlinearCommonReference}from'./nonlinear-common-reference.mjs';
import{checkLinearEnvelopeSeparator,checkLinearEnvelopeOffsets}from'./shared-training-check.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
const SCHEMA='worldlaw.nonlinear-raw-observer/v1',CERT='worldlaw.nonlinear-raw-observer-certificate/v1';
export function prepareRawObserver(raw){
 if(raw?.schema!==SCHEMA||raw.rawReadoutResiduals!==true||raw.correctedUnitResiduals!==undefined)throw Error('Explicitly declare residual intervals in original raw readout units.');
 // Reuse original source/positive-factor admission and latent layout only.
 // The corrected-unit observation rows are replaced in full below.
 const q=prepareAffineObserver({...raw,schema:'worldlaw.nonlinear-affine-observer/v1',correctedUnitResiduals:true}),p=q.p;
 if(p.c.rows.length+2*p.extra.length>128)throw Error('Complete raw interval conditions exceed128 rows; no observation subset admitted.');
 const extra=[],radii=[];
 for(let i=0;i<q.extra.length;i++){
  const row=q.extra[i],x=p.p.source.observations[i],e=x.absoluteError;
  for(const sign of[1,-1]){
   const baseline=sign*(row.refittedPrediction-x.value)+(1+q.source.gainCenter)*e,influence=row.influence.map(v=>sign*v);influence[p.latentCount]+=q.source.gainRadius*e;
   const support=influence.reduce((s,v)=>s+Math.abs(v),0),upper=Math.abs(baseline)+support+1,radius=upper/2;
   const allowance=row.numericalTolerance+Math.max(2048,64*(influence.length+8))*Number.EPSILON*Math.max(1,Math.abs(row.refittedPrediction)+Math.abs(x.value)+(1+Math.abs(q.source.gainCenter)+q.source.gainRadius)*e+support+upper);
   if(![baseline,...influence,support,upper,radius,allowance].every(Number.isFinite)||!(upper>0))throw Error('Finite complete raw-interval arithmetic required.');
   // f>=0 represented by 0<=f<=upper. The upper side is redundant over
   // the entire original unit component box, not a chosen candidate.
   extra.push({observedTorque:radius,refittedPrediction:baseline,influence,independentCoefficientBoxRadius:support,numericalTolerance:allowance});radii.push(radius);
  }
 }
 const source={schema:SCHEMA,sameAffineObserver:true,rawReadoutResiduals:true,basis:q.source.basis,gainCenter:q.source.gainCenter,gainRadius:q.source.gainRadius,original:q.source.original};
 return{q,p,source,sourceKey:JSON.stringify(source),extra,rows:[...q.rows.slice(0,p.c.rows.length),...extra],radii:[...p.c.radii,...radii],extraRadii:radii,latentCount:q.latentCount};
}
export function checkRawObserver(raw,certificate){
 const c=prepareRawObserver(raw),{q,p}=c,z=certificate?.values,witness=certificate?.kind==='components';
 if(certificate?.schema!==CERT||certificate.sourceKey!==c.sourceKey||!['components','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(witness?c.latentCount:c.rows.length)||z.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||!witness&&!z.some(x=>x!==0))throw Error('Retain complete original raw-unit source and bounded certificate.');
 let result;if(!witness)result=checkLinearEnvelopeSeparator(c.rows,z,1,c.radii);else{
  const original=z.slice(0,p.c.latentCount),physical=checkNonlinearCommonReference(p.c.source,{schema:'worldlaw.nonlinear-common-reference-certificate/v1',sourceKey:p.c.sourceKey,kind:'components',values:original});
  const gain=c.source.gainCenter+c.source.gainRadius*z[p.latentCount],factor=1+gain,offset=(p.groups[0].offsetCenter??0)+p.groups[0].offsetRadius*z[p.c.latentCount],referenceValues=p.c.source.references.map((r,i)=>r.nominalTorque+r.absoluteError*original[p.c.p.latentCount+i]);
  const predicted=[],rawReadings=p.p.source.observations.map((x,i)=>{const reference=referenceValues[p.c.referenceIndex.get(x.referenceId)],value=(reference-offset)/factor,margin=x.absoluteError-Math.abs(value-x.value),tolerance=Math.max(c.extra[2*i].numericalTolerance,c.extra[2*i+1].numericalTolerance)/factor+1024*Number.EPSILON*Math.max(1,Math.abs(value),Math.abs(x.value));predicted.push(reference-offset-factor*(x.value-x.absoluteError),factor*(x.value+x.absoluteError)+offset-reference);return{id:x.id,referenceId:x.referenceId,rawValue:value,rawMargin:margin,numericalTolerance:tolerance,strictInterior:Number.isFinite(value)&&Number.isFinite(margin)&&factor>0&&margin>tolerance};});
  const observed=checkLinearEnvelopeOffsets(c.extra,z,c.extraRadii,predicted,[...referenceValues,gain,offset]);const ok=physical.status==='verified-interior-witness'&&observed.status==='verified-interior-witness'&&rawReadings.every(x=>x.strictInterior);
  result={status:ok?'verified-interior-witness':'unresolved',reason:ok?'one-positive-affine-observer-receives-every-original-raw-interval':'complete-original-raw-recheck-not-interior',physical,observed,rawReadings,observerGain:gain,observerOffset:offset};
 }
 return{...result,qualification:'Conditional on one positive affine observing correction and explicitly raw-readout residual intervals. Both complete interval inequalities share the original gain and offset; independent reconstructed raw values and original-law/refit checks must pass. Corrected-unit declarations are a separate model. No raw interval is silently widened, no law or source is authenticated, and numerical contact or search exhaustion remains unresolved.'};
}
export function searchRawObserver(raw,budgets={}){if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use maintained bounded controls.');const c=prepareRawObserver(raw);return searchPreparedLinearEnvelope({training:Array(c.latentCount),receivingRadii:c.radii,marginal:{rows:c.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...c.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:c.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:c.sourceKey,kind:kind==='training-offsets'?'components':'separator',values:[...values]}),checkCandidate:x=>checkRawObserver(c.source,x),recheck:x=>checkRawObserver(c.source,x)});}
export function serializeRawObserver(certificate){const source=JSON.parse(certificate.sourceKey),check=checkRawObserver(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Only checked complete raw-unit evidence can be saved.');const raw=JSON.stringify({source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete original source exceeds2MB.');return raw;}
export function replayRawObserver(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original evidence up to2MB.');const x=JSON.parse(raw),check=checkRawObserver(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Original raw-unit source does not recheck.');return{source:prepareRawObserver(x.source).source,certificate:x.certificate,check};}
