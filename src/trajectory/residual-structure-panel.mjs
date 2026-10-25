import {createResidualEpochPanel} from './residual-epochs-panel.mjs';
import {residualStructure,physicalResidualStructure} from './residual-structure.mjs';
const element = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const fmt = x => Number.isFinite(x) ? Number(x.toPrecision(5)).toString() : 'undefined';
export function createResidualStructurePanel(anchor) {
  const host = element('section'); host.id = 'residual-structure-panel'; host.className = 'panel'; anchor.after(host);
  const style = element('style', '#residual-structure-panel{padding:20px;min-width:0}#residual-structure-panel[hidden],#residual-structure-panel [hidden]{display:none}#residual-structure-panel p{line-height:1.6}#residual-structure-panel label{display:grid;gap:8px;margin:14px 0}#residual-structure-panel input,#residual-structure-panel select,#residual-structure-panel button{min-height:42px;max-width:100%}#residual-structure-panel svg{width:100%;height:auto;display:block}#residual-structure-panel .residual-scroll{overflow:auto;max-height:360px}#residual-structure-panel table{border-collapse:collapse;width:100%}#residual-structure-panel td,#residual-structure-panel th{padding:8px;text-align:left;border-bottom:1px solid #aaa}');
  const title = element('h2', 'Does the prediction repeat its mistakes?');
  const intro = element('p', 'Inspect observed minus predicted angle at two original times. A diagonal cloud means errors persist; an opposite diagonal means errors alternate. Neither pattern identifies its physical cause. The law stays frozen.');
  const modeLabel=element('label','Pair selection');const mode=element('select');mode.id='residual-pair-mode';
  for(const [value,text] of [['samples','Sample-index lags'],['seconds','Physical-delay bands (seconds)']]){const option=element('option',text);option.value=value;mode.append(option);}modeLabel.append(mode);
  const bandsLabel=element('label','Closed delay bands in seconds (lower:upper, comma separated)');const bandsInput=element('input');bandsInput.id='residual-delay-bands';bandsInput.value='0.09:0.11,0.9:1.1';bandsLabel.append(bandsInput);bandsLabel.hidden=true;
  const label = element('label', 'Sample lags (comma separated)');
  const input = element('input'); input.id = 'residual-lags'; input.value = '1,2,5,10'; label.append(input);
  const button = element('button', 'Inspect paired errors'); button.type = 'button'; button.className = 'button outline'; button.id = 'inspect-residual-structure';
  const status = element('p'); status.setAttribute('role', 'status'); status.id = 'residual-structure-status';
  const choiceLabel = element('label', 'Inspect one lag'); const choice = element('select'); choice.id = 'residual-lag-choice'; choiceLabel.append(choice);
  const pageLabel=element('label','Original pair page (200 pairs per page)');const pairPage=element('select');pairPage.id='residual-pair-page';pageLabel.append(pairPage);const pageNote=element('p');pageNote.id='residual-pair-page-note';
  const plot = element('div');
  const details = element('details'); details.append(element('summary', 'Inspect every original paired sample'));
  const ledger = element('div'); ledger.className = 'residual-scroll'; details.append(ledger);
  const note = element('p', 'The imposed initial condition is excluded. All admitted pairs are shown; overlapping pairs are not independent evidence. Irregular sampling is retained as elapsed-time ranges. Physical-delay bands select original timestamp differences without interpolation. Bounds use supplied binary64 seconds; clock errors are not enclosed. Overlapping bands reuse pairs; empty and single-pair bands remain visible. Centering removes constant bias only from the correlation, so inspect the mean error too. Changing lags after inspection is exploratory reuse.');
  host.append(style, title, intro, modeLabel, label, bandsLabel, button, status, choiceLabel, pageLabel, pageNote, plot, details, note);
  const epochPanel=createResidualEpochPanel(host);
  let rows = null, result = null, pageIndex=0;
  function clear(message) { epochPanel.render(null,null);result = null; plot.replaceChildren(); ledger.replaceChildren(); choice.replaceChildren();pairPage.replaceChildren();pageNote.textContent='';pageIndex=0;pageLabel.hidden=true; choiceLabel.hidden = details.hidden = true; status.textContent = message; }
  function draw() {
    plot.replaceChildren(); ledger.replaceChildren(); if (!result) return;
    const report = result.reports[Number(choice.value)];
    const paginated=report.lag===undefined;const pageSize=200;const pages=Math.max(1,Math.ceil(report.count/pageSize));pageIndex=Math.min(pageIndex,pages-1);pageLabel.hidden=!paginated||pages===1;pairPage.replaceChildren();if(paginated)for(let i=0;i<pages;i++){const option=element('option',`${i+1} / ${pages}`);option.value=String(i);pairPage.append(option);}pairPage.value=String(pageIndex);
    const visiblePairs=paginated?report.pairs.slice(pageIndex*pageSize,(pageIndex+1)*pageSize):report.pairs;
    pageNote.textContent=paginated?`Showing original pairs ${report.count?pageIndex*pageSize+1:0}–${Math.min((pageIndex+1)*pageSize,report.count)} of ${report.count}. Scatter and ledger show this explicit page; all statistics and axis bounds use the complete cohort. Select any page to inspect every original pair.`:'';
    const pairLabel=report.lag===undefined?`${fmt(report.lowerSeconds)}–${fmt(report.upperSeconds)} s band`:`Lag ${report.lag}`;
    if(!report.count){plot.append(element('p',`${pairLabel}: no original receiving pairs lie in this declared closed band. No interpolation or empty correlation is supplied.`));return;}
    const ns = 'http://www.w3.org/2000/svg';
    // Reserve an outer left gutter for signed endpoint text; original plot coordinates stay unchanged.
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '-60 0 580 400'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${visiblePairs.length} displayed original residual pairs of ${report.count} in ${pairLabel}. Earlier error on horizontal axis, later error on vertical axis, radians.`);
    const add = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value); if (text !== undefined) n.textContent = text; svg.append(n); };
    const bound = report.pairs.reduce((bound,p)=>Math.max(bound,Math.abs(p.earlier.residual),Math.abs(p.later.residual)),0) || 1;
    const x = v => 70 + (v / bound + 1) * 205, y = v => 340 - (v / bound + 1) * 150;
    add('line', {x1:x(-bound), y1:y(0), x2:x(bound), y2:y(0), stroke:'#9aa8ad'});
    add('line', {x1:x(0), y1:y(-bound), x2:x(0), y2:y(bound), stroke:'#9aa8ad'});
    add('line', {x1:x(-bound), y1:y(-bound), x2:x(bound), y2:y(bound), stroke:'#b3bdc1', 'stroke-dasharray':'4 4'});
    for (const pair of visiblePairs) add('circle', {cx:x(pair.earlier.residual), cy:y(pair.later.residual), r:2.5, fill:'#b85c26', opacity:.65});
    for (const [text, xx, yy, anchor] of [['Later error (rad)', 12, 18, 'start'], ['Earlier error (rad)', 480, 390, 'end'], [fmt(-bound), 70, 365, 'start'], [fmt(bound), 480, 365, 'end'], [fmt(bound), 65, 45, 'end'], [fmt(-bound), 65, 340, 'end']]) add('text', {x:xx,y:yy,'text-anchor':anchor,'font-size':13,fill:'#233f50'},text);
    plot.append(svg, element('p', `${pairLabel}: ${report.count} pairs; actual separation ${fmt(report.elapsedMinimum)}–${fmt(report.elapsedMaximum)} s. Centered cosine ${fmt(report.correlation)}; squared difference / paired energy ${fmt(report.differenceRatio)}. ${report.status === 'no_centered_variation' ? 'No centered variation: correlation is undefined, not zero.' : report.status==='single_pair'?'Only one pair: correlation is undefined.':''}`));
    const table = element('table'), header = element('tr');
    for (const name of ['Earlier row','Later row','Earlier time (s)','Later time (s)','Earlier observed (rad)','Earlier predicted (rad)','Later observed (rad)','Later predicted (rad)','Earlier error (rad)','Later error (rad)']) { const th=element('th',name); th.scope='col'; header.append(th); } table.append(header);
    for (const p of visiblePairs) { const tr=element('tr'); for(const value of [p.earlier.index,p.later.index,p.earlier.time,p.later.time,p.earlier.observed,p.earlier.predicted,p.later.observed,p.later.predicted,p.earlier.residual,p.later.residual])tr.append(element('td',String(value)));table.append(tr); } ledger.append(table);
  }
  mode.addEventListener('change',()=>{label.hidden=mode.value!=='samples';bandsLabel.hidden=mode.value!=='seconds';clear('Pair selection changed; previous diagnostic cleared.');});
  bandsInput.addEventListener('input',()=>clear('Delay bands changed; previous diagnostic cleared.'));
  input.addEventListener('input', () => clear('Lag declarations changed; previous diagnostic cleared.'));
  choice.addEventListener('change',()=>{pageIndex=0;draw();});
  pairPage.addEventListener('change',()=>{pageIndex=Number(pairPage.value);draw();});
  button.addEventListener('click', () => {
    clear('');
    try {
      result = mode.value==='samples'?residualStructure(rows, {lags: input.value.split(',').map(s => s.trim() === '' ? NaN : Number(s))}):physicalResidualStructure(rows,{bands:bandsInput.value.split(',').map(part=>{const fields=part.split(':');if(fields.length!==2||fields.some(x=>!x.trim()))throw new Error('Use lower:upper for every closed seconds band.');return {lowerSeconds:Number(fields[0]),upperSeconds:Number(fields[1])};})});
      status.textContent = `${result.count} receiving samples; mean error ${fmt(result.meanError)} rad; RMSE ${fmt(result.rmse)} rad; centered RMS ${fmt(result.centeredRMS)} rad. ${result.pairCount} complete pairs. No model was fitted or selected.`;
      result.reports.forEach((r,i) => { const option=element('option',`${r.lag===undefined?fmt(r.lowerSeconds)+'–'+fmt(r.upperSeconds)+' s':'Lag '+r.lag} · ${r.count} pairs`);option.value=String(i);choice.append(option); });
      choiceLabel.hidden=details.hidden=false;draw();if(mode.value==='seconds')epochPanel.render(rows,result.reports.map(r=>({lowerSeconds:r.lowerSeconds,upperSeconds:r.upperSeconds})));
    } catch(error) { clear(error.message); }
  });
  return {render(nextRows) { rows = nextRows; clear('Choose sample lags to inspect the currently selected frozen prediction.');host.hidden=!Array.isArray(rows)||rows.length<4; }};
}
