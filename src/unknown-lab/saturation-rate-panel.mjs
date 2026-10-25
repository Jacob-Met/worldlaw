import {canonicalSaturationSource} from './saturation-rate-acquisition.mjs';
import {saturatedRatePlanningExample,SATURATION_RATE_EXAMPLE_SETTINGS} from './saturation-rate-fixture.mjs';
const fmt=x=>Number(x.toPrecision(5)).toString(),same=(a,b)=>canonicalSaturationSource(a)===canonicalSaturationSource(b);
export function mountSaturationRatePlanner({parent,controller,getProfileSettings,setProfileSettings}){
 const host=document.createElement('section');host.className='saturation-rate-choice';host.setAttribute('aria-labelledby','rate-choice-title');
 host.innerHTML=`<h3 id="rate-choice-title">Which offered rate can distinguish two scale ranges?</h3>
 <p>Compare two separated velocity-scale windows using training measurements only. Every retained box keeps its amplitude–scale association. Scales between or outside the two windows remain untested.</p>
 <div class="profile-controls">
 <label>First window minimum<input id="rate-low-min" type="number" step="any" value=".05"></label><label>First window maximum<input id="rate-low-max" type="number" step="any" value=".2"></label>
 <label>Second window minimum<input id="rate-high-min" type="number" step="any" value=".5"></label><label>Second window maximum<input id="rate-high-max" type="number" step="any" value="1"></label>
 <label>Future response radius (N·m)<input id="rate-radius" type="number" step="any" min="0" value=".003"></label><label>Effort budget<input id="rate-budget" type="number" step="any" min="0" value="1"></label></div>
 <p>Scale domain, boundary resolution and work limits use the continuous-profile controls above. Effort and physical feasibility are declarations. No command is sent to hardware.</p>
 <div class="profile-scroll" tabindex="0" role="region" aria-label="Offered saturation probe states"><table><caption>Fixed preparation and command come from the original study. Declare every offered angle, rate and cost.</caption><thead><tr><th>Offer</th><th>Angle (rad)</th><th>Rate (rad/s)</th><th>Effort</th><th></th></tr></thead><tbody id="rate-offers"></tbody></table></div>
 <div class="secondary-actions"><button id="rate-add" type="button">Add offered state</button><button id="rate-compare" type="button">Compare complete offered states</button><button id="rate-example" type="button">Load authored high-rate ambiguity</button></div>
 <p id="rate-status" role="status">No prospective comparison has been run.</p><p id="rate-error" role="alert" tabindex="-1"></p><div id="rate-comparison" hidden></div>
 <h4>Freeze a manual measurement request</h4>
 <div class="profile-controls"><label>New run identifier<input id="rate-run-id" value="future-rate"></label><label>Matched pairs<input id="rate-pairs" type="number" min="8" max="128" value="16"></label><label>Preparation and measurement arrangement<input id="rate-arrangement" value="Fixed preparation and paired torque readout"></label></div>
 <p>At least four pairs in each acquisition order are required. The frozen request retains the exact preparation/recovery, command, angle, rate, declared source and original study. It contains no future readings.</p>
 <div class="secondary-actions"><button id="rate-freeze" type="button" disabled>Freeze selected measurement request</button><button id="rate-export" type="button" disabled>Export original request or receipt</button><button id="rate-open" type="button">Reopen request or receipt</button></div>
 <input id="rate-file" type="file" accept=".json,application/json" hidden>
 <details><summary>Inspect the frozen full probe protocol</summary><pre id="rate-protocol">No request frozen.</pre></details>
 <div class="secondary-actions"><button id="rate-observe" type="button" disabled>Receive separate observation file</button><label>Authored outcome control<select id="rate-authored-scale"><option value=".1">First window: scale 0.1</option><option value=".5">Second window: scale 0.5</option><option value=".3">Untested gap: scale 0.3</option></select></label><button id="rate-authored" type="button" disabled>Receive authored outcome</button></div>
 <input id="rate-observation-file" type="file" accept=".json,application/json" hidden>
 <p class="input-hint">Observation files contain the frozen protocol and one new challenge run with original matched-pair readings. Authored controls are available only for synthetic requests and are never used to rank rates.</p>
 <div id="rate-received" hidden></div><button id="rate-adopt" type="button" disabled>Add received challenge to the probe study</button>`;
 parent.append(host);const $=id=>host.querySelector('#'+id);
 let version=0,worker=null,plan=null,request=null,result=null,source=null,config=null,serial=5;
 const fields=['low-min','low-max','high-min','high-max','radius','budget','run-id','pairs','arrangement'];
 function controls(){
  $('rate-freeze').disabled=!!worker||!plan?.selected;$('rate-export').disabled=!!worker||!request;
  $('rate-observe').disabled=!!worker||!request;$('rate-authored').disabled=!!worker||request?.protocol.source!=='synthetic';
  $('rate-adopt').disabled=!!worker||!result;
 }
 function retire(){version++;worker?.terminate();worker=null;}
 function invalidate(){retire();plan=request=result=source=config=null;$('rate-comparison').hidden=true;$('rate-comparison').replaceChildren();$('rate-received').hidden=true;$('rate-received').replaceChildren();$('rate-protocol').textContent='No request frozen.';$('rate-error').textContent='';$('rate-status').textContent='Inputs changed. Recompute before freezing or receiving.';controls();}
 function error(e){$('rate-error').textContent=e.message||String(e);$('rate-error').focus();controls();}
 function value(id){const text=$(id).value;if(!text.trim())throw Error('Complete every declaration.');return Number(text);}
 function settings(){return {settings:getProfileSettings(),windows:[[value('rate-low-min'),value('rate-low-max')],[value('rate-high-min'),value('rate-high-max')]],contrastRadius:value('rate-radius'),budget:value('rate-budget'),
  probes:[...$('rate-offers').children].map(tr=>({id:tr.dataset.id,...Object.fromEntries([...tr.querySelectorAll('input')].map(e=>{if(!e.value.trim())throw Error('Complete each offered state.');return [e.dataset.field,Number(e.value)];}))}))};}
 function add(p=null){
  if(!p){let id;do{id='rate-'+serial++;}while([...$('rate-offers').children].some(tr=>tr.dataset.id===id));p={id,position:.6,rate:0,cost:1};}
  if($('rate-offers').children.length>=8)throw Error('Offer at most eight complete states.');
  const tr=document.createElement('tr');tr.dataset.id=p.id;const th=document.createElement('th');th.scope='row';th.textContent=p.id;tr.append(th);
  for(const field of ['position','rate','cost']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.step='any';input.value=p[field];input.dataset.field=field;input.setAttribute('aria-label',p.id+' '+field);input.style.width='7rem';input.addEventListener('input',invalidate);td.append(input);tr.append(td);}
  const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove '+p.id);button.onclick=()=>{tr.remove();invalidate();};td.append(button);tr.append(td);$('rate-offers').append(tr);
 }
 function configure(s){for(const [id,v]of [['low-min',s.windows[0][0]],['low-max',s.windows[0][1]],['high-min',s.windows[1][0]],['high-max',s.windows[1][1]],['radius',s.contrastRadius],['budget',s.budget]])$('rate-'+id).value=v;
  $('rate-offers').replaceChildren();s.probes.forEach(add);serial=0;while(s.probes.some(p=>p.id==='rate-'+serial))serial++;
 }
 function node(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;}
 function renderPlan(){
  const out=$('rate-comparison');out.replaceChildren();out.hidden=false;
  node('h4',plan.status.replaceAll('-',' '),out);
  node('p','Training source: '+(plan.source??'none')+'. Preparation '+JSON.stringify(plan.preparation)+'. No challenge outcome selected this rate.',out);
  node('p','Untested scale ranges: '+plan.uncomparedScaleRanges.map(x=>(x.lowerClosed?'[':'(')+fmt(x.lower)+', '+fmt(x.upper)+(x.upperClosed?']':')')).join('; ')+' rad/s.',out);
  const scroll=node('div',undefined,out);scroll.className='profile-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Complete saturation rate forecasts');
  const table=node('table',undefined,scroll),head=node('tr',undefined,node('thead',undefined,table));for(const t of ['Offer','Command / angle / rate','Certified margin (N·m)','Effort','Outside training range','Status'])node('th',t,head);
  const body=node('tbody',undefined,table);for(const c of plan.courses){const tr=node('tr',undefined,body);for(const t of [c.id,[c.probe.command,c.probe.position,c.probe.rate].map(fmt).join(' / '),fmt(c.margin.outer[0]),fmt(c.cost),Object.entries(c.extrapolation).filter(([,v])=>v).map(([key])=>key).join(', ')||'none',!c.affordable?'over budget':c.separates?(c.id===plan.selected?'selected':'separated'):'unresolved'])node('td',t,tr);}
  node('p',plan.qualification,out);const details=node('details',undefined,out);node('summary','Inspect every retained box, witness and forecast union',details);const pre=node('pre',JSON.stringify(plan,null,2),details);pre.id='rate-plan-json';
 }
 function renderReceipt(){
  const out=$('rate-received');out.replaceChildren();out.hidden=!result;if(!result)return;
  node('h4','Separate observation: '+result.qualification.status,out);
  node('p','Observed paired contrast '+fmt(result.observed.difference)+' N·m; screen ['+result.observed.interval.map(fmt).join(', ')+']. Realized radius '+fmt(result.qualification.actualRadius)+'; planned '+fmt(result.qualification.plannedRadius)+'.',out);
  for(const w of result.windows)node('p','Window '+(w.index+1)+' ['+w.window.map(fmt).join(', ')+']: '+w.status,out);
  for(const reason of result.qualification.reasons)node('p',reason,out);node('p',result.interpretation,out);
  const details=node('details',undefined,out);node('summary','Inspect original received measurement and frozen comparison',details);const pre=node('pre',JSON.stringify(result,null,2),details);pre.id='rate-receipt-json';
 }
 function current(){const s=controller.getStudy();if(!source||!s||!same(s,source))throw Error('The source study changed. Recompute and freeze a new request.');return s;}
 function download(text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=result?'worldlaw-saturation-receipt.json':'worldlaw-saturation-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function start(action,payload){
  retire();const token=version;$('rate-error').textContent='';$('rate-status').textContent='Computing '+action+' from original inputs…';
  worker=new Worker(new URL('./saturation-rate-worker.mjs',import.meta.url),{type:'module'});controls();
  worker.onmessage=({data})=>{if(token!==version)return;worker.terminate();worker=null;
   if(data.error){error(Error(data.error));$('rate-status').textContent='Operation refused; no new result received.';return;}
   if(action==='compare'){plan=data.value;renderPlan();}
   else if(action==='freeze'){request=data.value;result=null;$('rate-protocol').textContent=JSON.stringify(request.protocol,null,2);renderReceipt();}
   else if(action==='receive'||action==='authored'){result=data.value;renderReceipt();}
   else if(action==='export')download(data.value);
   else if(action==='reopen'){
    const opened=data.value;controller.adopt(opened.request.study);setProfileSettings(opened.request.settings.settings);configure(opened.request.settings);
    for(const [id,key]of [['run-id','runId'],['pairs','pairs'],['arrangement','arrangement']])$('rate-'+id).value=opened.request.protocol[key];
    source=controller.getStudy();config=opened.request.settings;plan=opened.plan;request=opened.request;result=opened.result;
    renderPlan();$('rate-protocol').textContent=JSON.stringify(request.protocol,null,2);renderReceipt();
   }
   $('rate-status').textContent=action==='compare'?'Complete offered comparison ready.':action==='freeze'?'Original full-state request frozen; no observation acquired.':action==='reopen'?'Original inputs replayed; saved answers were ignored.':action==='export'?'Original source request or receipt exported.':'Separate observation screened against both frozen windows. Study unchanged until explicitly added.';
   controls();
  };
  worker.onerror=e=>{if(token!==version)return;retire();error(Error(e.message||'Acquisition worker failed.'));};
  worker.postMessage({action,...payload});
 }
 function attempt(fn){try{fn();}catch(e){error(e);}}
 function compare(){invalidate();source=controller.getStudy();if(!source)throw Error('Load a probe study first.');config=settings();start('compare',{study:source,settings:config});}
 fields.forEach(id=>$('rate-'+id).addEventListener('input',invalidate));
 $('rate-add').onclick=()=>attempt(()=>{add();invalidate();});
 $('rate-compare').onclick=()=>attempt(compare);
 $('rate-example').onclick=()=>attempt(()=>{controller.adopt(saturatedRatePlanningExample());setProfileSettings(SATURATION_RATE_EXAMPLE_SETTINGS.settings);configure(SATURATION_RATE_EXAMPLE_SETTINGS);compare();});
 $('rate-freeze').onclick=()=>attempt(()=>{current();start('freeze',{study:source,settings:config,protocol:{runId:$('rate-run-id').value,arrangement:$('rate-arrangement').value,pairs:value('rate-pairs')}});});
 $('rate-export').onclick=()=>attempt(()=>{current();start('export',{request,observation:result?.observation??null});});
 $('rate-open').onclick=()=>$('rate-file').click();
 $('rate-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const token=version;try{if(file.size>5000000)throw Error('Use JSON below 5 MB.');const text=await file.text();if(token===version)start('reopen',{text});}catch(err){if(token===version)error(err);}finally{e.target.value='';}};
 $('rate-observe').onclick=()=>$('rate-observation-file').click();
 $('rate-observation-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;retire();const token=version;result=null;renderReceipt();controls();$('rate-error').textContent='';$('rate-status').textContent='Loading separate original observation…';try{current();if(file.size>2000000)throw Error('Use observation JSON below 2 MB.');const observation=JSON.parse(await file.text());if(token!==version)return;current();result=null;renderReceipt();start('receive',{request,observation,study:source});}catch(err){if(token===version)error(err);}finally{e.target.value='';}};
 $('rate-authored').onclick=()=>attempt(()=>{current();result=null;renderReceipt();start('authored',{request,study:source,scale:Number($('rate-authored-scale').value)});});
 $('rate-authored-scale').onchange=()=>{retire();result=null;renderReceipt();controls();$('rate-status').textContent='Authored outcome control changed; no new observation received.';};
 $('rate-adopt').onclick=()=>attempt(()=>{current();const receivedStudy=result.study;controller.adopt(receivedStudy);$('rate-status').textContent='Received challenge added explicitly. Recompute before a new request.';});
 configure(SATURATION_RATE_EXAMPLE_SETTINGS);controls();return {invalidate};
}
