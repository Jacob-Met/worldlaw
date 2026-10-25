import {residualStructure} from './residual-structure.mjs';
const element = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const fmt = x => Number.isFinite(x) ? Number(x.toPrecision(5)).toString() : 'undefined';
export function createResidualStructurePanel(anchor) {
  const host = element('section'); host.id = 'residual-structure-panel'; host.className = 'panel'; anchor.after(host);
  const style = element('style', '#residual-structure-panel{padding:20px;min-width:0}#residual-structure-panel[hidden]{display:none}#residual-structure-panel p{line-height:1.6}#residual-structure-panel label{display:grid;gap:8px;margin:14px 0}#residual-structure-panel input,#residual-structure-panel select,#residual-structure-panel button{min-height:42px;max-width:100%}#residual-structure-panel svg{width:100%;height:auto;display:block}#residual-structure-panel .residual-scroll{overflow:auto;max-height:360px}#residual-structure-panel table{border-collapse:collapse;width:100%}#residual-structure-panel td,#residual-structure-panel th{padding:8px;text-align:left;border-bottom:1px solid #aaa}');
  const title = element('h2', 'Does the prediction repeat its mistakes?');
  const intro = element('p', 'Inspect observed minus predicted angle at two original times. A diagonal cloud means errors persist; an opposite diagonal means errors alternate. Neither pattern identifies its physical cause. The law stays frozen.');
  const label = element('label', 'Sample lags (comma separated)');
  const input = element('input'); input.id = 'residual-lags'; input.value = '1,2,5,10'; label.append(input);
  const button = element('button', 'Inspect paired errors'); button.type = 'button'; button.className = 'button outline'; button.id = 'inspect-residual-structure';
  const status = element('p'); status.setAttribute('role', 'status'); status.id = 'residual-structure-status';
  const choiceLabel = element('label', 'Inspect one lag'); const choice = element('select'); choice.id = 'residual-lag-choice'; choiceLabel.append(choice);
  const plot = element('div');
  const details = element('details'); details.append(element('summary', 'Inspect every original paired sample'));
  const ledger = element('div'); ledger.className = 'residual-scroll'; details.append(ledger);
  const note = element('p', 'The imposed initial condition is excluded. All admitted pairs are shown; overlapping pairs are not independent evidence. Irregular sampling is retained as elapsed-time ranges. Centering removes constant bias only from the correlation, so inspect the mean error too. Changing lags after inspection is exploratory reuse.');
  host.append(style, title, intro, label, button, status, choiceLabel, plot, details, note);
  let rows = null, result = null;
  function clear(message) { result = null; plot.replaceChildren(); ledger.replaceChildren(); choice.replaceChildren(); choiceLabel.hidden = details.hidden = true; status.textContent = message; }
  function draw() {
    plot.replaceChildren(); ledger.replaceChildren(); if (!result) return;
    const report = result.reports[Number(choice.value)];
    const ns = 'http://www.w3.org/2000/svg';
    // Reserve an outer left gutter for signed endpoint text; original plot coordinates stay unchanged.
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '-60 0 580 400'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `All ${report.count} original residual pairs at sample lag ${report.lag}. Earlier error on horizontal axis, later error on vertical axis, radians.`);
    const add = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value); if (text !== undefined) n.textContent = text; svg.append(n); };
    const bound = Math.max(...report.pairs.flatMap(p => [Math.abs(p.earlier.residual), Math.abs(p.later.residual)])) || 1;
    const x = v => 70 + (v / bound + 1) * 205, y = v => 340 - (v / bound + 1) * 150;
    add('line', {x1:x(-bound), y1:y(0), x2:x(bound), y2:y(0), stroke:'#9aa8ad'});
    add('line', {x1:x(0), y1:y(-bound), x2:x(0), y2:y(bound), stroke:'#9aa8ad'});
    add('line', {x1:x(-bound), y1:y(-bound), x2:x(bound), y2:y(bound), stroke:'#b3bdc1', 'stroke-dasharray':'4 4'});
    for (const pair of report.pairs) add('circle', {cx:x(pair.earlier.residual), cy:y(pair.later.residual), r:2.5, fill:'#b85c26', opacity:.65});
    for (const [text, xx, yy, anchor] of [['Later error (rad)', 12, 18, 'start'], ['Earlier error (rad)', 480, 390, 'end'], [fmt(-bound), 70, 365, 'start'], [fmt(bound), 480, 365, 'end'], [fmt(bound), 65, 45, 'end'], [fmt(-bound), 65, 340, 'end']]) add('text', {x:xx,y:yy,'text-anchor':anchor,'font-size':13,fill:'#233f50'},text);
    plot.append(svg, element('p', `Lag ${report.lag}: ${report.count} pairs; actual separation ${fmt(report.elapsedMinimum)}–${fmt(report.elapsedMaximum)} s. Centered cosine ${fmt(report.correlation)}; squared difference / paired energy ${fmt(report.differenceRatio)}. ${report.status === 'no_centered_variation' ? 'No centered variation: correlation is undefined, not zero.' : ''}`));
    const table = element('table'), header = element('tr');
    for (const name of ['Earlier row','Later row','Earlier time (s)','Later time (s)','Earlier observed (rad)','Earlier predicted (rad)','Later observed (rad)','Later predicted (rad)','Earlier error (rad)','Later error (rad)']) { const th=element('th',name); th.scope='col'; header.append(th); } table.append(header);
    for (const p of report.pairs) { const tr=element('tr'); for(const value of [p.earlier.index,p.later.index,p.earlier.time,p.later.time,p.earlier.observed,p.earlier.predicted,p.later.observed,p.later.predicted,p.earlier.residual,p.later.residual])tr.append(element('td',String(value)));table.append(tr); } ledger.append(table);
  }
  input.addEventListener('input', () => clear('Lag declarations changed; previous diagnostic cleared.'));
  choice.addEventListener('change', draw);
  button.addEventListener('click', () => {
    clear('');
    try {
      result = residualStructure(rows, {lags: input.value.split(',').map(s => s.trim() === '' ? NaN : Number(s))});
      status.textContent = `${result.count} receiving samples; mean error ${fmt(result.meanError)} rad; RMSE ${fmt(result.rmse)} rad; centered RMS ${fmt(result.centeredRMS)} rad. ${result.pairCount} complete pairs. No model was fitted or selected.`;
      result.reports.forEach((r,i) => { const option=element('option',`Lag ${r.lag} · ${r.count} pairs`);option.value=String(i);choice.append(option); });
      choiceLabel.hidden=details.hidden=false;draw();
    } catch(error) { clear(error.message); }
  });
  return {render(nextRows) { rows = nextRows; clear('Choose sample lags to inspect the currently selected frozen prediction.');host.hidden=!Array.isArray(rows)||rows.length<4; }};
}
