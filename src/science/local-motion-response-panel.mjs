import {localMotionResponse} from './local-motion-response.mjs';

const number = value => {
  if (!Number.isFinite(value)) return 'unavailable';
  if (value === 0) return '0';
  // Keep rounded scientific notation as text: reparsing a rounded finite
  // Number.MAX_VALUE can overflow and incorrectly display Infinity.
  return value.toPrecision(5).replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/g, '$1');
};
const positionLabels = {
  restoring: 'Restoring angle response',
  amplifying: 'Amplifying angle response',
  zero_linear_response: 'Zero linear angle response',
  unavailable: 'Angle response unavailable',
};
const rateLabels = {
  opposes_rate_perturbation: 'Opposes a rate perturbation',
  reinforces_rate_perturbation: 'Reinforces a rate perturbation',
  zero_linear_response: 'Zero linear rate response',
  unavailable: 'Rate response unavailable',
};
const patternLabels = {
  one_growing_one_decaying: 'One growing and one decaying mode',
  decaying: 'Decaying frozen modes',
  growing: 'Growing frozen modes',
  neutral_oscillation: 'Neutral frozen oscillation',
  neutral_position_decaying_rate: 'Neutral position; decaying rate',
  neutral_position_growing_rate: 'Neutral position; growing rate',
  position_drift: 'Zero modes permit position drift',
};
const modeNumber = value => number(value.real) +
  (value.imaginary === 0 ? '' : (value.imaginary < 0 ? ' − ' : ' + ') +
    number(Math.abs(value.imaginary)) + 'i');

/**
 * Readout of the existing solver course. This component owns no timer or solver.
 * Each installed course returns an opaque handle; callbacks from a retired
 * course cannot replace the current state. Call retire before source changes.
 */
export function createLocalMotionResponsePanel(container) {
  if (!container || typeof container.replaceChildren !== 'function')
    throw new TypeError('Local response needs a DOM container.');
  const doc = container.ownerDocument;
  const element = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const section = element('section', undefined, 'local-response-instrument');
  section.setAttribute('aria-label', 'Local response of the displayed solver state');
  const header = element('div', undefined, 'local-response-header');
  const heading = element('h3', 'LOCAL MOTION RESPONSE');
  const time = element('span', 'No displayed solver state', 'local-response-time');
  header.append(heading, time);
  const source = element('p', '', 'local-response-source');
  const status = element('p', '', 'local-response-status');
  status.setAttribute('role', 'status');
  const readouts = element('div', undefined, 'local-response-readouts');
  const field = (label, className) => {
    const group = element('div', undefined, 'local-response-field');
    const title = element('h4', label);
    const value = element('p', '—', className);
    const detail = element('p', '', 'local-response-detail');
    group.append(title, value, detail);
    readouts.append(group);
    return {group, value, detail};
  };
  const angle = field('ANGLE PERTURBATION', 'local-response-value');
  const rate = field('RATE PERTURBATION', 'local-response-value');
  const modes = field('FROZEN MODES', 'local-response-value');
  const details = element('details', undefined, 'local-response-explanation');
  const summary = element('summary', 'Inspect this local calculation');
  const state = element('p', '', 'local-response-state');
  const declarations = element('p', '', 'local-response-declarations');
  const matrix = element('p', '', 'local-response-matrix');
  const scope = element('p', 'These are derivatives of the declared executable law at one sampled solver state. Frozen modes at a moving state do not establish equilibrium, finite-horizon growth, nonlinear stability or physical truth. No between-sample or error enclosure is claimed.');
  const course = element('p', '', 'local-response-course');
  details.append(summary, state, declarations, matrix, course, scope);
  section.append(header, source, status, readouts, details);
  container.replaceChildren(section);
  let active = null;
  let disposed = false;
  let displayed = null;

  function clear(message, kind = 'retired') {
    displayed = null;
    section.dataset.state = kind;
    delete section.dataset.index;
    delete section.dataset.time;
    time.textContent = 'No displayed solver state';
    status.textContent = message;
    readouts.hidden = true;
    details.hidden = true;
    source.textContent = '';
    state.textContent = '';
    declarations.textContent = '';
    matrix.textContent = '';
    course.textContent = '';
    for (const field of [angle, rate, modes]) {
      field.value.textContent = '—';
      field.detail.textContent = '';
      delete field.group.dataset.response;
    }
  }
  function retire(message = 'Run an inspected-law prediction to inspect its local response.') {
    if (disposed) return;
    active = null;
    clear(message);
  }
  function showState(handle, index) {
    if (disposed || !active || handle !== active.handle) return false;
    if (!Number.isInteger(index) || index < 0 || index >= active.analysis.rows.length) {
      clear('The current prediction has no admitted solver state at that index.', 'unavailable');
      return false;
    }
    if (displayed === index) return true;
    const analysis = active.analysis;
    const row = analysis.rows[index];
    displayed = index;
    section.dataset.state = row.status;
    section.dataset.index = String(index);
    section.dataset.time = String(row.time);
    time.textContent = 't = ' + number(row.time) + ' s · state ' +
      (index + 1) + ' / ' + analysis.rows.length;
    source.textContent = active.label + ' · executed scalar prediction';
    const statusText = row.status === 'available'
      ? 'Local derivatives at the displayed solver state.'
      : row.reason || row.modes?.reason || 'This local response is unavailable.';
    // This is a live region: announce a changed refusal or interpretation,
    // without announcing the same sentence on every animation frame.
    if (status.textContent !== statusText) status.textContent = statusText;
    readouts.hidden = false;
    details.hidden = false;
    angle.value.textContent = positionLabels[row.positionResponse];
    angle.detail.textContent = row.torqueByPosition === null ? 'No admitted derivative'
      : '∂τ/∂θ = ' + number(row.torqueByPosition) + ' N·m/rad';
    angle.group.dataset.response = row.positionResponse;
    rate.value.textContent = rateLabels[row.rateResponse];
    rate.detail.textContent = row.torqueByRate === null ? 'No admitted derivative'
      : '∂τ/∂ω = ' + number(row.torqueByRate) + ' N·m·s/rad';
    rate.group.dataset.response = row.rateResponse;
    modes.value.textContent = row.modes?.status === 'available'
      ? patternLabels[row.modes.pattern] : 'Frozen modes unavailable';
    modes.detail.textContent = row.modes?.status === 'available'
      ? row.modes.eigenvalues.map(modeNumber).join(' ; ') + ' s⁻¹'
      : row.status === 'nonsmooth' ? 'Zero-rate sign torque is nonsmooth' : 'No finite numeric result';
    modes.group.dataset.response = row.modes?.pattern || row.status;
    state.textContent = 'Displayed state: θ = ' + number(row.position) + ' rad; ω = ' +
      number(row.rate) + ' rad/s; recomputed τ = ' + number(row.jointTorque) + ' N·m.';
    declarations.textContent = 'Declared inertia ' + number(analysis.source.inertia) +
      ' kg·m²; fixed command ' + number(analysis.source.command) + '. ' +
      (row.stationaryEquation
        ? 'The supplied scalar equations are stationary at this sample; this is not a stability proof.'
        : 'This sample does not satisfy both stationary equations.');
    matrix.textContent = row.jacobian
      ? 'Perturbation equations: δθ′ = δω; δω′ = (' + number(row.jacobian[1][0]) +
        ' s⁻²) δθ + (' + number(row.jacobian[1][1]) + ' s⁻¹) δω.'
      : 'No ordinary finite perturbation matrix is admitted at this sample.';
    course.textContent = 'Course: ' + analysis.counts.available + ' admitted samples; ' +
      analysis.counts.nonsmooth + ' nonsmooth; ' + analysis.counts.unresolvedNumeric +
      ' numerically unresolved. The readout follows the existing playback state.';
    return true;
  }
  function setPrediction(model, trajectory, options = {}) {
    if (disposed) throw new Error('Local response panel has been disposed.');
    retire('Calculating the local response of this prediction.');
    try {
      const analysis = localMotionResponse(model, trajectory, options);
      const handle = Object.freeze({});
      active = {handle, analysis,
        label: typeof options.label === 'string' && options.label.trim()
          ? options.label.slice(0, 160) : 'Inspected executable law'};
      // The actual playback starts from its first executed sample, including
      // reduced-motion runs that never schedule an animation frame.
      showState(handle, 0);
      return handle;
    } catch (error) {
      retire('Local response unavailable: ' + String(error?.message || error));
      return null;
    }
  }
  function dispose() {
    if (disposed) return;
    active = null;
    clear('Local response retired.', 'disposed');
    disposed = true;
    container.replaceChildren();
  }
  retire();
  return Object.freeze({setPrediction, showState, retire, dispose});
}
