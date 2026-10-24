import {exportNotebook} from './paired-history.mjs';
import {recoveryFixture,recoveryRecording} from './recovery-fixture.mjs';
import {validateRecovery} from './recovery-response.mjs';
import {receiveRecoveryAcquisition,planRecoveryAcquisition} from './recovery-planner.mjs';
export function recoveryPlanningExample(kind='decay'){
 const n=recoveryFixture(kind);
 return validateRecovery({...n,tauSeconds:[1,2,4],training:[recoveryRecording(kind,1,0,{noiseSigma:.03}),recoveryRecording(kind,2,.1,{noiseSigma:.03})],challenges:[]});
}
export function executeRecoveryCourse(current,plan,kind,settings=plan?.settings){
 const n=validateRecovery(current),baseline=recoveryPlanningExample(kind);
 if(n.source!=='synthetic'||n.protocolId!==baseline.protocolId||n.protocolNote!==baseline.protocolNote||JSON.stringify(n.training)!==JSON.stringify(baseline.training))throw new Error('Virtual execution requires the exact authored recovery-course training. Imported or changed evidence has no connected instrument.');
 let last=2;
 for(const run of n.challenges){
  const match=/^virtual-recovery-(\d+)$/.exec(run.recordingId),index=match?Number(match[1]):NaN;
  if(!Number.isInteger(index)||index<3)throw new Error('This imported challenge has no recognized virtual acquisition lineage.');
  const expected=recoveryRecording(kind,index,run.delaySeconds,{count:run.evidence.trials.length/2,noiseSigma:run.evidence.noiseSigma});
  if(expected.recordingId!==run.recordingId||expected.protocolId!==run.protocolId||expected.delaySeconds!==run.delaySeconds||exportNotebook(expected.evidence)!==exportNotebook(run.evidence))throw new Error('Virtual challenge bytes no longer reproduce; use supplied evidence instead.');
  last=Math.max(last,index);
 }
 if(!plan?.selected)throw new Error('Select an informative recovery delay before acquisition.');
 if(JSON.stringify(planRecoveryAcquisition(n,settings))!==JSON.stringify(plan))throw new Error('The recovery plan is stale or modified; recompute before virtual acquisition.');
 const acquired=recoveryRecording(kind,last+1,plan.selected.delaySeconds,{count:plan.settings.pairs,noiseSigma:.03});
 return receiveRecoveryAcquisition(n,plan,acquired,settings);
}
