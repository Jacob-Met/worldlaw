import {renderAngularFrequency} from './science/angular-frequency-panel.mjs';
import {renderOrderedLawChange} from './science/ordered-law-change-panel.mjs';
import {mountScalarExcitation} from './science/excitation-design-panel.mjs';
let excitationPanel=null;
import {renderCommandDeadzone} from './science/command-deadzone-panel.mjs';
import {mountSensorResponse} from './science/sensor-response-panel.mjs';
import {renderConditionalRate} from './science/conditional-rate-panel.mjs';
import {renderEnergyBudget} from './science/energy-budget-panel.mjs';
import {mountAffineClocks} from './science/clock-affine-panel.mjs';
import {mountClockOffsets} from './science/clock-offset-panel.mjs';
import {renderInputEnclosures} from './science/input-enclosure-panel.mjs';
import {renderStateSupport} from './science/state-support-panel.mjs';
import {renderParameterSensitivity} from './science/parameter-sensitivity-panel.mjs';
import {renderPredictionSensitivity} from './science/prediction-sensitivity-panel.mjs';
import {diagnoseReplicates} from './science/replicate-diagnostics.mjs';
import {renderSeparability} from './science/separability-panel.mjs';
import {evaluate,predict} from './science/torque-discovery.mjs';
import {executeStudioDynamics} from './science/studio-dynamics.mjs';
import {mountStudioComparison} from './science/studio-comparison-panel.mjs';
import {drawCompetitiveMotion} from './science/studio-comparison-view.mjs';
import {softL1Weight} from './science/robust-fit.mjs';
import {proposeScalarLibrary} from './science/library-proposal.mjs';
import {parseObservationText,observationsCSV} from './data.mjs';
import {createSession,newVirtualSession,appendMeasurements,runVirtualExperiment,refitSession,sessionPlan,sessionPilotPlan,exportSession,restoreSession,undoSession,MAX_SESSION_FILE_BYTES} from './session.mjs';
import {restoreNotebook} from './notebook-input.mjs';
import {createNotebookStorage} from './notebook-recovery.mjs';
import {renderExperimentReceipts} from './science/experiment-receipts-panel.mjs';

const $=id=>document.getElementById(id);
const notebookStorage=createNotebookStorage(()=>localStorage);
const names={command:'Actuation',rate:'Viscous damping',coulomb:'Coulomb friction',spring:'Linear spring',gravity:'Sinusoidal gravity',quadratic:'Quadratic drag',bias:'Bias',cubic:'Cubic position',cosine:'Cosine position',rate_squared:'Even rate',command_position:'Command × position'};
const fmt=(value,digits=4)=>value===null||!Number.isFinite(value)?'—':Math.abs(value)>0&&Math.abs(value)<0.0001?value.toExponential(2):Number(value.toPrecision(digits)).toLocaleString('en-US',{maximumFractionDigits:6});
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const set=(id,text)=>{$(id).textContent=text;};
let clockPanel=null,affinePanel=null,deadzoneWidths=null,frequencySettings=null;
let state,modelId,plan,trajectory=[],animationStart=0,animationHandle,restored=false,generation=0;
let observationRead=0,sessionRead=0;
let studioComparison=null;
function alertError(error) { $('error').hidden=false;set('error',error.message||String(error));$('error').focus(); }
function notice(text) {set('notice',text);$('error').hidden=true;}
function action(fn) {try{fn();}catch(error){alertError(error);}}
function save() {
  const result=notebookStorage.saveCurrent(exportSession(state));
  if(result.ok)set('storage-status','Notebook saved on this browser');
  else if(result.reason==='protected')set('storage-status','Unreadable saved notebook protected · current changes are not stored. Download or explicitly archive and replace the original below.');
  else if(result.reason==='read-denied')set('storage-status','Browser storage could not be read · current changes are not stored. Export this notebook and reload after storage is restored.');
  else set('storage-status','Browser storage unavailable · export to keep this notebook');
}
function adopt(next,message,widths=null,frequency=null) {generation++;state=next;deadzoneWidths=widths;frequencySettings=frequency;modelId=state.discovery.selected.id;render();save();notice(message);}
// Selection owns a pending replacement across every Studio source entry point.
// An invalid newest file leaves the accepted notebook intact without reviving an older read.
function beginSourceReplacement(){return ++generation;}
function model(){return state.discovery.candidates.find(m=>m.id===modelId)||state.discovery.selected;}
function numberInput(id){const v=$(id).value.trim();if(!v||!Number.isFinite(Number(v)))throw new Error(`Enter a finite value for ${$(id).labels?.[0]?.textContent||id}.`);return Number(v);}
function experimentInput(){return Object.fromEntries(['command','position','rate'].map(f=>[f,numberInput(f)]));}
function download(text,filename,type='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function refreshNotebookRecovery() {
  const original=notebookStorage.protectedOriginal, listing=notebookStorage.archives();
  const entries=listing.ok?listing.entries:[];
  const select=$('recovery-choice'), oldSelection=select.value;
  select.replaceChildren();
  for(const entry of entries){
    const option=el('option',`Recovered original ${entry.slot}`);
    option.value=String(entry.slot);
    select.append(option);
  }
  if(entries.some(entry=>String(entry.slot)===oldSelection))select.value=oldSelection;
  $('download-unreadable').hidden=original===null;
  $('replace-unreadable').hidden=original===null;
  for(const id of ['recovery-choice-label','recovery-choice','download-archived'])$(id).hidden=!entries.length;
  $('storage-recovery').hidden=original===null&&!entries.length;
  set('storage-recovery-message',original!==null?'An earlier saved notebook could not be opened. Its text remains in browser storage, and automatic saving is paused. This workspace is a separate fallback example until you open or import another source. Download the original; replacing it first archives and verifies the original text.': 'An earlier unreadable notebook was archived before explicit replacement. Download its original text here.');
}
function configureNotebookRecovery(){
  $('download-unreadable').addEventListener('click',()=>{
    const raw=notebookStorage.protectedOriginal;
    if(raw!==null)download(raw,'worldlaw-unreadable-original.txt','text/plain;charset=utf-8');
  });
  $('download-archived').addEventListener('click',()=>action(()=>{
    const listing=notebookStorage.archives();
    if(!listing.ok)throw new Error('Recovery archive is not readable in this browser.');
    const slot=Number($('recovery-choice').value);
    const source=listing.entries.find(entry=>entry.slot===slot);
    if(!source)throw new Error('The selected original recovery copy is no longer available.');
    download(source.text,`worldlaw-recovered-original-${slot}.txt`,'text/plain;charset=utf-8');
  }));
  $('replace-unreadable').addEventListener('click',()=>action(()=>{
    if(!confirm('Archive the exact unreadable original first, then replace the active browser notebook with the currently displayed workspace? The archive remains downloadable on later visits.'))return;
    const outcome=notebookStorage.archiveAndReplace(exportSession(state));
    if(!outcome.ok){
      set('storage-status',outcome.reason==='active-source-changed'?'Saved notebook changed in another tab. No replacement was made; reload before trying again.':'Could not verify a durable recovery copy and replacement. Original saved source remains protected; export your current workspace.');
      refreshNotebookRecovery();
      return;
    }
    set('storage-status','Current notebook saved on this browser. Its earlier unreadable original remains in the downloadable recovery archive.');
    refreshNotebookRecovery();
    notice('Archived and read back the original saved text before replacing the active notebook.');
  }));
  refreshNotebookRecovery();
}
function chart(container,series,{xLabel,yLabel,diagonal=false,width=580,zeroTickTolerance=0}={}) {
  const wrap=$(container);wrap.replaceChildren();
  const values=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!values.length){wrap.append(el('p','No observations available for this view.','empty-state'));return;}
  const ns='http://www.w3.org/2000/svg', W=Number.isFinite(width)?Math.max(280,Math.min(580,width)):580,H=264,L=68,R=18,T=18,B=50;
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${yLabel} against ${xLabel}; ${values.length} plotted values.`);
  const title=document.createElementNS(ns,'title');title.textContent=`${yLabel} against ${xLabel}`;svg.append(title);
  let x0=Math.min(...values.map(p=>p.x)),x1=Math.max(...values.map(p=>p.x)),y0=Math.min(...values.map(p=>p.y)),y1=Math.max(...values.map(p=>p.y));
  if(diagonal){x0=y0=Math.min(x0,y0);x1=y1=Math.max(x1,y1);}
  const xp=Math.max((x1-x0)*.07,1e-8),yp=Math.max((y1-y0)*.12,1e-8);x0-=xp;x1+=xp;y0-=yp;y1+=yp;
  const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-T-B);
  function shape(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;}
  const ticks=W<420?2:4;
  for(let i=0;i<=ticks;i++){
    const x=x0+(x1-x0)*i/ticks,y=y0+(y1-y0)*i/ticks;
    shape('line',{x1:X(x),x2:X(x),y1:T,y2:H-B,stroke:'#dfe6df','stroke-dasharray':'2 5'});
    shape('line',{x1:L,x2:W-R,y1:Y(y),y2:Y(y),stroke:'#dfe6df','stroke-dasharray':'2 5'});
    shape('text',{x:X(x),y:H-B+21,'text-anchor':'middle',fill:'#53655f','font-size':11},fmt(x,3));
    shape('text',{x:L-9,y:Y(y)+4,'text-anchor':'end',fill:'#53655f','font-size':11},fmt(Math.abs(y)<(y1-y0)*zeroTickTolerance?0:y,3));
  }
  if(diagonal)shape('line',{x1:X(Math.max(x0,y0)),x2:X(Math.min(x1,y1)),y1:Y(Math.max(x0,y0)),y2:Y(Math.min(x1,y1)),stroke:'#a4b1a7','stroke-dasharray':'4 4'});
  if(y0<0&&y1>0)shape('line',{x1:L,x2:W-R,y1:Y(0),y2:Y(0),stroke:'#aab9b1','stroke-width':1});
  for(const s of series){
    if(s.line)shape('polyline',{points:s.points.map(p=>`${X(p.x)},${Y(p.y)}`).join(' '),fill:'none',stroke:s.color,'stroke-width':2.2,'stroke-linejoin':'round'});
    else for(const p of s.points){const point=shape('circle',{cx:X(p.x),cy:Y(p.y),r:3.1,fill:s.color,opacity:.77});const t=document.createElementNS(ns,'title');t.textContent=`${s.name}: ${xLabel} ${fmt(p.x)}, ${yLabel} ${fmt(p.y)}`;point.append(t);}
  }
  shape('text',{x:(L+W-R)/2,y:H-5,'text-anchor':'middle',fill:'#53655f','font-size':12},xLabel);
  shape('text',{transform:`translate(15 ${(H-B+T)/2}) rotate(-90)`,'text-anchor':'middle',fill:'#53655f','font-size':12},yLabel);
  wrap.append(svg);
  const legend=el('div',undefined,'chart-legend');for(const s of series){const item=el('span');const dot=el('i');dot.style.background=s.color;item.append(dot,document.createTextNode(s.name));legend.append(item);}wrap.append(legend);
}
function renderHypotheses(){
  const list=$('hypothesis-list');list.replaceChildren();
  for(const m of state.discovery.candidates.slice(0,8)){
    const button=el('button',undefined,'hypothesis'+(m.id===model().id?' is-selected':''));button.type='button';button.setAttribute('aria-pressed',String(m.id===model().id));
    const title=el('span',m.id==='zero'?'Zero torque':m.terms.map(t=>names[t.id]).join(' + '),'hypothesis-name');
    const meta=el('span',`Δ score ${fmt(m.metrics.score-state.discovery.selected.metrics.score,3)} · ${m.terms.length} terms`,'hypothesis-meta');
    button.append(title,meta);button.addEventListener('click',()=>action(()=>{modelId=m.id;renderModel();renderHypotheses();notice(`Inspecting ${title.textContent}. The discovery ranking is unchanged.`);}));list.append(button);
  }
}
function renderModel(){
  clockPanel?.studioChanged();
  affinePanel?.studioChanged();
  const m=model(),train=evaluate(m,state.discovery.observations),held=evaluate(m,state.base.heldOut);
  set('model-heading',m.id===state.discovery.selected.id?'A model to put to the test.':'Inspecting an alternative model.');
  set('selected-equation',m.equation.replaceAll(' + -',' − ').replace(' = -',' = −'));set('selected-terms',m.terms.length?m.terms.map(t=>`${names[t.id]} ${fmt(t.coefficient)}`).join(' · '):'No selected terms');
  set('training-error',fmt(train.rmse));set('heldout-error',fmt(held.rmse));
  const lossResult=$('reading-loss-result');lossResult.replaceChildren();
  if(m.fitting?.loss==='soft_l1'||m.fitting?.loss==='weighted_least_squares'){
    const weighted=m.fitting.loss==='weighted_least_squares';
    const scale=m.fitting.scale;
    lossResult.append(el('p',weighted?`Weighted least squares under declared torque-noise ratios. Ratio-normalized training RMSE: ${fmt(m.metrics.weighted.relativeNoiseRmse)} N·m at reference ratio one. Ranking and adequacy compare that value with the assumed reference noise ${fmt(state.options.noiseSigma)} N·m. Raw training error above retains every reading. ${held.relativeNoiseRmse===undefined?'Held-out error remains raw; no held-out ratios were supplied.':`Held-out ratio-normalized RMSE: ${fmt(held.relativeNoiseRmse)} N·m; these held-out rows never fit or rank models.`}`:`Soft-L1 fit at ${fmt(scale)} N·m scale. ${m.metrics.robust.halfWeightCount} of ${train.count} readings have loss weight below 0.5. Training error above still includes every raw residual. This does not identify faulty readings.`));
    const details=el('details'),summary=el('summary','Inspect every original reading and its loss influence');details.append(summary);
    const scroll=el('div',undefined,'prediction-sensitivity-scroll reading-influence-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',weighted?'Original torque readings and declared noise ratios':'Original torque readings and soft-L1 loss influence');
    const table=el('table'),head=el('thead'),heading=el('tr');
    for(const title of ['Source row','Command N·m','Angle rad','Rate rad/s','Observed N·m','Residual N·m',...(weighted?['Declared ratio','1 / ratio² weight']:['Loss weight'])]){const th=el('th',title);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
    const body=el('tbody');train.rows.forEach((row,index)=>{const tr=el('tr');tr.dataset.sourceRow=String(index);for(const value of [String(index+1),fmt(row.command),fmt(row.position),fmt(row.rate),fmt(row.jointTorque),fmt(row.residual),...(weighted?[fmt(row.torqueNoiseRatio),fmt(1/row.torqueNoiseRatio**2)]:[fmt(softL1Weight(row.residual,scale))])])tr.append(el('td',value));body.append(tr);});table.append(body);scroll.append(table);details.append(scroll,el('p',weighted?'The declared standard deviation of a row is reference noise × ratio. Weights are mathematical consequences of that declaration, not confidence. Wrong ratios, correlated noise and errors in input coordinates can mislead the fit. Rank and conditioning refer to the weighted design.':'Weights describe this chosen loss, not reading reliability or probabilities. Coordinate leverage, coherent missing physics and many conflicting readings can still mislead the fit.'));lossResult.append(details);
  }
  const before=state.history[0].heldOutRMSE;
  const change=before!==null&&held.rmse!==null?before-held.rmse:null;
  set('heldout-change',change===null?'Import held-out rows to test predictions':`${change>=0?'−':'+'}${fmt(Math.abs(change))} N·m vs initial model`);
  chart('prediction-chart',[
    {name:'Fit observations',color:'#1c7562',points:train.rows.map(r=>({x:r.jointTorque,y:r.prediction}))},
    {name:'Held-out observations',color:'#ba6b32',points:held.rows.map(r=>({x:r.jointTorque,y:r.prediction}))}
  ],{xLabel:'Observed torque (N·m)',yLabel:'Predicted torque (N·m)',diagonal:true});
  chart('residual-chart',[
    {name:'Fit residual',color:'#1c7562',points:train.rows.map(r=>({x:r.position,y:r.residual}))},
    {name:'Held-out residual',color:'#ba6b32',points:held.rows.map(r=>({x:r.position,y:r.residual}))}
  ],{xLabel:'Angle (rad)',yLabel:'Observed − predicted (N·m)'});
  let box=$('replicate-diagnostics');
  if(!box){box=el('div');box.id='replicate-diagnostics';$('residual-chart').after(box);}
  const rd=diagnoseReplicates(m,state.discovery.observations);
  box.replaceChildren(el('h3','Repeated-state diagnosis'),
    el('p',rd.pureErrorDF?`${rd.replicatedRows} rows in ${rd.replicatedGroups} repeated states; ${rd.singletonRows} singleton rows. Within-state scatter: ${fmt(rd.repeatabilityRMS)} N·m (${rd.pureErrorDF} degrees of freedom). Group-mean mismatch: ${fmt(rd.meanMismatchRMS)} N·m over all ${rd.count} rows.`:'No exact repeated states: within-state scatter is unavailable. Repeat the same declared command, angle and rate to examine variability.'),
    el('p','Exact inputs are grouped without rounding. Scatter may include drift or hidden state; duplicate rows are not verified independent acquisitions. Group-mean mismatch includes noise and fitting reuse, not just systematic law error. No calibrated confidence or physical cause is established.','subtle'));
  let support=$('state-support');if(!support){support=el('div');support.id='state-support';$('replicate-diagnostics').after(support);}
  renderStateSupport(support,m,state.discovery.observations);
  let ordered=$('ordered-law-change');if(!ordered){ordered=el('div');ordered.id='ordered-law-change';support.after(ordered);}
  renderOrderedLawChange(ordered,m,state.discovery.observations,state.options.noiseSigma,{chart});
  let sensitivity=$('parameter-sensitivity');if(!sensitivity){sensitivity=el('div');sensitivity.id='parameter-sensitivity';support.after(sensitivity);}
  renderParameterSensitivity(sensitivity,m,state.discovery.observations);
  let readout=$('prediction-sensitivity');if(!readout){readout=el('div');readout.id='prediction-sensitivity';sensitivity.after(readout);}
  renderPredictionSensitivity(readout,m,state.discovery.observations,state.base.heldOut);
  if(m.fitting?.loss==='soft_l1'||m.fitting?.loss==='weighted_least_squares')for(const host of [support,sensitivity,readout])host.prepend(el('p',`Least-squares comparison: this diagnostic refits the inspected structure using ordinary least squares. Any refit shift includes that change of loss; these are not sensitivities of the ${m.fitting.loss==='soft_l1'?'soft-L1':'declared-ratio weighted'} estimator.`,'loss-diagnostic-note'));
  let enclosure=$('input-enclosures');if(!enclosure){enclosure=el('div');enclosure.id='input-enclosures';$('state-support').after(enclosure);}
  renderInputEnclosures(enclosure,m,state.discovery.observations);
  let separability=$('separability');if(!separability){separability=el('div');separability.id='separability';$('replicate-diagnostics').after(separability);}
  renderSeparability(separability,state.discovery.observations,state.base.source);
  let deadzone=$('command-deadzone-container');if(!deadzone){deadzone=el('div');deadzone.id='command-deadzone-container';$('residual-chart').after(deadzone);}
  if(!$('sensor-response-container')){const response=el('div');response.id='sensor-response-container';deadzone.after(response);mountSensorResponse(response,{chart});}
  renderCommandDeadzone(deadzone,state,{chart,beginSourceReplacement,getSourceGeneration:()=>generation,widths:deadzoneWidths,onReopen:(next,widths)=>adopt(next,'Reopened original command-map comparison inputs. Compare again to recompute.',widths),simulationInputs:()=>({initial:{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},settings:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')}})});
  let frequency=$('angular-frequency-container');if(!frequency){frequency=el('div');frequency.id='angular-frequency-container';deadzone.after(frequency);}
  renderAngularFrequency(frequency,state,{chart,beginSourceReplacement,getSourceGeneration:()=>generation,onSettings:settings=>{frequencySettings=settings;},useInput:input=>{for(const field of ['command','position','rate'])$(field).value=String(input[field]);notice('Exact offered state copied. Obtain and enter a separate torque reading, then infer the period again.');$('measured-torque').focus();},settings:frequencySettings,onReopen:(next,settings)=>{adopt(next,'Reopened original periodic-response inputs. Infer again to recompute.');frequencySettings=settings;render();},simulationInputs:()=>({initial:{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},settings:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')}})});
  runSimulation(false);
}
function render(){
  excitationPanel?.studioChanged();
  const d=state.discovery;set('source-name',state.base.source.label);set('source-kind',state.lab?'Virtual instrument · synthetic evidence':'Imported observations · user-supplied evidence');
  set('sample-count',String(d.observations.length));set('heldout-count',String(state.base.heldOut.length));set('candidate-count',String(d.candidates.length));
  $('undo').disabled=state.events.length===0;$('measured-field').hidden=Boolean(state.lab);$('run-experiment').textContent=state.lab?'Run virtual experiment':'Record measured outcome';
  set('experiment-mode',state.lab?'Execute the virtual torque instrument at these inputs.':'Use your instrument, then enter its measured net torque. No hardware is controlled.');
  $('noise-sigma').value=state.options.noiseSigma;
  $('reading-loss').value=state.options.loss??'least_squares';
  const hasRatios=d.observations[0]?.torqueNoiseRatio!==undefined;
  $('weighted-loss-choice').disabled=!hasRatios;
  $('measurement-noise-field').hidden=Boolean(state.lab)||!hasRatios;
  set('noise-ratio-status',hasRatios?`${d.observations.length} original readings retain declared noise ratios. Weighted least squares uses assumed torque noise as the reference standard deviation, multiplied by each row’s ratio. Other losses retain these declarations without using them.`:'Import a torqueNoiseRatio column to declare each reading’s relative noise. Ratios are assumptions, not measured reliability. Weighted fitting is unavailable without a ratio for every training row.');
  $('loss-scale').value=state.options.lossScale??0.03;
  $('loss-scale').disabled=state.options.loss!=='soft_l1';
  set('loss-choice-status',state.options.loss==='soft_l1'?`Applied soft-L1 scale ${fmt(state.options.lossScale)} N·m. Loss and scale revisions remain in the notebook.`:state.options.loss==='weighted_least_squares'?'Applied weighted least squares using the original declared noise ratios. Source and fitting history remain in the notebook.':'Applied least squares. Choose a loss and refit to compare a different assumption.');
  $('include-command-position').checked=Boolean(state.options.includeCommandPosition);
  for(const id of ['cubic','cosine','rate_squared'])$('include-'+id.replaceAll('_','-')).checked=Boolean(state.options.additionalTerms?.includes(id));
  set('library-proposal-status','Investigations use the applied noise, loss and maximum term count. A training preference is not independent predictive validation.');
  $('library-proposal-comparison').replaceChildren();
  set('feature-library-status',`Applied library: ${state.discovery.options.terms.map(id=>names[id]).join(', ')}. Terms are admitted, not assumed true. A revision retains the initial fit and original evidence in notebook history.`);
  const diag=d.diagnostics;
  set('diagnostics',`${diag.competitiveCount} competitive ${diag.competitiveCount===1?'structure':'structures'} at the current noise assumption. ${diag.adequacy==='residual_mismatch'?'Residual mismatch: this library does not explain the data within the assumed noise.':diag.selectionAmbiguous?'The current observations do not isolate a unique explanation.':'One structure ranks ahead within this finite library.'}${diag.identifiability==='insufficient_excitation'?' Some inputs are not independently excited; more varied observations are needed.':''}${state.options.loss==='weighted_least_squares'?' Adequacy and numerical rank use the declared weighted design; an incorrect noise declaration can conceal mismatch.':''}`);
  renderPlan();
  const history=$('history-list');history.replaceChildren();
  state.history.forEach((entry,i)=>{const li=el('li');li.append(el('span',String(i+1).padStart(2,'0'),'history-index'),el('strong',entry.label),el('span',`${entry.count} rows · ${entry.modelId} · held-out ${fmt(entry.heldOutRMSE)} N·m${entry.loss==='weighted_least_squares'?` · weighted fit, normalized training ${fmt(entry.relativeNoiseRmse)} N·m`:''}`,'history-detail'));history.append(li);});
  let receipts=$('experiment-receipts');
  if(!receipts){receipts=el('section');receipts.id='experiment-receipts';receipts.className='panel';receipts.setAttribute('aria-label','Predictions before measurement updates');history.parentElement.after(receipts);}
  renderExperimentReceipts(receipts,state,{chart});
  let receiptShortcut=$('inspect-last-experiment');
  if(!receiptShortcut){receiptShortcut=el('button','Inspect predictions before this outcome','button button-outline button-full');receiptShortcut.id='inspect-last-experiment';receiptShortcut.type='button';$('run-experiment').after(receiptShortcut);receiptShortcut.addEventListener('click',()=>{const select=$('experiment-receipt-event');if(!select)return;select.value=select.options[select.options.length-1].value;select.dispatchEvent(new Event('change'));$('experiment-receipts').scrollIntoView({block:'start'});$('experiment-receipt-event').focus();});}
  receiptShortcut.hidden=!state.history.some(entry=>entry.experiment);
  renderHypotheses();renderModel();
}
function renderPlan(){
  const pilot=$('planner-objective').value==='excitation';
  plan=pilot?sessionPilotPlan(state):sessionPlan(state);
  $('use-proposal').disabled=!plan.selected;
  $('pilot-explanation').hidden=!pilot;
  $('pilot-course').hidden=!pilot || !plan.outcomes?.length;
  if(pilot){
    const messages={proposed:'A state that excites a missing input direction',already_excited:'The offered library already has full input rank',
      no_rank_gain:'No offered state adds an input direction',no_offered_inputs:'No unobserved offered inputs',
      work_limit:'Input-rank comparison exceeds the work limit',numerical_rescaling:'Input rank is numerically unresolved'};
    set('planner-status',messages[plan.status]);
    set('planner-metric-label','Input design rank');
    set('model-spread',`${plan.currentRank}${plan.selected?' → '+plan.selected.prospectiveRank:''} / ${plan.librarySize} feature columns`);
    const source=plan.inputSource==='explicitly_offered'?`${plan.originalOfferedCount} explicitly offered states`:
      plan.inputSource==='virtual_instrument_course'?'the virtual instrument course':'the grid within the original observed ranges';
    set('pilot-explanation',`Coordinates only, from ${source}. ${plan.previouslyObservedCount} already observed states excluded. ${plan.examinedOffers} remaining states compared. Rank gain supplies no torque forecast and does not establish a correct law.${state.options.loss==='weighted_least_squares'?' This input-only rank ignores declared torque-noise ratios; the fitted law reports weighted numerical rank.':''}${plan.status==='work_limit'?' The complete course exceeds the declared work bound; no partial ranking was used.':''}${plan.selected?.extrapolation.length?' This offered state extends the observed '+plan.selected.extrapolation.join(', ')+' range.':''}`);
    set('pilot-course-summary',`Inspect all ${plan.outcomes.length} compared states`);
    const rows=$('pilot-course-rows');rows.replaceChildren();
    for(const row of plan.outcomes){
      const tr=el('tr');if(row.index===plan.selected?.index)tr.className='pilot-selected';
      const stateText=`u ${fmt(row.input.command)} · θ ${fmt(row.input.position)} · ω ${fmt(row.input.rate)}`;
      tr.append(el('td',String(row.sourceIndex+1)),el('td',stateText),el('td',String(row.prospectiveRank)),
        el('td',row.status==='rank_gain'?'+1 direction':row.status==='no_gain'?'No gain':'Numerical rescaling'));
      rows.append(tr);
    }
  }else{
    set('planner-status',plan.status==='proposed'?'An informative next observation':plan.selected?'Current models largely agree':'No unobserved candidate inputs');
    set('planner-metric-label','Model spread');
    set('model-spread',plan.selected?`${fmt(plan.selected.disagreement)} N·m model disagreement${plan.selected.extrapolation?.length?' · extends the observed input range':''}`:'Model spread is unavailable');
  }
  set('planned-input',plan.selected?`θ ${fmt(plan.selected.input.position)} rad · ω ${fmt(plan.selected.input.rate)} rad/s · u ${fmt(plan.selected.input.command)} N·m`:'No new state is suggested under this objective.');
}
function useProposal(announce=true){if(!plan?.selected)return;const exact=!state.lab && Object.hasOwn(state.base,'offeredInputs');for(const f of ['position','rate','command'])$(f).value=exact?String(plan.selected.input[f]):Number(plan.selected.input[f].toPrecision(10));if(announce)notice('Proposed inputs are ready. Run the instrument to obtain a new observation.');}
function runSimulation(announce=true){
  studioComparison?.retire('The evidence or inspected law changed. Compare again to execute the current competitive set.');
  try{
    const execution=executeStudioDynamics(model(),{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')});
    trajectory=execution.trajectory;
    chart('trajectory-chart',[{name:`Selected model · fixed command ${fmt(numberInput('simulation-command'))} N·m`,color:'#1c7562',line:true,points:trajectory.map(r=>({x:r.time,y:r.position}))}],{xLabel:'Simulation time (s)',yLabel:'Predicted angle (rad)',width:$('trajectory-chart').clientWidth});
    let energy=$('energy-budget');if(!energy){energy=el('section');energy.id='energy-budget';$('trajectory-chart').after(energy);}
    renderEnergyBudget(energy,model(),trajectory,{inertia:numberInput('inertia'),command:numberInput('simulation-command')});
    renderConditionalRate(energy,model(),state.discovery.observations,state.base.heldOut,{trajectory,solver:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')},chart});
    const numeric=execution.diagnostics;
    const method=numeric.method==='adaptive_RK4_step_doubling'?`adaptive RK4 · ${numeric.acceptedSteps} accepted internal steps, ${numeric.rejectedSteps} refined trials · local error estimate only`:'fixed-step RK4 · discontinuous sign-rate law · no local error control';
    animationStart=performance.now();set('simulation-status',`${trajectory.length} displayed states at 20 ms intervals · ${method} · schematic joint · prediction only`);
    $('simulation-status').dataset.method=numeric.method;
    if(announce)notice('Executed the selected torque model. '+numeric.interpretation);
  }catch(error){trajectory=[];delete $('simulation-status').dataset.method;$('energy-budget')?.replaceChildren(el('p','Energy accounting unavailable because the trajectory was refused.'));set('simulation-status',`Prediction unavailable: ${error.message}`);$('trajectory-chart').replaceChildren(el('p',error.message,'empty-state'));if(announce)throw error;}
}
function draw(now){
  const canvas=$('mechanism-canvas');if(!canvas){animationHandle=requestAnimationFrame(draw);return;}
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  if(rect.width>0&&rect.height>0){
    if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
    const ctx=canvas.getContext('2d'),w=rect.width,h=rect.height;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const comparison=studioComparison?.frame(now);
    if(comparison){
      drawCompetitiveMotion(ctx,w,h,comparison);
      canvas.setAttribute('aria-label',`Synchronized numerical predictions for ${comparison.samples.length} of ${comparison.total} competitive scalar laws at ${fmt(comparison.time)} seconds. ${comparison.complete?'Complete competitive set.':'Incomplete comparison; refused laws are listed below.'}`);
      set('stage-prediction-label','Competitive-law predictions');
      animationHandle=requestAnimationFrame(draw);return;
    }
    set('stage-prediction-label','Inspected-law prediction');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=trajectory.at(-1)?.time||1;const time=reduced?0:((now-animationStart)/1000)%duration;
    const current=trajectory[Math.min(trajectory.length-1,Math.floor(time/.02))];
    if(!current){
      ctx.fillStyle='#cfdfd0';ctx.font='17px ui-sans-serif, sans-serif';ctx.textAlign='center';ctx.fillText('Prediction unavailable',w/2,h/2-8);
      ctx.fillStyle='#9fb6a6';ctx.font='12px ui-sans-serif, sans-serif';ctx.fillText('Adjust the dynamics inputs to run the model.',w/2,h/2+19);ctx.textAlign='left';
      canvas.setAttribute('aria-label','Prediction unavailable. Dynamics inputs were refused.');animationHandle=requestAnimationFrame(draw);return;
    }
    canvas.setAttribute('aria-label','Predicted angular joint schematic from the executed selected model.');const angle=current.position;
    const cx=w*.49,cy=h*.27,len=Math.min(w*.27,h*.48),x=cx+Math.sin(angle)*len,y=cy+Math.cos(angle)*len;
    ctx.strokeStyle='rgba(217,240,219,.06)';ctx.lineWidth=1;
    for(let gx=20;gx<w;gx+=30){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke();}for(let gy=20;gy<h;gy+=30){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke();}
    ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(199,230,209,.25)';ctx.beginPath();ctx.arc(cx,cy,len,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+len+20);ctx.stroke();ctx.restore();
    ctx.fillStyle='#2d443b';ctx.beginPath();ctx.roundRect(cx-54,cy-37,108,38,8);ctx.fill();
    ctx.lineCap='round';ctx.strokeStyle='#5d7869';ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
    ctx.strokeStyle='#bed5ba';ctx.lineWidth=4;ctx.stroke();
    ctx.shadowColor='rgba(203,242,123,.5)';ctx.shadowBlur=25;ctx.fillStyle='#cbf27b';ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#dce9d6';ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#122e25';ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
    ctx.font='12px ui-monospace, monospace';ctx.fillStyle='#bed1c1';ctx.fillText(`θ ${fmt(angle,3)} rad`,Math.max(14,w-146),h-48);ctx.fillText(`t ${fmt(time,3)} s`,Math.max(14,w-146),h-27);
    ctx.fillStyle='#8fa99a';ctx.fillText('PREDICTED JOINT',20,h-28);
  }
  animationHandle=requestAnimationFrame(draw);
}

studioComparison=mountStudioComparison($('studio-motion-comparison'),{
  transportHost:$('studio-comparison-transport-slot'),getState:()=>state,
  getInputs:()=>({initial:{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},settings:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')}}),
  chart,onClear:()=>runSimulation(false),
});

const savedRead=notebookStorage.readInitial();
if(savedRead.ok&&savedRead.text!==null){
  try{state=restoreNotebook(savedRead.text);restored=true;}
  catch(error){notebookStorage.protectUnreadable(savedRead.text);set('notice',`The earlier saved notebook could not be reopened: ${error.message}. The unreadable original is protected; you are seeing a separate fictional example.`);}
}else if(!savedRead.ok)set('notice','Browser storage could not be read. The fictional example does not replace existing saved data; automatic saving is paused.');
state ||= newVirtualSession();modelId=state.discovery.selected.id;render();
if(restored){notice('Reopened your local notebook and recomputed every model revision.');set('storage-status','Local notebook restored');}
else if(notebookStorage.blocked)set('storage-status',notebookStorage.readDenied?'Browser storage cannot be read · current notebook is not saved. Export it and reload after storage recovers.':'Unreadable earlier notebook protected · current notebook is not saved. Download or archive and replace the original below.');
else set('storage-status','Export a notebook to keep a portable copy');
configureNotebookRecovery();
useProposal(false);
$('use-proposal').addEventListener('click',()=>action(useProposal));
$('planner-objective').addEventListener('change',()=>action(()=>{renderPlan();notice('Planning objective changed. Original observations and fitted laws are unchanged.');}));
$('run-experiment').addEventListener('click',()=>action(()=>{
  const input=experimentInput();const next=state.lab?runVirtualExperiment(state,input):appendMeasurements(state,[{...input,jointTorque:numberInput('measured-torque'),...(state.discovery.observations[0]?.torqueNoiseRatio===undefined?{}:{torqueNoiseRatio:numberInput('measurement-noise-ratio')})}]);
  const previous=state.discovery.selected.id;adopt(next,previous===next.discovery.selected.id?'New observation added. The leading structure is unchanged.':'New evidence changed the leading model structure.',null,frequencySettings);
}));
$('refit').addEventListener('click',()=>action(()=>{
  const loss=$('reading-loss').value;
  const options={noiseSigma:numberInput('noise-sigma'),loss,...(loss==='soft_l1'?{lossScale:numberInput('loss-scale')}:{})};
  adopt(refitSession(state,options),'Refitted the original observations using the declared noise and reading loss.');
}));
for(const id of ['reading-loss','loss-scale'])$(id).addEventListener('input',()=>{
  $('loss-scale').disabled=$('reading-loss').value!=='soft_l1';
  set('loss-choice-status','Unapplied fitting choice. The displayed law and predictions still use the last applied assumptions; select Refit observations to compare.');
});
$('undo').addEventListener('click',()=>action(()=>adopt(undoSession(state),'Undid the last notebook revision and restored the previous evidence.')));
$('new-lab').addEventListener('click',()=>action(()=>{if(!confirm('Start a new virtual notebook? Export the current notebook first if you want to keep it.'))return;adopt(newVirtualSession(),'Started the virtual instrument with 64 initial observations.');useProposal();}));
$('load-observations').addEventListener('click',()=>$('observation-file').click());
$('observation-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;const read=++observationRead,current=beginSourceReplacement();
  try{if(file.size>2_000_000)throw new Error('Observation files must be smaller than 2 MB.');const text=await file.text();if(current!==generation)return;const next=createSession(parseObservationText(text,file.name));adopt(next,'Imported observations. Virtual instrument execution is disabled for this notebook.');useProposal(false);}catch(error){if(current===generation)alertError(error);}finally{if(read===observationRead)event.target.value='';}
});
$('open-session').addEventListener('click',()=>$('session-file').click());
$('session-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;const read=++sessionRead,current=beginSourceReplacement();
  try{if(file.size>MAX_SESSION_FILE_BYTES)throw new Error('Notebook files must be no larger than 6 MB; the notebook text limit also applies.');const text=await file.text();if(current!==generation)return;adopt(restoreNotebook(text),'Reopened the notebook and recomputed its complete evidence history.');useProposal(false);}catch(error){if(current===generation)alertError(error);}finally{if(read===sessionRead)event.target.value='';}
});
$('export-session').addEventListener('click',()=>action(()=>download(exportSession(state),'worldlaw-notebook.json')));
$('export-observations').addEventListener('click',()=>action(()=>download(observationsCSV(state.discovery.observations),'worldlaw-observations.csv','text/csv')));
$('run-simulation').addEventListener('click',()=>action(()=>runSimulation()));
for(const id of ['initial-angle','initial-rate','inertia','duration','simulation-command'])$(id).addEventListener('input',()=>{
  studioComparison.retire('Dynamics inputs changed. Compare again to execute every law under the new release.');
  trajectory=[];delete $('simulation-status').dataset.method;
  set('simulation-status','Dynamics inputs changed. Run dynamics or compare competitive laws to apply them.');
  $('trajectory-chart').replaceChildren();$('energy-budget')?.replaceChildren();
});
animationHandle=requestAnimationFrame(draw);
window.addEventListener('pagehide',()=>cancelAnimationFrame(animationHandle));

$('propose-features').addEventListener('click',()=>action(()=>{
  const container=$('library-proposal-comparison');container.replaceChildren();
  set('library-proposal-status','Investigation incomplete; no new proposal is available.');
  $('include-command-position').checked=Boolean(state.options.includeCommandPosition);
  for(const id of ['cubic','cosine','rate_squared'])$('include-'+id.replaceAll('_','-')).checked=Boolean(state.options.additionalTerms?.includes(id));
  const result=proposeScalarLibrary(state.discovery.observations,state.discovery.options);
  for(const [label,fit]of [['Original library',result.baseline],['Expanded library',result.expanded]]){
    container.append(el('p',`${label}: ${fit.selected.equation}; training RMSE ${fmt(fit.selected.metrics.rmse)} N·m; ${fit.diagnostics.adequacy==='residual_mismatch'?'residual mismatch under the declared noise assumption':'training residuals meet the declared noise assumption'}; ${fit.diagnostics.competitiveCount} competitive structures; ${fit.diagnostics.selectionAmbiguous?'ambiguous explanation':'one training-ranked explanation'}; ${fit.candidates.length} executable candidates.`));
  }
  const alternatives=el('details');alternatives.append(el('summary',`${result.expanded.competitive.length} competitive expanded laws`));
  for(const candidate of result.expanded.competitive)alternatives.append(el('p',`${candidate.equation}; training RMSE ${fmt(candidate.metrics.rmse)} N·m; Δ score ${fmt(candidate.metrics.score-result.expanded.selected.metrics.score)}.`));
  container.append(alternatives);
  set('library-proposal-status',result.status==='proposed'?`Training proposes comparing ${result.addedTerms.map(id=>names[id]).join(', ')}; optional terms from every competitive law remain admitted. Score improvement ${fmt(result.scoreImprovement)}. ${result.expanded.diagnostics.adequacy==='residual_mismatch'?'The expanded law still fails the declared training noise screen. ':''}Review the editable terms and apply to compare the executable predictions and existing offered experiments. This does not establish a useful independent prediction gain.`:'No clear library revision under the applied ambiguity threshold. Original options remain active.');
  if(result.proposedTerms){
    $('include-command-position').checked=result.proposedTerms.includes('command_position');
    for(const id of ['cubic','cosine','rate_squared'])$('include-'+id.replaceAll('_','-')).checked=result.proposedTerms.includes(id);
  }
}));
$('revise-features').addEventListener('click',()=>action(()=>{
  const additionalTerms=['cubic','cosine','rate_squared'].filter(id=>$('include-'+id.replaceAll('_','-')).checked);
  const options={includeCommandPosition:$('include-command-position').checked};
  if(additionalTerms.length||Object.hasOwn(state.options,'additionalTerms'))options.additionalTerms=additionalTerms;
  adopt(refitSession(state,options),'Revised the candidate feature library. Original observations and the initial fit are retained.');
}));

clockPanel=mountClockOffsets(document.querySelector('.main-column'),model);

affinePanel=mountAffineClocks(document.querySelector('.main-column'),model);



excitationPanel=mountScalarExcitation($('use-proposal').parentElement,{beginSourceReplacement,getSourceGeneration:()=>generation,getState:()=>state,saveNotebook:()=>exportSession(state),openNotebook:(text,validateOnly=false)=>{const next=restoreSession(text);if(!validateOnly)adopt(next,'Reopened input-design source notebook.');return next;},useInput:input=>{for(const field of ['command','position','rate'])$(field).value=String(input[field]);notice('Declared input copied. Obtain a new reading before recording the outcome.');$('command').focus();}});
excitationPanel.studioChanged();


