import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMotionResponsePanel} from '../src/science/local-motion-response-panel.mjs';

class Node {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = [];
    this.dataset = {}; this.attributes = {}; this.writes = 0; this.ownText = '';
  }
  set textContent(value) { this.writes++; this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(x => x.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.ownText = ''; this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}
const setup = () => {
  const doc = {createElement: tag => new Node(tag, doc)};
  const container = doc.createElement('div');
  const panel = createLocalMotionResponsePanel(container);
  const section = () => container.children[0];
  const find = (className, parent = section()) => {
    if (parent.className?.split(' ').includes(className)) return parent;
    for (const child of parent.children) { const value = find(className, child); if (value) return value; }
    return null;
  };
  return {container, panel, section, find};
};
const law = values => ({schema: 'worldlaw.torque-model/v1',
  terms: Object.entries(values).map(([id, coefficient]) => ({id, coefficient}))});
const states = (rate = -.5) => [
  {time: 0, position: .2, rate},
  {time: .25, position: .1, rate},
  {time: .5, position: .05, rate},
];
const options = {inertia: 1, command: 0};

test('first state is visible synchronously and later states use the captured law and executed values', () => {
  const ui = setup(), model = law({spring: -4, rate: -.2}), trajectory = states();
  const handle = ui.panel.setPrediction(model, trajectory, {...options, label: 'Measured-input fit'});
  assert.ok(handle);
  assert.equal(ui.section().dataset.index, '0');
  assert.equal(ui.section().dataset.state, 'available');
  assert.match(ui.find('local-response-state').textContent, /θ = 0.2 rad/);
  assert.match(ui.find('local-response-readouts').textContent, /Restoring angle response/);
  model.terms[0].coefficient = 4; trajectory[1].position = 900;
  assert.equal(ui.panel.showState(handle, 1), true);
  assert.equal(ui.section().dataset.time, '0.25');
  assert.match(ui.find('local-response-state').textContent, /θ = 0.1 rad/);
  assert.match(ui.find('local-response-readouts').textContent, /Restoring angle response/);
  assert.match(ui.find('local-response-state').textContent, /τ = -0.3 N·m/);
});

test('replacement, explicit retirement and failed admission reject late previous-course callbacks', () => {
  const ui = setup();
  const old = ui.panel.setPrediction(law({spring: -4}), states(), options);
  const current = ui.panel.setPrediction(law({spring: 4}), states(), {...options, label: 'New source'});
  const before = ui.container.textContent;
  assert.equal(ui.panel.showState(old, 2), false);
  assert.equal(ui.container.textContent, before);
  assert.match(before, /Amplifying angle response/);
  assert.equal(ui.panel.showState(current, 2), true);
  ui.panel.retire('Source changed.');
  assert.equal(ui.panel.showState(current, 0), false);
  assert.equal(ui.section().dataset.state, 'retired');
  assert.equal(ui.find('local-response-readouts').hidden, true);
  assert.equal(ui.panel.setPrediction(law({spring: -4}), states(), {inertia: 0}), null);
  assert.match(ui.find('local-response-status').textContent, /unavailable/);
  assert.equal(ui.panel.showState(old, 0), false);
});

test('invalid active playback indices clear the visible state and a valid current index recovers', () => {
  const ui = setup(), handle = ui.panel.setPrediction(law({spring: -1}), states(), options);
  for (const index of [-1, 3, .5, NaN, Infinity]) {
    assert.equal(ui.panel.showState(handle, index), false);
    assert.equal(ui.section().dataset.index, undefined);
    assert.equal(ui.find('local-response-readouts').hidden, true);
    assert.equal(ui.panel.showState(handle, 1), true);
    assert.equal(ui.section().dataset.index, '1');
    assert.equal(ui.find('local-response-readouts').hidden, false);
  }
});

test('zero-rate sign torque keeps angle response while ordinary modes remain unavailable', () => {
  const ui = setup(), trajectory = states(0); trajectory[1].rate = -.2;
  const handle = ui.panel.setPrediction(law({spring: -4, coulomb: -.3}), trajectory, options);
  assert.equal(ui.section().dataset.state, 'nonsmooth');
  const text = ui.find('local-response-readouts').textContent;
  assert.match(text, /Restoring angle response/);
  assert.match(text, /Rate response unavailable/);
  assert.match(text, /Frozen modes unavailable/);
  assert.doesNotMatch(text, /Decaying frozen modes/);
  assert.equal(ui.panel.showState(handle, 1), true);
  assert.equal(ui.section().dataset.state, 'available');
});

test('finite modes near the numeric maximum remain finite display strings', () => {
  const ui = setup();
  const handle = ui.panel.setPrediction(law({rate: 1}), states(0),
    {inertia: 1.000001 / Number.MAX_VALUE, command: 0});
  assert.ok(handle);
  assert.equal(ui.section().dataset.state, 'available');
  assert.match(ui.find('local-response-readouts').textContent, /1.7977e\+308/);
  assert.doesNotMatch(ui.container.textContent, /Infinity|NaN/);
  assert.match(ui.find('local-response-matrix').textContent, /1.7977e\+308/);
});

test('playback updates do not repeatedly mutate the unchanged status live region', () => {
  const ui = setup(), handle = ui.panel.setPrediction(law({spring: -4}), states(), options);
  const status = ui.find('local-response-status'), initialWrites = status.writes;
  assert.equal(status.attributes.role, 'status');
  ui.panel.showState(handle, 1); ui.panel.showState(handle, 2);
  assert.equal(status.writes, initialWrites);
  const trajectory = states(0); trajectory[1].rate = -.2;
  const next = ui.panel.setPrediction(law({spring: -4, coulomb: -.3}), trajectory, options);
  const refusedWrites = status.writes;
  ui.panel.showState(next, 1);
  assert.equal(status.writes, refusedWrites + 1);
  assert.match(status.textContent, /Local derivatives/);
});

test('disposal is final and course labels remain ordinary text', () => {
  const ui = setup(), handle = ui.panel.setPrediction(law({spring: -4}), states(),
    {...options, label: '<img src=x onerror=throw> original source'});
  assert.match(ui.find('local-response-source').textContent, /<img src=x/);
  ui.panel.dispose(); ui.panel.dispose();
  assert.equal(ui.container.children.length, 0);
  assert.equal(ui.panel.showState(handle, 1), false);
  assert.throws(() => ui.panel.setPrediction(law({spring: -4}), states(), options), /disposed/);
});
