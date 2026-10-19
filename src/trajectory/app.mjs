import {createChallenge,exportChallenge,restoreChallenge} from './session.mjs';
import {parseBundleText,MAX_TEXT_LENGTH} from './data.mjs';
import {summarizePredictionHorizon} from './horizon.mjs';

const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const set=(id,text)=>{$(id).textContent=text;};
const fmt=(value,digits=4)=>!Number.isFinite(value)?'—':Math.abs(value)>0&&Math.abs(value)<.0001?value.toExponential(2):Number(value.toPrecision(digits)).toLocaleString('en-US',{maximumFractionDigits:6});
const axisFmt=value=>Math.abs(value)>=1000||(Math.abs(value)>0&&Math.abs(value)<.001)?value.toExponential(1):fmt(value,3);
const termNames={command:'Actuation',rate:'Linear rate',coulomb:'Rate sign',spring:'Linear position',gravity:'Sinusoidal position',quadratic:'Quadratic rate',bias:'Constant torque'};
const storageKey='worldlaw.trajectory-challenge.v1';
const exampleURLs={pendulum:'/examples/trajectory-pendulum-92be.json',ambiguous:'/examples/trajectory-ambiguous-92be.json'};
let state,selectedRunId,generation=0,busy=false,rows=[],playing=false,playStarted=0,playFrom=0,animationHandle=0,viewIndex=0,chartX=null,positionTolerance=.05,horizon=null;

function resolutionReason(resolution){return {combined_step_budget:'The shared solver budget could not accommodate the finer run.',half_step_not_representable:'A smaller step cannot be represented at this numerical precision.',refinement_execution_refused:'The finer run exceeded numerical execution limits.'}[resolution?.reason]||errorMessage(resolution?.reason||'The refined prediction could not be completed.');}
function errorMessage(error){return error?.message||String(error);}
function alertError(error){set('error',errorMessage(error));$('error').hidden=false;$('error').focus();}
function notice(text){set('notice',text);$('error').hidden=true;}
function setBusy(value){busy=value;$('challenge-workspace').setAttribute('aria-busy',String(value));for(const id of ['refit','export-notebook','challenge-run'])$(id).disabled=value||!state;$('refit').textContent=value?'Running the challenge…':'Fit & challenge →';}
function save(){
  if(!state)return;
  try{localStorage.setItem(storageKey,exportChallenge(state));set('storage-status','Notebook saved in this browser. Export for a portable copy.');}
  catch{set('storage-status','Browser storage is unavailable or full. Save notebook to keep a portable copy.');}
}
function updateMethodDescription(){
  const method=document.querySelector('input[name="method"]:checked').value;
  set('noise-unit',method==='integral'?'rad':'N·m');
  set('method-explanation',method==='integral'?'Fits accumulated motion without taking a second derivative of the angle.':'Estimates angular acceleration first, then fits a torque law to those derived observations.');
}
function settings(){const raw=$('noise-sigma').value.trim(),noiseSigma=Number(raw);if(!raw||!Number.isFinite(noiseSigma)||noiseSigma<=0)throw new Error('Enter an assumed residual noise greater than zero.');return {...state?.options,method:document.querySelector('input[name="method"]:checked').value,noiseSigma};}
async function perform(getNext,message,{persist=true}={}){
  const ticket=++generation;setBusy(true);
  try{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const next=await getNext();if(ticket!==generation)return;
    if(!next?.bundle?.challengeRuns?.length||!next?.discovery?.candidates?.length)throw new Error('This notebook does not contain a complete trajectory challenge.');
    state=next;positionTolerance=state.positionTolerance??.05;state.positionTolerance=positionTolerance;$('position-tolerance').value=String(positionTolerance);selectedRunId=state.selectedRunId||state.bundle.challengeRuns[0].id;
    if(!state.bundle.challengeRuns.some(run=>run.id===selectedRunId))selectedRunId=state.bundle.challengeRuns[0].id;
    state.selectedRunId=selectedRunId;
    document.querySelector(`input[name="method"][value="${state.options.method}"]`).checked=true;
    $('noise-sigma').value=state.options.noiseSigma;updateMethodDescription();render();
    if(persist)save();notice(message);
  }catch(error){if(ticket===generation){alertError(error);if(!state)set('notice','No challenge is loaded. Import paired runs or load the synthetic example.');}}
  finally{if(ticket===generation){setBusy(false);}}
}
async function exampleBundle(choice){
  const path=exampleURLs[choice],key=path.slice(path.lastIndexOf('/')+1),embedded=globalThis.WORLDLAW_EMBEDDED_EXAMPLES;
  if(embedded&&typeof embedded==='object'&&Object.hasOwn(embedded,key))return embedded[key];
  const response=await fetch(path);if(!response.ok)throw new Error('The example runs could not be loaded. Import a paired-run bundle to continue.');return response.json();
}
async function loadExample({persist=true}={}){const choice=$('example-choice').value;await perform(async()=>createChallenge(await exampleBundle(choice),{method:'integral',noiseSigma:.01,maxTerms:4,maxStep:.01}),'Synthetic paired runs loaded. The law was learned from training motion and challenged on a separate run.',{persist});}
function currentModel(){return state.discovery.candidates.find(m=>m.id===state.selectedModelId)||state.discovery.selected;}
function currentRun(){return state.bundle.challengeRuns.find(r=>r.id===selectedRunId)||state.bundle.challengeRuns[0];}
function currentResult(){return state.results.find(result=>result.modelId===currentModel().id&&(result.runId||result.rollout?.runId)===currentRun().id);}
function modelName(model){return model.terms?.length?model.terms.map(term=>termNames[term.id]||term.id).join(' + '):'Zero torque';}
function sourceLabel(run){return run.source?.label||run.label||run.id;}
function render(){
  const b=state.bundle,all=[...b.trainingRuns,...b.challengeRuns],synthetic=all.every(run=>run.kind==='synthetic');
  set('source-name',b.label||'Paired trajectory evidence');set('source-kind',synthetic?'SYNTHETIC PAIRED RUNS':all.every(run=>run.kind==='measured')?'IMPORTED MEASURED RUNS':'IMPORTED PAIRED RUNS');
  set('source-description',synthetic?'Separate simulated recordings with different initial conditions. A controlled test of predictive transfer.':'User-supplied angular recordings. Fit and challenge runs remain separate throughout discovery.');
  set('training-count',String(b.trainingRuns.reduce((n,run)=>n+run.samples.length,0)));set('challenge-count',String(b.challengeRuns.reduce((n,run)=>n+run.samples.length,0)));
  set('training-run-count',`${b.trainingRuns.length} fit ${b.trainingRuns.length===1?'run':'runs'} · samples`);set('challenge-run-count',`${b.challengeRuns.length} test ${b.challengeRuns.length===1?'run':'runs'} · samples`);
  const runList=$('run-list');runList.replaceChildren();
  for(const [role,runs]of [['Fit',b.trainingRuns],['Challenge',b.challengeRuns]])for(const run of runs){const li=el('li');li.append(el('strong',`${role} · ${run.label||run.id}`),el('small',`${run.samples.length} samples · ${fmt(run.samples.at(-1).time-run.samples[0].time,3)} s · ${run.kind||'unknown origin'}`),el('small',`Inertia ${fmt(run.inertia)} kg·m² · initial rate ${fmt(run.initialRate)} rad/s`),el('small',sourceLabel(run)));runList.append(li);}
  const select=$('challenge-run');select.replaceChildren();for(const run of b.challengeRuns){const option=el('option',run.label||run.id);option.value=run.id;select.append(option);}select.value=selectedRunId;
  renderModel();
}
function renderModel(){
  stopPlayback();const model=currentModel(),result=currentResult(),run=currentRun();
  rows=result?.status==='ok'&&Array.isArray(result.rollout?.rows)?result.rollout.rows:[];viewIndex=0;
  const m=result?.rollout?.metrics||{};set('position-rmse',fmt(m.positionRMSE));set('maximum-error',fmt(m.maxAbsError));set('final-error',fmt(m.finalAbsError));
  const resolution=result?.resolution,compared=resolution?.status==='compared';$('resolution-metric').hidden=!resolution;$('resolution-note').hidden=!resolution;$('challenge-metrics').classList.toggle('with-resolution',Boolean(resolution));
  set('step-sensitivity',compared?fmt(resolution.positionRMSEDifference):'Unavailable');$('step-sensitivity').dataset.unavailable=String(!compared);set('step-sensitivity-unit',compared?'rad · RMS prediction difference':'refinement unavailable');
  set('resolution-note',compared?`Step sensitivity compares ${fmt(resolution.coarseMaxStep)} s and ${fmt(resolution.refinedMaxStep)} s solver steps. It is not a bound on numerical error.`:resolution?`Numerical step comparison unavailable: ${resolutionReason(resolution)}`:'');
  set('run-kind',run.kind==='synthetic'?'SYNTHETIC CHALLENGE':'SEPARATE RECORDED RUN');
  set('rollout-summary',rows.length?`${rows.length} states · inertia ${fmt(run.inertia)} kg·m² · recorded command · no observation resets`:result?.error?`Prediction could not complete: ${errorMessage(result.error)}`:'No forward prediction is available for this model.');
  set('selected-equation',(model.equation||'Torque model').replaceAll(' + -',' − ').replace(' = -',' = −'));
  set('selected-terms',model.terms?.length?model.terms.map(term=>`${termNames[term.id]||term.id} ${fmt(term.coefficient)}`).join(' · '):'Zero torque across the declared state space.');
  set('method-badge',state.options.method==='integral'?'INTEGRAL FIT':'DERIVATIVE FIT');
  const d=state.discovery.diagnostics||{},trainedLeader=model.id===state.discovery.selected.id;
  let diagnostic=trainedLeader?'Leading structure from the training runs.':'An alternative structure, ranked using the training runs.';
  if(d.selectionAmbiguous)diagnostic+=' The training evidence does not isolate a unique explanation.';
  if(d.adequacy==='residual_mismatch')diagnostic+=' Residual mismatch exceeds the assumed fit noise.';
  if(d.identifiability==='insufficient_excitation')diagnostic+=' More varied training motion is needed to separate some terms.';
  diagnostic+=' Challenge error is shown independently and never changes this ranking.';set('model-diagnostics',diagnostic);
  updateHorizon();renderModels();renderCharts();renderTable();
  $('playback-time').max=String(Math.max(0,rows.length-1));$('playback-time').value='0';$('playback-time').disabled=!rows.length;$('play-pause').disabled=!rows.length;setSample(0);
}
function updateHorizon(){
  const rollout=currentResult()?.rollout;horizon=rollout&&rows.length?summarizePredictionHorizon(rollout,{positionTolerance}):null;
  $('position-tolerance').disabled=!horizon;$('apply-tolerance').disabled=!horizon;
  set('horizon-heading',!horizon?'No complete prediction to check':horizon.firstExceeded?`First sampled breach at ${fmt(horizon.firstExceeded.elapsed,3)} s`:`Within tolerance at all ${horizon.count} checked samples`);
  set('horizon-detail',horizon?`${horizon.withinCount} / ${horizon.count} samples within ${fmt(positionTolerance,3)} rad. This checks sample times only.`:'Select a model with a completed prediction to inspect its deviations.');
}
function renderModels(){
  const container=$('model-list');container.replaceChildren();
  const available=state.discovery.candidates.filter(model=>state.results.some(result=>result.modelId===model.id));
  set('candidate-count',`${available.length} tested / ${state.discovery.candidates.length} ranked`);
  const baseScore=state.discovery.selected?.metrics?.score;
  for(const model of available){
    const rank=state.discovery.candidates.findIndex(m=>m.id===model.id)+1,result=state.results.find(r=>r.modelId===model.id&&(r.runId||r.rollout?.runId)===selectedRunId);
    const button=el('button',undefined,'model-card');button.type='button';button.setAttribute('aria-pressed',String(model.id===currentModel().id));button.dataset.modelId=model.id;
    const content=el('span');content.append(el('span',modelName(model),'model-name'));
    const delta=model.metrics?.score-baseScore;const score=Number.isFinite(delta)?`Δ fit score ${fmt(delta,3)}`:`${model.terms?.length||0} terms`;
    content.append(el('span',`${score} · challenge ${result?.status==='ok'?`${fmt(result.rollout.metrics.positionRMSE,3)} rad RMSE`:'prediction failed'}`,'model-meta'));
    button.append(el('span',String(rank).padStart(2,'0'),'model-rank'),content);
    button.addEventListener('click',()=>{if(busy)return;state.selectedModelId=model.id;renderModel();save();notice(`Inspecting ${modelName(model)}. The training ranking and recorded evidence are unchanged.`);});container.append(button);
  }
}
function svgElement(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;}
function chart(containerId,series,{dark=false,residual=false}={}){
  const container=$(containerId);container.replaceChildren();
  if(!rows.length){const result=currentResult();container.append(el('p',`Prediction unavailable. ${result?.error?errorMessage(result.error):'Select another model to inspect its motion.'}`,'chart-empty'));return;}
  const W=Math.max(270,Math.round(container.clientWidth)-(dark?16:0)),H=dark?(W>650?300:W>430?270:235):(W>400?205:190),L=W<350?45:53,R=15,T=18,B=40;
  const x0=rows[0].time,x1=rows.at(-1).time;let y0=residual?0:Infinity,y1=residual?0:-Infinity;
  for(const s of series)for(const row of rows){const y=row[s.key];if(Number.isFinite(y)){y0=Math.min(y0,y);y1=Math.max(y1,y);}}
  if(!Number.isFinite(y0)||!Number.isFinite(y1)){container.append(el('p','Finite trajectory values are unavailable.','chart-empty'));return;}
  const pad=Math.max((y1-y0)*.16,residual?.00001:.05);y0-=pad;y1+=pad;
  const X=x=>L+(x-x0)/Math.max(x1-x0,1e-12)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-T-B);
  const svg=svgElement('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':residual?`Observed minus predicted angle for ${currentRun().label}, across ${rows.length} challenge samples.`:`Observed and model-predicted angle for ${currentRun().label}, across ${rows.length} challenge samples. Position RMSE ${fmt(currentResult()?.rollout?.metrics?.positionRMSE)} radians.`});
  svg.append(svgElement('title',{},residual?'Challenge angle residual over time':'Observed and predicted challenge trajectory'));
  const grid=dark?'#547046':'#d9e1cd',ink=dark?'#b7c8a7':'#768769';
  for(let i=0;i<=4;i++){const x=x0+(x1-x0)*i/4,y=y0+(y1-y0)*i/4;
    svg.append(svgElement('line',{x1:X(x),x2:X(x),y1:T,y2:H-B,stroke:grid,'stroke-width':.7,'stroke-dasharray':'2 5',opacity:dark?.65:1}),svgElement('line',{x1:L,x2:W-R,y1:Y(y),y2:Y(y),stroke:grid,'stroke-width':.7,'stroke-dasharray':'2 5',opacity:dark?.65:1}),svgElement('text',{x:X(x),y:H-B+19,'text-anchor':'middle',fill:ink,'font-size':9},axisFmt(x-x0)),svgElement('text',{x:L-8,y:Y(y)+3,'text-anchor':'end',fill:ink,'font-size':9},axisFmt(y)));
  }
  if(y0<0&&y1>0)svg.append(svgElement('line',{x1:L,x2:W-R,y1:Y(0),y2:Y(0),stroke:dark?'#7c9663':'#a7b791','stroke-width':1}));
  if(residual&&horizon){for(const bound of [-positionTolerance,positionTolerance])if(bound>y0&&bound<y1)svg.append(svgElement('line',{x1:L,x2:W-R,y1:Y(bound),y2:Y(bound),stroke:'#b99a6a','stroke-width':.9,'stroke-dasharray':'4 5','data-tolerance-line':'true'}));if(horizon.firstExceeded){const hx=X(horizon.firstExceeded.time);svg.append(svgElement('line',{x1:hx,x2:hx,y1:T,y2:H-B,stroke:'#ac794f','stroke-width':1.2,'stroke-dasharray':'4 4','data-horizon-marker':'true'}),svgElement('text',{x:Math.max(L+3,Math.min(W-R-78,hx+5)),y:T+9,fill:'#977247','font-size':8},'first breach'));}}
  const stride=Math.max(1,Math.floor(rows.length/1600)),plotted=rows.filter((_,i)=>i%stride===0||i===rows.length-1);
  if(residual){const points=[`${X(x0)},${Y(0)}`,...plotted.map(row=>`${X(row.time)},${Y(row.residual)}`),`${X(x1)},${Y(0)}`].join(' ');svg.append(svgElement('polygon',{points,fill:'#aebf88',opacity:.22}));}
  for(const s of series){svg.append(svgElement('polyline',{points:plotted.map(row=>`${X(row.time).toFixed(2)},${Y(row[s.key]).toFixed(2)}`).join(' '),fill:'none',stroke:s.color,'stroke-width':s.key==='observed'?2.6:2,'stroke-dasharray':s.dash||'none','stroke-linejoin':'round','stroke-linecap':'round','data-series':s.key}));}
  const cursor=svgElement('line',{x1:X(rows[viewIndex]?.time||x0),x2:X(rows[viewIndex]?.time||x0),y1:T,y2:H-B,stroke:dark?'#f2f6e6':'#839965','stroke-width':1,'stroke-dasharray':'3 3',opacity:.6,'data-cursor':containerId});svg.append(cursor);
  svg.append(svgElement('text',{x:L,y:10,fill:ink,'font-size':8},residual?'Δ angle / rad':'angle / rad'),svgElement('text',{x:W-R,y:H-4,'text-anchor':'end',fill:ink,'font-size':8},'elapsed time / s'));
  container.append(svg);if(dark)chartX=X;else container._mapX=X;
}
function renderCharts(){
  if(!state)return;
  chart('trajectory-chart',[{key:'observed',color:'#e2ecdf'},{key:'predicted',color:'#d4ed87',dash:'7 5'}],{dark:true});
  chart('residual-chart',[{key:'residual',color:'#708e42'}],{residual:true});setSample(viewIndex);
}
function renderTable(){
  const table=$('sample-table');table.replaceChildren();const indices=new Set();const max=31;for(let i=0;i<Math.min(max,rows.length);i++)indices.add(Math.round(i*(rows.length-1)/Math.max(1,Math.min(max,rows.length)-1)));
  for(const i of indices){const row=rows[i],tr=el('tr');for(const key of ['time','observed','predicted','residual'])tr.append(el('td',fmt(row[key],5)));table.append(tr);}
  set('table-caption',rows.length?`${indices.size} evenly spaced samples of ${rows.length}. The saved notebook includes the complete source runs.`:'No trajectory values are available for this model.');
}
function setSample(index){
  viewIndex=Math.max(0,Math.min(rows.length-1,Math.round(index)));const row=rows[viewIndex];
  for(const [id,key]of [['sample-observed','observed'],['sample-predicted','predicted'],['sample-residual','residual']])set(id,fmt(row?.[key],4));
  const elapsed=row?row.time-rows[0].time:0;set('sample-time',row?fmt(elapsed,4):'—');
  set('playback-clock',`${elapsed.toFixed(2)} s`);$('playback-time').value=String(Math.max(0,viewIndex));
  for(const kind of ['observed','predicted']){const angle=row?.[kind]||0,x=140+110*Math.sin(angle),y=48+110*Math.cos(angle);$(`${kind}-arm`).setAttribute('x2',String(x));$(`${kind}-arm`).setAttribute('y2',String(y));$(`${kind}-bob`).setAttribute('cx',String(x));$(`${kind}-bob`).setAttribute('cy',String(y));}
  $('motion-view').setAttribute('aria-label',row?`At ${fmt(elapsed)} elapsed seconds, observed angle ${fmt(row.observed)} radians and predicted angle ${fmt(row.predicted)} radians. Schematic only.`:'Motion comparison unavailable.');
  for(const [id,map]of [['trajectory-chart',chartX],['residual-chart',$('residual-chart')._mapX]]){const cursor=$(id).querySelector('[data-cursor]');if(cursor&&row&&map){cursor.setAttribute('x1',map(row.time));cursor.setAttribute('x2',map(row.time));}}
}
function stopPlayback(){playing=false;cancelAnimationFrame(animationHandle);$('play-pause').textContent='▶';$('play-pause').setAttribute('aria-label','Play motion comparison');}
function tick(now){
  if(!playing||!rows.length)return;const elapsed=(now-playStarted)/1000+playFrom;
  if(elapsed>=rows.at(-1).time-rows[0].time){setSample(rows.length-1);stopPlayback();return;}
  let low=0,high=rows.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(rows[mid].time-rows[0].time<elapsed)low=mid+1;else high=mid;}setSample(low);animationHandle=requestAnimationFrame(tick);
}
function download(){const blob=new Blob([exportChallenge(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='worldlaw-trajectory-notebook.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);notice('Portable notebook exported with the source runs, fitting settings and current selection.');}
async function readInput(event,kind){const file=event.target.files?.[0];if(!file)return;await perform(async()=>{if(file.size>MAX_TEXT_LENGTH)throw new Error('Choose a JSON file smaller than 3 MB.');const text=await file.text();return kind==='notebook'?restoreChallenge(text):createChallenge(parseBundleText(text),{method:'integral',noiseSigma:.01,maxTerms:4,maxStep:.01});},kind==='notebook'?'Notebook reopened. Models and challenge trajectories were recomputed from its recorded evidence.':'Paired runs imported. Training and challenge evidence remain separate.');event.target.value='';}

$('import-bundle').addEventListener('click',()=>$('bundle-file').click());$('open-notebook').addEventListener('click',()=>$('notebook-file').click());$('bundle-file').addEventListener('change',event=>readInput(event,'bundle'));$('notebook-file').addEventListener('change',event=>readInput(event,'notebook'));
$('example-choice').addEventListener('change',()=>set('example-description',$('example-choice').value==='ambiguous'?'Fit gentle motion, then challenge the law with a wide-angle release.':'Learn from driven motion, then test two separate releases.'));
$('load-example').addEventListener('click',()=>loadExample());$('export-notebook').addEventListener('click',()=>{try{download();}catch(error){alertError(error);}});
$('refit').addEventListener('click',()=>perform(()=>{const next=createChallenge(state.bundle,settings());next.positionTolerance=positionTolerance;return next;},'Refitted the training runs and recomputed free forward predictions on the separate challenge runs.'));
for(const radio of document.querySelectorAll('input[name="method"]'))radio.addEventListener('change',()=>{$('noise-sigma').value='.01';updateMethodDescription();notice('Method ready. Fit & challenge will apply it to the training runs and refresh the predictions.');});
$('challenge-run').addEventListener('change',()=>{selectedRunId=$('challenge-run').value;state.selectedRunId=selectedRunId;renderModel();save();notice('Viewing another challenge run. The learned models and training ranking are unchanged.');});
$('apply-tolerance').addEventListener('click',()=>{try{const raw=$('position-tolerance').value.trim(),value=Number(raw);if(!raw||!Number.isFinite(value)||value<=0||value>1e6)throw new Error('Enter an angle tolerance greater than zero and at most 1000000 radians.');const next=summarizePredictionHorizon(currentResult().rollout,{positionTolerance:value});positionTolerance=value;horizon=next;state.positionTolerance=value;updateHorizon();renderCharts();save();notice('Updated the sampled deviation check. The learned laws and forward predictions are unchanged.');}catch(error){alertError(error);}});
$('position-tolerance').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('apply-tolerance').click();}});
$('playback-time').addEventListener('input',()=>{stopPlayback();setSample(Number($('playback-time').value));});
$('play-pause').addEventListener('click',()=>{if(playing){stopPlayback();return;}if(!rows.length)return;if(viewIndex>=rows.length-1)viewIndex=0;playing=true;playFrom=rows[viewIndex].time-rows[0].time;playStarted=performance.now();$('play-pause').textContent='Ⅱ';$('play-pause').setAttribute('aria-label','Pause motion comparison');animationHandle=requestAnimationFrame(tick);});
let resizeFrame;const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(state)renderCharts();});});observer.observe($('trajectory-chart'));observer.observe($('residual-chart'));
window.addEventListener('pagehide',stopPlayback);
async function start(){
  let saved,storageError;try{saved=localStorage.getItem(storageKey);}catch{storageError='Browser storage is unavailable. Save notebook to keep a portable copy.';}
  if(saved){await perform(()=>restoreChallenge(saved),'Reopened the local notebook and recomputed the challenge from its source runs.',{persist:false});if(state){set('storage-status','Local notebook restored. Save notebook for a portable copy.');return;}set('storage-status','Stored notebook could not be reopened. Its saved bytes were left intact.');return;}
  await loadExample({persist:false});if(storageError)set('storage-status',storageError);
}
start();
