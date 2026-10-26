import {analyzeCouplingNotebook} from './notebook.mjs';
import {SKEW_INPUT_SCHEMA} from './dynamics.mjs';
import {inspectVelocityPower} from './velocity-power.mjs';
const node=(tag,text,attrs={})=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
const svg=(tag,attrs={},text)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
const fmt=x=>Number(x.toPrecision(6)).toString();
/** Inspect retained refined output only. v1-v3 retain their original empty mount. */
export function appendVelocityPowerInspection(root,notebook,study){
 root.replaceChildren();if(study?.inputs?.schema!==SKEW_INPUT_SCHEMA)return;
 const button=node('button','Inspect loss and skew power in this retained motion',{type:'button',id:'velocity-power-inspect'}),out=node('div',undefined,{id:'velocity-power-result','aria-live':'polite'});root.append(button,out);
 button.addEventListener('click',()=>{
  out.replaceChildren();
  out.append(node('h3','Symmetric loss and skew power in the same trajectory'),node('p','This inspection reuses every retained refined solver sample. It does not integrate a new trajectory, fit a velocity law to the simulated trajectory or turn declared velocity coupling into a measured property.'));
  const sourceLabel=study.source?.label??'Retained coupling source';
  out.append(node('p',`Source: ${sourceLabel}. Original declaration: ${study.inputs.declaration}`));
  out.append(node('p',`Declared inertia [${study.inputs.inertia.map(fmt).join(', ')}], cross ${fmt(study.inputs.inertiaCross)} kg·m². Symmetric loss diagonal [${study.inputs.damping.map(fmt).join(', ')}], cross ${fmt(study.inputs.dampingCross)} N·m·s/rad. Skew coefficient G₁₂ = ${fmt(study.inputs.velocitySkew)}, G₂₁ = ${fmt(-study.inputs.velocitySkew)} N·m·s/rad. Time: s; energy and work: J; power: W.`));
  let candidates=[],analysisFailure=null;
  try{candidates=analyzeCouplingNotebook(notebook).discovery.candidates;}catch(error){analysisFailure=error.message;}
  const reports=study.results.map(trajectory=>{
   const model=candidates.find(m=>m.id===trajectory.modelId);let report;
   try{if(!model)throw Error(analysisFailure??'The retained model is unavailable from this original notebook.');report=inspectVelocityPower(model,study.inputs,trajectory);}
   catch(error){report={modelId:trajectory.modelId,label:trajectory.label??trajectory.modelId,status:'unavailable',reason:error.message,rows:[]};}
   return {id:trajectory.modelId,label:trajectory.label??trajectory.modelId,trajectory,report};
  });
  for(const [i,r]of(study.refusedModels??[]).entries())reports.push({id:'refused-fit-'+i,label:r.label??r.modelId??'Refused response fit',trajectory:null,report:{status:'unavailable',reason:'Response fit unavailable: '+r.reason,rows:[]},refusal:r});
  if(!reports.length){out.append(node('p','No retained model results are available for power inspection.'));return;}
  const summary=node('ul');for(const r of reports)summary.append(node('li',`${r.label}: ${r.trajectory?.status??'fit unavailable'}; power inspection ${r.report.status}.`));out.append(summary);
  const label=node('label','Retained model or failure '),select=node('select',undefined,{id:'velocity-power-model','aria-label':'Retained model or failure for power inspection'}),view=node('div');select.style.maxWidth='100%';
  for(const r of reports)select.append(node('option',r.label+' · '+r.report.status,{value:r.id}));label.append(select);out.append(label,view);
  const draw=()=>{
   view.replaceChildren();const selected=reports.find(r=>r.id===select.value),r=selected.report,trajectory=selected.trajectory;view.dataset.powerStatus=r.status;
   view.append(node('h4',selected.label),node('p',`Original trajectory status: ${trajectory?.status??'no executable response fit'}.`));
   if(trajectory?.failure)view.append(node('p',`Retained failure at ${trajectory.failure.stage}: ${trajectory.failure.message}`));
   if(r.status!=='available')view.append(node('p',r.reason));
   else{
    const last=r.rows.at(-1);
    view.append(node('p',`Retained refined output: ${r.rows.length} original samples, ${fmt(r.rows[0].time)} to ${fmt(last.time)} s; ${r.domainStatus}. Step-sensitive and out-of-range results keep those qualifications.`));
    view.append(node('p',r.method),node('p',r.qualification));
    view.append(node('p',`Final sampled symmetric-loss power vᵀDv: ${fmt(last.lossPower)} W. Final sampled skew power vᵀGv: ${fmt(last.skewPower)} W; maximum absolute sampled skew power: ${fmt(r.maximumAbsSkewPower)} W. The algebraic zero-work identity for G does not imply zero influence on motion.`));
    view.append(node('p',`Final kinetic energy: ${fmt(last.kineticEnergy)} J. Trapezoidal symmetric-loss work: ${fmt(last.cumulativeLoss)} J; applied-response work: ${fmt(last.cumulativeAppliedWork)} J; skew work: ${fmt(last.cumulativeSkewWork)} J. Maximum absolute kinetic-work residual: ${fmt(r.maximumAbsKineticWorkResidual)} J.`));
    view.append(node('p',r.conservative
     ? `For this symmetric affine response, final potential energy is ${fmt(last.potentialEnergy)} J and total energy is ${fmt(last.totalEnergy)} J. Maximum absolute total-energy-plus-loss residual: ${fmt(r.maximumAbsEnergyBalanceResidual)} J.`
     : 'Potential energy, total energy and total-energy balance are unavailable for this nonsymmetric or unsupported non-affine law. Sampled kinetic energy, applied work and separate velocity-power diagnostics remain visible.'));
    const values=r.rows.flatMap(p=>[p.lossPower,p.skewPower]),low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1,end=last.time||1;
    const stage=svg('svg',{viewBox:'0 0 520 290',role:'img','aria-label':'Separate symmetric-loss and skew power over retained refined samples',style:'display:block;width:100%;max-width:650px;height:auto;background:#101c2d;color:#e5eef8'});
    stage.append(svg('text',{x:16,y:24,fill:'currentColor','font-size':15},'Retained sampled power · W'),svg('text',{x:16,y:46,fill:'#64e0ce','font-size':13},'Solid: symmetric loss vᵀDv'),svg('text',{x:16,y:65,fill:'#ffc65d','font-size':13},'Dashed: skew power vᵀGv'));
    const yy=v=>235-145*(v-low)/span;
    stage.append(svg('line',{x1:55,y1:yy(0),x2:495,y2:yy(0),stroke:'#718198'}));
    for(const [field,color,dash]of[['lossPower','#64e0ce',''],['skewPower','#ffc65d','6 4']])stage.append(svg('path',{d:r.rows.map((p,i)=>(i?'L':'M')+(55+440*p.time/end)+' '+yy(p[field])).join(' '),fill:'none',stroke:color,'stroke-width':2.5,'stroke-dasharray':dash,'data-velocity-power':field}));
    stage.append(svg('text',{x:10,y:96,fill:'currentColor','font-size':12},fmt(high)),svg('text',{x:10,y:238,fill:'currentColor','font-size':12},fmt(low)),svg('text',{x:55,y:263,fill:'currentColor','font-size':13},`0 to ${fmt(last.time)} s · original refined samples`));view.append(stage);
    view.append(node('p','Both traces share the displayed power scale. Lines join retained samples; sampled work sums are not verified integration-error bounds. No failed model is removed from this inspection.'));
   }
   const detail=node('details'),heading=node('summary','Inspect original source, retained refined trajectory and complete reported diagnostics'),pre=node('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify({source:study.source,originalNotebook:notebook,dynamicsInputs:study.inputs,retainedTrajectory:trajectory,refusedFit:selected.refusal??null,power:r},null,2);detail.append(heading,pre);view.append(detail);
  };select.addEventListener('change',draw);draw();
 });
}
