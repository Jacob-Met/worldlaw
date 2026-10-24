import {analyzeCouplingNotebook,addCouplingObservation,exportCouplingNotebook,readCouplingNotebook} from './notebook.mjs';
import {predictCoupling} from './science.mjs';
import {createCouplingCourse,observeVirtualCoupling} from './virtual-instrument.mjs';

const $=id=>document.getElementById(id),fmt=value=>value===null||value===undefined?'—':Math.abs(value)>=1e4||Math.abs(value)>0&&Math.abs(value)<.00001?value.toExponential(3):Number(value.toFixed(5)).toString();
let notebook=createCouplingCourse(),analysis,activeCourse='reciprocal',inputIndex=0,inspected=null,view='field',generation=0;
const colors={model:'#bd9dff',alternative:'#fbbf24',observed:'#4ade80',grid:'#35475e'};
function element(tag,text,attributes={}){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);return el;}
function svgElement(tag,attributes={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;}
function setText(id,text){$(id).textContent=text;}
function showError(error){$('error').textContent=error.message||String(error);$('error').hidden=false;$('error').focus();}
function clearError(){$('error').hidden=true;}
function action(fn){try{fn();clearError();}catch(error){showError(error);}}
function commit(next,{course=activeCourse,index=inputIndex}={}){
  const nextAnalysis=analyzeCouplingNotebook(next);
  generation++;notebook=nextAnalysis.notebook;analysis=nextAnalysis;activeCourse=course;inputIndex=Math.max(0,Math.min(index,notebook.permitted.length-1));inspected=analysis.discovery.selected?.id??null;render();
}
function model(){return analysis.discovery.candidates.find(m=>m.id===inspected)??analysis.discovery.selected;}
function arrow(svg,x,y,dx,dy,color,width=3){
  svg.append(svgElement('line',{x1:x,y1:y,x2:x+dx,y2:y+dy,stroke:color,'stroke-width':width,'stroke-linecap':'round'}));
  if(Math.hypot(dx,dy)<2)return;
  const a=Math.atan2(dy,dx),size=7;
  svg.append(svgElement('path',{d:`M ${x+dx-size*Math.cos(a-.5)} ${y+dy-size*Math.sin(a-.5)} L ${x+dx} ${y+dy} L ${x+dx-size*Math.cos(a+.5)} ${y+dy-size*Math.sin(a+.5)}`,fill:'none',stroke:color,'stroke-width':width}));
}
function draw(){
  const current=model(),alternative=analysis.discovery.competitive.find(m=>m.id!==current?.id),q=notebook.permitted[inputIndex],last=notebook.revisions.at(-1)?.observation;
  const compact=$('mechanism').getBoundingClientRect().width<560;
  const svg=svgElement('svg',{viewBox:compact?(view==='field'?'0 0 400 500':'0 0 400 760'):'0 0 800 510'});
  const points=notebook.permitted;
  setText('apparatus-title',view==='field'?'The response field':'Two positions. Two responses.');
  $('field-view').setAttribute('aria-pressed',view==='field');$('gauge-view').setAttribute('aria-pressed',view==='gauges');
  if(view==='field'){
    const extent=Math.max(.01,...points.flatMap(v=>v.map(Math.abs))),center=compact?220:400,span=compact?135:270,xy=p=>[center+p[0]/extent*span,245-p[1]/extent*170];
    for(let i=-2;i<=2;i++){
      const x=center+i*span/2,y=245+i*85;svg.append(svgElement('line',{x1:x,y1:45,x2:x,y2:445,stroke:colors.grid,'stroke-dasharray':i===0?'':'3 6'}));svg.append(svgElement('line',{x1:compact?60:90,y1:y,x2:compact?380:710,y2:y,stroke:colors.grid,'stroke-dasharray':i===0?'':'3 6'}));
      svg.append(svgElement('text',{x,y:472,'text-anchor':'middle','font-size':13},fmt(i*extent/2)));svg.append(svgElement('text',{x:compact?50:70,y:y+4,'text-anchor':'end','font-size':13},fmt(-i*extent/2)));
    }
    svg.append(svgElement('text',{x:center,y:compact?496:498,'text-anchor':'middle','font-size':14},'Angle 1 · rad'));svg.append(svgElement('text',{x:22,y:245,transform:'rotate(-90 22 245)','text-anchor':'middle','font-size':14},'Angle 2 · rad'));
    const vectors=points.flatMap(p=>[current,alternative].filter(Boolean).map(m=>predictCoupling(m,p)));
    if(last)vectors.push(last.torque);
    const arrowLength=compact?25:45,scale=arrowLength/Math.max(.1,...vectors.map(v=>Math.hypot(...v))); 
    points.forEach((p,i)=>{
      const [x,y]=xy(p);
      if(alternative){const v=predictCoupling(alternative,p);arrow(svg,x,y,v[0]*scale,-v[1]*scale,colors.alternative,2);}
      if(current){const v=predictCoupling(current,p);arrow(svg,x,y,v[0]*scale,-v[1]*scale,colors.model,3);}
      if(last&&last.q.every((v,a)=>v===p[a]))arrow(svg,x,y,last.torque[0]*scale,-last.torque[1]*scale,colors.observed,3);
      svg.append(svgElement('circle',{cx:x,cy:y,r:i===inputIndex?10:6,fill:i===inputIndex?'#fff':colors.grid,stroke:i===inputIndex?'#fff':'#9eafc7','stroke-width':i===inputIndex?3:1,'data-index':i,tabindex:0,role:'button','aria-label':`Choose permitted input ${i+1}: ${fmt(p[0])}, ${fmt(p[1])} radians`}));
    });
    setText('plot-note',`Positions in radians; a torque vector of ${fmt(arrowLength/scale)} N·m spans ${arrowLength} diagram units. Click a permitted state or use the selector. This response field is not reconstructed geometry.`);
  }else{
    for(let axis=0;axis<2;axis++){
      const cx=compact?200:(axis===0?215:585),cy=compact?155+axis*370:215,r=compact?92:115,top=compact?axis*370:0;
      svg.append(svgElement('circle',{cx,cy,r,fill:'#17273b',stroke:'#60738d','stroke-width':2}));
      for(let k=0;k<12;k++){const a=k*Math.PI/6;svg.append(svgElement('line',{x1:cx+(r-8)*Math.sin(a),y1:cy-(r-8)*Math.cos(a),x2:cx+r*Math.sin(a),y2:cy-r*Math.cos(a),stroke:'#8da0ba','stroke-width':2}));}
      if(q){const a=q[axis];arrow(svg,cx,cy,90*Math.sin(a),-90*Math.cos(a),'#e8eef7',5);}
      svg.append(svgElement('circle',{cx,cy,r:8,fill:'#e8eef7'}));svg.append(svgElement('text',{x:cx,y:compact?top+30:55,'text-anchor':'middle','font-size':19},`COORDINATE ${axis+1}`));
      svg.append(svgElement('text',{x:cx,y:compact?top+272:365,'text-anchor':'middle','font-size':23},q?`${fmt(q[axis])} rad`:'No permitted input'));
      svg.append(svgElement('text',{x:cx,y:compact?top+306:408,'text-anchor':'middle','font-size':17,style:`fill:${colors.model}`},current&&q?`Model: ${fmt(predictCoupling(current,q)[axis])} N·m`:'No estimable model'));
      if(alternative&&q)svg.append(svgElement('text',{x:cx,y:compact?top+330:438,'text-anchor':'middle','font-size':15,style:`fill:${colors.alternative}`},`Alternative: ${fmt(predictCoupling(alternative,q)[axis])} N·m`));
      if(last&&q&&last.q.every((v,a)=>v===q[a]))svg.append(svgElement('text',{x:cx,y:compact?top+354:468,'text-anchor':'middle','font-size':15,style:`fill:${colors.observed}`},`Supplied: ${fmt(last.torque[axis])} N·m`));
    }
    setText('plot-note','Each needle shows a supplied angular position. Torque values are executable predictions at that pair; these gauges do not imply two reconstructed bodies or physical motion.');
  }
  $('mechanism').replaceChildren(svg);setText('model-legend',current?`Inspecting ${current.label.toLowerCase()}`:'No estimable response');
  setText('equation',current?`τ₁ = ${fmt(current.matrix[0][0])} θ₁ + ${fmt(current.matrix[0][1])} θ₂ + ${fmt(current.bias[0])}\nτ₂ = ${fmt(current.matrix[1][0])} θ₁ + ${fmt(current.matrix[1][1])} θ₂ + ${fmt(current.bias[1])}`:'More independently varied states are needed to fit a response.');
  $('equation').style.whiteSpace='pre-line';
}
const statuses={unexecutable_models:'The input design has full numerical rank, but no offered model has executable coefficients within this instrument’s bounds. Review the declared scales; no forecast is available.',proposed:'The training-compatible explanations disagree at a permitted state. Observe it before revising.',needs_excitation:'The coordinates have not varied independently enough. This pilot state can increase numerical rank; no missing coefficients are invented.',insufficient_excitation:'None of the permitted states adds the missing excitation. Supply a different permitted acquisition set.',model_mismatch:'Every offered family leaves substantial training mismatch. Their disagreement does not repair the missing physics.',uninformative:'The currently competitive models do not separate beyond the declared noise threshold on this input set.',no_permitted_inputs:'This notebook declares no permitted inputs. No acquisition is proposed.'};
function renderInput(){
  const q=notebook.permitted[inputIndex],p=analysis.plan.ranked.find(row=>row.index===inputIndex);
  setText('extrapolation',p?.extrapolatedAxes.length?`Outside the training range on coordinate ${p.extrapolatedAxes.map(a=>a+1).join(' and ')}.`:'Within the recorded coordinate ranges.');
  $('forecast').replaceChildren(element('strong','Predictions before this acquisition'));
  if(q)for(const m of analysis.discovery.candidates){const v=predictCoupling(m,q);$('forecast').append(element('div',`${m.label}: [${fmt(v[0])}, ${fmt(v[1])}] N·m`));}
  if(!analysis.discovery.candidates.length)$('forecast').append(element('div','No estimable family yet. The pilot tests excitation.'));
  $('acquire-virtual').disabled=!activeCourse||!q||notebook.revisions.length>=64;
  $('manual-form').querySelector('button').disabled=!q||notebook.revisions.length>=64;
  $('candidate').value=String(inputIndex);draw();
}
function render(){
  const d=analysis.discovery,p=analysis.plan;
  setText('source-kind',notebook.source.kind==='synthetic'?'Synthetic evidence':'User-declared measurements');setText('source-label',notebook.source.label);
  setText('counts',`${notebook.training.length} initial observations · ${notebook.revisions.length} acquisitions · ${notebook.challenges.length} separate checks`);
  setText('reference',notebook.source.reference);setText('convention',notebook.assumptions.coordinateConvention);setText('noise',`${fmt(notebook.options.noiseSigma)} N·m per coordinate; assumed, not measured here.`);
  $('candidate').replaceChildren(...notebook.permitted.map((q,i)=>element('option',`[${fmt(q[0])}, ${fmt(q[1])}] rad`,{value:i})));
  $('inspect-model').replaceChildren(...d.candidates.map(m=>element('option',m.label+(m.id===d.selected?.id?' · ranked first':''),{value:m.id})));$('inspect-model').disabled=!d.candidates.length;$('inspect-model').value=inspected??'';
  setText('plan-status',statuses[p.status]);setText('suggestion',p.selected?`[${fmt(p.selected.q[0])}, ${fmt(p.selected.q[1])}] rad`:'No input proposed');setText('spread',p.selected?p.status==='needs_excitation'?`Potential design rank: ${d.diagnostics.fullRank} → ${d.diagnostics.fullRank+p.selected.rankGain} of 6`:`Competitive torque spread: ${fmt(p.selected.disagreement)} N·m`:'Declare a finite permitted set in the notebook.');
  $('use-proposal').disabled=!p.selected||!['proposed','needs_excitation'].includes(p.status);
  setText('acquisition-mode',activeCourse?'The separate authored instrument returns new simulated torque values. Saved check rows are never used as acquisitions.':'No virtual instrument is attached to an imported notebook. Record a separately supplied response, or explicitly start a new authored course.');
  setText('diagnostics',`Numerical design rank ${d.diagnostics.fullRank}/6. ${d.diagnostics.adequacy==='residual_mismatch'?'Training mismatch exceeds three times the assumed noise.':d.diagnostics.fullRank<6?'Cross-coupling remains unidentifiable.':'Full rank is local numerical support, not physical identification.'}`);
  $('models').replaceChildren();
  for(const m of d.candidates){const e=analysis.evaluations.find(x=>x.modelId===m.id),tr=element('tr',undefined,{class:m.id===d.selected?.id?'winner':''});
    const title=element('td',m.label);title.append(element('small',`${m.metrics.parameters} coefficients${m.id===d.selected?.id?' · ranked first':''}`));
    const status=m.metrics.rmse>3*notebook.options.noiseSigma?'Training mismatch':d.competitive.some(c=>c.id===m.id)?'Competitive on training':'Lower training rank';
    tr.append(title,element('td',`${fmt(m.metrics.rmse)} N·m`),element('td',e.count?`${fmt(e.rmse)} N·m`:'No separate evidence'),element('td',status));$('models').append(tr);
  }
  for(const r of d.refused){const tr=element('tr');tr.append(element('td',r.label),element('td','Not estimable'),element('td','No executable forecast'),element('td',`Rank ${r.rank}/${r.parameters} · ${r.reason.replaceAll('_',' ')}`));$('models').append(tr);}
  const now=analysis.evaluations.find(e=>e.modelId===d.selected?.id)?.rmse,before=analysis.baselineEvaluation?.rmse;
  setText('comparison',before!==null&&before!==undefined&&now!==null&&now!==undefined?`On the same ${notebook.challenges.length} separate check states: initial selected response ${fmt(before)} N·m RMSE; current selected response ${fmt(now)} N·m. ${notebook.revisions.length?'Every earlier response is retained below.':'These check states have not trained the model.'}`:'There is no separate check result for the selected model. Absence of evidence is not zero error.');
  $('history').replaceChildren();
  if(!analysis.history.length)$('history').append(element('li','No added acquisitions yet. The first response may worsen prediction; the complete sequence stays in this notebook.',{class:'empty'}));
  for(const event of analysis.history){const li=element('li',`[${event.observation.q.map(fmt).join(', ')}] rad → supplied [${event.observation.torque.map(fmt).join(', ')}] N·m. Ranked response: ${event.beforeModel??'unidentifiable'} → ${event.afterModel??'unidentifiable'}.`);
    for(const result of event.frozen)li.append(element('span',`${result.modelId}: frozen prediction [${result.rows[0].prediction.map(fmt).join(', ')}], residual [${result.rows[0].residual.map(fmt).join(', ')}] N·m`,{class:'residual'}));$('history').append(li);
  }
  $('observation-id').value=`probe-${notebook.revisions.length+1}`;renderInput();
}
$('restart').addEventListener('click',()=>action(()=>{const kind=$('course').value;commit(createCouplingCourse(kind),{course:kind,index:0});}));
$('use-proposal').addEventListener('click',()=>{if(analysis.plan.selected){inputIndex=analysis.plan.selected.index;renderInput();}});
$('candidate').addEventListener('change',()=>{inputIndex=Number($('candidate').value);renderInput();});
$('inspect-model').addEventListener('change',()=>{inspected=$('inspect-model').value;draw();});
for(const [id,value]of [['field-view','field'],['gauge-view','gauges']])$(id).addEventListener('click',()=>{view=value;draw();});
function selectDiagram(event){const target=event.target.closest('[data-index]');if(target&&(event.type==='click'||event.key==='Enter'||event.key===' ')){event.preventDefault();inputIndex=Number(target.getAttribute('data-index'));renderInput();$('candidate').focus();}}
$('mechanism').addEventListener('click',selectDiagram);$('mechanism').addEventListener('keydown',selectDiagram);
$('acquire-virtual').addEventListener('click',()=>action(()=>{if(!activeCourse)throw new Error('No virtual instrument is attached.');const q=notebook.permitted[inputIndex];commit(addCouplingObservation(notebook,inputIndex,observeVirtualCoupling(q,{kind:activeCourse,index:1000+notebook.revisions.length})));}));
$('manual-form').addEventListener('submit',event=>{event.preventDefault();action(()=>commit(addCouplingObservation(notebook,inputIndex,{id:$('observation-id').value,q:notebook.permitted[inputIndex],torque:[$('torque-a').valueAsNumber,$('torque-b').valueAsNumber]})));});
$('open').addEventListener('click',()=>$('notebook-file').click());
$('notebook-file').addEventListener('change',async()=>{
  const file=$('notebook-file').files?.[0];$('notebook-file').value='';if(!file)return;const ticket=++generation;
  try{if(file.size>2*1024*1024)throw new Error('Notebook exceeds 2 MB.');const text=await file.text();if(ticket!==generation)return;const next=readCouplingNotebook(text);if(ticket!==generation)return;commit(next,{course:null,index:0});clearError();}catch(error){if(ticket===generation)showError(error);}
});
$('save').addEventListener('click',()=>action(()=>{const blob=new Blob([exportCouplingNotebook(notebook)],{type:'application/json'}),url=URL.createObjectURL(blob),a=element('a',undefined,{href:url,download:'worldlaw-coupling-notebook.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}));
let resizeFrame;
window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(draw);});
commit(notebook,{course:activeCourse,index:0});
