import {createHalfSensitivityPanel} from './cycle-work-half-sensitivity-panel.mjs';
import {inspectCycleWorkHalves} from './cycle-work.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';
export function createHalfCyclePanel(anchor){
 const host=node('section');host.id='cycle-work-halves';host.style.minWidth='0';host.hidden=true;anchor.after(host);
 host.append(node('h3','Does whole-cycle agreement hide opposing errors?'),node('p','Inspect separately observed receiving positions under the frozen training laws. Nothing is refitted. Observed loss is energy before minus energy after; residual is observed loss minus predicted dissipative work. Values are normalized rad²/s², not joules.'));
 const actions=node('div');actions.className='cycle-controls';
 const inspect=node('button','Inspect receiving half-cycles');inspect.id='inspect-cycle-work-halves';inspect.type='button';inspect.className='button outline';
 const save=node('button','Export half-cycle source inputs');save.id='export-cycle-work-halves';save.type='button';save.className='button outline';save.hidden=true;actions.append(inspect,save);host.append(actions);
 const status=node('p');status.id='cycle-work-halves-status';status.setAttribute('role','status');host.append(status);
 const controls=node('div');controls.className='cycle-controls';controls.hidden=true;
 const runLabel=node('label','Observed receiving recording'),run=node('select');run.id='cycle-work-halves-run';runLabel.append(run);
 const cycleLabel=node('label','Original complete cycle'),cycle=node('select');cycle.id='cycle-work-halves-cycle';cycleLabel.append(cycle);controls.append(runLabel,cycleLabel);host.append(controls);
 const trace=node('div');trace.id='cycle-work-halves-trace';trace.style.minWidth='0';host.append(trace);
 const selectedSummary=node('p');selectedSummary.id='cycle-work-halves-selected-summary';selectedSummary.style.overflowWrap='anywhere';host.append(selectedSummary);
 const scrollHint=node('p','Scroll the ledger horizontally, or focus it and use the arrow keys. The frozen law stays visible.');scrollHint.id='cycle-work-halves-scroll-hint';scrollHint.hidden=true;host.append(scrollHint);
 const ledgerStyle=node('style');ledgerStyle.textContent=`#cycle-work-halves-output{isolation:isolate}#cycle-work-halves-output table{min-width:650px;table-layout:fixed}#cycle-work-halves-output th:nth-child(5){width:90px;box-sizing:border-box}#cycle-work-halves-output th:nth-child(6){width:104px;box-sizing:border-box}#cycle-work-halves-output td{overflow-wrap:anywhere}#cycle-work-halves-output th:first-child{position:sticky;left:0;background:#fffef9;z-index:1;box-sizing:border-box;min-width:96px;max-width:96px;width:96px;overflow-wrap:anywhere}#cycle-work-halves-output thead th:first-child{z-index:2}#cycle-work-halves-scroll-hint{display:none}@media(max-width:540px){#cycle-work-halves-scroll-hint:not([hidden]){display:block}}`;host.append(ledgerStyle);
 const output=node('div');output.id='cycle-work-halves-output';output.className='cycle-table';output.tabIndex=0;output.setAttribute('role','region');output.setAttribute('aria-label','Scrollable observed half-cycle comparisons');output.setAttribute('aria-describedby','cycle-work-halves-scroll-hint');host.append(output);
 const coverage=node('details');coverage.append(node('summary','All receiving coverage and support'));const body=node('div');coverage.append(body);coverage.hidden=true;host.append(coverage);
 const sensitivity=createHalfSensitivityPanel(coverage);
 let original=null,report=null,ticket=0;
 function reset(){sensitivity.reset();ticket++;original=null;report=null;host.hidden=true;save.hidden=controls.hidden=coverage.hidden=true;trace.replaceChildren();selectedSummary.textContent='';scrollHint.hidden=true;output.replaceChildren();body.replaceChildren();inspect.disabled=false;status.textContent='';}
 function receive(result){reset();original=result;host.hidden=!result;status.textContent='Optional inspection; the original comparison and source export are unchanged.';}
 function chooseRun(){cycle.replaceChildren();const r=report?.records.find(r=>r.runId===run.value);for(const c of r?.cycles??[]){const o=node('option','Cycle '+c.cycleIndex+' · '+c.halfStatus);o.value=String(c.cycleIndex);cycle.append(o);}paint();}
 function drawObservedCycle(record,c){
  const source=report.investigation.inputs.bundle.challengeRuns.find(r=>r.id===record.runId);
  const samples=source?.samples.slice(c.first,c.last+1);
  if(!samples||samples.length<2){trace.append(node('p','Original receiving samples are unavailable for this cycle.'));return;}
  const first=samples[0],last=samples.at(-1),low=Math.min(...samples.map(p=>p.position)),high=Math.max(...samples.map(p=>p.position));
  const span=Math.max(1e-12,high-low),duration=last.time-first.time;
  if(!(duration>0)){trace.append(node('p','Original cycle time span is unavailable.'));return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 360 230');svg.setAttribute('role','img');svg.setAttribute('aria-label','Observed receiving angle versus source time for the selected complete cycle');
  svg.style.width='100%';svg.style.maxWidth='720px';svg.style.height='auto';svg.style.display='block';
  const add=(tag,attrs={},text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;svg.append(e);return e;};
  add('title',{},'Actual observed receiving samples: '+record.runId+', cycle '+c.cycleIndex);
  const supported=c.halfStatus==='compared'&&Number.isInteger(c.minimum)&&c.minimum>c.first&&c.minimum<c.last;
  add('desc',{},supported?'Original maximum, retained minimum and final maximum delimit two supported observed intervals. Straight segments join recorded samples; no intermediate motion is inferred.':'Original complete-cycle samples and endpoint markers only. Half-cycle support is refused; no minimum or partition is invented.');
  const x=t=>48+294*(t-first.time)/duration,y=q=>178-140*(q-low)/span;
  if(supported){const m=source.samples[c.minimum];add('rect',{x:x(first.time),y:30,width:x(m.time)-x(first.time),height:156,fill:'#f1bb68',opacity:.24});add('rect',{x:x(m.time),y:30,width:x(last.time)-x(m.time),height:156,fill:'#76bbcf',opacity:.24});add('line',{x1:x(m.time),x2:x(m.time),y1:30,y2:186,stroke:'#52646d','stroke-dasharray':'4 3'});}
  add('path',{d:'M48 30V186H342',fill:'none',stroke:'#697770'});
  add('text',{x:10,y:17,'font-size':12,fill:'#203928'},'Observed angle (rad)');
  for(const [q,py]of [[high,42],[low,182]])add('text',{x:43,y:py,'text-anchor':'end','font-size':10,fill:'#203928'},Number(q.toPrecision(3)).toString());
  add('polyline',{points:samples.map(p=>x(p.time)+','+y(p.position)).join(' '),fill:'none',stroke:'#173c30','stroke-width':2});
  const marks=[['First',c.first],...(supported?[['Minimum',c.minimum]]:[]),['Last',c.last]];
  for(const [label,i]of marks){const p=source.samples[i];const marker=add('circle',{cx:x(p.time),cy:y(p.position),r:4,fill:'#fff',stroke:'#173c30','stroke-width':2});const title=document.createElementNS(ns,'title');title.textContent=label+': '+fmt(p.time)+' s, '+fmt(p.position)+' rad';marker.append(title);}
  add('text',{x:48,y:203,'font-size':10,fill:'#203928'},fmt(first.time));add('text',{x:342,y:203,'text-anchor':'end','font-size':10,fill:'#203928'},fmt(last.time));add('text',{x:342,y:222,'text-anchor':'end','font-size':12,fill:'#203928'},'Source time (s)');
  trace.append(svg,node('p','Original receiving samples; straight segments connect recorded positions, not inferred motion. '+(supported?'Amber: first maximum to minimum. Blue: minimum to final maximum. ':'Half-cycle partition unavailable. ')+marks.map(([label,i])=>label+' '+fmt(source.samples[i].time)+' s').join(' · ')));
 }
 function paint(){
  trace.replaceChildren();selectedSummary.textContent='';scrollHint.hidden=true;output.replaceChildren();output.scrollLeft=0;const r=report?.records.find(r=>r.runId===run.value),c=r?.cycles.find(c=>String(c.cycleIndex)===cycle.value);
  sensitivity.receive(report,c?{runId:r.runId,cycleIndex:c.cycleIndex}:null);
  if(!c){output.append(node('p','No complete receiving cycle is available. Original prefix/suffix coverage remains below.'));return;}
  drawObservedCycle(r,c);
  selectedSummary.textContent=c.halfStatus==='compared'?'Observed max-to-min and min-to-max endpoints: '+fmt(c.start)+'–'+fmt(c.end)+' s. Two-half observed sum '+fmt(c.observedSum)+'; original full-cycle loss '+fmt(c.loss)+'; endpoint closure '+fmt(c.endpointClosure)+'.':c.halfReason;
  const table=node('table'),caption=node('caption','Frozen laws on the identical observed half-cycle pair · normalized rad²/s²');table.append(caption);
  const header=node('tr');for(const label of ['Frozen law','Half / support','Observed loss','Predicted loss','Residual','Pair residual sum']){const th=node('th',label);th.scope='col';header.append(th);}const thead=node('thead');thead.append(header);table.append(thead);const tbody=node('tbody');
  for(const row of report.comparisons.filter(x=>x.runId===r.runId&&x.cycleIndex===c.cycleIndex)){
   const values=row.status==='compared'?row.halves.map(h=>[row.candidateId,h.direction,fmt(h.observedLoss),fmt(h.predictedLoss),fmt(h.residual),fmt(row.residualSum)]):[[row.candidateId,row.reason,'—','—','—','—']];
   for(const valuesRow of values){const tr=node('tr');for(const [index,value] of valuesRow.entries()){const cell=node(index===0?'th':'td',value);if(index===0)cell.scope='row';tr.append(cell);}tbody.append(tr);}
  }table.append(tbody);output.append(table);scrollHint.hidden=false;
 }
 function showReport(next){
  report=next;save.hidden=controls.hidden=coverage.hidden=false;run.replaceChildren();body.replaceChildren();
  for(const r of report.records){const option=node('option',r.runId);option.value=r.runId;run.append(option);body.append(node('p',r.runId+': '+r.cycles.length+' original cycle pairs; '+r.cycles.filter(c=>c.halfStatus==='compared').length+' supported half-cycle pairs. Excluded prefix '+r.coverage.excludedPrefixSamples+' and suffix '+r.coverage.excludedSuffixSamples+' samples.'));for(const c of r.cycles)body.append(node('p','Cycle '+c.cycleIndex+': original '+c.status+'; half-cycle '+c.halfStatus+'. '+(c.halfReason??('Minimum plateau '+JSON.stringify(c.minimumPlateau)+'; shared endpoint closure '+fmt(c.endpointClosure)))));}
  body.append(node('p',report.interpretation));body.append(node('p','Diagnostic pass: '+report.work.rateWindows+' rate windows, '+report.work.intervals+' adjacent intervals. Original source replay and extraction are additional bounded passes.'));
  status.textContent='Observed receiving half-cycles inspected. Opposite residuals can cancel; this neither identifies a missing force nor establishes a calibrated discrepancy threshold.';chooseRun();
 }
 inspect.addEventListener('click',async()=>{if(!original)return;const mine=++ticket,snapshot=original;report=null;sensitivity.reset();save.hidden=true;controls.hidden=coverage.hidden=true;trace.replaceChildren();selectedSummary.textContent='';scrollHint.hidden=true;output.replaceChildren();body.replaceChildren();inspect.disabled=true;status.textContent='Replaying original source and inspecting observed receiving halves…';await new Promise(requestAnimationFrame);if(mine!==ticket)return;try{showReport(inspectCycleWorkHalves(snapshot.inputs));}catch(error){status.textContent='Half-cycle inspection refused: '+error.message;}finally{if(mine===ticket)inspect.disabled=false;}});
 run.addEventListener('change',chooseRun);cycle.addEventListener('change',paint);
 save.addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report.inputs,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-cycle-work-halves.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 return {reset,receive,showReport,showSensitivity(next){showReport(next.original);sensitivity.showReport(next);}};
}
