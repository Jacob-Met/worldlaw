import{preparePiecewiseCalibrationSource,checkPiecewiseCalibration}from'./piecewise-calibration.mjs';
import{preparePiecewiseCheckSource,piecewiseCheckSource,checkPiecewiseStandards}from'./piecewise-calibration-check.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
import{checkLinearEnvelopeSeparator}from'./shared-training-check.mjs';
const SCHEMA='worldlaw.conditioned-piecewise-calibration/v1',CERT='worldlaw.conditioned-piecewise-certificate/v1';
function prepare(raw){
 if(raw?.schema!==SCHEMA||raw.conditioned!==true||typeof raw.basis!=='string'||!raw.basis.trim()||raw.basis.length>1000)throw Error('Explicitly source the complete calibration-conditioned inquiry.');
 const physical=preparePiecewiseCalibrationSource(raw.physical);if(physical.status!=='prepared')throw Error('Original law evidence cannot prepare this bounded inquiry.');
 const calibration=preparePiecewiseCheckSource(piecewiseCheckSource(physical.report,raw.checks));
 if(physical.receiving.length+calibration.rows.length>128)throw Error('The complete physical and calibration course exceeds128 rows; no subset is selected.');
 const rows=[...physical.normalizedRows,...calibration.rows.map(r=>({...r,influence:r.influence.concat(Array(physical.residuals?.length??0).fill(0))}))],radii=[...physical.radii,...calibration.radii];
 const source={schema:SCHEMA,conditioned:true,basis:raw.basis.trim(),physical:physical.source,checks:calibration.source.course};
 return{physical,calibration,rows,radii,source,sourceKey:JSON.stringify(source)};
}
export function checkConditionedPiecewise(source,certificate){
 const c=prepare(source),z=certificate?.values,witness=certificate?.kind==='components';
 if(certificate?.schema!==CERT||certificate.sourceKey!==c.sourceKey||!['components','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(witness?c.physical.latentCount:c.rows.length)||z.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1)||!witness&&!z.some(x=>x!==0))throw Error('Retain every original source and complete bounded certificate.');
 let result;if(!witness)result=checkLinearEnvelopeSeparator(c.rows,z,1,c.radii);else{
  const physical=checkPiecewiseCalibration(c.physical.source,{schema:'worldlaw.piecewise-calibration-certificate/v1',sourceKey:c.physical.sourceKey,kind:'calibration-knots',values:z});
  const calibration=checkPiecewiseStandards(c.calibration.source,{schema:'worldlaw.piecewise-calibration-check-certificate/v1',sourceKey:c.calibration.sourceKey,kind:'knots',values:z.slice(0,c.physical.report.standards.length)});
  const accepted=physical.status==='verified-interior-witness'&&calibration.status==='verified-interior-witness';
  result={status:accepted?'verified-interior-witness':'unresolved',reason:accepted?'same-original-correction-received-by-law-and-calibration-course':'complete-independent-recheck-not-interior',physical,calibration};
 }
 return{...result,physicalRows:c.physical.receiving.length,calibrationRows:c.calibration.rows.length,qualification:'Explicitly conditioned on all original independent standards and original law evidence sharing one calibration correction. Independent original-reading residuals remain separate. Joint separation rejects this combined source/model explanation, not the physical law alone. No source or fitted law is adopted; prior separate inquiries remain unchanged. Numerical contact and bounded search exhaustion are unresolved.'};
}
export function searchConditionedPiecewise(physical,checks,basis,budgets={}){
 if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use maintained complete bounded search controls.');
 const c=prepare({schema:SCHEMA,conditioned:true,basis,physical,checks});
 return searchPreparedLinearEnvelope({training:Array(c.physical.latentCount),receivingRadii:c.radii,marginal:{rows:c.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...c.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:c.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:c.sourceKey,kind:kind==='training-offsets'?'components':'separator',values:[...values]}),checkCandidate:cert=>checkConditionedPiecewise(c.source,cert),recheck:cert=>checkConditionedPiecewise(c.source,cert)});
}
export function serializeConditionedPiecewise(certificate){const source=JSON.parse(certificate.sourceKey),result=checkConditionedPiecewise(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(result.status))throw Error('Only complete checked original evidence may be saved.');const raw=JSON.stringify({schema:SCHEMA,source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete source exceeds2MB.');return raw;}
export function replayConditionedPiecewise(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original evidence up to2MB.');const x=JSON.parse(raw);if(x.schema!==SCHEMA)throw Error('Choose original conditioned calibration evidence.');const result=checkConditionedPiecewise(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(result.status))throw Error('Complete original source recheck failed.');return{source:prepare(x.source).source,certificate:x.certificate,check:result};}
