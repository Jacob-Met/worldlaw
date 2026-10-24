import {mountDurationAcquisition} from './duration-acquisition-panel.mjs';
import {planDurationAcquisition,exportDurationPlan} from './duration-planner.mjs';
import {syntheticChallenge,evaluateHistory} from './paired-history.mjs';
import {DURATION_SCHEMA} from './duration-response.mjs';
const $=id=>document.getElementById(id);
export function mountDurationPlanner(controller){
 let plan=null,trainingKey='';
 const training=()=>controller.getStudy().runs.filter(r=>r.role==='training');
 const invalidate=()=>{plan=null;$('duration-plan-rows').replaceChildren();$('duration-plan-export').disabled=true;$('duration-plan-acquire').disabled=true;$('duration-plan-status').textContent='Recompute a plan from current training and acquisition assumptions.';};
 const safe=fn=>{try{fn();$('duration-plan-error').textContent='';}catch(e){$('duration-plan-error').textContent=e.message;}};
 function settings(){
  const value=id=>{if(!$(id).value.trim())throw Error('Complete every acquisition assumption.');return Number($(id).value);};
  return {durations:$('duration-plan-grid').value.split(',').map(x=>{if(!x.trim())throw Error('Enter comma-separated durations.');return Number(x);}),
   contrastRadius:value('duration-plan-radius'),pairs:value('duration-plan-pairs'),overheadPerPair:value('duration-plan-overhead'),budgetSeconds:value('duration-plan-budget')};
 }
 $('duration-plan-form').onsubmit=e=>{e.preventDefault();safe(()=>{
  invalidate();const next=planDurationAcquisition(training(),settings());plan=next;trainingKey=JSON.stringify(training());
  $('duration-plan-status').textContent=next.selected?next.status.toUpperCase().replaceAll('-',' ')+': '+next.selected.duration+' s conditioning, '+next.selected.costSeconds.toFixed(1)+' s declared total, '+next.selected.separated+'/'+next.selected.total+' hypothesis pairs. '+(next.selected.extrapolation?'Outside observed training duration range. ':'')+next.reason:next.reason;
  const body=$('duration-plan-rows');body.replaceChildren();
  for(const c of next.candidates){const tr=document.createElement('tr');for(const v of [c.duration+' s',c.costSeconds.toFixed(1)+' s',c.separated+'/'+c.total,c.withinBudget?'within budget':'over budget']){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}
  $('duration-plan-export').disabled=!next.selected;$('duration-plan-acquire').disabled=!next.selected||training().some(r=>r.notebook.source!=='synthetic');
 });};
 for(const input of $('duration-plan-form').querySelectorAll('input'))input.addEventListener('input',invalidate);
 document.addEventListener('worldlaw-duration-study-change',()=>{if(JSON.stringify(training())!==trainingKey)invalidate();});
 $('duration-plan-example').onclick=()=>safe(()=>controller.adopt({schema:DURATION_SCHEMA,runs:[.1,.2,.3].map((duration,i)=>({id:'short-'+i,role:'training',duration,notebook:syntheticChallenge({duration,seed:100+i,count:32,noiseSigma:.005})}))}));
 $('duration-plan-export').onclick=()=>safe(()=>{
  if(!plan?.selected)throw Error('Recompute an informative plan first.');
  const url=URL.createObjectURL(new Blob([exportDurationPlan(training(),plan.settings)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='worldlaw-duration-plan.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('duration-plan-acquire').onclick=()=>safe(()=>{
  if(!plan?.selected)throw Error('Recompute an informative plan first.');
  const study=controller.getStudy();
  if(study.runs.some(r=>r.notebook.source!=='synthetic'))throw Error('Virtual acquisition requires an entirely synthetic study.');
  const seeds=study.runs.map(r=>r.notebook.simulation?.seed??0),seed=Math.max(500,...seeds)+1;
  const duration=plan.selected.duration,noiseSigma=Number($('sigma').value),effect=Number($('effect').value);
  const notebook=syntheticChallenge({duration,noiseSigma,effect,count:plan.settings.pairs,seed,orderStrategy:'shuffled'});
  controller.adopt({...study,runs:[...study.runs,{id:'planned-'+seed,role:'challenge',duration,notebook}]});
  const actualRadius=evaluateHistory(notebook).boundary;
  $('duration-plan-status').textContent+=' Acquired separate virtual challenge at seed '+seed+'. Actual contrast radius '+actualRadius.toPrecision(4)+' N·m: '+(actualRadius<=plan.settings.contrastRadius?'within declared planning radius.':'EXCEEDS planning radius; proposed discrimination is not qualified.');
  $('duration-plan-acquire').disabled=true;
 });
 mountDurationAcquisition(controller,()=>plan);
 invalidate();
}
