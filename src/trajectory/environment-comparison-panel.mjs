import {compareSharedEnvironments,evaluateSharedEnvironments,exportEnvironmentSources,readEnvironmentSources,normalizeEnvironmentChallenge} from './shared-environments.mjs';
import {renderEnvironmentCourses,renderEnvironmentOutcomeTable,ENVIRONMENT_MODE_LABELS,environmentFormat} from './environment-course-view.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

/** One additive source-first consumer. Challenge receipt has no fitting call. */
export function createEnvironmentComparisonPanel(anchor){
  if(!anchor)return null;
  const section=el('section',undefined,'environment-comparison');section.id='environment-comparison';section.setAttribute('aria-labelledby','environment-heading');
  const title=el('h2','Compare motion across conditions');title.id='environment-heading';
  section.append(el('p','OBSERVE / SHARE / CHALLENGE','environment-kicker'),title,
    el('p','Upload named conditions and their time-and-angle recordings to compare pooled, shared-restoring, and independent models. Then receive separate challenge recordings and watch each fixed model confront their motion.','environment-introduction'));
  const controls=el('div',undefined,'environment-controls');
  function fileControl(id,labelText){
    const wrap=el('div'),label=el('label',labelText),input=el('input');input.type='file';input.id=id;input.accept='.json,application/json';label.htmlFor=id;wrap.append(label,input);return {wrap,input};
  }
  const training=fileControl('environment-training-file','Choose training bundle or saved source comparison');
  const challenge=fileControl('environment-challenge-file','Choose separate challenge bundle');
  const fit=el('button','Fit training recordings'),save=el('button','Export sources');fit.type=save.type='button';fit.id='environment-fit';save.id='environment-export';
  controls.append(training.wrap,fit,challenge.wrap,save);section.append(controls);
  const helper=el('p','Fit the training recordings before receiving a challenge. Packaged PASCO training and challenge bundles are linked in the README.','environment-help');
  section.append(helper);
  const status=el('p','Choose a source bundle to begin.','environment-status');status.id='environment-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const error=el('p',undefined,'environment-error');error.id='environment-error';error.setAttribute('role','alert');error.hidden=true;section.append(status,error);
  const arrangement=el('fieldset',undefined,'environment-arrangement');arrangement.append(el('legend','Arrange recorded motion and predictions'));
  for(const [value,label]of [['conditions','By condition'],['models','By model']]){
    const choice=el('label'),input=el('input');input.type='radio';input.name='environment-arrangement';input.value=value;input.checked=value==='conditions';choice.append(input,document.createTextNode(label));arrangement.append(choice);
  }
  section.append(arrangement);
  const sources=el('div',undefined,'environment-source-summary');sources.id='environment-sources';section.append(sources);
  const challengeTitle=el('h3','Challenge forecasts — fixed training models'),challengePlots=el('div');challengePlots.id='environment-challenge-courses';
  const trainingDetails=el('details',undefined,'environment-training-details');trainingDetails.open=true;trainingDetails.append(el('summary','Training motion and fitted trajectories'));
  const trainingPlots=el('div');trainingPlots.id='environment-training-courses';trainingDetails.append(trainingPlots);
  const outcomes=el('div',undefined,'environment-table-region');outcomes.id='environment-outcomes';outcomes.tabIndex=0;outcomes.setAttribute('role','region');outcomes.setAttribute('aria-label','Model outcomes table; scroll horizontally if needed');
  const outcomeDetails=el('details',undefined,'environment-outcome-details');outcomeDetails.id='environment-outcome-details';outcomeDetails.append(el('summary','Compare all training and challenge errors'),outcomes);
  const ledgerDetails=el('details',undefined,'environment-ledger');ledgerDetails.append(el('summary','Inspect coefficients, source identities and all candidate attempts'));
  const ledger=el('div');ledger.id='environment-ledger';ledgerDetails.append(ledger);
  section.append(challengeTitle,challengePlots,trainingDetails,outcomeDetails,ledgerDetails,
    el('p','Shared restoring coefficients are a hypothesis. Spring, sinusoidal-position and bias terms are shared in that mode; dissipation terms may vary by condition. Physical inertia and absolute torque are unknown. A baffle or another condition change may alter inertia or the measurement zero.','environment-limit'),
    el('p','Exports contain recordings, condition declarations and the fixed protocol. Reopening recomputes fits from training; challenge observations never enter model selection.','environment-help'));
  anchor.insertAdjacentElement('afterend',section);
  const state={trainingSource:null,pendingChallenge:null,comparison:null,trainingCourse:null,challengeSource:null,challengeCourse:null,arrangement:'conditions',busy:false,revision:0,destroyed:false};
  let lastWidth=0,frame=0;
  function setControls(){
    const disabled=state.busy;
    training.input.disabled=fit.disabled=challenge.input.disabled=save.disabled=false;
    training.input.disabled=disabled;fit.disabled=disabled||!state.trainingSource;challenge.input.disabled=disabled||!state.comparison;save.disabled=disabled||!state.comparison;
    for(const input of arrangement.querySelectorAll('input'))input.disabled=disabled||!state.comparison;
    section.setAttribute('aria-busy',String(disabled));
  }
  function renderCourses(){
    if(state.destroyed||!state.comparison)return;
    renderEnvironmentCourses(trainingPlots,{environments:state.trainingSource.environments,course:state.trainingCourse,arrangement:state.arrangement});
    if(state.challengeCourse)renderEnvironmentCourses(challengePlots,{environments:state.trainingSource.environments,course:state.challengeCourse,arrangement:state.arrangement});
  }
  function renderLedger(){
    ledger.replaceChildren();
    if(!state.comparison)return;
    for(const env of state.trainingSource.environments){
      ledger.append(el('h4',env.label));
      for(const run of [...env.trainingRuns,...(state.challengeSource?.environments.find(e=>e.id===env.id)?.challengeRuns??[])]){
        const role=env.trainingRuns.some(r=>r.id===run.id)?'Training':'Challenge';
        ledger.append(el('p',role+' · '+run.label+' · '+run.source.recordingId+' · raw SHA-256 '+(run.source.rawSHA256??'not supplied')));
        ledger.append(el('small','Initial rate '+run.initialRate+' rad/s supplied at '+run.samples[0].time+' s; '+run.samples.length+' original samples. '+run.source.label));
      }
    }
    for(const [mode,id]of Object.entries(state.comparison.bestByMode)){
      const c=state.comparison.candidates.find(c=>c.id===id);if(!c)continue;
      ledger.append(el('h4',ENVIRONMENT_MODE_LABELS[mode]+' · '+id));
      for(const env of c.environmentModels)ledger.append(el('p',env.environmentId+': '+(env.model.terms.map(t=>t.id+' '+environmentFormat(t.coefficient)+' '+t.coefficientUnit).join('; ')||'Zero acceleration')));
    }
    ledger.append(el('p','All '+state.comparison.candidateCount+' attempts are retained. Competitive within score delta 6: '+state.comparison.competitiveCandidateIds.join(', ')+'. Scores use overlapping normalized windows and are not calibrated model probabilities.'));
    const region=el('div',undefined,'environment-table-region');region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Complete candidate ledger');
    const table=el('table',undefined,'environment-ledger-table'),head=el('thead'),tr=el('tr');
    for(const name of ['Candidate','Terms','Free coefficients','Score','Outcome']){const th=el('th',name);th.scope='col';tr.append(th);}
    head.append(tr);const body=el('tbody');
    for(const c of state.comparison.candidates){const row=el('tr'),name=el('th',c.id);name.scope='row';row.append(name,el('td',c.selectedTerms.join(' + ')||'Zero'),el('td',c.freeParameterCount),el('td',environmentFormat(c.score)),el('td',c.status==='fitted'?'Fitted; condition estimate '+environmentFormat(c.conditionEstimate):c.status+': '+c.failureReason));body.append(row);}
    table.append(head,body);region.append(table);ledger.append(region);
  }
  function render(){
    setControls();sources.replaceChildren();
    helper.textContent=state.challengeCourse?'Separate challenge received. Export sources to preserve this comparison for recomputation.':state.comparison?'Training fitted. Choose the separate challenge bundle to test the fixed models.':'Fit the training recordings before receiving a challenge. Packaged PASCO training and challenge bundles are linked in the README.';
    if(state.trainingSource){
      sources.append(el('h3',state.trainingSource.label));
      for(const env of state.trainingSource.environments){
        const runs=env.trainingRuns,first=runs[0],times=first.samples;
        sources.append(el('p',env.label+' · '+runs.length+' training recordings · original '+times[0].time+'–'+times.at(-1).time+' s · angle in rad'));
      }
    }
    challengeTitle.hidden=challengePlots.hidden=!state.challengeCourse;
    trainingDetails.hidden=outcomeDetails.hidden=ledgerDetails.hidden=!state.comparison;
    if(state.comparison){
      renderCourses();renderEnvironmentOutcomeTable(outcomes,{comparison:state.comparison,trainingCourse:state.trainingCourse,challengeCourse:state.challengeCourse});renderLedger();
    }else{trainingPlots.replaceChildren();challengePlots.replaceChildren();outcomes.replaceChildren();ledger.replaceChildren();}
  }
  async function transact(message,build,commit){
    if(state.busy||state.destroyed)return;
    const token=++state.revision,focused=document.activeElement;state.busy=true;error.hidden=true;error.textContent='';status.textContent=message;setControls();
    try{
      await nextFrame();const value=await build();
      if(state.destroyed||token!==state.revision)return;
      commit(value);render();
    }catch(problem){
      if(!state.destroyed&&token===state.revision){error.textContent=problem.message||'Could not process these sources.';error.hidden=false;status.textContent='The operation failed. Previously received sources and results are retained.';}
    }finally{
      if(!state.destroyed&&token===state.revision){state.busy=false;setControls();if(document.activeElement===document.body&&focused?.isConnected&&focused.matches('button,input'))focused.focus({preventScroll:true});}
    }
  }
  async function readFile(input){
    const file=input.files?.[0];if(!file)throw Error('Choose a JSON source file.');if(file.size>4000000)throw Error('Source file must be at most 4 MB.');return file.text();
  }
  training.input.addEventListener('change',()=>{if(!training.input.files?.length)return;transact('Reading training sources…',async()=>readEnvironmentSources(await readFile(training.input)),input=>{
    state.trainingSource=input.trainingSource;state.pendingChallenge=input.challengeSource;state.comparison=null;state.trainingCourse=null;state.challengeSource=null;state.challengeCourse=null;
    trainingDetails.open=true;status.textContent='Sources restored. Fit training recordings to reproduce the comparison.'+(input.challengeSource?' The restored challenge will be evaluated using the recomputed training fit.':'');training.input.value='';
  });});
  fit.addEventListener('click',()=>transact('Fitting all training candidates and executing their motion…',()=>{
    const comparison=compareSharedEnvironments(state.trainingSource),trainingCourse=evaluateSharedEnvironments(comparison);
    const challengeCourse=state.pendingChallenge?evaluateSharedEnvironments(comparison,state.pendingChallenge):null;
    return {comparison,trainingCourse,challengeCourse};
  },result=>{
    state.comparison=result.comparison;state.trainingCourse=result.trainingCourse;state.challengeCourse=result.challengeCourse;state.challengeSource=state.pendingChallenge;
    trainingDetails.open=!result.challengeCourse;
    status.textContent='All '+result.comparison.candidateCount+' candidate attempts received. Training selected '+result.comparison.selectedCandidateId+'. '+(result.challengeCourse?'Restored challenge evaluated without changing that fit.':'Receive the separate challenge when ready.');
  }));
  challenge.input.addEventListener('change',()=>{if(!challenge.input.files?.length)return;transact('Receiving challenge recordings and executing the fixed models…',async()=>{
    const raw=JSON.parse(await readFile(challenge.input));
    const source=normalizeEnvironmentChallenge(raw,state.trainingSource),course=evaluateSharedEnvironments(state.comparison,source);
    return {source,course};
  },result=>{
    state.challengeSource=result.source;state.pendingChallenge=result.source;state.challengeCourse=result.course;trainingDetails.open=false;
    status.textContent='Challenge received. The training-selected models are unchanged; every condition and all three assumptions remain visible.';challenge.input.value='';
  });});
  save.addEventListener('click',()=>{
    try{const bytes=exportEnvironmentSources(state.comparison,state.challengeSource),url=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),link=el('a');
      link.href=url;link.download='worldlaw-condition-comparison-sources.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='Source comparison exported. Fits will be recomputed when reopened.';
    }catch(problem){error.textContent=problem.message;error.hidden=false;}
  });
  arrangement.addEventListener('change',event=>{
    if(event.target.name!=='environment-arrangement')return;
    state.arrangement=event.target.value;renderCourses();status.textContent='Plots arranged '+(state.arrangement==='models'?'by model.':'by condition.');
  });
  trainingDetails.addEventListener('toggle',()=>{if(trainingDetails.open)renderCourses();});
  const observer=new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)<1)return;lastWidth=width;
    cancelAnimationFrame(frame);frame=requestAnimationFrame(renderCourses);
  });observer.observe(section);
  render();
  return {
    destroy(){state.destroyed=true;state.revision++;observer.disconnect();cancelAnimationFrame(frame);section.remove();},
    getStateSummary(){return {phase:state.busy?'busy':state.challengeCourse?'challenged':state.comparison?'fitted':state.trainingSource?'sources':'empty',
      environments:state.trainingSource?.environments.map(e=>e.id)??[],candidateCount:state.comparison?.candidateCount??0,selectedCandidateId:state.comparison?.selectedCandidateId??null,arrangement:state.arrangement};},
    setArrangement(value){if(!['conditions','models'].includes(value))throw Error('Unknown plot arrangement');state.arrangement=value;for(const input of arrangement.querySelectorAll('input'))input.checked=input.value===value;renderCourses();}
  };
}
