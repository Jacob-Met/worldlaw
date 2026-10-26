import {VELOCITY_RECORD_SCHEMA,VELOCITY_STUDY_SCHEMA,VELOCITY_INTERPRETATION} from '../../src/coupling/velocity-comparison.mjs';

export function independentVelocityStudy({M=[[2.6,-.37],[-.37,1.4]],D=[[.55,-.18],[-.18,.8]],g=-.42}={}){
const course=(id,w,reverse)=>({id,rows:Array.from({length:601},(_,i)=>{
 const t=i*.025+.0017*Math.sin(i*.73),sgn=reverse?-1:1;
 const q=[Math.cos(w*t)+.23*Math.sin(1.31*w*t),sgn*Math.sin(.83*w*t)+.17*Math.cos(1.73*w*t)];
 const v=[-w*Math.sin(w*t)+.23*1.31*w*Math.cos(1.31*w*t),sgn*.83*w*Math.cos(.83*w*t)-.17*1.73*w*Math.sin(1.73*w*t)];
 const a=[-w*w*Math.cos(w*t)-.23*(1.31*w)**2*Math.sin(1.31*w*t),-sgn*(.83*w)**2*Math.sin(.83*w*t)-.17*(1.73*w)**2*Math.cos(1.73*w*t)];
 const torque=[M[0][0]*a[0]+M[0][1]*a[1]+D[0][0]*v[0]+(D[0][1]+g)*v[1],M[1][0]*a[0]+M[1][1]*a[1]+(D[1][0]-g)*v[0]+D[1][1]*v[1]];
 return {time:t,position:q,torque};
})});
const record=(id,courses)=>({schema:VELOCITY_RECORD_SCHEMA,interpretation:VELOCITY_INTERPRETATION,units:{time:'s',position:'rad',torque:'N·m'},torqueDeclaration:'Independent authored torque M a +(D+G)v, excludes all modeled velocity terms.',source:{kind:'synthetic',label:id,description:'Analytic coupled inertia and mixed-frequency motions; no fitted kernel generated these samples.'},courses});
const study={schema:VELOCITY_STUDY_SCHEMA,training:{record:record('independent training',[course('train-a',.71,false),course('train-b',1.19,true)]),settings:{windowSamples:81,stride:40}},challenge:{record:record('independent held',[course('held-reversed',.97,true)]),settings:{windowSamples:81,stride:40,toleranceNm:[.002,.002],correspondence:'New reversed mixed-frequency course under same explicitly authored M,D,G.'}}};
return study;
}
