import {inspectHalfCycleSensitivity} from './cycle-work-half-sensitivity.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'unavailable';
export function createHalfSensitivityPanel(anchor){
 const host=node('section');host.id='cycle-work-half-sensitivity';host.hidden=true;anchor.after(host);
 host.append(node('h4','Do the half residuals depend on the rate window?'),node('p','Keep the observed positions, original cycle/minimum endpoints, potential changes and trained coefficients fixed. Compare explicitly offered centered local-rate windows. This checks numerical choices; it is not a calibrated uncertainty interval or a physical explanation.'));
 const controls=node('div');controls.className='cycle-controls';
 const label=node('label','Offered window lengths (samples, comma separated)'),windows=node('input');windows.id='half-sensitivity-windows';windows.type='text';windows.value='5, 9, 17, 31';windows.style.maxWidth='100%';label.append(windows);
 const inspect=node('button','Compare rate-window sensitivity');inspect.type='button';inspect.className='button outline';inspect.id='inspect-half-sensitivity';
 const save=node('button','Export sensitivity source inputs');save.type='button';save.className='button outline';save.id='export-half-sensitivity';save.hidden=true;
 controls.append(label,inspect,save);host.append(controls,node('p','Use odd window lengths from 5 to 31 samples. Unsupported offers remain visible with their reason. Up to six distinct offers; additional work is reserved for each complete population before that window runs.'));
 const status=node('p');status.id='half-sensitivity-status';status.setAttribute('role','status');host.append(status);
 const familyLabel=node('label','Frozen law for the selected original cycle'),family=node('select');family.id='half-sensitivity-family';familyLabel.append(family);familyLabel.hidden=true;host.append(familyLabel);
 const selectionText=node('p');selectionText.id='half-sensitivity-selection';host.append(selectionText);
 const output=node('div');output.id='half-sensitivity-results';output.style.display='grid';output.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,260px),1fr))';output.style.gap='12px';host.append(output);
 const population=node('details');population.append(node('summary','Every offered window: population and refusals'));const body=node('div');population.append(body);population.hidden=true;host.append(population);
 let original=null,result=null,selection=null,ticket=0;
 function clearResult(){result=null;save.hidden=familyLabel.hidden=population.hidden=true;output.replaceChildren();body.replaceChildren();selectionText.textContent='';}
 function reset(){ticket++;original=null;selection=null;clearResult();host.hidden=true;inspect.disabled=false;windows.value='5, 9, 17, 31';status.textContent='';}
 function paint(){
  output.replaceChildren();selectionText.textContent='';if(!result||!selection)return;
  const {runId,cycleIndex}=selection;selectionText.textContent='Original recording '+runId+', cycle '+cycleIndex+'. Signed residuals and pair sums use normalized rad²/s². Selection follows the original cycle controls above.';
  for(const variant of result.variants){
   const card=node('section');card.style.border='1px solid #b8c8bf';card.style.padding='12px';card.style.minWidth='0';card.style.overflowWrap='anywhere';card.dataset.window=String(variant.windowSize);
   card.append(node('h5','Window '+variant.windowSize+' samples'));
   const row=variant.comparisons.find(r=>r.runId===runId&&r.cycleIndex===cycleIndex&&r.candidateId===family.value);
   if(!row)card.append(node('p','No original complete cycle is selected.'));
   else if(row.status!=='compared')card.append(node('p','REFUSED · '+row.reason));
   else{
    for(const half of row.halves)card.append(node('p',half.direction+' '+fmt(half.start)+'–'+fmt(half.end)+' s: residual '+fmt(half.residual)+'; observed loss '+fmt(half.observedLoss)+'; predicted loss '+fmt(half.predictedLoss)+'.'));
    card.append(node('p','Pair residual sum '+fmt(row.residualSum)+'. '+(row.opposedSigns?'Half residuals have opposite signs.':'Half residuals do not have opposite signs.')));
   }
   output.append(card);
  }
 }
 function receive(next,nextSelection){
  if(next!==original){reset();original=next;host.hidden=!next;status.textContent='Optional numerical sensitivity; the original half-cycle ledger remains unchanged.';}
  selection=nextSelection;paint();
 }
 function showReport(next){
  result=next;save.hidden=familyLabel.hidden=population.hidden=false;windows.value=next.inputs.options.windows.join(', ');family.replaceChildren();body.replaceChildren();
  for(const id of ['restoring-only',...next.original.investigation.fit.candidates.map(c=>c.id)]){const o=node('option',id);o.value=id;family.append(o);}
  for(const v of next.variants){
   const admitted=v.comparisons.filter(r=>r.status==='compared').length,reasons=new Map();
   for(const r of v.comparisons)if(r.status!=='compared')reasons.set(r.reason,(reasons.get(r.reason)??0)+1);
   body.append(node('p','Window '+v.windowSize+': '+v.cycles.length+' original cycles; '+admitted+' compared and '+(v.comparisons.length-admitted)+' refused cycle/law pairs. '+[...reasons].map(([reason,count])=>count+' × '+reason).join(' ')));
  }
  body.append(node('p','Additional work: '+next.work.actualRateWindows+' rate fits / '+next.work.reservedRateWindows+' reserved; '+next.work.actualIntervals+' intervals / '+next.work.reservedIntervals+' reserved. Original replay and extraction are separate bounded passes.'));
  status.textContent='Offered numerical windows evaluated without refitting. All original cycles and every refusal remain in the population. No window is selected as correct.';paint();
 }
 windows.addEventListener('input',()=>{ticket++;clearResult();inspect.disabled=false;status.textContent='Window declarations changed. Compare again before exporting.';});
 family.addEventListener('change',paint);
 inspect.addEventListener('click',async()=>{
  if(!original)return;const mine=++ticket,snapshot=original,declared=windows.value;clearResult();inspect.disabled=true;status.textContent='Replaying original source and evaluating the offered windows…';
  await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{const tokens=declared.split(',').map(x=>x.trim());if(tokens.some(x=>!/^\d+$/.test(x)))throw Error('Enter comma-separated integer sample counts.');showReport(inspectHalfCycleSensitivity(snapshot.inputs.cycleWork,{windows:tokens.map(Number)}));}
  catch(error){status.textContent='Sensitivity refused: '+error.message;}
  finally{if(mine===ticket)inspect.disabled=false;}
 });
 save.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result.inputs,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-half-cycle-sensitivity.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 return {reset,receive,showReport};
}
