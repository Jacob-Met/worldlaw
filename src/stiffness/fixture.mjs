import {UNITS} from '../data.mjs';
/** Independent authored torque source. It does not call the fitted model evaluator. */
export function stiffnessExample(kind='kink') {
  if(!['kink','linear','smooth','narrow'].includes(kind))throw new Error('Unknown authored example.');
  const torque=(position,command,rate,index)=>{
    const shaped=kind==='linear'?-1.2*position:kind==='smooth'?-1.2*position-0.9*position**3:
      -1.2*position-3.5*Math.max(0,position-0.4);
    return 0.3+0.8*command-0.25*rate+shaped+0.001*Math.sin(index*2.13);
  };
  const collect=(count,lo,hi,offset)=>Array.from({length:count},(_,i)=>lo+(hi-lo)*i/(count-1)).flatMap((position,i)=>
    [[0,0],[0.7,-0.4],[-0.6,0.5],[0.3,0.6]].map(([command,rate],j)=>({
      position,command,rate,jointTorque:torque(position,command,rate,offset+4*i+j)})));
  const observations=collect(29,-1.4,kind==='narrow'?-0.2:1.4,0);
  const heldOut=collect(23,-1.35,1.35,1000);
  return {schema:'worldlaw.observations/v1',
    source:{label:'Authored '+kind+' response — simulated torque values',kind:'synthetic',
      units:{...UNITS},metadata:{basis:'repository-authored deterministic software experiment',
        trueChangeAngle:kind==='kink'||kind==='narrow'?0.4:null,
        limitations:'A controlled numerical source, not an observed physical mechanism.'}},
    observations,heldOut};
}
export function exampleSettings() {
  return {knots:Array.from({length:25},(_,i)=>(i-12)/10),nuisanceTerms:['bias','command','rate'],noiseSigma:0.01,ambiguityDelta:6};
}
