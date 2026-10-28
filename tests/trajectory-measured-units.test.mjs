import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMeasuredUnitState} from '../scripts/support/trajectory-measured-units.mjs';

// Declared expectations are independent of the implementation's label constants.
const label = 'Pre-recording command / initial applied equilibrium for EVERY run (N·m)';
function measuredPage() {
  return {
    panelCount: 1, panelVisible: true, fieldCount: 1, labelTag: 'LABEL',
    labelControlId: 'command-timing-before', labelText: label,
    sourceText: 'No known-inertia command source loaded.',
    statusText: 'This instrument needs recorded command and known inertia. The current angular-only evidence cannot support a command-delay study.',
    runDisabled: true, resultHidden: true, resultVisible: false,
    saveHidden: true, saveVisible: false, chartChildren: 0,
    bodyText: `Angular model α = −θ\nPhysical inertia and absolute torque remain unknown.\n${label}`,
  };
}

test('measured angular page permits the sole declared input label of an inapplicable timing instrument', () => {
  assert.doesNotThrow(() => assertMeasuredUnitState(measuredPage()));
});

for (const [name, change] of [
  ['active result invents torque', state => {state.bodyText += '\nSelected torque: 2 N·m';}],
  ['active result invents physical inertia', state => {state.bodyText += '\nInertia: 1 kg·m²';}],
  ['timing execution is enabled', state => {state.runDisabled = false;}],
  ['timing source contradicts angular-only evidence', state => {state.sourceText = 'Current source: known inertia';}],
  ['timing refusal is absent', state => {state.statusText = 'Ready to compare';}],
  ['old timing result is visible', state => {state.resultHidden = false; state.resultVisible = true;}],
  ['old timing export is available', state => {state.saveHidden = false; state.saveVisible = true;}],
  ['old plotted output is retained', state => {state.chartChildren = 1;}],
  ['a second physical-unit label appears', state => {state.bodyText += '\n' + label;}],
  ['label belongs to another input', state => {state.labelControlId = 'different-input';}],
  ['exempt text is not an input label', state => {state.labelTag = 'DIV';}],
  ['timing panel is ambiguous', state => {state.panelCount = 2;}],
  ['timing input is ambiguous', state => {state.fieldCount = 2;}],
]) {
  test(`measured-unit receiving rejects when ${name}`, () => {
    const state = measuredPage();
    change(state);
    assert.throws(() => assertMeasuredUnitState(state), {name: 'AssertionError'});
  });
}
