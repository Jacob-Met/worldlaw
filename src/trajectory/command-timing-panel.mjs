/** Command and motion on the same retained observation clock. */
import {compareCommandTiming, exportCommandTimingInputs, restoreCommandTimingInputs} from './command-timing-study.mjs';
import {prepareCommandTimeline,commandAtSegment} from './command-timeline.mjs';
import {MAX_TEXT_LENGTH} from './data.mjs';

const node = (tag, text) => {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e;};
const fmt = x => Number.isFinite(x) ? (Math.abs(x) > 0 && Math.abs(x) < .001 ? x.toExponential(3) : Number(x.toPrecision(5)).toString()) : 'unavailable';
const svgNode = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const candidateKey=(candidate,joint)=>joint?`${candidate.delaySeconds}:${candidate.responseTimeSeconds??0}`:String(candidate.delaySeconds);

export function createCommandTimingPanel(anchor, {onExample,onResponseExample, onReopen} = {}) {
  const host = node('section'); host.id = 'command-timing-panel'; host.className = 'panel'; anchor.after(host);
  const style = node('style'); style.textContent = `
    #command-timing-panel{border-top:3px solid #136f89;padding:clamp(14px,2vw,28px);min-width:0;margin-top:24px}
    #command-timing-panel h2{font-size:clamp(20px,2.3vw,29px);margin:0 0 12px;letter-spacing:-.025em}
    #command-timing-panel p{line-height:1.65;max-width:100ch;overflow-wrap:anywhere}
    #command-timing-panel .timing-controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:18px 0}
    #command-timing-panel label{display:grid;gap:7px;font-size:12px;line-height:1.5;min-width:0}
    #command-timing-panel input,#command-timing-panel select{width:100%;min-width:0;box-sizing:border-box;padding:9px;font:inherit}
    #command-timing-panel .timing-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
    #command-timing-panel button{white-space:normal;line-height:1.5;max-width:100%;padding:9px 13px}
    #command-timing-panel :focus-visible{outline:3px solid #136f89;outline-offset:3px}
    #command-timing-status{border-left:3px solid #136f89;padding:10px 14px;background:#edf5f8}
    #command-timing-chart{min-width:0;margin-top:18px;background:#fbfdff;border:1px solid #b9cfd5}
    #command-timing-chart:empty{display:none}#command-timing-chart svg{display:block;width:100%;height:auto}
    #command-timing-panel .timing-table-wrap{overflow-x:auto;max-width:100%;margin:18px 0}
    #command-timing-panel table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.5}
    #command-timing-panel th,#command-timing-panel td{text-align:left;vertical-align:top;padding:10px 8px;border-bottom:1px solid #d3e0e3}
    #command-timing-panel .timing-selected{background:#edf5f8}#command-timing-panel .timing-legend{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:12px}
    #command-timing-panel .timing-legend span{border-bottom:3px solid;padding-bottom:4px}
    #command-timing-panel [hidden]{display:none!important}
    @media(max-width:700px){#command-timing-panel .timing-controls{grid-template-columns:1fr}#command-timing-panel th,#command-timing-panel td{padding:9px 5px}#command-timing-panel table{font-size:11px}}
  `;
  const title = node('h2', 'How does the command reach the mechanism?');
  const intro = node('p', 'Keep every recorded angle in place. Compare a late command with a gradual response, learn each explanation from training motion, then watch it face the separate recording. A better prediction still does not identify the physical cause.');
  const sourceLabel = node('p'); sourceLabel.id = 'command-timing-source';
  const controls = node('div'); controls.className = 'timing-controls';
  function input(label, id, initial, type = 'number') {const wrap = node('label', label), field = node('input'); field.id = id; field.type = type; field.value = initial; if (type === 'number') field.step = 'any'; wrap.append(field); controls.append(wrap); return field;}
  const delays = input('Offered delays in seconds (include zero; comma separated)', 'command-timing-delays', '0, 0.05, 0.1, 0.15, 0.2', 'text');
  const responseTimes=input('Offered response times in seconds (zero means no gradual response)', 'command-timing-response', '0','text');
  const before = input('Pre-recording command / initial applied equilibrium for EVERY run (N·m)', 'command-timing-before', '');
  const noise = input('Assumed position noise (rad)', 'command-timing-noise', '.001');
  const library = input('Offered terms', 'command-timing-terms', 'command, rate, spring, bias', 'text');
  const step = input('Maximum solver step (s)', 'command-timing-step', '.01');
  const budget = input('Complete study RK4 step budget', 'command-timing-budget', '500000');
  const maxTerms = input('Maximum fitted terms', 'command-timing-max-terms', '4');
  const ambiguity = input('Heuristic ambiguity score difference', 'command-timing-ambiguity', '6');
  const actions = node('div'); actions.className = 'timing-actions';
  function button(id, label, handler) {const b = node('button', label); b.id = id; b.type = 'button'; b.className = 'button outline'; b.addEventListener('click', handler); actions.append(b); return b;}
  const runButton = button('command-timing-run', 'Compare the offered delays', execute);
  button('command-timing-example', 'Load the controlled delayed oscillator', () => onExample?.());
  button('command-response-example','Load the controlled gradual-response oscillator',()=>onResponseExample?.());
  const save = button('command-timing-save', 'Save timing inputs', () => {if (!report) return; const a = node('a'), url = URL.createObjectURL(new Blob([exportCommandTimingInputs(report)], {type: 'application/json'})); a.href = url; a.download = report.options.responseTimes?'worldlaw-command-response.json':'worldlaw-command-timing.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}); save.hidden = true;
  const file = node('input'); file.type = 'file'; file.accept = '.json,application/json'; file.id = 'command-timing-file'; file.hidden = true;
  button('command-timing-open', 'Reopen timing inputs', () => file.click());
  const status = node('p', 'Supply the known pre-recording command before comparing.'); status.id = 'command-timing-status'; status.setAttribute('role', 'status');
  const result = node('div'); result.id = 'command-timing-result'; result.hidden = true;
  const selectors = node('div'); selectors.className = 'timing-controls';
  function select(label, id, choices = []) {const wrap = node('label', label), field = node('select'); field.id = id; for (const [value, text] of choices) {const o = node('option', text); o.value = value; field.append(o);} wrap.append(field); selectors.append(wrap); return field;}
  const candidateSelect = select('Inspect a fitted delay', 'command-timing-candidate');
  const runSelect = select('Separate recording', 'command-timing-recording');
  const view = select('Instrument view', 'command-timing-view', [['response', 'Command and motion'], ['profile', 'Whole delay comparison']]);
  const legend = node('div'); legend.className = 'timing-legend';
  for (const [text, color] of [['Recorded angle / command', '#174858'], ['Inspected response prediction / command', '#a24915'], ['Zero-delay prediction', '#7d7e8c']]) {const key = node('span', text); key.style.color = color; key.style.borderColor = color; legend.append(key);}
  const chart = node('div'); chart.id = 'command-timing-chart';
  const detail = node('p'); detail.id = 'command-timing-detail';
  const tableHost = node('div'); tableHost.className = 'timing-table-wrap'; tableHost.tabIndex = 0; tableHost.setAttribute('aria-label', 'Complete offered delay comparison');
  const limits = node('p'); limits.id = 'command-timing-limits';
  result.append(selectors, legend, chart, detail, tableHost, limits);
  const initialAssumption=node('p','A positive response time assumes first-order command response, initially at equilibrium with the declared pre-recording command. That initial state is a declaration, not inferred from the recorded angles.');
  host.append(style, title, intro, sourceLabel,initialAssumption, controls, actions, file, status, result);
  let bundle = null, report = null, revision = 0, userEdits = 0, lastWidth = 0;
  function retire(message = 'Inputs changed. Recompute; the previous comparison has been cleared.') {revision++; report = null; chart.replaceChildren(); result.hidden = true; save.hidden = true; runButton.disabled = !bundle; status.textContent = message;}
  for (const field of [delays,responseTimes, before, noise, library, step, budget, maxTerms, ambiguity]) field.addEventListener('input', () => {userEdits++;retire();});
  for (const field of [candidateSelect, runSelect, view]) field.addEventListener('change', draw);
  function settings() {
    for (const field of [delays,responseTimes, before, noise, library, step, budget, maxTerms, ambiguity]) if (!field.value.trim()) throw Error('Every command-study input, including the pre-recording command, must be explicitly filled.');
    const responses=responseTimes.value.split(',').map(s=>{if(!s.trim())throw Error('No empty response-time entries are allowed.');return Number(s.trim());});
    return {delays: delays.value.split(',').map(s => {if (!s.trim()) throw Error('No empty delay entries are allowed.'); return Number(s.trim());}),
      ...(responses.length===1&&responses[0]===0?{}:{responseTimes:responses}),
      beforeStart: Number(before.value), noiseSigma: Number(noise.value), terms: library.value.split(',').map(s => s.trim()), maxStep: Number(step.value), maxTotalSteps: Number(budget.value), maxTerms: Number(maxTerms.value), ambiguityDelta: Number(ambiguity.value)};
  }
  function configure(options) {retire(); delays.value = options.delays.join(', ');responseTimes.value=(options.responseTimes??[0]).join(', '); before.value = String(options.beforeStart); noise.value = String(options.noiseSigma ?? .001); library.value = (options.terms ?? ['command', 'rate', 'spring', 'bias']).join(', '); step.value = String(options.maxStep ?? .01); budget.value = String(options.maxTotalSteps ?? 500000);maxTerms.value=String(options.maxTerms??(options.terms?.length||4));ambiguity.value=String(options.ambiguityDelta??6);}
  async function execute() {
    retire(); const mine = revision; runButton.disabled = true; status.textContent = 'Comparing the complete declared family…';
    await new Promise(requestAnimationFrame); if (mine !== revision) return;
    try {if (!bundle) throw Error('Load a known-inertia recording bundle first.'); present(compareCommandTiming(bundle, settings()));}
    catch (error) {status.textContent = error.message;}
    finally {if (mine === revision) runButton.disabled = !bundle;}
  }
  function present(next) {
    if (!bundle || JSON.stringify(next.bundle) !== JSON.stringify(bundle)) throw Error('This comparison belongs to a different source notebook. Recompute against the current evidence.');
    report = next; result.hidden = false; save.hidden = false; runButton.disabled = false;
    candidateSelect.replaceChildren(); runSelect.replaceChildren();
    const joint=Boolean(report.options.responseTimes);
    const isSelected=c=>c.delaySeconds===report.selectedDelay&&(!joint||c.responseTimeSeconds===report.selectedResponse?.responseTimeSeconds);
    for (const c of report.candidates) {const o = node('option', `${fmt(c.delaySeconds)} s delay${joint?` · ${fmt(c.responseTimeSeconds)} s response`:''}${isSelected(c) ? ' · training choice' : ''}${c.status !== 'fitted' ? ' · failed fit' : ''}`); o.value = candidateKey(c,joint); candidateSelect.append(o);}
    const selected=report.candidates.find(isSelected);
    candidateSelect.value = candidateKey(selected??report.candidates[0],joint);
    for (const run of report.bundle.challengeRuns) {const o = node('option', run.label); o.value = run.id; runSelect.append(o);}
    const baseline = referenceCandidate();
    status.textContent = selected ? joint?`Training selects ${fmt(selected.delaySeconds)} s delay and ${fmt(selected.responseTimeSeconds)} s response time from ${report.candidates.length} offered pairs. ${report.competitiveResponses.length} pair(s) remain within the heuristic ambiguity range. Separate-recording RMSE: ${fmt(selected.challengeRMSE)} rad; training-selected pure delay: ${fmt(baseline?.challengeRMSE)} rad.`:`Training selects ${fmt(report.selectedDelay)} s from ${report.candidates.length} offered delays. ${report.competitiveDelays.length} delay(s) remain within the declared heuristic ambiguity range. Separate-recording RMSE: ${fmt(selected.challengeRMSE)} rad; zero delay: ${fmt(baseline?.challengeRMSE)} rad.` : 'No offered response produced an executable fitted model. Every failure remains visible.';
    legend.children[2].textContent=joint?'Training-selected pure-delay prediction':'Zero-delay prediction';
    const table = node('table'), head = node('thead'), hr = node('tr');
    for (const text of ['Delay (s)',...(joint?['Response (s)','Coarse step (s)']:[]), 'Training score Δ', 'Separate RMSE (rad)', 'Retained outcome']) hr.append(node('th', text)); head.append(hr); table.append(head);
    const body = node('tbody'), best = selected?.score;
    for (const c of report.candidates) {const row = node('tr'); if (isSelected(c)) row.className = 'timing-selected';
      const resolution = c.receiving.filter(r => r.status === 'executed').map(r => r.resolution.status);
      for (const text of [fmt(c.delaySeconds),...(joint?[fmt(c.responseTimeSeconds),fmt(c.solverMaxStep)]:[]), c.status === 'fitted' ? fmt(c.score - best) : 'failed', fmt(c.challengeRMSE), c.error?.message ?? `${c.discovery.diagnostics.adequacy}; ${resolution.every(s => s === 'compared') && resolution.length === c.receiving.length ? 'both resolutions compared' : 'incomplete execution / refinement'}`]) row.append(node('td', text));
      body.append(row);
    } table.append(body); tableHost.replaceChildren(table);
    limits.textContent = report.qualifications.join(' '); draw();
  }
  function referenceCandidate(){
    if(report.options.responseTimes)return report.candidates.filter(c=>c.responseTimeSeconds===0&&c.status==='fitted').sort((a,b)=>a.score-b.score||a.delaySeconds-b.delaySeconds)[0];
    return report.candidates.find(c=>c.delaySeconds===0);
  }
  function draw() {
    if (!report) return;
    const joint=Boolean(report.options.responseTimes);
    const candidate = report.candidates.find(c => candidateKey(c,joint)===candidateSelect.value);
    const run = report.bundle.challengeRuns.find(r => r.id === runSelect.value), received = candidate.receiving.find(r => r.runId === run.id);
    const zero = referenceCandidate()?.receiving.find(r => r.runId === run.id);
    const W = Math.max(260, Math.round(chart.clientWidth || host.clientWidth - 50)), H = view.value === 'profile' ? (joint?340:290) : 430;
    lastWidth = W; const svg = svgNode('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': view.value === 'profile' ? (joint?'Offered delay and response-time pairs, colored by separate-recording error. Orange ring marks training selection.':'Whole offered delay family with separate-recording errors; ranking remains training-only.') : 'Original command, declared applied response and observed versus predicted angle on one elapsed clock.'});
    const left = 58, right = 18, width = W - left - right;
    function trace(rows, x, y, color, dash) {if (!rows.length) return; svg.append(svgNode('polyline', {points: rows.map(r => `${x(r.x)},${y(r.y)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, ...(dash ? {'stroke-dasharray': dash} : {})}));}
    function text(value, x, y, anchor = 'start') {svg.append(svgNode('text', {x, y, 'font-size': 11, fill: '#304a53', 'text-anchor': anchor}, value));}
    function axis(top, bottom, low, high, label) {svg.append(svgNode('path', {d: `M${left} ${top}V${bottom}H${W-right}`, fill: 'none', stroke: '#b2c7cd'})); text(label, left, top - 13); text(fmt(high), left - 6, top + 4, 'end'); text(fmt(low), left - 6, bottom, 'end'); return v => bottom - (v - low) * (bottom - top) / Math.max(1e-10, high - low);}
    if (view.value === 'profile') {
      legend.hidden = true;
      if(joint){
        const valid=report.candidates.filter(c=>Number.isFinite(c.challengeRMSE));
        const maxDelay=Math.max(...report.options.delays),maxResponse=Math.max(...report.options.responseTimes);
        const x=d=>maxDelay>0?left+width*d/maxDelay:left+width/2,y=axis(45,245,0,maxResponse,'Response time (s)');
        const logs=valid.map(c=>Math.log10(Math.max(1e-12,c.challengeRMSE))),low=Math.min(...logs),high=Math.max(...logs);
        const color=c=>`hsl(202 60% ${78-45*(high>low?(Math.log10(Math.max(1e-12,c.challengeRMSE))-low)/(high-low):.5)}%)`;
        for(const c of report.candidates){
          const picked=c.delaySeconds===report.selectedResponse?.delaySeconds&&c.responseTimeSeconds===report.selectedResponse?.responseTimeSeconds;
          if(Number.isFinite(c.challengeRMSE)){
            const dot=svgNode('circle',{cx:x(c.delaySeconds),cy:y(c.responseTimeSeconds),r:picked?8:6,fill:color(c),stroke:picked?'#a24915':'#174858','stroke-width':picked?3:1});
            dot.append(svgNode('title',{},`${c.delaySeconds} s delay, ${c.responseTimeSeconds} s response: ${c.challengeRMSE} rad${picked?'; training-selected':''}`));svg.append(dot);
          }else{const mark=svgNode('text',{x:x(c.delaySeconds),y:y(c.responseTimeSeconds)+5,'text-anchor':'middle',fill:'#80675d','font-size':16},'×');mark.append(svgNode('title',{},`${c.delaySeconds} s delay, ${c.responseTimeSeconds} s response: complete receiving unavailable`));svg.append(mark);}
        }
        const delayTicks=report.options.delays.length<=7?report.options.delays:[0,maxDelay];
        for(const d of delayTicks)text(fmt(d),x(d),267,'middle');
        text('Offered delay (s)',left,289);text('Orange ring: training choice',left,309);
        const errors=valid.map(c=>c.challengeRMSE);text(valid.length?`Color: ${fmt(Math.min(...errors))}–${fmt(Math.max(...errors))} rad (log)`:'No complete separate-recording score',left,329);
      }else{
      const valid = report.candidates.filter(c => Number.isFinite(c.challengeRMSE)), maxDelay = Math.max(...report.options.delays), maxError = Math.max(.000001, ...valid.map(c => c.challengeRMSE));
      const x = d => left + width * d / maxDelay, y = axis(40, 235, 0, maxError, 'Separate recording RMSE (rad)');
      trace(valid.slice().sort((a,b)=>a.delaySeconds-b.delaySeconds).map(c=>({x:c.delaySeconds,y:c.challengeRMSE})), x, y, '#7d7e8c');
      for (const c of valid) {const dot = svgNode('circle', {cx:x(c.delaySeconds),cy:y(c.challengeRMSE),r:c.delaySeconds===report.selectedDelay?6:4,fill:c.delaySeconds===report.selectedDelay?'#a24915':'#174858'}); dot.append(svgNode('title', {}, `${c.delaySeconds} s, ${c.challengeRMSE} rad${c.delaySeconds===report.selectedDelay?', training-selected':''}`)); svg.append(dot);}
      text('0', left, 257); text(fmt(maxDelay), W-right, 257, 'end'); text('Offered delay (s)', left, 279);
      }
    } else {
      legend.hidden = false; const elapsed = r => r.time - run.samples[0].time, duration = elapsed(run.samples.at(-1)), x = t => left + width * t / duration;
      const predictions = received?.status === 'executed' ? received.rollout.rows : [], baseline = zero?.status === 'executed' ? zero.rollout.rows : [];
      const values = [...run.samples.map(s=>s.position), ...predictions.map(s=>s.predicted), ...baseline.map(s=>s.predicted)], low=Math.min(...values), high=Math.max(...values), pad=Math.max(.02,(high-low)*.06);
      const y = axis(45, 245, low-pad, high+pad, 'Angle (rad)');
      trace(baseline.map(r=>({x:elapsed(r),y:r.predicted})),x,y,'#7d7e8c','5 4'); trace(run.samples.map(r=>({x:elapsed(r),y:r.position})),x,y,'#174858'); trace(predictions.map(r=>({x:elapsed(r),y:r.predicted})),x,y,'#a24915','6 4');
      const applied=prepareCommandTimeline(run.samples,{delaySeconds:candidate.delaySeconds,responseTimeSeconds:candidate.responseTimeSeconds??0,beforeStart:report.options.beforeStart});
      const commands=[...run.samples.map(s=>s.command),report.options.beforeStart],lo=Math.min(...commands)-.1,hi=Math.max(...commands)+.1,yu=axis(303,377,lo,hi,'Command (N·m)');
      const recorded=[];for(let i=0;i<run.samples.length-1;i++){recorded.push({x:elapsed(run.samples[i]),y:run.samples[i].command},{x:elapsed(run.samples[i+1]),y:run.samples[i].command});}
      const delayed=applied.intervals.flatMap(segments=>segments.flatMap(s=>s.responseTimeSeconds>0?Array.from({length:6},(_,i)=>({x:s.start+s.duration*i/5,y:commandAtSegment(s,s.duration*i/5)})):[{x:s.start,y:s.command},{x:s.end,y:s.command}]));
      trace(recorded,x,yu,'#174858'); trace(delayed,x,yu,'#a24915','5 3'); text('0',left,398);text(fmt(duration),W-right,398,'end');text('Elapsed time (s)',left,420);
    }
    chart.replaceChildren(svg);
    detail.textContent = candidate.status !== 'fitted' ? candidate.error.message : `${run.label} · ${run.kind} · ${run.source.label}. Inspected ${fmt(candidate.delaySeconds)} s delay${joint?` and ${fmt(candidate.responseTimeSeconds)} s response time`:''}: ${candidate.model.equation}. Training equation residual ${fmt(candidate.model.metrics.rmse)} rad. ${received?.status === 'executed' ? `Separate motion RMSE ${fmt(received.rollout.metrics.positionRMSE)} rad; coarse/fine maximum difference ${fmt(received.resolution.maxAbsPositionDifference)} rad (${received.resolution.status}).` : `Prediction failed: ${received?.error?.message ?? 'unavailable'}.`} Source samples: ${run.samples.length}; no added angle observations. ${joint?'Applied-command curves are evaluations of the declared first-order hypothesis, not extra measurements.':''}`;
  }
  file.addEventListener('change', async () => {const chosen=file.files?.[0];if(!chosen)return;userEdits++;retire('Reading timing inputs…');const mine=revision,editVersion=userEdits;
    try {if(chosen.size>MAX_TEXT_LENGTH)throw Error('Choose a timing file smaller than 3 MB.');const text=await chosen.text();if(mine!==revision)return;const next=restoreCommandTimingInputs(text);if(mine!==revision)return;await onReopen?.(next,()=>editVersion===userEdits);}
    catch(error){if(mine===revision)status.textContent=error.message;}finally{file.value='';}
  });
  new ResizeObserver(() => {if(report&&Math.abs(Math.round(chart.clientWidth)-lastWidth)>1)draw();}).observe(chart);
  return {configure, present,
    suspend() {bundle=null;retire('The source notebook is changing. Previous timing results have been cleared.');},
    setBundle(next) {bundle=next?.schema==='worldlaw.trajectory-bundle/v1'?next:null;retire(bundle?'Supply the known pre-recording command, then compare this notebook.':'This instrument needs recorded command and known inertia. The current angular-only evidence cannot support a command-delay study.');sourceLabel.textContent=bundle?`Current source: ${bundle.label}. ${bundle.trainingRuns.length} training and ${bundle.challengeRuns.length} separate recording(s).`:'No known-inertia command source loaded.';},
  };
}
