import {mountProbeMixtureConsistency} from './probe-mixture-consistency-panel.mjs';
import {analyzeProbeMixtures} from './probe-mixture.mjs';
import {analyzeProbeStudy,exportProbeStudy,importProbeStudy} from './probe-response.mjs';
import {probeExample} from './probe-fixture.mjs';
const fmt=x=>Number(x.toPrecision(4)).toString();
export function mountProbePanel(){
 const section=document.createElement('section');section.className='duration-investigation probe-investigation';section.setAttribute('aria-labelledby','probe-title');
 section.innerHTML=`<style>
 .probe-investigation .probe-plot-scroll{max-width:100%;overflow-x:auto;border:1px solid #315460;margin:20px 0;padding:8px 0}
 .probe-investigation .probe-plot-scroll:focus-visible{outline:3px solid #ffad5c;outline-offset:3px}
 .probe-investigation #probe-plot{display:block;width:100%;min-width:820px;max-height:none;margin:0}
 .probe-investigation #probe-plot text{font-size:14px}
 .probe-investigation #probe-challenges p{overflow-wrap:anywhere}
 </style><p class="overline">CROSS-PROBE / TEST WHAT PREPARATION CHANGES</p><h2 id="probe-title">Does the effect reverse with motion?</h2>
 <p>Hold preparation and command fixed. Change the probe angle and rate to confront a constant torque offset, a change proportional to rate, and a change proportional to sin(angle). The same coefficient must predict every separate challenge.</p>
 <label for="probe-example-kind">Authored control <select id="probe-example-kind"><option value="ambiguous">Ambiguous small probes → reversed motion</option><option value="drag">Rate-dependent response</option><option value="offset">Constant response</option><option value="restoring">Sine-angle response</option><option value="mixed">Mixed offset + rate control</option></select></label>
 <div class="secondary-actions"><button id="probe-example" type="button">Run authored probe study</button><button id="probe-open" type="button">Open probe measurements</button><button id="probe-export" type="button" disabled>Export probe study</button></div><input id="probe-file" type="file" accept=".json,application/json" hidden>
 <p class="input-hint">Imports use worldlaw.probe-response/v1: 3 or more training runs, separate challenge runs, fixed preparation declarations and a fixed command/angle/rate within each run. Each run embeds the existing matched-pair notebook with at least four pairs per order. Source declarations are retained; no study is saved automatically.</p>
 <strong id="probe-state" role="status">NO STUDY</strong><p id="probe-summary"></p>
 <p id="probe-plot-hint" class="input-hint">Observed intervals are amber; predicted intervals retain their full width. On a narrow screen, scroll the plot horizontally or focus it and use arrow keys.</p><div class="probe-plot-scroll" tabindex="0" role="region" aria-label="Scrollable probe prediction comparison" aria-describedby="probe-plot-hint"><svg id="probe-plot" viewBox="0 0 820 350" role="img" aria-label="Separate observed probe contrasts against frozen hypothesis prediction intervals"></svg></div>
 <div class="table-wrap"><table><caption>Training-only coefficient intervals · declared coefficient bounds −100 to 100 in the listed units</caption><thead><tr><th>Hypothesis</th><th>Training</th><th>Coefficient interval</th><th>All challenges</th></tr></thead><tbody id="probe-models"></tbody></table></div>
 <div id="probe-challenges" aria-live="polite"></div><details><summary>Challenge explicit mixed responses</summary><p>Exploratory offset/rate/sine combinations use training-only equal-weight fits. More training runs than coefficients are required. These are point predictions; failed representatives do not exclude the whole coefficient family.</p><div id="probe-mixtures" aria-live="polite"></div></details><p id="probe-error" role="alert"></p>
 <p class="annotation">Screening bounds are not calibrated confidence. Compatible rate or angle response does not prove friction, restoring forces or physical memory. Mixed responses, nonlinear instrument drift and confounding remain possible. Changing training recomputes the model; challenge values only test frozen predictions.</p>`;
 document.querySelector('.scientific-limit').before(section);
 const $=id=>section.querySelector('#'+id);let study=null,readVersion=0,consistencyConfig=null;
 function adopt(next,config=null){const result=analyzeProbeStudy(next);study=next;consistencyConfig=config;render(result);$('probe-export').disabled=false;$('probe-error').textContent='';document.dispatchEvent(new CustomEvent('worldlaw-probe-study-change'));}
 function render(r){
  $('probe-state').textContent=r.fit.status.toUpperCase().replaceAll('-',' ');
  $('probe-summary').textContent=`${r.source??'No'} evidence · preparation ${study.preparation.id}, ${study.preparation.duration}s; recovery ${study.preparation.recovery}s. `+(r.fit.reasons.join(' ')||'Predictions below use training-only coefficients; failed alternatives remain visible.');
  $('probe-models').replaceChildren();for(const c of r.fit.candidates){const tr=document.createElement('tr');for(const value of [c.label,c.compatible?(c.excited?'compatible':'compatible / unexcited'):'contradicted',c.coefficientInterval?c.coefficientInterval.map(fmt).join(' to ')+' '+c.units:'—',r.jointChallenges.find(j=>j.id===c.id)?.status??'not predicted']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('probe-models').append(tr);}
  $('probe-challenges').replaceChildren();for(const p of r.challenges){const text=document.createElement('p');text.textContent=p.id+': angle '+fmt(p.probe.position)+' rad, rate '+fmt(p.probe.rate)+' rad/s; observed ['+p.interval.map(fmt).join(', ')+'] N·m. '+p.predictions.map(c=>c.id+' ['+c.interval.map(fmt).join(', ')+'] '+c.status).join('; ');$('probe-challenges').append(text);}renderMixtures();draw(r);
 }
 function renderMixtures(){
  const target=$('probe-mixtures');target.replaceChildren();
  const result=analyzeProbeMixtures(study);
  mountProbeMixtureConsistency(target,study,consistencyConfig,{begin:()=>++readVersion,current:version=>version===readVersion,adopt:raw=>adopt(raw.study,raw)});
  for(const candidate of result.candidates){
   const title=document.createElement('h3');title.textContent=candidate.id+' · '+candidate.status;target.append(title);
   const detail=document.createElement('p');detail.textContent=candidate.coefficients?candidate.labels.map((label,i)=>label+': '+fmt(candidate.coefficients[i])).join('; '):candidate.reason??'No admitted fit.';if(candidate.coefficients&&candidate.reason)detail.textContent+=' '+candidate.reason;target.append(detail);
   for(const [role,rows] of [['Training',candidate.training??[]],['Separate challenge',candidate.challenges??[]]])for(const row of rows){
    const p=document.createElement('p');p.textContent=role+' '+row.id+' · prediction '+fmt(row.prediction)+' N·m; observed ['+row.interval.map(fmt).join(', ')+']; residual '+fmt(row.residual)+' · '+row.status;target.append(p);
   }
  }
  const note=document.createElement('p');note.textContent=result.interpretation;target.append(note);
 }
 function draw(r){
  const svg=$('probe-plot'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const pts=r.challenges;if(!pts.length)return;
  const values=pts.flatMap(p=>[...p.interval,...p.predictions.flatMap(c=>c.interval)]),lo=Math.min(0,...values),hi=Math.max(.1,...values),pad=(hi-lo)*.1;
  const Y=v=>285-(v-lo+pad)/(hi-lo+2*pad)*240;
  const node=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);};
  const colors={'no-change':'#d5dce2',offset:'#ff6fb5',drag:'#5df5df',restoring:'#ad9cff'};
  node('line',{x1:55,x2:800,y1:Y(0),y2:Y(0),stroke:'#617e8b'});
  for(let i=0;i<pts.length;i++){
   const p=pts[i],x=65+(i+.5)*730/pts.length;
   node('line',{x1:x,x2:x,y1:Y(p.interval[0]),y2:Y(p.interval[1]),stroke:'#ffad5c','stroke-width':7});node('circle',{cx:x,cy:Y(p.observed),r:5,fill:'#ffad5c'});
   p.predictions.forEach((c,j)=>{const px=x+12+(j-p.predictions.length/2)*9;node('line',{x1:px,x2:px,y1:Y(c.interval[0]),y2:Y(c.interval[1]),stroke:colors[c.id],'stroke-width':4});});
   node('text',{x,y:307,fill:'#d5dce2','text-anchor':'middle'},'θ '+fmt(p.probe.position));node('text',{x,y:325,fill:'#d5dce2','text-anchor':'middle'},'ω '+fmt(p.probe.rate));
  }
  node('text',{x:20,y:18,fill:'#d5dce2'},'Torque contrast N·m · amber observed / cyan rate / violet sine / pink offset / white zero');
  for(const v of [lo,hi])node('text',{x:5,y:Y(v),fill:'#d5dce2'},fmt(v));
 }
 $('probe-example').onclick=()=>{readVersion++;try{adopt(probeExample($('probe-example-kind').value));}catch(e){$('probe-error').textContent=e.message;}};
 $('probe-open').onclick=()=>$('probe-file').click();
 $('probe-file').onchange=async e=>{const version=++readVersion,file=e.target.files?.[0];if(!file)return;try{if(file.size>4000000)throw Error('Use JSON below 4 MB.');const next=importProbeStudy(await file.text());if(version===readVersion)adopt(next);}catch(error){if(version===readVersion)$('probe-error').textContent=error.message;}finally{e.target.value='';}};
 $('probe-export').onclick=()=>{if(!study)return;const url=URL.createObjectURL(new Blob([exportProbeStudy(study)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-probe-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return {getStudy:()=>study?structuredClone(study):null,adopt:next=>{readVersion++;adopt(next);}};
}

