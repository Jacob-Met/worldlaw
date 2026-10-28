import {MODEL_SCHEMA,compareReferenceExperiments,validateReferenceModels} from './reference-models.mjs';
import {mountReferenceRequest} from './reference-request-panel.mjs';
export function mountReferenceModels(host,getStudy){
 const node=document.createElement('section');node.id='reference-model-comparison';
 node.innerHTML=`<h3>What could an additional response explain?</h3><p>Compare an artifact-only explanation with a bounded additional saturation response. Every explanation keeps one gain and amplitude across all runs.</p>
 <form id="rm-form"><div class="ref-controls"><label>Amplitude minimum (N·m)<input name="amin" type="number" step="any" value="0" min="-100" max="100" required></label><label>Amplitude maximum (N·m)<input name="amax" type="number" step="any" value="1" min="-100" max="100" required></label><label>Offered tau values (s, comma separated)<input name="taus" value="0.5,1.5,3" required></label></div>
 <h4>Offer conditions for the next acquisition</h4><p>Anticipated reference contrasts and future precision are assumptions. This instrument cannot establish that a physical intervention can achieve them.</p>
 <div class="ref-table"><table><thead><tr><th>Condition</th><th>Duration (s)</th><th>Reference minimum</th><th>Reference maximum</th><th>Future main radius</th><th></th></tr></thead><tbody id="rm-offers"></tbody></table></div><button type="button" id="rm-add">Add offered condition</button> <button>Compare explanations and conditions</button></form>
 <div class="ref-controls"><button id="rm-save" type="button">Save comparison inputs</button><label>Reopen comparison<input id="rm-file" type="file" accept=".json"></label></div>
 <p id="rm-source" class="ref-warning">Source: current parent reference instrument.</p><p id="rm-status" role="status">No comparison yet.</p><div id="rm-result"></div><p id="rm-error" role="alert"></p>
 <p class="ref-warning">Finite offered tau values and bounded coefficients only. Computed binary64 feasible polygons include a numerical guard; they are not certified enclosures or calibrated confidence. An additional-response family containing zero amplitude can remain indistinguishable from artifact alone.</p>`;
 host.append(node);const $=s=>node.querySelector(s);let revision=0,saved=null,nextId=0,importedStudy=null;
 function sourceBanner(){const text=importedStudy?'Source: reopened comparison study · '+importedStudy.runs.length+' paired runs · acquisition IDs: '+importedStudy.runs.map(r=>r.main.acquisitionId+' / '+r.reference.acquisitionId).join('; ')+'. The parent instrument above is unchanged; calculations continue to use these reopened originals.':'Source: current parent reference instrument.';$('#rm-source').textContent=text;}
 function retire(){sourceBanner();revision++;saved=null;node.dispatchEvent(new Event('reference-comparison-changed'));$('#rm-result').replaceChildren();$('#rm-status').textContent='Inputs changed · compare again.';}
 function add(o={duration:1,referenceInterval:[-.01,.01],radius:.02}){
  const tr=document.createElement('tr');if(!o.id){do{o.id='condition-'+(++nextId);}while([...$('#rm-offers').children].some(x=>x.dataset.id===o.id));}tr.dataset.id=o.id;
  const label=document.createElement('td');label.textContent=tr.dataset.id;tr.append(label);
  for(const [name,value] of [['duration',o.duration],['rmin',o.referenceInterval[0]],['rmax',o.referenceInterval[1]],['radius',o.radius]]){
   const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.step='any';input.required=true;input.name=name;input.value=value;input.setAttribute('aria-label',tr.dataset.id+' '+name);td.append(input);tr.append(td);
  }
  const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Remove';button.onclick=()=>{tr.remove();retire();};td.append(button);tr.append(td);$('#rm-offers').append(tr);
 }
 function settings(){const f=new FormData($('#rm-form'));return {schema:MODEL_SCHEMA,study:importedStudy||getStudy(),amplitudeBounds:[Number(f.get('amin')),Number(f.get('amax'))],taus:String(f.get('taus')).split(',').map(x=>x.trim()?Number(x):NaN)};}
 function offers(){return [...$('#rm-offers').children].map(tr=>{const n=k=>{const v=tr.querySelector('[name='+k+']').value;if(!v.trim())throw Error('Complete every offered condition.');return Number(v);};return {id:tr.dataset.id,duration:n('duration'),referenceInterval:[n('rmin'),n('rmax')],radius:n('radius')};});}
 function show(input,offered){
  sourceBanner();
  const r=compareReferenceExperiments(input,offered);
  saved={schema:'worldlaw.reference-model-comparison-input/v1',input:validateReferenceModels(input),offers:structuredClone(offered)};
  $('#rm-status').textContent=r.recommendation?'Most separating offered condition: '+r.recommendation:'No offered condition separates the surviving explanations.';
  const out=$('#rm-result');out.replaceChildren();
  for(const m of r.analysis.models){const p=document.createElement('p');p.textContent=m.id+(m.tau===null?'':' · tau '+m.tau+' s')+' — training '+m.training.status+'; joint challenge '+m.joint.status;out.append(p);}
  for(const c of r.comparisons){const section=document.createElement('section'),h=document.createElement('h4');h.textContent=c.id+' · '+c.duration+' s · '+c.separatedPairs+'/'+c.totalPairs+' pairs separated';section.append(h);
   const NS='http://www.w3.org/2000/svg',width=Math.max(240,Math.min(900,host.clientWidth||900)),height=55+48*c.predictions.length;
   const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('role','img');svg.setAttribute('aria-label','Predicted main contrasts for '+c.id+' under the offered reference range');
   const vals=c.predictions.flatMap(p=>p.intervals.flat()),lo=Math.min(0,...vals),hi=Math.max(.01,...vals),left=width<500?100:160,span=width-left-25,X=v=>left+(v-lo)/(hi-lo)*span;
   function draw(tag,attrs,text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);}
   draw('line',{x1:X(0),x2:X(0),y1:10,y2:height-25,stroke:'#668d95','stroke-dasharray':'4 4'});
   c.predictions.forEach((p,i)=>{const y=25+i*48,color=i===0?'#62e9e4':'#ffc26c';draw('text',{x:5,y:y+4,fill:color,'font-size':12},p.id);for(const a of p.intervals){draw('line',{x1:X(a[0]),x2:X(a[1]),y1:y,y2:y,stroke:color,'stroke-width':6});for(const v of a)draw('line',{x1:X(v),x2:X(v),y1:y-7,y2:y+7,stroke:color,'stroke-width':2});}});
   for(const v of [lo,(lo+hi)/2,hi])draw('text',{x:X(v),y:height-5,fill:'#c5e8eb','font-size':12,'text-anchor':'middle'},Number(v.toPrecision(3)));
   section.append(svg);
   for(const p of c.predictions){const row=document.createElement('p');row.textContent=p.id+': '+p.intervals.map(a=>'['+a.map(x=>Number(x.toPrecision(6))).join(', ')+']').join(' ∪ ')+' N·m';section.append(row);}
   out.append(section);
  }
  $('#rm-error').textContent='';revision++;node.dispatchEvent(new Event('reference-comparison-changed'));
 }
 $('#rm-form').oninput=retire;$('#rm-form').onsubmit=e=>{e.preventDefault();retire();try{show(settings(),offers());}catch(x){$('#rm-error').textContent=x.message;}};
 $('#rm-add').onclick=()=>{if($('#rm-offers').children.length>=32)return;add();retire();};
 // A change in the original channel instrument invalidates downstream claims.
 $('#rm-save').onclick=()=>{if(!saved){$('#rm-error').textContent='Compare valid inputs before saving.';return;}const u=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='worldlaw-reference-model-comparison.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 $('#rm-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;retire();const token=revision;try{if(file.size>4000000)throw Error('Use comparison JSON below4MB.');const text=await file.text();if(token!==revision)return;const raw=JSON.parse(text);if(raw.schema!=='worldlaw.reference-model-comparison-input/v1')throw Error('Wrong comparison schema.');
 // Validate and compute everything before replacing visible controls.
 const input=validateReferenceModels(raw.input);compareReferenceExperiments(input,raw.offers);
 if(token!==revision)return;
 importedStudy=input.study;$('#rm-form [name=amin]').value=input.amplitudeBounds[0];$('#rm-form [name=amax]').value=input.amplitudeBounds[1];$('#rm-form [name=taus]').value=input.taus.join(',');
 $('#rm-offers').replaceChildren();for(const offer of raw.offers)add(offer);show(input,raw.offers);
 $('#rm-status').textContent+=' Reopened original study is retained in this comparison; the channel instrument above is unchanged.';
 }catch(x){if(token===revision)$('#rm-error').textContent=x.message;}finally{e.target.value='';}};
 host.addEventListener('reference-study-changed',()=>{importedStudy=null;retire();});
 add();add({duration:3,referenceInterval:[-.01,.01],radius:.02});
 mountReferenceRequest(node,()=>saved);
}
