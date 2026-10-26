import {compareVelocityStudy,readVelocityStudy,exportVelocityStudy} from './velocity-comparison.mjs';
import {createVelocityExample} from './velocity-example.mjs';
const fmt=x=>typeof x==='number'&&Number.isFinite(x)?(x===0?'0':Math.abs(x)<.01||Math.abs(x)>=1e5?x.toExponential(4):x.toPrecision(6)):'—';
const familyNames={diagonal:'Diagonal loss',symmetric:'Symmetric loss',skew:'Symmetric loss + skew'};
const colors={diagonal:'#efb55a',symmetric:'#62c5ed',skew:'#a0dfa8'};
function el(tag,text,attrs={}){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function svg(tag,attrs={},text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
export function mountVelocityComparison(host){
 const field=(id,label,value)=>'<label>'+label+'<input id="'+id+'" type="number" min="1" step="1" value="'+value+'"></label>';
 host.innerHTML=[
 '<details id="velocity-lab"><summary>Could a no-work velocity term explain the balance?</summary>',
 '<p>Compare three explicitly offered constant laws: diagonal loss, symmetric loss, and symmetric loss plus a skew velocity term G. Every family fits the original training source. A fitted G does not establish a physical gyroscope or identify its cause.</p>',
 '<div class="velocity-actions"><label>Authored control<select id="velocity-example-kind"><option value="two-frequency">Two training frequencies</option><option value="single-uniform">One frequency · uniform samples</option><option value="single-irregular">One frequency · irregular samples</option><option value="no-skew">No skew term</option><option value="omitted-force">Omitted force</option></select></label><button id="velocity-example" type="button">Load authored control</button>',
 '<label>Open original velocity study<input id="velocity-file" type="file" accept=".json,application/json"></label><button id="velocity-save" type="button" disabled>Download original study</button></div>',
 '<p id="velocity-source">No velocity study loaded.</p><details><summary>Inspect declared torque and source correspondence</summary><p id="velocity-torque-declaration"></p><p id="velocity-correspondence"></p></details><form id="velocity-form"><div class="velocity-fields">',
 field('velocity-training-width','Training window rows',81),field('velocity-training-stride','Training stride',40),
 field('velocity-challenge-width','Separate window rows',81),field('velocity-challenge-stride','Separate stride',40),
 '<label>Separate tolerance axis 0 · N·m<input id="velocity-tolerance-0" type="number" min="0" step="any" value=".002"></label><label>Separate tolerance axis 1 · N·m<input id="velocity-tolerance-1" type="number" min="0" step="any" value=".002"></label>',
 '</div><button id="velocity-run" type="submit" disabled>Fit all training laws and receive the separate motion</button></form>',
 '<p id="velocity-status" role="status">Open an explicitly declared study or choose an authored control.</p><p id="velocity-error" role="alert"></p>',
 '<div id="velocity-results" hidden><div id="velocity-families" class="velocity-families"></div><p id="velocity-work"></p>',
 '<label>Separate-motion course<select id="velocity-course"></select></label><p id="velocity-plot-label">Separate-motion residual magnitude · N·m. Each point uses an original weak window; tolerance decisions use each coordinate separately.</p>',
 '<svg id="velocity-plot" viewBox="0 0 720 230" role="img" aria-labelledby="velocity-plot-label"></svg><p id="velocity-legend"></p>',
 '<p>Numerical full rank and admissible matrices do not establish identification. Interpolation can make one ambiguous circular motion appear full rank. Coarser-source agreement is a diagnostic, not an error bound; the separate source can reject a wrong candidate.</p>',
 '<details id="velocity-inspect"><summary>Inspect all original-source windows and diagnostics</summary><pre id="velocity-details"></pre></details>',
 '<p>No family is automatically selected. Motion playback and release planning retain their existing admitted laws; this comparison does not copy a skew term into them.</p></div></details>',
 '<style>#velocity-lab{margin-top:1rem;padding:1rem;border:1px solid #41575f;border-radius:.6rem;background:#10232b;color:#e9f0f2;min-width:0}#velocity-lab summary{font-weight:650;cursor:pointer}#velocity-lab p{line-height:1.55}.velocity-actions,.velocity-fields{display:flex;gap:.7rem;flex-wrap:wrap;align-items:end}.velocity-fields{margin:.8rem 0}.velocity-actions label,.velocity-fields label{display:grid;gap:.35rem;flex:1 1 180px;min-width:0}#velocity-lab input,#velocity-lab select{max-width:100%;min-width:0;box-sizing:border-box}#velocity-lab input[type=file]{width:100%;font-size:.9rem}.velocity-families{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem}.velocity-family{padding:.7rem;border:1px solid #48616b;border-radius:.4rem;min-width:0;background:#152e38}.velocity-family h4{margin:.1rem 0 .6rem}.velocity-family table{width:100%;table-layout:fixed;font-size:.8rem}.velocity-family th,.velocity-family td{padding:.3rem .1rem;overflow-wrap:anywhere;text-align:right}.velocity-family th{color:#d7e6eb}.velocity-family td{white-space:nowrap}.velocity-family th:first-child{text-align:left;width:10%}#velocity-legend{display:flex;flex-wrap:wrap;gap:.8rem}#velocity-plot{width:100%;height:auto;background:#0c1b21;border:1px solid #48616b}#velocity-error{color:#ffb4a5}#velocity-details{white-space:pre-wrap;overflow-wrap:anywhere;max-height:28rem;overflow:auto}@media(max-width:850px){.velocity-families{grid-template-columns:1fr}}@media(max-width:480px){#velocity-lab{padding:.65rem}.velocity-actions button,#velocity-run{width:100%}.velocity-fields label{flex-basis:130px}}</style>'
 ].join('');
 const $=id=>host.querySelector('#'+id);let study=null,result=null,generation=0,pending=false;
 function retire(message){result=null;$('velocity-results').hidden=true;$('velocity-save').disabled=true;$('velocity-inspect').open=false;$('velocity-details').textContent='';$('velocity-status').textContent=message;$('velocity-error').textContent='';}
 function sourceInputs(){
  if(!study)throw Error('Load an original velocity study first.');
  const input=structuredClone(study);
  for(const[side,prefix]of [['training','training'],['challenge','challenge']])if(input[side]){
   input[side].settings.windowSamples=Number($('velocity-'+prefix+'-width').value);
   input[side].settings.stride=Number($('velocity-'+prefix+'-stride').value);
  }
  if(input.challenge)input.challenge.settings.toleranceNm=[0,1].map(i=>Number($('velocity-tolerance-'+i).value));
  return input;
 }
 function load(input){
  study=readVelocityStudy(input);pending=false;
  for(const side of ['training','challenge']){
   const settings=study[side]?.settings;
   for(const[suffix,key]of [['width','windowSamples'],['stride','stride']]){const n=$('velocity-'+side+'-'+suffix);n.disabled=!settings;n.value=settings?.[key]??(key==='windowSamples'?81:40);}
  }
  for(const i of [0,1]){$('velocity-tolerance-'+i).disabled=!study.challenge;$('velocity-tolerance-'+i).value=study.challenge?.settings.toleranceNm[i]??.002;}
  $('velocity-source').textContent=(study.training.record.source.kind==='measured'?'User-declared measured':study.training.record.source.kind)+' training: '+study.training.record.source.label+' · '+(study.challenge?'Separate source: '+study.challenge.record.source.label:'No separate motion supplied.');
  $('velocity-torque-declaration').textContent='Training torque: '+study.training.record.torqueDeclaration+(study.challenge?' Separate-motion torque: '+study.challenge.record.torqueDeclaration:'');
  $('velocity-correspondence').textContent=study.challenge?'Declared correspondence: '+study.challenge.settings.correspondence:'No separate-source correspondence declared.';
  $('velocity-run').disabled=false;retire('Original sources admitted. Compare the offered laws.');
 }
 function draw(){
  const chart=$('velocity-plot'),chartWidth=host.getBoundingClientRect().width<500?360:720;chart.setAttribute('viewBox','0 0 '+chartWidth+' 230');chart.replaceChildren();if(!result?.challenge){chart.append(svg('text',{x:30,y:60,fill:'#e9f0f2'},'No separate-motion source supplied.'));return;}
  const id=$('velocity-course').value,series=[];
  for(const key of Object.keys(familyNames)){
   const rows=result.challenge[key].rows.filter(r=>r.courseId===id),points=[];
   for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];if(b)points.push([(a.start+a.end)/2,Math.hypot(a.residual,b.residual)]);}
   if(points.length)series.push({key,points});
  }
  const all=series.flatMap(s=>s.points);if(!all.length){chart.append(svg('text',{x:25,y:65,fill:'#e9f0f2'},'No admitted training law receives this course.'));return;}
  const lo=Math.min(...all.map(p=>p[0])),hi=Math.max(...all.map(p=>p[0])),peak=Math.max(1e-10,...all.map(p=>p[1]))*1.08;
  const x=t=>62+(t-lo)/(hi-lo||1)*(chartWidth-92),y=r=>188-r/peak*152;
  chart.append(svg('path',{d:'M62 30V188H'+(chartWidth-30),fill:'none',stroke:'#7d939c'}));
  chart.append(svg('text',{x:62,y:215,fill:'#e9f0f2','font-size':13},fmt(lo)+' s'),svg('text',{x:chartWidth-30,y:215,fill:'#e9f0f2','font-size':13,'text-anchor':'end'},fmt(hi)+' s'),svg('text',{x:8,y:24,fill:'#e9f0f2','font-size':13},fmt(peak)+' N·m'),svg('text',{x:44,y:192,fill:'#e9f0f2','font-size':13},'0'));
  for(const s of series)chart.append(svg('polyline',{points:s.points.map(p=>x(p[0])+','+y(p[1])).join(' '),fill:'none',stroke:colors[s.key],'stroke-width':2.3}));
 }
 function render(){
  $('velocity-error').textContent='';
  const box=$('velocity-families');box.replaceChildren();
  for(const key of Object.keys(familyNames)){
   const fit=result[key].primary,coarse=result[key].samplingComparison.alternate,card=el('section',undefined,{class:'velocity-family','data-family':key});
   card.append(el('h4',familyNames[key]),el('p',fit.status+' · numerical rank '+fit.rank+'/'+fit.parameters.length));
   if(fit.coefficients)card.append(el('p','Training weak RMSE '+fmt(fit.meanTorqueBalanceRmse)+' N·m · normalized QR pivot ratio '+fmt(fit.conditionEstimate)+'.'));
   if(fit.refusal)card.append(el('p',fit.refusal));
   const held=result.challenge?.[key];card.append(el('p',held?'Separate motion: '+held.status+(held.rmseNm===null?'':' · RMSE '+fmt(held.rmseNm)+' N·m · '+held.outside+'/'+held.equationCount+' outside declared tolerance.'):'No separate receiving source.'));
   card.append(el('p','Coarser-source '+(coarse?'rank '+coarse.rank+'/'+coarse.parameters.length+' · '+coarse.status:'comparison unavailable.')));
   if(fit.coefficients){
    const table=el('table'),head=el('tr');for(const label of ['Term','Original','Coarser','|change|'])head.append(el('th',label,{scope:'col'}));table.append(head);
    fit.parameters.forEach((name,i)=>{const row=el('tr');row.append(el('th',name,{scope:'row'}),el('td',fmt(fit.coefficients[i])),el('td',fmt(coarse?.coefficients?.[i])),el('td',fmt(result[key].samplingComparison.absoluteCoefficientDifferences?.[i])));table.append(row);});card.append(table);
   }box.append(card);
  }
  $('velocity-work').textContent=result.diagnostics.reservedSegments+' / '+result.diagnostics.segmentBudget+' quadrature segments reserved for the complete three-family comparison. All training fits were frozen before separate-source equations were evaluated.';
  const select=$('velocity-course');select.replaceChildren();for(const c of study.challenge?.record.courses??[])select.append(el('option',c.id,{value:c.id}));select.disabled=!study.challenge;
  const legend=$('velocity-legend');legend.replaceChildren();for(const key of Object.keys(familyNames)){const part=el('span',familyNames[key]+'  ');part.style.color=colors[key];legend.append(part);}
  $('velocity-results').hidden=false;$('velocity-save').disabled=false;$('velocity-status').textContent='Three conditional training laws compared; no family selected.';draw();
 }
 function run(){try{result=compareVelocityStudy(sourceInputs());study=result.study;render();}catch(error){retire('No current comparison. Correct the source or settings.');$('velocity-error').textContent=error.message;}}
 $('velocity-example').onclick=()=>{generation++;load(createVelocityExample($('velocity-example-kind').value));run();};
 $('velocity-form').addEventListener('submit',e=>{e.preventDefault();generation++;pending=false;run();});
 $('velocity-form').addEventListener('input',()=>{generation++;pending=false;$('velocity-run').disabled=!study;retire('Settings changed. Compare again to receive the separate source.');});
 $('velocity-course').onchange=draw;
 $('velocity-file').onchange=async()=>{const file=$('velocity-file').files?.[0];$('velocity-file').value='';if(!file)return;const ticket=++generation;pending=true;retire('Opening original velocity sources…');$('velocity-run').disabled=true;
  try{if(file.size>7*1024*1024)throw Error('Velocity study exceeds 7 MiB.');const raw=await file.text();if(ticket!==generation)return;load(raw);run();}
  catch(error){if(ticket===generation){pending=false;$('velocity-run').disabled=!study;retire('The new source was refused. Any retained source must be compared again.');$('velocity-error').textContent=error.message;}}
 };
 $('velocity-save').onclick=()=>{if(!result||pending)return;const url=URL.createObjectURL(new Blob([exportVelocityStudy(study)],{type:'application/json'})),link=el('a',undefined,{href:url,download:'worldlaw-velocity-study.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 $('velocity-inspect').addEventListener('toggle',()=>{if($('velocity-inspect').open&&result)$('velocity-details').textContent=JSON.stringify({diagonal:result.diagonal,symmetric:result.symmetric,skew:result.skew,challenge:result.challenge,diagnostics:result.diagnostics},null,2);});
 let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});
 return {contextChanged(){if(pending){generation++;pending=false;$('velocity-run').disabled=!study;retire('Pending file read canceled by a workspace change. Open again or compare the retained source.');}}};
}
