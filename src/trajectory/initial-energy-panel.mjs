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
 host.append(title,intro,button,tools,help,status,output);anchor.before(host);let ticket=0,busy=false,pending=false,accepted=null;
 function controls(){button.disabled=busy||pending;save.disabled=busy||pending||!accepted;file.disabled=busy;}
 function clear(){ticket++;pending=false;accepted=null;controls();output.replaceChildren();output.hidden=true;host.dataset.state='idle';status.textContent='Inputs changed. Check the current declared starts again.';}
 function draw(question){
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
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];if(!selected||busy)return;file.value='';const mine=++ticket;pending=true;controls();output.hidden=true;host.dataset.state='pending';status.textContent='Opening a replacement question. The accepted question is retained until the replacement is admitted.';
  try{const c=current();if(selected.size>INITIAL_STATE_RECEIPT_LIMIT)throw Error('Open an initial-state JSON receipt smaller than 3 MB.');const text=await selected.text();if(mine!==ticket)return;
   const question=await reopenInitialEnergyQuestion(text,{model:c.model,run:c.run});if(mine!==ticket)return;
   // The parent retires the old grid and question while changing the shared widths.
   c.setWidths(question.source.options);accepted=question;pending=false;draw(question);controls();
  }catch(error){if(mine===ticket){pending=false;if(accepted)draw(accepted);else {host.dataset.state='unavailable';output.replaceChildren();output.hidden=true;}status.textContent='Question not reopened: '+error.message+(accepted?' Previous accepted question and limits retained.':'');controls();}}
 });
 save.addEventListener('click',()=>{if(busy||pending||!accepted)return;try{const text=exportInitialEnergyQuestion(accepted),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='worldlaw-initial-state-question.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status.textContent='Question not saved: '+error.message+' Accepted question and limits remain available.';}});
 return {clear,setBusy(value){busy=!!value;if(busy)clear();controls();}};
}
