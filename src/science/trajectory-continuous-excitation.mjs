import {requireState,simulateStateModel} from './state-trajectory.mjs';
import {compileContinuousInput} from './continuous-input.mjs';
import {searchContinuousExcitation} from './continuous-excitation-search.mjs';

/** Plan from fitted alternatives and an observed/declared initial estimate.
 * No reference object, world identity, true initial state or future state is read.
 */
export function designContinuousTrajectoryExcitation(discovery,request) {
  requireState(discovery?.schema==='worldlaw.trajectory-operator-discovery/v1'&&Array.isArray(discovery.frontier),'Require fitted trajectory hypotheses');
  requireState(request&&Object.keys(request).every(k=>['initialEstimate','step','steps','spacing','profile','scales','substeps','maxMagnitude','search'].includes(k)),'Invalid continuous design request');
  const {initialEstimate,step,steps,spacing,profile,substeps=2,maxMagnitude=1e6,search={}}=request;
  requireState(Array.isArray(initialEstimate)&&Array.from(initialEstimate).every(Number.isFinite),'Require a finite initial estimate');
  const n=initialEstimate.length,models=[...new Map(discovery.frontier.map(m=>[JSON.stringify(m),m])).values()].slice(0,4);
  if(models.length<2)return {status:'abstained',reason:'insufficient_comparable_hypotheses',selected:null,consideredModels:models.length};
  const kind=models[0].kind;
  requireState(models.every(m=>m.kind===kind),'Mixed model geometries');
  requireState(kind==='oscillator'?n===2:kind==='periodic'&&n>=6&&n<=128,'Invalid continuous design geometry');
  if(kind==='periodic')requireState(Array.isArray(profile)&&profile.length===n&&Array.from(profile).every(x=>Number.isFinite(x)&&Math.abs(x)<=4)&&profile.some(x=>x!==0),'Invalid continuous actuator profile');
  requireState(Number.isFinite(step)&&step>0&&Number.isInteger(steps)&&steps>=32&&steps<=4096,'Invalid continuous design grid');
  requireState(Number.isInteger(substeps)&&substeps>=1&&substeps<=16,'Invalid design refinement');
  const maxEvaluations=search.maxEvaluations??37;
  requireState(Number.isInteger(maxEvaluations)&&maxEvaluations>=1&&maxEvaluations<=97,'Invalid continuous search budget');
  const terms=models.reduce((sum,m)=>sum+Math.max(1,m.terms?.length??256),0);
  requireState(maxEvaluations*steps*n*substeps*4*terms<=80000000,'Aggregate continuous simulation work budget exceeded');
  const scales=request.scales??Array(n).fill(Math.max(1e-8,discovery.selection?.noiseSigma??1));
  requireState(Array.isArray(scales)&&scales.length===n&&Array.from(scales).every(x=>Number.isFinite(x)&&x>0),'Invalid simulated observation scales');
  const inputFor=waveform=>({schema:'worldlaw.continuous-input/v1',startTime:0,waveform,...(kind==='oscillator'?{}:{profile})});
  const design=searchContinuousExcitation(waveform=>{
    const continuousInput=inputFor(waveform);
    const paths=models.map(model=>simulateStateModel(model,{initialEstimate,step,steps,spacing,continuousInput,substeps,maxMagnitude}));
    if(paths.some(x=>!x))throw new RangeError('Simulated hypothesis leaves the declared state domain');
    let separation=Infinity;
    for(let a=0;a<paths.length;a++)for(let b=0;b<a;b++){
      let squares=0,count=0;
      for(let t=4;t<=steps;t+=4)for(let j=0;j<n;j++){squares+=((paths[a][t][j]-paths[b][t][j])/scales[j])**2;count++;}
      separation=Math.min(separation,squares/count);
    }
    return separation;
  },{...search,duration:step*steps});
  const continuousInput=design.selected?inputFor(design.selected):null;
  const proof=continuousInput?compileContinuousInput(continuousInput,kind,n):null;
  return {...design,consideredModels:models.length,continuousInput,initialEstimate:initialEstimate.slice(),
    observationScales:scales.slice(),scoreStride:4,
    ...(proof?{scalarEnergy:proof.totalEnergy,meanChannelEnergy:proof.totalEnergy*proof.profileMeanSquare,physicalPeakBound:proof.physicalPeakBound}:{}),
    structuralIdentification:false};
}
