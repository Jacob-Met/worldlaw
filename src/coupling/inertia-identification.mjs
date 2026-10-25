import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {readSymmetricInertia} from './inertia.mjs';
import {requireThat} from './science.mjs';
import {readInertiaRecord} from './inertia-record.mjs';

export const MAX_QUADRATURE_SEGMENTS=100000;
const nodes=[-Math.sqrt(3/5),0,Math.sqrt(3/5)],weights=[5/9,8/9,5/9];
const parameters=Object.freeze(['M00','M01','M11','D0','D1']);

function windowStarts(n,width,stride){
 const starts=[];
 for(let first=0;first+width<=n;first+=stride)starts.push(first);
 if(starts.at(-1)!==n-width)starts.push(n-width);
 return starts;
}
function prepare(courses,width,stride){
 requireThat(Number.isInteger(width)&&width>=5&&width<=401,'Use 5–401 source rows per weak window.');
 requireThat(Number.isInteger(stride)&&stride>=1&&stride<width,'Window stride must be a positive integer smaller than its width.');
 const windows=courses.flatMap(course=>{
  requireThat(course.rows.length>=width,'Course '+course.id+' has fewer source rows than the declared window.');
  return windowStarts(course.rows.length,width,stride).map(first=>({course,first,last:first+width-1}));
 });
 return {windows,segments:windows.length*(width-1)};
}

// Endpoint-vanishing test function. Three Gauss nodes exactly integrate the
// represented linear interpolants against these degree <=4 polynomials.
function equationsFor(plan){
 const equations=[];let roundoffSuppressedFeatures=0;
 for(const {course,first,last} of plan.windows){
  const rows=course.rows,t0=rows[first].time,T=rows[last].time-t0,I=T/30;
  requireThat(T>=1e-8,'A weak window must span at least 1e-8 seconds.');
  const q0=rows[first].position,dq=q0.map((q,j)=>rows[last].position[j]-q);
  const maximum=[0,1].map(j=>Math.max(...rows.slice(first,last+1).map(r=>Math.abs(r.position[j]))));
  const acceleration=[0,0],velocity=dq.map(q=>q/T),force=[0,0];
  for(let i=first;i<last;i++){
   const a=rows[i],b=rows[i+1],half=(b.time-a.time)/2;
   // Work in window-relative time, preserving the original clock differences.
   const begin=a.time-t0,end=b.time-t0,mid=(begin+end)/2;
   for(let k=0;k<3;k++){
    const relative=mid+half*nodes[k],u=relative/T,f=(relative-begin)/(end-begin),weight=half*weights[k]/I;
    const phi=u*u*(1-u)*(1-u),dphi=(2*u-6*u*u+4*u*u*u)/T,ddphi=(2-12*u+12*u*u)/(T*T);
    for(let axis=0;axis<2;axis++){
     // The removed affine trend has identically zero weak acceleration and
     // known mean velocity. This avoids subtracting large linear balances.
     const qa=(a.position[axis]-q0[axis])-dq[axis]*(begin/T);
     const qb=(b.position[axis]-q0[axis])-dq[axis]*(end/T);
     const residualPosition=qa*(1-f)+qb*f;
     acceleration[axis]+=weight*residualPosition*ddphi;
     velocity[axis]-=weight*residualPosition*dphi;
     force[axis]+=weight*(a.torque[axis]*(1-f)+b.torque[axis]*f)*phi;
    }
   }
  }
  for(let axis=0;axis<2;axis++){
   const scale=maximum[axis]+Math.abs(dq[axis]);
   const accelerationFloor=128*Number.EPSILON*scale/(T*T);
   const velocityFloor=64*Number.EPSILON*scale/T;
   if(Math.abs(acceleration[axis])<=accelerationFloor){acceleration[axis]=0;roundoffSuppressedFeatures++;}
   if(Math.abs(velocity[axis])<=velocityFloor){velocity[axis]=0;roundoffSuppressedFeatures++;}
  }
  requireThat([...acceleration,...velocity,...force].every(Number.isFinite),'Weak balance arithmetic became nonfinite.');
  const common={courseId:course.id,firstRow:course.originalIndices?.[first]??first,lastRow:course.originalIndices?.[last]??last,start:t0,end:rows[last].time};
  equations.push({...common,axis:0,features:[acceleration[0],acceleration[1],0,velocity[0],0],observedTorque:force[0]});
  equations.push({...common,axis:1,features:[0,acceleration[0],acceleration[1],0,velocity[1]],observedTorque:force[1]});
 }
 return {equations,roundoffSuppressedFeatures};
}
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
 const record=readInertiaRecord(input),primaryPlan=prepare(record.courses,windowSamples,stride);
 const coarser=record.courses.map(course=>{
  const originalIndices=course.rows.map((_,i)=>i).filter(i=>i%2===0||i===course.rows.length-1);
  return {...course,rows:originalIndices.map(i=>course.rows[i]),originalIndices};
 });
 const alternateWidth=Math.ceil(windowSamples/2),alternateStride=Math.max(1,Math.floor(stride/2));
 const alternatePlan=alternateWidth>=5?prepare(coarser,alternateWidth,Math.min(alternateStride,alternateWidth-1)):null;
 const reservedSegments=primaryPlan.segments+(alternatePlan?.segments??0);
 requireThat(reservedSegments<=MAX_QUADRATURE_SEGMENTS,'The complete original/coarser source comparison exceeds '+MAX_QUADRATURE_SEGMENTS+' quadrature segments. Increase the stride or shorten the source.','work_limit');
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
