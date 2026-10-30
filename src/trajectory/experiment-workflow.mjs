/** Preserve the existing virtual workflow while dispatching explicit recorded notebooks. */
import * as virtualController from './experiment-session.mjs';
import * as recorded from './recorded-experiment-session.mjs';
import {withNumericalScreen} from '../experiment-design/screened-controller.mjs';
import {createChallenge} from './session.mjs';
import {MAX_TEXT_LENGTH,TrajectoryDataError} from './data.mjs';

const virtual=withNumericalScreen(virtualController);
export const createExperimentSession=virtual.createExperimentSession;
export const planNextExperiment=virtual.planNextExperiment;
export const acquireNextExperiment=virtual.acquireNextExperiment;
export const applyNextExperiment=virtual.applyNextExperiment;
export const isRecordedExperiment=session=>recorded.isRecordedExperiment(session);

export function exportExperimentSession(session){
  return isRecordedExperiment(session)?recorded.exportRecordedExperiment(session):virtual.exportExperimentSession(session);
}
export function restoreExperimentSession(text){
  if(typeof text!=='string'||text.length>MAX_TEXT_LENGTH)throw new TrajectoryDataError('Notebook files must be JSON smaller than 3 MB.');
  let raw;
  try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{return virtual.restoreExperimentSession(text);}
  return raw?.schema===recorded.RECORDED_EXPERIMENT_SCHEMA?recorded.restoreRecordedExperiment(text):virtual.restoreExperimentSession(text);
}
export function experimentView(session){
  return isRecordedExperiment(session)?recorded.recordedExperimentView(session):virtual.experimentView(session);
}
export function beginRecordedExperiment(session){
  if(isRecordedExperiment(session))return session;
  if(virtual.experimentView(session).acquisition)throw new TrajectoryDataError('Apply the pending virtual recording before starting a recorded experiment. Its source and history remain intact.','pending_acquisition');
  return recorded.createRecordedExperiment(virtual.exportExperimentSession(session));
}
export function recordedWorkflowView(session){
  if(isRecordedExperiment(session)){
    const view=recorded.recordedExperimentView(session);
    const settings=view.settings??{
      inertia:session.current.bundle.trainingRuns[0].inertia,command:0,
      bounds:{initialPosition:{min:-2.2,max:2.2},initialRate:{min:-0.6,max:0.6}},
      duration:8,sampleInterval:0.04,positionCount:9,rateCount:3,
      maxModels:8,maxStep:0.01,maxTotalSteps:250000,minDisagreement:0.01
    };
    return {...view,settings,started:true};
  }
  const current=session?.current;
  const known=current?.bundle?.schema==='worldlaw.trajectory-bundle/v1'&&current?.discovery?.schema==='worldlaw.discovery/v1';
  const supported=known&&!current.options.commandPositionInteraction&&!current.options.directionalQuadraticLoss&&!current.options.compareCoulombContact;
  const pending=!!(session&&virtual.experimentView(session).acquisition);
  const full=(current?.bundle?.trainingRuns?.length??0)>=4;
  return {started:false,available:supported&&!pending&&!full,
    unavailableReason:!known?'Recorded experiments require a supported torque model and explicitly known inertia. Angular recordings with unknown inertia retain their existing workflow.':!supported?'This recorded planner does not yet support the selected extended model family. The current challenge remains available.':pending?'A virtual recording is pending. Apply it before starting a recorded experiment; its original history will be preserved.':full?'Four training recordings are already retained. This workflow cannot add another within the maintained interactive limit.':undefined,
    notice:'Start from these retained runs, propose a release, then bring a separate recording. Original virtual history remains in the portable notebook.'};
}
export function refitExperimentWorkflow(session,options){
  return isRecordedExperiment(session)?recorded.refitRecordedExperiment(session,options):virtual.createExperimentSession(createChallenge(session.current.bundle,options));
}
export const planRecordedExperiment=(...args)=>recorded.planRecordedExperiment(...args);
export const receiveRecordedOutcome=(...args)=>recorded.receiveRecordedOutcome(...args);
export const applyRecordedOutcome=(...args)=>recorded.applyRecordedOutcome(...args);
export const discardRecordedOutcome=(...args)=>recorded.discardRecordedOutcome(...args);
export const exportRecordedRequest=(...args)=>recorded.exportRecordedRequest(...args);
