import {prepareInitialEnergyQuestion,exportInitialEnergyQuestion,reopenInitialEnergyQuestion,INITIAL_STATE_RECEIPT_LIMIT} from './initial-energy-receipt.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
// Decimal endpoint is an exact directed projection of the raw dyadic bound.
export function formatEnergyBound(raw,upper,digits=5){
 const n=BigInt(raw),d=1n<<80n,scale=10n**BigInt(digits),v=n*scale;
 const floor=(a,b)=>a>=0n?a/b:-((-a+b-1n)/b);
 const q=upper?-floor(-v,d):floor(v,d),negative=q<0n,a=negative?-q:q;
 const text=a.toString().padStart(digits+1,'0');return (negative?'-':'')+text.slice(0,-digits)+'.'+text.slice(-digits);
}
export function createInitialEnergyControls(anchor,context){
 const host=node('section');host.id='initial-energy';host.style.cssText='border-left:3px solid #3b6978;padding:12px 16px;display:grid;gap:10px;background:#f3f7f6;min-width:0';
 const title=node('h3','Limits for every declared start');title.style.margin='0';
 const intro=node('p','Use the same angle and rate widths above to check a coarse all-time limit of the frozen damped-sine law. The sampled paths remain a separate calculation.');
 const button=node('button','Check all-time model limits');button.type='button';button.id='check-initial-energy';button.className='button outline';button.style.justifySelf='start';
 const status=node('p','No limit checked.');status.id='initial-energy-status';status.setAttribute('role','status');
 const output=node('div');output.id='initial-energy-output';output.hidden=true;
 const tools=node('div');tools.style.cssText='display:flex;flex-wrap:wrap;gap:10px;align-items:center;min-width:0';
 const save=node('button','Save starting question');save.type='button';save.id='save-initial-energy';save.className='button outline';save.disabled=true;
 const openLabel=node('label','Reopen starting question');openLabel.style.cssText='display:grid;gap:5px;min-width:0;max-width:100%';
 const file=node('input');file.type='file';file.accept='.json,application/json';file.id='open-initial-energy';file.style.cssText='max-width:100%;box-sizing:border-box';openLabel.append(file);tools.append(save,openLabel);
 const help=node('p','Reopen an original sensitivity receipt or saved question only with its matching selected law and original recording. Saved answers are ignored; the limits are recomputed.');
 const readingTools=node('div');readingTools.id='initial-energy-reading-controls';readingTools.hidden=true;
 const radiusLabel=node('label','Angle-reading half-width (rad)');radiusLabel.style.cssText='display:grid;gap:5px';
 const readingRadius=node('input');readingRadius.type='number';readingRadius.min='0';readingRadius.max='100';readingRadius.step='any';readingRadius.id='initial-energy-reading-radius';readingRadius.style.cssText='max-width:100%;box-sizing:border-box';radiusLabel.append(readingRadius);
 const compare=node('button','Compare original readings');compare.type='button';compare.id='compare-initial-energy-readings';compare.className='button outline';
 readingTools.append(radiusLabel,compare,node('p','One declared bound for each original angle reading, in the same coordinates as this law. This is separate from starting-state widths; it does not enlarge that box or establish sensor accuracy.'));
 const readingOutput=node('div');readingOutput.id='initial-energy-reading-output';readingOutput.style.minWidth='0';readingOutput.hidden=true;
 host.append(title,intro,button,tools,help,status,output,readingTools,readingOutput);anchor.before(host);let ticket=0,busy=false,pending=false,accepted=null,readingDirty=false;
 function controls(){button.disabled=busy||pending;save.disabled=busy||pending||!accepted||readingDirty;file.disabled=busy;readingRadius.disabled=busy||pending;compare.disabled=busy||pending||!accepted||accepted.result.status!=='confined';}
 function clear(){ticket++;pending=false;accepted=null;readingDirty=false;readingRadius.value='';readingTools.hidden=true;readingOutput.replaceChildren();readingOutput.hidden=true;controls();output.replaceChildren();output.hidden=true;host.dataset.state='idle';status.textContent='Inputs changed. Check the current declared starts again.';}
 function drawReadings(question){
  readingOutput.replaceChildren();readingOutput.hidden=true;const report=question.readingResult;if(!report)return;
  readingOutput.hidden=false;readingOutput.dataset.state=report.status;
  if(report.status==='unavailable'){readingOutput.append(node('p','Reading comparison unavailable because no complete model limit was established.'));return;}
  readingOutput.append(node('h4',report.status==='conjunction_rejected'?'Declared assumptions incompatible with these readings':'No separated reading found — inconclusive'));
  readingOutput.append(node('p',`${report.separatedCount} of ${report.rows.length} original reading intervals are strictly outside the model limit. Contact with the boundary overlaps. Separation rejects the conjunction of law, starting box, original coordinate/course interpretation and reading bound; it does not identify which assumption failed. Overlap does not establish that one trajectory explains the recording.`));
  const label=node('label','Original rows page '),pages=node('select');pages.id='initial-energy-reading-page';label.append(pages);
  const size=100;for(let i=0;i<Math.ceil(report.rows.length/size);i++){const option=node('option',`${i*size+1}–${Math.min((i+1)*size,report.rows.length)} of ${report.rows.length}`);option.value=String(i);pages.append(option);}
  const scroll=node('div');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Original reading intervals; scroll horizontally and vertically');scroll.style.cssText='overflow:auto;max-height:28rem;max-width:100%;margin-top:10px';
  const table=node('table');table.style.cssText='font-size:.875rem;width:max-content;min-width:100%;table-layout:auto';scroll.append(table);readingOutput.append(label,node('p','Scroll the ledger horizontally for complete exact intervals and gaps, and vertically for every row on this page.'),scroll);
  const fraction=x=>x.denominator==='1'?x.numerator:`${x.numerator}/${x.denominator}`;
  function page(){table.replaceChildren();const head=node('tr');for(const t of ['Original row','Time (s)','Angle (rad)','Exact reading interval (rad)','Account','Exact separation (rad)']){const th=node('th',t);th.scope='col';th.style.fontSize='.8rem';head.append(th);}table.append(head);
   for(const row of report.rows.slice(Number(pages.value)*size,(Number(pages.value)+1)*size)){const tr=node('tr');tr.dataset.originalIndex=String(row.index);for(const value of [String(row.index),String(row.time),String(row.position),`${fraction(row.interval[0])} to ${fraction(row.interval[1])}`,row.status==='separated'?`Separated ${row.side}`:'Overlaps — inconclusive',fraction(row.gap)]){const td=node('td',value);td.style.cssText='white-space:nowrap;max-width:none';tr.append(td);}table.append(tr);}}
  pages.addEventListener('change',page);page();
 }
 function draw(question){
  readingDirty=false;readingRadius.value=question.source.readingComparison?String(question.source.readingComparison.angleReadingHalfWidth):'';readingTools.hidden=question.result.status!=='confined';drawReadings(question);
  output.replaceChildren();output.hidden=true;const {input,result}=question;host.dataset.state=result.status;
  if(result.status!=='confined'){status.textContent='No all-time limit established for this declared box. This does not establish escape or invalidate the separate sampled paths.';return;}
  status.textContent='Every declared starting state stays within these limits under this exact frozen model.';
   const table=node('table');table.style.cssText='width:100%;table-layout:fixed';
   for(const [label,key] of [['Angle (rad)','position'],['Rate (rad/s)','rate']]){
    const row=node('tr'),name=node('th',label),value=node('td',`${formatEnergyBound(result[key+'Raw'][0],false)} to ${formatEnergyBound(result[key+'Raw'][1],true)}`);name.scope='row';name.style.cssText='width:34%;white-space:normal;text-align:left;font-size:.8rem';value.style.cssText='white-space:normal;overflow-wrap:anywhere;font-size:.875rem';value.dataset.rawLower=result[key+'Raw'][0];value.dataset.rawUpper=result[key+'Raw'][1];row.append(name,value);table.append(row);
   }
   const note=node('p','These are coarse limits for all future time, not a prediction of phase, a confidence band or physical validation. The law and widths are assumed exact; physical inertia remains unknown. Displayed endpoints are rounded outwards.');
   const details=node('details'),summary=node('summary','Starting-box declarations');details.append(summary);
   for(const [name,b] of Object.entries(input.box))details.append(node('p',`${name==='position'?'Angle':'Rate'} center ${b.center}, half-width ${b.width}; includes both exact declarations and the rounded sampled starts.`));
   output.append(table,note,details);output.hidden=false;
 }
 function current(){const c=context();if(c.prelude)throw Error('This check uses the original supplied starting rate. Turn off the prelude-derived rate to compare the same declared starting box.');return c;}
 button.addEventListener('click',async()=>{
  if(busy||pending)return;clear();const mine=ticket;pending=true;controls();status.textContent='Checking the complete declared starting box…';
  await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{const c=current();if(!c.positionWidth.trim()||!c.rateWidth.trim())throw Error('Enter both declared half-widths above.');
   const question=prepareInitialEnergyQuestion(c.model,c.run,{positionHalfWidth:Number(c.positionWidth),rateHalfWidth:Number(c.rateWidth)});
   if(mine!==ticket)return;accepted=question;draw(question);
  }catch(error){if(mine===ticket){host.dataset.state='unavailable';status.textContent='All-time check unavailable: '+error.message+'. The separate sampled paths remain available.';}}
  finally{if(mine===ticket){pending=false;controls();}}
 });
 readingRadius.addEventListener('input',()=>{if(busy||pending||!accepted)return;ticket++;readingDirty=true;readingOutput.replaceChildren();readingOutput.hidden=true;controls();status.textContent='Reading bound changed. Compare again before saving this question; the original model limit is unchanged.';});
 compare.addEventListener('click',async()=>{
  if(busy||pending||!accepted||accepted.result.status!=='confined')return;
  const mine=++ticket;pending=true;readingDirty=true;readingOutput.replaceChildren();readingOutput.hidden=true;controls();status.textContent='Comparing every original angle reading…';
  await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{if(!readingRadius.value.trim())throw Error('Enter the angle-reading half-width.');const c=current();const question=prepareInitialEnergyQuestion(c.model,c.run,accepted.source.options,{angleReadingHalfWidth:Number(readingRadius.value)});if(mine!==ticket)return;accepted=question;draw(question);status.textContent='Original readings compared under the declared assumptions. Saving retains the reading bound.';}
  catch(error){if(mine===ticket)status.textContent='Readings not compared: '+error.message+' Original model limit retained; correct the reading bound before saving.';}
  finally{if(mine===ticket){pending=false;controls();}}
 });
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];if(!selected||busy)return;file.value='';const draft={value:readingRadius.value,dirty:readingDirty};const mine=++ticket;pending=true;controls();output.hidden=true;readingOutput.hidden=true;host.dataset.state='pending';status.textContent='Opening a replacement question. The accepted question and any reading-bound draft are retained until the replacement is admitted.';
  try{const c=current();if(selected.size>INITIAL_STATE_RECEIPT_LIMIT)throw Error('Open an initial-state JSON receipt smaller than 3 MB.');const text=await selected.text();if(mine!==ticket)return;
   const question=await reopenInitialEnergyQuestion(text,{model:c.model,run:c.run});if(mine!==ticket)return;
   // The parent retires the old grid and question while changing the shared widths.
   c.setWidths(question.source.options);accepted=question;pending=false;draw(question);controls();
  }catch(error){if(mine===ticket){pending=false;if(accepted)draw(accepted);else {host.dataset.state='unavailable';output.replaceChildren();output.hidden=true;}if(draft.dirty){readingRadius.value=draft.value;readingDirty=true;readingOutput.replaceChildren();readingOutput.hidden=true;}status.textContent='Question not reopened: '+error.message+(accepted?' Previous accepted question and limits retained.':'')+(draft.dirty?' Unsaved reading-bound draft retained; compare it before saving.':'');controls();}}
 });
 save.addEventListener('click',()=>{if(busy||pending||!accepted||readingDirty)return;try{const text=exportInitialEnergyQuestion(accepted),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='worldlaw-initial-state-question.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status.textContent='Question not saved: '+error.message+' Accepted question and limits remain available.';}});
 return {clear,setBusy(value){busy=!!value;if(busy)clear();controls();}};
}
