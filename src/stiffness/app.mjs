import {parseObservationText, MAX_TEXT_LENGTH} from '../data.mjs';
import {createStiffnessStudy,importStiffnessStudy,NOTEBOOK_SCHEMA} from './notebook.mjs';
import {defaultKnots,predictStiffness,evaluateStiffness} from './science.mjs';
import {stiffnessExample,exampleSettings} from './fixture.mjs';
import {EXPERIMENT_SCHEMA,importStiffnessExperiment,exportStiffnessExperiment} from './experiment.mjs';
import {createExperimentPanel} from './experiment-panel.mjs';
const $=id=>document.getElementById(id);
const num=(n,d=4)=>n===null||n===undefined?'unavailable':Number(n.toPrecision(d)).toString();
let study=null,inspected=null,epoch=0,view='response';
const experimentPanel=createExperimentPanel({onChange:next=>install(next.study),onActivity:()=>{epoch++;},onError:fail});
const NS='http://www.w3.org/2000/svg';
function shape(tag,attrs,text){
 const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
 if(text!==undefined)n.textContent=text;$('response-plot').append(n);return n;
}
function line(x1,y1,x2,y2,color,width=1,dash){return shape('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})});}
function text(x,y,value,color='#a7bac1',size=13,anchor='start'){return shape('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor},value);}
function stateText(){
 const f=study.fit;
 if(f.status==='unidentifiable')return ['UNIDENTIFIABLE','The declared columns do not support an executable comparison. Inspect refusals and the nuisance terms.'];
 if(f.diagnostics.adequacy==='training_mismatch')return ['FAMILY MISMATCH','Even the preferred explanation disagrees with training beyond three assumed noise units.'];
 if(f.status==='global_preferred')return ['GLOBAL PREFERRED','The global response leads this finite comparison. A physical change is not established.'];
 if(f.status==='structure_ambiguous')return ['STRUCTURE AMBIGUOUS','The global response and at least one changing response remain competitive.'];
 if(f.status==='change_angle_ambiguous')return ['CHANGE ANGLE AMBIGUOUS','Several declared angles remain competitive; inspect the complete profile.'];
 return ['PIECEWISE PREFERRED','This declared change angle leads the training comparison. Challenge it with separate measurements.'];
}
function renderControls(){
 $('knots').value=study.settings.knots.map(x=>num(x,12)).join(', ');
 for(const id of ['bias','command','rate'])$(id).checked=study.settings.nuisanceTerms.includes(id);
 $('noise').value=study.settings.noiseSigma;$('delta').value=study.settings.ambiguityDelta;
 const d=study.fit.domain.position;$('probe-angle').min=d.min;$('probe-angle').max=d.max;
 $('probe-angle').step=(d.max-d.min)/300||.01;
 $('probe-angle').value=Math.max(d.min,Math.min(d.max,study.fit.selected?.knot??0));
}
function install(next){
 study=next;inspected=study.fit.selected;renderControls();$('error').textContent='';render();
}
function cell(row,value){const c=document.createElement('td');c.textContent=value;row.append(c);return c;}
function render(){
 const f=study.fit,[verdict,detail]=stateText();
 $('source-label').textContent=study.dataset.source.label+' · declared '+study.dataset.source.declaredKind+
  ' · '+study.dataset.observations.length+' training / '+study.dataset.heldOut.length+' separate checks';
 $('verdict').textContent=verdict;$('decision-detail').textContent=detail;
 const table=$('comparison-body');table.replaceChildren();
 for(const [name,model]of [['Global baseline',f.baseline],['Training winner',f.selected],...(inspected&&inspected!==f.selected?[['Inspected alternative',inspected]]:[])]){
  const tr=document.createElement('tr');cell(tr,name+(model?.knot!==null&&model?.knot!==undefined?' · κ '+num(model.knot)+' rad':''));
  cell(tr,model?num(model.metrics.rmse)+' N·m':'unidentifiable');
  const check=model?evaluateStiffness(model,study.dataset.heldOut):null;
  cell(tr,check?.count?num(check.rmse)+' N·m':'no check result');
  cell(tr,check?.count?check.extrapolationCount+' / '+check.count:'—');table.append(tr);
 }
 const terms=inspected?.terms.map(t=>num(t.coefficient)+'·'+({bias:'1',command:'u',rate:'ω',position:'θ',hinge:'max(0, θ − '+num(inspected.knot)+')'}[t.id])).join(' + ');
 $('equation').textContent=inspected?'Inspected τ = '+terms:'No executable response.';
 $('slopes').textContent=inspected?'Slope before / after: '+num(inspected.slopeLeft)+' / '+num(inspected.slopeRight)+' N·m/rad. Signs are fitted without a physical-restoring constraint.':'';
 $('profile-note').textContent=f.profile.length+' examined · '+f.candidates.length+' fitted · '+f.diagnostics.refused+
  ' refused. '+f.competitive.length+' competitive under the declared score difference; these are not confidence sets.';
 const body=$('profile-body');body.replaceChildren();
 for(const p of f.profile){
  const tr=document.createElement('tr');if(p.model===inspected)tr.className='selected';if(!p.model)tr.className='refused';
  const c=cell(tr,'');const button=document.createElement('button');button.textContent=p.knot===null?'Global':num(p.knot)+' rad';button.disabled=!p.model;
  button.setAttribute('aria-label','Inspect '+button.textContent);button.addEventListener('click',()=>{inspected=p.model;render();});c.append(button);
  cell(tr,p.model?num(p.model.metrics.rmse):'—');cell(tr,p.model&&f.selected?num(p.model.metrics.score-f.selected.metrics.score):'—');
  cell(tr,p.status==='fitted'?(p.support?p.support.left+' left / '+p.support.right+' right':'global support'):
   p.status.replaceAll('_',' ')+(p.support?' ('+p.support.left+'/'+p.support.right+')':''));body.append(tr);
 }
 renderPlot();
}
function renderPlot(){
 const svg=$('response-plot');svg.replaceChildren();if(!study)return;
 const W=Math.max(300,svg.getBoundingClientRect().width),tight=W<600;
 svg.setAttribute('viewBox','0 0 '+W+' '+(view==='gauge'&&tight?500:420));
 const command=Number($('slice-command').value),rate=Number($('slice-rate').value),probe=Number($('probe-angle').value);
 $('probe-value').textContent=num(probe)+' rad';
 if(![command,rate,probe].every(Number.isFinite)||Math.abs(command)>1e6||Math.abs(rate)>1e6){text(60,100,'Enter a finite conditional state within ±1,000,000.');return;}
 const f=study.fit,range=f.domain.position;
 const lo=range.min,hi=range.max>lo?range.max:lo+1;
 const xs=Array.from({length:161},(_,i)=>lo+(hi-lo)*i/160);
 const models=[{model:f.baseline,color:'#82cff1',dash:'8 5'},{model:inspected,color:'#ffac66'}].filter(x=>x.model);
 const close=r=>Math.abs(r.command-command)<=1e-10*Math.max(1,Math.abs(command))&&Math.abs(r.rate-rate)<=1e-10*Math.max(1,Math.abs(rate));
 const train=study.dataset.observations.filter(close),checks=study.dataset.heldOut.filter(close);
 const curves=models.map(m=>({...m,ys:xs.map(position=>predictStiffness(m.model,{position,command,rate}))}));
 const values=[...curves.flatMap(c=>c.ys),...train.map(r=>r.jointTorque),...checks.map(r=>r.jointTorque)];
 let bottom=Math.min(0,...values),top=Math.max(0,...values);const pad=Math.max(.1,(top-bottom)*.12);bottom-=pad;top+=pad;
 const X=x=>65+(x-lo)/(hi-lo)*(W-100),Y=y=>350-(y-bottom)/(top-bottom)*290;
 if(view==='gauge'){
  text(tight?18:50,35,'FROZEN MODEL RESPONSE','#a7bac1',tight?11:14);
  text(tight?18:50,75,'θ = '+num(probe)+' rad','#e9f2ed',tight?24:30);
  const predictions=models.map(m=>({...m,value:predictStiffness(m.model,{position:probe,command,rate})}));
  const scale=Math.max(1,...predictions.map(p=>Math.abs(p.value))),cx=tight?W/2:W*.7,cy=tight?315:225,radius=tight?115:140;
  shape('circle',{cx,cy,r:radius,stroke:'#49626f','stroke-width':2,fill:'none'});
  line(cx-radius,cy,cx+radius,cy,'#49626f');line(cx,cy-radius,cx,cy+radius,'#49626f');
  text(cx,cy+radius+30,'Scale ±'+num(scale)+' N·m','#a7bac1',12,'middle');
  predictions.forEach((p,i)=>{const angle=(-90+p.value/scale*130)*Math.PI/180;line(cx,cy,cx+Math.cos(angle)*radius*.82,cy+Math.sin(angle)*radius*.82,p.color,5,p.dash);
    const x=tight?18+i*W/2:50,y=tight?120:155+i*90;
    text(x,y,i===0?'GLOBAL':'INSPECTED',p.color,11);text(x,y+32,num(p.value)+' N·m',p.color,tight?20:29);});
  shape('circle',{cx,cy,r:6,fill:'#e9f2ed'});
  $('slice-note').textContent='A conditional model response at command '+num(command)+' N·m and rate '+num(rate)+' rad/s; the dial is a prediction, not an instrument reading.';
  return;
 }
 const ticks=tight?3:5;
 for(let i=0;i<=ticks;i++){
  const x=lo+(hi-lo)*i/ticks,y=bottom+(top-bottom)*i/ticks;
  line(X(x),50,X(x),350,'#2a3c47');line(65,Y(y),W-35,Y(y),'#2a3c47');
  text(X(x),375,num(x,3),'#a7bac1',13,'middle');text(55,Y(y)+4,num(y,3),'#a7bac1',12,'end');
 }
 text(65,27,'TORQUE / N·m','#a7bac1',12);text(W-35,408,'ANGLE / rad','#a7bac1',12,'end');
 if(inspected?.knot!==null&&inspected?.knot!==undefined){
  line(X(inspected.knot),45,X(inspected.knot),350,'#ffac66',1.5,'3 5');
  text(X(inspected.knot)+8,50,'κ '+num(inspected.knot),'#ffac66',13);
 }
 for(const c of curves)shape('polyline',{points:xs.map((x,i)=>X(x)+','+Y(c.ys[i])).join(' '),fill:'none',stroke:c.color,'stroke-width':3,...(c.dash?{'stroke-dasharray':c.dash}:{})});
 for(const r of train)if(r.position>=lo&&r.position<=hi)shape('circle',{cx:X(r.position),cy:Y(r.jointTorque),r:3.7,fill:'#b4c6cb',stroke:'#16222b','stroke-width':1});
 for(const r of checks)if(r.position>=lo&&r.position<=hi)shape('rect',{x:X(r.position)-3.6,y:Y(r.jointTorque)-3.6,width:7.2,height:7.2,fill:'#d8f08c',transform:'rotate(45 '+X(r.position)+' '+Y(r.jointTorque)+')'});
 line(X(probe),60,X(probe),350,'#e9f2ed',1,'2 6');
 for(const c of curves)shape('circle',{cx:X(probe),cy:Y(predictStiffness(c.model,{position:probe,command,rate})),r:5,fill:c.color});
 $('slice-note').textContent='Conditional curves at command '+num(command)+' N·m and rate '+num(rate)+
  ' rad/s. Only matching raw observations are plotted: '+train.length+' training, '+checks.length+
  ' checks. Comparison errors use every complete source state. View stays within training angles.';
}
function fail(error){$('error').textContent=error.message||String(error);}
$('load-example').addEventListener('click',()=>{epoch++;try{experimentPanel.startStudy(createStiffnessStudy(stiffnessExample($('example-kind').value),exampleSettings()));}catch(e){fail(e);}});
$('settings').addEventListener('submit',e=>{e.preventDefault();epoch++;try{
 const tokens=$('knots').value.split(',').map(x=>x.trim());if(tokens.some(x=>!x))throw new Error('Declare comma-separated angles without empty entries.');
 const knots=tokens.map(x=>{if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(x))throw new Error('Every change angle must be a decimal number.');return Number(x);});
 experimentPanel.startStudy(createStiffnessStudy(study.dataset,{knots,nuisanceTerms:['bias','command','rate'].filter(id=>$(id).checked),
  noiseSigma:Number($('noise').value),ambiguityDelta:Number($('delta').value)}));
}catch(error){fail(error);}});
for(const id of ['source-file','check-file'])$(id).addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;const ticket=++epoch;
 try{
  if(file.size>MAX_TEXT_LENGTH)throw new Error('Select a file smaller than 2 MB.');
  const content=await file.text();if(ticket!==epoch)return;
  if(id==='check-file')experimentPanel.replaceChecks(parseObservationText(content,file.name));
  else {
   let parsed=null;try{parsed=JSON.parse(content);}catch{}
   if(parsed?.schema===EXPERIMENT_SCHEMA)experimentPanel.install(importStiffnessExperiment(content));
   else if(parsed?.schema===NOTEBOOK_SCHEMA)experimentPanel.startStudy(importStiffnessStudy(content));
   else {const dataset=parseObservationText(content,file.name);experimentPanel.startStudy(createStiffnessStudy(dataset,
    {...study.settings,knots:defaultKnots(dataset.observations)}));}
  }
 }catch(error){if(ticket===epoch)fail(error);}finally{e.target.value='';}
});
$('save').addEventListener('click',()=>{try{
 const blob=new Blob([exportStiffnessExperiment(experimentPanel.getSession())],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='worldlaw-stiffness-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}catch(e){fail(e);}});
for(const id of ['slice-command','slice-rate','probe-angle'])$(id).addEventListener('input',()=>{try{renderPlot();}catch(e){fail(e);}});
for(const [id,value]of [['response-view','response'],['gauge-view','gauge']])$(id).addEventListener('click',()=>{
 view=value;$('response-view').setAttribute('aria-pressed',String(view==='response'));$('gauge-view').setAttribute('aria-pressed',String(view==='gauge'));renderPlot();
});
window.addEventListener('resize',()=>{try{renderPlot();}catch(e){fail(e);}});
experimentPanel.startStudy(createStiffnessStudy(stiffnessExample(),exampleSettings()));

