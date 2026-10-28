import {inspectEqualAngleReturns} from './equal-angle-returns.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';
export function createEqualAnglePanel(anchor,{changed}){
 const host=node('section');host.id='equal-angle-returns';host.hidden=true;anchor.after(host);
 host.append(node('h4','Does speed return higher at the same reported angle?'),node('p','Compare two passages through an exactly matching reported coordinate within the original cycle. A static, single-valued conservative potential cancels only if the physical coordinates are truly identical. Rates remain local estimates; this is a conditional model check, not identification of an energy source.'));
 const actions=node('div');actions.className='cycle-controls';
 const inspect=node('button','Inspect equal-coordinate returns');inspect.id='inspect-equal-angle-returns';inspect.type='button';inspect.className='button outline';
 const save=node('button','Export return source inputs');save.id='export-equal-angle-returns';save.type='button';save.className='button outline';save.hidden=true;actions.append(inspect,save);host.append(actions);
 const status=node('p');status.id='equal-angle-status';status.setAttribute('role','status');host.append(status);
 const label=node('label','Exact reported coordinate in the selected original cycle'),level=node('select');level.id='equal-angle-level';label.append(level);label.hidden=true;host.append(label);
 const locate=node('button','Locate both passages on the observed trace');locate.id='locate-equal-angle';locate.type='button';locate.className='button outline';locate.hidden=true;host.append(locate);
 const output=node('div');output.id='equal-angle-output';output.style.overflowWrap='anywhere';output.style.marginTop='12px';host.append(output);
 const coverage=node('details');coverage.hidden=true;coverage.append(node('summary','All original cycles, matching levels and refusals'));const body=node('div');coverage.append(body);host.append(coverage);
 let original=null,result=null,selection=null,ticket=0;
 function reset(){ticket++;original=null;result=null;selection=null;host.hidden=true;save.hidden=label.hidden=locate.hidden=coverage.hidden=true;inspect.disabled=false;level.replaceChildren();output.replaceChildren();body.replaceChildren();status.textContent='';}
 function selected(){if(!level.options.length||level.value==='')return null;const row=result?.rows[Number(level.value)];return row?.runId===selection?.runId&&row?.cycleIndex===selection?.cycleIndex?row:null;}
 function paint(){
  output.replaceChildren();const row=selected();locate.hidden=!row||row.status!=='compared';if(!row)return;
  output.append(node('p','Original recording '+row.runId+', cycle '+row.cycleIndex+'.'));
  if(row.status!=='compared'){output.append(node('p','REFUSED · '+row.reason));return;}
  output.append(node('p','Reported angle '+fmt(row.position)+' rad at '+fmt(row.start)+' s and '+fmt(row.end)+' s. Local rates '+fmt(row.firstRate)+' and '+fmt(row.lastRate)+' rad/s, using the original '+result.windowSize+'-sample window.'));
  output.append(node('p','Estimated kinetic loss: '+fmt(row.kineticLoss)+' rad²/s². '+(row.kineticLoss<0?'Negative: the later estimated speed is greater. This conflicts with nonnegative loss only under the stated scalar, coordinate and rate assumptions.':'Nonnegative: this necessary sign condition is not violated by these estimates; it does not validate a law.')));
  output.append(node('p','Potential change cancels under the equal-physical-coordinate assumption. Original reported equality can conceal quantization or calibration error; no near-equality tolerance or interpolation is used.'));
  const table=node('table');table.style.width='100%';table.style.tableLayout='fixed';const caption=node('caption','Frozen loss laws on this same return interval · normalized rad²/s²');table.append(caption);
  const head=node('tr');for(const text of ['Frozen law','Predicted loss','Residual']){const th=node('th',text);th.scope='col';head.append(th);}const thead=node('thead');thead.append(head);table.append(thead);const tbody=node('tbody');
  for(const comparison of row.comparisons){const tr=node('tr'),name=node('th',comparison.candidateId);name.scope='row';name.style.overflowWrap='anywhere';tr.append(name);if(comparison.status==='compared'){tr.append(node('td',fmt(comparison.predictedLoss)),node('td',fmt(comparison.residual)));}else{const td=node('td','REFUSED · '+comparison.reason);td.colSpan=2;tr.append(td);}tbody.append(tr);}table.append(tbody);output.append(table);
 }
 function selectCycle(){
  const old=level.value;level.replaceChildren();
  result?.rows.forEach((row,i)=>{if(row.runId!==selection?.runId||row.cycleIndex!==selection?.cycleIndex)return;const option=node('option',row.position===undefined?'Original cycle unavailable':fmt(row.position)+' rad · '+(row.status==='compared'?fmt(row.start)+'–'+fmt(row.end)+' s':'refused'));option.value=String(i);level.append(option);});
  if([...level.options].some(o=>o.value===old))level.value=old;paint();
 }
 function receive(next,nextSelection){if(next!==original){reset();original=next;host.hidden=!next;status.textContent='Optional check; the original cycle fit, trace and ledgers remain unchanged.';}selection=nextSelection;if(result)selectCycle();}
 function showReport(next){
  result=next;save.hidden=label.hidden=coverage.hidden=false;body.replaceChildren();
  const compared=next.rows.filter(x=>x.status==='compared'),negative=compared.filter(x=>x.kineticLoss<0);
  status.textContent=compared.length+' compared return intervals; '+negative.length+' have negative estimated kinetic loss. These overlapping intervals are not independent replicates or calibrated tests.';
  for(const record of next.original.records)for(const c of record.cycles){const rows=next.rows.filter(r=>r.runId===record.runId&&r.cycleIndex===c.cycleIndex);body.append(node('p',record.runId+', cycle '+c.cycleIndex+': '+rows.filter(x=>x.position!==undefined).length+' exact reported matching levels; '+rows.filter(x=>x.status==='compared').length+' compared. '+rows.filter(x=>x.status!=='compared').map(x=>x.reason).join(' ')));}
  body.append(node('p',next.interpretation));body.append(node('p','Additional work: '+next.work.actualRateWindows+' / '+next.work.requiredRateWindows+' reserved rate fits; '+next.work.actualIntervals+' / '+next.work.requiredIntervals+' reserved intervals. Original replay and extraction are separate bounded passes.'));selectCycle();
 }
 inspect.addEventListener('click',async()=>{if(!original)return;const mine=++ticket,snapshot=original;result=null;save.hidden=label.hidden=locate.hidden=coverage.hidden=true;output.replaceChildren();body.replaceChildren();inspect.disabled=true;status.textContent='Replaying original source and checking exact-coordinate returns…';changed();await new Promise(requestAnimationFrame);if(mine!==ticket)return;try{showReport(inspectEqualAngleReturns(snapshot.inputs.cycleWork));changed();}catch(error){status.textContent='Return inspection refused: '+error.message;}finally{if(mine===ticket)inspect.disabled=false;}});
 level.addEventListener('change',()=>{paint();changed();});
 locate.addEventListener('click',()=>{const trace=document.getElementById('cycle-work-halves-trace');trace?.scrollIntoView({block:'center',behavior:'instant'});trace?.focus();});
 save.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result.inputs,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-equal-angle-returns.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 return {reset,receive,showReport,selected};
}
