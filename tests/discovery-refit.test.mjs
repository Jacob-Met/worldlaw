import test from 'node:test';
import assert from 'node:assert/strict';
import {discover, refitDiscovery, evaluate, DEFAULT_TERMS} from '../src/science/torque-discovery.mjs';
import {createSession, refitSession, appendMeasurements, exportSession, restoreSession, undoSession} from '../src/session.mjs';

function source(count = 93) {
  return Array.from({length:count}, (_, i) => {
    const command = Math.sin(i * 1.379) * 0.9, rate = Math.cos(i * 2.417) * 1.8;
    const position = Math.sin(i * 0.793 + 0.4) * 2.5;
    return {command, position, rate, jointTorque:2.1*command - .7*position - .23*rate*Math.abs(rate)};
  });
}
const exact = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

test('fresh noise and ambiguity revisions retain every complete-discovery result without mutation', () => {
  const observations = source(), initial = discover(observations, {noiseSigma:1e-5});
  const before = JSON.stringify(initial);
  let previous = initial;
  for (const options of [
    {noiseSigma:.1, ambiguityDelta:0}, {noiseSigma:1000, ambiguityDelta:100},
    {noiseSigma:1e-12, ambiguityDelta:6}, {noiseSigma:.1, ambiguityDelta:17},
  ]) {
    const next = refitDiscovery(previous, options);
    exact(next, discover(observations, options));
    previous = next;
  }
  assert.equal(JSON.stringify(initial), before);
});

test('a changed noise floor restores original library-order ties instead of retaining prior rank order', () => {
  const observations = source().map(row => ({...row, jointTorque:-3*Math.sin(row.position)}));
  const fitted = discover(observations, {noiseSigma:1e-8, maxTerms:1});
  assert.notEqual(fitted.candidates.filter(model => model.terms.length === 1)[0].id, 'command');
  const tied = refitDiscovery(fitted, {noiseSigma:1000, maxTerms:1});
  assert.deepEqual(tied.candidates.map(model => model.id), ['zero', ...DEFAULT_TERMS]);
  exact(tied, discover(observations, {noiseSigma:1000, maxTerms:1}));
});

test('changed source rows, order, and count each refit the original numerical problem', () => {
  for (const mutate of [
    rows => { rows[5].jointTorque += 15; },
    rows => { rows[10].position += .8; },
    rows => rows.reverse(),
    rows => rows.push({...rows[2], jointTorque:4}),
    rows => { rows[0].command = -0; },
  ]) {
    const fitted = discover(source()), before = JSON.stringify(fitted.selected);
    mutate(fitted.observations);
    const next = refitDiscovery(fitted, {noiseSigma:.02});
    exact(next, discover(fitted.observations, {noiseSigma:.02}));
    assert.equal(JSON.stringify(fitted.selected), before);
  }
});

test('changed maximum terms, optional family, and offered term order execute the complete new search', () => {
  const observations = source(), initial = discover(observations);
  for (const options of [
    {maxTerms:1}, {maxTerms:7},
    {terms:[...DEFAULT_TERMS, 'command_position', 'cubic'], maxTerms:5},
    {terms:[...DEFAULT_TERMS].reverse(), noiseSigma:1000},
  ]) exact(refitDiscovery(initial, options), discover(observations, options));
  const expanded = refitDiscovery(initial, {terms:[...DEFAULT_TERMS, 'command_position'], maxTerms:5});
  exact(refitDiscovery(expanded, {terms:[...DEFAULT_TERMS, 'command_position'], maxTerms:5, noiseSigma:.3}),
    discover(observations, {terms:[...DEFAULT_TERMS, 'command_position'], maxTerms:5, noiseSigma:.3}));
});

test('serialized or edited derived fits cannot become fitting evidence', () => {
  const fitted = discover(source()), observations = structuredClone(fitted.observations);
  const serialized = JSON.parse(JSON.stringify(fitted));
  for (const result of [fitted, serialized]) {
    result.candidates[0].terms[0].coefficient = 123456;
    result.candidates.reverse();
    result.candidates[0].metrics.rmse = 0;
    result.diagnostics.fullLibraryRank = 999;
    result.options.terms.reverse();
    exact(refitDiscovery(result, {noiseSigma:.2}), discover(observations, {noiseSigma:.2}));
  }
  const next = refitDiscovery(fitted, {noiseSigma:.2});
  next.observations[0].jointTorque = 999;
  next.selected.terms[0].coefficient = 999;
  exact(refitDiscovery(fitted, {noiseSigma:.3}), discover(observations, {noiseSigma:.3}));
});

test('rank failure and unexecutable candidates survive reranking; malformed evidence still refuses', () => {
  const cases = [
    Array.from({length:12}, () => ({command:0, position:0, rate:0, jointTorque:0})),
    source().map(row => ({...row, position:row.position*1e-25})),
    source().map(row => ({...row, command:row.command*1e-9, jointTorque:row.jointTorque*1e6})),
  ];
  for (const observations of cases) {
    const initial = discover(observations);
    exact(refitDiscovery(initial, {noiseSigma:1e-10}), discover(observations, {noiseSigma:1e-10}));
    initial.observations[0].rate = NaN;
    assert.throws(() => refitDiscovery(initial), /finite/);
  }
  const initial = discover(source());
  assert.throws(() => refitDiscovery(initial, {noiseSigma:0}), /at least/);
  assert.throws(() => refitDiscovery(initial, {terms:['rate','rate']}), /unique/);
});

test('actual input-only session replay, structural revision, measurement and undo retain all history', () => {
  let state = createSession({observations:source(48), heldOut:source(18)});
  for (const options of [{noiseSigma:.3}, {noiseSigma:.001}, {ambiguityDelta:20},
    {includeCommandPosition:true}, {maxTerms:2}, {noiseSigma:.2}]) {
    state = refitSession(state, options);
    const terms = state.options.includeCommandPosition ? [...DEFAULT_TERMS,'command_position'] : DEFAULT_TERMS;
    exact(state.discovery, discover(state.discovery.observations, {...state.options, terms}));
  }
  state = appendMeasurements(state, [{command:.4,position:.8,rate:-.2,jointTorque:3}], 'Separate reading');
  const previous = state;
  state = refitSession(state, {noiseSigma:.07});
  const text = exportSession(state), raw = JSON.parse(text);
  assert.equal(Object.hasOwn(raw, 'discovery'), false);
  assert.equal(Object.hasOwn(raw, 'candidates'), false);
  exact(restoreSession(text), state);
  exact(undoSession(state), previous);
  raw.base.observations[0].jointTorque += 4;
  const changed = restoreSession(JSON.stringify(raw));
  assert.notDeepEqual(changed.discovery.selected, state.discovery.selected);
  exact(changed.discovery, discover(changed.discovery.observations, {...changed.options, terms:[...DEFAULT_TERMS,'command_position']}));
});

test('held-out outcomes remain outside fresh fitting and ranking reuse', () => {
  const dataset = {observations:source(), heldOut:source(15)};
  const a = refitSession(createSession(dataset), {noiseSigma:.1});
  const b = refitSession(createSession({...dataset, heldOut:dataset.heldOut.map(row => ({...row,jointTorque:999}))}), {noiseSigma:.1});
  exact(a.discovery, b.discovery);
  assert.notEqual(evaluate(a.discovery.selected, a.base.heldOut).rmse, evaluate(b.discovery.selected, b.base.heldOut).rmse);
});
