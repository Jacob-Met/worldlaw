import assert from 'node:assert/strict';

const declaredInputLabel = 'Pre-recording command / initial applied equilibrium for EVERY run (N·m)';
const inapplicableSource = 'No known-inertia command source loaded.';
const inapplicableStatus = 'This instrument needs recorded command and known inertia. The current angular-only evidence cannot support a command-delay study.';

export function assertMeasuredUnitState(state) {
  assert.equal(state.panelCount, 1);
  assert.equal(state.panelVisible, true);
  assert.equal(state.fieldCount, 1);
  assert.equal(state.labelTag, 'LABEL');
  assert.equal(state.labelControlId, 'command-timing-before');
  assert.equal(state.labelText, declaredInputLabel);
  assert.equal(state.sourceText, inapplicableSource);
  assert.equal(state.statusText, inapplicableStatus);
  assert.equal(state.runDisabled, true);
  assert.equal(state.resultHidden, true);
  assert.equal(state.resultVisible, false);
  assert.equal(state.saveHidden, true);
  assert.equal(state.saveVisible, false);
  assert.equal(state.chartChildren, 0);
  // Exempt exactly this verified, inapplicable input label, never the whole panel.
  // All remaining visible page text retains the original physical-unit refusal.
  const parts = state.bodyText.split(declaredInputLabel);
  assert.equal(parts.length, 2, 'Expected exactly one inapplicable command-input label');
  assert.doesNotMatch(parts.join(''), /N·m|kg·m²/);
}

export async function assertMeasuredUnits(page) {
  const panel = page.locator('#command-timing-panel');
  assert.equal(await panel.count(), 1);
  assert.equal(await panel.locator('#command-timing-before').count(), 1);
  assertMeasuredUnitState({
    panelCount: await panel.count(), panelVisible: await panel.isVisible(),
    fieldCount: await panel.locator('#command-timing-before').count(),
    labelTag: await panel.locator('#command-timing-before').evaluate(field => field.parentElement.tagName),
    labelControlId: await panel.locator('#command-timing-before').evaluate(field => field.parentElement.control?.id),
    labelText: await panel.locator('#command-timing-before').evaluate(field => field.parentElement.innerText),
    sourceText: await panel.locator('#command-timing-source').innerText(),
    statusText: await panel.locator('#command-timing-status').innerText(),
    runDisabled: await panel.locator('#command-timing-run').isDisabled(),
    resultHidden: await panel.locator('#command-timing-result').evaluate(element => element.hidden),
    resultVisible: await panel.locator('#command-timing-result').isVisible(),
    saveHidden: await panel.locator('#command-timing-save').evaluate(element => element.hidden),
    saveVisible: await panel.locator('#command-timing-save').isVisible(),
    chartChildren: await panel.locator('#command-timing-chart > *').count(),
    bodyText: await page.locator('body').innerText(),
  });
}
