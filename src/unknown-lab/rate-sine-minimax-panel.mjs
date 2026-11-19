import {planRateSineFollowups} from './probe-mixture-consistency.mjs';

const fmt=x=>Number(x.toPrecision(6)).toString();
const example=[
 {id:'rate-plus',rate:2,position:0,radius:.02,cost:1},
 {id:'rate-minus',rate:-2,position:0,radius:.02,cost:1},
 {id:'sine-plus',rate:0,position:Math.PI/2,radius:.02,cost:1},
 {id:'sine-minus',rate:0,position:-Math.PI/2,radius:.02,cost:1},
 {id:'coupled-plus',rate:1,position:Math.PI/2,radius:.02,cost:1},
 {id:'coupled-minus',rate:1,position:-Math.PI/2,radius:.02,cost:1}
];
const asNode=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountRateSineMinimax(host,getRequest,owner){
 const section=asNode('section');section.className='rate-sine-minimax';
 section.innerHTML='<style>.rate-sine-minimax{margin:20px 0;padding:20px;border:1px solid #50808b;background:linear-gradient(125deg,#0b2734,#132536);color:#e8f5f5;max-width:100%;box-sizing:border-box}.rate-sine-minimax p{max-width:80ch}.rate-sine-minimax .states{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}.rate-sine-minimax .state{padding:12px;border-left:3px solid #6cdac0;background:#102f3d;min-width:0}.rate-sine-minimax label{display:inline-flex;flex-direction:column;gap:4px;margin-right:10px;font-size:.93rem}.rate-sine-minimax input,.rate-sine-minimax select{max-width:160px;min-width:0;box-sizing:border-box}.rate-sine-minimax .state input{max-width:108px}.rate-sine-minimax button:focus-visible,.rate-sine-minimax input:focus-visible{outline:3px solid #f7cb71;outline-offset:2px}.rate-sine-minimax .width-line{margin:12px 0}.rate-sine-minimax .width-track{height:12px;background:#355365;position:relative;overflow:hidden}.rate-sine-minimax .width-fill{height:100%;background:linear-gradient(90deg,#68e3bc,#f7ce75)}.rate-sine-minimax .small{font-size:.88rem;color:#bed7df}.rate-sine-minimax details{max-width:100%;overflow-x:auto;overflow-wrap:anywhere}.rate-sine-minimax table{min-width:550px;width:100%}</style><h3>Find the next two measurements that make competing laws disagree</h3><p>Compare complete possible rate–sine coefficient sets, not just one best fit. For every proposed pair of readings, compute the largest ambiguity any bounded-noise outcomes could still leave. All offers below are <strong>hypothetical input states, not verified safe or achievable actions</strong>.</p><div class="states"></div><p><button type="button" class="add">Add hypothetical state</button> <button type="button" class="restore">Restore six comparison states</button></p><div><label>Declared effort budget<input class="budget" type="number" min="0" step="any" value="2"></label><label>Reading count<select class="count"><option value="2">Up to 2 readings</option><option value="1">One reading</option></select></label></div><p class="small">Every state declares angle θ (rad), speed ω (rad/s), per-readout absolute noise radius (N·m), and effort cost. The default 0.02 N·m is an editable assumption, NOT measured sensor performance. Ranking is over only these offers; it does not drive a physical actuator.</p><button type="button" class="plan">Calculate worst-case remaining ambiguity</button> <button type="button" class="download" disabled>Download complete reproducible plan</button><p class="status" role="status">No future outcomes entered.</p><div class="results"></div><p class="warning small">Exact rational geometry treats the computed binary64 sine coordinates as exact; uncertainty in angle, state preparation, noise limits, and model-family completeness is not covered. A small future width does not prove a coefficient is nonzero or identify the true physical mechanism.</p>';
 host.append(section);
 const $=selector=>section.querySelector(selector);let serial=0,report=null;
 const keys=[['id','Offer ID','text'],['rate','Speed ω','number'],['position','Angle θ','number'],['radius','Noise ±','number'],['cost','Effort','number']];
 function add(row){
  if($('.states').children.length>=16)throw Error('At most 16 distinct states.');
  const box=asNode('div');box.className='state';
  for(const [key,label,type] of keys){
   const wrapper=asNode('label',label),input=asNode('input');input.dataset.key=key;input.type=type;
   if(type==='number')input.step='any';input.value=String(row[key]);wrapper.append(input);box.append(wrapper);
   input.addEventListener('input',invalidate);
  }
  const remove=asNode('button','Remove state');remove.type='button';
  remove.onclick=()=>{box.remove();invalidate();};box.append(remove);
  $('.states').append(box);
 }
 function inputs(){
  return [...$('.states').children].map(box=>{
   const out={};
   for(const input of box.querySelectorAll('input')){
    const key=input.dataset.key;
    if(!input.value.trim())throw Error('Complete every field before comparing.');
    out[key]=key==='id'?input.value.trim():Number(input.value);
   }
   return out;
  });
 }
 function clear(){report=null;$('.download').disabled=true;$('.results').replaceChildren();}
 function invalidate(){
  clear();$('.status').textContent='Candidate inputs changed · recompute before choosing a state';
 }
 function visible(enabled){section.hidden=!enabled;if(!enabled)invalidate();}
 function render(p){
  const root=$('.results');root.replaceChildren();
  if(p.status!=='computed'){root.append(asNode('p','Result: '+p.status+'. No empirical outcome or model identity inferred.'));return;}
  const chosen=p.selected;
  root.append(asNode('h4','Best conditional course: '+chosen.offers.join(' → ')));
  root.append(asNode('p','Effort '+fmt(chosen.cost)+'; worst-axis ambiguity fraction '+fmt(chosen.worstFraction)+'. The original maximum coefficient projection width is not a confidence interval.'));
  for(const [name,before,after] of [['Rate coefficient',p.originalWidths[0],chosen.rateWidth],['Restoring sine coefficient',p.originalWidths[1],chosen.sineWidth]]){
   const row=asNode('div');row.className='width-line';
   row.append(asNode('div',name+': '+fmt(before)+' → at most '+fmt(after)+' (worst possible future outcomes)'));
   const track=asNode('div');track.className='width-track';
   const bar=asNode('div');bar.className='width-fill';bar.style.width=(before>0?Math.max(0,Math.min(100,100*after/before)):0)+'%';
   track.append(bar);row.append(track);root.append(row);
  }
  const collinear=p.courses.find(c=>c.offers.length===2&&c.offers.every(id=>{
   const a=p.source.offers.find(x=>x.id===id);return Math.abs(Math.sin(a.position))<1e-12;
  }));
  if(collinear)root.append(asNode('p','Equal-cost parallel-speed control: worst-axis fraction '+fmt(collinear.worstFraction)+'. This highlights why repeated readings along one feature cannot identify the other coefficient.'));
  const details=asNode('details'),summary=asNode('summary','Inspect every affordable one- and two-reading course ('+p.courses.length+')');details.append(summary);
  const table=asNode('table'),thead=asNode('thead'),tr=asNode('tr');
  for(const col of ['Future readings','Cost','Worst fraction','Rate diameter','Sine diameter'])tr.append(asNode('th',col));
  thead.append(tr);table.append(thead);
  const body=asNode('tbody');
  for(const c of [...p.courses].sort((a,b)=>a.worstFraction-b.worstFraction||a.cost-b.cost)){
   const r=asNode('tr');
   for(const v of [c.offers.join('+'),fmt(c.cost),fmt(c.worstFraction),fmt(c.rateWidth),fmt(c.sineWidth)])r.append(asNode('td',v));
   body.append(r);
  }
  table.append(body);details.append(table);root.append(details);
  root.append(asNode('p',p.assumptions));
 }
 $('.add').onclick=()=>{try{add({id:'offer-'+(++serial),rate:0,position:0,radius:.02,cost:1});invalidate();}catch(e){$('.status').textContent=e.message;}};
 $('.restore').onclick=()=>{$('.states').replaceChildren();example.forEach(add);invalidate();};
 $('.budget').addEventListener('input',invalidate);$('.count').addEventListener('change',invalidate);
 $('.plan').onclick=()=>{
  owner.begin();
  try{
   const p=planRateSineFollowups(getRequest(),inputs(),{budget:Number($('.budget').value),maxReadings:Number($('.count').value)});
   report=p;$('.download').disabled=p.status!=='computed';$('.status').textContent=p.status==='computed'?'Prospective geometry computed from the selected original evidence; no new readings acquired.':'No qualified plan · '+p.status;
   render(p);
  }catch(e){clear();$('.status').textContent='Cannot calculate: '+e.message;}
 };
 $('.download').onclick=()=>{
  if(!report)return;
  const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=asNode('a');
  a.href=url;a.download='worldlaw-minimax-prospective-law-course.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 example.forEach(add);
 return {invalidate,visible};
}
