/** Reproducible numerical review of the frozen, not-yet-adopted planner contract. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {planTrajectoryExperiment} from '../tests/support/trajectory-planner-baseline.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

const BASELINE_SOURCE_SHA256 = '63d5161e39fa592d90f4b06efe8569879cf5b2b66db309d0e9acc65ec0300f10';
function dampingCase(coefficients, maxStep) {
  const models = coefficients.map(k => ({schema: 'worldlaw.torque-model/v1', id: `damping-${k}`,
    terms: [{id: 'rate', coefficient: -k}], units: {...UNITS}}));
  const discovery = {schema: 'worldlaw.discovery/v1', units: {...UNITS}, selected: models[0], candidates: models,
    competitive: models, trainingRuns: [{id: 'independent-analytic-damping-case'}]};
  const design = {inertia: 1, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}},
    duration: .1, sampleInterval: .1, maxStep, minDisagreement: .01};
  const plan = planTrajectoryExperiment(discovery, design);
  const qualification = qualifyTrajectoryPlan(discovery, plan);
  const exactPosition = k => -Math.expm1(-k * design.duration) / k;
  return {coefficients, design, plannerStatus: plan.status, disagreementRad: plan.selected.disagreementRad,
    exactDisagreementRad: Math.abs(exactPosition(coefficients[0]) - exactPosition(coefficients[1])),
    exactReference: 'theta(t)=(1-exp(-k*t))/k from independent analytic solution of theta prime=omega, omega prime=-k*omega',
    qualificationStatus: qualification.status, selectedQualification: qualification.selectedQualification,
    reservedSteps: qualification.diagnostics.reservedSteps};
}
export function numericalQualificationReceipt() {
  const bundle = JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
  const discovery = discoverIntegral(bundle.trainingRuns, {noiseSigma: .01, maxTerms: 4});
  const plan = planTrajectoryExperiment(discovery, {inertia: .8,
    bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
    predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}});
  const qualification = qualifyTrajectoryPlan(discovery, plan);
  return {schema: 'worldlaw.trajectory-numerical-qualification-receipt/v1',
    plannerSource: {status: 'frozen_unpublished_test_support_only', owner: 'HAMON team92be8b055703', originalSha256: BASELINE_SOURCE_SHA256,
      importAdaptation: 'Only two relative import paths changed; no product adoption or browser integration is claimed.'},
    analyticCases: [dampingCase([300, 301], .01), dampingCase([300, 301], .0001), dampingCase([100, 101], .1)],
    syntheticFixture: {trainingRunIds: discovery.trainingRuns.map(run => run.id), selectedModelId: discovery.selected.id,
      plannerStatus: plan.status, selectedDesign: plan.selected.acquisitionRequest, disagreementRad: plan.selected.disagreementRad,
      qualificationStatus: qualification.status, selectedQualification: qualification.selectedQualification,
      originalCompetitiveCount: plan.diagnostics.competitiveModelCount, omittedCompetitiveCount: plan.diagnostics.omittedCompetitiveCount,
      qualificationDiagnostics: qualification.diagnostics},
    scope: 'Component numerical screening and analytic counterexamples. No hardware, acquired evidence, browser receiving, physical validation or integration adoption is established.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(numericalQualificationReceipt(), null, 2));
