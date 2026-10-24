import {investigateAngleReference, exportReferenceInvestigation, reopenReferenceInvestigation} from './angle-reference.mjs';

const fmt = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toString() : 'unavailable';
/** Additive apparatus: leaves the current challenge, planner and evidence unchanged. */
export function createReferencePanel(anchor) {
  const host = document.createElement('section'); host.id = 'angle-reference-panel'; anchor.after(host);
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{display:block;margin:24px 0;color:#e8eff6;font:15px/1.5 system-ui}*{box-sizing:border-box}
    details{background:#101e2c;border-top:3px solid #5bd2dc;padding:20px}summary{font-size:21px;cursor:pointer;font-weight:650}
    p{max-width:85ch;color:#c3d0de}label{display:grid;gap:5px;font-size:13px}input,select,button{font:inherit;padding:9px;background:#172b3b;color:#f4f7fa;border:1px solid #91a7bb;border-radius:2px;min-height:42px}
    button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #ffdc82;outline-offset:3px}
    .controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:15px 0}
    .status{border-left:3px solid #5bd2dc;padding:10px;white-space:pre-line}.error{color:#ffb9ae}.plot{width:100%;height:auto;background:#09131d;display:block}
    .scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #425263}th{color:#b8cbdc}
    .legend{display:flex;gap:16px;flex-wrap:wrap}.observed{color:#fff}.baseline{color:#f9ad65}.shifted{color:#5bd2dc}[hidden]{display:none!important}
    @media(max-width:600px){details{padding:12px}.controls{grid-template-columns:1fr}.actions>*{flex:1 1 140px}summary{font-size:18px}}
  </style><details><summary>Investigate the angle reference</summary>
    <p>Could a different angle zero explain this motion? Compare the same weak-law library across declared reference offsets, then freeze the training winner and predict separate recordings. The original evidence and main notebook remain intact.</p>
    <div class="controls">
      <label>Offsets to test (radians; include 0)<input id="offsets" value="-0.5,-0.4,-0.3,-0.2,-0.1,0,0.1,0.2,0.3,0.4,0.5"></label>
      <label>Assumed angle noise (rad)<input id="noise" type="number" min="0.000000000001" max="1000000" step="any" value="0.01"></label>
      <label>Weak window (seconds)<input id="window" type="number" min="0.02" max="60" step="any" value="1"></label>
    </div><p id="library">Uses the six maintained autonomous terms, at most four per model. The same options apply to every offset. A shifted coordinate costs one additional score parameter; scores are heuristic.</p>
    <div class="actions"><button id="search" disabled>Compare references</button><button id="save" disabled>Save reference notebook</button><label>Reopen reference notebook<input id="open" type="file" accept="application/json,.json"></label></div>
    <p id="status" class="status" role="status">Load measured or declared angular evidence with unknown torque scale in Trajectory Challenge.</p>
    <div id="results" hidden><label>Separate recording<select id="run"></select></label>
      <p id="source"></p><div class="legend"><span class="observed">White: observed</span><span class="baseline">Orange: zero-offset prediction</span><span class="shifted">Cyan: selected-reference prediction</span></div>
      <canvas id="plot" class="plot" width="900" height="340" aria-label="Original recorded angles and frozen free-running predictions"></canvas>
      <p id="prediction"></p><p>Training ranking — scroll horizontally on narrow screens.</p><div class="scroll" tabindex="0" role="region" aria-label="Training ranking table"><table><thead><tr><th>Offset rad</th><th>Training model</th><th>Weak residual rad</th><th>Penalized score</th></tr></thead><tbody id="candidates"></tbody></table></div>
      <p id="limits"></p>
    </div></details>`;
  const $ = id => root.getElementById(id);
  let current = null, currentKey = '', result = null, generation = 0, fitOverrides = {};
  const status = (message, error = false) => {$('status').textContent = message; $('status').classList.toggle('error', error);};
  function invalidate() {generation++; result = null; $('results').hidden = true; $('save').disabled = true; $('search').disabled = !current;}
  function show(next) {
    result = next; $('results').hidden = false; $('save').disabled = false;
    const s = next.search;
    $('library').textContent = `Offered terms: ${s.selected.fitOptions.terms.join(', ')}; at most ${s.selected.fitOptions.maxTerms} per model. Identical settings for every offset; a nonzero offset pays one additional heuristic score parameter.`;
    status(`${s.status.replaceAll('_',' ')} · selected offset ${fmt(s.selected.offset)} rad · score improvement ${fmt(s.scoreImprovement)}\nCompetitive offsets: ${s.competitiveOffsets.map(fmt).join(', ')} rad. Coordinate evidence does not identify a sensor defect or physical gravity direction.`);
    $('run').replaceChildren(...next.bundle.challengeRuns.map(run => {const option = document.createElement('option'); option.value = run.id; option.textContent = run.label; return option;}));
    $('candidates').replaceChildren(...s.candidates.map(c => {const tr=document.createElement('tr');for(const text of [fmt(c.offset),c.model.id,fmt(c.model.metrics.rmse),fmt(c.score)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;}));
    $('limits').textContent = s.limitations.join(' ') + (s.failures.length ? ` Failed offsets: ${s.failures.map(f=>`${f.offset}: ${f.message}`).join('; ')}` : '');
    plot();
  }
  function plot() {
    if (!result) return;
    const run = result.bundle.challengeRuns.find(run => run.id === $('run').value), pair = result.comparisons.find(p => p.runId === run.id);
    $('source').textContent = `${run.kind.toUpperCase()} · ${run.source.label} · recording ${run.source.recordingId ?? 'not supplied'}. Original angle coordinates; no observation resets. Existing benchmark data remains exploratory.`;
    const summarize = (name, item) => item.error ? `${name}: refused (${item.error.message})` : `${name}: RMSE ${fmt(item.rollout.metrics.positionRMSE)} rad; numerical comparison ${item.resolution.status}${item.resolution.status === 'compared' ? `, max difference ${fmt(item.resolution.maxAbsPositionDifference)} rad` : ` (${item.resolution.reason})`}`;
    $('prediction').textContent = [summarize('Unshifted',pair.baseline),summarize('Selected reference',pair.selected)].join('. ') + '. Numerical agreement is not physical validation.';
    const canvas = $('plot'), ctx = canvas.getContext('2d'), lines = [{rows:run.samples.map(r=>({time:r.time,value:r.position})),color:'#ffffff'}];
    for(const [key,color] of [['baseline','#f9ad65'],['selected','#5bd2dc']])if(pair[key].rollout)lines.push({rows:pair[key].rollout.rows.map(r=>({time:r.time,value:r.predicted})),color});
    const values=lines.flatMap(line=>line.rows.map(r=>r.value)),low=Math.min(...values),high=Math.max(...values),span=Math.max(high-low,.001),start=run.samples[0].time,end=run.samples.at(-1).time;
    const width=Math.max(200,canvas.getBoundingClientRect().width),height=width<500?240:340,dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=`${height}px`;ctx.scale(dpr,dpr);
    const x=t=>20+(t-start)/(end-start)*(width-40),y=v=>height-60-(v-low)/span*(height-100);
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#c3d0de';ctx.font='14px system-ui';ctx.fillText(`${fmt(high)} rad`,7,23);ctx.fillText(`${fmt(low)} rad`,7,height-35);ctx.fillText(`${fmt(start)} → ${fmt(end)} s`,20,height-10);
    for(const line of lines){ctx.strokeStyle=line.color;ctx.lineWidth=2;ctx.setLineDash(line.color==='#5bd2dc'?[7,4]:[]);ctx.beginPath();line.rows.forEach((r,i)=>i?ctx.lineTo(x(r.time),y(r.value)):ctx.moveTo(x(r.time),y(r.value)));ctx.stroke();}
  }
  new ResizeObserver(()=>plot()).observe(host);
  $('run').addEventListener('change',plot);
  for(const id of ['offsets','noise','window'])$(id).addEventListener('input',()=>{invalidate();status('Settings changed. Compare references to recompute before saving.');});
  $('search').addEventListener('click',async()=>{
    if(!current)return;invalidate();const ticket=generation,bundle=current;$('search').disabled=true;status('Fitting training coordinates, then predicting separate recordings…');
    try{await new Promise(resolve=>requestAnimationFrame(resolve));if(ticket!==generation)return;const tokens=$('offsets').value.split(',').map(s=>s.trim());if(tokens.some(s=>!s))throw Error('Enter comma-separated numeric offsets with no empty values.');
      const duration=Number($('window').value),next=investigateAngleReference(bundle,{offsets:tokens.map(Number),fit:{...fitOverrides,noiseSigma:Number($('noise').value),windowDuration:duration,windowStride:duration/2}});
      if(ticket===generation)show(next);
    }catch(error){if(ticket===generation)status(error.message,true);}finally{if(ticket===generation)$('search').disabled=!current;}
  });
  $('save').addEventListener('click',()=>{if(!result)return;try{const url=URL.createObjectURL(new Blob([exportReferenceInvestigation(result)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='worldlaw-angle-reference.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status(error.message,true);}});
  $('open').addEventListener('change',async()=>{
    const file=$('open').files?.[0];if(!file)return;const ticket=++generation;
    try{if(file.size>3000000)throw Error('Reference notebook exceeds 3 MB.');const text=await file.text();if(ticket!==generation)return;const next=reopenReferenceInvestigation(text);if(ticket!==generation)return;
      current=next.bundle;fitOverrides=next.search.settings.fit;$('search').disabled=false;
      $('offsets').value=next.search.settings.offsets.join(',');$('noise').value=next.search.selected.fitOptions.noiseSigma;$('window').value=next.search.selected.fitOptions.windowDuration;show(next);
    }catch(error){if(ticket===generation)status(`Reopen refused; prior result retained. ${error.message}`,true);}finally{if(ticket===generation){$('open').value='';$('search').disabled=!current;}}
  });
  return {update(bundle){const key=JSON.stringify(bundle);if(key===currentKey)return;currentKey=key;invalidate();fitOverrides={};current=bundle?.schema==='worldlaw.angular-bundle/v1'?bundle:null;$('search').disabled=!current;
    $('library').textContent='Uses the six maintained autonomous terms, at most four per model. The same options apply to every offset. A shifted coordinate costs one additional score parameter; scores are heuristic.';
    status(current?'Current angular evidence ready. Declare a reference range and compare; challenge data never selects the coordinate.':'Load measured or declared angular evidence with unknown torque scale in Trajectory Challenge.');}};
}
