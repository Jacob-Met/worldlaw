/** Three explicit velocity laws, using maintained weak angle/torque balances.
 * A skew term does no quadratic work; a fitted term does not identify its cause.
 */
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {readSymmetricInertia} from './inertia.mjs';
import {readSymmetricDamping} from './damping.mjs';
import {prepareInertiaWeakComparison,MAX_QUADRATURE_SEGMENTS} from './inertia-weak.mjs';
import {requireThat} from './science.mjs';
import {VISCOUS_RECORD_SCHEMA,VISCOUS_STUDY_SCHEMA,VISCOUS_INTERPRETATION,
 readViscousStudy,compareViscousStudy,viscousLegacyRecord,symmetricViscousRows,
 predictViscousRows,summarizeViscousRows} from './viscous-comparison.mjs';

export const VELOCITY_RECORD_SCHEMA='worldlaw.coupled-velocity-observations/v1';
export const VELOCITY_STUDY_SCHEMA='worldlaw.coupled-velocity-study/v1';
export const VELOCITY_INTERPRETATION='compare-viscous-and-skew-velocity-coupling';
const PARAMETERS=['M00','M01','M11','D00','D11','D01','G01'],MAX_BYTES=7*1024*1024;

function object(value,keys,label){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object.');
 requireThat([Object.prototype,null].includes(Object.getPrototypeOf(value)),label+' must be a plain input object.');
 const own=Reflect.ownKeys(value);requireThat(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)),label+' contains missing or unsupported fields.');
 for(const key of keys)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)??{},'value'),label+' cannot contain accessors.');
}
function toViscousRecord(record){
 object(record,['schema','units','interpretation','torqueDeclaration','source','courses'],'Velocity observations');
 requireThat(record.schema===VELOCITY_RECORD_SCHEMA&&record.interpretation===VELOCITY_INTERPRETATION,'Explicitly declare comparison of viscous and skew velocity coupling.');
 return {...record,schema:VISCOUS_RECORD_SCHEMA,interpretation:VISCOUS_INTERPRETATION};
}
function restoreRecord(record){return {...record,schema:VELOCITY_RECORD_SCHEMA,interpretation:VELOCITY_INTERPRETATION};}
function viscousStudy(study){return {schema:VISCOUS_STUDY_SCHEMA,training:{...study.training,record:toViscousRecord(study.training.record)},challenge:study.challenge?{...study.challenge,record:toViscousRecord(study.challenge.record)}:null};}
export function readVelocityStudy(input){
 let raw=input;if(typeof input==='string'){
  requireThat(input.length<=MAX_BYTES&&new TextEncoder().encode(input).length<=MAX_BYTES,'Velocity study exceeds 7 MiB.','size_limit');
  try{raw=JSON.parse(input);}catch{throw Error('Velocity study must be valid JSON.');}
 }
 object(raw,['schema','training','challenge'],'Velocity study');
 requireThat(raw.schema===VELOCITY_STUDY_SCHEMA,'Choose a WORLDLAW velocity-law comparison study.');
 object(raw.training,['record','settings'],'Training inputs');
 if(raw.challenge!==null)object(raw.challenge,['record','settings'],'Separate motion inputs');
 const checked=readViscousStudy(viscousStudy(raw));
 return {schema:VELOCITY_STUDY_SCHEMA,training:{...checked.training,record:restoreRecord(checked.training.record)},challenge:checked.challenge?{...checked.challenge,record:restoreRecord(checked.challenge.record)}:null};
}
export function exportVelocityStudy(input){
 const text=JSON.stringify(readVelocityStudy(input),null,2)+'\n';
 requireThat(new TextEncoder().encode(text).length<=MAX_BYTES,'Velocity study exceeds 7 MiB.','size_limit');return text;
}
function skewRows(plan){
 const original=symmetricViscousRows(plan);
 return {...original,rows:original.rows.map(row=>({...row,features:[...row.features,(row.axis===0?1:-1)*row.features[5]]}))};
}
function fitSkew(plan){
 const {rows,roundoffSuppressedFeatures}=skewRows(plan),columns=PARAMETERS.map((_,j)=>rows.map(r=>r.features[j]));
 const rank=linearColumnRank(columns),fit=fitLinearColumns(columns,rows.map(r=>r.observedTorque));
 const common={parameters:[...PARAMETERS],rank,equationCount:rows.length,windowCount:plan.windows.length,roundoffSuppressedFeatures};
 if(!fit)return {...common,status:'unidentified',coefficients:null,rows};
 const [m00,m01,m11,d0,d1,cross,g]=fit.coefficients,received=predictViscousRows(rows,fit.coefficients);
 let inertia=null,damping=null,refusal=null;
 try{inertia=readSymmetricInertia([m00,m11],m01);damping=readSymmetricDamping(d0,d1,cross);requireThat(Number.isFinite(g),'Skew velocity coefficient must be finite.');}catch(error){refusal=error.message;}
 return {...common,status:refusal?'outside_supported_family':'candidate',coefficients:[...fit.coefficients],conditionEstimate:fit.conditionEstimate,
  meanTorqueBalanceRmse:summarizeViscousRows(received).rmseNm,rows:received,refusal,
  inertia:inertia?{matrix:inertia.matrix,minimumEigenvalue:inertia.minimumEigenvalue,conditionInfinity:inertia.conditionInfinity}:null,damping,
  skew:{coefficient:g,matrix:[[0,g],[-g,0]],quadraticPower:'identically_zero_for_real_velocity'},
  candidateParameters:refusal?null:{inertia:[m00,m11],inertiaCross:m01,damping:[d0,d1],dampingCross:cross,velocitySkew:g}};
}
function receive(rows,fit,tolerance){
 if(fit.status!=='candidate')return {status:'unsupported_training',rows:[],reason:fit.status,rmseNm:null,outside:null};
 const coefficients=[...fit.coefficients];while(coefficients.length<7)coefficients.push(0);
 const predicted=predictViscousRows(rows,coefficients,tolerance),outside=predicted.filter(r=>!r.withinDeclaredTolerance).length;
 return {status:outside?'exceeds_declared_tolerance':'within_declared_tolerance',...summarizeViscousRows(predicted),outside,rows:predicted};
}
/** Reserve the complete weak work before fitting. All training fits are frozen
 * before any held-source equations are evaluated; every family is retained.
 */
export function compareVelocityStudy(input){
 const study=readVelocityStudy(input),vstudy=viscousStudy(study);
 const tp=prepareInertiaWeakComparison(viscousLegacyRecord(vstudy.training.record),study.training.settings);
 const cp=study.challenge?prepareInertiaWeakComparison(viscousLegacyRecord(vstudy.challenge.record),study.challenge.settings):null;
 const reservedSegments=3*tp.reservedSegments+(cp?.reservedSegments??0);
 requireThat(reservedSegments<=MAX_QUADRATURE_SEGMENTS,'The complete three-family and separate-source comparison exceeds '+MAX_QUADRATURE_SEGMENTS+' quadrature segments. Increase the stride or shorten the sources.','work_limit');
 const baseline=compareViscousStudy({...vstudy,challenge:null});
 const primary=fitSkew(tp.primaryPlan),alternate=tp.alternatePlan?fitSkew(tp.alternatePlan):null;
 const skew={primary,samplingComparison:{alternate,absoluteCoefficientDifferences:primary.coefficients&&alternate?.coefficients?primary.coefficients.map((x,i)=>Math.abs(x-alternate.coefficients[i])):null}};
 let challenge=null;
 if(cp){
  const score=plan=>{const rows=skewRows(plan).rows,t=study.challenge.settings.toleranceNm;return {diagonal:receive(rows,baseline.diagonal.primary,t),symmetric:receive(rows,baseline.symmetric.primary,t),skew:receive(rows,primary,t)};};
  challenge={...score(cp.primaryPlan),samplingComparison:cp.alternatePlan?score(cp.alternatePlan):null};
 }
 return {schema:'worldlaw.coupled-velocity-comparison/v1',study,diagonal:baseline.diagonal,symmetric:baseline.symmetric,skew,challenge,
  diagnostics:{reservedSegments,segmentBudget:MAX_QUADRATURE_SEGMENTS,challengeFitted:false,automaticallySelectedFamily:null,physicalValidity:'not_established',
   equations:['M q″ + diag(D) q′ = supplied torque','M q″ + D q′ = supplied torque','M q″ + (D + G) q′ = supplied torque; G = [[0,g],[-g,0]]'],
   limitations:['M is constant symmetric positive definite; D is symmetric positive semidefinite. Only the third family admits the constant skew term G.',
    'vᵀGv = 0 is an algebraic identity. A fitted skew coefficient does not establish a physical gyroscope, passivity or a causal mechanism.',
    'Numerical full rank and admissible matrices do not establish identification. Interpolation of one circular motion can create misleading rank and a wrong admissible candidate.',
    'Original/coarser-source agreement is a diagnostic, not an error bound; a wrong candidate can remain wrong at both samplings.',
    'Separate-source receiving holds all training fits fixed and uses observed angles. It is not a future-motion forecast or authenticated independent evidence.',
    'Optional motion and release comparisons require explicit source correspondence and a separate motion declaration. This fit does not automatically select or adopt any velocity family.']}};
}
