import {planRateSineFollowups} from './probe-mixture-consistency.mjs';

const fmt=x=>Number(x.toPrecision(6)).toString();
const example=[
 {id:'rate-plus',rate:2,position:0,radius:.002,cost:1},
 {id:'rate-minus',rate:-2,position:0,radius:.002,cost:1},
 {id:'sine-plus',rate:0,position:Math.PI/2,radius:.002,cost:1},
 {id:'sine-minus',rate:0,position:-Math.PI/2,radius:.002,cost:1},
 {id:'coupled-plus',rate:1,position:Math.PI/2,radius:.002,cost:1},
 {id:'coupled-minus',rate:1,position:-Math.PI/2,radius:.002,cost:1}
];
const asNode=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountRateSineMinimax(host,getRequest,owner){
 const section=asNode('section');section.className='rate-sine-minimax';
 section.innerHTML="<style>\n.rate-sine-minimax{margin:24px 0;padding:clamp(16px,2.4vw,28px);max-width:100%;min-width:0;box-sizing:border-box;border:1px solid #4b7c85;background:linear-gradient(125deg,#0a2532,#123542 75%,#092330);color:#e8f6f5}\n.rate-sine-minimax[hidden]{display:none!important}\n.rate-sine-minimax h3{font-size:clamp(1.3rem,2.1vw,2rem);letter-spacing:-.025em;max-width:30ch;margin:7px 0 10px;line-height:1.17}\n.rate-sine-minimax p{overflow-wrap:anywhere}\n.rate-sine-minimax .mini-kicker{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#7df5d4;font-size:.77rem;font-weight:800;letter-spacing:.09em}\n.rate-sine-minimax .mini-kicker span:last-child{font-weight:500;color:#a6bec5}\n.rate-sine-minimax .mini-intro{font-size:.93rem;color:#c6d9df;line-height:1.45;max-width:70ch;margin:0 0 15px}\n.rate-sine-minimax .mini-main{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(235px,.85fr);gap:13px;align-items:stretch}\n.rate-sine-minimax .mini-figure{min-width:0;box-sizing:border-box;margin:0;padding:13px;background:#091f2a;border:1px solid #315c67}\n.rate-sine-minimax .mini-figure svg{display:block;width:100%;height:auto;max-height:340px}\n.rate-sine-minimax .mini-figure figcaption{font-size:.75rem;color:#aecbd1;line-height:1.4}\n.rate-sine-minimax .mini-legend{display:flex;flex-wrap:wrap;gap:10px 15px;font-size:.76rem;color:#d8e9ea}\n.rate-sine-minimax .mini-legend span{display:inline-flex;align-items:center;gap:7px}\n.rate-sine-minimax .mini-legend i{display:inline-block;width:10px;height:10px;border:2px solid #ffba7c;background:#7b4d2433}\n.rate-sine-minimax .mini-legend-future i{background:#1b8275;border-color:#78ffdf}\n.rate-sine-minimax .mini-outcome{min-width:0;border:1px solid #315c67;padding:clamp(13px,2.1vw,20px);background:#103641}\n.rate-sine-minimax .mini-eyebrow{font-size:.74rem;color:#c1d5dc;font-weight:750;letter-spacing:.08em}\n.rate-sine-minimax .mini-percent{font-size:clamp(2.8rem,5vw,4.7rem);line-height:1;font-weight:850;letter-spacing:-.06em;color:#7df5d4;margin:10px 0 5px}\n.rate-sine-minimax .mini-outcome h4{font-size:.98rem;margin:12px 0 8px;line-height:1.35}\n.rate-sine-minimax .mini-percent-label,.rate-sine-minimax .mini-selected-detail{font-size:.82rem;line-height:1.45;color:#c3d9dc;margin:0}\n.rate-sine-minimax .mini-state-pair{display:grid;gap:7px;margin:10px 0}\n.rate-sine-minimax .mini-state-picked{padding:8px 10px;border-left:3px solid #75f6d4;background:#19434b}\n.rate-sine-minimax .mini-state-picked strong{display:block;font-size:.86rem}\n.rate-sine-minimax .mini-state-picked span{display:block;font-size:.77rem;color:#bed8dc;margin-top:3px}\n.rate-sine-minimax .mini-widths{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}\n.rate-sine-minimax .mini-width{border:1px solid #375d68;min-width:0;padding:10px 12px}\n.rate-sine-minimax .mini-width-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;font-size:.8rem}\n.rate-sine-minimax .mini-width-head strong{font-variant-numeric:tabular-nums;color:#9cf7d9}\n.rate-sine-minimax .mini-track{height:8px;overflow:hidden;background:#33545e;margin-top:8px}\n.rate-sine-minimax .mini-residual{height:100%;background:#74e6c7}\n.rate-sine-minimax .mini-actions{display:flex;flex-wrap:wrap;align-items:end;gap:10px;padding:13px 0;border-top:1px solid #45626b;border-bottom:1px solid #45626b;margin-top:13px}\n.rate-sine-minimax .mini-actions label{display:flex;flex-direction:column;gap:5px;font-size:.76rem;color:#cee5e6}\n.rate-sine-minimax input,.rate-sine-minimax select{background:#071e29;color:#f4fffe;border:1px solid #5c8088;box-sizing:border-box;border-radius:3px;padding:9px;min-width:0;max-width:100%}\n.rate-sine-minimax .mini-actions input{width:95px}\n.rate-sine-minimax .mini-actions select{width:118px}\n.rate-sine-minimax button{background:#275e63;border:1px solid #6ac9b8;border-radius:3px;color:#f4fffd;min-height:38px;cursor:pointer;padding:9px 13px}\n.rate-sine-minimax button:disabled{cursor:not-allowed;opacity:.46}\n.rate-sine-minimax button:hover:not(:disabled){background:#30777b}\n.rate-sine-minimax .plan{background:#80f0d1;color:#06252e;border-color:#80f0d1;font-weight:850}\n.rate-sine-minimax .plan:hover:not(:disabled){background:#aeffe2;color:#06252e}\n.rate-sine-minimax button:focus-visible,.rate-sine-minimax input:focus-visible,.rate-sine-minimax select:focus-visible,.rate-sine-minimax summary:focus-visible{outline:3px solid #ffca7e;outline-offset:2px}\n.rate-sine-minimax .status{font-size:.78rem;margin:10px 0;color:#b5d4d7}\n.rate-sine-minimax .mini-editor{border:1px solid #3e5f6b;margin-top:13px;max-width:100%;overflow-x:hidden}\n.rate-sine-minimax .mini-editor summary{background:#183c47;cursor:pointer;padding:13px;font-size:.87rem;font-weight:700}\n.rate-sine-minimax .mini-editor .mini-editor-content{padding:14px}\n.rate-sine-minimax .mini-editor p{margin:0 0 12px;font-size:.8rem;color:#c1d8db}\n.rate-sine-minimax .states{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:9px}\n.rate-sine-minimax .state{min-width:0;background:#0f2f3c;border-top:2px solid #60aaa3;padding:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:end}\n.rate-sine-minimax .state label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;min-width:0}\n.rate-sine-minimax .state input{width:100%;padding:7px;font-size:.84rem}\n.rate-sine-minimax .state label:first-child,.rate-sine-minimax .state button{grid-column:span 3}\n.rate-sine-minimax .state button{font-size:.78rem;padding:7px;min-height:33px;justify-self:start;background:#38515b;border-color:#687f84}\n.rate-sine-minimax .mini-editor-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}\n.rate-sine-minimax .mini-candidates{max-width:100%;overflow-x:auto;border:1px solid #3e5f6b;margin-top:12px}\n.rate-sine-minimax .mini-candidates summary{cursor:pointer;padding:10px;font-size:.8rem}\n.rate-sine-minimax .mini-candidates table{min-width:550px;width:100%;font-size:.77rem}\n.rate-sine-minimax .mini-candidates th,.rate-sine-minimax .mini-candidates td{padding:7px;text-align:left;border-bottom:1px solid #3e5f6b}\n.rate-sine-minimax .mini-candidates th{color:#a8f1dc}\n.rate-sine-minimax .mini-limit{font-size:.76rem;color:#aac5cc;line-height:1.45;margin:12px 0 0}\n.rate-sine-minimax .mini-empty{padding:20px;border:1px solid #a88753;color:#ffe3c2}\n@media(max-width:760px){.rate-sine-minimax .mini-main{grid-template-columns:minmax(0,1fr)}.rate-sine-minimax .mini-outcome{display:grid;grid-template-columns:110px minmax(0,1fr);gap:0 15px}.rate-sine-minimax .mini-outcome .mini-eyebrow,.rate-sine-minimax .mini-outcome .mini-percent,.rate-sine-minimax .mini-outcome .mini-percent-label{grid-column:1}.rate-sine-minimax .mini-outcome h4,.rate-sine-minimax .mini-outcome .mini-state-pair,.rate-sine-minimax .mini-outcome .mini-selected-detail{grid-column:2}.rate-sine-minimax .mini-outcome h4{margin:0}}\n@media(max-width:440px){.rate-sine-minimax h3{font-size:1.3rem}.rate-sine-minimax .mini-outcome{display:block}.rate-sine-minimax .mini-outcome h4{margin:13px 0 8px}.rate-sine-minimax .mini-percent{font-size:3.3rem}.rate-sine-minimax .mini-widths{grid-template-columns:minmax(0,1fr)}.rate-sine-minimax .mini-actions label{flex:1}.rate-sine-minimax .mini-kicker{font-size:.68rem}}\n@media(prefers-reduced-motion:reduce){.rate-sine-minimax *{transition:none!important;animation:none!important}}\n</style>\n<div class=\"mini-kicker\"><span>MECHANISM DIFFERENCE / 02</span><span>Hypothetical • bounded noise</span></div>\n<h3>Which next observation makes competing laws disagree?</h3>\n<p class=\"mini-intro\">Compare all pairs of laws still compatible with the original measurements. The turquoise silhouette is the ambiguity any bounded-noise future reading could still leave—not a simulated observation.</p>\n<div class=\"results\" aria-live=\"polite\"></div>\n<div class=\"mini-actions\"><label>Effort budget<input class=\"budget\" type=\"number\" min=\"0\" step=\"any\" value=\"2\"></label><label>Readouts<select class=\"count\"><option value=\"2\">Up to two</option><option value=\"1\">One</option></select></label><button class=\"plan\" type=\"button\">Recalculate</button><button class=\"download\" type=\"button\" disabled>Save source + plan JSON</button></div>\n<p class=\"status\" role=\"status\">No future outcomes entered.</p>\n<details class=\"mini-editor\"><summary>Edit six candidate states, noise assumptions and costs</summary><div class=\"mini-editor-content\"><p>Each proposed state declares speed ω (rad/s), angle θ (rad), future absolute contrast error radius (N·m), and effort. The editable 0.002 N·m default is a hypothetical future sensor assumption, not measured instrument accuracy.</p><div class=\"states\" role=\"group\" aria-label=\"Hypothetical future input states\"></div><div class=\"mini-editor-buttons\"><button type=\"button\" class=\"add\">Add state</button><button type=\"button\" class=\"restore\">Restore six states</button></div></div></details>\n<p class=\"mini-limit\">Conditional virtual plan only. No actuator control or acquired future measurement. Unmodeled terms, inaccurate noise limits and unsafe physical states remain possible; this does not identify a structural mechanism.</p>";
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
 function visible(enabled){section.hidden=!enabled;if(enabled){owner.begin();$('.plan').click();}else invalidate();}
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
 $('.add').onclick=()=>{try{add({id:'offer-'+(++serial),rate:0,position:0,radius:.002,cost:1});invalidate();}catch(e){$('.status').textContent=e.message;}};
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
