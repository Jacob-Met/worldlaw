import {createStiffnessStudy} from './notebook.mjs';
import {createStiffnessExperiment} from './experiment.mjs';
export function observeStiffnessCourse(kind,state){
 if(kind==='confounded'){
  if(!['command','position','rate'].every(axis=>typeof state[axis]==='number'&&Number.isFinite(state[axis]))||state.rate!==0||Math.abs(state.command)>2||Math.abs(state.position)>1)
   throw new Error('This authored confounded instrument accepts command within ±2 N·m, angle within ±1 radian and zero rate.');
  return .2+1.2*state.command-3*state.position;
 }
 if(!['kink','smooth','higher'].includes(kind)||state.command!==0||state.rate!==0||
  typeof state.position!=='number'||!Number.isFinite(state.position)||Math.abs(state.position)>1)
  throw new Error('This authored instrument accepts zero command/rate and angles within ±1 radian.');
 const x=state.position;
 return kind==='kink'?.3-1.2*x-1.6*Math.max(0,x-.2):kind==='smooth'?.3-1.2*x-3*x*x*x:.3-1.2*x-8*x**5;
}
export function stiffnessExperimentCourse(kind='kink'){
 if(kind==='confounded'){
  const observations=Array.from({length:17},(_,i)=>{const position=(i-8)/10,state={command:2*position,position,rate:0};return {...state,jointTorque:observeStiffnessCourse(kind,state)};});
  const heldOut=Array.from({length:9},(_,i)=>{const state={command:i%2?.6:-.6,position:(i-4)/5,rate:0};return {...state,jointTorque:observeStiffnessCourse(kind,state)};});
  const dataset={source:{label:'Authored confounded command/angle course',kind:'synthetic',metadata:{instrument:'explicit analytic generator',inputRelation:'Initial command equals twice position',independence:'Authored example; not physical or blind qualification'}},observations,heldOut};
  const settings={knots:[-.3,0,.3],nuisanceTerms:['bias','command'],noiseSigma:.01,ambiguityDelta:6};
  const permitted=[{command:1,position:.5,rate:0},{command:1,position:0,rate:0}];
  return createStiffnessExperiment(createStiffnessStudy(dataset,settings),permitted);
 }

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
 const dataset={source:{label:kind==='kink'?'Authored ambiguous stiffness course':kind==='smooth'?'Authored omitted cubic course':'Authored omitted fifth-order course',
  kind:'synthetic',metadata:{instrument:'explicit analytic generator',independence:'Authored example; not physical or blind qualification'}},
  observations,heldOut};
 const settings={knots:[-.2,0,.1,.2,.3,.4],nuisanceTerms:['bias'],noiseSigma:.02,ambiguityDelta:6};
 const permitted=[-1,-.4,0,.1,.2,.3,.4,1].map(position=>({command:0,position,rate:0}));
 return createStiffnessExperiment(createStiffnessStudy(dataset,settings),permitted);
}

