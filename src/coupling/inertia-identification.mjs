import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {readSymmetricInertia} from './inertia.mjs';
import {requireThat} from './science.mjs';
import {MAX_QUADRATURE_SEGMENTS,prepareInertiaWeakComparison,equationsFor} from './inertia-weak.mjs';

export {MAX_QUADRATURE_SEGMENTS} from './inertia-weak.mjs';
const parameters=Object.freeze(['M00','M01','M11','D0','D1']);

function solve(plan){
 const {equations,roundoffSuppressedFeatures}=equationsFor(plan);
 const columns=parameters.map((_,j)=>equations.map(r=>r.features[j]));
 const rank=linearColumnRank(columns),fit=fitLinearColumns(columns,equations.map(r=>r.observedTorque));
 const common={parameters,rank,equationCount:equations.length,windowCount:plan.windows.length,roundoffSuppressedFeatures};
 if(!fit)return {...common,status:'unidentified',coefficients:null,rows:equations};
 const [m00,m01,m11,d0,d1]=fit.coefficients;
 const rows=equations.map(row=>{const predictedTorque=row.features.reduce((s,x,j)=>s+x*fit.coefficients[j],0);return {...row,predictedTorque,residual:row.observedTorque-predictedTorque};});
 let mass=null,refusal=null;
 try{
  mass=readSymmetricInertia([m00,m11],m01);
  requireThat([d0,d1].every(d=>Number.isFinite(d)&&d>=0&&d<=1e6),'Unconstrained fitted damping lies outside the nonnegative supported family.');
 }catch(error){refusal=error.message;}
 return {...common,status:refusal?'outside_supported_family':'candidate',coefficients:fit.coefficients,
  conditionEstimate:fit.conditionEstimate,meanTorqueBalanceRmse:Math.hypot(...rows.map(r=>r.residual))/Math.sqrt(rows.length),
  rows,refusal,inertia:mass?{matrix:mass.matrix,minimumEigenvalue:mass.minimumEigenvalue,conditionInfinity:mass.conditionInfinity}:null,
  simulationParameters:refusal?null:{inertia:[m00,m11],inertiaCross:m01,damping:[d0,d1]}};
}

export function identifyInertia(input,{windowSamples=81,stride=40}={}){
 const {record,primaryPlan,alternatePlan,reservedSegments}=prepareInertiaWeakComparison(input,{windowSamples,stride});
 const primary=solve(primaryPlan),alternate=alternatePlan?solve(alternatePlan):null;
 const differences=primary.coefficients&&alternate?.coefficients?primary.coefficients.map((x,i)=>Math.abs(x-alternate.coefficients[i])):null;
 return {schema:'worldlaw.coupled-inertia-identification/v1',record,settings:{windowSamples,stride},primary,
  samplingComparison:{method:'every_second_original_row_with_final_endpoint_retained',alternate,absoluteCoefficientDifferences:differences,
   meaning:'A source-sampling sensitivity comparison; not an error bound, confidence interval or independent evidence.'},
  diagnostics:{equation:'M q″ + diag(D) q′ = supplied torque',reservedSegments,segmentBudget:MAX_QUADRATURE_SEGMENTS,
   torqueBalanceUnits:'N·m',physicalValidity:'not_established',rankMeaning:'Numerical rank of the offered five-column weak library, not physical identifiability.',
   limitations:['Constant symmetric inertia and diagonal viscous damping are offered assumptions; other forces and model structures are not searched.',
    'Torque must match the declared right-hand side; source labels, units and calibration are not authenticated.',
    'Overlapping weak windows are correlated. Small weak residuals do not establish independent trajectory prediction or physical accuracy.',
    'Exact quadrature for linear interpolants does not remove observation noise or interpolation bias.',
    'An inadmissible unconstrained estimate does not prove the entire physical family impossible.']}};
}
