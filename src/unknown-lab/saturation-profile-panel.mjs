import {exportSaturationInvestigation,importSaturationInvestigation,profileSettings} from './saturation-profile.mjs';
import {incompatibleSaturationChallenges} from './saturation-joint-fixture.mjs';
import {saturatedProbeExample} from './probe-saturation-fixture.mjs';
const fmt=x=>Number(x.toPrecision(5)).toString();
export function mountSaturationProfile(probePanel){
 const section=document.createElement('section');section.className='duration-investigation saturation-profile';section.setAttribute('aria-labelledby','saturation-profile-title');
 section.innerHTML=`<style>
 .saturation-profile{min-width:0;overflow-wrap:anywhere}
 .saturation-profile .profile-controls{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0}
 .saturation-profile label{display:grid;gap:6px;max-width:100%}
 .saturation-profile input{width:150px;max-width:100%}
 .saturation-profile button:focus-visible,.saturation-profile input:focus-visible,.saturation-profile summary:focus-visible{outline:3px solid #ffad5c;outline-offset:3px}
 .saturation-profile .profile-band{height:30px;background:#182c39;position:relative;margin:12px 0;border:1px solid #607988}
 .saturation-profile .profile-band span{position:absolute;top:0;height:100%;min-width:1px}
 .saturation-profile .profile-scroll{min-width:0;max-width:100%;overflow:auto}
 .saturation-profile table{width:100%;min-width:650px}
 .saturation-profile td,.saturation-profile th{text-align:left;padding:8px;border-bottom:1px solid #315460}
 .saturation-profile pre{white-space:pre-wrap;overflow-wrap:anywhere}
 </style><p class="overline">CONTINUOUS VELOCITY SCALE / RETAIN WHAT IS UNRESOLVED</p>
 <h2 id="saturation-profile-title">Could the response saturate between the offered scales?</h2>
 <p>Test one amplitude times tanh(rate / scale) across a declared continuous range. Original training measurements constrain the family; separate challenges confront a frozen training witness and the full retained outer family.</p>
 <div class="profile-controls">
 <label>Minimum scale (rad/s)<input id="profile-min" type="number" min="0.000001" value="0.05" step="any"></label>
 <label>Maximum scale (rad/s)<input id="profile-max" type="number" min="0.000001" value="1" step="any"></label>
 <label>Boundary resolution (rad/s)<input id="profile-resolution" type="number" min="0.000001" value="0.001" step="any"></label>
 <label>Maximum boxes<input id="profile-boxes" type="number" min="1" max="256" value="128"></label>
 <label>Feature evaluations per stage<input id="profile-evaluations" type="number" min="1" max="1024" value="512"></label>
 </div>
 <div class="secondary-actions"><button id="profile-run" type="button">Profile current probe measurements</button><button id="profile-example" type="button">Load authored off-grid control</button><button id="profile-joint-example" type="button">Load incompatible challenge control</button><button id="profile-open" type="button">Reopen continuous investigation</button><button id="profile-export" type="button" disabled>Export source investigation</button></div>
 <input id="profile-file" type="file" accept=".json,application/json" hidden>
 <p id="profile-status" role="status">Load a probe study above or the authored control, then run the profile.</p>
 <p id="profile-error" role="alert" tabindex="-1"></p><div id="profile-result" hidden></div>
 <p class="input-hint">Declared amplitude bounds: −100 to 100 N·m. Supported nonzero probe rate magnitude: at least 1e−8 rad/s. Covered scale intervals have a common amplitude witness; retained outer ranges can contain infeasible parameters. These are conditional screening bounds, not confidence intervals, a unique physical law or a new acquisition.</p>`;
 const anchor=document.querySelector('.probe-investigation');anchor.after(section);
 const $=id=>section.querySelector('#'+id),controls=['min','max','resolution','boxes','evaluations'];
 let worker=null,version=0,result=null,source=null,settings=null;
 function stop(){version++;worker?.terminate();worker=null;}
 function invalidate(){stop();result=null;source=null;settings=null;$('profile-result').hidden=true;$('profile-result').replaceChildren();$('profile-export').disabled=true;$('profile-status').textContent='Inputs changed. Run the profile again.';$('profile-error').textContent='';}
 function inputs(){return profileSettings({scaleMin:Number($('profile-min').value),scaleMax:Number($('profile-max').value),scaleResolution:Number($('profile-resolution').value),maxBoxes:Number($('profile-boxes').value),maxEvaluations:Number($('profile-evaluations').value)});}
 function error(e){$('profile-error').textContent=e.message||String(e);$('profile-error').focus();$('profile-status').textContent='Profile not completed.';}
 function node(tag,text,parent=$('profile-result')){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;}
 function render(r,joint){
  const out=$('profile-result');out.replaceChildren();out.hidden=false;
  node('h3',r.fit.status.replaceAll('-',' '));node('p','Source: '+(r.source??'none')+'. Finite offered comparison: '+r.fit.finiteBaseline.status+'. '+r.fit.boxes.length+' retained scale boxes; '+r.evaluations+' / '+r.fit.settings.maxEvaluations+' feature evaluations.');
  if(r.fit.reasons?.length)node('p',r.fit.reasons.join(' '));
  if(r.fit.status==='insufficient-training'){node('p',r.fit.finiteBaseline.reasons.join(' '));node('p','Scale domain not evaluated: insufficient qualified training. No scale has been excluded.');}
  else {
  const band=node('div',undefined);band.className='profile-band';band.setAttribute('role','img');band.setAttribute('aria-label','Scale range '+settings.scaleMin+' to '+settings.scaleMax+' rad/s. Green: every scale supported by a common amplitude; amber: unresolved outer range; dark: excluded.');
  for(const box of r.fit.boxes){const mark=document.createElement('span'),a=box.scale.outer[0],b=box.scale.outer[1];mark.style.left=Math.max(0,100*(a-settings.scaleMin)/(settings.scaleMax-settings.scaleMin))+'%';mark.style.width=Math.min(100,100*(b-a)/(settings.scaleMax-settings.scaleMin))+'%';mark.style.background=box.covered?'#73cbb1':'#eab95f';band.append(mark);}
  node('p',fmt(settings.scaleMin)+' to '+fmt(settings.scaleMax)+' rad/s · green: supported throughout · amber: unresolved outer range · dark: excluded');
  }
  if(r.fit.boxes.length){const range=[Math.min(...r.fit.boxes.map(b=>b.scale.outer[0])),Math.max(...r.fit.boxes.map(b=>b.scale.outer[1]))];node('p','Retained outer extent: '+range.map(fmt).join(' to ')+' rad/s. Gaps remain excluded; this extent does not fill them.');}
  node('p',r.frozenWitness?'Frozen training witness (exact): scale '+r.frozenWitness.scale+' rad/s; amplitude '+r.frozenWitness.amplitude+' N·m. It was selected before viewing challenges.':'No training witness certified within the work budget.');
  if(r.fit.budgetExhausted||r.challenges.some(c=>c.status==='budget-unresolved'))node('p','Work budget reached. Unvisited scale ranges remain in the outer family; incomplete challenge rows make no exclusion claim.');
  node('h4','Separate challenge measurements');
  if(!r.challenges.length)node('p','No separate challenges supplied.');
  else{const scroll=node('div');scroll.className='profile-scroll';const table=node('table',undefined,scroll),head=node('tr',undefined,node('thead',undefined,table));for(const h of ['Run','Rate (rad/s)','Observed screen (N·m)','Entire outer family','Frozen witness'])node('th',h,head);
   const body=node('tbody',undefined,table);for(const c of r.challenges){const tr=node('tr',undefined,body);for(const value of [c.id,fmt(c.probe.rate),c.observed.map(fmt).join(' to '),c.status,c.witnessStatus??'not evaluated'])node('td',value,tr);}}
  node('p',r.interpretation);const details=node('details');node('summary','Inspect exact retained boxes, amplitude witnesses and complete challenge bands',details);node('pre',JSON.stringify(r,null,2),details);
  node('h3','One parameter pair across all separate challenges');
  const jointMessages={
   'jointly-excluded':'No single amplitude and velocity scale satisfies all qualified original training and challenge screens in the declared domain.',
   'joint-witness':'At least one common amplitude and scale satisfies all training and challenge screens. This post-training consistency witness does not replace the frozen training witness.',
   'budget-unresolved':'The joint screen exhausted its separate work budget. Pending outer boxes remain unresolved; no family exclusion is claimed.',
   'outer-boxes-only':'Outer boxes remain, but no joint consistency witness was certified at the declared resolution.',
   'untested':'No separate challenges were supplied; no joint test was made.',
   'insufficient-training':'Insufficient qualified training; no joint family inference was made.',
   'unqualified-challenges':'At least one challenge lacks counterbalanced acquisition orders. The joint screen is not qualified.',
   'unsupported-challenges':'At least one challenge rate is outside the supported numerical range. The joint screen was not evaluated.',
   'unavailable':'The joint computation could not complete. The separately qualified training report is retained.'};
  node('p',jointMessages[joint.status]??'Joint screen unavailable.');
  if(joint.evaluations!==undefined)node('p','Joint verification: '+joint.evaluations+' / '+settings.maxEvaluations+' feature evaluations in its separate budget; '+joint.boxes.length+' retained boxes.');
  if(joint.budgetExhausted&&joint.status==='joint-witness')node('p','A joint witness is certified, but the full joint parameter range remains unresolved because the work budget ended.');
  if(joint.error)node('p',joint.error);
  const jointDetails=node('details');node('summary','Inspect post-training joint consistency and original run roles',jointDetails);const jp=node('pre',JSON.stringify(joint,null,2),jointDetails);jp.id='profile-joint-report';

 }
 function run(){
  invalidate();try{source=probePanel.getStudy();if(!source)throw Error('Load a probe study first.');settings=inputs();const token=version;
   $('profile-status').textContent='Computing bounded continuous scale profile…';
   worker=new Worker(new URL('./saturation-profile-worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=e=>{if(token!==version)return;worker.terminate();worker=null;if(e.data.error){error(Error(e.data.error));return;}result=e.data.result;render(result,e.data.joint);$('profile-export').disabled=false;$('profile-status').textContent='Profile complete. Training and separate challenge screens are shown below.';};
   worker.onerror=e=>{if(token!==version)return;stop();error(Error(e.message||'Profile worker failed.'));};
   worker.postMessage({study:source,settings});
  }catch(e){error(e);}
 }
 controls.forEach(id=>$('profile-'+id).addEventListener('input',invalidate));
 document.addEventListener('worldlaw-probe-study-change',invalidate);
 $('profile-run').onclick=run;
 $('profile-example').onclick=()=>{try{probePanel.adopt(saturatedProbeExample(.28));run();}catch(e){error(e);}};
 $('profile-joint-example').onclick=()=>{try{probePanel.adopt(incompatibleSaturationChallenges());run();}catch(e){error(e);}};
 $('profile-open').onclick=()=>$('profile-file').click();
 $('profile-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const token=version;try{if(file.size>4000000)throw Error('Use investigation JSON below 4 MB.');const input=importSaturationInvestigation(await file.text());if(token!==version)return;
  probePanel.adopt(input.study);for(const [id,key] of [['min','scaleMin'],['max','scaleMax'],['resolution','scaleResolution'],['boxes','maxBoxes'],['evaluations','maxEvaluations']])$('profile-'+id).value=input.settings[key];run();
 }catch(err){if(token===version)error(err);}finally{e.target.value='';}};
 $('profile-export').onclick=()=>{if(!result||!source)return;const url=URL.createObjectURL(new Blob([exportSaturationInvestigation(source,settings)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-continuous-saturation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return {invalidate};
}
