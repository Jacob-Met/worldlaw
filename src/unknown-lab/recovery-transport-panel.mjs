import {mountRecoveryPopulationPlanner} from './recovery-population-planner-panel.mjs';
import {compareRecoveryTransport,RECOVERY_TRANSPORT_SCHEMA,exportRecoveryTransport,importRecoveryTransport} from './recovery-transport.mjs';
import {recoveryFixture} from './recovery-fixture.mjs';
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(5)).toString():'—';
const verdict=s=>({compatible:'not excluded by bounds',training_contradiction:'excluded by training bounds',challenged:'excluded by receiving bounds',not_admitted:'not admitted from training',incomplete:'incomplete receiving',untested:'not tested',unqualified_order:'order unavailable',insufficient_excitation:'insufficient excitation'}[s]??s);
export function mountRecoveryTransport(recovery){
 const host=document.createElement('details');host.id='recovery-transport';
 host.innerHTML=`<summary>Bound readout-population changes when exact overlap is absent</summary>
 <p>Keep every original pair. Declare how much the <strong>preparation contrast</strong> may change with each current-state coordinate at any admitted delay. A complete pairing bounds its mean on a chosen training population <strong>at that same delay</strong>. This does not bound recovery between different delays.</p>
 <div class="recovery-controls"><label>Original training reference population<select id="transport-reference"></select></label>
 <label>Contrast sensitivity to command (N·m / N·m)<input id="transport-command" type="number" min="0" max="1000000" step="any" placeholder="Explicit limit"></label>
 <label>Contrast sensitivity to angle (N·m / rad)<input id="transport-position" type="number" min="0" max="1000000" step="any" placeholder="Explicit limit"></label>
 <label>Contrast sensitivity to rate (N·m / (rad/s))<input id="transport-rate" type="number" min="0" max="1000000" step="any" placeholder="Explicit limit"></label></div>
 <p>These are uniform declared hypotheses, not inferred sensor calibration. Zero asserts no state dependence on that coordinate. Each recording needs exact within-pair coordinates and the same pair count in each acquisition order as the reference; unsupported recordings remain unavailable.</p>
 <div class="recovery-controls"><button id="transport-compare" type="button">Apply declared population bounds</button><button id="transport-demo" type="button">Load authored continuous-state control</button><button id="transport-save" type="button">Save original case and assumptions</button><button id="transport-open" type="button">Open population-sensitivity case</button><input id="transport-file" type="file" accept=".json,application/json" hidden></div>
 <p id="transport-status" role="status" aria-live="polite">No conditional comparison computed.</p><div id="transport-result"></div>`;
 document.querySelector('#recovery-support').after(host);
 const $=id=>host.querySelector('#'+id);let epoch=0;const listeners=[];
 const invalidate=()=>{epoch++;for(const fn of listeners)fn();$('transport-result').replaceChildren();$('transport-status').textContent='Source or sensitivity changed. Recompute from original evidence.';};
 function refresh(){invalidate();const previous=$('transport-reference').value;$('transport-reference').replaceChildren();for(const r of recovery.getStudy().training){const o=document.createElement('option');o.value=r.recordingId;o.textContent=r.recordingId+' · '+fmt(r.delaySeconds)+' s recording (population only)';$('transport-reference').append(o);}if([...$('transport-reference').options].some(o=>o.value===previous))$('transport-reference').value=previous;}
 recovery.onChange(refresh);refresh();
 for(const key of ['reference','command','position','rate'])$('transport-'+key).addEventListener('input',invalidate);
 function readCase(){const sensitivity={};for(const key of ['command','position','rate']){if(!$('transport-'+key).value.trim())throw Error('Enter an explicit sensitivity for every coordinate.');sensitivity[key]=Number($('transport-'+key).value);}return {schema:RECOVERY_TRANSPORT_SCHEMA,study:recovery.getStudy(),settings:{referenceRecordingId:$('transport-reference').value,sensitivity}};}
 function table(headers,rows,label){const wrap=document.createElement('div');wrap.className='recovery-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label',label);const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const text of headers){const th=document.createElement('th');th.textContent=text;tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');for(const row of rows){const tr=document.createElement('tr');for(const text of row){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);return wrap;}
 function render(){const r=compareRecoveryTransport(readCase()),result=$('transport-result');result.replaceChildren();
  $('transport-status').textContent=r.status==='conditional-comparison'?'Conditional reference-population comparison; surviving laws are only not excluded by these bounds.':'Unavailable: at least one original training population cannot be bounded under this contract.';
  const note=document.createElement('p');note.textContent=r.qualification;result.append(note);
  const rows=r.recordings.map(row=>[row.recordingId+' · '+row.role,fmt(row.delaySeconds),fmt(row.original.estimate),fmt(row.original.boundary),row.status==='bounded'?fmt(row.allowance.upper):'unavailable',fmt(row.combinedScreen)]);
  result.append(table(['Original recording','Delay / s','Original contrast / N·m','Original screen radius / N·m','Same-delay population allowance / N·m','Combined screen radius / N·m'],rows,'Original readouts and declared population allowances'));
  if(r.comparison)result.append(table(['Offered law','Original training / receiving','Reference-population training / receiving'],r.baseline.fit.candidates.map((c,i)=>[c.id,verdict(c.status)+' / '+verdict(r.baseline.tests[i].status),verdict(r.comparison.fit.candidates[i].status)+' / '+verdict(r.comparison.tests[i].status)]),'Conditional recovery model bounds'));
  for(const row of r.recordings){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.recordingId+' · '+row.status+' · inspect complete original pair assignments';details.append(summary);
   if(row.reasons.length){const p=document.createElement('p');p.textContent=JSON.stringify(row.reasons);p.style.overflowWrap='anywhere';details.append(p);}
   for(const a of row.assignments){const p=document.createElement('p');p.textContent=a.order+' · '+a.pairs.length+' original pairs · exact mean cost '+a.exact.numerator+'/'+a.exact.denominator+' N·m. State triples: [command N·m, angle rad, rate rad/s].';p.style.overflowWrap='anywhere';details.append(p);
    const source=document.createElement('pre');source.style.whiteSpace='pre-wrap';source.style.overflowWrap='anywhere';source.textContent=a.pairs.map(p=>p.originalPairId+' '+JSON.stringify(p.originalState)+' → '+p.targetPairId+' '+JSON.stringify(p.targetState)).join('\n');details.append(source);
   }result.append(details);
  }
 }
 const act=fn=>{try{fn();}catch(e){$('transport-result').replaceChildren();$('transport-status').textContent='Refused: '+e.message;}};
 $('transport-compare').onclick=()=>{epoch++;act(render);};
 $('transport-demo').onclick=()=>act(()=>{recovery.replaceStudy(recoveryFixture());for(const key of ['command','position','rate'])$('transport-'+key).value='.01';render();});
 $('transport-save').onclick=()=>act(()=>{const text=exportRecoveryTransport(readCase()),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-recovery-population-sensitivity.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('transport-open').onclick=()=>$('transport-file').click();
 $('transport-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;e.target.value='';const ticket=++epoch;try{if(file.size>2100000)throw Error('Use a case below 2.1 MB.');const next=importRecoveryTransport(await file.text());if(ticket!==epoch)return;compareRecoveryTransport(next);e.target.value='';recovery.replaceStudy(next.study);for(const key of ['command','position','rate'])$('transport-'+key).value=String(next.settings.sensitivity[key]);$('transport-reference').value=next.settings.referenceRecordingId;render();}catch(error){if(ticket===epoch)$('transport-status').textContent='Import refused; original case preserved: '+error.message;}finally{if(ticket===epoch)e.target.value='';}};
 mountRecoveryPopulationPlanner(host,{readCase,onChange:fn=>listeners.push(fn),replaceCase(next){recovery.replaceStudy(next.study);for(const key of ['command','position','rate'])$('transport-'+key).value=String(next.settings.sensitivity[key]);$('transport-reference').value=next.settings.referenceRecordingId;render();}});
 return {invalidate};
}
