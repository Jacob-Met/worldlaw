import {appendPointResponse} from './point-response-panel.mjs';
import {appendMatrixCalibration} from './circulation-matrix-panel.mjs';
import {appendCalibration} from './circulation-calibration-panel.mjs';
import {appendCirculationBoxes} from './circulation-angle-boxes-panel.mjs';
import {appendResponseRegionInspection} from './response-region-panel.mjs';
import {appendObservableInspection} from './observable-panel.mjs';
import {compareCirculation,circulationExample,exportCirculation,importCirculation} from './circulation.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=v=>v===null?'—':Number(v.toPrecision(6)).toString();
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
export function mountCirculation(host,{getNotebook}){
 host.style.minWidth='0';host.style.overflowWrap='anywhere';host.style.borderTop='2px solid currentColor';host.style.marginTop='2rem';host.style.paddingTop='1rem';
 host.innerHTML=`<h2>Take the response around a closed path</h2><p>Compare signed two-coordinate work with every current fitted response. Loop readings remain separate from training. This inspection is not a prospective freeze or hardware instruction.</p>
 <label>Authored loop control <select id="circulation-example"><option value="directional">Directional field</option><option value="reciprocal">Reciprocal field</option><option value="uncertain">Wide reading bounds</option><option value="quadrature">Nonlinear conservative quadrature artifact</option></select></label><button type="button" id="circulation-load">Load authored input</button>
 <label for="circulation-input">Ordered loop JSON: paired angles, paired torques and error radii</label><textarea id="circulation-input" rows="12" spellcheck="false" style="width:100%;max-width:100%;box-sizing:border-box"></textarea>
 <p>Angles are declared exact; each final reading is separate even when angles close. Bounds are not confidence intervals. Declare a joule allowance for between-sample integration error; zero is an assumption, not a verified absence of error. The coordinate-convention text must match the training notebook exactly.</p>
 <button type="button" id="circulation-run">Compare loop with current laws</button><button type="button" id="circulation-save" disabled>Save source inputs</button>
 <label>Reopen saved comparison <input id="circulation-open" type="file" accept="application/json,.json"></label>
 <p id="circulation-status" role="status"></p><div id="circulation-result"></div>`;
 const $=id=>host.querySelector('#circulation-'+id);let result=null,token=0;
 const invalidate=()=>{token++;result=null;$('save').disabled=true;$('result').replaceChildren();$('status').textContent='Compare again after changing source inputs.';};
 const load=()=>{$('input').value=JSON.stringify(circulationExample(getNotebook().assumptions.coordinateConvention,$('example').value),null,2);invalidate();};
 function draw(){const out=$('result');out.replaceChildren();const r=result.observed;
  out.append(node('h3',`${r.input.source.kind==='synthetic'?'Synthetic':'User-declared measured'}: ${r.input.source.label}`));
  out.append(node('p',`Observed polygon work ${fmt(r.work)} J; bounded interval [${r.interval.map(fmt).join(', ')}] J. ${r.conclusion}. Reading-error radius ${fmt(r.torqueBound)} J; supplied integration allowance ${fmt(r.input.integrationAllowance)} J.`));
  const graph=svg('svg',{viewBox:'0 0 600 340',role:'img','aria-label':'Ordered two-coordinate loop: numbered source samples, not a reconstructed mechanism'});graph.style.width='100%';graph.style.maxWidth='650px';graph.style.background='#101c2d';graph.style.color='#e7edf7';
  const rows=r.input.samples,min=[0,1].map(a=>Math.min(...rows.map(s=>s.q[a]))),max=[0,1].map(a=>Math.max(...rows.map(s=>s.q[a])));
  const xy=q=>[60+480*(q[0]-min[0])/Math.max(1e-12,max[0]-min[0]),285-240*(q[1]-min[1])/Math.max(1e-12,max[1]-min[1])];
  const path=svg('polyline',{points:rows.map(s=>xy(s.q).join(',')).join(' '),fill:'none',stroke:'#4ade80','stroke-width':3});graph.append(path);
  rows.slice(0,-1).forEach((s,i)=>{const [x,y]=xy(s.q);graph.append(svg('circle',{cx:x,cy:y,r:5,fill:'#bd9dff'}));const t=svg('text',{x:x+8,y:y-8,fill:'currentColor'});t.textContent=String(i+1);graph.append(t);});
  const caption=svg('text',{x:60,y:325,fill:'currentColor'});caption.textContent=`θ₁ ${min[0]}…${max[0]} rad; θ₂ ${min[1]}…${max[1]} rad; order closes at ${rows.length}`;graph.append(caption);out.append(graph);
  const wrap=node('div');wrap.id='circulation-table-scroll';wrap.style.overflowX='auto';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Fitted-law work comparison; scroll horizontally to inspect all columns');const table=node('table'),head=node('tr');table.id='circulation-comparison-table';table.style.minWidth='620px';table.style.overflowWrap='normal';for(const s of ['Fitted law','Predicted work / J','Receiving','Outside training ranges']){const th=node('th',s);th.scope='col';head.append(th);}table.append(head);
  for(const c of result.candidates){const tr=node('tr');tr.append(node('td',c.label),node('td',fmt(c.work)),node('td',c.reason?`${c.status}: ${c.reason}`:c.status),node('td',`${c.extrapolatedRows.length} / ${rows.length} readings`));tr.children[1].style.whiteSpace='nowrap';table.append(tr);}wrap.append(table);out.append(wrap);
  for(const c of result.refused)out.append(node('p',`${c.label}: no executable prediction (${c.reason}).`));
  out.append(node('p',result.scope));
  const details=node('details'),summary=node('summary','Inspect every source segment and shared reading weight');details.append(summary);
  const ledger=node('pre');ledger.style.whiteSpace='pre-wrap';ledger.style.overflowWrap='anywhere';ledger.textContent=rows.map((s,i)=>`${i+1}: θ=[${s.q.map(fmt)}]; τ=[${s.torque.map(fmt)}]; error radii=[${s.torqueRadius.map(fmt)}]; work weights=[${r.axes.map(a=>fmt(a.weights[i]))}]`).join('\n');details.append(ledger);out.append(details);appendObservableInspection(out,result);appendResponseRegionInspection(out,result);
  appendCirculationBoxes(out,result);
  appendCalibration(out,result);
  appendMatrixCalibration(out,result);
  appendPointResponse(out,result);
  $('save').disabled=false;
 }
 $('load').addEventListener('click',load);$('input').addEventListener('input',invalidate);
 $('run').addEventListener('click',()=>{invalidate();try{result=compareCirculation(getNotebook(),JSON.parse($('input').value));draw();$('status').textContent='Compared the complete loop; training and the active notebook are unchanged.';}catch(e){$('status').textContent=e.message;}});
 $('save').addEventListener('click',()=>{if(!result)return;try{const url=URL.createObjectURL(new Blob([exportCirculation(result.notebook,result.observed.input)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-coupled-circulation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('status').textContent=e.message;}});
 $('open').addEventListener('change',async()=>{const file=$('open').files?.[0];if(!file)return;const mine=++token;try{if(file.size>4*1024*1024)throw Error('Circulation file exceeds 4 MiB.');const text=await file.text();if(mine!==token)return;const next=importCirculation(text);result=next;$('input').value=JSON.stringify(next.observed.input,null,2);draw();$('status').textContent='Recomputed from the retained training and loop inputs. The active notebook is unchanged; Compare uses its current laws.';}catch(e){if(mine===token)$('status').textContent=`${e.message} Previous valid comparison retained.`;}finally{if(mine===token)$('open').value='';}});
 load();return {sourceChanged:invalidate};
}
