import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCommandTimeline} from '../src/trajectory/command-timeline.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {rolloutWithResolution} from '../src/trajectory/resolution.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {compareCommandTiming, exportCommandTimingInputs, restoreCommandTimingInputs} from '../src/trajectory/command-timing-study.mjs';
import {commandTimingExample} from '../src/trajectory/command-timing-example.mjs';

const close = (a, b, e = 1e-10) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const pureCommand = {schema: 'worldlaw.torque-model/v1', id: 'command', terms: [{id: 'command', coefficient: 1}]};

test('non-sample delayed changes integrate exact held forcing at original observations', () => {
  const samples = [{time: 10, position: 0, command: 2}, {time: 10.5, position: 0, command: -1}, {time: 11, position: 0, command: 9}];
  const timing = {delaySeconds: .137, beforeStart: 0}, timeline = prepareCommandTimeline(samples, timing);
  const run = {id: 'held', label: 'Held', kind: 'synthetic', source: {label: 'Analytic'}, inertia: 1, initialRate: 0, samples};
  const result = rollout(pureCommand, run, {commandTiming: timing, maxStep: .3});
  const expected = t => Math.max(0, t - .137) ** 2 - 1.5 * Math.max(0, t - .637) ** 2;
  for (let i = 0; i < samples.length; i++) {close(timeline.doubleIntegrals[i], expected(samples[i].time - 10)); close(result.rows[i].predicted, expected(samples[i].time - 10));}
  assert.deepEqual(result.rows.map(r => r.time), samples.map(r => r.time));
  assert.equal(timeline.intervals[0].length, 2); assert.equal(timeline.intervals[1].length, 2);
  assert.equal(samples[1].position, 0);
});

test('positive delay requires explicit prehistory and finite ordered clocks', () => {
  const s = [{time: 0, command: 1}, {time: 1, command: 2}];
  assert.throws(() => prepareCommandTimeline(s, {delaySeconds: .1}), /explicit constant/);
  assert.throws(() => prepareCommandTimeline(s, {delaySeconds: -.1, beforeStart: 0}), /0 to 30/);
  assert.throws(() => prepareCommandTimeline([s[0], s[0]]), /strictly increase/);
  const long = prepareCommandTimeline(s, {delaySeconds: 2, beforeStart: .3});
  close(long.doubleIntegrals.at(-1), .15);
});

test('zero-delay reuse preserves existing model/trajectory numbers', () => {
  const {bundle} = commandTimingExample(), run = bundle.challengeRuns[0];
  const options = {terms: ['command', 'spring', 'rate', 'bias'], noiseSigma: 1e-5};
  const previous = discoverIntegral(bundle.trainingRuns, options), current = discoverIntegral(bundle.trainingRuns, {...options, commandTiming: {delaySeconds: 0, beforeStart: 123}});
  assert.deepEqual(current.selected, previous.selected);
  const base = rollout(previous.selected, run), delayZero = rollout(previous.selected, run, {commandTiming: {delaySeconds: 0, beforeStart: 123}});
  assert.deepEqual(delayZero.rows, base.rows); assert.deepEqual(delayZero.metrics, base.metrics);
});

test('coarse and refined execution keep the SAME delay and share their budget', () => {
  const samples = [{time: 0, command: 2, position: 0}, {time: .7, command: -1, position: 0}, {time: 1.2, command: 1, position: 0}];
  const run = {id: 'refinement', label: 'Refinement', kind: 'synthetic', source: {label: 'Analytic'}, inertia: 1, initialRate: 0, samples};
  const result = rolloutWithResolution(pureCommand, run, {commandTiming: {delaySeconds: .137, beforeStart: 0}, maxStep: .3, maxSteps: 100});
  assert.equal(result.resolution.status, 'compared'); close(result.resolution.maxAbsPositionDifference, 0);
  assert.ok(result.resolution.combinedSteps <= 100);
  assert.throws(() => rollout(pureCommand, run, {commandTiming: {delaySeconds: .137, beforeStart: 0}, maxStep: 1, maxSteps: 2}), /allowed 2/);
});

test('independent analytic source resolves declared delay and improves separate motion', () => {
  const {bundle, options} = commandTimingExample(), original = JSON.stringify(bundle);
  const report = compareCommandTiming(bundle, options), selected = report.candidates.find(c => c.delaySeconds === report.selectedDelay);
  assert.equal(report.selectedDelay, .137);
  assert.ok(selected.challengeRMSE < .001);
  assert.ok(report.candidates.find(c => c.delaySeconds === 0).challengeRMSE > 50 * selected.challengeRMSE);
  assert.equal(selected.discovery.diagnostics.runs[0].rawCount, bundle.trainingRuns[0].samples.length);
  assert.equal(report.candidates.length, options.delays.length);
  assert.equal(JSON.stringify(bundle), original);
});

test('challenge mutation changes residuals, never fitted models, scores or delay selection', () => {
  const {bundle, options} = commandTimingExample(), report = compareCommandTiming(bundle, options);
  const changed = structuredClone(bundle); changed.challengeRuns[0].samples.slice(1).forEach(s => s.position += .4);
  const next = compareCommandTiming(changed, options);
  assert.equal(next.selectedDelay, report.selectedDelay);
  assert.deepEqual(next.candidates.map(c => c.model), report.candidates.map(c => c.model));
  assert.deepEqual(next.candidates.map(c => c.score), report.candidates.map(c => c.score));
  assert.ok(next.candidates[3].challengeRMSE > .39);
});

test('source-only replay recomputes and complete work excess refuses', () => {
  const {bundle, options} = commandTimingExample(), report = compareCommandTiming(bundle, options);
  const raw = JSON.parse(exportCommandTimingInputs(report));
  assert.deepEqual(Object.keys(raw).sort(), ['bundle', 'options', 'schema']);
  raw.selectedDelay = 22; raw.candidates = [{score: -Infinity}];
  const reopened = restoreCommandTimingInputs(JSON.stringify(raw));
  assert.equal(reopened.selectedDelay, report.selectedDelay);
  assert.deepEqual(reopened.candidates.map(c => c.challengeRMSE), report.candidates.map(c => c.challengeRMSE));
  assert.throws(() => compareCommandTiming(bundle, {...options, maxTotalSteps: 10}), /complete delay/);
  assert.throws(() => compareCommandTiming(bundle, {...options, delays: [.1, .2]}), /including zero/);
});

test('constant unexcited input leaves delay alternatives tied', () => {
  const {bundle, options} = commandTimingExample();
  for (const run of [...bundle.trainingRuns, ...bundle.challengeRuns]) for (const sample of run.samples) sample.command = options.beforeStart;
  const report = compareCommandTiming(bundle, options);
  assert.equal(report.competitiveDelays.length, options.delays.length);
  assert.ok(report.candidates.every(c => c.discovery.diagnostics.fullLibraryRank < options.terms.length));
});

test('failed later rollout stays in the complete course rather than a survivor mean', () => {
  const {bundle} = commandTimingExample();
  const make = (id,count,duration,amplitude,observed=true) => ({id,label:id,kind:'synthetic',source:{label:'Independent exponential control',recordingId:id},
    inertia:1,initialRate:amplitude,samples:Array.from({length:count},(_,i)=>{const time=i*duration/(count-1);return {time,position:observed?amplitude*Math.exp(time):amplitude,command:Math.sin(time*3)};})});
  bundle.trainingRuns=[make('grow-training',201,2,.1)];
  bundle.challengeRuns=[make('short-success',41,1,.15),make('long-failure',51,25,.2,false)];
  const report=compareCommandTiming(bundle,{delays:[0,.1],beforeStart:0,terms:['command','spring'],noiseSigma:1e-8,maxStep:.01});
  for(const candidate of report.candidates){assert.equal(candidate.receiving.length,2);assert.equal(candidate.receiving[0].status,'executed');assert.equal(candidate.receiving[1].status,'failed');assert.equal(candidate.challengeRMSE,null);}
  assert.equal(report.work.failedRunStepsNotMeasured,true);
});
