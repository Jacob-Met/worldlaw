import {compareStudioDynamics} from './studio-dynamics-comparison.mjs';
import {localMotionResponse} from './local-motion-response.mjs';

const interpretation='Local floating-point response at each law’s own executed states on the shared output grid. Frozen modes are not finite-time growth, nonlinear stability, physical truth, calibrated uncertainty or a between-sample enclosure.';
function freeze(value) {
  if(value && typeof value==='object' && !Object.isFrozen(value)) {
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}
const errorRecord=error=>({code:error?.code||'local_response_refused',message:error?.message||String(error)});

/** Own the original ordered models before either maintained calculation runs.
 * IDs are labels, never keys for joining laws to trajectories.
 */
export function compareLocalMotion(discovery,initial,settings={},policy={}) {
  const models=structuredClone(Array.isArray(discovery?.competitive)?discovery.competitive:[]);
  const declarations=structuredClone(settings),start=structuredClone(initial);
  const motion=compareStudioDynamics({competitive:models},start,declarations,structuredClone(policy));
  const responseCounts={computedLaws:0,refusedLaws:0,available:0,nonsmooth:0,unresolvedNumeric:0,stationaryEquation:0,executedStates:0};
  const results=motion.results.map(outcome=>{
    const model=models[outcome.index];
    const row={index:outcome.index,id:outcome.id,equation:outcome.equation,model,executionStatus:outcome.status,response:null};
    if(outcome.status!=='completed') {
      row.response={status:'refused',error:{...outcome.error},reason:'No complete executed trajectory for this original law.'};
      responseCounts.refusedLaws++;return row;
    }
    responseCounts.executedStates+=outcome.trajectory.length;
    try {
      const course=localMotionResponse(model,outcome.trajectory,{
        inertia:declarations.inertia===undefined?1:declarations.inertia,
        command:declarations.command===undefined?0:declarations.command,
      });
      row.response={status:'computed',course};responseCounts.computedLaws++;
      for(const key of ['available','nonsmooth','unresolvedNumeric','stationaryEquation'])responseCounts[key]+=course.counts[key];
    } catch(error) {row.response={status:'refused',error:errorRecord(error)};responseCounts.refusedLaws++;}
    return row;
  });
  const status=motion.status==='completed' && responseCounts.computedLaws===models.length?'completed'
    : responseCounts.computedLaws>0?'incomplete':'refused';
  return freeze({schema:'worldlaw.local-motion-comparison/v1',status,candidateCount:models.length,
    motion,results,responseCounts,interpretation});
}

/** Select exactly one returned sample. Refused laws remain in the population. */
export function sampleLocalMotionComparison(report,index) {
  if(report?.schema!=='worldlaw.local-motion-comparison/v1' || !Number.isSafeInteger(index) || index<0)
    throw new Error('An exact nonnegative integer shared sample index is required.');
  const executed=report.motion.results.filter(row=>row.status==='completed');
  if(!executed.length)throw new Error('No executed shared sample is available; inspect the full refusal report.');
  if(executed.some(row=>index>=row.trajectory.length))throw new Error('Sample index is outside the executed shared grid.');
  const time=executed[0].trajectory[index].time;
  if(executed.some(row=>row.trajectory[index].time!==time))throw new Error('Executed trajectories do not share this exact sample time.');
  const results=report.results.map(row=>({index:row.index,id:row.id,equation:row.equation,model:row.model,
    executionStatus:row.executionStatus,
    state:row.executionStatus==='completed'?report.motion.results[row.index].trajectory[index]:null,
    response:row.response.status==='computed'?{status:'computed',source:row.response.course.source,row:row.response.course.rows[index]}:row.response}));
  return freeze({schema:'worldlaw.local-motion-comparison-sample/v1',status:report.status,
    candidateCount:report.candidateCount,sampleIndex:index,time,
    execution:{status:report.motion.status,initial:report.motion.initial,
      settings:{...report.motion.settings,inertia:report.motion.settings.inertia===undefined?1:report.motion.settings.inertia,command:report.motion.settings.command===undefined?0:report.motion.settings.command},
      work:report.motion.work,candidateCount:report.motion.candidateCount,completedCount:report.motion.completedCount,refusedCount:report.motion.refusedCount},
    results,responseCounts:report.responseCounts,interpretation});
}
