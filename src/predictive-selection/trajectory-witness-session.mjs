import {seekTrajectoryWitnesses} from './trajectory-witness.mjs';
const SCHEMA = 'worldlaw.trajectory-witness-inputs/v1';
const copy = value => JSON.parse(JSON.stringify(value));
/** Source-only replay; no cached trial, equation or claimed verdict is admitted. */
export function createTrajectoryWitnessStudy(raw) {
  if (!raw || raw.schema !== SCHEMA) throw Error('Unsupported trajectory witness source schema');
  const source = copy({schema: SCHEMA, model: raw.model, trainingRuns: raw.trainingRuns,
    prospect: raw.prospect, options: raw.options});
  if (!source.model || typeof source.model !== 'object' || Array.isArray(source.model))
    throw Error('A declared angular model is required');
  delete source.model.equation;
  delete source.model.metrics;
  const comparison = seekTrajectoryWitnesses(source.model, source.trainingRuns, source.prospect, source.options);
  return {schema: 'worldlaw.trajectory-witness-study/v1', source, comparison, limitations: [
    'Training tolerance is declared, not estimated sensor uncertainty.',
    'Prospective initial state and time schedule are declarations, not a held-out measurement.',
    'Search finds two witnesses, not a complete feasible envelope; no confidence level follows.',
    'Coefficients share the original angular-acceleration scale; physical torque and inertia remain unknown.'
  ]};
}
export function saveTrajectoryWitnessStudy(study) {
  return JSON.stringify(study.source, null, 2);
}
export function reopenTrajectoryWitnessStudy(text) {
  if (typeof text !== 'string' || text.length > 3000000) throw Error('Use source JSON under 3 million characters');
  return createTrajectoryWitnessStudy(JSON.parse(text));
}
