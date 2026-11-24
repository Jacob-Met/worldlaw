import {verifyEvolutionRollout} from './operator-rollout.mjs';
import {createResidualCalibration,assessResidual} from '../trajectory/residual-abstention.mjs';

function ensure(ok,message){if(!ok)throw new RangeError(message);}
function scoreGroup(model,group,tolerance){
  let maximum=0;
  for(const {course,observations} of group.records){
    const result=verifyEvolutionRollout(model,course,observations,
      {maxError:Number.MAX_VALUE,resolutionTolerance:tolerance});
    if(!result.accepted) return {id:group.id,score:null,course:course.id,reason:result.reason};
    maximum=Math.max(maximum,result.held.maxError);
  }
  return {id:group.id,score:maximum};
}

/** One preselected model. Each independent acquisition contributes one maximum,
 * even when it contains multiple windows or strongly dependent sensor samples. */
export function assessCalibratedTrajectory(model,calibration,target,{alpha,resolutionTolerance}) {
  ensure(Array.isArray(calibration)&&calibration.length>0&&calibration.length<=255,'Require 1–255 calibration acquisitions');
  ensure(Number.isFinite(resolutionTolerance)&&resolutionTolerance>=0,'Declare finite refinement tolerance');
  const numerator=alpha?.numerator,denominator=alpha?.denominator;
  ensure(Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&
    0<numerator&&numerator<denominator&&denominator<=1000000,'Declare an exact rational risk level');
  const groups=[...calibration,target],ids=new Set(),courses=new Set();
  let cells=0;
  for(const g of groups){
    ensure(g&&typeof g.id==='string'&&g.id.length>0&&g.id.length<=160&&!ids.has(g.id),'Acquisition ids must be unique');
    ids.add(g.id);
    ensure(Array.isArray(g.records)&&g.records.length>=1&&g.records.length<=32,'Declare bounded acquisition records');
    for(const {course} of g.records){
      ensure(course&&typeof course.id==='string'&&course.id.length>0&&!courses.has(course.id),'A measured course must belong to one acquisition');
      courses.add(course.id);
      ensure(Array.isArray(course.initial)&&Number.isSafeInteger(course.steps)&&course.steps>0,'Invalid measured course shape');
      cells+=(course.steps+1)*course.initial.length;
    }
  }
  ensure(courses.size<=512&&cells<=2000000,'Acquisition set exceeds the trajectory budget');
  const size=groups.length, minP={numerator:1,denominator:size};
  if(denominator>numerator*size) return {status:'insufficient_calibration_resolution',minimumP:minP,p:null};
  const scores=[];
  for(const g of calibration){
    const result=scoreGroup(model,g,resolutionTolerance);
    if(result.score===null)return {status:'unresolved_calibration_course',failure:result,p:null};
    scores.push(result);
  }
  const observed=scoreGroup(model,target,resolutionTolerance);
  if(observed.score===null)return {status:'unresolved_target_course',failure:observed,p:null};
  const policyId='symbolic-group-maximum/v1';
  const reference=createResidualCalibration({policyId,alpha:numerator/denominator,maxRounds:1,
    roundScoresByWorld:scores.map(r=>({worldId:'acquisition-'+r.id,scores:[r.score]}))});
  const assessment=assessResidual(reference,{policyId,round:1,worldId:'acquisition-'+observed.id,score:observed.score});
  const rank=1+assessment.atLeast;
  const p={numerator:rank,denominator:size};
  return {status:rank*denominator<=numerator*size?'residual_outlier':'within_calibrated_residual',
    p,minimumP:minP,observed,calibration:scores};
}
