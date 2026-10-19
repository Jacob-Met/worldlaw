/**
 * View-only next-run workbench. Science and evidence mutations belong to the
 * injected controller; this module never fits, fabricates or acquires data.
 *
 * createExperimentPanel(host, {onPlan, onAcquire, onApplyEvidence, onLoadExample}) returns
 * {render, destroy}. Callbacks may return a new view or let the controller call
 * render. The view contract is deliberately separate from session persistence:
 * {
 *   contextKey, available, unavailableReason, instrument: {label, kind},
 *   settings: {bounds:{initialPosition:{min,max},initialRate:{min,max}},duration},
 *   plan: trajectory-plan/v1,
 *   acquisition: {id,run},
 *   comparison: {evaluationRunId,evaluationLabel,evaluationRun,before,after},
 *   numericalQualification, acquisitionAllowed, notice,error
 * }
 * Comparison snapshots contain {modelId,equation,trainingRunCount,
 * trainingSampleCount,status,positionRMSE,rows:[{time,observed,predicted}]}.
 * A controller must bind acquisition and comparison to the plan/context that
 * produced them, and must preserve an unchanged evaluation run across revision.
 */

const DEFAULT_SETTINGS = Object.freeze({
  bounds: {initialPosition: {min: -1.6, max: 1.6}, initialRate: {min: 0, max: 0}},
  duration: 8,
  maxStep: .01,
  minDisagreement: .01,
});
const COLORS = ['#d4ed87', '#e1b78f', '#9fc9c1', '#d6b6d7', '#c8ceab', '#a8b9df', '#e3d18d', '#c7c0b7'];
const BASIS_LABELS = {command: 'command', rate: 'ω', spring: 'θ', gravity: 'sin θ', coulomb: 'sign ω', quadratic: 'ω|ω|', bias: 'constant'};
const modelLabel = id => String(id).split('+').map(term => BASIS_LABELS[term] || term).join(' + ');
const format = (value, digits = 4) => !Number.isFinite(value) ? '—' :
  Math.abs(value) > 0 && Math.abs(value) < .0001 ? value.toExponential(2) :
    Number(value.toPrecision(digits)).toLocaleString('en-US', {maximumFractionDigits: 6});
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const svgElement = (tag, attributes = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};

const styles = `
:host{display:block;color:var(--ink,#213a30);font:14px/1.5 var(--sans,Arial,sans-serif)}
*{box-sizing:border-box}[hidden]{display:none!important}h2,h3,p{margin:0}button,input{font:inherit}
button{cursor:pointer}button:disabled,input:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #95ad5d;outline-offset:3px}
.panel{border:1px solid #d9dfcf;border-radius:13px;background:#fffefa;overflow:hidden}
.heading{padding:23px 24px 18px;display:flex;gap:20px;justify-content:space-between;align-items:start}
.eyebrow{font-size:9px;letter-spacing:.12em;color:#738263;font-weight:650;margin-bottom:7px}
h2{font:400 30px/1.15 var(--serif,Georgia,serif);letter-spacing:-.7px}h3{font-size:14px;font-weight:600}
.intro{font-size:11px;color:#687665;max-width:540px;margin-top:10px;line-height:1.8}
.instrument{font-size:9px;color:#5b7045;background:#edf2e1;border:1px solid #d6e1c4;border-radius:5px;padding:7px 9px;max-width:190px;line-height:1.6}
.message{margin:0 24px 16px;font-size:11px;line-height:1.7;padding:10px 12px;border-radius:6px;background:#edf2e2;color:#526741}
.message.error{background:#fff0e7;color:#8a4633;border:1px solid #dfbcab}
.example-action{margin:0 24px 21px}
.body{padding:0 24px 23px}.controls{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:17px}
button{min-height:41px;border:1px solid #c9d9ab;border-radius:6px;padding:10px 15px;font-size:11px;font-weight:600;background:#d4ed87;color:#213f2b}
button.secondary{background:#fffefa;border-color:#c9d4bc}button:hover:not(:disabled){filter:brightness(.97)}
details{font-size:10px;color:#68795a}summary{cursor:pointer;line-height:1.8}details[open] summary{margin-bottom:10px}
.settings{margin-bottom:18px;border:1px solid #dfe4d5;border-radius:7px;padding:10px 13px;background:#fafbf5}
.settings-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
label{display:block;font-size:9px;color:#68785b}label span{display:block;font-size:8px;color:#86937a;margin-bottom:4px}
input{width:100%;min-width:0;border:1px solid #d6dfc9;border-radius:5px;background:#fffefa;min-height:37px;padding:7px 8px;color:#304b30;font:11px var(--mono,monospace)}
.small{font-size:10px;line-height:1.8;color:#6e7f5d}.settings .small{margin-top:9px}
.numerical-screen{display:flex;gap:16px;justify-content:space-between;align-items:start;margin:0 0 18px;padding:13px 15px;border:1px solid #cfddba;border-radius:7px;background:#f2f6e9}.numerical-screen.blocked{background:#fff6ec;border-color:#e4c9aa}.numerical-screen h3{font-size:12px;margin-bottom:5px}.screen-copy{max-width:590px}.screen-metric{flex:none;max-width:155px;text-align:right}.screen-metric strong{font:20px var(--serif,Georgia,serif);color:#415d32;display:block}.screen-metric span{font-size:8px;color:#71815e}.numerical-screen .footnote{margin-top:6px}
.design{display:grid;grid-template-columns:1.1fr 1fr;gap:18px;align-items:start}
.release{background:#f0f3e7;border:1px solid #dce4cf;border-radius:8px;padding:17px}
.release-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:15px 0 12px}
.stat span{display:block;font-size:8px;color:#6e7f5b}.stat strong{display:block;font:23px var(--serif,Georgia,serif);margin:4px 0;color:#344f2c}.stat small{display:block;font-size:8px;color:#859373}
.design-list{list-style:none;margin:12px 0 0;padding:0}.design-list li{display:flex;justify-content:space-between;gap:9px;border-top:1px solid #dbe4cd;padding:9px 0;font-size:9px;color:#60734e}.design-list strong{font-weight:600;white-space:nowrap}
.preview{background:#14372a;border-radius:8px;overflow:hidden;min-width:0}.preview-title{padding:13px 15px 0;font-size:10px;color:#e5ecda}.chart{min-height:220px;overflow:hidden}.chart svg{display:block;width:100%;height:auto}.chart-empty{font-size:11px;line-height:1.8;padding:49px 20px;color:#bccba9;min-height:220px}
.legend{display:flex;flex-wrap:wrap;gap:6px 12px;padding:0 15px 13px}.legend span{display:flex;align-items:center;gap:6px;font-size:8px;color:#c5d3b4;overflow-wrap:anywhere}.legend i{width:15px;border-top:2px solid;flex:none}
.acquire{display:flex;align-items:center;justify-content:space-between;gap:17px;margin-top:18px;padding-top:17px;border-top:1px solid #e0e5d6}.acquire p{max-width:490px}.acquisition{border:1px solid #d9e3ca;border-radius:7px;background:#f5f8ed;padding:13px 15px;margin-top:15px}.acquisition strong{font-size:11px;font-weight:600}.acquisition p{margin-top:5px}
.revision{margin-top:20px;border-top:1px solid #dde4d2;padding-top:18px}.revision-heading{display:flex;align-items:start;justify-content:space-between;gap:15px;margin-bottom:13px}
.revision-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}.revision-card{border:1px solid #dde5d2;border-radius:7px;padding:14px 16px;background:#fafbf5}.revision-card.after{background:#edf3df;border-color:#cdddb6}
.revision-card .equation{font:18px/1.5 var(--serif,Georgia,serif);overflow-wrap:anywhere;margin:7px 0}.revision-card .score{font-size:12px;font-weight:600;color:#476037;margin-top:7px}.revision-card .small{font-size:9px}
.revision-preview{margin-top:13px}.footnote{font-size:9px;color:#839172;line-height:1.8;margin-top:12px}
@media(max-width:900px){.design{grid-template-columns:1fr}.settings-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.heading{flex-wrap:wrap;gap:11px}.instrument{max-width:none}.chart{min-height:200px}}
@media(max-width:420px){.heading{padding:20px 17px 15px}.body{padding:0 17px 19px}.message{margin-left:17px;margin-right:17px}h2{font-size:27px}.controls,.acquire,.revision-heading,.numerical-screen{align-items:stretch;flex-direction:column;gap:10px}.screen-metric{text-align:left;max-width:none}.settings-grid{grid-template-columns:1fr 1fr}.release{padding:15px}.release-stats{gap:9px}.stat strong{font-size:21px}.stat span{font-size:7px}.revision-cards{grid-template-columns:1fr}.intro{font-size:10px}.chart-empty{padding:34px 16px}.design-list li{font-size:8px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;

export function createExperimentPanel(host, callbacks = {}) {
  if (!(host instanceof Element)) throw new TypeError('The experiment panel needs a DOM host.');
  const shadow = host.attachShadow({mode: 'open'});
  // Only this fixed template uses HTML. Scientific data is inserted as text or
  // explicit SVG attributes below; imported labels never become markup.
  shadow.innerHTML = `<style>${styles}</style><section class="panel" aria-labelledby="title">
    <div class="heading"><div><p class="eyebrow">PLAN THE NEXT RUN</p><h2 id="title">Ask a more revealing question.</h2><p class="intro">Find a release where the plausible laws predict different motion. Acquire a separate virtual recording, then inspect what the new evidence changes.</p></div><div id="instrument" class="instrument"></div></div>
    <p id="message" class="message" role="status" aria-live="polite" hidden></p>
    <button id="open-example" class="secondary example-action" type="button" hidden>Open small-angle example ↗</button>
    <div class="body"><details class="settings"><summary>Release limits and observation time</summary><div class="settings-grid">
      <label for="position-min">Minimum angle<span>rad</span><input id="position-min" type="number" step="0.1" inputmode="decimal"></label>
      <label for="position-max">Maximum angle<span>rad</span><input id="position-max" type="number" step="0.1" inputmode="decimal"></label>
      <label for="rate-min">Minimum rate<span>rad/s</span><input id="rate-min" type="number" step="0.1" inputmode="decimal"></label>
      <label for="rate-max">Maximum rate<span>rad/s</span><input id="rate-max" type="number" step="0.1" inputmode="decimal"></label>
      <label for="duration">Observation time<span>s</span><input id="duration" type="number" min="0.01" step="0.4" inputmode="decimal"></label>
      <label for="solver-step">Maximum solver step<span>s</span><input id="solver-step" type="number" min="0.0001" max="0.1" step="0.001" inputmode="decimal"></label>
      <label for="minimum-spread">Minimum model spread<span>rad · proposal threshold</span><input id="minimum-spread" type="number" min="0" step="0.01" inputmode="decimal"></label>
      </div><p class="small">The planner compares executable forecasts from the training-compatible models within these limits.</p></details>
      <div class="controls"><p id="plan-status" class="small">No future recording has been acquired.</p><button id="plan" type="button">Plan a release →</button></div>
      <section id="numerical-screen" class="numerical-screen" aria-labelledby="screen-heading" hidden><div class="screen-copy"><p class="eyebrow">SOLVER-STEP CHECK</p><h3 id="screen-heading"></h3><p id="screen-detail" class="small"></p><p class="footnote">A sensitivity check at sampled times; not an error bound or physical validation.</p></div><div id="screen-metric" class="screen-metric"><strong id="screen-sensitivity"></strong><span>rad · two-step score sensitivity</span></div></section>
      <div id="design" class="design"><div class="release"><p class="eyebrow">RECOMMENDED RELEASE</p><h3 id="release-heading">Let the models suggest a test.</h3><div id="release-stats" class="release-stats" hidden><div class="stat"><span>Initial angle</span><strong id="release-angle"></strong><small>rad</small></div><div class="stat"><span>Initial rate</span><strong id="release-rate"></strong><small>rad/s</small></div><div class="stat"><span>Model disagreement</span><strong id="disagreement"></strong><small>rad · pairwise RMS</small></div></div><p id="design-meaning" class="small">A proposal uses competing predictions. It contains no future observation.</p><ol id="design-list" class="design-list"></ol></div>
      <div class="preview"><p id="preview-title" class="preview-title">Predicted motion at the proposed release</p><div id="preview-chart" class="chart"></div><div id="preview-legend" class="legend"></div></div></div>
      <div id="acquire-controls" class="acquire"><p id="acquire-description" class="small">The virtual instrument generates a separate synthetic recording from its own fixed dynamics.</p><button id="acquire" type="button" class="secondary" disabled>Acquire virtual run ↗</button></div>
      <div id="acquisition" class="acquisition" hidden><strong id="acquisition-heading"></strong><p id="acquisition-detail" class="small"></p><div class="acquire"><p class="small">Add this recording to the training evidence, then compare the revised law on the existing evaluation run.</p><button id="apply" type="button" disabled>Learn from this run →</button></div></div>
      <section id="revision" class="revision" aria-labelledby="revision-title" hidden><div class="revision-heading"><div><p class="eyebrow">WHAT THE NEW EVIDENCE CHANGED</p><h3 id="revision-title">Same evaluation run. Revised explanation.</h3></div><p id="evaluation-label" class="small"></p></div><div id="revision-cards" class="revision-cards"></div><div class="preview revision-preview"><p class="preview-title">Observed motion and predictions before and after learning</p><div id="revision-chart" class="chart"></div><div id="revision-legend" class="legend"></div></div><p class="footnote">This comparison reuses an existing evaluation recording. It is exploratory evidence, not a fresh blind validation.</p></section>
      <p class="footnote">Model disagreement is a design score, not an error bound. A virtual recording is synthetic evidence and does not establish performance on physical hardware.</p>
    </div></section>`;
  const $ = id => shadow.getElementById(id);
  let view = {available: false}, pending = null, generation = 0, destroyed = false;
  let settings = structuredClone(DEFAULT_SETTINGS);

  function readSettings() {
    const read = id => {
      const raw = $(id).value.trim(), value = Number(raw);
      if (!raw || !Number.isFinite(value)) throw new Error('Enter finite release limits and observation time.');
      return value;
    };
    const next = {...structuredClone(settings), bounds: {initialPosition: {min: read('position-min'), max: read('position-max')}, initialRate: {min: read('rate-min'), max: read('rate-max')}}, duration: read('duration'), maxStep: read('solver-step'), minDisagreement: read('minimum-spread')};
    if (next.bounds.initialPosition.min > next.bounds.initialPosition.max || next.bounds.initialRate.min > next.bounds.initialRate.max) throw new Error('Each minimum must be at most its maximum.');
    if (next.duration <= 0) throw new Error('Observation time must be greater than zero.');
    return next;
  }

  function chart(id, legendId, series, description, emptyText = 'Plan a release to compare the models’ predicted motion.') {
    const container = $(id), legend = $(legendId);
    container.replaceChildren(); legend.replaceChildren();
    const valid = series.map(item => ({...item, rows: (item.rows || []).filter(row => Number.isFinite(row.time) && Number.isFinite(row.position))})).filter(item => item.rows.length > 1);
    if (!valid.length) {container.append(element('p', emptyText, 'chart-empty')); return;}
    const width = Math.max(245, Math.round(container.clientWidth)), height = width > 520 ? 260 : 220, left = 43, right = 15, top = 20, bottom = 35;
    let t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const item of valid) for (const row of item.rows) {t0 = Math.min(t0, row.time); t1 = Math.max(t1, row.time); y0 = Math.min(y0, row.position); y1 = Math.max(y1, row.position);}
    const padding = Math.max((y1 - y0) * .12, .03); y0 -= padding; y1 += padding;
    const x = value => left + (value - t0) / Math.max(t1 - t0, 1e-12) * (width - left - right);
    const y = value => height - bottom - (value - y0) / (y1 - y0) * (height - top - bottom);
    const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': description});
    svg.append(svgElement('title', {}, description));
    for (let i = 0; i <= 4; i++) {
      const t = t0 + (t1 - t0) * i / 4, angle = y0 + (y1 - y0) * i / 4;
      svg.append(svgElement('line', {x1: x(t), x2: x(t), y1: top, y2: height - bottom, stroke: '#4a6542', 'stroke-dasharray': '2 5', 'stroke-width': .7}), svgElement('line', {x1: left, x2: width - right, y1: y(angle), y2: y(angle), stroke: '#4a6542', 'stroke-dasharray': '2 5', 'stroke-width': .7}), svgElement('text', {x: x(t), y: height - bottom + 17, fill: '#b4c7a1', 'text-anchor': 'middle', 'font-size': 8}, format(t - t0, 3)), svgElement('text', {x: left - 7, y: y(angle) + 3, fill: '#b4c7a1', 'text-anchor': 'end', 'font-size': 8}, format(angle, 3)));
    }
    for (const item of valid) {
      const stride = Math.max(1, Math.ceil(item.rows.length / 1200)), rows = item.rows.filter((_, i) => i % stride === 0 || i === item.rows.length - 1);
      svg.append(svgElement('polyline', {points: rows.map(row => `${x(row.time).toFixed(2)},${y(row.position).toFixed(2)}`).join(' '), fill: 'none', stroke: item.color, 'stroke-width': item.observed ? 2.6 : 1.8, 'stroke-dasharray': item.observed ? 'none' : '6 4', 'stroke-linejoin': 'round', 'data-series': item.id}));
      const key = element('span'), swatch = element('i'); swatch.style.borderColor = item.color; key.append(swatch, document.createTextNode(item.label)); legend.append(key);
    }
    svg.append(svgElement('text', {x: left, y: 10, fill: '#b4c7a1', 'font-size': 8}, 'angle / rad'), svgElement('text', {x: width - right, y: height - 3, fill: '#b4c7a1', 'font-size': 8, 'text-anchor': 'end'}, 'elapsed time / s'));
    container.append(svg);
  }

  function renderCharts() {
    const predictions = view.plan?.selected?.predictions || [];
    const forecast = predictions.map((prediction, index) => ({id: prediction.modelId, label: prediction.label || modelLabel(prediction.modelId), color: COLORS[index % COLORS.length], rows: prediction.rows}));
    const run = view.acquisition?.run;
    if (run?.samples) forecast.push({id: 'acquired', label: 'Acquired synthetic recording', color: '#fffefa', observed: true, rows: run.samples});
    chart('preview-chart', 'preview-legend', forecast, run ? 'Model forecasts and an independently acquired synthetic recording at the proposed release.' : 'Model forecasts at the proposed release; no future observations.');
    if (view.comparison) {
      const comparison = view.comparison, observed = comparison.evaluationRun?.samples || [comparison.after?.rows, comparison.before?.rows].find(rows => rows?.length)?.map(row => ({time: row.time, position: row.observed})) || [];
      chart('revision-chart', 'revision-legend', [
        {id: 'evaluation-observed', label: 'Observed evaluation', color: '#fffefa', observed: true, rows: observed},
        ...[['before', '#dfb48c'], ['after', '#d4ed87']].map(([key, color]) => ({id: key, label: key === 'before' ? 'Before learning' : 'After learning', color, rows: (comparison[key]?.status === 'ok' ? comparison[key].rows || [] : []).map(row => ({time: row.time, position: row.predicted}))})),
      ], 'The same evaluation recording compared with model predictions before and after adding the acquired training evidence.', 'No completed prediction or evaluation samples are available for this comparison.');
    }
  }

  function paint() {
    if (destroyed) return;
    const plan = view.plan, selected = plan?.selected, run = view.acquisition?.run;
    shadow.querySelector('.body').hidden = !view.available;
    $('instrument').textContent = !view.available ? 'No compatible virtual instrument' : view.instrument?.label || 'Virtual instrument · synthetic evidence';
    const message = view.error || view.notice || (!view.available ? view.unavailableReason || 'Connect controlled evidence and a virtual instrument to plan the next run.' : '');
    $('message').hidden = !message; $('message').textContent = message; $('message').classList.toggle('error', Boolean(view.error)); $('message').setAttribute('role', view.error ? 'alert' : 'status');
    $('open-example').hidden = Boolean(view.available) || typeof callbacks.onLoadExample !== 'function'; $('open-example').disabled = Boolean(pending);
    $('plan').disabled = Boolean(pending) || Boolean(run) || !view.available || typeof callbacks.onPlan !== 'function';
    $('acquire').disabled = Boolean(pending) || !view.available || view.acquisitionAllowed === false || plan?.status !== 'proposed' || !selected || Boolean(run) || typeof callbacks.onAcquire !== 'function';
    $('apply').disabled = Boolean(pending) || !run || typeof callbacks.onApplyEvidence !== 'function';
    $('plan').textContent = pending === 'plan' ? 'Comparing releases…' : 'Plan a release →';
    $('acquire').textContent = pending === 'acquire' ? 'Acquiring virtual run…' : 'Acquire virtual run ↗';
    $('apply').textContent = pending === 'apply' ? 'Learning from new evidence…' : 'Learn from this run →';
    for (const input of shadow.querySelectorAll('input')) input.disabled = Boolean(pending) || Boolean(run) || !view.available;
    const consideredModels = plan?.diagnostics?.consideredModelCount ?? plan?.provenance?.modelIds?.length ?? selected?.predictions?.length ?? 0;
    const totalModels = plan?.diagnostics?.competitiveModelCount ?? consideredModels;
    $('plan-status').textContent = pending ? 'Working with the current training evidence…' : plan ? `${consideredModels} of ${totalModels} training-compatible models · ${plan.ranked?.length || 0} releases compared` : view.comparison ? 'New evidence applied. Review the change or plan another release.' : 'No future recording has been acquired.';
    $('design').hidden = Boolean(view.comparison) && !plan;
    $('acquire-controls').hidden = Boolean(view.comparison) && !plan;
    const qualification = view.numericalQualification, check = qualification?.selectedQualification;
    $('numerical-screen').hidden = !qualification;
    $('numerical-screen').dataset.status = qualification?.status || 'not_checked';
    $('numerical-screen').classList.toggle('blocked', ['numerically_unresolved', 'unavailable'].includes(qualification?.status));
    $('screen-heading').textContent = {screen_passed:'Numerical screen passed',numerically_unresolved:'Recommendation numerically unresolved',unavailable:'Numerical check unavailable',no_proposal:'No acquisition proposal to qualify'}[qualification?.status] || '';
    const reason = {proposal_threshold_sensitive:'The model disagreement sits too close to the proposal threshold at these step sizes.',step_sensitivity_exceeds_allowance:'The change between solver steps exceeds the numerical allowance.',not_all_models_compared:'At least one retained model could not complete both executions.',plan_prediction_mismatch:'The recomputed predictions did not reproduce the recorded plan score.'}[check?.reason];
    const steps = qualification?.diagnostics ? `Compared ${format(qualification.diagnostics.coarseMaxStep)} s and ${format(qualification.diagnostics.refinedMaxStep)} s steps across ${qualification.diagnostics.comparedModelCount} retained models.` : '';
    $('screen-detail').textContent = [qualification?.status === 'unavailable' ? qualification.error?.message : reason || steps, qualification?.status === 'numerically_unresolved' && steps ? steps : '', qualification?.status === 'screen_passed' ? 'The recommendation and ranking are unchanged.' : run && ['numerically_unresolved','unavailable'].includes(qualification?.status) ? 'Your existing recording is retained and can still be learned from.' : qualification?.status === 'numerically_unresolved' ? 'New acquisition is paused. Adjust the release settings and plan again.' : ''].filter(Boolean).join(' ');
    $('screen-metric').hidden = !Number.isFinite(check?.pairwiseSensitivityRad);
    $('screen-sensitivity').textContent = format(check?.pairwiseSensitivityRad);
    $('release-stats').hidden = !selected;
    $('release-heading').textContent = plan?.status === 'no_feasible_design' ? 'No executable release in these limits.' : plan?.status === 'uninformative' ? 'These models do not separate here.' : selected ? `Release and observe for ${format(selected.duration, 3)} s.` : 'Let the models suggest a test.';
    $('release-angle').textContent = format(selected?.initialPosition); $('release-rate').textContent = format(selected?.initialRate); $('disagreement').textContent = format(selected?.disagreementRad);
    $('design-meaning').textContent = plan?.status === 'no_feasible_design' ? 'Every candidate release was refused by a prediction or sampled prediction limit. Inspect the model scope or choose other limits.' : plan?.status === 'uninformative' ? `Compared model spread does not exceed the ${format(plan.options?.minDisagreement)} rad design threshold. Try a different release range.` : selected ? 'The chosen release maximizes pairwise position disagreement among the compared training-compatible models on this grid.' : 'A proposal uses competing predictions. It contains no future observation.';
    $('design-list').replaceChildren();
    for (const design of (plan?.ranked || []).slice(0, 3)) {const row = element('li'); row.append(element('span', `${format(design.initialPosition, 3)} rad · ${format(design.initialRate, 3)} rad/s`), element('strong', Number.isFinite(design.disagreementRad) ? `${format(design.disagreementRad, 3)} rad spread` : 'prediction refused')); $('design-list').append(row);}
    $('preview-title').textContent = run ? 'Forecasts meet a separate synthetic recording' : 'Predicted motion at the proposed release';
    $('acquisition').hidden = !run;
    $('acquisition-heading').textContent = run ? `Synthetic recording acquired · ${run.samples?.length || 0} samples` : '';
    $('acquisition-detail').textContent = run ? `${run.label || run.id}. Source ${run.source?.instrumentId || 'virtual instrument'}${Number.isFinite(run.source?.positionNoiseSigma) ? ` · position noise ${format(run.source.positionNoiseSigma)} rad` : ''}. The recording is retained independently of the candidate predictions.` : '';
    $('revision').hidden = !view.comparison;
    $('revision-cards').replaceChildren();
    if (view.comparison) {
      $('evaluation-label').textContent = view.comparison.evaluationLabel || view.comparison.evaluationRunId || 'Existing evaluation recording';
      for (const key of ['before', 'after']) {
        const snapshot = view.comparison[key] || {}, card = element('article', undefined, `revision-card ${key}`);
        const equation = (snapshot.equation || snapshot.modelId || 'Model unavailable').replaceAll(' + -', ' − ').replace(' = -', ' = −');
        card.append(element('p', key === 'before' ? 'BEFORE NEW EVIDENCE' : 'AFTER NEW EVIDENCE', 'eyebrow'), element('p', equation, 'equation'), element('p', `${snapshot.trainingRunCount ?? '—'} training runs · ${snapshot.trainingSampleCount ?? '—'} samples`, 'small'), element('p', snapshot.status === 'ok' && Number.isFinite(snapshot.positionRMSE) ? `${format(snapshot.positionRMSE)} rad RMSE` : 'Prediction unavailable', 'score'));
        $('revision-cards').append(card);
      }
    }
    renderCharts();
  }

  function render(nextView = {}) {
    if (destroyed) return;
    if (view.contextKey !== undefined && nextView.contextKey !== view.contextKey) {generation++; pending = null;}
    view = nextView;
    if (view.settings) settings = structuredClone(view.settings);
    for (const [id, value] of [['position-min', settings.bounds.initialPosition.min], ['position-max', settings.bounds.initialPosition.max], ['rate-min', settings.bounds.initialRate.min], ['rate-max', settings.bounds.initialRate.max], ['duration', settings.duration], ['solver-step', settings.maxStep ?? .01], ['minimum-spread', settings.minDisagreement ?? .01]]) $(id).value = value;
    paint();
  }

  async function act(kind, callback, payload) {
    if (pending || typeof callback !== 'function') return;
    const ticket = ++generation; pending = kind; view = {...view, error: undefined}; paint();
    try {const next = await callback(payload); if (destroyed || ticket !== generation) return; if (next) render(next);}
    catch (error) {if (!destroyed && ticket === generation) view = {...view, error: error?.message || String(error)};}
    finally {if (!destroyed && ticket === generation) {pending = null; paint();}}
  }
  $('plan').addEventListener('click', () => {
    try {settings = readSettings(); act('plan', callbacks.onPlan, structuredClone(settings));}
    catch (error) {view = {...view, error: error.message}; paint();}
  });
  $('acquire').addEventListener('click', () => act('acquire', callbacks.onAcquire, {contextKey: view.contextKey, plan: view.plan, proposal: view.plan?.selected}));
  $('apply').addEventListener('click', () => act('apply', callbacks.onApplyEvidence, {contextKey: view.contextKey, acquisitionId: view.acquisition?.id || view.acquisition?.run?.id}));
  $('open-example').addEventListener('click', () => act('example', callbacks.onLoadExample, {}));
  let frame;
  const observer = new ResizeObserver(() => {cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {if (!destroyed) renderCharts();});});
  observer.observe($('preview-chart')); observer.observe($('revision-chart'));
  render(view);
  return {render, destroy() {destroyed = true; generation++; observer.disconnect(); cancelAnimationFrame(frame); shadow.replaceChildren();}};
}
