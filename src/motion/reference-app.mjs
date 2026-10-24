import {createMotionReferenceCase,openMotionReferenceCase} from './reference.mjs';
import {loadVideo} from './video.mjs';

const $=id=>document.getElementById(id),PAGE_SIZE=50;
const kinds={'recorded-marker':'Retained marker position','recorded-pivot':'Separately recorded pivot position','fixed-pivot-declaration':'Fixed pivot declaration'};
const reasons={'no-reference-label':'No reference label','no-recorded-frame':'No retained frame',occluded:'Reference occluded',unidentifiable:'Reference unidentifiable','non-decoded-measurement-time':'No decoded measurement clock','frame-time-mismatch':'Different reference frame','no-fixed-pivot-declaration':'No fixed pivot declaration','no-accepted-point':'No accepted position'};
const number=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
const coordinate=p=>p?`${number(p.x)}, ${number(p.y)} px`:'No visible position';
const staged={notebook:null,reference:null},versions={notebook:0,reference:0};
let active=null,epoch=0,caseVersion=0,pendingReads=0,source=null,sourceVersion=0,pendingLoad=null;
let targetIndex=0,selectedIndex=0,pageIndex=0,seekToken=0,seekController=null,seekTail=Promise.resolve(),cachedFrame=null;
function notice(text){$('notice').textContent=text;}
function fail(error){$('error').textContent=error.message||String(error);$('error').hidden=false;$('error').focus();notice(active?'The accepted comparison remains unchanged.':'Choose valid inputs to start a comparison.');}
function clearError(){$('error').hidden=true;$('error').textContent='';}
function updateCompare(){$('compare').disabled=!staged.notebook||!staged.reference||pendingReads>0;}
async function jsonFile(file,limit,label){
  if(!file||file.size<=0||file.size>limit)throw Error(`${label} must be a nonempty JSON file no larger than ${limit/(1024*1024)} MiB.`);
  try{return JSON.parse(await file.text());}catch{throw Error(`${label} could not be read as JSON.`);}
}
function stopSeek(){seekToken++;seekController?.abort();}
function clearFrame(text='No decoded source frame displayed.'){
  const canvas=$('source-canvas');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  canvas.setAttribute('aria-label',text);canvas.dataset.observationVisible='false';canvas.dataset.referenceVisible='false';
  $('frame-empty').hidden=false;$('frame-empty').textContent=source?'Select evidence to inspect its frame.':'Attach the matching video to see the source pixels.';
  $('frame-tag').textContent=source?'MATCHING VIDEO ATTACHED':'NO VIDEO ATTACHED';$('frame-caption').textContent=text;
}
function sameSource(video,identity){return video.source.sha256.toLowerCase()===identity.sha256.toLowerCase()
  &&video.source.nativeWidth===identity.nativeWidth&&video.source.nativeHeight===identity.nativeHeight
  &&video.width===identity.width&&video.height===identity.height&&Math.abs(video.duration-identity.duration)<=.001;}
function commit(value){
  const next=openMotionReferenceCase(value); // Validate completely before replacing accepted evidence.
  epoch++;caseVersion++;sourceVersion++;pendingLoad?.abort();pendingLoad=null;stopSeek();
  active=next;staged.notebook=next.raw.notebook;staged.reference=next.raw.reference;
  $('notebook-name').textContent=`Accepted: ${next.raw.notebook.source.label||'Motion notebook'}`;
  $('reference-name').textContent=`Accepted: ${next.raw.reference.tracks.length} separately marked target(s)`;
  $('frame-skew').value=next.raw.options.maxFrameSkewSeconds;
  if(source&&!sameSource(source,next.comparison.source)){source.dispose();source=null;cachedFrame=null;}
  targetIndex=0;pageIndex=0;$('row-filter').value='labeled';
  selectedIndex=Math.max(0,next.comparison.tracks[0].rows.findIndex(row=>row.reference_status!==null));
  $('target').replaceChildren(...next.comparison.tracks.map((track,i)=>{const option=document.createElement('option');option.value=i;option.textContent=kinds[track.kind];return option;}));
  $('results').hidden=false;$('save-case').disabled=false;$('attach-source').disabled=false;
  $('source-name').textContent=next.comparison.source.label||'Original local video';
  $('source-detail').textContent=`${next.comparison.source.width} × ${next.comparison.source.height} native pixels · ${number(next.comparison.source.duration)} s`;
  $('provenance').textContent=JSON.stringify({source:next.comparison.source,annotation:next.comparison.annotation,frame_skew_limit_s:next.comparison.max_frame_skew_s,note:'Annotation and PNG hashes are producer-declared. The browser does not authenticate the marked PNG.'},null,2);
  $('source-state').textContent=source?'Matching original video attached; source SHA-256, dimensions and duration verified.':'Source video is not attached. Numerical comparison uses the declared input identities.';
  clearError();updateCompare();render();showFrame();notice('Comparison recomputed from both raw inputs. The original notebook is unchanged.');
}
for(const kind of ['notebook','reference'])$(kind+'-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  const ticket=++versions[kind],atEpoch=epoch;caseVersion++;pendingReads++;updateCompare();clearError();
  try{
    const value=await jsonFile(file,2*1024*1024,kind==='notebook'?'Notebook':'Reference');
    if(ticket!==versions[kind]||atEpoch!==epoch)return;
    staged[kind]=value;$(kind+'-name').textContent=`Staged: ${file.name}`;notice('Inputs staged. Compare to accept them; the current comparison remains visible.');
  }catch(error){if(ticket===versions[kind]&&atEpoch===epoch)fail(error);}
  finally{pendingReads--;updateCompare();}
});
$('compare').addEventListener('click',()=>{
  caseVersion++;
  try{commit(createMotionReferenceCase(staged.notebook,staged.reference,{maxFrameSkewSeconds:Number($('frame-skew').value)}));}catch(error){fail(error);}
});
$('frame-skew').addEventListener('input',()=>{caseVersion++;notice('Frame difference limit edited. Compare to apply it. The accepted comparison remains unchanged.');});
$('open-case').addEventListener('click',()=>$('case-file').click());
$('case-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  const ticket=++caseVersion;clearError();notice('Reading saved comparison inputs…');
  try{const value=await jsonFile(file,4*1024*1024,'Reference case');if(ticket===caseVersion)commit(value);}
  catch(error){if(ticket===caseVersion)fail(error);}
});
$('attach-source').addEventListener('click',()=>$('source-file').click());
$('source-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||!active)return;
  const ticket=++sourceVersion,atEpoch=epoch;pendingLoad?.abort();const controller=new AbortController();pendingLoad=controller;clearError();
  $('source-state').textContent='Checking the selected video identity and native dimensions…';let candidate;
  try{
    candidate=await loadVideo(file,{signal:controller.signal});
    if(ticket!==sourceVersion||atEpoch!==epoch){candidate.dispose();return;}
    if(!sameSource(candidate,active.comparison.source))throw Error('The video SHA-256, native raster or duration differs from the accepted notebook. The current source and comparison are unchanged.');
    stopSeek();source?.dispose();source=candidate;candidate=null;cachedFrame=null;
    $('source-state').textContent='Matching original video attached; source SHA-256, dimensions and duration verified.';showFrame();
  }catch(error){candidate?.dispose();if(ticket===sourceVersion&&atEpoch===epoch){$('source-state').textContent=source?'The previously verified source remains attached.':'Source video is not attached.';if(error.name!=='AbortError')fail(error);}}
  finally{if(pendingLoad===controller)pendingLoad=null;}
});
function currentTrack(){return active?.comparison.tracks[targetIndex];}
function visibleRows(){return currentTrack().rows.map((row,index)=>({row,index})).filter(({row})=>{
  const filter=$('row-filter').value;return filter==='all'||filter==='labeled'&&row.reference_status!==null||filter===row.status;
});}
function render(){
  if(!active)return;
  const track=currentTrack(),summary=track.summary,rows=visibleRows();
  pageIndex=Math.min(pageIndex,Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1));
  $('target-kind').textContent=track.kind==='fixed-pivot-declaration'?'This target is a fixed location declared in the notebook. Its distance does not turn it into a measured pivot.':'This target uses only its own accepted or manual positions. The other target cannot supply a missing point.';
  $('scored-count').textContent=summary.scored;$('unscored-count').textContent=summary.unscored;
  $('mean-error').textContent=number(summary.mean_error_px);$('max-error').textContent=number(summary.max_error_px);
  const body=$('comparison-rows');body.replaceChildren();
  for(const {row,index} of rows.slice(pageIndex*PAGE_SIZE,(pageIndex+1)*PAGE_SIZE)){
    const tr=document.createElement('tr');tr.dataset.rowIndex=index;tr.setAttribute('aria-selected',index===selectedIndex?'true':'false');if(row.status==='unscored')tr.className='unscored';
    const time=document.createElement('td'),button=document.createElement('button');button.className='time-button';button.type='button';button.textContent=number(row.t,6);button.setAttribute('aria-label',`Inspect ${number(row.t,6)} seconds`);button.addEventListener('click',()=>{selectedIndex=index;render();showFrame();});time.append(button);tr.append(time);
    for(const text of [row.status==='scored'?'Scored':reasons[row.reason],number(row.error_px),row.status==='scored'?`${number(row.error_lower_px)}–${number(row.error_upper_px)}`:'Unscored']){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);
  }
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='No rows meet this view. Choose another row filter.';tr.append(td);body.append(tr);}
  $('previous-page').disabled=pageIndex===0;$('next-page').disabled=(pageIndex+1)*PAGE_SIZE>=rows.length;
  $('page-status').textContent=rows.length?`${pageIndex*PAGE_SIZE+1}–${Math.min(rows.length,(pageIndex+1)*PAGE_SIZE)} of ${rows.length} shown`:'0 rows shown';
  const row=track.rows[selectedIndex];$('selected-detail').replaceChildren();
  if(!row||!rows.some(item=>item.index===selectedIndex)){$('selected-decision').textContent='Select a visible row to inspect its evidence.';return;}
  $('selected-decision').textContent=row.status==='scored'?`Distance ${number(row.error_px)} px. The declared marking radius gives ${number(row.error_lower_px)}–${number(row.error_upper_px)} px; timing and tracker error are not included.`:`Unscored: ${reasons[row.reason].toLowerCase()}. No distance is imputed.`;
  const details=[['Evidence target',kinds[track.kind]],['Retained position',coordinate(row.measured)],['Reference mark',coordinate(row.reference)],['Retained state',row.observation_status??'No observation'],['Reference visibility',row.reference_status??'No label'],['Retained frame time',`${number(row.measurement_time_s,6)} s`],['Retained clock',row.measurement_time_basis??'Not recorded'],['Reference label time',`${number(row.reference_label_time_s,6)} s`],['Reference frame time',`${number(row.reference_frame_time_s,6)} s`],['Frame time difference',`${number(row.time_skew_s,6)} s`],['Declared marking radius',`${number(row.uncertainty_px)} px`],['Pixel-match score',number(row.pixel_match_score,6)],['Declared reference PNG SHA-256',row.frame_sha256??'No labeled image']];
  for(const [label,value]of details){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('selected-detail').append(dt,dd);}
}
function resetSelection(){const rows=visibleRows();pageIndex=0;selectedIndex=rows[0]?.index??-1;render();showFrame();}
$('target').addEventListener('change',()=>{targetIndex=Number($('target').value);resetSelection();});
$('row-filter').addEventListener('change',resetSelection);
for(const [id,direction]of [['previous-page',-1],['next-page',1]])$(id).addEventListener('click',()=>{pageIndex+=direction;selectedIndex=visibleRows()[pageIndex*PAGE_SIZE]?.index??-1;render();showFrame();});
function showFrame(){
  const token=++seekToken;seekController?.abort();clearFrame();
  const account=active,video=source,track=currentTrack(),row=track?.rows[selectedIndex];
  if(!account||!video||!row||!visibleRows().some(item=>item.index===selectedIndex))return;
  const wanted=row.reference_frame_time_s??row.measurement_time_s??row.t;
  $('frame-empty').textContent='Decoding the selected source frame…';
  seekTail=seekTail.catch(()=>{}).then(async()=>{
    if(token!==seekToken||account!==active||video!==source)return;
    const controller=new AbortController();seekController=controller;
    try{
      const frame=cachedFrame?.video===video&&cachedFrame.wanted===wanted?cachedFrame.frame:await video.frameAt(wanted,{signal:controller.signal});
      if(token!==seekToken||account!==active||video!==source)return;
      cachedFrame={video,wanted,frame};drawFrame(frame,track,row,account.comparison.max_frame_skew_s);
    }catch(error){if(token===seekToken&&error.name!=='AbortError'){clearFrame(`Source frame unavailable: ${error.message}`);fail(error);}}
    finally{if(seekController===controller)seekController=null;}
  });
}
function drawFrame(frame,track,row,maxSkew){
  const canvas=$('source-canvas');canvas.width=frame.width;canvas.height=frame.height;const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(frame.data,frame.width,frame.height),0,0);
  const decoded=frame.timeBasis==='decoded-media-time',near=t=>t!==null&&Math.abs(frame.time-t)<=maxSkew+1e-9;
  const observed=Boolean(row.measured&&decoded&&row.measurement_time_basis==='decoded-media-time'&&near(row.measurement_time_s));
  const marked=Boolean(row.reference&&decoded&&near(row.reference_frame_time_s));
  ctx.lineWidth=2;ctx.shadowColor='#09150e';ctx.shadowBlur=3;
  if(marked){const p=row.reference;ctx.strokeStyle='#ff91ca';ctx.beginPath();ctx.arc(p.x,p.y,row.uncertainty_px,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x,p.y+7);ctx.stroke();}
  if(observed){const p=row.measured,fixed=track.kind==='fixed-pivot-declaration';ctx.strokeStyle=fixed?'#ffe58a':'#67e8f9';ctx.beginPath();if(fixed){ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x+8,p.y);ctx.lineTo(p.x,p.y+8);ctx.lineTo(p.x-8,p.y);ctx.closePath();}else ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.stroke();}
  canvas.dataset.observationVisible=String(observed);canvas.dataset.referenceVisible=String(marked);canvas.dataset.frameTime=String(frame.time);canvas.dataset.timeBasis=frame.timeBasis;
  const caption=`Source frame ${number(frame.time,6)} s · ${decoded?'decoded media time':'nominal seek time; overlays hidden'}. ${kinds[track.kind]} ${observed?'shown':'hidden: no accepted position at this decoded time'}. Separate reference ${marked?'shown with its declared radius':'hidden: no visible mark at this decoded time'}. PNG hash remains producer-declared.`;
  canvas.setAttribute('aria-label',caption);$('frame-caption').textContent=caption;$('frame-empty').hidden=true;$('frame-tag').textContent=decoded?'DECODED SOURCE FRAME':'NOMINAL CLOCK';
}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save-case').addEventListener('click',()=>{if(!active)return;try{download(openMotionReferenceCase(active.raw).raw,'worldlaw-motion-reference-inputs.json');notice('Saved both raw inputs. Reopening recomputes every comparison.');}catch(error){fail(error);}});
$('save-report').addEventListener('click',()=>{if(!active)return;try{download(openMotionReferenceCase(active.raw).comparison,'worldlaw-motion-reference-report.json');notice('Exported a derived report with the source identity, explicit gaps and limitations.');}catch(error){fail(error);}});
window.addEventListener('pagehide',()=>{stopSeek();pendingLoad?.abort();source?.dispose();});
