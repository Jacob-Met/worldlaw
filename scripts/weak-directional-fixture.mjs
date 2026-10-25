import {writeFileSync} from 'node:fs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
import {createChallenge,exportChallenge} from '../src/trajectory/session.mjs';
function course(id,initialRate,dt=.005){
 const k=initialRate>0?.37:-.13;
 return {id,label:id,kind:'synthetic',source:{label:'analytic directional quadratic decay'},units:RUN_UNITS,inertia:1,initialRate,
  samples:Array.from({length:Math.round(6/dt)+1},(_,i)=>{const time=i*dt;return {time,position:.1+Math.log1p(k*initialRate*time)/k,command:0};})};
}

const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,trainingRuns:[course('fit-positive',1.8),course('fit-negative',-2.1)],challengeRuns:[course('receive-negative',-1.3)]};
const options={method:'weak',directionalQuadraticLoss:false,maxTerms:2,noiseSigma:1e-8,windowDuration:.3,windowStride:.15,maxStep:.005,modelLimit:1};
const baseline=createChallenge(bundle,options),expanded=createChallenge(bundle,{...options,directionalQuadraticLoss:true});
writeFileSync(new URL('../examples/weak-directional-receiving.json',import.meta.url),exportChallenge(baseline));
console.log(JSON.stringify({coefficients:expanded.discovery.selected.terms,baselineRMSE:baseline.summary.selectedPositionRMSE,directionalRMSE:expanded.summary.selectedPositionRMSE},null,2));
