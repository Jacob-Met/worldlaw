import{prepareAffineObserver,checkAffineObserver,admitAffineObserverGroups}from'./nonlinear-affine-observer.mjs';
import{checkLinearEnvelopeSeparator}from'./shared-training-check.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
const SCHEMA='worldlaw.nonlinear-common-gain/v1',CERT='worldlaw.nonlinear-common-gain-certificate/v1';
export function admitCommonGainDeclaration(raw){
 if(raw?.schema!==SCHEMA||raw.sameGain!==true||typeof raw.basis!=='string'||!raw.basis.trim()||raw.basis.length>1000||raw.original?.schema!=='worldlaw.nonlinear-affine-observer-partitions/v1'||!Array.isArray(raw.instrumentIds)||raw.instrumentIds.length<2||raw.instrumentIds.length>16)throw Error('Explicitly declare one common gain across the complete original instrument assignment, preserving separate offsets.');
 const q=admitAffineObserverGroups(raw.original),first=q.gains[0];
 if(raw.instrumentIds.length!==q.gains.length||q.gains.some((g,i)=>raw.instrumentIds[i]!==g.instrumentId||g.gainCenter!==first.gainCenter||g.gainRadius!==first.gainRadius))throw Error('Retain every original instrument in order and identical original gain centers and bounds; no gain range is silently replaced.');
 return q;
}
export function prepareCommonGain(raw){admitCommonGainDeclaration(raw);const q=prepareAffineObserver(raw.original);
 const prefix=q.p.latentCount,rows=q.rows.map(r=>({...r,influence:[...r.influence.slice(0,prefix),r.influence.slice(prefix).reduce((a,b)=>a+b,0)]}));
 const source={schema:SCHEMA,sameGain:true,basis:raw.basis.trim(),instrumentIds:q.gains.map(g=>g.instrumentId),original:q.source};
 return{q,prefix,rows,radii:q.radii,latentCount:prefix+1,source,sourceKey:JSON.stringify(source)};
}
export function checkCommonGain(raw,certificate){
 const c=prepareCommonGain(raw),z=certificate?.values,witness=certificate?.kind==='components';
 if(certificate?.schema!==CERT||certificate.sourceKey!==c.sourceKey||!['components','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(witness?c.latentCount:c.rows.length)||z.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||!witness&&!z.some(x=>x!==0))throw Error('Retain the complete original shared-gain source and bounded certificate.');
 let result;if(!witness)result=checkLinearEnvelopeSeparator(c.rows,z,1,c.radii);else{
  const expanded=[...z.slice(0,c.prefix),...c.q.gains.map(()=>z[c.prefix])];
  const original=checkAffineObserver(c.q.source,{schema:'worldlaw.nonlinear-affine-observer-certificate/v1',sourceKey:c.q.sourceKey,kind:'components',values:expanded});
  const corrections=original.observerCorrections,common=corrections?.length===c.q.gains.length&&corrections.every(x=>x.gain===corrections[0].gain);
  result={status:original.status==='verified-interior-witness'&&common?'verified-interior-witness':'unresolved',reason:original.status==='verified-interior-witness'&&common?'one-declared-common-gain-with-separate-original-offsets-passes-complete-course':'complete-original-common-gain-recheck-not-interior',original,observerCorrections:corrections};
 }
 return{...result,qualification:'Conditional on one explicitly shared positive gain across every listed original instrument, with their separate original offsets and corrected-unit residuals unchanged. Every original law, report, reference and assigned reading remains checked. Separation concerns this complete joint declaration; no inferred correlation, failure attribution, source authentication or source adoption.'};
}
export function searchCommonGain(raw,budgets={}){if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use maintained bounded controls.');const c=prepareCommonGain(raw);return searchPreparedLinearEnvelope({training:Array(c.latentCount),receivingRadii:c.radii,marginal:{rows:c.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...c.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:c.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:c.sourceKey,kind:kind==='training-offsets'?'components':'separator',values:[...values]}),checkCandidate:x=>checkCommonGain(c.source,x),recheck:x=>checkCommonGain(c.source,x)});}
export function serializeCommonGain(certificate){const source=JSON.parse(certificate.sourceKey),check=checkCommonGain(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Only checked complete shared-gain evidence can be saved.');const raw=JSON.stringify({source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete original evidence exceeds2MB.');return raw;}
export function replayCommonGain(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original evidence up to2MB.');const x=JSON.parse(raw),check=checkCommonGain(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Original source does not recheck.');return{source:prepareCommonGain(x.source).source,certificate:x.certificate,check};}
