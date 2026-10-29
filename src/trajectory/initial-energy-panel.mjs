import {prepareInitialEnergyQuestion,exportInitialEnergyQuestion,reopenInitialEnergyQuestion,INITIAL_STATE_RECEIPT_LIMIT} from './initial-energy-receipt.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
// Decimal endpoint is an exact directed projection of the raw dyadic bound.
export function formatEnergyBound(raw,upper,digits=5){
 const n=BigInt(raw),d=1n<<80n,scale=10n**BigInt(digits),v=n*scale;
 const floor=(a,b)=>a>=0n?a/b:-((-a+b-1n)/b);
 const q=upper?-floor(-v,d):floor(v,d),negative=q<0n,a=negative?-q:q;
 const text=a.toString().padStart(digits+1,'0');return (negative?'-':'')+text.slice(0,-digits)+'.'+text.slice(-digits);
}
/** Directed decimal enclosure of the nonnegative exact threshold, 17 significant digits. */
export function formatReadingThreshold(raw){
 for(const key of ['numerator','denominator'])if(typeof raw?.[key]!=='string'||raw[key].length>1250||!/^\d+$/.test(raw[key]))throw Error('Bounded exact threshold required');
 const n=BigInt(raw.numerator),d=BigInt(raw.denominator);if(n<0n||d<=0n)throw Error('Nonnegative exact threshold required');
 if(n===0n)return {lower:'0',upper:'0'};
 let exponent=n.toString().length-d.toString().length;
 if(exponent>=0?n<d*10n**BigInt(exponent):n*10n**BigInt(-exponent)<d)exponent--;
 const scale=16-exponent,a=scale>=0?n*10n**BigInt(scale):n,b=scale>=0?d:d*10n**BigInt(-scale),floor=a/b,ceil=floor+(a%b?1n:0n);
 const text=value=>{const s=value.toString(),e=s.length-1-scale;if(e < -4||e > 6)return s[0]+(s.length>1?'.'+s.slice(1):'')+'e'+e;const point=s.length-scale;return point<=0?'0.'+'0'.repeat(-point)+s:point>=s.length?s+'0'.repeat(point-s.length):s.slice(0,point)+'.'+s.slice(point);};
 return {lower:text(floor),upper:text(ceil)};
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
  const threshold=report.overlapThreshold,thresholdBox=node('section');thresholdBox.id='initial-energy-threshold';thresholdBox.style.cssText='margin:12px 0;padding:10px 0;border-top:1px solid #c4cfb9;overflow-wrap:anywhere';
  const fraction=x=>x.denominator==='1'?x.numerator:`${x.numerator}/${x.denominator}`;
  if(threshold){
   const display=formatReadingThreshold(threshold.exact);thresholdBox.append(node('h4','Smallest uniform half-width for overlap with this bound'));
   const value=node('p',threshold.zero?'0 rad — all original readings already overlap; no enlargement is needed for this necessary check.':`${display.lower===display.upper?display.lower:display.lower+' to '+display.upper} rad (rounded outwards).`);value.id='initial-energy-threshold-value';value.dataset.numerator=threshold.exact.numerator;value.dataset.denominator=threshold.exact.denominator;thresholdBox.append(value);
   const exact=node('details');exact.append(node('summary','Exact overlap threshold'),node('p',fraction(threshold.exact)+' rad'));thresholdBox.append(exact,node('p','This only concerns overlap with the unchanged outer bound. It is not calibrated uncertainty or evidence that one trajectory explains the readings. Your declared radius and starting widths are unchanged.'));
   if(!threshold.withinDeclaredRadiusLimit)thresholdBox.append(node('p','This diagnostic exceeds the 100 rad reading-declaration limit; the input limit is unchanged.'));
   readingOutput.append(thresholdBox);
  }
  const label=node('label','Original rows page '),pages=node('select');pages.id='initial-energy-reading-page';label.append(pages);
  const size=100;for(let i=0;i<Math.ceil(report.rows.length/size);i++){const option=node('option',`${i*size+1}–${Math.min((i+1)*size,report.rows.length)} of ${report.rows.length}`);option.value=String(i);pages.append(option);}
  const scroll=node('div');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Original reading intervals; scroll horizontally and vertically');scroll.style.cssText='overflow:auto;max-height:28rem;max-width:100%;margin-top:10px';
  const table=node('table');table.style.cssText='font-size:.875rem;width:max-content;min-width:100%;table-layout:auto';scroll.append(table);readingOutput.append(label,node('p','Scroll the ledger horizontally for complete exact intervals and gaps, and vertically for every row on this page.'),scroll);
  function page(){table.replaceChildren();const head=node('tr');for(const t of ['Original row','Time (s)','Angle (rad)','Exact reading interval (rad)','Account','Exact separation (rad)']){const th=node('th',t);th.scope='col';th.style.fontSize='.8rem';head.append(th);}table.append(head);
   for(const row of report.rows.slice(Number(pages.value)*size,(Number(pages.value)+1)*size)){const tr=node('tr');tr.dataset.originalIndex=String(row.index);for(const value of [String(row.index),String(row.time),String(row.position),`${fraction(row.interval[0])} to ${fraction(row.interval[1])}`,row.status==='separated'?`Separated ${row.side}`:'Overlaps — inconclusive',fraction(row.gap)]){const td=node('td',value);td.style.cssText='white-space:nowrap;max-width:none';tr.append(td);}table.append(tr);}}
  pages.addEventListener('change',page);page();
  const course=report.course;
  if(course){
   const region=node('section');region.id='initial-energy-course';region.dataset.state=course.status;region.style.cssText='margin:12px 0;padding:10px 0;border-top:1px solid #c4cfb9;overflow-wrap:anywhere';
   region.append(node('h4',course.status==='conjunction_rejected'?'No common bounded-speed course under these assumptions':'No bounded-speed contradiction found — inconclusive'));
   region.append(node('p','This additional necessary check uses the complete original starting-angle box, every original reading interval, exact original time gaps and the certified outer speed limit. It does not fit a path or change your reading radius. Survival does not establish an ODE trajectory, phase, sensor accuracy or physical validity.'));
   const first=course.first;
   if(first?.kind==='speed-limit'){
    region.append(node('p',`The first strict contradiction is retained: ${first.earlier.kind==='original-initial-box'?'the original starting-angle box':'original row '+first.earlier.index} at ${first.earlier.time} s and original row ${first.later.index} at ${first.later.time} s cannot both be reached within this speed limit.`));
    const summary=node('div');summary.id='initial-energy-course-travel';
    for(const [name,value] of [['Required travel',first.requiredTravel],['Allowed travel',first.allowedTravel],['Positive excess',first.gap]]){
     let text;
     try{const range=formatReadingThreshold(value);text=`${name}: ${range.lower===range.upper?range.lower:range.lower+' to '+range.upper} rad (rounded outwards).`;}
     catch{text=`${name}: decimal display unavailable; the complete exact value remains in the certificate below.`;}
     summary.append(node('p',text));
    }
    summary.append(node('p','The strict contradiction is decided using exact arithmetic, not these rounded display values.'));region.append(summary);
    const exact=node('details');exact.append(node('summary','Exact speed and travel certificate'));
    for(const [name,value,unit] of [['Certified outer speed',first.speed,'rad/s'],['Original elapsed time',first.elapsed,'s'],['Required travel',first.requiredTravel,'rad'],['Allowed travel',first.allowedTravel,'rad'],['Strict excess',first.gap,'rad']])exact.append(node('p',`${name}: ${fraction(value)} ${unit}`));region.append(exact);
    const selected=node('p');selected.id='initial-energy-course-selected';selected.setAttribute('role','status');
    for(const [name,witness] of [['earlier',first.earlier],['later',first.later]]){
     if(witness.index===null)continue;
     const jump=node('button',`Inspect ${name} original row ${witness.index}`);jump.type='button';jump.className='button outline';jump.id='initial-energy-course-'+name;jump.style.margin='4px';
     jump.addEventListener('click',()=>{pages.value=String(Math.floor(witness.index/size));page();const tr=table.querySelector(`tr[data-original-index="${witness.index}"]`);tr.tabIndex=-1;tr.style.outline='2px solid #3b6978';tr.focus({preventScroll:true});tr.scrollIntoView({block:'nearest',inline:'nearest'});selected.textContent=`${name==='earlier'?'Earlier':'Later'} original row ${witness.index}, time ${witness.time} s, angle ${witness.position} rad. This is an original reading, not an inferred event.`;});region.append(jump);
    }
    region.append(selected);
   }else if(first?.kind==='position-limit')region.append(node('p',`Original row ${first.source.index} already has no overlap with the outer angle limit. The position account above retains the exact separation; no additional speed-only explanation is asserted.`));
   region.append(node('p',`${report.rows.length} original rows checked, together with the starting box. A contradiction rejects the conjunction of the frozen law, starting box, original coordinate/time interpretation and declared reading bound; it does not identify which assumption failed. Later rows cannot erase the first contradiction.`));
   readingOutput.insertBefore(region,label);
  }

  if(threshold&&!threshold.zero){
   const witnesses=threshold.attainingRows;
   thresholdBox.append(node('p',`${witnesses.length} original ${witnesses.length===1?'row determines':'rows tie for'} this threshold. These are retained row identities, not inferred event times.`));
   const label=node('label','Attaining row number in this witness list '),choice=node('input');choice.type='number';choice.min='1';choice.max=String(witnesses.length);choice.step='1';choice.value='1';choice.id='initial-energy-witness-choice';choice.style.cssText='max-width:100%;box-sizing:border-box';label.append(choice);
   const jump=node('button','Inspect attaining original row');jump.type='button';jump.className='button outline';jump.id='initial-energy-witness-jump';
   const selected=node('p');selected.id='initial-energy-witness-selected';selected.setAttribute('role','status');
   jump.addEventListener('click',()=>{const number=choice.valueAsNumber;if(!Number.isInteger(number)||number<1||number>witnesses.length){choice.setCustomValidity(`Choose a whole witness number from 1 to ${witnesses.length}.`);choice.reportValidity();return;}choice.setCustomValidity('');const row=witnesses[number-1];pages.value=String(Math.floor(row.index/size));page();const tr=table.querySelector(`tr[data-original-index="${row.index}"]`);tr.tabIndex=-1;tr.style.outline='2px solid #3b6978';tr.focus({preventScroll:true});tr.scrollIntoView({block:'nearest',inline:'nearest'});selected.textContent=`Original row ${row.index}, time ${row.time} s, angle ${row.position} rad. Witness ${number} of ${witnesses.length}.`;});
   choice.addEventListener('input',()=>choice.setCustomValidity(''));thresholdBox.append(label,jump,selected);
  }
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
