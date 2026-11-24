import {parentPort,workerData} from 'node:worker_threads';
import {discoverTrajectoryEvolution,designTrajectoryExcitation} from './trajectory-operator-synthesis.mjs';
try {
  const result=discoverTrajectoryEvolution(workerData.training,workerData.selection,workerData.options||{});
  if(workerData.plans)result.experiment=designTrajectoryExcitation(result,workerData.plans);
  parentPort.postMessage({ok:true,result});
} catch(error) {
  parentPort.postMessage({ok:false,error:error instanceof RangeError?error.message:'Trajectory fitting failed.'});
}
