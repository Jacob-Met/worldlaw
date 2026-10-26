/** Authored analytic circular courses; no fit or integration kernel generates input. */
import {VELOCITY_RECORD_SCHEMA,VELOCITY_STUDY_SCHEMA,VELOCITY_INTERPRETATION} from './velocity-comparison.mjs';
export function createVelocityExample(kind='two-frequency'){
 if(!['two-frequency','single-uniform','single-irregular','no-skew','omitted-force'].includes(kind))throw Error('Unknown authored velocity comparison.');
 const g=kind==='no-skew'?0:.3,frequencies=kind.startsWith('single-')?[.8]:[.8,1.7];
 const makeCourse=(w,id)=>{
  let t=0;return {id,rows:Array.from({length:401},(_,i)=>{
   if(i)t+=.05*(kind==='single-uniform'?1:1+.25*Math.sin(i*1.37));
   const q=[Math.cos(w*t),Math.sin(w*t)],v=[-w*q[1],w*q[0]],a=q.map(x=>-w*w*x);
   return {time:t,position:q,torque:[2*a[0]+.4*v[0]+(.1+g)*v[1]+(kind==='omitted-force'?1.2*q[0]**3:0),
    2*a[1]+(.1-g)*v[0]+.6*v[1]]};
  })};
 };
 const record=(frequencies,label)=>({schema:VELOCITY_RECORD_SCHEMA,interpretation:VELOCITY_INTERPRETATION,
  units:{time:'s',position:'rad',torque:'N·m'},torqueDeclaration:'Authored applied torque excludes the three offered velocity terms. Omitted-force control also adds an undeclared cubic term; no physical acquisition.',
  source:{kind:'synthetic',label:'Authored '+kind+' '+label,description:'Analytic circular angles and derivatives generate original torque samples. M=2I, D=[[.4,.1],[.1,.6]], G01='+g+'. Separate frequency 1.3 is never fitted.'},
  courses:frequencies.map((w,i)=>makeCourse(w,label+'-'+i))});
 return {schema:VELOCITY_STUDY_SCHEMA,training:{record:record(frequencies,'training'),settings:{windowSamples:81,stride:40}},
  challenge:{record:record([1.3],'separate motion'),settings:{windowSamples:81,stride:40,toleranceNm:[.002,.002],correspondence:'Separately authored different-frequency circular motion with the same matrices, coordinate convention and torque supply.'}}};
}
