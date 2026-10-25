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
import {evaluate,predict,simulate} from './science/torque-discovery.mjs';
import {softL1Weight} from './science/robust-fit.mjs';
import {parseObservationText,observationsCSV} from './data.mjs';
import {createSession,newVirtualSession,appendMeasurements,runVirtualExperiment,refitSession,sessionPlan,exportSession,restoreSession,undoSession} from './session.mjs';

const $=id=>document.getElementById(id);
const storageKey='worldlaw.notebook.v1';
const names={command:'Actuation',rate:'Viscous damping',coulomb:'Coulomb friction',spring:'Linear spring',gravity:'Sinusoidal gravity',quadratic:'Quadratic drag',bias:'Bias',cubic:'Cubic position',command_position:'Command × position'};
const fmt=(value,digits=4)=>value===null||!Number.isFinite(value)?'—':Math.abs(value)>0&&Math.abs(value)<0.0001?value.toExponential(2):Number(value.toPrecision(digits)).toLocaleString('en-US',{maximumFractionDigits:6});
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const set=(id,text)=>{$(id).textContent=text;};
let clockPanel=null,affinePanel=null,deadzoneWidths=null;
let state,modelId,plan,trajectory=[],animationStart=0,animationHandle,restored=false,generation=0;
function alertError(error) { $('error').hidden=false;set('error',error.message||String(error));$('error').focus(); }
function notice(text) {set('notice',text);$('error').hidden=true;}
function action(fn) {try{fn();}catch(error){alertError(error);}}
function save() {
  try{localStorage.setItem(storageKey,exportSession(state));set('storage-status','Notebook saved on this browser');}
  catch{set('storage-status','Browser storage unavailable · export to keep this notebook');}
}
function adopt(next,message,widths=null) {generation++;state=next;deadzoneWidths=widths;modelId=state.discovery.selected.id;render();save();notice(message);}
function model(){return state.discovery.candidates.find(m=>m.id===modelId)||state.discovery.selected;}
function numberInput(id){const v=$(id).value.trim();if(!v||!Number.isFinite(Number(v)))throw new Error(`Enter a finite value for ${$(id).labels?.[0]?.textContent||id}.`);return Number(v);}
function experimentInput(){return Object.fromEntries(['command','position','rate'].map(f=>[f,numberInput(f)]));}
function download(text,filename,type='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function chart(container,series,{xLabel,yLabel,diagonal=false,width=580}={}) {
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
    shape('text',{x:L-9,y:Y(y)+4,'text-anchor':'end',fill:'#53655f','font-size':11},fmt(y,3));
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
  if(m.fitting?.loss==='soft_l1'){
    const scale=m.fitting.scale;
    lossResult.append(el('p',`Soft-L1 fit at ${fmt(scale)} N·m scale. ${m.metrics.robust.halfWeightCount} of ${train.count} readings have loss weight below 0.5. Training error above still includes every raw residual. This does not identify faulty readings.`));
    const details=el('details'),summary=el('summary','Inspect every original reading and its loss influence');details.append(summary);
    const scroll=el('div',undefined,'prediction-sensitivity-scroll reading-influence-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Original torque readings and soft-L1 loss influence');
    const table=el('table'),head=el('thead'),heading=el('tr');
    for(const title of ['Source row','Command N·m','Angle rad','Rate rad/s','Observed N·m','Residual N·m','Loss weight']){const th=el('th',title);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
    const body=el('tbody');train.rows.forEach((row,index)=>{const tr=el('tr');tr.dataset.sourceRow=String(index);for(const value of [String(index+1),fmt(row.command),fmt(row.position),fmt(row.rate),fmt(row.jointTorque),fmt(row.residual),fmt(softL1Weight(row.residual,scale))])tr.append(el('td',value));body.append(tr);});table.append(body);scroll.append(table);details.append(scroll,el('p','Weights describe this chosen loss, not reading reliability or probabilities. Coordinate leverage, coherent missing physics and many conflicting readings can still mislead the fit.'));lossResult.append(details);
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
  let sensitivity=$('parameter-sensitivity');if(!sensitivity){sensitivity=el('div');sensitivity.id='parameter-sensitivity';support.after(sensitivity);}
  renderParameterSensitivity(sensitivity,m,state.discovery.observations);
  let readout=$('prediction-sensitivity');if(!readout){readout=el('div');readout.id='prediction-sensitivity';sensitivity.after(readout);}
  renderPredictionSensitivity(readout,m,state.discovery.observations,state.base.heldOut);
  if(m.fitting?.loss==='soft_l1')for(const host of [support,sensitivity,readout])host.prepend(el('p','Least-squares comparison: this diagnostic refits the inspected structure using ordinary least squares. Any refit shift includes that change of loss; these are not sensitivities of the soft-L1 estimator.','loss-diagnostic-note'));
  let enclosure=$('input-enclosures');if(!enclosure){enclosure=el('div');enclosure.id='input-enclosures';$('state-support').after(enclosure);}
  renderInputEnclosures(enclosure,m,state.discovery.observations);
  let separability=$('separability');if(!separability){separability=el('div');separability.id='separability';$('replicate-diagnostics').after(separability);}
  renderSeparability(separability,state.discovery.observations,state.base.source);
  let deadzone=$('command-deadzone-container');if(!deadzone){deadzone=el('div');deadzone.id='command-deadzone-container';$('residual-chart').after(deadzone);}
  if(!$('sensor-response-container')){const response=el('div');response.id='sensor-response-container';deadzone.after(response);mountSensorResponse(response,{chart});}
  renderCommandDeadzone(deadzone,state,{chart,widths:deadzoneWidths,onReopen:(next,widths)=>adopt(next,'Reopened original command-map comparison inputs. Compare again to recompute.',widths),simulationInputs:()=>({initial:{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},settings:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')}})});
  runSimulation(false);
}
function render(){
  const d=state.discovery;set('source-name',state.base.source.label);set('source-kind',state.lab?'Virtual instrument · synthetic evidence':'Imported observations · user-supplied evidence');
  set('sample-count',String(d.observations.length));set('heldout-count',String(state.base.heldOut.length));set('candidate-count',String(d.candidates.length));
  $('undo').disabled=state.events.length===0;$('measured-field').hidden=Boolean(state.lab);$('run-experiment').textContent=state.lab?'Run virtual experiment':'Record measured outcome';
  set('experiment-mode',state.lab?'Execute the virtual torque instrument at these inputs.':'Use your instrument, then enter its measured net torque. No hardware is controlled.');
  $('noise-sigma').value=state.options.noiseSigma;
  $('reading-loss').value=state.options.loss??'least_squares';
  $('loss-scale').value=state.options.lossScale??0.03;
  $('loss-scale').disabled=state.options.loss!=='soft_l1';
  set('loss-choice-status',state.options.loss==='soft_l1'?`Applied soft-L1 scale ${fmt(state.options.lossScale)} N·m. Loss and scale revisions remain in the notebook.`:'Applied least squares. Choose a loss and refit to compare a different assumption.');
  $('include-command-position').checked=Boolean(state.options.includeCommandPosition);
  set('feature-library-status',state.options.includeCommandPosition?'uθ is admitted, not assumed true. Selection uses fit rows only; held-out rows remain separate. A versioned notebook preserves the complete library and fitting history.':'Additive library active. A revision retains the initial fit and evidence in notebook history.');
  const diag=d.diagnostics;
  set('diagnostics',`${diag.competitiveCount} competitive ${diag.competitiveCount===1?'structure':'structures'} at the current noise assumption. ${diag.adequacy==='residual_mismatch'?'Residual mismatch: this library does not explain the data within the assumed noise.':diag.selectionAmbiguous?'The current observations do not isolate a unique explanation.':'One structure ranks ahead within this finite library.'}${diag.identifiability==='insufficient_excitation'?' Some inputs are not independently excited; more varied observations are needed.':''}`);
  plan=sessionPlan(state);$('use-proposal').disabled=!plan.selected;
  set('planner-status',plan.status==='proposed'?'An informative next observation':plan.selected?'Current models largely agree':'No unobserved candidate inputs');
  set('planned-input',plan.selected?`θ ${fmt(plan.selected.input.position)} rad · ω ${fmt(plan.selected.input.rate)} rad/s · u ${fmt(plan.selected.input.command)} N·m`:'Change input conditions or import more varied observations.');
  set('model-spread',plan.selected?`${fmt(plan.selected.disagreement)} N·m model disagreement${plan.selected.extrapolation?.length?' · extends the observed input range':''}`:'Model spread is unavailable');
  const history=$('history-list');history.replaceChildren();
  state.history.forEach((entry,i)=>{const li=el('li');li.append(el('span',String(i+1).padStart(2,'0'),'history-index'),el('strong',entry.label),el('span',`${entry.count} rows · ${entry.modelId} · held-out ${fmt(entry.heldOutRMSE)} N·m`,'history-detail'));history.append(li);});
  renderHypotheses();renderModel();
}
function useProposal(announce=true){if(!plan?.selected)return;for(const f of ['position','rate','command'])$(f).value=Number(plan.selected.input[f].toPrecision(10));if(announce)notice('Proposed inputs are ready. Run the instrument to obtain a new observation.');}
function runSimulation(announce=true){
  try{
    trajectory=simulate(model(),{position:numberInput('initial-angle'),rate:numberInput('initial-rate')},{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')});
    chart('trajectory-chart',[{name:`Selected model · fixed command ${fmt(numberInput('simulation-command'))} N·m`,color:'#1c7562',line:true,points:trajectory.map(r=>({x:r.time,y:r.position}))}],{xLabel:'Simulation time (s)',yLabel:'Predicted angle (rad)'});
    let energy=$('energy-budget');if(!energy){energy=el('section');energy.id='energy-budget';$('trajectory-chart').after(energy);}
    renderEnergyBudget(energy,model(),trajectory,{inertia:numberInput('inertia'),command:numberInput('simulation-command')});
    renderConditionalRate(energy,model(),state.discovery.observations,state.base.heldOut,{trajectory,solver:{duration:numberInput('duration'),dt:.02,inertia:numberInput('inertia'),command:numberInput('simulation-command')},chart});
    animationStart=performance.now();set('simulation-status',`${trajectory.length} RK4 states · schematic joint · prediction only`);
    if(announce)notice('Executed the selected torque model through the RK4 dynamics solver.');
  }catch(error){trajectory=[];$('energy-budget')?.replaceChildren(el('p','Energy accounting unavailable because the trajectory was refused.'));set('simulation-status',`Prediction unavailable: ${error.message}`);$('trajectory-chart').replaceChildren(el('p',error.message,'empty-state'));if(announce)throw error;}
}
function draw(now){
  const canvas=$('mechanism-canvas');if(!canvas){animationHandle=requestAnimationFrame(draw);return;}
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  if(rect.width>0&&rect.height>0){
    if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
    const ctx=canvas.getContext('2d'),w=rect.width,h=rect.height;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
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

try{const saved=localStorage.getItem(storageKey);if(saved){state=restoreSession(saved);restored=true;}}catch(error){set('notice',`The stored notebook could not be reopened: ${error.message}. Its stored bytes were left intact.`);}
state ||= newVirtualSession();modelId=state.discovery.selected.id;render();
if(restored){notice('Reopened your local notebook and recomputed every model revision.');set('storage-status','Local notebook restored');}
else set('storage-status','Export a notebook to keep a portable copy');
useProposal(false);
$('use-proposal').addEventListener('click',()=>action(useProposal));
$('run-experiment').addEventListener('click',()=>action(()=>{
  const input=experimentInput();const next=state.lab?runVirtualExperiment(state,input):appendMeasurements(state,[{...input,jointTorque:numberInput('measured-torque')}]);
  const previous=state.discovery.selected.id;adopt(next,previous===next.discovery.selected.id?'New observation added. The leading structure is unchanged.':'New evidence changed the leading model structure.');
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
  const file=event.target.files?.[0];if(!file)return;const current=++generation;
  try{if(file.size>2_000_000)throw new Error('Observation files must be smaller than 2 MB.');const text=await file.text();if(current!==generation)return;const next=createSession(parseObservationText(text,file.name));adopt(next,'Imported observations. Virtual instrument execution is disabled for this notebook.');useProposal(false);}catch(error){if(current===generation)alertError(error);}finally{event.target.value='';}
});
$('open-session').addEventListener('click',()=>$('session-file').click());
$('session-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;const current=++generation;
  try{if(file.size>2_000_000)throw new Error('Notebook files must be smaller than 2 MB.');const text=await file.text();if(current!==generation)return;adopt(restoreSession(text),'Reopened the notebook and recomputed its complete evidence history.');useProposal(false);}catch(error){if(current===generation)alertError(error);}finally{event.target.value='';}
});
$('export-session').addEventListener('click',()=>action(()=>download(exportSession(state),'worldlaw-notebook.json')));
$('export-observations').addEventListener('click',()=>action(()=>download(observationsCSV(state.discovery.observations),'worldlaw-observations.csv','text/csv')));
$('run-simulation').addEventListener('click',()=>action(()=>runSimulation()));
animationHandle=requestAnimationFrame(draw);
window.addEventListener('pagehide',()=>cancelAnimationFrame(animationHandle));

$('revise-features').addEventListener('click',()=>action(()=>adopt(refitSession(state,{includeCommandPosition:$('include-command-position').checked}),'Revised the candidate feature library. Original observations and the initial fit are retained.')));

clockPanel=mountClockOffsets(document.querySelector('.main-column'),model);

affinePanel=mountAffineClocks(document.querySelector('.main-column'),model);


