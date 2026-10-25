import {requireThat} from './science.mjs';
import {readInertiaRecord} from './inertia-record.mjs';

export const MAX_QUADRATURE_SEGMENTS=100000;
const nodes=[-Math.sqrt(3/5),0,Math.sqrt(3/5)],weights=[5/9,8/9,5/9];

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
export function equationsFor(plan){
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
export function prepareInertiaWeakComparison(input,{windowSamples=81,stride=40}={}){
 const record=readInertiaRecord(input),primaryPlan=prepare(record.courses,windowSamples,stride);
 const coarser=record.courses.map(course=>{
  const originalIndices=course.rows.map((_,i)=>i).filter(i=>i%2===0||i===course.rows.length-1);
  return {...course,rows:originalIndices.map(i=>course.rows[i]),originalIndices};
 });
 const alternateWidth=Math.ceil(windowSamples/2),alternateStride=Math.max(1,Math.floor(stride/2));
 const alternatePlan=alternateWidth>=5?prepare(coarser,alternateWidth,Math.min(alternateStride,alternateWidth-1)):null;
 const reservedSegments=primaryPlan.segments+(alternatePlan?.segments??0);
 requireThat(reservedSegments<=MAX_QUADRATURE_SEGMENTS,'The complete original/coarser source comparison exceeds '+MAX_QUADRATURE_SEGMENTS+' quadrature segments. Increase the stride or shorten the source.','work_limit');
 return {record,settings:{windowSamples,stride},primaryPlan,alternatePlan,reservedSegments};
}
