/** Independent analytic motion controls; reused PASCO is explicitly exploratory. */
import {readFile} from 'node:fs/promises';
import {createPredictiveChallenge} from '../src/predictive-selection/session.mjs';
function oscillator(id,x,v,frequency,noise,seed){
 let random=seed>>>0;const perturb=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return noise*Math.sqrt(12)*(random/4294967296-.5);};
 const damping=.2,w=Math.sqrt(frequency**2-damping**2/4),b=(v+damping*x/2)/w;
 return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:v,source:{label:'Independent analytic damped oscillator with declared uniform position noise',recordingId:id,noiseSigma:noise,seed},samples:Array.from({length:161},(_,i)=>{const time=i*.05;return {time,position:Math.exp(-damping*time/2)*(x*Math.cos(w*time)+b*Math.sin(w*time))+perturb()};})};
}
const rows=[];
function receive(label,bundle,options){const c=createPredictiveChallenge(bundle,options);const by=id=>c.results.filter(r=>r.modelId===id).map(r=>({run:r.runId,status:r.status,rmse:r.rollout?.metrics.positionRMSE??null,numericalStatus:r.numericalStatus??null}));rows.push({label,evidenceKinds:[...new Set(bundle.trainingRuns.map(r=>r.kind))],selected:c.selection.selectedId,original:c.selection.originalSelectedModel.id,validation:c.selection.results.find(r=>r.id===c.selection.selectedId)?.validationRMSE??null,completedStructures:c.selection.ranking.length,offeredStructures:c.selection.offeredStructureCount,originalChallenge:by(c.selection.originalSelectedModel.id),selectedChallenge:by(c.selection.selectedId)});}
for(const noise of [0,.001,.01])for(const changedPhysics of [false,true]){
 const tag=`noise-${noise}-changed-physics-${changedPhysics}`,bundle={schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[oscillator(tag+'-a',1,.2,2,noise,101),oscillator(tag+'-b',-.6,.1,changedPhysics?2.6:2,noise,303)],challengeRuns:[oscillator(tag+'-challenge',1.4,-.1,changedPhysics?2.3:2,noise,707)]};
 receive(tag,bundle,{terms:['rate','spring','gravity'],maxTerms:2});
}
for(let seed=1;seed<=8;seed++){
 const tag='small-excitation-seed-'+seed,bundle={schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[oscillator(tag+'-a',.1,.02,2,.01,seed),oscillator(tag+'-b',-.07,.01,2,.01,seed+40)],challengeRuns:[oscillator(tag+'-challenge',1.4,-.1,2,.01,seed+80)]};receive(tag,bundle,{terms:['rate','spring','gravity'],maxTerms:2});
}
receive('PASCO reused development recording; not blind validation',JSON.parse(await readFile(new URL('../examples/physical-pasco-92be.json',import.meta.url))),{});
console.log(JSON.stringify({scope:'Finite-library predictive selection; authored analytic controls and previously reused measured evidence; no physical acquisition or unrestricted discovery claim.',rows},null,2));
