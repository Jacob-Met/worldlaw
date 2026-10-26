/**
 * One declared release, all current competitive scalar laws. This is a view of
 * maintained numerical predictions, never a source of observations or ranking.
 */
import {compareStudioDynamics} from './studio-dynamics-comparison.mjs';

export const COMPARISON_COLORS = ['#d4f38b','#83d7ef','#ffb77d','#e4adff','#ff91ad','#f4dd84','#9aebcb','#bfc7ff'];
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const number = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toLocaleString('en-US',{maximumFractionDigits:6}) : '—';
const shortLaw = model => model.equation || model.id;
const methodName = diagnostics => diagnostics?.method === 'adaptive_RK4_step_doubling'
  ? 'Adaptive RK4 · local estimate only'
  : diagnostics?.method === 'classical_RK4'
    ? 'Fixed-step RK4 · sign-rate law, no local error control'
    : 'Not executed';

export function mountStudioComparison(container, {transportHost, getState, getInputs, chart, onClear}) {
  let result = null, active = [], serial = 0, origin = 0, paused = true, sampleIndex = 0, lastPaintedIndex = -1;
  let times = [], view = 'joint', selectedLaw = null, previewLaw = null, playbackRate = 1;
  const heading = element('div', undefined, 'motion-comparison-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p','SAME RELEASE / COMPETING LAWS','eyebrow'),element('h2','Watch the explanations separate.'));
  const run = element('button','Compare competitive laws','button button-dark');
  run.id = 'compare-studio-laws'; run.type = 'button';
  heading.append(headingCopy,run);
  const sampling=element('div',undefined,'motion-comparison-sampling');
  const intervalLabel=element('label','Sample interval');intervalLabel.htmlFor='studio-comparison-interval';
  const intervalSelect=element('select');intervalSelect.id='studio-comparison-interval';
  for(const [value,text] of [[0.02,'20 ms'],[0.01,'10 ms'],[0.005,'5 ms'],[0.0025,'2.5 ms'],[0.00125,'1.25 ms'],[0.000625,'0.625 ms']]){
    const option=element('option',text);option.value=String(value);intervalSelect.append(option);
  }
  const samplingHint=element('p','Choose finer samples to investigate motion between displayed instants, then compare again. For fixed-step sign-rate laws, this also changes the integration step. Similar sampled paths do not establish continuous agreement.','motion-comparison-sampling-hint');
  samplingHint.id='studio-comparison-sampling-hint';intervalSelect.setAttribute('aria-describedby',samplingHint.id);
  sampling.append(intervalLabel,intervalSelect,samplingHint);
  const status = element('p','Execute every training-competitive law with the initial angle, rate, inertia and fixed command in “Let the model move”. No new observation is created.','motion-comparison-status');
  status.id = 'studio-comparison-status'; status.setAttribute('role','status');
  const assumptions = element('p',undefined,'motion-comparison-assumptions'); assumptions.hidden = true;
  assumptions.id = 'studio-comparison-assumptions';
  const details = element('details',undefined,'motion-comparison-details'); details.hidden = true;
  const summary = element('summary','Inspect all laws and sampled angle traces');
  const spread=element('p',undefined,'motion-comparison-sampled-spread');spread.id='studio-comparison-spread';spread.hidden=true;
  const plot = element('div',undefined,'chart'); plot.id = 'studio-comparison-chart';
  const tableWrap = element('div',undefined,'motion-comparison-table-wrap');
  tableWrap.tabIndex = 0; tableWrap.setAttribute('role','region'); tableWrap.setAttribute('aria-label','Every competitive law and its numerical result');
  const table = element('table'), caption = element('caption','All original competitive laws; computation does not select a physical winner.');
  const head = element('thead'), header = element('tr');
  for (const label of ['Law','Executable equation','Numerical outcome']) {const cell=element('th',label);cell.scope='col';header.append(cell);}
  head.append(header);const body=element('tbody');body.id='studio-comparison-outcomes';table.append(caption,head,body);tableWrap.append(table);
  details.append(summary,spread,plot,tableWrap,element('p','These paths condition on declared inertia and command. They can leave the observed input range. Agreement is not physical validation; disagreement is not calibrated uncertainty. The shared joint wraps angles visually; the traces retain full rotations.','motion-comparison-scope'));
  container.append(heading,sampling,status,assumptions,details);

  const transport = element('div',undefined,'motion-comparison-transport'); transport.hidden = true; transport.id='studio-comparison-transport';
  const controlRow=element('div',undefined,'motion-comparison-control-row');
  const pause=element('button','Play predictions','button');pause.type='button';pause.id='studio-comparison-pause';pause.dataset.paused='true';
  const label=element('label','Prediction time','motion-comparison-time-label');label.htmlFor='studio-comparison-time';
  const slider=element('input');slider.type='range';slider.id='studio-comparison-time';slider.min='0';slider.max='0';slider.step='1';slider.value='0';
  const clock=element('output','0 s');clock.id='studio-comparison-clock';clock.htmlFor=slider.id;clock.setAttribute('aria-live','off');
  const viewLabel=element('label','View');viewLabel.htmlFor='studio-comparison-view';
  const viewSelect=element('select');viewSelect.id='studio-comparison-view';
  for (const [value,text] of [['joint','Shared joint'],['phase','Angle–rate paths']]) {const option=element('option',text);option.value=value;viewSelect.append(option);}
  const speedLabel=element('label','Playback');speedLabel.htmlFor='studio-comparison-speed';
  const speedSelect=element('select');speedSelect.id='studio-comparison-speed';
  for(const [value,text] of [[1,'1×'],[0.25,'0.25×'],[0.05,'0.05×'],[0.01,'0.01×']]){
    const option=element('option',text);option.value=String(value);speedSelect.append(option);
  }
  const clear=element('button','Return to inspected law','button');clear.type='button';clear.id='clear-studio-comparison';
  controlRow.append(pause,label,slider,clock);
  const optionsRow=element('div',undefined,'motion-comparison-options-row');
  optionsRow.append(viewLabel,viewSelect,speedLabel,speedSelect,clear);
  const legend=element('div',undefined,'motion-comparison-legend');legend.id='studio-comparison-legend';
  const note=element('p','All positions are executed predictions at the same sampled time.','motion-comparison-transport-note');
  transport.append(controlRow,optionsRow,legend,note);transportHost.append(transport);

  function setPaused(value) {
    paused=value;pause.textContent=paused?'Play predictions':'Pause predictions';
    pause.dataset.paused=String(paused);
    if(!paused) origin=performance.now()-(times[sampleIndex]||0)*1000/playbackRate;
  }
  function retire(message='The comparison was retired. Compare again using the current evidence and dynamics inputs.') {
    const hadResult=Boolean(result)||run.disabled;
    serial++; result=null;active=[];times=[];sampleIndex=0;lastPaintedIndex=-1;selectedLaw=null;previewLaw=null;
    transport.hidden=true;details.hidden=true;assumptions.hidden=true;spread.hidden=true;spread.textContent='';
    body.replaceChildren();plot.replaceChildren();legend.replaceChildren();run.disabled=false;
    delete status.dataset.state;
    if(hadResult) status.textContent=message;
    return hadResult;
  }
  function repaintClock() {
    const t=times[sampleIndex]||0;
    slider.value=String(sampleIndex);clock.textContent=number(t)+' s';
    slider.setAttribute('aria-valuetext',number(t)+' seconds, sample '+(sampleIndex+1)+' of '+times.length);
    for(let i=0;i<active.length;i++){
      const row=active[i],sample=row.trajectory[sampleIndex];
      row.valueNode.textContent=row.label+' · θ '+number(sample.position)+' rad';
    }
    lastPaintedIndex=sampleIndex;
  }
  function renderPlot() {
    if(!active.length)return;
    chart(plot.id,active.map(row=>({name:row.label,color:row.color,line:true,points:row.trajectory.map(sample=>({x:sample.time,y:sample.position}))})),
      {xLabel:'Prediction time (s)',yLabel:'Predicted angle (rad)',width:plot.clientWidth||580,zeroTickTolerance:1e-6});
    plot.querySelector('svg')?.classList.add('motion-comparison-svg');
  }
  details.addEventListener('toggle',()=>{if(details.open)renderPlot();});
  window.addEventListener('resize',()=>{if(details.open)renderPlot();});
  pause.addEventListener('click',()=>setPaused(!paused));
  slider.addEventListener('input',()=>{sampleIndex=Number(slider.value);setPaused(true);repaintClock();});
  viewSelect.addEventListener('change',()=>{view=viewSelect.value;});
  intervalSelect.addEventListener('change',()=>{
    retire('Sample interval changed. Compare again to recompute every competitive law on the new common grid.');
  });
  speedSelect.addEventListener('change',()=>{
    const now=performance.now(),duration=times.at(-1)||0;
    const phase=!paused&&duration>0?((now-origin)*playbackRate/1000)%duration:(times[sampleIndex]||0);
    playbackRate=Number(speedSelect.value);
    if(!paused)origin=now-phase*1000/playbackRate;
  });
  clear.addEventListener('click',()=>{retire('Returned to the inspected law. Every competitive structure remains in the original discovery.');onClear?.();});
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change',event=>{if(event.matches&&result)setPaused(true);});

  run.addEventListener('click',async()=>{
    const token=++serial, state=getState();
    let inputs;
    try {inputs=getInputs();inputs={...inputs,settings:{...inputs.settings,dt:Number(intervalSelect.value)}};}
    catch(error){retire();status.textContent='Comparison unavailable: '+error.message;status.dataset.state='refused';return;}
    result=null;active=[];times=[];selectedLaw=null;previewLaw=null;transport.hidden=true;details.hidden=true;assumptions.hidden=true;spread.hidden=true;spread.textContent='';
    body.replaceChildren();plot.replaceChildren();legend.replaceChildren();run.disabled=true;
    status.textContent='Executing the complete competitive set under one declared release…';
    await new Promise(requestAnimationFrame);
    if(token!==serial||state!==getState())return;
    try {
      const next=compareStudioDynamics(state.discovery,inputs.initial,inputs.settings);
      if(token!==serial||state!==getState())return;
      result=next;
      const outcomes=next.results;
      const successful=outcomes.filter(row=>row.status==='completed');
      active=successful.map(row=>{
        const originalIndex=outcomes.indexOf(row);
        return {...row,label:'L'+(originalIndex+1),color:COMPARISON_COLORS[originalIndex%COMPARISON_COLORS.length]};
      });
      const complete=outcomes.length>0&&active.length===outcomes.length;
      const stopped=outcomes.length-active.length;
      status.dataset.state=next.status;
      status.textContent=complete
        ? 'All '+outcomes.length+' competitive laws executed. Scrub the same instant or play their predictions together.'
        : active.length+' of '+outcomes.length+' competitive laws executed; '+stopped+' refused. The comparison is incomplete. Every refusal remains below.';
      if(!outcomes.length)status.textContent='Comparison unavailable: '+(next.message||'No competitive laws were supplied.');
      const initial=inputs.initial,s=inputs.settings;
      assumptions.textContent='Common release: θ '+number(initial.position)+' rad · ω '+number(initial.rate)+' rad/s · inertia '+number(s.inertia)+' kg·m² · fixed command '+number(s.command)+' N·m · '+number(s.duration)+' s · samples every '+number(s.dt*1000)+' ms. '+(next.work?.description||'Each original law uses the same bounded numerical policy.');
      assumptions.hidden=false;details.hidden=false;
      if(next.summary){
        const difference=next.summary.maxPositionSpread;
        spread.textContent='Maximum sampled angle difference: '+(difference>0&&difference<0.0001?difference.toExponential(2):number(difference))+' rad at '+number(next.summary.maxPositionSpreadTime)+' s. Plot is autoscaled; this describes returned samples only.';
        spread.hidden=false;
      }
      summary.textContent='Inspect all '+outcomes.length+' laws and sampled angle traces';
      for(let i=0;i<outcomes.length;i++){
        const outcome=outcomes[i],row=element('tr');row.dataset.modelId=outcome.id;row.dataset.status=outcome.status;
        row.append(element('th','L'+(i+1)),element('td',shortLaw(outcome)));
        const cell=element('td',outcome.status==='completed'
          ? methodName(outcome.diagnostics)+' · '+outcome.trajectory.length+' samples'
          : 'Refused: '+(outcome.error?.message||outcome.message||outcome.error||'Numerical execution unavailable'));
        row.append(cell);body.append(row);
      }
      if(active.length){
        times=active[0].trajectory.map(sample=>sample.time);sampleIndex=0;lastPaintedIndex=-1;
        slider.max=String(times.length-1);slider.value='0';transport.hidden=false;
        for(const row of active){
          const item=element('button'),dot=element('i');dot.style.background=row.color;dot.setAttribute('aria-hidden','true');
          item.type='button';item.className='motion-law-toggle';item.dataset.modelId=row.id;
          item.title='Highlight '+row.label+': '+row.equation+'. All original laws remain in view.';
          item.setAttribute('aria-pressed','false');item.setAttribute('aria-label','Highlight '+row.label+': '+row.equation);row.toggle=item;
          item.addEventListener('click',()=>{selectedLaw=selectedLaw===row.id?null:row.id;for(const law of active)law.toggle.setAttribute('aria-pressed',String(law.id===selectedLaw));});
          item.addEventListener('mouseenter',()=>{previewLaw=row.id;});
          item.addEventListener('mouseleave',()=>{previewLaw=null;});
          item.addEventListener('focus',()=>{previewLaw=row.id;});
          item.addEventListener('blur',()=>{previewLaw=null;});
          row.valueNode=element('span');item.append(dot,row.valueNode);legend.append(item);
        }
        chart(plot.id,active.map(row=>({name:row.label,color:row.color,line:true,points:row.trajectory.map(sample=>({x:sample.time,y:sample.position}))})),
          {xLabel:'Prediction time (s)',yLabel:'Predicted angle (rad)',width:plot.clientWidth,zeroTickTolerance:1e-6});
        plot.querySelector('svg')?.classList.add('motion-comparison-svg');
        setPaused(media.matches);repaintClock();
        note.textContent=complete
          ? 'Complete competitive set · executed predictions, not observations. Highlight a law with its legend button; all laws remain visible. Space is schematic; angles and time are numerical.'
          : 'Incomplete set: '+stopped+' refused laws are not pictured. The surviving paths do not establish agreement of the complete set.';
        note.textContent+=' Sampled states only: slow playback or scrub to inspect them. Playback speed adds no samples; fast motion may still be missed between frames or samples.';
      } else {
        plot.append(element('p','No complete predicted path is available. Inspect the refusal for every original law.','empty-state'));
      }
    }catch(error){
      retire();status.textContent='Comparison unavailable: '+error.message;status.dataset.state='refused';
    }finally{if(token===serial)run.disabled=false;}
  });

  function frame(now) {
    if(!result||!active.length)return null;
    if(!paused){
      const duration=times.at(-1),time=duration>0?((now-origin)*playbackRate/1000)%duration:0;
      let lo=0,hi=times.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(times[mid]<=time)lo=mid;else hi=mid-1;}
      sampleIndex=lo;
    }
    if(sampleIndex!==lastPaintedIndex)repaintClock();
    return {time:times[sampleIndex],sampleIndex,view,paused,highlightId:previewLaw||selectedLaw,complete:active.length===result.results.length,
      total:result.results.length,paths:active,
      samples:active.map(row=>({id:row.id,label:row.label,color:row.color,...row.trajectory[sampleIndex]}))};
  }
  return {retire,frame,get active(){return Boolean(result&&active.length);}};
}
