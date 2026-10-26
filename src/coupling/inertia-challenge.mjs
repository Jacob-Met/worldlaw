import {identifyInertia} from './inertia-identification.mjs';
import {prepareInertiaWeakComparison,equationsFor,MAX_QUADRATURE_SEGMENTS} from './inertia-weak.mjs';
import {readInertiaRecord} from './inertia-record.mjs';
import {readInertiaSettings} from './inertia-investigation.mjs';
import {linearColumnRank} from '../science/linear-fit.mjs';
import {requireThat} from './science.mjs';

export const INERTIA_CHALLENGE_SCHEMA='worldlaw.coupled-inertia-challenge/v1';
const MAX_BYTES=7*1024*1024;
function object(value,expected,label){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object.');
 requireThat([Object.prototype,null].includes(Object.getPrototypeOf(value)),label+' must be a plain input object.');
 const keys=Reflect.ownKeys(value);
 requireThat(keys.length===expected.length&&keys.every(k=>typeof k==='string'&&expected.includes(k)),label+' contains missing or unsupported fields.');
 for(const k of expected)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)??{},'value'),label+' cannot contain accessors.');
}
function readTraining(value){
 object(value,['record','settings'],'Frozen training inputs');
 object(value.settings,['windowSamples','stride'],'Frozen training settings');
 return {record:readInertiaRecord(value.record),settings:readInertiaSettings(value.settings)};
}
export function readInertiaChallengeSettings(value){
 object(value,['windowSamples','stride','toleranceNm','correspondence'],'Challenge settings');
 const windows=readInertiaSettings({windowSamples:value.windowSamples,stride:value.stride});
 const band=value.toleranceNm;
 requireThat(Array.isArray(band)&&band.length===2&&Reflect.ownKeys(band).length===3,'Declare two weighted torque-balance tolerances.');
 for(let i=0;i<2;i++){
  requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(band,String(i))??{},'value'),'Tolerances must be ordinary input values.');
  requireThat(typeof band[i]==='number'&&Number.isFinite(band[i])&&band[i]>=0&&band[i]<=1e6,'Weighted torque tolerances must be numbers from 0 to 1000000 N·m.');
 }
 requireThat(typeof value.correspondence==='string'&&value.correspondence.trim().length>0&&value.correspondence.length<=1000,'Declare how the two sources share apparatus, angle order/sign and torque conventions.');
 return {...windows,toleranceNm:[...band],correspondence:value.correspondence};
}

/** A label and repeated-value screen, not authentication of independent acquisition. */
export function distinctEvidence(training,challenge){
 requireThat(training.source.label.trim().toLowerCase()!==challenge.source.label.trim().toLowerCase(),'Use a distinct source label for the challenge; the training source cannot challenge itself.','reused_evidence');
 const values=rows=>rows.map(r=>[...r.position,...r.torque]);
 const completeCourses=new Set(training.courses.map(c=>JSON.stringify(values(c.rows))));
 const block=(rows,start)=>{
  const v=values(rows.slice(start,start+5));
  // Independent recordings can legitimately share an unchanged initial rest.
  // Such a constant block alone is not a sufficient reason to refuse a course.
  return v.some(r=>r.some((x,j)=>x!==v[0][j]))?JSON.stringify(v):null;
 };
 const original=new Set();
 for(const course of training.courses)for(let i=0;i+5<=course.rows.length;i++){const key=block(course.rows,i);if(key!==null)original.add(key);}
 for(const course of challenge.courses){
  requireThat(!completeCourses.has(JSON.stringify(values(course.rows))),'A complete challenge course repeats training angle/torque values. Supply separate observations.','reused_evidence');
  for(let i=0;i+5<=course.rows.length;i++)requireThat(!original.has(block(course.rows,i)),'The challenge repeats a changing five-row angle/torque block from training, even if its label, course ID or clock was changed. Supply separate observations.','reused_evidence');
 }
}

function score(plan,coefficients,toleranceNm){
 const {equations,roundoffSuppressedFeatures}=equationsFor(plan);
 const rank=linearColumnRank(coefficients.map((_,j)=>equations.map(r=>r.features[j])));
 const rows=equations.map(row=>{
  const predictedTorque=row.features.reduce((s,x,j)=>s+x*coefficients[j],0),residual=row.observedTorque-predictedTorque;
  requireThat(Number.isFinite(predictedTorque)&&Number.isFinite(residual),'Frozen balance arithmetic became nonfinite.');
  const tolerance=toleranceNm[row.axis];
  return {...row,predictedTorque,residual,tolerance,withinDeclaredTolerance:Math.abs(residual)<=tolerance};
 });
 const summary=selected=>({equations:selected.length,rmseNm:Math.hypot(...selected.map(r=>r.residual))/Math.sqrt(selected.length),maximumAbsoluteResidualNm:Math.max(...selected.map(r=>Math.abs(r.residual))),outside:selected.filter(r=>!r.withinDeclaredTolerance).length});
 const overall=summary(rows);
 return {status:overall.outside?'exceeds_declared_tolerance':'within_declared_tolerance',...overall,rank,windowCount:plan.windows.length,roundoffSuppressedFeatures,axes:[0,1].map(axis=>({axis,...summary(rows.filter(r=>r.axis===axis))})),rows};
}

/** Fits training only. Challenge angles/torques are evaluated, never refitted. */
export function challengeInertia(trainingInput,challengeInput,settingsInput){
 const training=readTraining(trainingInput),challenge=readInertiaRecord(challengeInput),settings=readInertiaChallengeSettings(settingsInput);
 distinctEvidence(training.record,challenge);
 // Reserve the complete transaction before either fit or challenge quadrature.
 const trainPlan=prepareInertiaWeakComparison(training.record,training.settings);
 const challengePlan=prepareInertiaWeakComparison(challenge,{windowSamples:settings.windowSamples,stride:settings.stride});
 const reservedSegments=trainPlan.reservedSegments+challengePlan.reservedSegments;
 requireThat(reservedSegments<=MAX_QUADRATURE_SEGMENTS,'The complete training and separate-source comparison exceeds '+MAX_QUADRATURE_SEGMENTS+' quadrature segments. Increase the stride or shorten the sources.','work_limit');
 const fitted=identifyInertia(training.record,training.settings);
 requireThat(fitted.primary.status==='candidate','The frozen training source must identify a supported positive-definite inertia and nonnegative damping before it can be challenged.','unsupported_training');
 const coefficients=[...fitted.primary.coefficients];
 const primary=score(challengePlan.primaryPlan,coefficients,settings.toleranceNm);
 const alternate=challengePlan.alternatePlan?score(challengePlan.alternatePlan,coefficients,settings.toleranceNm):null;
 return {schema:'worldlaw.coupled-inertia-challenge-result/v1',training:fitted,challenge,settings,coefficients,primary,
  samplingComparison:{method:'every_second_original_challenge_row_with_final_endpoint_retained',alternate,meaning:'The same frozen coefficients are evaluated on coarser challenge samples. Inspect each original-index window: endpoints can differ for some widths/strides. This is filtering/sampling sensitivity, not new evidence or an error bound.'},
  diagnostics:{reservedSegments,segmentBudget:MAX_QUADRATURE_SEGMENTS,trainingFitted:true,challengeFitted:false,physicalValidity:'not_established',
   limitations:['This evaluates frozen coefficients against observed angles and supplied torques; it is not a future-motion forecast.',
    'Tolerance applies to weighted torque-balance residuals, not a calibrated sensor-error interval. Overlapping windows are correlated.',
    'Window width changes filtering and can suppress residual frequencies. Small residuals do not establish complete forcing or physical inertia.',
    'Labels and repeated-value screening cannot authenticate acquisition independence or source/coordinate calibration.',
    'Every second-row challenge retains the same frozen primary coefficients; no challenge or coarser-challenge fit is performed.']}};
}

export function readInertiaChallenge(input){
 let value=input;
 if(typeof value==='string'){
  requireThat(value.length<=MAX_BYTES&&new TextEncoder().encode(value).length<=MAX_BYTES,'Inertia challenge exceeds 7 MiB.','size_limit');
  try{value=JSON.parse(value);}catch{throw new Error('Inertia challenge is not valid JSON.');}
 }
 object(value,['schema','training','challenge','settings'],'Inertia challenge');
 requireThat(value.schema===INERTIA_CHALLENGE_SCHEMA,'Unsupported inertia challenge schema.');
 return {schema:INERTIA_CHALLENGE_SCHEMA,training:readTraining(value.training),challenge:readInertiaRecord(value.challenge),settings:readInertiaChallengeSettings(value.settings)};
}
export function exportInertiaChallenge(training,challenge,settings){
 return JSON.stringify(readInertiaChallenge({schema:INERTIA_CHALLENGE_SCHEMA,training,challenge,settings}),null,2)+'\n';
}
