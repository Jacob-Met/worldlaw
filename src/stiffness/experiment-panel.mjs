import {createInputDesignPanel} from './design-panel.mjs';
import {createStiffnessExperiment,experimentInputs,replayStiffnessExperiment,setPendingStiffnessRequest,setPermittedStiffnessStates,receiveStiffnessObservation,addStiffnessCubicRevision} from './experiment.mjs';
import {importStiffnessStudy,exportStiffnessStudy,replaceStiffnessChecks} from './notebook.mjs';
import {stiffnessExperimentCourse,observeStiffnessCourse} from './experiment-fixture.mjs';

const $=id=>document.getElementById(id);
const number=value=>Number(value.toPrecision(6)).toString();
const describeState=s=>`command ${number(s.command)} N·m; angle ${number(s.position)} rad; rate ${number(s.rate)} rad/s`;
const modelLabel=p=>p.family==='global'?'Global':p.family==='cubic'?`Smooth cubic, origin ${number(p.origin)} rad`:`Hinge at ${number(p.knot)} rad`;
function cell(tr,value){const td=document.createElement('td');td.textContent=value;tr.append(td);return td;}
function paragraph(parent,value){const p=document.createElement('p');p.textContent=value;parent.append(p);return p;}
function historyCell(tr,value,label,header){
 const td=cell(tr,value);td.dataset.label=label;td.setAttribute('headers',header);
 const caption=document.createElement('span');caption.className='history-cell-label';caption.setAttribute('aria-hidden','true');caption.textContent=label;td.prepend(caption);return td;
}
const errorText=(entry,prediction)=>`${modelLabel(prediction)}: predicted ${number(prediction.torque)} N·m; observed ${number(entry.acquisition.observation.jointTorque)} N·m; frozen residual ${number(prediction.residual)} N·m (observed − predicted).`;

/** UI owns an explicit local authored-course capability; notebook labels cannot grant it. */
export function createExperimentPanel({onChange,onActivity,onError}) {
 let session=null,authoredCourse=null;
 const inputDesign=createInputDesignPanel({onFreeze:index=>freeze(index),onActivity,onError});
 function install(next,{course=null,message='Experiment recomputed from its retained inputs.'}={}){
  session=next;authoredCourse=course;render(message);onChange(next);
 }
 function act(action){onActivity();try{action();}catch(error){onError(error);}}
 function freeze(index){
  install(setPendingStiffnessRequest(session,index),{course:authoredCourse,message:'Forecast frozen before receiving a new reading. No command was sent.'});
  $('observation-source').focus();
 }
 function render(message){
  const {plan,pending,history}=session;
  inputDesign.update(session);
  $('permitted-states').value=JSON.stringify(session.permitted,null,2);
  const status=$('experiment-status');status.dataset.planStatus=plan.status;
  status.textContent=`${plan.status.replaceAll('_',' ')} · ${session.permitted.length} explicitly permitted states · ${session.acquisitions.length} received observations. ${message}`;
  $('experiment-plan-note').textContent=`Ranking uses only retained training models. Spread must exceed ${number(plan.threshold)} N·m to propose a state. ${plan.interpretation}`;
  const revision=session.revisionEvidence,revisionStatus=$('family-revision-status');
  revisionStatus.dataset.boundary=revision?.at??'';
  revisionStatus.textContent=revision?`Expanded after ${revision.at} received observations, with cubic origin ${number(revision.origin)} rad. Declared reason: ${revision.reason}`:
   'The original global and one-hinge family is active. Expansion is an explicit hypothesis change; it does not authenticate a physical cause.';
  $('family-revision-comparison').hidden=!revision;
  if(revision){
   $('family-original-error').textContent=`${revision.before.trainingRmse===null?'unavailable':number(revision.before.trainingRmse)+' N·m'} · ${revision.before.adequacy.replaceAll('_',' ')}`;
   $('family-expanded-error').textContent=`${revision.after.trainingRmse===null?'unavailable':number(revision.after.trainingRmse)+' N·m'} · ${revision.after.adequacy.replaceAll('_',' ')}`;
   $('family-revision-guard').textContent=`These are the training results at boundary ${revision.at}. Frozen forecasts and errors for the ${revision.at} earlier acquisitions retain their original family. Subsequent requests use the expanded library. Checks never enter either fit.`;
   $('family-origin').value=revision.origin;$('family-reason').value=revision.reason;
  }
  for(const id of ['family-origin','family-reason','family-expand'])$(id).disabled=Boolean(revision);
  const proposed=plan.selected,proposedButton=$('experiment-freeze-proposed');proposedButton.disabled=!proposed;
  if(proposed){
   proposedButton.dataset.freezeIndex=proposed.index;
   $('experiment-proposed-summary').textContent=`Proposed state #${proposed.index}: ${describeState(proposed.state)}. Forecast spread ${number(proposed.spread)} N·m across ${proposed.predictions.length} competitive models. Extrapolated axes: ${proposed.extrapolated.join(', ')||'none'}.`;
  }else{
   delete proposedButton.dataset.freezeIndex;
   $('experiment-proposed-summary').textContent=`No automatic proposal: ${plan.status.replaceAll('_',' ')}. The declared alternatives remain inspectable below.`;
  }
  const ranking=$('experiment-ranking');ranking.replaceChildren();
  for(const row of plan.ranked){
   const tr=document.createElement('tr');tr.dataset.stateIndex=row.index;if(plan.selected?.index===row.index)tr.className='selected';
   cell(tr,`#${row.index}: ${describeState(row.state)}`);cell(tr,number(row.spread)+' N·m');
   cell(tr,row.predictions.length?row.predictions.map(p=>`${modelLabel(p)}: ${number(p.torque)} N·m`).join('; '):'No executable competitive forecast');
   cell(tr,row.extrapolated.length?row.extrapolated.join(', '):'Within observed input ranges');
   const target=cell(tr,'');const button=document.createElement('button');button.type='button';button.dataset.freezeIndex=row.index;
   button.textContent=plan.selected?.index===row.index?'Freeze proposed state':'Freeze this declared state';
   button.addEventListener('click',()=>act(()=>freeze(row.index)));
   target.append(button);ranking.append(tr);
  }
  if(!plan.ranked.length){const tr=document.createElement('tr');const td=cell(tr,'Declare permitted states, or explicitly load an authored course.');td.colSpan=5;ranking.append(tr);}
  const holder=$('experiment-pending');holder.replaceChildren();holder.dataset.revision=pending?.revision??'';holder.dataset.index=pending?.index??'';
  if(pending){
   paragraph(holder,`Frozen revision ${pending.revision}, state #${pending.index}: ${describeState(pending.state)}`);
   paragraph(holder,`Planning status when frozen: ${pending.planStatus}. Spread ${number(pending.spread)} N·m. Extrapolated axes: ${pending.extrapolated.join(', ')||'none'}.`);
   for(const p of pending.predictions)paragraph(holder,`${modelLabel(p)} predicted ${number(p.torque)} N·m before the new observation.`);
   if(!pending.predictions.length)paragraph(holder,'No executable forecast was available. Receiving a declared observation does not manufacture a prior prediction.');
   for(const axis of ['command','position','rate'])$('observation-'+axis).value=pending.state[axis];
   $('observation-id').value='reading-'+(session.acquisitions.length+1);$('observation-torque').value='';
  }else paragraph(holder,'No pending request. Freeze one declared state before supplying a reading.');
  for(const id of ['observation-id','observation-source','observation-kind','observation-command','observation-position','observation-rate','observation-torque','experiment-receive'])$(id).disabled=!pending;
  $('experiment-virtual-receive').disabled=!pending||authoredCourse===null;
  $('experiment-virtual-note').textContent=authoredCourse===null?'Virtual receiving is disabled. Only explicitly loading an authored course enables its local analytical generator. Imported labels do not enable it.':`Explicit ${authoredCourse} authored course is active. Virtual readings are generated controls, not physical measurements.`;
  const rows=$('experiment-history');rows.replaceChildren();rows.dataset.acquisitionCount=history.length;
  for(const entry of history){
   const tr=document.createElement('tr');tr.dataset.acquisitionId=entry.acquisition.id;
   historyCell(tr,`${entry.request.revision+1} · ${entry.acquisition.id}`,'Acquisition','history-acquisition-heading');
   historyCell(tr,describeState(entry.acquisition.observation),'Received state','history-state-heading');
   const torqueCell=historyCell(tr,number(entry.acquisition.observation.jointTorque)+' N·m','Observed torque','history-torque-heading');torqueCell.className='history-observed-torque';
   const detailsCell=historyCell(tr,'','Frozen forecast evidence','history-forecast-heading');
   const preview=paragraph(detailsCell,entry.errors.length?errorText(entry,entry.errors[0]):'No executable prior forecast was available.');preview.className='history-forecast-preview';
   const details=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent=`Inspect ${entry.errors.length} frozen forecasts and residuals`;details.append(summary);
   paragraph(details,`Supplied source: ${entry.acquisition.source.label}; declared kind: ${entry.acquisition.source.declaredKind}. Source identity and independence are not authenticated.`);
   paragraph(details,`Frozen plan: ${entry.request.planStatus}; spread ${number(entry.request.spread)} N·m; extrapolated axes ${entry.request.extrapolated.join(', ')||'none'}.`);
   for(const prediction of entry.errors)paragraph(details,errorText(entry,prediction));
   if(!entry.errors.length)paragraph(details,'No executable prior model existed, so no frozen error is reported.');
   detailsCell.append(details);rows.append(tr);
  }
  if(!history.length){const tr=document.createElement('tr'),td=cell(tr,'No sequential observations received. Separate checks do not enter this history.');td.colSpan=4;rows.append(tr);}
 }
 $('family-revision-form').addEventListener('submit',event=>{event.preventDefault();act(()=>{
  const origin=$('family-origin').value;
  if(!origin.trim())throw new Error('Declare a cubic origin in radians.');
  install(addStiffnessCubicRevision(session,Number(origin),$('family-reason').value),{course:authoredCourse,
   message:'Added the explicit smooth alternative at the current boundary. Earlier frozen errors are retained; the pending request was cleared.'});
 });});
 $('experiment-freeze-proposed').addEventListener('click',()=>act(()=>{
  if(!session.plan.selected)throw new Error('No automatic proposal is available. Inspect the declared alternatives.');
  freeze(session.plan.selected.index);
 }));
 $('experiment-load-course').addEventListener('click',()=>act(()=>{
  const kind=$('experiment-course').value;install(stiffnessExperimentCourse(kind),{course:kind,message:'Started a new explicitly authored course; earlier experiment history was replaced.'});
 }));
 $('experiment-set-permitted').addEventListener('click',()=>act(()=>{
  if($('permitted-states').value.length>200000)throw new Error('Permitted-state JSON must be below 200,000 characters.');
  const next=setPermittedStiffnessStates(session,JSON.parse($('permitted-states').value));
  install(next,{course:authoredCourse,message:'Permitted declaration applied. Pending forecast cleared; declarations cannot change after the first acquisition.'});
 }));
 $('experiment-observation-form').addEventListener('submit',event=>{event.preventDefault();act(()=>{
  const observation=Object.fromEntries(['command','position','rate'].map(axis=>[axis,Number($('observation-'+axis).value)]));
  observation.jointTorque=Number($('observation-torque').value);
  const reading={id:$('observation-id').value,source:{label:$('observation-source').value,declaredKind:$('observation-kind').value},observation};
  install(receiveStiffnessObservation(session,session.pending,reading),{course:authoredCourse,message:'Scored the received reading against frozen predictions, then refitted including that reading.'});
 });});
 $('experiment-virtual-receive').addEventListener('click',()=>act(()=>{
  if(authoredCourse===null||!session.pending)throw new Error('Explicitly load an authored course and freeze a permitted state first.');
  let count=session.acquisitions.length+1;while(session.acquisitions.some(a=>a.id==='authored-'+count))count++;
  const observation={...session.pending.state,jointTorque:observeStiffnessCourse(authoredCourse,session.pending.state)};
  const reading={id:'authored-'+count,source:{label:`Explicit ${authoredCourse} analytical course generator`,declaredKind:'authored simulation'},observation};
  install(receiveStiffnessObservation(session,session.pending,reading),{course:authoredCourse,message:'Received an authored virtual reading, scored frozen errors and refitted. No physical instrument was used.'});
 }));
 return {
  getSession:()=>session,
  install:next=>install(next,{message:'Opened complete experiment, recomputing pending forecasts and sequential history. Virtual receiving remains disabled.'}),
  startStudy:next=>install(createStiffnessExperiment(next,[]),{message:'Started a new experiment from this source/settings. Declare permitted inputs; prior pending requests and acquisition history are not carried into changed training.'}),
  replaceChecks:incoming=>{
   const input=experimentInputs(session),initialStudy=importStiffnessStudy(JSON.stringify(input.initial));
   input.initial=JSON.parse(exportStiffnessStudy(replaceStiffnessChecks(initialStudy,incoming)));
   install(replayStiffnessExperiment(input),{course:authoredCourse,message:'Separate checks replaced only in the initial study; training, pending request and sequential acquisition history retained.'});
  },
 };
}
