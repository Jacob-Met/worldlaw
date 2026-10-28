import test from 'node:test';
import assert from 'node:assert/strict';
import {commandTimingComparison} from '../src/trajectory/command-timing-comparison.mjs';
import {compareCommandTiming, exportCommandTimingInputs, restoreCommandTimingInputs} from '../src/trajectory/command-timing-study.mjs';
import {commandTimingExample} from '../src/trajectory/command-timing-example.mjs';

const times = [10, 10.2, 10.7];
const run = {id: 'original', samples: times.map(time => ({time, position: 0}))};
const forecast = (delaySeconds, values, extra = {}) => ({
  delaySeconds, status: 'fitted', score: 0,
  receiving: [{runId: run.id, status: 'executed', rollout: {rows: values.map((predicted, index) => ({time: times[index], predicted}))}}],
  ...extra,
});
const reportOf = (candidates, extra = {}) => ({
  bundle: {challengeRuns: [run]}, options: {}, candidates,
  competitiveDelays: candidates.map(candidate => candidate.delaySeconds), ...extra,
});

test('uses the retained training family, not displayed-recording error or inspected choice', () => {
  const report = reportOf([
    forecast(0, [-2, 3, 4], {challengeRMSE: 100}),
    forecast(.1, [1, -1, 4], {challengeRMSE: null}),
    forecast(.2, [-99, 99, 99], {challengeRMSE: 0}),
  ], {competitiveDelays: [0, .1], selectedDelay: 0});
  const before = structuredClone(report), received = commandTimingComparison(report, run.id);
  assert.deepEqual(received.rows, [{time: 10, low: -2, high: 1}, {time: 10.2, low: -1, high: 3}, {time: 10.7, low: 4, high: 4}]);
  assert.deepEqual(received.availableKeys, ['0', '0.1']);
  assert.deepEqual(report, before);
});

test('distinguishes exact response pairs sharing a delay', () => {
  const report = reportOf([
    forecast(0, [0, 1, 2], {responseTimeSeconds: 0}),
    forecast(0, [9, 9, 9], {responseTimeSeconds: .2}),
    forecast(.1, [2, 1, -2], {responseTimeSeconds: .2}),
  ], {options: {responseTimes: [0, .2]}, competitiveResponses: [{delaySeconds: 0, responseTimeSeconds: 0}, {delaySeconds: .1, responseTimeSeconds: .2}]});
  const received = commandTimingComparison(report, run.id);
  assert.deepEqual(received.availableKeys, ['0:0', '0.1:0.2']);
  assert.deepEqual(received.rows.map(row => [row.low, row.high]), [[0, 2], [1, 1], [-2, 2]]);
});

test('never switches to row-wise survivors or silently drops unavailable alternatives', () => {
  const incomplete = forecast(.1, [200, 300]);
  const shifted = forecast(.2, [-200, -300, -400]); shifted.receiving[0].rollout.rows[1].time += .01;
  const nonfinite = forecast(.3, [-500, NaN, -600]);
  const failed = forecast(.4, [7, 8, 9], {receiving: [{runId: run.id, status: 'failed', error: {message: 'Solver refused this recording.'}}]});
  const wrongRun = forecast(.5, [10, 11, 12]); wrongRun.receiving[0].runId = 'different';
  const received = commandTimingComparison(reportOf([forecast(0, [1, 2, 3]), incomplete, shifted, nonfinite, failed, wrongRun]), run.id);
  assert.equal(received.candidateCount, 6); assert.equal(received.availableCount, 1);
  assert.equal(received.unavailable.length, 5);
  assert.deepEqual(received.rows.map(row => [row.low, row.high]), [[1, 1], [2, 2], [3, 3]]);
  assert.match(received.unavailable.find(row => row.key === '0.4').reason, /Solver refused/);
});

test('retains empty and identical-prediction cases without inventing spread', () => {
  const empty = commandTimingComparison(reportOf([forecast(0, [NaN, 1, 2])]), run.id);
  assert.equal(empty.availableCount, 0); assert.equal(empty.candidateCount, 1); assert.deepEqual(empty.rows, []);
  const identical = commandTimingComparison(reportOf([forecast(0, [1, 1, 1]), forecast(.1, [1, 1, 1])]), run.id);
  assert.equal(identical.availableCount, 2);
  assert.ok(identical.rows.every(row => row.low === 1 && row.high === 1));
  assert.throws(() => commandTimingComparison(reportOf([]), 'absent'), /original challenge recording/);
});

test('consumes the actual fitted example and its source-only save/reopen without altering evidence', () => {
  const example = commandTimingExample();
  const options = {...example.options, delays: [0, .1, .2], noiseSigma: .01, ambiguityDelta: 100};
  const report = compareCommandTiming(example.bundle, options);
  assert.ok(report.competitiveDelays.length >= 2, 'control must retain several competing training explanations');
  const source = exportCommandTimingInputs(report), received = commandTimingComparison(report, report.bundle.challengeRuns[0].id);
  assert.equal(received.candidateCount, report.competitiveDelays.length);
  assert.equal(received.availableCount, received.candidateCount);
  assert.ok(received.rows.some(row => row.high - row.low > .05), 'control must exhibit materially different actual forecasts, not rounding noise');
  assert.equal(exportCommandTimingInputs(report), source);
  const reopened = restoreCommandTimingInputs(source);
  assert.deepEqual(commandTimingComparison(reopened, reopened.bundle.challengeRuns[0].id), received);
});
