import {COUPLED_DEMO_SOURCE_SHA256} from './instrument.mjs';
import {createNotebookStorage} from '../notebook-recovery.mjs';
import {escapeHTML as html,approximate,displayNumber,plannedTicks,certified,
  illustrateModels,witnessProjection,drawApparatus,drawProjection} from './view.mjs';

const $=id=>document.getElementById(id);
const PREFIX='worldlaw-active-notebook-v1:',POINTER='worldlaw-active-current-v1';
const examplePaths={coupled:'/examples/active-intervention-coupled-kinematics.json',
  bounded:'/examples/active-control-box-coupled-kinematics.json',
  cycles:'/examples/active-linear-family-signed-cycles.json',decays:'/examples/active-linear-family-decays.json'};
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
const pending=new Map();let messageId=0,generation=0,busy=false;
let book=null,mode='preview',activeKey=null,readingIndex=-1,pairIndex=0,tick=0,dirty=false,playback=null;
let storageMessage='',storageWarning=false;
let custody=null;
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
  const frozen=mode==='frozen',ready=book&&certified(book.plan)&&frozen&&!busy;
  $('experiment').setAttribute('aria-busy',String(busy));
  $('freeze-plan').disabled=!book||busy||frozen||dirty;
  $('freeze-plan').textContent=frozen?'Plan frozen ✓':'Freeze this plan →';
  $('export-notebook').disabled=!book||busy||!frozen;
  $('download-plan').disabled=!book||busy||!frozen;
  $('download-source').disabled=!book||busy;
  $('demo-controls').disabled=!ready||book?.plan.sourceSHA256!==COUPLED_DEMO_SOURCE_SHA256;
  $('supplied-controls').disabled=!ready;
  $('play').disabled=!book||busy;$('tick').disabled=!book||busy;
  $('source-text').readOnly=frozen;$('noise-bound').readOnly=frozen;
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
    const title=book.plan.source.slice(0,72)+' · '+book.readouts.length+' reading set'+(book.readouts.length===1?'':'s');
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
  custody=guard??(key&&key===activeKey?custody:null);
  book=next;mode=newMode;activeKey=key;readingIndex=book.readouts.length-1;pairIndex=0;tick=0;dirty=false;
  $('source-text').value=book.sourceText;
  $('noise-bound').value=String(JSON.parse(book.sourceText).noiseBound??0);
  if(newMode==='frozen'&&save)persist();
  else if(newMode==='preview'&&!storageWarning)storageMessage='Draft · not saved';
}
function renderWitness(){
  const projection=witnessProjection(book,readingIndex,pairIndex);
  $('exact-noise').textContent='± '+book.plan.noiseBound;
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
function redraw(){if(!book)return;drawApparatus($('apparatus'),book,tick,readingIndex);renderWitness();}
function setTick(next){
  if(!book)return;const horizon=illustrateModels(book).horizon;tick=Math.max(0,Math.min(horizon,next));
  $('tick').value=String(tick);$('tick-value').value=String(tick);$('tick-value').textContent=String(tick);
  for(const button of $('reading-timeline').querySelectorAll('button'))button.toggleAttribute('data-current',Number(button.dataset.tick)===tick);
  for(const row of $('control-table').querySelectorAll('tr[data-input-tick]'))row.toggleAttribute('data-current',Number(row.dataset.inputTick)===tick);
  redraw();
}
function render(){
  if(!book){updateControls();return;}
  const data=illustrateModels(book),plan=book.plan,ticks=plannedTicks(plan),frozen=mode==='frozen';
  const record=book.readouts[readingIndex];
  $('phase').textContent=dirty?'Unapplied source edits':frozen?'Frozen experiment':'Prospective preview';
  $('source-kind').textContent=data.isDemo?'Hypothetical coupled-track example':'User-supplied source declaration · origin unverified';
  $('course-label').textContent=data.bounded?(plan.chosenControls?'Designed bounded input':'No bounded input certified'):
    plan.chosenIntervention?plan.chosenIntervention.replaceAll('_',' '):plan.schema.includes('interventions')?'No offered course certified':'Source-declared fixed input';
  $('illustration-note').textContent=data.isDemo?
    'Illustrative forecasts start at position 3 and hidden velocity −2. The exact test allows a different, arbitrary start for each law; these paths are not uncertainty envelopes.':
    (data.referenceControls?'No separating input was certified. These reference forecasts use the lower bound of every input. ':'')+
    'Illustrative forecasts start with zero latent state in each model. They are not fitted states or uncertainty envelopes. The exact test permits independent arbitrary starting states.';
  $('tick').max=String(data.horizon);tick=Math.min(tick,data.horizon);$('tick').value=String(tick);$('tick-value').textContent=String(tick);
  $('plan-kicker').textContent=frozen?'FROZEN PROSPECTIVE PLAN · NO OUTCOMES USED':'PROSPECTIVE PREVIEW · NO OUTCOMES USED';
  $('plan-heading').textContent=certified(plan)?ticks.length+' reading'+(ticks.length===1?'':'s')+' separate the offered laws.':({search_inconclusive:'The search limit was reached.',candidate_uncertified:'A candidate remains uncertified.',noise_separation_not_certified:'The declared error leaves overlapping possibilities.',no_offered_intervention_certified:'No offered intervention is certified.',structurally_indistinguishable_on_offered_course:'These controls cannot distinguish the laws.',structurally_indistinguishable_on_control_box:'No allowed input can distinguish the laws.',insufficient_reading_budget:'The reading budget cannot separate the laws.'}[plan.status]||'No certified experiment yet.');
  $('plan-summary').textContent=certified(plan)?'Read at ticks '+ticks.join(', ')+'. '+(data.bounded?'Use the designed input below. ':plan.chosenIntervention?'Use '+plan.chosenIntervention.replaceAll('_',' ')+'. ':'')+'Declared '+(data.bounded?'reading':'total')+' cost '+(plan.totalDeclaredCost??plan.totalCost)+'.':plan.interpretation;
  $('control-course').hidden=!data.bounded;
  $('control-heading').textContent=plan.chosenControls?'The designed input':'Declared input bounds';
  $('control-explanation').textContent=plan.chosenControls?
    'This input gives the greatest separation on the selected reading schedule. Read at tick t, then apply that tick’s input before the next state. No input has been applied.':
    'No input was certified. The model illustrations use the lower bounds only as a reference; no input has been applied.';
  $('control-table').innerHTML=data.bounded?'<table><caption>Exact source-declared control intervals and selected values</caption><thead><tr><th scope="col">Input tick</th><th scope="col">Channel</th><th scope="col">Allowed interval</th><th scope="col">Chosen value</th></tr></thead><tbody>'+plan.controlBounds.flatMap((row,t)=>row.min.map((lower,c)=>`<tr data-input-tick="${t}" ${t===tick?'data-current':''}><th scope="row">${t}</th><td>${c+1}</td><td>[${html(lower)}, ${html(row.max[c])}]</td><td class="chosen-control">${plan.chosenControls?html(plan.chosenControls[t][c]):'—'}</td></tr>`)).join('')+'</tbody></table>':'';
  $('reading-timeline').innerHTML=Array.from({length:data.horizon+1},(_,i)=>`<button type="button" data-tick="${i}" ${ticks.includes(i)?'data-selected':''} ${i===tick?'data-current':''} aria-label="Inspect tick ${i}${ticks.includes(i)?', planned reading':''}">${i}<small>${ticks.includes(i)?'READ':'—'}</small></button>`).join('');
  const proofs=plan.pairProof??plan.proof??[];
  $('witness-pair').replaceChildren(...proofs.map((proof,i)=>new Option(proof.pair,String(i))));$('witness-pair').value=String(pairIndex);
  $('pair-label').hidden=proofs.length<=1;
  $('demo-controls').hidden=!data.isDemo;
  $('receive-note').textContent=!frozen?'Freeze the prospective plan before receiving values. No instrument has run.':!certified(plan)?'This frozen plan does not certify an experiment. It can be exported and replayed; revise the source or limits in a separate draft.':data.isDemo?'Choose a separate synthetic response, or supply readings below. The frozen plan stays unchanged.':'No acquisition instrument is attached to this source. Supply independently obtained readings below.';
  $('reading-fields').innerHTML=ticks.map(t=>`<label for="reading-${t}"><span class="tick-label">Reading at tick ${t}</span><input id="reading-${t}" data-tick="${t}" type="text" inputmode="decimal" placeholder="Missing"></label>`).join('');
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
    $('result-heading').textContent=({one_hypothesis_consistent:'One candidate remains compatible.',all_hypotheses_falsified:'No offered law fits these readings.',multiple_hypotheses_consistent:'Multiple explanations remain compatible.',readout_inconclusive:'The readout test is inconclusive.'})[result.status];
    $('result-summary').textContent='Checked '+result.receivedTicks.length+' of '+result.plannedTicks.length+' planned readings under ±'+result.noiseBound+' error per reading. The candidate family and control course stayed frozen.';
    $('candidate-results').innerHTML=result.checks.map(row=>`<div class="candidate-result"><h3>${html(row.hypothesis.replaceAll('_',' '))}</h3><p class="${row.status==='consistent'?'conditional':row.status==='falsified'?'falsified':'muted'}">${row.status==='consistent'?'Conditionally consistent':row.status==='falsified'?'Falsified within the declared bound':'Inconclusive'}</p><small>${row.noiseMarginExact?'Exact minimum error required: '+html(row.minimumNoiseRequired):'Error lower bound: '+html(row.noiseLowerBound)}</small></div>`).join('');
    $('missing-readings').textContent=result.missingTicks.length?'Missing planned ticks: '+result.missingTicks.join(', ')+'. No value was invented.':'Every selected tick is present in this reading set.';
    $('result-interpretation').textContent=result.interpretation;
    $('reading-set').replaceChildren(...book.readouts.map((row,i)=>new Option('Set '+(i+1)+' · '+row.result.acquisition,String(i))));$('reading-set').value=String(readingIndex);
  }
  redraw();updateControls();
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportJSON(value,name){download(JSON.stringify(value,null,2)+'\n',name);}
function exactInput(raw){
  const value=raw.trim();if(/^[+-]?\d+(?:\/[1-9]\d*)?$/.test(value))return value;
  if(!/^[+-]?(?:\d+\.\d*|\d*\.\d+)$/.test(value))throw Error('Use an integer, decimal or fraction for each reading.');
  const negative=value.startsWith('-'),unsigned=value.replace(/^[+-]/,''),[whole,fraction='']=unsigned.split('.');
  if(fraction.length>12||whole.length>13)throw Error('This decimal exceeds the exact input budget; use a smaller exact fraction.');
  let n=BigInt((whole||'0')+fraction)*(negative?-1n:1n),d=10n**BigInt(fraction.length),a=n<0n?-n:n,b=d;
  while(b)[a,b]=[b,a%b];const g=a||1n;n/=g;d/=g;return d===1n?String(n):String(n)+'/'+String(d);
}
const decodeOriginal=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
async function fetchSource(path){const response=await fetch(path);if(!response.ok)throw Error('The source example could not be loaded.');return decodeOriginal(await response.arrayBuffer());}
function planDraft(source){return transact(()=>ask({action:'plan',sourceText:source}),next=>adopt(next,'preview'),'Prospective design recomputed from this source. No reading values were used.');}
$('freeze-plan').addEventListener('click',()=>{
  if(!book||busy||dirty||mode==='frozen')return;
  mode='frozen';persist();render();announce('The source and prospective plan are frozen. Receive a separate reading set when ready.');
  if(certified(book.plan)){$('receive-region').scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'});if(book.plan.sourceSHA256===COUPLED_DEMO_SOURCE_SHA256)$('acquire').focus({preventScroll:true});else{$('supplied-details').open=true;$('readout-source').focus({preventScroll:true});}}
});
$('acquire').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!book||!certified(book.plan))return;
  const original=book,profile=$('demo-profile').value,key=activeKey;
  transact(()=>ask({action:'demo',book:original,profile}),next=>{adopt(next,'frozen',key);tick=plannedTicks(next.plan).at(-1)??0;},'Separate synthetic readings received. Exact consistency was checked against the original frozen plan.','result-heading');
});
$('evaluate-readings').addEventListener('click',()=>{
  if(busy||mode!=='frozen'||!book||!certified(book.plan))return;
  const original=book,key=activeKey;
  transact(()=>{
    const rows=[...$('reading-fields').querySelectorAll('input')].filter(input=>input.value.trim()).map(input=>({tick:Number(input.dataset.tick),value:exactInput(input.value)}));
    const raw={schema:'worldlaw.active-linear-readings/v1',source:$('readout-source').value,
      acquisition:$('acquisition-kind').value,sourceSHA256:original.plan.sourceSHA256,planSHA256:original.plan.planSHA256,
      ...(original.plan.chosenIntervention?{interventionId:original.plan.chosenIntervention}:{}),readings:rows};
    return ask({action:'read',book:original,text:JSON.stringify(raw,null,2)+'\n'});
  },next=>adopt(next,'frozen',key),'Supplied readings checked. Their physical origin and error calibration are not verified.','result-heading');
});
function fileAction(inputId,maximum,work,commit,message,focus){
  const input=$(inputId);let reads=0;
  input.addEventListener('change',()=>{
    const file=input.files?.[0];if(!file)return;const serial=++reads,snapshot={book,key:activeKey,mode,dirty};
    transact(async current=>{if(file.size>maximum)throw Error('This file exceeds the supported size limit.');const text=decodeOriginal(await file.arrayBuffer());if(!current())return null;return work(text,snapshot);},commit,message,focus).finally(()=>{if(serial===reads)input.value='';});
  });
}
fileAction('notebook-file',8388608,text=>ask({action:'open',text}),next=>adopt(next,'frozen'),'Notebook reopened. Every scientific claim was recomputed from its original bytes.');
fileAction('source-file',524288,text=>ask({action:'plan',sourceText:text}),next=>adopt(next,'preview'),'Original source accepted as a separate prospective draft. Earlier saved notebooks remain available.');
fileAction('readings-file',524288,(text,snapshot)=>{if(snapshot.mode!=='frozen'||!snapshot.book||!certified(snapshot.book.plan))throw Error('Freeze a certified prospective plan before receiving readings.');return ask({action:'read',book:snapshot.book,text}).then(next=>({next,key:snapshot.key}));},received=>adopt(received.next,'frozen',received.key),'Original readout bytes received and checked against the frozen plan.','result-heading');
fileAction('plan-file',2097152,(text,snapshot)=>{if(!snapshot.book||snapshot.mode!=='preview'||snapshot.dirty)throw Error('Open a CLI plan against an accepted prospective draft.');return ask({action:'plan',sourceText:snapshot.book.sourceText,plan:JSON.parse(text)});},next=>adopt(next,'frozen'),'The original CLI plan reopened with its original digest, counters and decision.');
for(const [button,input] of [['open-notebook','notebook-file'],['import-source','source-file'],['import-readings','readings-file'],['import-plan','plan-file']])$(button).addEventListener('click',()=>$(input).click());
$('export-notebook').addEventListener('click',()=>{if(book&&mode==='frozen'){exportJSON(book,'worldlaw-active-experiment.json');announce('Portable notebook exported with original source, frozen plan and every separate reading set.');}});
$('download-source').addEventListener('click',()=>book&&download(book.sourceText,'worldlaw-active-source.json'));
$('download-plan').addEventListener('click',()=>book&&exportJSON(book.plan,'worldlaw-active-plan.json'));
$('download-readings').addEventListener('click',()=>book?.readouts[readingIndex]&&download(book.readouts[readingIndex].readingsText,'worldlaw-active-readings.json'));
$('download-result').addEventListener('click',()=>book?.readouts[readingIndex]&&exportJSON(book.readouts[readingIndex].result,'worldlaw-active-result.json'));
$('load-example').addEventListener('click',()=>transact(async()=>ask({action:'plan',sourceText:await fetchSource(examplePaths[$('example').value])}),next=>adopt(next,'preview'),'A separate example draft is ready. No readings acquired.'));
$('new-draft').addEventListener('click',()=>book&&planDraft(book.sourceText));
$('replan').addEventListener('click',()=>{
  const source=$('source-text').value,bound=$('noise-bound').value.trim();
  transact(()=>{let text=source;const request=JSON.parse(source);if(String(request.noiseBound??0)!==bound){request.noiseBound=exactInput(bound);text=JSON.stringify(request,null,2)+'\n';}return ask({action:'plan',sourceText:text});},next=>adopt(next,'preview'),'Draft recomputed using the stated source and error bound. No readout values were used.');
});
for(const id of ['source-text','noise-bound'])$(id).addEventListener('input',()=>{if(mode==='preview'){dirty=true;$('phase').textContent='Unapplied source edits';announce('Displayed forecasts still belong to the last accepted source. Recompute the draft to apply these edits.');updateControls();}});
$('open-local').addEventListener('click',()=>{
  const key=$('local-notebook').value;if(!key)return;
  transact(async()=>{
    if(!key.startsWith(PREFIX))throw Error('Choose a notebook saved by this lab.');
    const {guard,entry}=readStored(key);
    return {guard,next:await ask({action:'open',text:JSON.stringify(entry.book)})};
  },({next,guard})=>{adopt(next,'frozen',key,false,guard);storageMessage='Reopened local notebook';storageWarning=false;},
  'Local notebook reopened after full exact replay.');
});
$('reading-set').addEventListener('change',()=>{readingIndex=Number($('reading-set').value);render();announce('Showing a separately retained reading set. The frozen plan is unchanged.');});
$('witness-pair').addEventListener('change',()=>{pairIndex=Number($('witness-pair').value);renderWitness();});
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
