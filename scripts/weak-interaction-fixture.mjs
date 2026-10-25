import {writeFileSync} from 'node:fs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
import {createChallenge,exportChallenge} from '../src/trajectory/session.mjs';
function run(id,initial,phase=0){
 let position=initial,rate=.13; const dt=.005,samples=[];
 for(let i=0;i<=2400;i++){
  const command=Math.floor((i+phase)/100)%2?.7:-.4;
  samples.push({time:i*dt,position,command});
  const w=Math.sqrt(2-.8*command),c=Math.cos(w*dt),s=Math.sin(w*dt);
  [position,rate]=[position*c+rate*s/w,rate*c-position*w*s];
 }
 return {id,label:id,kind:'synthetic',units:RUN_UNITS,source:{label:'independent analytic oscillator'},inertia:1,initialRate:.13,samples};
}

const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,trainingRuns:[run('fit',.8)],challengeRuns:[run('receive',-.6,51)]};
const options={method:'weak',commandPositionInteraction:false,maxTerms:2,noiseSigma:1e-7,windowDuration:.4,windowStride:.2,maxStep:.005,modelLimit:1};
let start=performance.now();const baseline=createChallenge(bundle,options);const improved=createChallenge(bundle,{...options,commandPositionInteraction:true});
writeFileSync(new URL('../examples/weak-interaction-receiving.json',import.meta.url),exportChallenge(baseline));
console.log(JSON.stringify({coefficients:improved.discovery.selected.terms,baselineRMSE:baseline.summary.selectedPositionRMSE,interactionRMSE:improved.summary.selectedPositionRMSE,elapsedMs:performance.now()-start},null,2));
