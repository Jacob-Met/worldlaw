/** A manual recording workbench. The injected planner owns all scientific computation. */
const format = (value, digits = 4) => !Number.isFinite(value) ? '—' :
  Math.abs(value) > 0 && Math.abs(value) < .0001 ? value.toExponential(2) :
    Number(value.toPrecision(digits)).toLocaleString('en-US', {maximumFractionDigits: 6});
const decisionLabel = status => ({proposed: 'Informative proposal', uninformative: 'Below the requested spread',
  numerically_unresolved: 'Numerically unresolved', no_feasible_design: 'No eligible release'}[status] || 'Unavailable');
const screenLabel = status => ({screen_passed: 'Passed step check', numerically_unresolved: 'Unresolved',
  not_evaluated: 'Not evaluated'}[status] || 'Unavailable');
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const svgElement = (tag, attrs, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};
const colors = ['#d4ed87', '#e1b78f', '#9fc9c1', '#d6b6d7', '#c8ceab', '#a8b9df', '#e3d18d', '#c7c0b7'];
const styles = `
:host{display:block;color:#213a30;font:13px/1.6 var(--sans,Arial,sans-serif)}
*{box-sizing:border-box}[hidden]{display:none!important}h2,h3,p{margin:0}button,input{font:inherit}
button{cursor:pointer;min-height:42px;padding:10px 15px;border:1px solid #cad7b5;border-radius:6px;background:#d4ed87;color:#23432e;font-size:11px;font-weight:600}
button.secondary{background:#fffefa}button:disabled,input:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #8da650;outline-offset:3px}
.panel{border:1px solid #d9dfcf;border-radius:13px;background:#fffefa;overflow:hidden}
.heading{padding:24px 24px 17px;display:flex;gap:16px;align-items:start;justify-content:space-between}
.eyebrow{font-size:9px;letter-spacing:.12em;color:#738263;font-weight:650;margin-bottom:7px}
h2{font:400 30px/1.17 var(--serif,Georgia,serif);letter-spacing:-.6px}h3{font-size:14px;font-weight:600}
.intro,.small{font-size:11px;line-height:1.8;color:#69795e}.intro{max-width:590px;margin-top:10px}
.badge{font-size:9px;padding:7px 9px;background:#edf2e1;border:1px solid #d6e1c4;border-radius:5px;max-width:175px;flex-shrink:0;color:#5a7045}
.body{padding:0 24px 24px}.context{font-size:10px;color:#758268;margin-bottom:12px;overflow-wrap:anywhere}
.fit{font-size:11px;padding:11px 13px;background:#edf2e1;border:1px solid #d8e2c8;border-radius:6px;margin-bottom:17px;line-height:1.8}
.fit.mismatch{background:#f8f1df;border-color:#e3d3aa;color:#765a31}
.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}label{display:block;font-size:10px;color:#5b7050}label span{display:block;font-size:9px;color:#869378;margin-bottom:5px}
input{width:100%;min-width:0;min-height:39px;border:1px solid #d5dec8;border-radius:5px;background:#fffefa;padding:8px;color:#304b30;font:11px var(--mono,monospace)}
fieldset{border:0;padding:0;margin:0;min-width:0}legend{font-size:11px;font-weight:600;color:#516948;margin-bottom:6px}
details{padding:10px 13px;border:1px solid #e0e5d5;border-radius:6px;background:#fafbf5;margin:15px 0;font-size:10px;color:#6d7d60}summary{cursor:pointer}
.actions{display:flex;gap:15px;align-items:center;justify-content:space-between;margin-top:16px}.actions .small{max-width:390px;font-size:10px}
.status{margin-top:18px;border-top:1px solid #dee5d4;padding-top:17px}.status h3{font:24px/1.3 var(--serif,Georgia,serif);font-weight:400}.status p{margin-top:7px}
.error{background:#fff0e7;border:1px solid #dfbcab;border-radius:6px;padding:11px 13px;color:#844431;font-size:11px;margin-top:15px;overflow-wrap:anywhere}
.table-wrap{overflow-x:auto;margin-top:16px}table{width:100%;border-collapse:collapse;font-size:10px;text-align:left}caption{text-align:left;color:#738265;padding-bottom:8px;font-size:10px}
th,td{padding:10px 9px;border-bottom:1px solid #e0e5d7;vertical-align:top}th{font-weight:500;color:#7c8b6a;font-size:9px}td small{display:block;font-size:9px;color:#819173}tr.selected{background:#edf3df}
.duration{font:20px var(--serif,Georgia,serif);white-space:nowrap;color:#425e35}.spread{font-family:var(--mono,monospace)}
.release{display:grid;grid-template-columns:1fr 1.1fr;gap:16px;margin-top:20px;align-items:start}.release-card{padding:17px;background:#f0f4e6;border:1px solid #dce5cf;border-radius:8px}
.release-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:13px 0}.release-stats span{display:block;font-size:9px;color:#7b8a67}.release-stats strong{display:block;font:25px var(--serif,Georgia,serif);color:#3a5630;margin:5px 0}
.extrapolation{font-size:10px;line-height:1.8;color:#80603b;border-top:1px solid #d8dfca;padding-top:12px;margin-top:10px}.scope{font-size:10px;color:#738465;margin-top:13px;line-height:1.8}
.preview{background:#14372a;border-radius:8px;padding:13px 14px;color:#d4dfc4;min-width:0}.preview p{font-size:10px}.chart{margin-top:10px}.chart svg{display:block;width:100%;height:auto}.legend{display:flex;gap:6px 11px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:#c5d3b4}.legend span{display:flex;gap:5px;align-items:center;overflow-wrap:anywhere}.legend i{width:13px;border-top:2px solid;flex-shrink:0}
.export{margin-top:18px;padding-top:17px;border-top:1px solid #dfe5d4;display:flex;gap:16px;align-items:center;justify-content:space-between}.export .small{max-width:460px;font-size:10px}.export button{flex-shrink:0}
@media(max-width:1000px){.heading{flex-wrap:wrap}.badge{max-width:none}.release{grid-template-columns:1fr}.fields{grid-template-columns:1fr 1fr}.export{align-items:stretch;flex-direction:column}}
@media(max-width:450px){.heading{padding:20px 17px 15px}.body{padding:0 17px 20px}h2{font-size:27px}.fields{grid-template-columns:1fr}.actions{flex-direction:column;align-items:stretch}.actions .small{max-width:none}.release-card{padding:14px}.release-stats{gap:7px}.release-stats strong{font-size:22px}.intro,.fit{font-size:10px}th,td{padding:9px 5px;font-size:9px}.duration{font-size:18px}.table-wrap{margin-left:-3px;margin-right:-3px}}
`;

/**
 * plan(discovery, sharedDesign, durations) is the composed angular duration planner.
 * render receives training discovery and source labels only, never a challenge run.
 * Requests are transient until explicitly exported; the notebook owns evidence.
 */
export function createAngularRecordingPanel(host, {plan} = {}) {
  if (!(host instanceof Element) || typeof plan !== 'function') throw new TypeError('Provide a DOM host and an angular duration planner.');
  const shadow = host.attachShadow({mode: 'open'});
  // Fixed markup only. Source labels, model IDs and numeric values are inserted as text.
  shadow.innerHTML = `<style>${styles}</style><section class="panel" aria-labelledby="recording-title">
    <header class="heading"><div><p class="eyebrow">PLAN A RECORDING</p><h2 id="recording-title">Give the models room to disagree.</h2>
      <p class="intro">Choose release ranges and recording durations. Compare the current training models, then prepare a manual recording request when their predictions separate.</p></div>
      <p class="badge">Angular motion · inertia and absolute torque unknown</p></header>
    <div class="body"><p id="recording-context" class="context"></p><p id="recording-fit" class="fit"></p>
      <form id="recording-form" novalidate><fieldset id="recording-settings"><legend>Requested release ranges</legend>
        <p id="recording-domain" class="small"></p><div class="fields">
          <div class="pair"><label>Angle from<span>rad</span><input id="recording-position-min" type="number" step="any" required></label><label>Angle to<span>rad</span><input id="recording-position-max" type="number" step="any" required></label></div>
          <div class="pair"><label>Rate from<span>rad/s</span><input id="recording-rate-min" type="number" step="any" required></label><label>Rate to<span>rad/s</span><input id="recording-rate-max" type="number" step="any" required></label></div>
          <label>Compare durations<span>seconds · comma separated</span><input id="recording-durations" type="text" value="2, 4, 8" required></label>
        </div><details id="recording-advanced"><summary>Sampling, grid and numerical limits</summary><div class="fields">
          <label>Sampling interval<span>s · shared by all durations</span><input id="recording-interval" type="number" min="0.005" max="1" step="any" value="0.04" required></label>
          <label>Minimum model spread<span>rad · a requested threshold</span><input id="recording-threshold" type="number" min="0" step="any" value="0.01" required></label>
          <label>Maximum solver step<span>s · compared with half this step</span><input id="recording-step" type="number" min="0.0001" max="0.1" step="any" value="0.01" required></label>
          <label>Angle grid points<span>1–9</span><input id="recording-position-count" type="number" min="1" max="9" step="1" value="5" required></label>
          <label>Rate grid points<span>1–9</span><input id="recording-rate-count" type="number" min="1" max="9" step="1" value="3" required></label>
          <label>Maximum models<span>1–16 · training-ranked shortlist</span><input id="recording-model-count" type="number" min="1" max="16" step="1" value="8" required></label>
          <label>Predicted angle envelope<span>± rad · sampled timestamps only</span><input id="recording-angle-envelope" type="number" min="0.000001" step="any" value="3.2" required></label>
          <label>Predicted rate envelope<span>± rad/s · sampled timestamps only</span><input id="recording-rate-envelope" type="number" min="0.000001" step="any" value="8" required></label>
        </div><p class="small">Every considered model must complete a release’s prediction for that release to be eligible. The whole search reserves its budget before evaluation: at most 3,000,000 solver steps. The spread threshold is not calibrated sensor detection power.</p></details>
        <div class="actions"><button id="recording-plan" type="submit">Compare recording choices →</button><p class="small">These ranges are your declarations. Confirm the apparatus, angular reference and unforced-motion assumption when recording.</p></div>
      </fieldset></form>
      <div id="recording-error" class="error" role="alert" tabindex="-1" hidden></div>
      <div class="status" role="status" aria-live="polite" aria-atomic="true"><h3 id="recording-status-title">A new question starts with the training evidence.</h3><p id="recording-status-detail" class="small">The planner uses the fitted models. Challenge recordings do not select this request.</p></div>
      <div id="recording-results" hidden><div class="table-wrap"><table><caption>Original grid winner at each duration · numerical status shown separately</caption><thead><tr><th scope="col">Duration</th><th scope="col">RMS spread / rad</th><th scope="col">Decision</th><th scope="col">Step check</th></tr></thead><tbody id="recording-duration-rows"></tbody></table></div>
        <p id="recording-ensemble" class="scope"></p><p id="recording-budget" class="scope"></p>
        <div id="recording-release" class="release" hidden><div class="release-card"><h3>Requested starting conditions</h3><div class="release-stats"><div><span>Angle / rad</span><strong id="recording-target-position"></strong></div><div><span>Rate / rad/s</span><strong id="recording-target-rate"></strong></div><div><span>Duration / s</span><strong id="recording-target-duration"></strong></div></div><p class="small">Record the actual starting angle and an independently supplied or measured initial rate. Departures from these targets belong in the recording.</p><p id="recording-extrapolation" class="extrapolation"></p></div>
          <div class="preview"><p>Predicted angle / rad · no new observations</p><div id="recording-chart" class="chart"></div><div id="recording-legend" class="legend"></div></div></div>
        <p class="scope">A step-sensitivity check compares two numerical executions; it does not prove convergence. Model spread is a finite-ensemble heuristic. Longer recordings may increase separation, drift and cost. Missing dynamics and training mismatch remain possible.</p>
      </div>
      <div class="export"><p class="small">Export contains requested conditions and recording requirements. Collect a separate recording with its own source identity; forecasts are not observed evidence. Planning choices are transient and must be recomputed after a notebook is reopened.</p><button id="recording-export" class="secondary" type="button" disabled>Export recording request ↗</button></div>
    </div></section>`;
  const $ = id => shadow.getElementById(id);
  let sourceReference = null, discovery = null, sourceLabel = '', evidenceKind = '', epoch = 0;
  let externalBusy = false, planning = false, pending = null, disposed = false;
  const setStatus = (title, detail) => { $('recording-status-title').textContent = title; $('recording-status-detail').textContent = detail; };
  const controls = () => {
    $('recording-settings').disabled = !discovery || externalBusy || planning;
    $('recording-export').disabled = !pending || externalBusy || planning;
    $('recording-plan').textContent = planning ? 'Comparing the models…' : 'Compare recording choices →';
    shadow.querySelector('section').setAttribute('aria-busy', String(externalBusy || planning));
  };
  function invalidate(message = 'The requested conditions changed. Compare the choices again before exporting.') {
    epoch++; pending = null; planning = false;
    $('recording-results').hidden = true; $('recording-error').hidden = true;
    setStatus('Ready for a fresh comparison.', message); controls();
  }
  function readNumber(id) {
    const text = $(id).value.trim(), value = Number(text);
    if (!text || !Number.isFinite(value)) throw new Error('Complete every recording setting with a finite value.');
    return value;
  }
  function settings() {
    const durations = $('recording-durations').value.split(',').map(value => {
      if (!value.trim()) throw new Error('Separate each duration with a comma, without empty entries.');
      return Number(value.trim());
    });
    const angle = readNumber('recording-angle-envelope'), rate = readNumber('recording-rate-envelope');
    return {durations, design: {inertia: null, dynamics: 'unforced_scalar_rotation',
      bounds: {initialPosition: {min: readNumber('recording-position-min'), max: readNumber('recording-position-max')},
        initialRate: {min: readNumber('recording-rate-min'), max: readNumber('recording-rate-max')}},
      sampleInterval: readNumber('recording-interval'), minDisagreement: readNumber('recording-threshold'),
      maxStep: readNumber('recording-step'), positionCount: readNumber('recording-position-count'),
      rateCount: readNumber('recording-rate-count'), maxModels: readNumber('recording-model-count'),
      predictionBounds: {position: {min: -angle, max: angle}, rate: {min: -rate, max: rate}}}};
  }
  function drawForecast(selected) {
    const container = $('recording-chart'), legend = $('recording-legend'); container.replaceChildren(); legend.replaceChildren();
    const predictions = selected.predictions ?? [], all = predictions.flatMap(prediction => prediction.rows);
    if (!all.length) return;
    let low = Infinity, high = -Infinity;
    for (const row of all) {low = Math.min(low, row.position); high = Math.max(high, row.position);}
    const pad = Math.max(.03, (high - low) * .08); low -= pad; high += pad;
    const start = all[0].time, end = all.at(-1).time;
    const x = time => 49 + (time - start) / Math.max(Number.EPSILON, end - start) * 558;
    const y = position => 17 + (high - position) / (high - low) * 166;
    const svg = svgElement('svg', {viewBox: '0 0 630 218', role: 'img', 'aria-label': `Simulated angular predictions for ${predictions.length} considered training models over ${format(selected.duration)} seconds. No acquired observations.`});
    for (const value of [low, (low + high) / 2, high]) {
      svg.append(svgElement('line', {x1: 49, x2: 607, y1: y(value), y2: y(value), stroke: '#355340', 'stroke-dasharray': '3 5'}),
        svgElement('text', {x: 40, y: y(value) + 3, 'text-anchor': 'end', fill: '#9eb48a', 'font-size': 9}, format(value, 3)));
    }
    for (const time of [start, (start + end) / 2, end]) svg.append(svgElement('text', {x: x(time), y: 205, 'text-anchor': 'middle', fill: '#9eb48a', 'font-size': 9}, `${format(time - start, 3)} s`));
    for (const [index, prediction] of predictions.entries()) {
      const color = colors[index % colors.length];
      svg.append(svgElement('path', {d: prediction.rows.map((row, i) => `${i ? 'L' : 'M'}${x(row.time).toFixed(2)},${y(row.position).toFixed(2)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.7}));
      const label = element('span'), swatch = element('i'); swatch.style.borderColor = color;
      label.append(swatch, document.createTextNode(prediction.modelId)); legend.append(label);
    }
    container.append(svg);
  }
  function showResult(result, requestSettings) {
    const ready = result.status === 'proposed' && result.selectedPlan?.qualification?.selectedQualification?.status === 'screen_passed' &&
      result.recordingRequest?.schema === 'worldlaw.angular-recording-request/v1' &&
      result.recordingRequest.kind === 'requested_protocol_not_observed_evidence' && result.recordingRequest.inertia === null &&
      result.recordingRequest.acquisitionPerformed === false && result.recordingRequest.physicalSetupVerified === false;
    pending = ready ? structuredClone(result.recordingRequest) : null;
    $('recording-results').hidden = false;
    const rows = $('recording-duration-rows'); rows.replaceChildren();
    for (const row of result.durationResults) {
      const tr = element('tr'); if (ready && row.duration === result.selectedPlan.options.duration) tr.className = 'selected';
      tr.append(element('td', `${format(row.duration)} s`, 'duration'), element('td', format(row.disagreementRad), 'spread'), element('td', decisionLabel(row.status)));
      const screen = element('td', screenLabel(row.selectedScreenStatus));
      if (Number.isFinite(row.pairwiseSensitivityRad)) screen.append(element('small', `${format(row.pairwiseSensitivityRad)} rad sensitivity`));
      tr.append(screen); rows.append(tr);
    }
    const first = result.durationResults[0];
    $('recording-ensemble').textContent = `${first.consideredModelCount} training-ranked models considered; ${first.omittedCompetitiveCount} competitive alternatives omitted. ${first.evaluatedDesignCount + first.refusedDesignCount} distinct releases per duration from a requested ${requestSettings.design.positionCount} × ${requestSettings.design.rateCount} grid. Original ineligible or unresolved winners remain visible; no surviving subset is scored alone.`;
    $('recording-budget').textContent = `${format(result.diagnostics.actualReservedSteps, 7)} scheduled solver steps within a ${format(result.diagnostics.reservedUpperBound, 7)}-step complete-search reservation. Only each duration’s original grid winner is compared.`;
    $('recording-release').hidden = !ready;
    if (ready) {
      const selected = result.selectedPlan.selected;
      $('recording-target-position').textContent = format(selected.initialPosition);
      $('recording-target-rate').textContent = format(selected.initialRate);
      $('recording-target-duration').textContent = format(selected.duration);
      const check = selected.trainingRangeCheck, initial = check.initialFields.join(' and '), predicted = check.predictedFields?.join(' and ');
      $('recording-extrapolation').textContent = (initial ? `Requested ${initial} leaves the training range. ` : check.unknownFields.length ? 'Requested starting conditions have not been compared with a complete training range. ' : 'Requested starting conditions are within the recorded training ranges. ') +
        (predicted ? `Predicted ${predicted} also leaves those ranges. ` : '') +
        (check.unknownFields.length ? `Training ranges are unknown for ${check.unknownFields.join(' and ')}. ` : '') +
        'This range comparison does not establish physical feasibility or model validity.';
      drawForecast(selected);
      setStatus(`${format(selected.duration)} seconds gives the strongest screened separation.`,
        `${format(selected.disagreementRad)} rad RMS model spread, above the requested ${format(requestSettings.design.minDisagreement)} rad threshold. This is a proposed recording, with no new evidence acquired.`);
    } else {
      const detail = result.status === 'uninformative' ? `All eligible choices stay below the requested ${format(requestSettings.design.minDisagreement)} rad model spread. No recording request is available from this comparison.` :
        result.status === 'numerically_unresolved' ? 'A selected numerical comparison remains unresolved. No recording request is available; inspect the step checks and adjust the declared numerical settings.' :
          'Every release was refused under the declared numerical or sampled prediction limits. No recording request is available.';
      setStatus(decisionLabel(result.status), detail);
    }
    controls();
  }
  async function compare(event) {
    event.preventDefault(); if (!discovery || planning || externalBusy || disposed) return;
    invalidate(); const ticket = epoch, current = discovery;
    try {
      const requested = settings(); planning = true; controls();
      setStatus('Comparing the declared recording choices…', 'The current training models determine every prediction and the numerical screen.');
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (ticket !== epoch || disposed || externalBusy) return;
      const result = await plan(current, requested.design, requested.durations);
      if (ticket !== epoch || disposed || externalBusy) return;
      showResult(result, requested);
    } catch (error) {
      if (ticket !== epoch || disposed) return;
      pending = null; $('recording-results').hidden = true;
      $('recording-error').textContent = error?.cause?.message || error?.message || 'The complete comparison could not be performed.';
      $('recording-error').hidden = false; $('recording-error').focus();
      setStatus('The comparison was refused.', 'No partial result or recording request was retained. Review the requested ranges, durations and numerical limits.');
    } finally {if (ticket === epoch) {planning = false; controls();}}
  }
  function exportRequest() {
    if (!pending || planning || externalBusy || disposed) return;
    const blob = new Blob([JSON.stringify(pending, null, 2) + '\n'], {type: 'application/json'}), url = URL.createObjectURL(blob);
    const anchor = element('a'); anchor.href = url; anchor.download = 'worldlaw-angular-recording-request.json';
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
    setStatus('Recording request exported.', 'The file contains requested conditions and source-training identities. It contains no acquired samples and cannot substitute for a recorded run.');
  }
  const changed = () => invalidate();
  $('recording-form').addEventListener('input', changed);
  $('recording-form').addEventListener('submit', compare);
  $('recording-export').addEventListener('click', exportRequest);
  function render(view = {}) {
    if (disposed) return;
    const next = view.discovery?.schema === 'worldlaw.angular-discovery/v1' ? view.discovery : null;
    host.hidden = !next;
    const nextLabel = String(view.sourceLabel || 'Angular training recordings'), nextKind = String(view.evidenceKind || 'declared');
    if (next === sourceReference && nextLabel === sourceLabel && nextKind === evidenceKind) return;
    sourceReference = next; sourceLabel = nextLabel; evidenceKind = nextKind;
    discovery = next ? structuredClone(next) : null;
    invalidate('The training evidence or fit changed. A recording request must be recomputed from the current fitted models.');
    if (!discovery) return;
    $('recording-form').reset();
    const domain = discovery.selected?.domain || {};
    for (const [key, cap] of [['position', .3], ['rate', .2]]) {
      const range = domain[key], valid = Number.isFinite(range?.min) && Number.isFinite(range?.max) && range.min <= range.max;
      const low = valid ? Math.max(-cap, range.min) : -cap, high = valid ? Math.min(cap, range.max) : cap;
      $(`recording-${key}-min`).value = String(valid && low > high ? range.min : low);
      $(`recording-${key}-max`).value = String(valid && low > high ? range.max : high);
    }
    const rangeText = (key, units) => Number.isFinite(domain[key]?.min) && Number.isFinite(domain[key]?.max) ? `${format(domain[key].min)} to ${format(domain[key].max)} ${units}` : `unknown ${key} range`;
    $('recording-domain').textContent = `Training ranges: ${rangeText('position', 'rad')}; ${rangeText('rate', 'rad/s')}. Starting choices use known training ranges where available; review them before comparison.`;
    const context = `${discovery.trainingRuns.length} training runs · ${nextKind === 'synthetic' ? 'declared synthetic observations' : nextKind === 'measured' ? 'declared measured observations' : 'declared observations'}`;
    $('recording-context').textContent = `${sourceLabel} · ${context}`;
    const fit = discovery.diagnostics || {}, mismatch = fit.adequacy === 'residual_mismatch';
    $('recording-fit').classList.toggle('mismatch', mismatch);
    $('recording-fit').textContent = `${mismatch ? 'Training mismatch remains' : 'Training-fit check'}${Number.isFinite(fit.trainingRmseInNoiseUnits) ? `: ${format(fit.trainingRmseInNoiseUnits, 3)}× the assumed noise` : ': adequacy is not quantified'}. ` +
      (mismatch ? 'Numerical screening does not repair this mismatch. A proposed release may expose missing dynamics.' : 'Model disagreement and a passed step check do not establish that the physical model is correct.');
    controls();
  }
  function setBusy(value) {
    const next = Boolean(value); if (next && !externalBusy) invalidate('The source or fit is being updated. Recompute recording choices after it finishes.');
    externalBusy = next; controls();
  }
  controls(); host.hidden = true;
  return {render, setBusy, invalidate, destroy() {disposed = true; epoch++; pending = null; discovery = null;
    $('recording-form').removeEventListener('input', changed); $('recording-form').removeEventListener('submit', compare);
    $('recording-export').removeEventListener('click', exportRequest); shadow.replaceChildren();}};
}
