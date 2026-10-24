import {planProbeAcquisition,exportProbePlan,importProbePlan} from './probe-planner.mjs';
const fmt=x=>Number(x.toPrecision(5)).toString();
export function mountProbePlanner(controller){
 const section=document.createElement('section');section.className='duration-investigation probe-choice';section.setAttribute('aria-labelledby','probe-choice-title');
 section.innerHTML=`<style>
 .probe-choice .mini-inputs{grid-template-columns:repeat(2,minmax(0,1fr))}
 .probe-choice .mini-inputs label{min-width:0}
 .probe-choice .mini-inputs input{display:block;min-width:0;max-width:100%;width:100%;box-sizing:border-box}
 @media(max-width:520px){.probe-choice .mini-inputs{grid-template-columns:minmax(0,1fr)}}
 .probe-choice .table-wrap:focus-visible{outline:3px solid #ffad5c;outline-offset:3px}
 .probe-choice .choice-number{width:8rem!important;max-width:none;margin:0!important}
 .probe-choice #probe-choice-error{color:#ffad5c}
 .probe-choice #probe-choice-detail p{overflow-wrap:anywhere}
 </style><p class="overline">NEXT PROBE / SPEND EFFORT WHERE PREDICTIONS DIFFER</p>
 <h2 id="probe-choice-title">Which state is worth measuring?</h2>
 <p>Use the cross-probe study above. Offer states you can measure, with your own effort costs. The chooser keeps the full training coefficient intervals and asks which affordable observation can separate them.</p>
 <form id="probe-choice-form">
 <div class="mini-inputs"><label>Effort budget<input id="probe-choice-budget" type="number" min="0" max="1000000" step="any" value="4" required></label><label>Assumed future contrast radius (N·m)<input id="probe-choice-radius" type="number" min="0.00000001" max="1000" step="any" value="0.01" required></label></div>
 <p class="input-hint">Effort uses your declared units, not seconds. Radius describes an assumed future screening bound, not a sensor specification or observed result. At least four matched pairs in each acquisition order and the same preparation, recovery and command are required by the study.</p>
 <div class="table-wrap" tabindex="0" role="region" aria-label="Editable offered probe states"><table><caption>Only these offered states are considered; feasibility is your declaration.</caption><thead><tr><th>Probe</th><th>Angle (rad)</th><th>Rate (rad/s)</th><th>Effort</th><th>Remove</th></tr></thead><tbody id="probe-choice-offered"></tbody></table></div>
 <div class="secondary-actions"><button id="probe-choice-add" type="button">Add offered state</button><button id="probe-choice-run" type="submit">Compare offered probes</button></div></form>
 <p id="probe-choice-status" role="status">Load a cross-probe study, then compare the offered states.</p>
 <div class="table-wrap" tabindex="0" role="region" aria-label="Probe choice comparison"><table><caption>All offered predictions, including over-budget and unresolved states</caption><thead><tr><th>Probe</th><th>Separated pairs</th><th>Effort</th><th>Budget</th><th>Outside training range</th></tr></thead><tbody id="probe-choice-results"></tbody></table></div>
 <details><summary>Inspect complete prediction intervals</summary><div id="probe-choice-detail"></div></details>
 <div class="secondary-actions"><button id="probe-choice-export" type="button" disabled>Export measurement request</button><button id="probe-choice-open" type="button">Reopen measurement request</button></div><input id="probe-choice-file" type="file" accept=".json,application/json" hidden>
 <p id="probe-choice-error" role="alert"></p><p class="annotation">Conditional finite-hypothesis separation only. All offered laws can be wrong. This manual request does not acquire evidence, authenticate independence, certify mechanical feasibility or control hardware. Actual challenge outcomes never choose this proposal.</p>`;
 document.querySelector('.scientific-limit').before(section);
 const $=id=>section.querySelector('#'+id);let plan=null,key='',serial=0,readVersion=0;
 const training=()=>{const s=controller.getStudy();if(!s)throw Error('Load a cross-probe study first.');return {...s,runs:s.runs.filter(r=>r.role==='training')};};
 function invalidate(){plan=null;$('probe-choice-export').disabled=true;$('probe-choice-results').replaceChildren();$('probe-choice-detail').replaceChildren();$('probe-choice-status').textContent='Recompute from current training and acquisition assumptions.';}
 function add(p=null){
  if(!p){let id;do{id='probe-'+(++serial);}while([...$('probe-choice-offered').children].some(tr=>tr.dataset.id===id));p={id,position:'',rate:'',cost:''};}
  if($('probe-choice-offered').children.length>=32)throw Error('Offer at most 32 states.');
  const tr=document.createElement('tr');tr.dataset.id=p.id;const name=document.createElement('th');name.scope='row';name.textContent=p.id;tr.append(name);
  for(const field of ['position','rate','cost']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.step='any';input.required=true;input.className='choice-number';input.dataset.field=field;input.value=p[field];input.setAttribute('aria-label',p.id+' '+field);input.min=field==='cost'?'0':'-1000000';input.max='1000000';td.append(input);tr.append(td);}
  const td=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove offered '+p.id);remove.onclick=()=>{tr.remove();readVersion++;invalidate();};td.append(remove);tr.append(td);$('probe-choice-offered').append(tr);
 }
 function options(){
  const value=input=>{if(!input.value.trim())throw Error('Complete every acquisition assumption.');return Number(input.value);};
  return {budget:value($('probe-choice-budget')),contrastRadius:value($('probe-choice-radius')),probes:[...$('probe-choice-offered').children].map(tr=>({id:tr.dataset.id,...Object.fromEntries([...tr.querySelectorAll('input')].map(i=>[i.dataset.field,value(i)]))}))};
 }
 function render(next){
  plan=next;key=JSON.stringify(training());$('probe-choice-results').replaceChildren();$('probe-choice-detail').replaceChildren();
  const c=next.selected;$('probe-choice-status').textContent=c?next.status.toUpperCase().replaceAll('-',' ')+': '+c.id+' at angle '+fmt(c.probe.position)+' rad, rate '+fmt(c.probe.rate)+' rad/s; effort '+fmt(c.cost)+', '+c.separated+'/'+c.total+' pairs. '+next.reason:next.reason;
  for(const c of next.candidates){const tr=document.createElement('tr');for(const value of [c.id,c.separated+'/'+c.total,fmt(c.cost),c.withinBudget?'within budget':'over budget',Object.entries(c.extrapolation).filter(([,v])=>v).map(([k])=>k).join(', ')||'none']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('probe-choice-results').append(tr);
   const p=document.createElement('p');p.textContent=c.id+': '+c.predictions.map(x=>x.id+' ['+x.interval.map(fmt).join(', ')+'] N·m').join('; ')+'. '+c.comparisons.map(x=>x.hypotheses.join(' / ')+' gap '+fmt(x.gap)+', margin '+fmt(x.margin)+(x.separable?' separates':' unresolved')).join('; ');$('probe-choice-detail').append(p);}
  $('probe-choice-export').disabled=!next.selected;
 }
 const safe=fn=>{try{fn();$('probe-choice-error').textContent='';}catch(e){$('probe-choice-error').textContent=e.message;}};
 $('probe-choice-form').onsubmit=e=>{e.preventDefault();readVersion++;safe(()=>{invalidate();render(planProbeAcquisition(training(),options()));});};
 $('probe-choice-form').addEventListener('input',()=>{readVersion++;invalidate();});
 $('probe-choice-add').onclick=()=>safe(()=>{readVersion++;add();invalidate();});
 document.addEventListener('worldlaw-probe-study-change',()=>{readVersion++;try{if(JSON.stringify(training())!==key)invalidate();}catch{invalidate();}});
 $('probe-choice-export').onclick=()=>safe(()=>{
  if(!plan?.selected||JSON.stringify(training())!==key||JSON.stringify([options().probes,options().contrastRadius,options().budget])!==JSON.stringify([plan.settings.probes,plan.settings.contrastRadius,plan.settings.budget])){invalidate();throw Error('Inputs changed; recompute an informative request first.');}
  const url=URL.createObjectURL(new Blob([exportProbePlan(training(),plan.settings)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-probe-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('probe-choice-open').onclick=()=>$('probe-choice-file').click();
 $('probe-choice-file').onchange=async e=>{const version=++readVersion,file=e.target.files?.[0];if(!file)return;try{if(file.size>4000000)throw Error('Use a request below 4 MB.');const next=importProbePlan(await file.text());if(version!==readVersion)return;controller.adopt(next.training);$('probe-choice-budget').value=next.settings.budget;$('probe-choice-radius').value=next.settings.contrastRadius;$('probe-choice-offered').replaceChildren();next.settings.probes.forEach(add);render(next);$('probe-choice-error').textContent='';}catch(error){if(version===readVersion)$('probe-choice-error').textContent=error.message;}finally{e.target.value='';}};
 [{id:'correlated',position:.6,rate:.6,cost:1},{id:'zero-rate',position:.6,rate:0,cost:2},{id:'reversed',position:.6,rate:-.6,cost:4}].forEach(add);
}
