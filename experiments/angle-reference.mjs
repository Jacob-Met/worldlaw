/** Fixed-grid exploratory test; never chooses settings from challenge outcomes. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gravityRun} from './integral-discovery-92be.mjs';
import {investigateAngleReference} from '../src/representation/angle-reference.mjs';
const offsets=Array.from({length:21},(_,i)=>(i-10)/20);
const angular=(r,offset)=>({id:r.id,label:r.label,kind:'synthetic',inertia:null,dynamics:'unforced_scalar_rotation',initialRate:r.initialRate,
  source:{...r.source,recordingId:r.id},samples:r.samples.map(s=>({time:s.time,position:s.position+offset}))});
const summarize=r=>({status:r.search.status,selectedOffset:r.search.selected.offset,competitive:r.search.competitiveOffsets,
  model:r.search.selected.model.id,trainingMismatch:r.search.selected.fitDiagnostics.trainingRmseInNoiseUnits,
  scoreImprovement:r.search.scoreImprovement,challenge:r.comparisons.map(p=>({runId:p.runId,
    baselineRMSE:p.baseline.rollout?.metrics.positionRMSE??null,selectedRMSE:p.selected.rollout?.metrics.positionRMSE??null,
    baselineFinalError:p.baseline.rollout?.metrics.finalAbsError??null,selectedFinalError:p.selected.rollout?.metrics.finalAbsError??null,
    numericalMaxDifference:p.selected.resolution?.maxAbsPositionDifference??null,
    baselineFailure:p.baseline.error??null,selectedFailure:p.selected.error??null}))});
const synthetic=[];
for(const offset of [0,.075,.3])for(const amplitude of [.2,1.5])for(const sigma of [0,.002]){
  const run=(id,position,seed)=>angular(gravityRun({id,position,rate:.2,duration:6,dt:.02,sigma,seed}),offset);
  const bundle={schema:'worldlaw.angular-bundle/v1',label:'Fixed-grid exploratory reference test',units:{time:'s',position:'rad',initialRate:'rad/s'},
    trainingRuns:[run('training-a',amplitude,17),run('training-b',-amplitude,117)],challengeRuns:[run('separate-challenge',2.1,217)]};
  synthetic.push({offset,amplitude,sigma,...summarize(investigateAngleReference(bundle,{offsets,fit:{noiseSigma:Math.max(.00001,sigma)}}))});
}
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url));
const physical={sourceSHA256:createHash('sha256').update(bytes).digest('hex'),settings:{offsets,fit:{noiseSigma:.01}},
  ...summarize(investigateAngleReference(JSON.parse(bytes),{offsets,fit:{noiseSigma:.01}}))};
console.log(JSON.stringify({method:'training-only declared grid; selected and zero-offset frozen before separate-run prediction',synthetic,physical,
  limits:['Synthetic reference shifts are authored; no actual sensor calibration performed.','PASCO challenge was already used in prior method development; this is exploratory receiving, not blind validation.','The declared grid is deliberately too coarse to contain offset .075; retained failure tests discretization and excitation.']},null,2));
