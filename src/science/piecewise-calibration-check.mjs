import{admitPiecewiseCalibration,piecewiseCalibrationRow}from'./piecewise-calibration-source.mjs';
import{searchPreparedLinearEnvelope}from'./shared-training-search.mjs';
import{checkLinearEnvelopeOffsets,checkLinearEnvelopeSeparator}from'./shared-training-check.mjs';
const SCHEMA='worldlaw.piecewise-calibration-check/v1',CERT='worldlaw.piecewise-calibration-check-certificate/v1';
const text=x=>typeof x==='string'&&x.trim()&&x.length<=1000;
export function piecewiseCheckSource(report,raw){
 const original=admitPiecewiseCalibration(report);
 if(!raw||raw.schema!==SCHEMA||raw.units!=='N·m'||raw.independentChecks!==true||raw.sameInstrument!==true||!text(raw.reportId)||raw.reportId.trim()===original.reportId||!text(raw.basis)||!Array.isArray(raw.checks)||raw.checks.length<1||raw.checks.length>128)throw Error('Declare a distinct complete1–128-standard check course, its independence and same-instrument source.');
 const ids=new Set();const checks=raw.checks.map(s=>{if(!s||!text(s.id)||ids.has(s.id.trim())||![s.reportedTorque,s.referenceTorque,s.absoluteError].every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6)||s.absoluteError<0||!text(s.basis))throw Error('Retain every distinct original check and finite declared bound.');ids.add(s.id.trim());piecewiseCalibrationRow(original,s.reportedTorque);return{id:s.id.trim(),reportedTorque:s.reportedTorque,referenceTorque:s.referenceTorque,absoluteError:s.absoluteError,basis:s.basis.trim()};});
 return{original,course:{schema:SCHEMA,units:'N·m',reportId:raw.reportId.trim(),independentChecks:true,sameInstrument:true,basis:raw.basis.trim(),checks}};
}
function prepare(source){
 const canonical=piecewiseCheckSource(source.original,source.course),{original,course}=canonical;
 const weights=course.checks.map(s=>piecewiseCalibrationRow(original,s.reportedTorque));
 const rows=course.checks.map((s,j)=>{const r=weights[j];return{observedTorque:s.referenceTorque,refittedPrediction:s.reportedTorque+r.center,influence:r.weights.map((w,i)=>w*original.standards[i].absoluteError),independentCoefficientBoxRadius:r.radius,numericalTolerance:256*Number.EPSILON*Math.max(1,r.arithmeticScale,Math.abs(s.reportedTorque),Math.abs(s.referenceTorque),s.absoluteError)};});
 return{source:canonical,sourceKey:JSON.stringify(canonical),weights,rows,radii:course.checks.map(s=>s.absoluteError)};
}
export function checkPiecewiseStandards(source,certificate){
 const c=prepare(source),z=certificate?.values,k=c.source.original.standards.length;
 if(certificate?.schema!==CERT||certificate.sourceKey!==c.sourceKey||!['knots','separator'].includes(certificate.kind)||!Array.isArray(z)||z.length!==(certificate.kind==='knots'?k:c.rows.length)||z.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1)||certificate.kind==='separator'&&!z.some(x=>x!==0))throw Error('Retain the complete original source-bound calibration certificate.');
 let result;if(certificate.kind==='separator')result=checkLinearEnvelopeSeparator(c.rows,z,1,c.radii);else{const referenceValues=c.source.original.standards.map((s,i)=>s.referenceTorque+s.absoluteError*z[i]),predictions=c.weights.map(r=>r.weights.reduce((v,w,i)=>v+w*referenceValues[i],0));result=checkLinearEnvelopeOffsets(c.rows,z,c.radii,predictions,referenceValues);}
 return{...result,qualification:'One unchanged declared interpolation and all independently sourced check standards. Checked knot witnesses are common to the complete course; separation contradicts this declared calibration family, not the physical law. Numerical contact or search exhaustion is unresolved. No report authentication, physical independence verification or certified floating-point bounds.'};
}
export function searchPiecewiseStandards(report,course,budgets={}){
 if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Only maintained bounded search controls are admitted.');
 const c=prepare(piecewiseCheckSource(report,course)),n=c.source.original.standards.length;
 return searchPreparedLinearEnvelope({training:Array(n),receivingRadii:c.radii,marginal:{rows:c.rows,settings:{trainingRadius:1,receivingRadius:Math.max(...c.radii)}}},{maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216},{status:'unresolved',source:c.source},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:c.sourceKey,kind:kind==='training-offsets'?'knots':'separator',values:[...values]}),checkCandidate:cert=>checkPiecewiseStandards(c.source,cert),recheck:cert=>checkPiecewiseStandards(c.source,cert)});
}
export function serializePiecewiseStandards(certificate){const source=JSON.parse(certificate.sourceKey),result=checkPiecewiseStandards(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(result.status))throw Error('Only checked original evidence can be saved.');const raw=JSON.stringify({schema:SCHEMA,source,certificate},null,2);if(new TextEncoder().encode(raw).length>2000000)throw Error('Complete source exceeds2MB.');return raw;}
export function replayPiecewiseStandards(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)throw Error('Choose complete original source evidence up to2MB.');const x=JSON.parse(raw);if(x.schema!==SCHEMA)throw Error('Choose original nonlinear check evidence.');const result=checkPiecewiseStandards(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(result.status))throw Error('Original source recheck failed.');return{source:prepare(x.source).source,certificate:x.certificate,check:result};}
