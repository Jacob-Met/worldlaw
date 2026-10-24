import {createStiffnessStudy} from './notebook.mjs';
import {createStiffnessExperiment} from './experiment.mjs';
export function observeStiffnessCourse(kind,state){
 if(!['kink','smooth'].includes(kind)||state.command!==0||state.rate!==0||
  typeof state.position!=='number'||!Number.isFinite(state.position)||Math.abs(state.position)>1)
  throw new Error('This authored instrument accepts zero command/rate and angles within ±1 radian.');
 const x=state.position;
 return kind==='kink'?.3-1.2*x-1.6*Math.max(0,x-.2):.3-1.2*x-3*x*x*x;
}
export function stiffnessExperimentCourse(kind='kink'){
 const positions=kind==='kink'?[-.8,-.7,-.6,-.5,.5,.6,.7,.8]:
  [-.8,-.64,-.48,-.32,-.16,0,.16,.32,.48,.64,.8];
 const observations=positions.map((position,index)=>{
  const state={command:0,position,rate:0};
  return {...state,jointTorque:observeStiffnessCourse(kind,state)+.008*Math.sin(2.3*index)};
 });
 const heldOut=Array.from({length:41},(_,i)=>{
  const state={command:0,position:-1+i/20,rate:0};
  return {...state,jointTorque:observeStiffnessCourse(kind,state)};
 });
 const dataset={source:{label:kind==='kink'?'Authored ambiguous stiffness course':'Authored omitted cubic course',
  kind:'synthetic',metadata:{instrument:'explicit analytic generator',independence:'Authored example; not physical or blind qualification'}},
  observations,heldOut};
 const settings={knots:[-.2,0,.1,.2,.3,.4],nuisanceTerms:['bias'],noiseSigma:.02,ambiguityDelta:6};
 const permitted=[-1,-.4,0,.1,.2,.3,.4,1].map(position=>({command:0,position,rate:0}));
 return createStiffnessExperiment(createStiffnessStudy(dataset,settings),permitted);
}

