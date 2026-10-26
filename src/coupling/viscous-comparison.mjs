/** Explicit symmetric-loss alternative to the maintained diagonal weak balance.
 * Original positions/torques are integrated, never differentiated or repaired.
 */
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {readSymmetricInertia} from './inertia.mjs';
import {readInertiaRecord,INERTIA_RECORD_SCHEMA} from './inertia-record.mjs';
import {readInertiaSettings} from './inertia-investigation.mjs';
import {identifyInertia} from './inertia-identification.mjs';
import {distinctEvidence,readInertiaChallengeSettings} from './inertia-challenge.mjs';
import {prepareInertiaWeakComparison,equationsFor,MAX_QUADRATURE_SEGMENTS} from './inertia-weak.mjs';
import {requireThat} from './science.mjs';

export const VISCOUS_RECORD_SCHEMA='worldlaw.coupled-viscous-observations/v1';
export const VISCOUS_STUDY_SCHEMA='worldlaw.coupled-viscous-study/v1';
export const VISCOUS_INTERPRETATION='compare-diagonal-and-symmetric-viscous-loss';
const MAX_BYTES=7*1024*1024;
const PARAMETERS=Object.freeze(['M00','M01','M11','D00','D11','D01']);

function object(value,keys,label){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object.');
 requireThat([Object.prototype,null].includes(Object.getPrototypeOf(value)),label+' must be a plain input object.');
 const own=Reflect.ownKeys(value);
 requireThat(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)),label+' contains missing or unsupported fields.');
 for(const key of keys)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)??{},'value'),label+' cannot contain accessors.');
}
function parse(input){
 if(typeof input!=='string')return input;
 requireThat(input.length<=MAX_BYTES&&new TextEncoder().encode(input).length<=MAX_BYTES,'Viscous study exceeds 7 MiB.','size_limit');
 try{return JSON.parse(input);}catch{throw new Error('Viscous study must be valid JSON.');}
}
/** Reuses legacy numeric admission only; the new record retains its explicit
 * alternate-family declaration. No source value is rewritten or inferred.
 */
function legacyRecord(record){
 return {schema:INERTIA_RECORD_SCHEMA,units:record.units,
  interpretation:'constant-symmetric-inertia-with-diagonal-viscous-loss',
  torqueDeclaration:record.torqueDeclaration,
  source:{label:record.source.label,description:record.source.description},courses:record.courses};
}
export function readViscousRecord(input){
 const raw=parse(input);
 object(raw,['schema','units','interpretation','torqueDeclaration','source','courses'],'Viscous observations');
 requireThat(raw.schema===VISCOUS_RECORD_SCHEMA&&raw.interpretation===VISCOUS_INTERPRETATION,
  'Explicitly declare comparison of diagonal and symmetric viscous loss.');
 object(raw.source,['kind','label','description'],'Viscous source');
 requireThat(['synthetic','measured'].includes(raw.source.kind),'Declare synthetic or user-declared measured source.');
 const checked=readInertiaRecord(legacyRecord(raw));
 return {...checked,schema:VISCOUS_RECORD_SCHEMA,interpretation:VISCOUS_INTERPRETATION,
  source:{kind:raw.source.kind,...checked.source}};
}
export function readViscousStudy(input){
 const raw=parse(input);object(raw,['schema','training','challenge'],'Viscous study');
 requireThat(raw.schema===VISCOUS_STUDY_SCHEMA,'Choose a WORLDLAW viscous comparison study.');
 object(raw.training,['record','settings'],'Training inputs');
 object(raw.training.settings,['windowSamples','stride'],'Training settings');
 const training={record:readViscousRecord(raw.training.record),settings:readInertiaSettings(raw.training.settings)};
 let challenge=null;
 if(raw.challenge!==null){
  object(raw.challenge,['record','settings'],'Separate motion inputs');
  challenge={record:readViscousRecord(raw.challenge.record),settings:readInertiaChallengeSettings(raw.challenge.settings)};
  distinctEvidence(legacyRecord(training.record),legacyRecord(challenge.record));
 }
 return {schema:VISCOUS_STUDY_SCHEMA,training,challenge};
}
export function exportViscousStudy(input){
 const text=JSON.stringify(readViscousStudy(input),null,2)+'\n';
 requireThat(new TextEncoder().encode(text).length<=MAX_BYTES,'Viscous study exceeds 7 MiB.','size_limit');
 return text;
}
function symmetricRows(plan){
 const original=equationsFor(plan),rows=original.equations;
 return {roundoffSuppressedFeatures:original.roundoffSuppressedFeatures,
  rows:rows.map((row,i)=>{
   const partner=rows[row.axis===0?i+1:i-1];
   requireThat(partner&&partner.axis!==row.axis&&partner.courseId===row.courseId&&partner.firstRow===row.firstRow&&partner.lastRow===row.lastRow,
    'Weak operator returned an unmatched original-source window.','numerical_failure');
   const crossRate=row.axis===0?partner.features[4]:partner.features[3];
   return {...row,features:[...row.features,crossRate]};
  })};
}
function readDamping(d0,d1,cross){
 requireThat([d0,d1,cross].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6)&&d0>=0&&d1>=0,
  'Unconstrained fitted damping is outside the finite nonnegative-diagonal family.');
 requireThat(Math.abs(cross)<=Math.sqrt(d0)*Math.sqrt(d1),
  'Unconstrained fitted symmetric damping is not positive semidefinite.');
 const scale=Math.max(d0,d1,Math.abs(cross));
 let minimumEigenvalue=0,maximumEigenvalue=0;
 if(scale){
  const a=d0/scale,b=d1/scale,c=cross/scale;
  maximumEigenvalue=(a+b+Math.hypot(a-b,2*c))/2*scale;
  minimumEigenvalue=(a*b-c*c)/(maximumEigenvalue/scale)*scale;
 }
 return {matrix:[[d0,cross],[cross,d1]],minimumEigenvalue,maximumEigenvalue,
  meaning:'Conditional symmetric viscous-loss matrix; numerical PSD admission does not establish physical passivity.'};
}
function predictRows(rows,coefficients,tolerances=null){
 return rows.map(row=>{
  const predictedTorque=row.features.reduce((s,x,j)=>s+x*coefficients[j],0),residual=row.observedTorque-predictedTorque;
  requireThat(Number.isFinite(predictedTorque)&&Number.isFinite(residual),'Viscous balance arithmetic became nonfinite.','numerical_failure');
  return {...row,predictedTorque,residual,...(tolerances?{tolerance:tolerances[row.axis],withinDeclaredTolerance:Math.abs(residual)<=tolerances[row.axis]}:{})};
 });
}
function summary(rows){
 return {equationCount:rows.length,rmseNm:Math.hypot(...rows.map(r=>r.residual))/Math.sqrt(rows.length),
  maximumAbsoluteResidualNm:Math.max(...rows.map(r=>Math.abs(r.residual)))};
}
function fitSymmetric(plan){
 const {rows,roundoffSuppressedFeatures}=symmetricRows(plan);
 const columns=PARAMETERS.map((_,j)=>rows.map(r=>r.features[j]));
 const rank=linearColumnRank(columns),fit=fitLinearColumns(columns,rows.map(r=>r.observedTorque));
 const common={parameters:[...PARAMETERS],rank,equationCount:rows.length,windowCount:plan.windows.length,roundoffSuppressedFeatures};
 if(!fit)return {...common,status:'unidentified',coefficients:null,rows};
 const [m00,m01,m11,d0,d1,cross]=fit.coefficients;
 const predicted=predictRows(rows,fit.coefficients);let inertia=null,damping=null,refusal=null;
 try{inertia=readSymmetricInertia([m00,m11],m01);damping=readDamping(d0,d1,cross);}catch(error){refusal=error.message;}
 return {...common,status:refusal?'outside_supported_family':'candidate',coefficients:[...fit.coefficients],
  conditionEstimate:fit.conditionEstimate,meanTorqueBalanceRmse:summary(predicted).rmseNm,rows:predicted,refusal,
  inertia:inertia?{matrix:inertia.matrix,minimumEigenvalue:inertia.minimumEigenvalue,conditionInfinity:inertia.conditionInfinity}:null,damping};
}
function receive(rows,fit,tolerances){
 if(fit.status!=='candidate')return {status:'unsupported_training',rows:[],reason:fit.status,rmseNm:null,outside:null};
 const coefficients=fit.coefficients.length===5?[...fit.coefficients,0]:fit.coefficients;
 const predicted=predictRows(rows,coefficients,tolerances),outside=predicted.filter(r=>!r.withinDeclaredTolerance).length;
 return {status:outside?'exceeds_declared_tolerance':'within_declared_tolerance',...summary(predicted),outside,rows:predicted};
}
/** The two complete training fits are fixed before either receives later data.
 * Every quadrature call is included in the aggregate reservation, including
 * the unchanged baseline's original/coarser calculations.
 */
export function compareViscousStudy(input){
 const study=readViscousStudy(input),legacy=legacyRecord(study.training.record);
 const trainingPlan=prepareInertiaWeakComparison(legacy,study.training.settings);
 const challengePlan=study.challenge?prepareInertiaWeakComparison(legacyRecord(study.challenge.record),study.challenge.settings):null;
 const reservedSegments=2*trainingPlan.reservedSegments+(challengePlan?.reservedSegments??0);
 requireThat(reservedSegments<=MAX_QUADRATURE_SEGMENTS,
  'The complete two-family and separate-source comparison exceeds '+MAX_QUADRATURE_SEGMENTS+' quadrature segments. Increase the stride or shorten the sources.','work_limit');
 const diagonal=identifyInertia(legacy,study.training.settings);
 const primary=fitSymmetric(trainingPlan.primaryPlan),alternate=trainingPlan.alternatePlan?fitSymmetric(trainingPlan.alternatePlan):null;
 const symmetric={primary,samplingComparison:{alternate,absoluteCoefficientDifferences:primary.coefficients&&alternate?.coefficients?primary.coefficients.map((x,i)=>Math.abs(x-alternate.coefficients[i])):null}};
 let challenge=null;
 if(challengePlan){
  const rows=symmetricRows(challengePlan.primaryPlan).rows;
  const coarser=challengePlan.alternatePlan?symmetricRows(challengePlan.alternatePlan).rows:null;
  const tolerance=study.challenge.settings.toleranceNm;
  challenge={diagonal:receive(rows,diagonal.primary,tolerance),symmetric:receive(rows,primary,tolerance),
   samplingComparison:coarser?{diagonal:receive(coarser,diagonal.primary,tolerance),symmetric:receive(coarser,primary,tolerance)}:null};
 }
 return {schema:'worldlaw.coupled-viscous-comparison/v1',study,diagonal,symmetric,challenge,
  diagnostics:{reservedSegments,segmentBudget:MAX_QUADRATURE_SEGMENTS,challengeFitted:false,automaticallySelectedFamily:null,
   physicalValidity:'not_established',equations:['M q″ + diag(D) q′ = supplied torque','M q″ + D q′ = supplied torque'],
   limitations:['Both offered laws require constant symmetric inertia and complete supplied right-hand-side torque except the modeled viscous loss.',
    'The larger family has one additional coefficient. Lower training residual alone does not establish cross-coordinate drag.',
    'Overlapping weak windows are correlated; their residuals and source coarsening are not confidence intervals or independent evidence.',
    'Rank concerns the offered numerical library. Unmodeled forces, sensor mixing or calibration can imitate fitted coupling.',
    'PSD admission is conditional model arithmetic, not physical passivity. An inadmissible unconstrained fit does not exclude every admissible law.',
    'Separate-motion receiving uses observed angles; it is not a future-motion forecast. Source labels/repetition checks do not authenticate independence.']}};
}
