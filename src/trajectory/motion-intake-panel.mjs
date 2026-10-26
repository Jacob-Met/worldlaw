import {inspectMotionRecording,createMotionAngularBundle,previewMotionStart,MAX_MOTION_INPUT_BYTES} from './motion-intake.mjs';

const SVG_NS='http://www.w3.org/2000/svg';
const number=value=>Number.isFinite(value)?Number(value.toPrecision(6)).toString():'unavailable';
const tick=value=>!Number.isFinite(value)?'':Math.abs(value)>=1000||(value!==0&&Math.abs(value)<.01)
 ?value.toExponential(1).replace('e+','e'):Number(value.toPrecision(3)).toString();
function svgElement(name,attributes={},text){
 const element=document.createElementNS(SVG_NS,name);
 for(const [key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
 if(text!==undefined)element.textContent=text;
 return element;
}
/** Display original source angles; this plot never supplies the numerical estimate. */
function drawSourceStart(svg,samples,origin,windowSize,onChoose){
 const width=Math.max(180,Math.round(svg.getBoundingClientRect().width||280)),left=48,right=width-8;
 svg.replaceChildren();svg.onclick=null;svg.setAttribute('viewBox','0 0 '+width+' 150');
 if(!samples.length){svg.append(svgElement('text',{x:12,y:75,class:'motion-start-empty'},'Choose a continuous source course.'));return;}
 const first=samples[0].time,last=samples.at(-1).time,positions=samples.map(row=>row.position);
 const low=Math.min(...positions),high=Math.max(...positions),span=Math.max(high-low,1e-9);
 const x=time=>left+(right-left)*(time-first)/(last-first||1),y=position=>14+101*(high-position)/span;
 const line=(rows,className)=>svgElement('polyline',{points:rows.map(row=>x(row.time)+','+y(row.position)).join(' '),class:className,fill:'none'});
 svg.append(svgElement('line',{x1:left,y1:119,x2:right,y2:119,class:'motion-start-axis'}));
 const chosen=Number.isInteger(origin)&&origin>=0&&origin<samples.length;
 const prefixStart=chosen&&Number.isInteger(windowSize)&&windowSize>=5&&windowSize<=31&&windowSize%2===1?origin-windowSize+1:-1;
 if(prefixStart>=0)svg.append(svgElement('rect',{x:x(samples[prefixStart].time),y:10,width:Math.max(1,x(samples[origin].time)-x(samples[prefixStart].time)),height:109,class:'motion-start-window'}));
 svg.append(line(samples,'motion-start-original'));
 if(chosen){
  svg.append(line(samples.slice(origin),'motion-start-retained'));
  if(prefixStart>=0)svg.append(line(samples.slice(prefixStart,origin+1),'motion-start-prefix'));
  svg.append(svgElement('line',{x1:x(samples[origin].time),x2:x(samples[origin].time),y1:10,y2:119,class:'motion-start-origin'}));
  svg.append(svgElement('circle',{cx:x(samples[origin].time),cy:y(samples[origin].position),r:3.5,class:'motion-start-point'}));
 }
 svg.append(svgElement('text',{x:5,y:9,class:'motion-start-axis-label'},'rad'));
 svg.append(svgElement('text',{x:left-5,y:24,'text-anchor':'end',class:'motion-start-axis-label'},tick(high)));
 svg.append(svgElement('text',{x:left-5,y:116,'text-anchor':'end',class:'motion-start-axis-label'},tick(low)));
 svg.append(svgElement('text',{x:left,y:139,class:'motion-start-axis-label'},tick(first)+' s'));
 svg.append(svgElement('text',{x:right,y:139,'text-anchor':'end',class:'motion-start-axis-label'},tick(last)+' s'));
 svg.setAttribute('aria-label','Original angular course'+(chosen?'; selected start at '+number(samples[origin].time)+' seconds':'')+'. Enter a sample number or click the curve to choose the start.');
 svg.onclick=event=>{
  const rect=svg.getBoundingClientRect(),at=first+Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*width-left)/(right-left)))*(last-first);
  let nearest=0;for(let i=1;i<samples.length;i++)if(Math.abs(samples[i].time-at)<Math.abs(samples[nearest].time-at))nearest=i;
  onChoose(nearest);
 };
}

/** An evidence preparation form for the actual Trajectory Challenge. */
export function createMotionIntakePanel(host,{onLoad,isBusy=()=>false}={}){
 const section=document.createElement('details');section.id='motion-intake-panel';section.className='motion-intake';
 section.innerHTML=`<summary>Use two Motion Lab recordings <span aria-hidden="true">+</span></summary>
 <div class="motion-intake-body">
 <p class="small">Choose separately saved Motion notebooks. One recording teaches the law; the other tests its forward motion. Original video files stay on your device.</p>
 <p class="input-hint">Keep the original Motion files for point measurements and revisions, and the separately identified original videos for pixel reinspection. The comparison retains angles, source identities, calibration and course lineage.</p>
 <div id="motion-intake-roles"></div>
 <label class="motion-intake-check"><input id="motion-unforced" type="checkbox"> Both recordings describe unforced scalar rotation.</label>
 <label class="motion-intake-check"><input id="motion-shared-frame" type="checkbox"> <span id="motion-shared-frame-label">Both use the same physical angle zero, direction and fixed camera orientation.</span></label>
 <label for="motion-assumption-basis">Basis for those declarations</label>
 <textarea id="motion-assumption-basis" rows="2" maxlength="500" placeholder="Describe the setup, shared reference and absence of applied drive."></textarea>
 <p class="input-hint">These are your declarations. Images alone do not identify physical inertia, forces or a valid common reference.</p>
 <button id="motion-compare" type="button" class="button dark full" disabled>Use these separate recordings →</button>
 <p id="motion-intake-status" class="small" role="status">No Motion pair prepared.</p>
 <p id="motion-intake-error" class="error-banner" role="alert" tabindex="-1" hidden></p>
 </div>`;
 host.append(section);
 const $=id=>section.querySelector('#'+id), records={training:null,challenge:null}, generations={training:0,challenge:0}, previews={training:null,challenge:null};
 let revision=0,working=false;
 const status=message=>{$('motion-intake-status').textContent=message;};
 const report=error=>{const box=$('motion-intake-error');box.textContent=error.message||String(error);box.hidden=false;box.focus();};
 const refresh=()=>{
  $('motion-compare').disabled=working||!records.training||!records.challenge||['training','challenge'].some(role=>
   $('motion-'+role+'-start-mode')?.value==='source-prefix'&&(!previews[role]||!$('motion-'+role+'-start-confirm').checked));
  const planes=records.training?.inspection.notebook.calibration.plane&&records.challenge?.inspection.notebook.calibration.plane;
  $('motion-shared-frame-label').textContent=planes?
   'Both declared planes use the same physical angle zero and direction; each camera remains fixed.':
   'Both use the same physical angle zero, direction and fixed camera orientation.';
 };
 const changed=()=>{revision++;$('motion-intake-error').hidden=true;status('Prepared inputs changed. The loaded challenge stays in place until you apply this pair.');refresh();};
 const resetAssumptions=()=>{$('motion-unforced').checked=false;$('motion-shared-frame').checked=false;$('motion-assumption-basis').value='';};
 const startDeclaration=role=>{
  const raw=$('motion-'+role+'-start-index').value.trim(),window=$('motion-'+role+'-start-window').value;
  if(!raw||!window)throw new Error('Choose the starting sample and an earlier window for the '+role+' recording.');
  const sigmaInput=$('motion-'+role+'-start-sigma');
  if(sigmaInput.validity.badInput)throw new Error('Enter a valid angle-error override, or clear the field to use the declared source error.');
  const sigma=sigmaInput.value.trim();
  return {mode:'source-prefix',originSampleIndex:Number(raw)-1,windowSize:Number(window),...(sigma===''?{}:{positionSigma:Number(sigma)})};
 };
 function drawStart(role){
  const prefix='motion-'+role+'-';
  const item=records[role],course=$(prefix+'course').value;
  const samples=item&&course!==''?item.inspection.angles.samples.filter(row=>row.segmentId===Number(course)):[];
  $(prefix+'start-index').max=String(samples.length||1);
  const raw=$(prefix+'start-index').value.trim(),origin=raw===''?null:Number(raw)-1,window=Number($(prefix+'start-window').value);
  drawSourceStart($(prefix+'start-chart'),samples,origin,window,index=>{
   $(prefix+'start-index').value=String(index+1);$(prefix+'start-index').dispatchEvent(new Event('input',{bubbles:true}));
  });
 }
 function renderStart(role){
  const prefix='motion-'+role+'-',mode=$(prefix+'start-mode').value;
  $(prefix+'supplied-start').hidden=mode!=='supplied';$(prefix+'prefix-start').hidden=mode!=='source-prefix';
  previews[role]=null;$(prefix+'start-confirm').disabled=true;$(prefix+'start-rate').textContent='Choose a start';
  drawStart(role);
  const item=records[role],course=$(prefix+'course').value;
  if(mode!=='source-prefix')return;
  if(!item||course===''){$(prefix+'start-preview').textContent='Prepare a recording and choose one continuous course.';return;}
  try{
   const preview=previewMotionStart(item.inspection,{role,segmentId:Number(course),start:startDeclaration(role)});
   previews[role]=preview;$(prefix+'start-confirm').disabled=false;$(prefix+'start-rate').textContent=number(preview.rate)+' rad/s';
   $(prefix+'start-preview').textContent='Start at '+number(preview.preparation.origin.time)+' s. '+preview.preparation.windowSize+
    ' source points end at this start; '+preview.forecastSampleCount+' unchanged samples remain '+(role==='training'?'for fitting':'to compare against the forecast')+
    '. Conditional rate-noise sigma: '+number(preview.rateSigma)+' rad/s. This is an assumption-based estimate, not calibrated tracking confidence.';
  }catch(error){$(prefix+'start-preview').textContent=error.message||String(error);}
 }
 function resetStart(role){
  const prefix='motion-'+role+'-';$(prefix+'start-mode').value='supplied';$(prefix+'start-index').value='';
  $(prefix+'start-window').value='';$(prefix+'start-sigma').value='';$(prefix+'start-confirm').checked=false;renderStart(role);
 }
 for(const role of ['training','challenge']){
  const name=role==='training'?'Training recording':'Challenge recording',field=document.createElement('fieldset');
  field.innerHTML=`<legend>${name}</legend>
   <label for="motion-${role}-file">Saved Motion notebook</label><input id="motion-${role}-file" type="file" accept=".json,application/json">
   <p id="motion-${role}-source" class="motion-source-label">Choose a notebook with an identified original video.</p>
   <label for="motion-${role}-course">Continuous course</label><select id="motion-${role}-course" disabled><option value="">Choose a recording first</option></select>
   <label for="motion-${role}-kind">Origin of this recording</label><select id="motion-${role}-kind"><option value="unknown">Unknown / not established</option><option value="measured">Measured physical motion</option><option value="synthetic">Authored synthetic motion</option></select>
   <label for="motion-${role}-start-mode">How will this course start?</label>
   <select id="motion-${role}-start-mode"><option value="supplied">Supply a known starting rate</option><option value="source-prefix">Estimate from an earlier source window</option></select>
   <div id="motion-${role}-supplied-start" class="motion-start-fields">
    <label for="motion-${role}-rate">Starting rate (rad/s)</label><input id="motion-${role}-rate" type="number" step="any" placeholder="Explicitly supplied, for example 0">
    <label for="motion-${role}-rate-basis">Basis for starting rate</label><input id="motion-${role}-rate-basis" type="text" maxlength="500" placeholder="Independent sensor, justified release from rest…">
   </div>
   <div id="motion-${role}-prefix-start" class="motion-start-fields" hidden>
    <p class="input-hint">Choose a later start inside this course. A window ending at that point supplies a conditional rate; the remaining angles are ${role==='training'?'used for fitting':'compared against the forecast'}. Gaps cannot be crossed.</p>
    <figure class="motion-start-source">
     <svg id="motion-${role}-start-chart" role="img" aria-label="Original angular source course"></svg>
     <figcaption><span class="motion-start-prefix-key">Rate window</span><span class="motion-start-retained-key">Retained course</span></figcaption>
    </figure>
    <label for="motion-${role}-start-index">First sample for ${role==='training'?'fitting':'the forecast'} (counting from 1)</label>
    <input id="motion-${role}-start-index" type="number" min="1" step="1" placeholder="Click the curve or enter a sample number">
    <label for="motion-${role}-start-window">Source points ending at this start</label>
    <select id="motion-${role}-start-window"><option value="">Choose a window explicitly</option>${Array.from({length:14},(_,i)=>5+2*i).map(n=>'<option value="'+n+'">'+n+' points</option>').join('')}</select>
    <label for="motion-${role}-start-sigma">Assumed angle error (rad, optional override)</label>
    <input id="motion-${role}-start-sigma" type="number" min="0" step="any" placeholder="Use declared source error in this window">
    <output id="motion-${role}-start-rate" class="motion-start-rate" aria-label="Estimated starting rate">Choose a start</output>
    <p id="motion-${role}-start-preview" class="input-hint" role="status">Choose a starting sample and window.</p>
    <label class="motion-intake-check"><input id="motion-${role}-start-confirm" type="checkbox" disabled> Use this conditional rate and the selected later course.</label>
    <p class="input-hint">The rate is conditional on the retained calibration. A reference fitted from the wider source may already depend on later points. Keep the original notebook. Reopening a Trajectory notebook reuses the adopted rate; it does not estimate it again.</p>
   </div>`;
  $('motion-intake-roles').append(field);
  $('motion-'+role+'-file').addEventListener('change',async event=>{
   const file=event.target.files?.[0];if(!file)return;
   const ticket=++generations[role];records[role]=null;resetStart(role);changed();resetAssumptions();
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
    renderStart(role);
    status('Prepared '+name.toLowerCase()+'. Choose its starting-state basis and shared setup before applying the pair.');
   }catch(error){if(ticket===generations[role]){$('motion-'+role+'-source').textContent='Recording not prepared.';report(error);}}
   finally{if(ticket===generations[role]){event.target.value='';refresh();}}
  });
 }
 const chartWidths=new Map(),chartRoles=new Map(['training','challenge'].map(role=>[$('motion-'+role+'-start-chart'),role]));
 const chartObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
  if(!section.isConnected)return;
  for(const entry of entries){
   const width=Math.round(entry.contentRect.width);
   if(width>0&&chartWidths.get(entry.target)!==width){chartWidths.set(entry.target,width);drawStart(chartRoles.get(entry.target));}
  }
 }):null;
 for(const chart of chartRoles.keys())chartObserver?.observe(chart);
 const edited=event=>{
  if(event.target.type==='file')return;
  for(const role of ['training','challenge']){
   const prefix='motion-'+role+'-';
   if(['start-mode','start-index','start-window','start-sigma','course','kind'].some(name=>event.target.id===prefix+name)){
    $(prefix+'start-confirm').checked=false;
    if(event.target.id===prefix+'course')$(prefix+'start-index').value='';
    renderStart(role);
   }
  }
  changed();
 };
 section.addEventListener('input',edited);section.addEventListener('change',edited);
 $('motion-compare').addEventListener('click',async()=>{
  if(working||isBusy())return;const ticket=revision;working=true;refresh();$('motion-intake-error').hidden=true;
  const declarations={};
  try{
   for(const role of ['training','challenge']){
    const item=records[role];if(!item)throw new Error('Prepare both Motion recordings.');
    const supplied=$('motion-'+role+'-start-mode').value==='supplied',raw=$('motion-'+role+'-rate').value.trim();
    if(supplied&&!raw)throw new Error('Supply the starting rate for the '+role+' recording.');
    const course=$('motion-'+role+'-course').value;
    if(course==='')throw new Error('Choose one continuous course for the '+role+' recording.');
    declarations[role]={input:item.bytes,segmentId:Number(course),kind:$('motion-'+role+'-kind').value};
    if($('motion-'+role+'-start-mode').value==='source-prefix'){
     if(!$('motion-'+role+'-start-confirm').checked)throw new Error('Review and adopt the conditional start for the '+role+' recording.');
     declarations[role].start=startDeclaration(role);
    }else{
     declarations[role].initialRate=Number(raw);declarations[role].initialRateBasis=$('motion-'+role+'-rate-basis').value;
    }
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
 return {section,disconnect:()=>chartObserver?.disconnect()};
}
