import {isGuidedPlan,BINARY_PLAN,MULTICLASS_PLAN,CASE_TWELVE_PLAN,CASE_TWELVE_REQUEST,ONE_FEEDBACK_REQUEST,SUFFIX_REQUEST,driftFeedbackInconclusive,GUIDED_INPUT,pendingDriftSteps} from '../science/active-guided-drift.mjs';
import {ACTIVE_DRIFT_PLAN,ACTIVE_DRIFT_CHECKPOINTS,ACTIVE_DRIFT_TRACE,parseActiveOriginalJSON} from '../science/active-position-drift-readout.mjs';
import {renderDriftNotebook} from './position-drift-view.mjs';
import {COUPLED_DEMO_SOURCE_SHA256} from './instrument.mjs';
import {ADAPTIVE_DEMO_SOURCE_SHA256} from './adaptive-instrument.mjs';
import {adaptiveNotebookState} from '../science/active-experiment-record.mjs';
import {createNotebookStorage} from '../notebook-recovery.mjs';
import {escapeHTML as html,approximate,displayNumber,plannedTicks,certified,
  illustrateModels,witnessProjection,drawApparatus,drawProjection,displayActiveNotebook} from './view.mjs';

const $=id=>document.getElementById(id);
const PREFIX='worldlaw-active-notebook-v1:',POINTER='worldlaw-active-current-v1';
const isDrift=p=>p?.schema===ACTIVE_DRIFT_PLAN||isGuidedPlan(p);
const examplePaths={driftSuffix:'/examples/active-position-drift-suffix-feedback.json',driftFeedbackSearch:'/examples/active-position-drift-one-feedback.json',driftBinary:'/examples/active-position-drift-binary.json',driftMulti:'/examples/active-position-drift-schedule.json',driftFeedback:'/examples/active-position-drift-feedback.json',driftSchedule:'/examples/active-position-drift-schedule.json',driftGauge:'/examples/active-position-drift-gauge.json',coupled:'/examples/active-intervention-coupled-kinematics.json',
  bounded:'/examples/active-control-box-coupled-kinematics.json',
  joint:'/examples/active-joint-control-three-responses.json',
  adaptive:'/examples/active-adaptive-coupled-track.json',
  amplitudes:'/examples/active-adaptive-amplitudes.json',
  replacement:'/examples/active-linear-one-replacement.json',
  conditional:'/examples/active-linear-conditional-future.json',
  calibratedMixedLoss:'/examples/active-linear-calibrated-mixed-loss.json',
  calibratedReplacement:'/examples/active-linear-calibrated-replacement.json',
  cycles:'/examples/active-linear-family-signed-cycles.json',decays:'/examples/active-linear-family-decays.json'};
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
const pending=new Map();let messageId=0,generation=0,busy=false;
let book=null,mode='preview',activeKey=null,readingIndex=-1,pairIndex=0,tick=0,dirty=false,playback=null;
let storageMessage='',storageWarning=false;
let custody=null,followup=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
worker.addEventListener('message',event=>{
  const message=event.data,waiter=pending.get(message.id);if(!waiter)return;
  pending.delete(message.id);if(message.error)waiter.reject(Error(message.error));else waiter.resolve(message.result);
});
worker.addEventListener('error',event=>{
  for(const waiter of pending.values())waiter.reject(Error(event.message||'The experiment worker stopped. Reload to try again.'));
  pending.clear();
});
const ask=payload=>new Promise((resolve,reject)=>{const id=++messageId;pending.set(id,{resolve,reject});worker.postMessage({id,...payload});});
const announce=message=>{$('notice').textContent=message;};
function showError(error){$('error').hidden=false;$('error').textContent=error.message||String(error);}
function stopPlayback(){if(playback!==null)clearInterval(playback);playback=null;$('play').textContent=reduced.matches?'Step predictions':'Play predictions';}
function updateControls(){
  const frozen=mode==='frozen',current=adaptiveNotebookState(book);
  const drift=isDrift(book?.plan);
  $('drift-gauge-controls').disabled=busy||!frozen||!drift||book.plan.status!=='indistinguishable';
  const ready=book&&(certified(book.plan)||(drift&&book.plan.status==='finite-schedule')||(isGuidedPlan(book?.plan)&&pendingDriftSteps(book.plan,book.readouts.at(-1)?.result).length>0))&&frozen&&!busy&&(!current||Boolean(current.action));
  $('experiment').setAttribute('aria-busy',String(busy));
  $('freeze-plan').disabled=!book||busy||frozen||dirty;
  $('freeze-plan').textContent=frozen?'Plan frozen ✓':'Freeze this plan →';
  $('export-notebook').disabled=!book||busy||!frozen;
  $('download-plan').disabled=!book||busy||!frozen;
  $('download-source').disabled=!book||busy;
  $('demo-controls').disabled=!ready||book?.plan.sourceSHA256!==COUPLED_DEMO_SOURCE_SHA256;
  $('adaptive-controls').disabled=!ready||book?.plan.sourceSHA256!==ADAPTIVE_DEMO_SOURCE_SHA256;
  $('choose-future').disabled=busy;
  $('receive-future').disabled=busy;
  $('save-future').disabled=busy;
  $('reading-set').disabled=busy;
  $('inspect-next').disabled=!current?.action||busy;
  $('adaptive-history').disabled=busy;
  $('supplied-controls').disabled=!ready;
  const continuing=isGuidedPlan(book?.plan)&&book.readouts.length>0&&book.plan.status!=='indistinguishable';
  $('readout-source').readOnly=Boolean(continuing);$('acquisition-kind').disabled=Boolean(continuing);
  $('history-controls').hidden=!book||!frozen||!calibratedOutlierPlan(book.plan);
  $('import-history').disabled=busy;
  $('play').disabled=!book||busy||drift;$('tick').disabled=!book||busy||drift;
  $('source-text').readOnly=frozen;$('noise-bound').readOnly=frozen||book?.plan.schema===CASE_TWELVE_PLAN;
  for(const id of ['drift-design','drift-search-length','drift-search-budget'])$(id).disabled=frozen||busy;
  $('replan').disabled=!book||busy||frozen;
  $('new-draft').disabled=!book||busy;
  $('import-plan').disabled=!book||busy||frozen||dirty;
  for(const id of ['load-example','import-source','open-local'])$(id).disabled=busy;
  $('storage-status').textContent=storageMessage;
  $('storage-status').toggleAttribute('data-warning',storageWarning);
}
async function transact(work,commit,message,focus=null){
  const token=++generation;busy=true;stopPlayback();$('error').hidden=true;updateControls();
  try{
    const next=await work(()=>token===generation);
    if(token!==generation)return;
    commit(next);render();announce(message);
    if(focus){const target=$(focus);target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'});}
  }catch(error){if(token===generation){showError(error);announce('The current accepted notebook is unchanged.');}}
  finally{if(token===generation){busy=false;updateControls();}}
}
function refreshLocalChoices(){
  const select=$('local-notebook'),previous=select.value;select.replaceChildren(new Option('Choose a saved notebook',''));
  try{
    const entries=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key?.startsWith(PREFIX))continue;
      try{const entry=JSON.parse(localStorage.getItem(key));entries.push({key,title:String(entry.title||'Saved experiment'),savedAt:entry.savedAt||0});}
      catch{entries.push({key,title:'Unreadable original · retained',savedAt:0});}
    }
    entries.sort((a,b)=>b.savedAt-a.savedAt);
    for(const entry of entries)select.add(new Option(entry.title,entry.key));
    if([...select.options].some(option=>option.value===previous))select.value=previous;
  }catch{storageWarning=true;storageMessage='Local storage unavailable · export to keep this notebook';}
}
function persist(){
  if(!book||mode!=='frozen')return;
  try{
    if(!activeKey){
      activeKey=PREFIX+crypto.randomUUID();custody=createNotebookStorage(()=>localStorage,{key:activeKey});
      const initial=custody.readInitial();
      if(!initial.ok||initial.text!==null){activeKey=null;custody=null;throw Error('A new local notebook could not be created safely.');}
    }
    const title=(isDrift(book.plan)?'Persistent drift · '+(book.plan.status??'six-pulse feedback'):book.plan.source.slice(0,72))+' · '+book.readouts.length+' reading set'+(book.readouts.length===1?'':'s');
    const saved=custody?.saveCurrent(JSON.stringify({title,savedAt:Date.now(),book}));
    if(!saved?.ok){
      storageMessage=saved?.reason==='active-source-changed'?
        'Another tab changed this notebook · current changes are unsaved; export or reopen':
        'Latest state is not saved locally · export it';
      storageWarning=true;refreshLocalChoices();return;
    }
    try{localStorage.setItem(POINTER,activeKey);storageMessage='Saved locally';storageWarning=false;}
    catch{storageMessage='Notebook saved; active selection unavailable · export it';storageWarning=true;}
  }catch{storageMessage='Latest state is not saved locally · export it';storageWarning=true;}
  refreshLocalChoices();
}
function readStored(key){
  const guard=createNotebookStorage(()=>localStorage,{key}),initial=guard.readInitial();
  if(!initial.ok)throw Error('Local notebook storage cannot be read.');
  return {guard,entry:JSON.parse(initial.text)};
}
function adopt(next,newMode,key=null,save=true,guard=null){
  const newSource=book?.plan?.sourceSHA256!==next.plan.sourceSHA256||book?.plan?.planSHA256!==next.plan.planSHA256;
  custody=guard??(key&&key===activeKey?custody:null);
  book=next;mode=newMode;activeKey=key;readingIndex=book.readouts.length-1;pairIndex=0;dirty=false;
  const shown=displayActiveNotebook(book,readingIndex);
  if(shown.display?.adaptive)pairIndex=Math.max(0,shown.plan.proof.findIndex(row=>row.witness));
  tick=shown.display?.adaptive?(plannedTicks(shown.plan).at(-1)??0):
    book.plan.schema==='worldlaw.active-linear-joint-control/v1'?(plannedTicks(book.plan)[0]??0):0;
  $('source-text').value=book.sourceText;
  const rawSource=parseActiveOriginalJSON(book.sourceText);
  $('noise-bound').value=String(rawSource.noiseBound??rawSource.catalog?.noiseBound??(rawSource.schema===CASE_TWELVE_REQUEST?1:0));
  $('drift-design-controls').hidden=rawSource.schema!=='worldlaw.position-drift-rate-catalog/v1';
  $('drift-design').value=book.plan.schema===BINARY_PLAN?'binary':book.plan.schema===MULTICLASS_PLAN?'multiclass':'schedule';
  $('drift-search').hidden=$('drift-design').value!=='multiclass';
  $('drift-search-length').value=String(book.plan.limits?.enumerateThrough??0);
  $('drift-search-budget').value=String(book.plan.limits?.wordBudget??0);
  if(newSource||newMode==='preview'){$('readout-source').value='';$('acquisition-kind').value='supplied';}
  if(isGuidedPlan(book.plan)&&book.readouts.length){
    const last=book.readouts.at(-1).result;$('readout-source').value=last.readoutSource??'';$('acquisition-kind').value=last.acquisition;
  }
  if(newMode==='frozen'&&save)persist();
  else if(newMode==='preview'&&!storageWarning)storageMessage='Draft · not saved';
}
function renderReplacementWitness(plan,pair){
  const proofs=plan.doubleDeletionProofs??[];
  if(!proofs.length){
    $('witness-equation').textContent='No certified schedule';
    $('exact-margin').textContent='—';
    $('witness-explanation').textContent='The offered readings and design budget do not certify separation when one value can be wrong.';
  }else{
    let weakest=proofs[0];
    const fraction=proof=>proof.pairs[pair].marginLowerBound.split('/');
    for(const proof of proofs.slice(1)){
      const [a,b='1']=fraction(proof),[c,d='1']=fraction(weakest);
      if(BigInt(a)*BigInt(d)<BigInt(c)*BigInt(b))weakest=proof;
    }
    $('witness-equation').textContent='One reading may be wrong';
    $('exact-margin').textContent=weakest.pairs[pair].marginLowerBound;
    $('witness-explanation').textContent='Each law may identify a different reading as wrong. All '+proofs.length+
      ' pairs of excluded ticks still leave distinguishable histories. The smallest separation occurs when ticks '+
      weakest.excludedTicks.join(' and ')+' are excluded.';
  }
  $('projection').replaceChildren();
}

function replacementReadoutEvidence(check){
  if(check.consistentWithoutReplacement)return 'All received values fit within the declared noise bound.';
  const possible=check.omissions.filter(row=>row.status==='consistent').map(row=>row.ignoredTick);
  if(possible.length)return 'The received values fit if tick '+possible.join(' or ')+' is ignored.';
  return check.status==='falsified'?'The values still conflict after ignoring any one received tick.':
    'The search limit left the possible bad tick unresolved.';
}

function calibratedOutlierPlan(plan){
  return plan.schema==='worldlaw.active-linear-affine-sensor-one-replacement/v1'||plan.schema==='worldlaw.active-linear-affine-sensor-one-erasure-one-replacement/v1';
}

function renderWitness(){
  const projection=witnessProjection(book,readingIndex,pairIndex);
  $('exact-noise').textContent='± '+book.plan.noiseBound;
  if(calibratedOutlierPlan(book.plan)){
    const mixed=book.plan.schema==='worldlaw.active-linear-affine-sensor-one-erasure-one-replacement/v1';
    const sealed=book.plan.status==='optimal_certified_schedule';
    $('witness-equation').textContent=sealed?(mixed?'One missing and one wrong reading':'One wrong reading with unknown gain'):'No certified schedule';
    $('exact-margin').textContent='—';
    $('witness-explanation').textContent=sealed?
      'All '+book.plan.proof.length+(mixed?' triples of excluded ticks':' pairs of excluded ticks')+' still separate '+book.plan.proof[0].pairs[pairIndex].hypotheses.join(' and ')+'. Each law may choose one fixed gain from '+book.plan.sensorGain.join(' to ')+' and one fixed offset.':
      'The offered readings and declared calibration do not certify a separating schedule under this budget.';
    $('projection').replaceChildren();return;
  }
  if(book.plan.schema==='worldlaw.active-linear-one-replacement/v1'){
    renderReplacementWitness(book.plan,pairIndex);return;
  }
  if(book.plan.schema==='worldlaw.active-linear-affine-sensor/v1'){
    const pair=book.plan.proof?.[pairIndex];
    $('witness-equation').textContent=pair?.status==='separated'?'No common measured history':pair?.status==='overlap'?'A common history is possible':'No separating schedule';
    $('exact-margin').textContent='—';
    $('witness-explanation').textContent=pair?.gainWitness?'Example compatible gains: '+pair.gainWitness.join(' and ')+'. Each law can choose a constant sensor offset.':'The exact test checks all pairs of fixed gains from '+book.plan.sensorGain.join(' to ')+', allowing a constant offset for each law.';
    $('projection').replaceChildren();return;
  }
  if(!projection){
    $('witness-equation').textContent='No certified witness';$('exact-margin').textContent='—';
    $('witness-explanation').textContent='The declared source and current design limits do not supply a certified separating combination.';
    $('projection').replaceChildren();return;
  }
  const terms=projection.proof.witness.weights.map((weight,i)=>{
    if(weight==='0')return null;const negative=weight.startsWith('-'),magnitude=negative?weight.slice(1):weight;
    return {negative,term:(magnitude==='1'?'':magnitude+' · ')+'y['+projection.ticks[i]+']'};
  }).filter(Boolean);
  $('witness-equation').textContent=terms.map((term,i)=>(term.negative?' − ':i?' + ':'')+term.term).join('').trim();
  $('exact-margin').textContent=projection.proof.marginLowerBound;
  $('witness-explanation').textContent='This combination cancels the independent unknown starting states for '+projection.pair.map(row=>row.id.replaceAll('_',' ')).join(' and ')+'. The exact difference is '+projection.proof.witness.signedGap+'.';
  drawProjection($('projection'),projection);
}
function redraw(){if(!book||isDrift(book.plan))return;drawApparatus($('apparatus'),book,tick,readingIndex);renderWitness();}
function setTick(next){
  if(!book)return;const horizon=illustrateModels(book,readingIndex).horizon;tick=Math.max(0,Math.min(horizon,next));
  $('tick').value=String(tick);$('tick-value').value=String(tick);$('tick-value').textContent=String(tick);
  for(const button of $('reading-timeline').querySelectorAll('button'))button.toggleAttribute('data-current',Number(button.dataset.tick)===tick);
  for(const row of $('control-table').querySelectorAll('tr[data-input-tick]'))row.toggleAttribute('data-current',Number(row.dataset.inputTick)===tick);
  redraw();
}
function renderAdaptive(current){
  $('adaptive-policy').hidden=!current;
  if(!current)return;
  const plan=book.plan,ids=plan.hypothesisIds,label=id=>id.replaceAll('_',' ');
  $('adaptive-heading').textContent=current.action?'Next: round '+current.round+' · '+label(current.action.id):
    ({one_hypothesis_consistent:'One candidate remains.',all_remaining_hypotheses_falsified:'The offered family was rejected.',
      readout_inconclusive:'The readout was inconclusive.'})[current.status]??'No further experiment is certified.';
  $('adaptive-progress').textContent=current.spentReadings+' readings received'+
    (plan.worstReadings===null?'':' · at most '+plan.worstReadings+' in the frozen policy')+'. Declared cost so far '+current.spentCost+'.';
  if(plan.requiredExperiments)$('adaptive-progress').textContent+=' Required experiments still pending: '+
    (plan.experiments.filter((_,i)=>(plan.requiredExperimentMask&~current.coveredMask)&(1<<i)).map(a=>label(a.id)).join(', ')||'none')+'.';
  if(plan.achievedRequiredInputDiversity)$('adaptive-progress').textContent+=' Required inputs: '+
    plan.achievedRequiredInputDiversity.distinct+' distinct courses, '+plan.achievedRequiredInputDiversity.rank+' independent input directions.';
  $('adaptive-explanation').textContent=current.action?
    'The next input was selected before acquisition as part of the complete policy. Each experiment starts with a fresh unknown state; the law stays the same. '+
    (readingIndex>=0?'The apparatus above shows received round '+(readingIndex+1)+'. Inspect the next experiment to view its controls and forecasts.':
      'The apparatus above previews this pending experiment. No earlier readings are plotted against its controls.'):
    'This transcript has stopped. Its original policy and every received round remain available for exact replay.';
  const options=book.readouts.map((row,i)=>new Option('Round '+(i+1)+' · '+label(row.result.experimentId)+' · received',String(i)));
  if(current.action)options.push(new Option('Round '+current.round+' · '+label(current.action.id)+' · pending','-1'));
  if(!options.length)options.push(new Option('Original catalogue preview','-1'));
  $('adaptive-history').replaceChildren(...options);$('adaptive-history').value=String(readingIndex);
  $('inspect-next').hidden=!current.action||readingIndex===-1;
  $('adaptive-branches').innerHTML=current.node?current.node.branchMasks.map(mask=>{
    const survivors=ids.filter((_,i)=>mask&(1<<i));
    const child=plan.policy.states.find(row=>row.mask===mask&&row.budget===current.node.remainingAfterAction&&
      (row.coveredMask??0)===(current.node.nextCoveredMask??0));
    return '<div class="adaptive-branch"><span>'+html(survivors.map(label).join(' / '))+'</span><strong>'+
      html(child?'Then '+label(child.action):survivors.length===1?'Stop · one candidate':'No continuation')+'</strong></div>';
  }).join(''):'';
  $('adaptive-branch-note').hidden=!current.node;
  $('adaptive-controls').hidden=plan.sourceSHA256!==ADAPTIVE_DEMO_SOURCE_SHA256;
  $('acquire-adaptive').textContent=current.action?'Acquire round '+current.round+' synthetic readings →':'No pending experiment';
}
function renderFollowup(record){
  const available=Boolean(record&&calibratedOutlierPlan(book.plan));
  $('future-region').hidden=!available;
  if(!available||followup?.historySHA256!==record.result.readingsSHA256||
    followup?.sourceSHA256!==book.plan.sourceSHA256)followup=null;
  const selection=followup?.selection;
  $('future-actions').hidden=!selection;
  $('future-choice').textContent=selection?
    'Measure tick'+(selection.ticks.length===1?' ':'s ')+selection.ticks.join(', ')+
    ' next. Declared additional cost: '+selection.cost+
    '. With all recommended readings, every remaining pair separates under the original calibration and one wrong reading across both stages.':
    ({already_resolved:'One law already fits. No further reading is required.',
      no_surviving_hypothesis:'No offered law fits this history.',
      search_inconclusive:'The exact search was inconclusive. No future acquisition is certified.',
      no_separating_future_schedule:'No eligible future schedule within the declared budget guarantees separation.'
    })[followup?.status]??'';
  const fields=$('future-values');
  const identity=followup?.followupSHA256??'';
  if(fields.dataset.bound!==identity){
    fields.dataset.bound=identity;fields.replaceChildren();$('future-source').value='';
    for(const t of selection?.ticks??[]){
      const label=document.createElement('label'),input=document.createElement('input');
      label.textContent='Reading at tick '+t;input.dataset.tick=String(t);input.type='text';
      if(book.plan.schema==='worldlaw.active-linear-affine-sensor-one-erasure-one-replacement/v1')
        input.placeholder='Value or “missing”';
      label.append(input);fields.append(label);
    }
  }
}
function render(){
  if(!book){updateControls();return;}
  const drift=isDrift(book.plan);
  $('drift-panel').hidden=!drift;$('apparatus-heading').closest('section').hidden=drift;
  if(drift){renderDriftNotebook(book,readingIndex,mode,dirty);updateControls();return;}
  $('receive-region').hidden=false;$('supplied-details').hidden=false;
  const shown=displayActiveNotebook(book,readingIndex),data=illustrateModels(shown),plan=book.plan,
    ticks=plannedTicks(shown.plan),frozen=mode==='frozen',current=adaptiveNotebookState(book);
  const record=book.readouts[readingIndex];
  renderFollowup(record);
  $('phase').textContent=dirty?'Unapplied source edits':frozen?'Frozen experiment':'Prospective preview';
  $('source-kind').textContent=data.isDemo||data.adaptiveDemo?'Hypothetical coupled-track example':'Source-declared hypotheses · origin unverified';
  $('course-label').textContent=data.adaptive?'Round '+data.display.round+' · '+data.display.experiment.id.replaceAll('_',' ')+' · '+(data.display.historical?'received':'preview'):
    data.bounded?(plan.chosenControls?'Designed bounded input':'No bounded input certified'):
    plan.chosenIntervention?plan.chosenIntervention.replaceAll('_',' '):plan.schema.includes('interventions')?'No offered course certified':'Source-declared fixed input';
  $('illustration-note').textContent=data.isDemo||data.adaptiveDemo?
    'Illustrative forecasts start at position 3 and hidden velocity −2. The exact test allows a different, arbitrary start for each law; these paths are not uncertainty envelopes.':
    (data.referenceControls?'No separating input was certified. These reference forecasts use the lower bound of every input. ':'')+
    'Illustrative forecasts start with zero latent state in each model. They are not fitted states or uncertainty envelopes. The exact test permits independent arbitrary starting states.';
  if(data.adaptive&&data.display.excludedHypothesisIds.length)$('illustration-note').textContent+=' Earlier rounds excluded: '+data.display.excludedHypothesisIds.map(id=>id.replaceAll('_',' ')).join(', ')+'.';
  $('tick').max=String(data.horizon);tick=Math.min(tick,data.horizon);$('tick').value=String(tick);$('tick-value').textContent=String(tick);
  $('plan-kicker').textContent=frozen?'FROZEN PROSPECTIVE PLAN · NO OUTCOMES USED':'PROSPECTIVE PREVIEW · NO OUTCOMES USED';
  $('plan-heading').textContent=current&&certified(plan)?'At most '+plan.worstReadings+' readings to distinguish the offered laws.':certified(plan)?ticks.length+' reading'+(ticks.length===1?' separates':'s separate')+' the offered laws.':({search_inconclusive:'The search limit was reached.',candidate_uncertified:'A candidate remains uncertified.',calibration_overlap_on_offered_course:'Admissible calibrations can produce the same readings.',noise_separation_not_certified:'The declared error leaves overlapping possibilities.',no_offered_intervention_certified:'No offered intervention is certified.',structurally_indistinguishable_on_offered_course:'These controls cannot distinguish the laws.',structurally_indistinguishable_on_control_box:'No allowed input can distinguish the laws.',insufficient_reading_budget:'The reading budget cannot separate the laws.',no_guaranteed_policy:'The catalogue cannot guarantee identification.',insufficient_total_reading_budget:'The total reading budget is too small.'}[plan.status]||'No certified experiment yet.');
  $('plan-summary').textContent=current&&certified(plan)?'The best fixed experiment set needs '+plan.staticPlan.readings+' readings. The complete adaptive policy guarantees at most '+plan.worstReadings+' readings and worst declared cost '+plan.worstCost+'. These guarantees apply to the offered finite family and declared error bound.':certified(plan)?'Read at ticks '+ticks.join(', ')+'. '+(data.bounded?'Use the designed input below. ':plan.chosenIntervention?'Use '+plan.chosenIntervention.replaceAll('_',' ')+'. ':'')+'Declared '+(data.bounded?'reading':'total')+' cost '+(plan.totalDeclaredCost??plan.totalCost)+'.':(plan.interpretation??plan.calibration);
  renderAdaptive(current);
  $('adaptive-controls').hidden=!data.adaptiveDemo;
  $('control-course').hidden=!data.bounded&&!data.adaptive;
  $('control-kicker').textContent=data.adaptive?'FIXED INPUT · FROZEN EXPERIMENT CATALOGUE':'DESIGNED WITHIN THE DECLARED BOUNDS';
  $('control-heading').textContent=data.adaptive?data.display.experiment.id.replaceAll('_',' '):plan.chosenControls?'The designed input':'Declared input bounds';
  $('control-explanation').textContent=plan.chosenControls?
    (data.joint?'One common input maximizes the smallest distance among all candidate pairs on these readings. ':'This input gives the greatest separation on the selected reading schedule. ')+
    'Read at tick t, then apply that tick’s input before the next state. No input has been applied.':
    'No input was certified. The model illustrations use the lower bounds only as a reference; no input has been applied.';
  if(data.adaptive)$('control-explanation').textContent='Input for '+(data.display.historical?'received':'previewed')+' round '+data.display.round+'. Read at ticks '+ticks.join(', ')+'. Read at tick t, then apply that tick’s input before the next state.';
  $('control-footnote').textContent=data.adaptive?'The input and complete reading bundle were fixed before acquisition. The catalogue declares reading and actuation costs; no physical actuator is connected.':'Input units and per-tick intervals come from the original source. The reading cost does not measure actuation cost.';
  $('control-table').innerHTML=data.bounded?'<table><caption>Exact source-declared control intervals and selected values</caption><thead><tr><th scope="col">Input tick</th><th scope="col">Channel</th><th scope="col">Allowed interval</th><th scope="col">Chosen value</th></tr></thead><tbody>'+plan.controlBounds.flatMap((row,t)=>row.min.map((lower,c)=>`<tr data-input-tick="${t}" ${t===tick?'data-current':''}><th scope="row">${t}</th><td>${c+1}</td><td>[${html(lower)}, ${html(row.max[c])}]</td><td class="chosen-control">${plan.chosenControls?html(plan.chosenControls[t][c]):'—'}</td></tr>`)).join('')+'</tbody></table>':'';
  if(data.adaptive)$('control-table').innerHTML='<table><caption>Exact fixed input for '+html(data.display.experiment.id.replaceAll('_',' '))+'</caption><thead><tr><th scope="col">Input tick</th><th scope="col">Channel</th><th scope="col">Fixed value</th></tr></thead><tbody>'+data.controls.flatMap((row,t)=>row.map((value,c)=>`<tr data-input-tick="${t}" ${t===tick?'data-current':''}><th scope="row">${t}</th><td>${c+1}</td><td class="chosen-control">${html(value)}</td></tr>`)).join('')+'</tbody></table>';
  $('reading-timeline').innerHTML=Array.from({length:data.horizon+1},(_,i)=>`<button type="button" data-tick="${i}" ${ticks.includes(i)?'data-selected':''} ${i===tick?'data-current':''} aria-label="Inspect tick ${i}${ticks.includes(i)?', planned reading':''}">${i}<small>${ticks.includes(i)?'READ':'—'}</small></button>`).join('');
  const proofs=calibratedOutlierPlan(shown.plan)
    ?(shown.plan.proof?.[0]?.pairs??[]):(shown.plan.pairProof??shown.plan.proof??[]);
  $('joint-comparison').hidden=!data.joint;
  if(data.joint){
    $('joint-margin').textContent=plan.jointProof?.margin??'—';
    $('joint-explanation').textContent=plan.jointProof?
      'Every pair below uses the same input and the same reading schedule. The smallest exact distance is '+plan.jointProof.margin+
      ', strictly above twice the declared error ('+plan.noiseBound+'). Choose a pair to inspect its invariant above.':
      (plan.jointPotential.exact?'The greatest jointly attainable distance with every offered reading is ':
        'The unfinished search has found a full-menu distance lower bound of ')+plan.jointPotential.margin+'. '+plan.interpretation;
    $('joint-pairs').innerHTML=proofs.map((proof,i)=>`<button type="button" data-joint-pair="${i}" aria-pressed="${i===pairIndex}"><span>${html(proof.pair.replaceAll('__',' ↔ ').replaceAll('_',' '))}</span><strong>${html(proof.marginLowerBound)}</strong></button>`).join('');
  }
  $('witness-pair').replaceChildren(...proofs.map((proof,i)=>new Option(proof.pair??proof.hypotheses?.join(' ↔ '),String(i))));$('witness-pair').value=String(pairIndex);
  $('pair-label').hidden=proofs.length<=1;
  $('demo-controls').hidden=!data.isDemo;
  $('receive-note').textContent=!frozen?'Freeze the prospective plan before receiving values. No instrument has run.':!certified(plan)?'This frozen plan does not certify an experiment. It can be exported and replayed; revise the source or limits in a separate draft.':data.isDemo?'Choose a separate synthetic response, or supply readings below. The frozen plan stays unchanged.':'No acquisition instrument is attached to this source. Supply independently obtained readings below.';
  if(current&&frozen&&certified(plan))$('receive-note').textContent=current.action?'Receive round '+current.round+' for '+current.action.id.replaceAll('_',' ')+'. '+(data.adaptiveDemo?'The separate synthetic apparatus keeps one fixed law and starts afresh each round.':'Supply independently obtained readings for this complete bundle.'):'This transcript has stopped. Export it or inspect an earlier received round.';
  $('supplied-note').textContent=current?'Supply the complete pending experiment bundle. Every adaptive round must name its frozen action and preceding original readings. Incomplete bundles are refused without advancing the transcript.':'Enter a nonempty subset of the selected ticks or import the original readout JSON. Missing values stay missing. Each received set is retained separately.';
  const inputTicks=current?(current.action?.readings.map(row=>row.tick)??[]):ticks;
  $('reading-fields').innerHTML=inputTicks.map(t=>`<label for="reading-${t}"><span class="tick-label">${current?'Round '+current.round+' · ':''}Reading at tick ${t}</span><input id="reading-${t}" data-tick="${t}" type="text" inputmode="decimal" placeholder="Missing"></label>`).join('');
  $('source-description').textContent=plan.source;
  $('source-digest').textContent=plan.sourceSHA256;$('plan-digest').textContent=plan.planSHA256;$('reading-digest').textContent=record?.result.readingsSHA256??'No reading set received';
  $('custody-summary').textContent=book.readouts.length+' separate reading set'+(book.readouts.length===1?'':'s')+' retained. Every reopen recomputes the original source, frozen plan and all received decisions. A new draft keeps earlier local notebooks.';
  $('certificate').textContent=JSON.stringify(plan,null,2);
  const courses=plan.interventionMenu;
  $('course-comparison').innerHTML=courses?'<table><caption>Every offered intervention remains visible</caption><thead><tr><th>Intervention</th><th>Result</th><th>Readings</th><th>Declared total cost</th></tr></thead><tbody>'+courses.map(row=>`<tr><td>${html(row.id)}</td><td>${html(row.status.replaceAll('_',' '))}</td><td>${row.numReadings??'—'}</td><td>${row.totalDeclaredCost??'—'}</td></tr>`).join('')+'</tbody></table>':'';
  $('result-region').hidden=!record;
  if(record){
    const result=record.result;$('result-region').dataset.status=result.status;
    $('result-origin').textContent=result.acquisition==='synthetic'?'SEPARATE SYNTHETIC READINGS':'SUPPLIED READINGS · PHYSICAL ORIGIN UNVERIFIED';
    $('result-heading').textContent=({one_hypothesis_consistent:'One candidate remains compatible.',all_hypotheses_falsified:'No offered law fits these readings.',all_remaining_hypotheses_falsified:'No remaining law fits these readings.',continue_frozen_policy:'Two or more candidates remain. Follow the frozen branch.',multiple_hypotheses_consistent:'Multiple explanations remain compatible.',readout_inconclusive:'The readout test is inconclusive.'})[result.status];
    if(result.status==='continue_frozen_policy'&&result.consistentHypothesisIds.length===1)
      $('result-heading').textContent='One candidate fits so far. Required experiments remain.';
    $('result-summary').textContent='Checked '+result.receivedTicks.length+' of '+result.plannedTicks.length+' planned readings under ±'+result.noiseBound+' error per reading. The candidate family and control course stayed frozen.';
    $('candidate-results').innerHTML=result.checks.map(row=>`<div class="candidate-result"><h3>${html(row.hypothesis.replaceAll('_',' '))}</h3><p class="${row.status==='consistent'?'conditional':row.status==='falsified'?'falsified':'muted'}">${row.status==='consistent'?'Conditionally consistent':row.status==='falsified'?'Falsified within the declared bound':'Inconclusive'}</p><small>${(book.plan.schema==='worldlaw.active-linear-one-replacement/v1'||calibratedOutlierPlan(book.plan))?html(replacementReadoutEvidence(row)):book.plan.schema==='worldlaw.active-linear-affine-sensor/v1'?(row.gainWitness?'Compatible gain: '+html(row.gainWitness):'No compatible gain established'):row.noiseMarginExact?'Exact minimum error required: '+html(row.minimumNoiseRequired):'Error lower bound: '+html(row.noiseLowerBound)}</small></div>`).join('');
    $('missing-readings').textContent=result.missingTicks.length?'Missing planned ticks: '+result.missingTicks.join(', ')+'. No value was invented.':'Every selected tick is present in this reading set.';
    if(book.plan.schema==='worldlaw.active-linear-affine-sensor-one-erasure-one-replacement/v1'&&result.missingTicks.length){
      $('missing-readings').textContent+=result.withinDesignedErasureBudget?
        ' The design covers this missing acquisition.':
        ' More than one acquisition is missing. Only the supplied readings support this result.';
    }
    if(result.schema==='worldlaw.active-linear-historical-result/v1'){
      $('result-summary').textContent='Checked '+result.receivedTicks.length+' independently supplied historical readings.';
      $('missing-readings').textContent='Historical ticks: '+result.receivedTicks.join(', ')+'.';
    }
    if(result.futureTicks){
      $('result-summary').textContent='History and new readings checked together. Recommended ticks: '+result.futureTicks.join(', ')+'.';
      $('missing-readings').textContent=result.missingTicks.length?
        'Missing acquisition at tick '+result.missingTicks.join(', ')+'. The comparison uses only received values.':
        'Every recommended future reading is present.';
    }
    $('result-interpretation').textContent=result.interpretation;
    $('reading-set').replaceChildren(...book.readouts.map((row,i)=>new Option('Set '+(i+1)+' · '+row.result.acquisition,String(i))));$('reading-set').value=String(readingIndex);
  }
  redraw();updateControls();
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportJSON(value,name){download(JSON.stringify(value,null,2)+'\n',name);}
function exactInput(raw,wide=false){
  const value=raw.trim();if(/^[+-]?\d+(?:\/[1-9]\d*)?$/.test(value))return value;
  if(!/^[+-]?(?:\d+\.\d*|\d*\.\d+)$/.test(value))throw Error('Use an integer, decimal or fraction for each reading.');
  const negative=value.startsWith('-'),unsigned=value.replace(/^[+-]/,''),[whole,fraction='']=unsigned.split('.');
  if(!wide&&(fraction.length>12||whole.length>13))throw Error('This decimal exceeds the exact input budget; use a smaller exact fraction.');
  let n=BigInt((whole||'0')+fraction)*(negative?-1n:1n),d=10n**BigInt(fraction.length),a=n<0n?-n:n,b=d;
  while(b)[a,b]=[b,a%b];const g=a||1n;n/=g;d/=g;return d===1n?String(n):String(n)+'/'+String(d);
}
const decodeOriginal=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
async function fetchSource(path){const response=await fetch(path);if(!response.ok)throw Error('The source example could not be loaded.');return decodeOriginal(await response.arrayBuffer());}
function planDraft(source,design){return transact(()=>ask({action:'plan',sourceText:source,design}),next=>adopt(next,'preview'),'Prospective design recomputed from this source. No reading values were used.');}
$('freeze-plan').addEventListener('click',()=>{
  if(!book||busy||dirty||mode==='frozen')return;
  mode='frozen';persist();render();announce('The source and prospective plan are frozen. Receive a separate reading set when ready.');
  if(isDrift(book.plan)&&book.plan.status==='indistinguishable'){announce('The gauge witnesses are frozen. Choose a pair and command word to compare their trajectories.');$('drift-pair').focus();return;}
  if(driftFeedbackInconclusive(book.plan)){announce('The search record is frozen. Export it to replay the bounds and available counterexamples.');return;}
  if(certified(book.plan)||isDrift(book.plan)){$('receive-region').scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'});if(book.plan.sourceSHA256===COUPLED_DEMO_SOURCE_SHA256)$('acquire').focus({preventScroll:true});else if(book.plan.sourceSHA256===ADAPTIVE_DEMO_SOURCE_SHA256)$('acquire-adaptive').focus({preventScroll:true});else{$('supplied-details').open=true;$('readout-source').focus({preventScroll:true});}}
});
$('acquire').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!book||!certified(book.plan))return;
  const original=book,profile=$('demo-profile').value,key=activeKey;
  transact(()=>ask({action:'demo',book:original,profile}),next=>{adopt(next,'frozen',key);tick=plannedTicks(next.plan).at(-1)??0;},'Separate synthetic readings received. Exact consistency was checked against the original frozen plan.','result-heading');
});
$('evaluate-readings').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!book||(!certified(book.plan)&&!isDrift(book.plan)))return;
  const original=book,key=activeKey;
  transact(()=>{
    const drift=isDrift(original.plan),guided=isGuidedPlan(original.plan);
    const rows=[...$('reading-fields').querySelectorAll('input')].filter(input=>input.value.trim()).map(input=>({tick:drift?input.dataset.tick:Number(input.dataset.tick),...(guided?{command:input.dataset.command||null}:{}),value:exactInput(input.value,guided)}));
    const current=adaptiveNotebookState(original);
    const raw={schema:guided?GUIDED_INPUT:drift?ACTIVE_DRIFT_CHECKPOINTS:current?'worldlaw.active-adaptive-readings/v1':'worldlaw.active-linear-readings/v1',source:$('readout-source').value,
      acquisition:$('acquisition-kind').value,sourceSHA256:original.plan.sourceSHA256,planSHA256:original.plan.planSHA256,
      ...(guided?{previousReadingsSHA256:original.readouts.at(-1)?.result.readingsSHA256??null}:{}),
      ...(current?{round:current.round,previousReadingsSHA256:current.previousReadingsSHA256,stateKey:current.node?.key,experimentId:current.action?.id}:{}),
      ...(original.plan.chosenIntervention?{interventionId:original.plan.chosenIntervention}:{}),readings:rows};
    return ask({action:'read',book:original,text:JSON.stringify(raw,null,2)+'\n'});
  },next=>adopt(next,'frozen',key),'Supplied readings checked. Their physical origin and error calibration are not verified.','result-heading');
});
$('drift-trace').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!isDrift(book?.plan)||book.plan.status!=='indistinguishable')return;
  const original=book,key=activeKey;
  transact(()=>{
    const witness=(original.plan.witnesses??[original.plan.witness])[Number($('drift-pair').value)];
    const runs=$('drift-word').value.split(/\r?\n/).filter(l=>l.trim()).map(line=>{
      const fields=line.trim().split(/\s+/);
      if(fields.length!==2)throw Error('Use one command and its positive repeat count per line.');
      return {command:fields[0],repeats:fields[1]};
    });
    const raw={schema:ACTIVE_DRIFT_TRACE,sourceSHA256:original.plan.sourceSHA256,planSHA256:original.plan.planSHA256,
      laws:witness.laws,origin:[exactInput($('drift-position').value),exactInput($('drift-velocity').value)],runs};
    return ask({action:'read',book:original,text:JSON.stringify(raw,null,2)+'\n'});
  },next=>adopt(next,'frozen',key),'Both trajectories were computed from the frozen laws and initial states.','result-heading');
});
$('drift-import').addEventListener('click',()=>$('readings-file').click());
function fileAction(inputId,maximum,work,commit,message,focus){
  const input=$(inputId);let reads=0;
  input.addEventListener('change',()=>{
    const file=input.files?.[0];if(!file)return;const serial=++reads,snapshot={book,key:activeKey,mode,dirty};
    transact(async current=>{if(file.size>maximum)throw Error('This file exceeds the supported size limit.');const text=decodeOriginal(await file.arrayBuffer());if(!current())return null;return work(text,snapshot);},commit,message,focus).finally(()=>{if(serial===reads)input.value='';});
  });
}
fileAction('notebook-file',8388608,text=>ask({action:'open',text}),next=>adopt(next,'frozen'),'Notebook reopened. Every scientific claim was recomputed from its original bytes.');
fileAction('source-file',524288,text=>ask({action:'plan',sourceText:text}),next=>adopt(next,'preview'),'Original source accepted as a separate prospective draft. Earlier saved notebooks remain available.');
fileAction('readings-file',524288,(text,snapshot)=>{
  const plan=snapshot.book?.plan;
  const refusal='Freeze a certified prospective plan before receiving readings.';
  if(snapshot.mode!=='frozen'||!plan)throw Error(refusal);
  if(!certified(plan)&&!isDrift(plan)){
    if(!calibratedOutlierPlan(plan))throw Error(refusal);
    let schema;
    try{schema=JSON.parse(text)?.schema;}catch{throw Error(refusal);}
    if(schema!=='worldlaw.active-linear-historical-readings/v1'&&
      schema!=='worldlaw.active-linear-followup-readings/v1')throw Error(refusal);
  }
  return ask({action:'read',book:snapshot.book,text}).then(next=>({next,key:snapshot.key}));
},received=>adopt(received.next,'frozen',received.key),'Original readout bytes received and checked against the frozen plan.','result-heading');
fileAction('plan-file',2097152,(text,snapshot)=>{if(!snapshot.book||snapshot.mode!=='preview'||snapshot.dirty)throw Error('Open a CLI plan against an accepted prospective draft.');return ask({action:'plan',sourceText:snapshot.book.sourceText,plan:parseActiveOriginalJSON(text)});},next=>adopt(next,'frozen'),'The original CLI plan reopened with its original digest, counters and decision.');
for(const [button,input] of [['open-notebook','notebook-file'],['import-source','source-file'],['import-readings','readings-file'],['import-history','readings-file'],['import-plan','plan-file']])$(button).addEventListener('click',()=>$(input).click());
$('export-notebook').addEventListener('click',()=>{if(book&&mode==='frozen'){exportJSON(book,'worldlaw-active-experiment.json');announce('Portable notebook exported with original source, frozen plan and every separate reading set.');}});
$('download-source').addEventListener('click',()=>book&&download(book.sourceText,'worldlaw-active-source.json'));
$('download-plan').addEventListener('click',()=>book&&exportJSON(book.plan,'worldlaw-active-plan.json'));
$('download-readings').addEventListener('click',()=>book?.readouts[readingIndex]&&download(book.readouts[readingIndex].readingsText,'worldlaw-active-readings.json'));
$('download-result').addEventListener('click',()=>book?.readouts[readingIndex]&&exportJSON(book.readouts[readingIndex].result,'worldlaw-active-result.json'));
$('choose-future').addEventListener('click',()=>{
  if(!book||busy)return;
  transact(()=>ask({action:'recommend',book,readingIndex}),next=>{followup=next;},
    'Future acquisition checked against this historical reading set.','future-choice');
});
$('save-future').addEventListener('click',()=>followup&&exportJSON(followup,'worldlaw-future-recommendation.json'));
$('receive-future').addEventListener('click',()=>{
  if(!book||busy||!followup?.selection)return;
  const original=book,key=activeKey,decision=followup;
  transact(()=>{
    const readings=[],erasedTicks=[];
    for(const input of $('future-values').querySelectorAll('input')){
      const tick=Number(input.dataset.tick);
      if(input.value.trim().toLowerCase()==='missing')erasedTicks.push(tick);
      else readings.push({tick,value:exactInput(input.value)});
    }
    const raw={schema:'worldlaw.active-linear-followup-readings/v1',source:$('future-source').value,
      acquisition:$('future-kind').value,sourceSHA256:decision.sourceSHA256,planSHA256:decision.planSHA256,
      historySHA256:decision.historySHA256,followupSHA256:decision.followupSHA256,readings,...(erasedTicks.length?{erasedTicks}:{})};
    return ask({action:'read',book:original,text:JSON.stringify(raw,null,2)+'\n'});
  },next=>adopt(next,'frozen',key),'The original history and new readings were checked together.','result-heading');
});
function catalogDesign(){
  if($('drift-design-controls').hidden)return undefined;
  if($('drift-design').value==='binary')return {method:BINARY_PLAN};
  if($('drift-design').value==='multiclass'){
    const limits={enumerateThrough:Number($('drift-search-length').value),wordBudget:Number($('drift-search-budget').value)};
    return {method:MULTICLASS_PLAN,limits};
  }
  return undefined;
}
$('load-example').addEventListener('click',()=>transact(async()=>ask({action:'plan',sourceText:await fetchSource(examplePaths[$('example').value]),design:$('example').value==='driftBinary'?{method:BINARY_PLAN}:$('example').value==='driftMulti'?{method:MULTICLASS_PLAN}:undefined}),next=>adopt(next,'preview'),'A separate example draft is ready. No readings acquired.'));
$('new-draft').addEventListener('click',()=>book&&planDraft(book.sourceText,catalogDesign()));
$('replan').addEventListener('click',()=>{
  const source=$('source-text').value,bound=$('noise-bound').value.trim();
  transact(()=>{let text=source;const request=parseActiveOriginalJSON(source);const catalog=[ONE_FEEDBACK_REQUEST,SUFFIX_REQUEST].includes(request.schema)?request.catalog:request;if(request.schema!==CASE_TWELVE_REQUEST&&String(catalog.noiseBound??0)!==bound){catalog.noiseBound=exactInput(bound);text=JSON.stringify(request,null,2)+'\n';}return ask({action:'plan',sourceText:text,design:request.schema==='worldlaw.position-drift-rate-catalog/v1'?catalogDesign():undefined});},next=>adopt(next,'preview'),'Draft recomputed using the stated source and error bound. No readout values were used.');
});
$('drift-design').addEventListener('change',()=>{$('drift-search').hidden=$('drift-design').value!=='multiclass';});
for(const id of ['source-text','noise-bound','drift-design','drift-search-length','drift-search-budget'])$(id).addEventListener('input',()=>{if(mode==='preview'){dirty=true;$('phase').textContent='Unapplied source edits';announce('Displayed forecasts still belong to the last accepted source. Recompute the draft to apply these edits.');updateControls();}});
$('open-local').addEventListener('click',()=>{
  const key=$('local-notebook').value;if(!key)return;
  transact(async()=>{
    if(!key.startsWith(PREFIX))throw Error('Choose a notebook saved by this lab.');
    const {guard,entry}=readStored(key);
    return {guard,next:await ask({action:'open',text:JSON.stringify(entry.book)})};
  },({next,guard})=>{adopt(next,'frozen',key,false,guard);storageMessage='Reopened local notebook';storageWarning=false;},
  'Local notebook reopened after full exact replay.');
});
function showReading(index){
  readingIndex=index;const shown=displayActiveNotebook(book,readingIndex);
  if(shown.display?.adaptive){pairIndex=Math.max(0,shown.plan.proof.findIndex(row=>row.witness));tick=plannedTicks(shown.plan).at(-1)??0;}
  render();
}
$('reading-set').addEventListener('change',()=>{showReading(Number($('reading-set').value));announce('Showing a separately retained reading set. The frozen plan is unchanged.');});
$('adaptive-history').addEventListener('change',()=>{showReading(Number($('adaptive-history').value));announce('Showing the selected round with its own frozen input.');});
$('inspect-next').addEventListener('click',()=>{showReading(-1);$('apparatus-heading').focus({preventScroll:true});$('apparatus-heading').scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'});announce('Previewing the next frozen input. Earlier readings remain in their original rounds.');});
$('acquire-adaptive').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!book||!adaptiveNotebookState(book)?.action)return;
  const original=book,key=activeKey;
  transact(()=>ask({action:'adaptive-demo',book:original}),next=>adopt(next,'frozen',key),
    'A complete separate synthetic round was received. The original frozen policy selected the continuation.','result-heading');
});
function chooseWitnessPair(index){
  if(!Number.isSafeInteger(index)||index<0||index>=$('witness-pair').options.length)return;
  pairIndex=index;$('witness-pair').value=String(index);
  for(const button of $('joint-pairs').querySelectorAll('button'))
    button.setAttribute('aria-pressed',String(Number(button.dataset.jointPair)===index));
  renderWitness();
}
$('witness-pair').addEventListener('change',()=>chooseWitnessPair(Number($('witness-pair').value)));
$('joint-pairs').addEventListener('click',event=>{
  const button=event.target.closest('button[data-joint-pair]');
  if(button)chooseWitnessPair(Number(button.dataset.jointPair));
});
$('reading-timeline').addEventListener('click',event=>{const button=event.target.closest('button[data-tick]');if(button){stopPlayback();setTick(Number(button.dataset.tick));}});
$('tick').addEventListener('input',()=>{stopPlayback();setTick(Number($('tick').value));});
$('play').addEventListener('click',()=>{
  if(!book)return;if(playback!==null){stopPlayback();return;}
  const horizon=illustrateModels(book).horizon;
  if(reduced.matches){setTick((tick+1)%(horizon+1));return;}
  if(tick===horizon)setTick(0);$('play').textContent='Pause predictions';
  playback=setInterval(()=>{if(tick>=horizon){stopPlayback();return;}setTick(tick+1);},650);
});
reduced.addEventListener('change',stopPlayback);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
window.addEventListener('pagehide',event=>{stopPlayback();if(!event.persisted)worker.terminate();});
new ResizeObserver(()=>redraw()).observe($('apparatus'));
refreshLocalChoices();stopPlayback();
async function initialize(){
  const token=++generation;busy=true;updateControls();let recovered=false;
  try{
    try{
      const key=localStorage.getItem(POINTER);
      if(key){
        if(!key.startsWith(PREFIX))throw Error('The stored notebook pointer is invalid.');
        const {guard,entry}=readStored(key);const next=await ask({action:'open',text:JSON.stringify(entry.book)});
        if(token!==generation)return;
        adopt(next,'frozen',key,false,guard);storageMessage='Reopened local notebook';render();announce('Reopened the original source, prospective plan and retained reading sets.');recovered=true;
      }
    }catch(error){if(token!==generation)return;storageWarning=true;storageMessage='Earlier original retained · automatic replacement avoided';showError(Error('The earlier notebook could not be reopened: '+error.message));}
    if(!recovered){
      try{
        const sourceText=await fetchSource(examplePaths.coupled);if(token!==generation)return;
        const next=await ask({action:'plan',sourceText});if(token!==generation)return;
        adopt(next,'preview');render();announce('A hypothetical coupled track is ready. Preview its predictions, then freeze a plan before acquiring separate readings.');
      }catch(error){if(token===generation){showError(error);announce('The example could not be prepared. Open an existing portable notebook or import a valid source.');}}
    }
  }finally{if(token===generation){busy=false;updateControls();}}
}
await initialize();
