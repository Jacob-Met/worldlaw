/** Fitted original-observation course for output-grid aliasing.
 * No executable model is authored or injected. createSession applies the ordinary
 * import defaults to original scalar readings and supplies every competitor.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSession, exportSession} from '../src/session.mjs';
import {compareStudioDynamics, STUDIO_COMPARISON_LIMITS} from '../src/science/studio-dynamics-comparison.mjs';

export const FITTED_SAMPLING_COURSES = Object.freeze([
  {id: 'fitted-50hz', frequencyHz: 50, position: 1, rate: 0, duration: .2,
    witnessTime: .01, hiddenThroughDt: .02, revealingDt: .01},
  {id: 'held-fitted-100hz', frequencyHz: 100, position: .37, rate: 0, duration: .2,
    witnessTime: .005, hiddenThroughDt: .01, revealingDt: .005},
  {id: 'resolved-fitted-3_1hz', frequencyHz: 3.1, position: .6, rate: 0, duration: .2,
    witnessTime: .16, hiddenThroughDt: null, revealingDt: .02},
].map(Object.freeze));
export const FITTED_SAMPLING_GRIDS = Object.freeze([.02, .01, .005, .0025, .00125, .000625]);

export function fittedSamplingSource(frequencyHz = 50) {
  const stiffness = (2 * Math.PI * frequencyHz) ** 2;
  return {
    schema: 'worldlaw.observations/v1',
    source: {label: `Authored ${frequencyHz} Hz correlated-input sampling control; no physical acquisition`,
      kind: 'synthetic_analytic_fixture'},
    observations: Array.from({length: 512}, (_, i) => {
      const position = 1.1 * Math.sin(i * .731 + .2);
      const rate = .35 * Math.cos(i * 1.117 + .4);
      return {command: position, position, rate, jointTorque: -stiffness * position};
    }),
    heldOut: [],
  };
}

export function fittedSamplingOracle(course, modelId, time) {
  if (modelId === 'command') return {position: course.position + course.rate * time, rate: course.rate};
  assert.equal(modelId, 'spring');
  const omega = 2 * Math.PI * course.frequencyHz;
  return {
    position: course.position * Math.cos(omega * time) + course.rate / omega * Math.sin(omega * time),
    rate: -course.position * omega * Math.sin(omega * time) + course.rate * Math.cos(omega * time),
  };
}

export function runFittedSamplingCourse(course) {
  const source = fittedSamplingSource(course.frequencyHz);
  const originalBytes = JSON.stringify(source);
  const session = createSession(source); // Deliberately no discovery-option override.
  const notebookBefore = exportSession(session);
  assert.deepEqual(session.discovery.competitive.map(model => model.id), ['command', 'spring']);
  assert.equal(session.discovery.diagnostics.identifiability, 'insufficient_excitation');
  const stiffness = (2 * Math.PI * course.frequencyHz) ** 2;
  const fits = session.discovery.competitive.map(model => {
    assert.equal(model.terms.length, 1);
    const coefficient = model.terms[0].coefficient;
    const relativeCoefficientError = Math.abs(coefficient + stiffness) / stiffness;
    assert.ok(relativeCoefficientError < 1e-12);
    return {id: model.id, equation: model.equation, coefficient, relativeCoefficientError,
      trainingRMSE: model.metrics.rmse, scoreDelta: model.metrics.score - session.discovery.selected.metrics.score};
  });
  const grids = FITTED_SAMPLING_GRIDS.map(dt => {
    const result = compareStudioDynamics(session.discovery, {position: course.position, rate: course.rate},
      {duration: course.duration, dt, inertia: 1, command: 0});
    assert.equal(result.status, 'completed');
    assert.equal(result.results.length, 2);
    let maxPositionError = 0, maxRateError = 0;
    const outcomes = result.results.map(row => {
      for (const sample of row.trajectory) {
        const exact = fittedSamplingOracle(course, row.id, sample.time);
        maxPositionError = Math.max(maxPositionError, Math.abs(exact.position - sample.position));
        maxRateError = Math.max(maxRateError, Math.abs(exact.rate - sample.rate));
      }
      return {id: row.id, status: row.status, samples: row.trajectory.length,
        method: row.diagnostics.method,
        actualEvaluations: row.diagnostics.derivativeEvaluations + row.diagnostics.outputEvaluations,
        reservedEvaluations: row.reservedEvaluations};
    });
    assert.ok(maxPositionError < 1e-4);
    assert.ok(maxRateError < .02);
    if (course.hiddenThroughDt !== null && dt >= course.hiddenThroughDt) {
      assert.ok(result.summary.maxPositionSpread < 1e-4);
    }
    if (dt === course.revealingDt) assert.ok(result.summary.maxPositionSpread > course.position);
    return {dt, status: result.status, maxSampledPositionSpread: result.summary.maxPositionSpread,
      maxSampledRateSpread: result.summary.maxRateSpread, maxPositionError, maxRateError,
      totalSamples: result.work.totalSamples, actualEvaluations: outcomes.reduce((sum, row) => sum + row.actualEvaluations, 0),
      work: result.work, outcomes};
  });
  assert.equal(JSON.stringify(source), originalBytes);
  assert.equal(exportSession(session), notebookBefore);
  const command = fittedSamplingOracle(course, 'command', course.witnessTime);
  const spring = fittedSamplingOracle(course, 'spring', course.witnessTime);
  return {...course, originalRows: source.observations.length, fits,
    discoveryOptions: session.discovery.options,
    rank: {fullLibraryRank: session.discovery.diagnostics.fullLibraryRank,
      librarySize: session.discovery.diagnostics.librarySize,
      identifiability: session.discovery.diagnostics.identifiability},
    witness: {time: course.witnessTime, command, spring, positionSeparation: Math.abs(command.position - spring.position)},
    sourceSHA256: createHash('sha256').update(originalBytes).digest('hex'),
    sourceUnchanged: true, sourceOnlyNotebookUnchanged: true, grids};
}

async function main() {
  const courses = FITTED_SAMPLING_COURSES.map(runFittedSamplingCourse);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sourceHashes = {};
  for (const path of ['experiments/studio-fitted-sampling.mjs', 'src/session.mjs', 'src/science/torque-discovery.mjs',
    'src/science/studio-dynamics.mjs', 'src/science/studio-dynamics-comparison.mjs']) {
    sourceHashes[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  }
  const report = {schema: 'worldlaw.fitted-output-sampling/v1',
    context: process.env.WORLDLAW_SAMPLING_CONTEXT || 'local-draft', runtime: process.version,
    policy: STUDIO_COMPARISON_LIMITS, sourceHashes, courses,
    explanation: 'Numerically equal command and angle make command-only and spring-only torque laws unidentifiable on this authored source. Independent rate excitation excludes a rate-only substitute. Both one-term laws are fitted by ordinary defaults. With 512 rows, the next-term score penalty log(512)=6.238 exceeds the default ambiguity delta 6; the full declared library is still searched.',
    analyticReference: 'At declared inertia 1 and fixed command 0, the fitted command law gives zero acceleration. The spring law approximates q(t)=q0 cos(2πft)+(v0/(2πf))sin(2πft). The comparison oracle uses the authored frequency, not fitted trajectory samples.',
    limits: ['Authored original observations, no physical measurement or winner claim.',
      'Insufficient excitation is intentional and remains reported; training competition is not physical equivalence.',
      'A 100 Hz fitted spring aliases on both 20 ms and 10 ms grids. Agreement on successive grids is not a general resolution certificate.',
      'Slower playback cannot recover unreturned intermediate states. Finer output requires explicit bounded recomputation.',
      'All current competitors use the unchanged shared work and sample ceilings. No models or fitted answers are injected into the application.']};
  const at = process.argv.indexOf('--out');
  if (at >= 0) {
    assert.ok(process.argv[at + 1], '--out needs a filename prefix');
    const prefix = resolve(process.argv[at + 1]);
    await mkdir(dirname(prefix), {recursive: true});
    await writeFile(prefix + '.json', JSON.stringify(report, null, 2) + '\n');
    for (const course of FITTED_SAMPLING_COURSES.slice(0, 2)) {
      await writeFile(prefix + '.' + course.id + '.observations.json', JSON.stringify(fittedSamplingSource(course.frequencyHz), null, 2) + '\n');
    }
    console.log(JSON.stringify({report: prefix + '.json', context: report.context,
      courses: courses.map(course => ({id: course.id, fits: course.fits,
        witness: course.witness, grids: course.grids.map(({dt, maxSampledPositionSpread, actualEvaluations}) => ({dt, maxSampledPositionSpread, actualEvaluations}))}))}, null, 2));
  } else console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
