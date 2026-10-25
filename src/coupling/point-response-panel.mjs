import {POINT_RESPONSE_SCHEMA,inspectPointResponse,exportPointResponse,importPointResponse} from './point-response.mjs';
import {displayExact,exportExactDyadic} from '../cycle-work/angle-boxes.mjs';
import {addExactWork} from './circulation-angle-boxes.mjs';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const approximate=v=>`≈ ${displayExact(v)}`;
const readingInterval=(value,radius)=>{const center=exportExactDyadic(value),error=exportExactDyadic(radius);return [addExactWork(center,{...error,integer:(-BigInt(error.integer)).toString()}),addExactWork(center,error)];};
export function appendPointResponse(host,comparison){
 const panel=el('details');panel.id='circulation-point-response';panel.append(el('summary','Can one position-only response fit every original point reading?'));
 panel.append(el('p','Compare original torque-reading boxes at paired positions. This can distinguish a failed affine family from a contradiction of any position-only response. Nearby-position comparisons use your declared sensitivity limits; these limits are not fitted from the readings.'));
 const label=el('label','Source point readings and declared sensitivities (N·m/rad)'),input=el('textarea');input.id='point-response-input';input.rows=9;input.style.cssText='width:100%;box-sizing:border-box';input.setAttribute('aria-label','Point-response input-only question');
 input.value=JSON.stringify({schema:POINT_RESPONSE_SCHEMA,path:comparison.observed.input,sensitivity:[[1,1],[1,1]],sensitivityUnits:'N·m/rad',sensitivityBasis:'Illustrative limits of1 N·m/rad per input coordinate; replace with an explicitly justified hypothesis.'},null,2);label.append(input);
 const run=el('button','Check all point readings');run.id='point-response-run';run.type='button';const save=el('button','Save source question');save.id='point-response-save';save.type='button';save.disabled=true;
 const openLabel=el('label','Open saved question '),open=el('input');open.id='point-response-open';open.type='file';open.accept='.json,application/json';openLabel.append(open);
 const status=el('p');status.id='point-response-status';status.setAttribute('role','status');const result=el('div');result.id='point-response-result';let ticket=0,accepted=null;
 const clear=message=>{ticket++;accepted=null;save.disabled=true;result.replaceChildren();status.textContent=message;};
 input.oninput=()=>clear('Inputs changed. Recompute before saving or inspecting a witness.');
 run.onclick=()=>{clear('Checking every ordered pair of original readings…');try{
  const r=inspectPointResponse(JSON.parse(input.value));accepted=r.input;save.disabled=false;
  status.textContent=r.witness?'An explicit position-only response fits every reading box under the declared sensitivity limits.':r.repeatedStateConflict?'Readings at the same paired position contradict every single-valued position-only response under these error bounds.':'The reading boxes conflict with the declared position-sensitivity limits.';
  result.append(el('p',`${r.operations.rows} original readings; ${r.operations.orderedAxisPairChecks} exact ordered output/pair checks. Separate polygon work: ${r.work.work} J; interval [${r.work.interval.join(', ')}] J. Work and point-response compatibility answer different questions.`));
  if(r.witness){
   result.append(el('p','Constructed response: for each torque coordinate, take the maximum of every lower reading bound minus its declared weighted coordinate distance. The construction fits all retained boxes simultaneously. It is not a fitted physical model or a conservative potential.'));
   const selectorLabel=el('label','Inspect original reading '),select=el('select');select.id='point-response-row';r.input.path.samples.forEach((row,i)=>{const option=el('option',`${i+1}: q=[${row.q.join(', ')}] rad`);option.value=String(i);select.append(option);});selectorLabel.append(select);
   const quantities=el('table');quantities.id='point-response-quantities';quantities.style.cssText='width:100%;table-layout:fixed;overflow-wrap:anywhere';
   const caption=el('caption');quantities.append(caption);const head=el('tr');for(const title of ['Quantity','Torque 1 (N·m)','Torque 2 (N·m)']){const th=el('th',title);th.scope='col';head.append(th);}quantities.append(head);const body=el('tbody');quantities.append(body);
   const details=el('details');details.id='point-response-exact-details';details.append(el('summary','Exact witness values and complete source question'));const receipt=el('pre');receipt.id='point-response-witness';receipt.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';details.append(receipt);
   const draw=()=>{const i=Number(select.value),source=r.input.path.samples[i],witness=r.witness.sourceValues[i];caption.textContent=`Original reading ${i+1} · q = [${source.q.join(', ')}] rad`;
    const entries=[['Original reading',source.torque.map(v=>approximate(exportExactDyadic(v)))],['Error radius (±)',source.torqueRadius.map(v=>approximate(exportExactDyadic(v)))],['Allowed interval',source.torque.map((v,a)=>`[${readingInterval(v,source.torqueRadius[a]).map(approximate).join(', ')}]`)],['Constructed response',witness.torque.map(approximate)]];
    body.replaceChildren(...entries.map(([name,values])=>{const row=el('tr'),label=el('th',name);label.scope='row';row.append(label,...values.map(v=>el('td',v)));return row;}));
    receipt.textContent=JSON.stringify({originalRow:i+1,reading:source,constructedTorque:witness.torque,supportingOriginalRows:witness.supportingRows.map(n=>n+1),sourceQuestion:r.input},null,2);
   };select.onchange=draw;draw();result.append(selectorLabel,quantities,el('p','≈ marks a rounded display value. The exact witness and source bounds are retained below; the constructed response is not an acquired measurement.'),details);
  }else{
   const conflicts=[...(r.repeatedStateConflict?[r.repeatedStateConflict]:[]),...r.axes.map(a=>a.conflict).filter(Boolean)].filter((c,i,list)=>list.findIndex(d=>d.axis===c.axis&&d.lowerRow===c.lowerRow&&d.upperRow===c.upperRow)===i);
   for(const c of conflicts){
    result.append(el('h4',`Torque ${c.axis+1}: original readings ${c.lowerRow+1} and ${c.upperRow+1} cannot share the declared response`),el('p',`Lower bound ${approximate(c.lower)} N·m at reading ${c.lowerRow+1} exceeds upper bound ${approximate(c.upper)} N·m at reading ${c.upperRow+1}, plus allowed position-response change ${approximate(c.sensitivityAllowance)} N·m. The gap is strictly positive: ${approximate(c.gap)} N·m. Displays are rounded; exact values remain below.`));
    const detail=el('details');detail.append(el('summary','Exact contradiction and complete source question'));const receipt=el('pre',JSON.stringify({axis:c.axis+1,lowerOriginalRow:c.lowerRow+1,lowerReading:r.input.path.samples[c.lowerRow],upperOriginalRow:c.upperRow+1,upperReading:r.input.path.samples[c.upperRow],lowerBound:c.lower,upperBound:c.upper,sensitivityAllowance:c.sensitivityAllowance,gap:c.gap,sourceQuestion:r.input},null,2));receipt.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';detail.append(receipt);result.append(detail);
   }
  }
  result.append(el('p','Point readings only, under declared exact positions, reading-error bounds and sensitivity limits. No physical mechanism, cause, or between-reading torque interpolation is established.'));
  const scope=el('details');scope.append(el('summary','Complete interpretation and limits'),el('p',r.scope));result.append(scope);
 }catch(error){accepted=null;save.disabled=true;result.replaceChildren();status.textContent=`Refused: ${error.message}`;}};
 open.onchange=async()=>{const file=open.files?.[0];open.value='';if(!file)return;clear('Reading independent saved point-response question…');const mine=ticket;try{if(file.size>4*1024*1024)throw Error('Question exceeds4MiB.');const raw=importPointResponse(await file.text());if(mine!==ticket||!panel.isConnected)return;input.value=JSON.stringify(raw,null,2);status.textContent='Independent saved question loaded. Recompute; the parent loop and training are unchanged.';}catch(error){if(mine===ticket&&panel.isConnected)status.textContent=`Refused: ${error.message}`;}};
 save.onclick=()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([exportPointResponse(accepted)],{type:'application/json'})),a=el('a');a.href=url;a.download='worldlaw-point-response.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 panel.append(label,run,save,openLabel,status,result);host.append(panel);
}
