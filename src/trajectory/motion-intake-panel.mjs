import {inspectMotionRecording,createMotionAngularBundle,MAX_MOTION_INPUT_BYTES} from './motion-intake.mjs';

/** An evidence preparation form for the actual Trajectory Challenge. */
export function createMotionIntakePanel(host,{onLoad,isBusy=()=>false}={}){
 const section=document.createElement('details');section.id='motion-intake-panel';section.className='motion-intake';
 section.innerHTML=`<summary>Use two Motion Lab recordings <span aria-hidden="true">+</span></summary>
 <div class="motion-intake-body">
 <p class="small">Choose separately saved Motion notebooks. One recording teaches the law; the other tests its forward motion. Original video files stay on your device.</p>
 <p class="input-hint">Keep the original Motion files for pixel and revision reinspection. The comparison retains angles, source identities, calibration and course lineage.</p>
 <div id="motion-intake-roles"></div>
 <label class="motion-intake-check"><input id="motion-unforced" type="checkbox"> Both recordings describe unforced scalar rotation.</label>
 <label class="motion-intake-check"><input id="motion-shared-frame" type="checkbox"> Both use the same physical angle zero, direction and fixed camera orientation.</label>
 <label for="motion-assumption-basis">Basis for those declarations</label>
 <textarea id="motion-assumption-basis" rows="2" maxlength="500" placeholder="Describe the setup, shared reference and absence of applied drive."></textarea>
 <p class="input-hint">These are your declarations. Images alone do not identify physical inertia, forces or a valid common reference.</p>
 <button id="motion-compare" type="button" class="button dark full" disabled>Use these separate recordings →</button>
 <p id="motion-intake-status" class="small" role="status">No Motion pair prepared.</p>
 <p id="motion-intake-error" class="error-banner" role="alert" tabindex="-1" hidden></p>
 </div>`;
 host.append(section);
 const $=id=>section.querySelector('#'+id), records={training:null,challenge:null}, generations={training:0,challenge:0};
 let revision=0,working=false;
 const status=message=>{$('motion-intake-status').textContent=message;};
 const report=error=>{const box=$('motion-intake-error');box.textContent=error.message||String(error);box.hidden=false;box.focus();};
 const refresh=()=>{$('motion-compare').disabled=working||!records.training||!records.challenge;};
 const changed=()=>{revision++;$('motion-intake-error').hidden=true;status('Prepared inputs changed. The loaded challenge stays in place until you apply this pair.');refresh();};
 const resetAssumptions=()=>{$('motion-unforced').checked=false;$('motion-shared-frame').checked=false;$('motion-assumption-basis').value='';};
 for(const role of ['training','challenge']){
  const name=role==='training'?'Training recording':'Challenge recording',field=document.createElement('fieldset');
  field.innerHTML=`<legend>${name}</legend>
   <label for="motion-${role}-file">Saved Motion notebook</label><input id="motion-${role}-file" type="file" accept=".json,application/json">
   <p id="motion-${role}-source" class="motion-source-label">Choose a notebook with an identified original video.</p>
   <label for="motion-${role}-course">Continuous course</label><select id="motion-${role}-course" disabled><option value="">Choose a recording first</option></select>
   <label for="motion-${role}-kind">Origin of this recording</label><select id="motion-${role}-kind"><option value="unknown">Unknown / not established</option><option value="measured">Measured physical motion</option><option value="synthetic">Authored synthetic motion</option></select>
   <label for="motion-${role}-rate">Starting rate (rad/s)</label><input id="motion-${role}-rate" type="number" step="any" placeholder="Explicitly supplied, for example 0">
   <label for="motion-${role}-rate-basis">Basis for starting rate</label><input id="motion-${role}-rate-basis" type="text" maxlength="500" placeholder="Independent sensor, justified release from rest…">`;
  $('motion-intake-roles').append(field);
  $('motion-'+role+'-file').addEventListener('change',async event=>{
   const file=event.target.files?.[0];if(!file)return;
   const ticket=++generations[role];records[role]=null;changed();resetAssumptions();
   $('motion-'+role+'-rate').value='';$('motion-'+role+'-rate-basis').value='';
   const select=$('motion-'+role+'-course');select.replaceChildren();select.disabled=true;
   $('motion-'+role+'-source').textContent='Reading '+file.name+'…';
   try{
    if(file.size>MAX_MOTION_INPUT_BYTES)throw new Error('Choose a Motion notebook no larger than 2 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer()),inspection=await inspectMotionRecording(bytes);
    if(ticket!==generations[role])return;
    records[role]={bytes,inspection,name:file.name};
    if(inspection.courses.length>1){const option=document.createElement('option');option.value='';option.textContent='Choose one course explicitly';select.append(option);}
    for(const course of inspection.courses){const option=document.createElement('option');option.value=String(course.id);
     option.textContent='Course '+(course.id+1)+' · '+course.count+' samples · '+course.startTime.toFixed(3)+'–'+course.endTime.toFixed(3)+' s';select.append(option);}
    select.disabled=false;
    const synthetic=['synthetic','synthetic-video'].includes(inspection.notebook.source.kind);
    $('motion-'+role+'-kind').value=synthetic?'synthetic':'unknown';
    $('motion-'+role+'-source').textContent=inspection.notebook.source.label+' · video '+inspection.notebook.source.sha256.slice(0,12)+'…';
    status('Prepared '+name.toLowerCase()+'. Supply its starting rate and shared setup before applying the pair.');
   }catch(error){if(ticket===generations[role]){$('motion-'+role+'-source').textContent='Recording not prepared.';report(error);}}
   finally{if(ticket===generations[role]){event.target.value='';refresh();}}
  });
 }
 section.addEventListener('input',event=>{if(event.target.type!=='file')changed();});
 section.addEventListener('change',event=>{if(event.target.type!=='file')changed();});
 $('motion-compare').addEventListener('click',async()=>{
  if(working||isBusy())return;const ticket=revision;working=true;refresh();$('motion-intake-error').hidden=true;
  const declarations={};
  try{
   for(const role of ['training','challenge']){
    const item=records[role];if(!item)throw new Error('Prepare both Motion recordings.');
    const raw=$('motion-'+role+'-rate').value.trim();if(!raw)throw new Error('Supply the starting rate for the '+role+' recording.');
    const course=$('motion-'+role+'-course').value;
    if(course==='')throw new Error('Choose one continuous course for the '+role+' recording.');
    declarations[role]={input:item.bytes,segmentId:Number(course),kind:$('motion-'+role+'-kind').value,
     initialRate:Number(raw),initialRateBasis:$('motion-'+role+'-rate-basis').value};
   }
   const bundle=await createMotionAngularBundle({...declarations,assumptions:{unforcedScalarRotation:$('motion-unforced').checked,
    sharedAngleFrame:$('motion-shared-frame').checked,basis:$('motion-assumption-basis').value}});
   if(ticket!==revision)throw new Error('Prepared inputs changed during intake. Apply the current pair again.');
   const applied=await onLoad(bundle,()=>ticket===revision);
   if(!applied)throw new Error('Another input replaced this comparison before it loaded. Apply the current pair again.');
   if(ticket===revision)status('Separate Motion recordings loaded. The displayed law fits training angles only; challenge angles test the forward prediction.');
  }catch(error){if(ticket===revision)report(error);}
  finally{working=false;refresh();}
 });
 return {section};
}
