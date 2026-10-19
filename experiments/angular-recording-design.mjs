/** Training-only recording design receipts; no subsequent observation is acquired. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {discoverAngular} from '../src/trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {createAngularTrajectoryPlanner} from '../src/experiment-design/angular-planner.mjs';
import {planTrajectoryExperiment} from '../tests/support/trajectory-planner-baseline.mjs';

const planner = createAngularTrajectoryPlanner(planTrajectoryExperiment);
const fitOptions = {noiseSigma: .01, maxTerms: 4, ambiguityDelta: 6, rateWindowSize: 9};
function readTraining(name) {
  const bytes = readFileSync(new URL(`../examples/${name}`, import.meta.url)), bundle = JSON.parse(bytes);
  Object.defineProperty(bundle, 'challengeRuns', {get() {throw new Error('Reserved challenge is not an experiment-design input');}});
  return {bundle, source: {path: `examples/${name}`, sha256: createHash('sha256').update(bytes).digest('hex')}};
}
function summarize(discovery, planned) {
  return {trainingRunIds: discovery.trainingRuns.map(run => run.id), selectedTrainingModel: discovery.selected.id,
    competitiveModelCount: discovery.competitive.length, consideredModelCount: planned.diagnostics.consideredModelCount,
    omittedCompetitiveCount: planned.diagnostics.omittedCompetitiveCount, trainingFit: planned.trainingFit,
    status: planned.status, plannerStatus: planned.plannerStatus,
    selected: planned.selected ? {initialPosition: planned.selected.initialPosition, initialRate: planned.selected.initialRate,
      duration: planned.selected.duration, sampleInterval: planned.selected.sampleInterval,
      disagreementRad: planned.selected.disagreementRad, trainingRangeCheck: planned.selected.trainingRangeCheck} : null,
    qualification: {status: planned.qualification.status, selected: planned.qualification.selectedQualification,
      reservedSteps: planned.qualification.diagnostics.reservedSteps}, recordingRequest: planned.recordingRequest,
    physicalInertia: planned.physicalInertia, absoluteTorqueIdentified: planned.absoluteTorqueIdentified};
}
export function angularRecordingDesignReceipt() {
  const synthetic = readTraining('trajectory-ambiguous-92be.json');
  // Controlled synthetic observations are viewed without exposing their physical
  // torque scale. No position or timestamp is changed and no future is fitted.
  const angularTraining = synthetic.bundle.trainingRuns.map(run => ({id: run.id, label: run.label, kind: 'synthetic',
    inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
    source: {label: 'Declared synthetic small-angle recording, viewed with physical torque scale withheld'},
    samples: run.samples.map(({time, position}) => ({time, position}))}));
  const fittedSynthetic = discoverAngular(angularTraining, fitOptions);
  const syntheticDesign = {inertia: null, dynamics: 'unforced_scalar_rotation',
    bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
    predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}};
  const syntheticPlan = planner(fittedSynthetic, syntheticDesign);
  const measured = readTraining('physical-pasco-92be.json');
  const weakOptions = {...fitOptions, windowDuration: 1, windowStride: .5};
  const fittedMeasured = discoverAngularWeak(measured.bundle.trainingRuns, weakOptions);
  const measuredDesign = {inertia: null, dynamics: 'unforced_scalar_rotation',
    bounds: {initialPosition: {min: -.3, max: .3}, initialRate: {min: -.2, max: .2}},
    duration: 4, sampleInterval: .04, positionCount: 5, rateCount: 3,
    predictionBounds: {position: {min: -.6, max: .6}, rate: {min: -5, max: 5}}};
  const measuredPlan = planner(fittedMeasured, measuredDesign);
  const expandedMeasuredDesign = {...measuredDesign,
    bounds: {initialPosition: {min: -1.2, max: 1.2}, initialRate: {min: -.2, max: .2}},
    predictionBounds: {position: {min: -2, max: 2}, rate: {min: -12, max: 12}}};
  const expandedMeasuredPlan = planner(fittedMeasured, expandedMeasuredDesign);
  return {schema: 'worldlaw.angular-recording-design-receipt/v1',
    basePlanner: {status: 'frozen_unpublished_test_support', originalSha256: '63d5161e39fa592d90f4b06efe8569879cf5b2b66db309d0e9acc65ec0300f10'},
    synthetic: {source: synthetic.source, evidenceKind: 'synthetic_with_torque_scale_withheld', fitOptions, declaredDesign: syntheticDesign,
      ...summarize(fittedSynthetic, syntheticPlan)},
    measured: {source: measured.source, evidenceKind: 'measured_declared_PASCO_recordings', fitOptions: weakOptions, declaredDesign: measuredDesign,
      ...summarize(fittedMeasured, measuredPlan)},
    measuredExpandedHypotheticalGrid: {source: measured.source, evidenceKind: 'same_measured_training_with_unverified_wider_release_bounds',
      fitOptions: weakOptions, declaredDesign: expandedMeasuredDesign, ...summarize(fittedMeasured, expandedMeasuredPlan)},
    scope: 'Manual protocol design only. Both source challenge accessors throw; neither challenge is used. No new physical or synthetic recording is acquired, and the real-source uninformative outcome and training mismatch are retained.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(angularRecordingDesignReceipt(), null, 2));
