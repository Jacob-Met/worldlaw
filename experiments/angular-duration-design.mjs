/** Fixed-fit finite-duration receipts; no challenge outcome informs the choice. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {discoverAngular} from '../src/trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {createAngularDurationPlanner} from '../src/experiment-design/angular-duration-planner.mjs';
import {planTrajectoryExperiment} from '../tests/support/trajectory-planner-baseline.mjs';

const planner = createAngularDurationPlanner(planTrajectoryExperiment);
const durations = [2, 4, 8];
const fitOptions = {noiseSigma: .01, maxTerms: 4, ambiguityDelta: 6, rateWindowSize: 9};
function input(name) {
  const bytes = readFileSync(new URL(`../examples/${name}`, import.meta.url)), bundle = JSON.parse(bytes);
  Object.defineProperty(bundle, 'challengeRuns', {get() {throw new Error('Duration planning cannot read reserved challenge recordings');}});
  return {bundle, source: {path: `examples/${name}`, sha256: createHash('sha256').update(bytes).digest('hex')}};
}
function summary(plan) {
  return {status: plan.status, durations: plan.durations, trainingFit: plan.trainingFit,
    durationResults: plan.durationResults, recordingRequest: plan.recordingRequest,
    selectedDuration: plan.selectedPlan?.options.duration ?? null,
    selectedModelProvenance: plan.selectedPlan?.provenance ?? null,
    physicalInertia: plan.physicalInertia, absoluteTorqueIdentified: plan.absoluteTorqueIdentified,
    diagnostics: plan.diagnostics};
}
export function angularDurationDesignReceipt() {
  const synthetic = input('trajectory-ambiguous-92be.json');
  const syntheticRuns = synthetic.bundle.trainingRuns.map(run => ({id: run.id, label: run.label, kind: 'synthetic',
    inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
    source: {label: 'Declared synthetic angular observations with physical torque scale withheld'},
    samples: run.samples.map(({time, position}) => ({time, position}))}));
  const syntheticDiscovery = discoverAngular(syntheticRuns, fitOptions);
  const syntheticDesign = {inertia: null, dynamics: 'unforced_scalar_rotation',
    bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
    predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}};
  const syntheticPlan = planner(syntheticDiscovery, syntheticDesign, durations);
  const measured = input('physical-pasco-92be.json'), weakOptions = {...fitOptions, windowDuration: 1, windowStride: .5};
  const measuredDiscovery = discoverAngularWeak(measured.bundle.trainingRuns, weakOptions);
  const measuredDesign = {inertia: null, dynamics: 'unforced_scalar_rotation',
    bounds: {initialPosition: {min: -.3, max: .3}, initialRate: {min: -.2, max: .2}},
    sampleInterval: .04, positionCount: 5, rateCount: 3,
    predictionBounds: {position: {min: -.6, max: .6}, rate: {min: -5, max: 5}}};
  const measuredPlan = planner(measuredDiscovery, measuredDesign, durations);
  return {schema: 'worldlaw.angular-duration-design-receipt/v1',
    basePlanner: {status: 'frozen_unpublished_test_support', originalSha256: '63d5161e39fa592d90f4b06efe8569879cf5b2b66db309d0e9acc65ec0300f10'},
    synthetic: {source: synthetic.source, fitOptions, declaredDesign: syntheticDesign, ...summary(syntheticPlan)},
    measured: {source: measured.source, fitOptions: weakOptions, declaredDesign: measuredDesign, ...summary(measuredPlan)},
    scope: 'Explicit 2/4/8-second comparison at unchanged fit/noise settings. Source challenge accessors throw. This ranks predicted separation, not empirical improvement or information per recording cost; no recording was acquired.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(angularDurationDesignReceipt(), null, 2));
