import {parentPort,workerData} from 'node:worker_threads';
import {discoverTrajectoryEvolution,designTrajectoryExcitation} from './trajectory-operator-synthesis.mjs';
import {designContinuousTrajectoryExcitation} from './trajectory-continuous-excitation.mjs';
try {
  const result=discoverTrajectoryEvolution(workerData.training,workerData.selection,workerData.options||{});
  if(workerData.plans)result.experiment=designTrajectoryExcitation(result,workerData.plans);
  if(workerData.continuousPlan)result.experiment=designContinuousTrajectoryExcitation(result,workerData.continuousPlan);
  parentPort.postMessage({ok:true,result});
} catch(error) {
  parentPort.postMessage({ok:false,error:error instanceof RangeError?error.message:'Trajectory fitting failed.'});
}
