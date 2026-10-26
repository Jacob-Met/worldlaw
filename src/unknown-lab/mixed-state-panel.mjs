import {MIXED_SCHEMA,analyzeMixedStudy,exportMixedStudy,importMixedStudy} from './mixed-state-response.mjs';
import {importNotebook} from './paired-history.mjs';
const fmt=v=>Number.isFinite(v)?Number(v.toPrecision(5)).toString():'—';
export function mountMixedStateResponse(getNotebook){
 const section=document.createElement('section');section.className='duration-investigation';section.id='mixed-state-response';
 section.innerHTML=`<p class="overline">MIXED STATES / FOLLOW THE RESPONSE THAT CANCELS</p><h2>What disappears in the average?</h2>
 <p>A preparation effect may reverse with command, angle or rate. Compare executable conditional responses directly from the original mixed-state pairs. The original mean screen remains visible; no fixed-state regrouping is required.</p>
 <label>Shared fixed preparation and readout protocol <input id="mixed-protocol" maxlength="1000" placeholder="Describe the preparation and matching arrangement shared by both courses"></label>
 <div class="secondary-actions"><button id="mixed-fit" type="button">Freeze models from current pairs</button><button id="mixed-save" type="button" disabled>Save original comparison</button></div>
 <label>Receive a separately acquired history notebook <input id="mixed-challenge" type="file" accept=".json,application/json" disabled></label>
 <label>Reopen original comparison <input id="mixed-open" type="file" accept=".json,application/json"></label>
 <p id="mixed-status" role="status">No conditional response frozen.</p><p id="mixed-error" role="alert"></p><p id="mixed-meaning" class="annotation"></p>
 <div id="mixed-plot" tabindex="0" aria-label="Scrollable separate prediction comparison" style="max-width:100%;overflow-x:auto"></div><div class="table-wrap"><table><caption>All sixteen offered response structures; drift is fitted jointly in each</caption><thead><tr><th>Response terms</th><th>Training outcome</th><th>Training RMSE</th><th>Separate course RMSE</th></tr></thead><tbody id="mixed-rows"></tbody></table></div>
 <details><summary>Frozen executable coefficients and original-source assumptions</summary><pre id="mixed-law" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details>`;
 document.querySelector('main').append(section);
 const $=id=>section.querySelector('#mixed-'+id);let study=null,report=null,epoch=0;
 function invalidate(){epoch++;study=null;report=null;$('save').disabled=true;$('challenge').disabled=true;$('rows').replaceChildren();$('plot').replaceChildren();$('law').textContent='';$('meaning').textContent='';$('error').textContent='';$('status').textContent='Source or protocol changed; freeze a new training comparison.';}
 function fail(error){$('error').textContent=error.message??String(error);}
 function render(next){
  const r=analyzeMixedStudy(next);study=r.source;report=r;$('save').disabled=false;$('challenge').disabled=false;$('error').textContent='';
  $('status').textContent=`${r.source.training.source==='synthetic'?'Declared simulation':'User-declared measurements'} · ${r.fit.count} original training pairs · selected ${r.fit.selected?.id??'none'}. Original mean screen: ${r.fit.original.verdict}. ${r.source.challenge?'Separate course scored without refitting.':'Training only; no separate prediction evidence.'}`;
  if(r.source.challenge){const selected=r.tests.find(t=>t.id===r.fit.selected?.id),constant=r.tests.find(t=>t.id==='offset');$('status').textContent+=' Separate-course RMSE: selected '+fmt(selected?.rmse)+' N·m; constant baseline '+fmt(constant?.rmse)+' N·m.';}
  $('meaning').textContent='Training residual screen: '+r.fit.trainingScreen.status+' (RMS threshold '+fmt(r.fit.trainingScreen.threshold)+' N·m). '+r.fit.trainingScreen.meaning+' '+r.fit.selection+' '+r.qualification;
  $('law').textContent=JSON.stringify(r.fit.selected,null,2);$('rows').replaceChildren();
  for(const c of r.fit.candidates){const tr=document.createElement('tr'),t=r.tests.find(t=>t.id===c.id);for(const text of [c.id+(c===r.fit.selected?' · selected':''),c.status,fmt(c.rmse),t? t.status==='scored'?fmt(t.rmse):t.status:'not received']){const td=document.createElement('td');td.textContent=text;tr.append(td);} $('rows').append(tr);}
  $('plot').replaceChildren();const points=r.tests.find(t=>t.id===r.fit.selected?.id)?.points;if(!points)return;
  const constant=r.tests.find(t=>t.id==='offset')?.points;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 820 320');svg.setAttribute('role','img');svg.setAttribute('aria-label','Separate original paired differences in amber, frozen selected predictions in cyan and constant response baseline in dashed white. All predictions include their frozen drift.');
  svg.style.minWidth='760px';
  const values=[...points.flatMap(p=>[p.observed,p.prediction]),...(constant?.map(p=>p.prediction)??[])];let low=Math.min(...values),high=Math.max(...values);const pad=Math.max(.05,(high-low)*.12);low-=pad;high+=pad;
  const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);};
  const x=i=>60+700*i/Math.max(1,points.length-1),y=v=>250-210*(v-low)/(high-low);
  for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;add('line',{x1:60,x2:760,y1:y(v),y2:y(v),stroke:'#315460'});add('text',{x:54,y:y(v)+5,fill:'#a5cbd0','text-anchor':'end','font-size':13},fmt(v));}
  add('polyline',{points:points.map((p,i)=>x(i)+','+y(p.prediction)).join(' '),fill:'none',stroke:'#5df5df','stroke-width':2});
  if(constant)add('polyline',{points:constant.map((p,i)=>x(i)+','+y(p.prediction)).join(' '),fill:'none',stroke:'#e6ebef','stroke-dasharray':'5 5','stroke-width':1.5});
  points.forEach((p,i)=>add('circle',{cx:x(i),cy:y(p.observed),r:3,fill:'#ffad5c'}));add('text',{x:60,y:285,fill:'#cceded','font-size':14},'Separate pairs in original order · amber observed, cyan selected · N·m');add('text',{x:60,y:308,fill:'#cceded','font-size':14},'Dashed white: constant response baseline. Both forecasts include frozen drift.');$('plot').append(svg);
 }
 $('protocol').addEventListener('input',invalidate);
 $('fit').onclick=()=>{invalidate();try{render({schema:MIXED_SCHEMA,protocol:$('protocol').value,training:getNotebook(),challenge:null});}catch(e){fail(e);}};
 $('challenge').onchange=async()=>{const file=$('challenge').files[0];$('challenge').value='';if(!file||!study)return;const token=++epoch,original=structuredClone(study);try{if(file.size>200000)throw Error('Use a history notebook at most200KB.');const challenge=importNotebook(await file.text());if(token!==epoch)return;render({...original,challenge});}catch(e){if(token===epoch)fail(e);}};
 $('open').onchange=async()=>{const file=$('open').files[0];$('open').value='';if(!file)return;invalidate();const token=epoch;try{if(file.size>1000000)throw Error('Use a comparison at most1MB.');const next=importMixedStudy(await file.text());if(token!==epoch)return;render(next);$('protocol').value=next.protocol;}catch(e){if(token===epoch)fail(e);}};
 $('save').onclick=()=>{if(!study)return;const url=URL.createObjectURL(new Blob([exportMixedStudy(study)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-mixed-state-response.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return {invalidate};
}
