import {compareViscousStudy,readViscousStudy,exportViscousStudy} from './viscous-comparison.mjs';
import {createViscousExample} from './viscous-example.mjs';

const NS='http://www.w3.org/2000/svg',fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toString():'—';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};

export function mountViscousComparison(root,{applyParameters}={}){
 root.innerHTML=`<details id="viscous-lab"><summary>Can drag act across the two coordinates?</summary>
  <div class="inertia-heading"><div><p class="eyebrow">ONE MOTION. TWO LOSS HYPOTHESES.</p><h3>Follow the drag across coordinates.</h3></div><p>Estimate one additional cross-coordinate coefficient from original motion and torque readings, then confront both frozen balances with a separate motion.</p></div>
  <p class="inertia-equation">M q″ + D q′ = supplied torque</p>
  <p class="small">The independent-loss baseline has five coefficients. The symmetric-loss alternative has six. A smaller training residual alone does not identify physical drag; unknown forces or sensor mixing can imitate it.</p>
  <div class="inertia-actions"><button id="viscous-open" type="button">Open comparison inputs</button><button id="viscous-cross" type="button">Try authored cross drag</button><button id="viscous-diagonal" type="button">Try independent drag</button><button id="viscous-omitted" type="button">Try an omitted force</button><button id="viscous-save" type="button" disabled>Save comparison inputs</button></div>
  <input id="viscous-file" type="file" accept=".json,application/json" hidden aria-label="Choose a viscous comparison study">
  <p id="viscous-source" class="inertia-source">No motion comparison loaded.</p><p id="viscous-declaration" class="small"></p>
  <form id="viscous-form" class="inertia-settings" novalidate><label>Training rows per window<input id="viscous-width" type="number" min="5" max="401" step="1" value="81"></label><label>Training stride<input id="viscous-stride" type="number" min="1" max="400" step="1" value="40"></label><button id="viscous-run" type="submit" disabled>Compare both balances</button></form>
  <p id="viscous-error" role="alert" tabindex="-1" hidden></p><p id="viscous-status" role="status" aria-live="polite">Both laws remain hypotheses.</p>
  <div id="viscous-results" hidden>
   <div class="table-wrap"><table><caption>Same training, independently supplied motion</caption><thead><tr><th>Offered loss</th><th>Training balance RMS</th><th>Separate motion RMS</th><th>Receiving result</th></tr></thead><tbody id="viscous-models"></tbody></table></div>
   <div class="inertia-settings"><label>Source course<select id="viscous-course"></select></label><label>Torque coordinate<select id="viscous-axis"><option value="0">Coordinate 1</option><option value="1">Coordinate 2</option></select></label></div>
   <figure class="viscous-instrument"><figcaption id="viscous-caption">Original supplied torque and frozen balances</figcaption><div id="viscous-plot" role="img" aria-label="Original weighted torque against independent and symmetric loss balances"></div></figure>
   <p class="small">Mint: weighted original torque. Amber dashed: independent loss. Violet: symmetric loss. Lines join weak-window midpoints; they are not future-motion forecasts or extra observations.</p>
   <p id="viscous-receiving" class="small"></p>
   <div class="table-wrap"><table><caption>Training coefficients — no separate-motion fitting</caption><thead><tr><th>Parameter</th><th>Independent loss</th><th>Symmetric loss</th><th>Coarser symmetric fit</th></tr></thead><tbody id="viscous-coefficients"></tbody></table></div>
   <p id="viscous-sampling" class="small"></p><p id="viscous-qualification" class="inertia-qualification"></p>
   <div id="viscous-apply-controls" hidden><label class="motion-consent"><input id="viscous-same-apparatus" type="checkbox"><span>I have checked that this training source and the response notebook describe the same apparatus, angle coordinates and torque conventions.</span></label><button id="viscous-apply" type="button" disabled>Copy symmetric loss into the motion experiment</button><p class="small">Copy the fitted numerical hypothesis, then review and declare the motion experiment. A separate-source failure remains a failure; copying values does not establish the law.</p></div>
  </div>
 </details>`;
 const $=id=>root.querySelector('#'+id);
 let study=null,result=null,generation=0,pending=false;
 function error(e){$('viscous-error').textContent=e.message||String(e);$('viscous-error').hidden=false;$('viscous-error').focus();}
 function clearError(){$('viscous-error').hidden=true;}
 function revokeCopy(){$('viscous-same-apparatus').checked=false;$('viscous-apply').disabled=true;}
 function invalidate(message){result=null;revokeCopy();$('viscous-results').hidden=true;$('viscous-status').textContent=message;}
 function current(){
  if(!study)throw new Error('Open comparison inputs first.');
  return {...study,training:{record:study.training.record,settings:{windowSamples:$('viscous-width').valueAsNumber,stride:$('viscous-stride').valueAsNumber}}};
 }
 function draw(){
  if(!result)return;
  const [source,index]=($('viscous-course').value||'training:0').split(':'),axis=Number($('viscous-axis').value),input=source==='challenge'?result.study.challenge:result.study.training,course=input.record.courses[Number(index)];
  const diag=source==='challenge'?result.challenge.diagonal:result.diagonal.primary,sym=source==='challenge'?result.challenge.symmetric:result.symmetric.primary;
  // Even when neither fit is executable, the independently integrated original
  // torque remains available from the training rows. Challenge refusals have no
  // invented predicted rows and are explained in the visible receiving table.
  const original=(sym.rows.length?sym.rows:diag.rows).filter(r=>r.courseId===course.id&&r.axis===axis);
  const series=[{color:'#64e0ce',kind:'supplied',rows:original,field:'observedTorque'},
   {color:'#ffc65d',kind:'diagonal',rows:diag.rows.filter(r=>r.courseId===course.id&&r.axis===axis&&Number.isFinite(r.predictedTorque)),field:'predictedTorque',dash:'7 4'},
   {color:'#c7a4ff',kind:'symmetric',rows:sym.rows.filter(r=>r.courseId===course.id&&r.axis===axis&&Number.isFinite(r.predictedTorque)),field:'predictedTorque'}];
  $('viscous-caption').textContent=`${source==='challenge'?'Separate motion':'Training motion'} · ${course.id} · coordinate ${axis+1}`;
  const points=series.flatMap(s=>s.rows.map(r=>[(r.start+r.end)/2,r[s.field]]));
  if(!points.length){$('viscous-plot').replaceChildren(el('p','No supported frozen law is available for this separate motion. See the retained training refusal.',{class:'small'}));return;}
  const compact=root.getBoundingClientRect().width<700,W=compact?Math.max(260,$('viscous-plot').getBoundingClientRect().width):880,H=compact?280:300,left=64,right=18,top=20,bottom=54;
  let loX=Math.min(...points.map(p=>p[0])),hiX=Math.max(...points.map(p=>p[0])),loY=Math.min(...points.map(p=>p[1])),hiY=Math.max(...points.map(p=>p[1]));
  if(loX===hiX){loX-=.5;hiX+=.5;}const pad=Math.max(1e-6,(hiY-loY)*.08);loY-=pad;hiY+=pad;
  const x=v=>left+(v-loX)/(hiX-loX)*(W-left-right),y=v=>H-bottom-(v-loY)/(hiY-loY)*(H-top-bottom),picture=svg('svg',{viewBox:`0 0 ${W} ${H}`,role:'presentation',style:'width:100%;height:auto;display:block'});
  for(let i=0;i<=4;i++){const xv=loX+(hiX-loX)*i/4,yv=loY+(hiY-loY)*i/4;picture.append(svg('line',{x1:left,x2:W-right,y1:y(yv),y2:y(yv),stroke:'#35475e','stroke-dasharray':'3 5'}),svg('text',{x:x(xv),y:H-bottom+20,'text-anchor':'middle',fill:'currentColor','font-size':12},Number(xv.toPrecision(3)).toString()),svg('text',{x:left-8,y:y(yv)+4,'text-anchor':'end',fill:'currentColor','font-size':12},Number(yv.toPrecision(3)).toString()));}
  for(const s of series)if(s.rows.length)picture.append(svg('path',{d:s.rows.map((r,i)=>(i?'L':'M')+x((r.start+r.end)/2)+' '+y(r[s.field])).join(' '),fill:'none',stroke:s.color,'stroke-width':s.kind==='supplied'?4:2,'stroke-dasharray':s.dash??'','data-viscous-trace':s.kind}));
  picture.append(svg('text',{x:(left+W-right)/2,y:H-8,'text-anchor':'middle',fill:'currentColor','font-size':13},'Original time · s'),svg('text',{x:16,y:(top+H-bottom)/2,transform:`rotate(-90 16 ${(top+H-bottom)/2})`,'text-anchor':'middle',fill:'currentColor','font-size':13},'Weighted torque · N·m'));
  $('viscous-plot').replaceChildren(picture);
 }
 function render(){
  const a=result.diagonal.primary,b=result.symmetric.primary,later=result.challenge;
  $('viscous-results').hidden=false;$('viscous-models').replaceChildren();
  for(const [label,fit,check] of [['Independent loss · 5 coefficients',a,later?.diagonal],['Symmetric loss · 6 coefficients',b,later?.symmetric]]){
   const row=el('tr'),status=fit.status==='unidentified'?`Unidentified · rank ${fit.rank}/${fit.parameters.length}`:fit.status==='outside_supported_family'?'Outside supported family':check?check.status==='within_declared_tolerance'?'Within declared balance tolerance':check.status==='exceeds_declared_tolerance'?'Separate motion exceeds tolerance':'No supported training law':'No separate evidence';
   row.append(el('th',label,{scope:'row'}),el('td',fmt(fit.meanTorqueBalanceRmse)+' N·m',{'data-label':'Training RMS'}),el('td',check&&check.rmseNm!==null?fmt(check.rmseNm)+' N·m':'—',{'data-label':'Separate RMS'}),el('td',status,{'data-label':'Receiving'}));$('viscous-models').append(row);
  }
  $('viscous-coefficients').replaceChildren();
  ['M00','M01','M11','D00','D11','D01'].forEach((name,i)=>{const row=el('tr');row.append(el('th',name+' · '+(i<3?'kg·m²':'N·m·s/rad'),{scope:'row'}),el('td',i===5?'0 · fixed by hypothesis':fmt(a.coefficients?.[i]),{'data-label':'Independent'}),el('td',fmt(b.coefficients?.[i]),{'data-label':'Symmetric'}),el('td',fmt(result.symmetric.samplingComparison.alternate?.coefficients?.[i]),{'data-label':'Coarser symmetric'}));$('viscous-coefficients').append(row);});
  $('viscous-course').replaceChildren();
  for(const [key,input]of [['training',result.study.training],['challenge',result.study.challenge]])if(input)input.record.courses.forEach((c,i)=>$('viscous-course').append(el('option',(key==='training'?'Training':'Separate')+' · '+c.id,{value:key+':'+i})));
  if(later)$('viscous-course').value='challenge:0';
  $('viscous-status').textContent=`Compared both complete offered balances. Independent rank ${a.rank}/5; symmetric rank ${b.rank}/6. Neither family is automatically adopted.`;
  $('viscous-sampling').textContent=`${result.diagnostics.reservedSegments} / ${result.diagnostics.segmentBudget} quadrature segments reserved for the full comparison. Coarser symmetric fit: ${result.symmetric.samplingComparison.alternate?.status??'unavailable at this width'}. Coarsening is sensitivity to the same source, not independent evidence or an uncertainty bound.`;
  $('viscous-receiving').textContent=result.study.challenge?`Separate source: ${result.study.challenge.record.source.label}. ${result.study.challenge.settings.correspondence} Declared weighted balance tolerances: [${result.study.challenge.settings.toleranceNm.map(fmt).join(', ')}] N·m. Later readings never fit either law.`:'No separate source supplied. Training fit alone cannot establish the missing mechanism.';
  $('viscous-qualification').textContent=[a.refusal,b.refusal,'Numerical candidates only. Unmeasured forces, sensor mixing or calibration errors may be absorbed into the coefficients. These curves use supplied angles; they are not a future-motion prediction.'].filter(Boolean).join(' ');
  revokeCopy();$('viscous-apply-controls').hidden=!b.simulationParameters||typeof applyParameters!=='function';
  draw();
 }
 function run(){
  try{const next=readViscousStudy(current()),computed=compareViscousStudy(next);study=next;result=computed;clearError();render();}
  catch(e){invalidate('No current comparison. Correct the inputs or window settings.');error(e);}
 }
 function load(value){
  const next=readViscousStudy(value),computed=compareViscousStudy(next); // Atomic: a refused import never replaces the prior source.
  study=next;result=computed;pending=false;$('viscous-width').value=next.training.settings.windowSamples;$('viscous-stride').value=next.training.settings.stride;
  const r=next.training.record;$('viscous-source').textContent=`${r.source.kind==='synthetic'?'Authored synthetic':'User-declared measured'} · ${r.source.label} · ${r.courses.reduce((n,c)=>n+c.rows.length,0)} original training rows${next.challenge?' · separate motion supplied':''}`;
  $('viscous-declaration').textContent=r.torqueDeclaration;$('viscous-run').disabled=false;$('viscous-save').disabled=false;clearError();render();
 }
 for(const kind of ['cross','diagonal','omitted'])$('viscous-'+kind).addEventListener('click',()=>{generation++;pending=false;try{load(createViscousExample(kind));}catch(e){error(e);}});
 $('viscous-form').addEventListener('submit',event=>{event.preventDefault();generation++;pending=false;run();});
 $('viscous-form').addEventListener('input',()=>{generation++;pending=false;invalidate('Training settings changed. Compare again to inspect current balances.');clearError();});
 $('viscous-course').addEventListener('change',draw);$('viscous-axis').addEventListener('change',draw);
 $('viscous-same-apparatus').addEventListener('change',()=>{$('viscous-apply').disabled=!$('viscous-same-apparatus').checked||!result?.symmetric.primary.simulationParameters;});
 $('viscous-apply').addEventListener('click',()=>{const parameters=result?.symmetric.primary.simulationParameters;if(!parameters||!$('viscous-same-apparatus').checked||typeof applyParameters!=='function')return;applyParameters(structuredClone(parameters),study.training.record.source.label);revokeCopy();});
 $('viscous-open').addEventListener('click',()=>$('viscous-file').click());
 $('viscous-file').addEventListener('change',async()=>{
  const file=$('viscous-file').files?.[0];$('viscous-file').value='';if(!file)return;const ticket=++generation;pending=true;
  invalidate('Opening comparison inputs…');
  try{if(file.size>7*1024*1024)throw new Error('Viscous study exceeds 7 MiB.');const text=await file.text();if(ticket!==generation)return;load(text);}
  catch(e){if(ticket===generation){pending=false;$('viscous-status').textContent='New inputs refused. Any retained source is the previously admitted study; compare it again to inspect results.';error(e);}}
 });
 $('viscous-save').addEventListener('click',()=>{try{const text=exportViscousStudy(current()),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=el('a',undefined,{href:url,download:'worldlaw-viscous-study.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);clearError();}catch(e){error(e);}});
 let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});$('viscous-lab').addEventListener('toggle',()=>{if($('viscous-lab').open)draw();});
 return {contextChanged(){generation++;revokeCopy();if(pending){pending=false;$('viscous-status').textContent='Another notebook action canceled the pending file read. Open again or compare the retained study.';}},redraw:draw};
}
