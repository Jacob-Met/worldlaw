import {createHistoryAcquisition,validateHistoryAcquisition,exportHistoryAcquisition,importHistoryAcquisition,completeHistoryAcquisition} from './history-acquisition.mjs';

// The worksheet records declared observations, never forecasts or generated readings.
export function mountHistoryAcquisition({onApply}) {
 const section=document.createElement('section');
 section.id='history-acquisition';section.className='history-acquisition';section.setAttribute('aria-labelledby','history-acquisition-title');
 section.innerHTML=`<p class="overline">COLLECT A SEPARATE PAIRED COURSE</p><h2 id="history-acquisition-title">Take the question to your instrument.</h2>
 <p>Freeze a balanced reading order, then record your actual visible state and torque. This worksheet does not operate hardware or verify how a measurement was taken.</p>
 <details><summary>Declare a new acquisition</summary><form id="history-acquisition-form">
 <div class="history-acquisition-settings">
 <label>Course identifier<input name="id" value="course-01" required maxlength="24" pattern="[a-zA-Z0-9_-]+"></label>
 <label>Pairs (even, 8–128)<input name="count" type="number" min="8" max="128" step="2" value="8" required></label>
 <label>Order seed<input name="seed" type="number" min="-1000000000" max="1000000000" step="1" value="41" required></label>
 <label>Declared noise (N·m)<input name="noiseSigma" type="number" min="0.00000001" max="1000" step="any" value="0.02" required></label>
 <label>Target command<input name="command" type="number" min="-1000000" max="1000000" step="any" value="0" required></label>
 <label>Target angle (rad)<input name="position" type="number" min="-1000000" max="1000000" step="any" value="0" required></label>
 <label>Target rate (rad/s)<input name="rate" type="number" min="-1000000" max="1000000" step="any" value="0" required></label>
 </div><label>Reference and conditioned preparation, including reset procedure<textarea name="preparation" required maxlength="160" rows="2"></textarea></label>
 <label>Measurement source / instrument<input name="sourceNote" required maxlength="120"></label>
 <button type="submit">Freeze a new blank worksheet</button></form></details>
 <div class="history-acquisition-actions"><button type="button" data-action="save" disabled>Save worksheet</button><label>Open worksheet<input data-action="open" type="file" accept=".json,application/json"></label></div>
 <p data-role="status" role="status" aria-live="polite">No course frozen. Declare a new acquisition or open a saved worksheet.</p>
 <div data-role="course" hidden><p data-role="declaration"></p><p>Read in the displayed order. Enter the <strong>actual</strong> command, angle, rate and torque for each reading. Blank cells stay unknown. Target agreement and pair matching are checked when applying; changing your experiment does not rewrite its frozen request. Even accepted small state differences can change torque: the tolerance does not establish physical equivalence or bound torque bias.</p>
 <div class="table-wrap" tabindex="0" role="region" aria-label="Chronological acquisition worksheet"><table><caption>Declared reading sequence · actual measurements, not model predictions</caption><thead><tr><th>Reading / pair</th><th>Preparation</th><th>Command</th><th>Angle (rad)</th><th>Rate (rad/s)</th><th>Torque (N·m)</th></tr></thead><tbody></tbody></table></div>
 <label class="history-acquisition-confirm"><input data-action="confirm" type="checkbox">I declare that these readings were acquired in this order, with the stated reference and conditioned preparation.</label>
 <button type="button" data-action="apply">Apply complete measurements to the comparison</button>
 <p>Application replaces the current paired comparison only. Save the completed worksheet to retain its full preparation and schedule. The paired notebook retains only your source note and worksheet identifier; it is not the complete acquisition record. Nothing is saved automatically.</p></div>
 <p data-role="error" role="alert" tabindex="-1"></p>`;
 const anchor=document.querySelector('.readout');if(!anchor)throw Error('The paired evidence entry point is unavailable.');anchor.before(section);
 const q=s=>section.querySelector(s),form=q('form'),body=q('tbody');
 let draft=null,generation=0,dirty=false;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const fields=['command','position','rate','jointTorque'];
 const showError=e=>{q('[data-role="error"]').textContent=e.message||String(e);q('[data-role="error"]').focus();};
 const clearError=()=>{q('[data-role="error"]').textContent='';};
 const safe=fn=>{try{fn();clearError();}catch(e){showError(e);}};
 function render(){
  q('[data-action="save"]').disabled=!draft;q('[data-role="course"]').hidden=!draft;body.replaceChildren();
  if(!draft)return;
  const r=draft.request;
  q('[data-role="status"]').textContent=`Frozen ${r.id} · ${r.count} pairs · seed ${r.seed} · user-declared acquisition. No readings are generated.`;
  q('[data-role="declaration"]').textContent=`Target: command ${r.command}, angle ${r.position} rad, rate ${r.rate} rad/s. Noise: ${r.noiseSigma} N·m. Preparation: ${r.preparation}. Source: ${r.sourceNote}.`;
  q('[data-action="confirm"]').checked=draft.orderConfirmed;
  for(const [index,reading] of draft.readings.entries()){
   const tr=document.createElement('tr');tr.dataset.history=reading.history;
   const identity=document.createElement('th');identity.scope='row';identity.textContent=`${reading.sampleIndex+1} / ${reading.pairId}`;tr.append(identity);
   const history=document.createElement('td');history.textContent=reading.history;tr.append(history);
   for(const field of fields){
    const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.step='any';input.min='-1000000';input.max='1000000';input.value=reading[field]===null?'':String(reading[field]);
    input.setAttribute('aria-label',`Reading ${reading.sampleIndex+1}, ${reading.history}, actual ${field}`);input.dataset.index=index;input.dataset.field=field;
    td.append(input);tr.append(td);
   }
   body.append(tr);
  }
 }
 function collect(){
  if(!draft)throw Error('Freeze or open a worksheet first.');
  const next=clone(draft);
  for(const input of body.querySelectorAll('input')){
   // Native badInput distinguishes an incomplete numeric token from an unknown blank.
   if(input.validity.badInput)throw Error('Finish or clear every partially entered number before continuing.');
   next.readings[Number(input.dataset.index)][input.dataset.field]=input.value.trim()===''?null:Number(input.value);
  }
  next.orderConfirmed=q('[data-action="confirm"]').checked;
  return clone(validateHistoryAcquisition(next));
 }
 function mayReplace(){return !dirty||window.confirm('Replace the current worksheet? Unsaved readings will be lost. Save it first if you need to keep them.');}
 form.addEventListener('invalid',()=>{generation++;},true);
 form.addEventListener('submit',event=>{event.preventDefault();safe(()=>{
  const data=new FormData(form),settings={};
  for(const key of ['id','preparation','sourceNote'])settings[key]=data.get(key);
  for(const key of ['count','seed','noiseSigma','command','position','rate']){const value=data.get(key);if(!String(value).trim())throw Error('Complete all acquisition settings.');settings[key]=Number(value);}
  const next=clone(createHistoryAcquisition(settings));if(!mayReplace())return;
  generation++;draft=next;dirty=true;render();
 });});
 body.addEventListener('input',()=>{generation++;dirty=true;q('[data-action="confirm"]').checked=false;clearError();});
 q('[data-action="confirm"]').addEventListener('change',()=>{generation++;dirty=true;clearError();});
 q('[data-action="save"]').addEventListener('click',()=>safe(()=>{
  draft=collect();const text=exportHistoryAcquisition(draft),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`worldlaw-history-acquisition-${draft.request.id}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  dirty=false;q('[data-role="status"]').textContent='Worksheet download requested. Keep the downloaded file; browser memory is not persistent storage.';
 }));
 q('[data-action="open"]').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;event.target.value='';const token=++generation;
  try{if(file.size>500000)throw Error('Use an acquisition JSON below 500 KB.');const text=await file.text();if(token!==generation)return;
   const next=clone(importHistoryAcquisition(text));if(!mayReplace())return;
   draft=next;dirty=false;render();clearError();
  }catch(e){if(token===generation)showError(e);}
 });
 q('[data-action="apply"]').addEventListener('click',()=>safe(()=>{
  generation++;const next=collect(),notebook=completeHistoryAcquisition(next);onApply(notebook);draft=next;
  q('[data-role="status"]').textContent=`Applied ${next.request.id} as user-declared measurements. The paired comparison now uses this course; save the worksheet to retain its full acquisition declarations.`;
 }));
 return {element:section};
}
