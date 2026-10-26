import {RELEASE_SCHEMA,defaultReleaseSettings,readReleaseSettings,readViscousReleaseStudy,exportViscousReleaseStudy,proposeViscousReleases,releaseDynamicsInputs} from './viscous-release.mjs';
import {MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION} from './dynamics.mjs';

const NS='http://www.w3.org/2000/svg',fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toString():'—';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
const numeric=[['duration','duration'],['samples','samples'],['step','maxStep'],['angle-tolerance','positionTolerance'],['rate-tolerance','rateTolerance'],['minimum','minimumSeparation'],['tie','tieTolerance']];

export function mountViscousReleases(root,{getSources,applyRelease}){
 root.innerHTML=`<details id="release-lab"><summary>Which permitted release could separate these loss hypotheses?</summary>
 <div class="inertia-heading"><div><p class="eyebrow">CHOOSE A MORE INFORMATIVE START.</p><h3>Compare every permitted release.</h3></div><p>Both loss fits predict motion from rest at each explicitly permitted angle pair. The proposal keeps every fitted response law, including those ranked lower on training.</p></div>
 <p class="small">For each response law, measure the largest predicted angle separation over the common output times. Rank a release by its smallest such separation across all response laws. This proposes a whole observation course; it does not identify a loss family or an optimal single reading time.</p>
 <div class="inertia-actions"><button id="release-current" type="button">Use current source pair</button><button id="release-open" type="button">Open release inputs</button><button id="release-save" type="button" disabled>Save release inputs</button></div>
 <input id="release-file" type="file" accept=".json,application/json" hidden aria-label="Choose original release study">
 <p id="release-source" class="inertia-source">Uses the current response notebook and original viscous training source.</p><p id="release-correspondence" class="small"></p>
 <form id="release-form" novalidate>
 <label class="motion-consent"><input id="release-paired" type="checkbox"><span>I declare that the response and motion sources describe the same apparatus, angle coordinates and torque conventions.</span></label>
 <div class="inertia-settings"><label>Observe for · s<input id="release-duration" type="number" step="any"></label><label>Maximum step · s<input id="release-step" type="number" step="any"></label><button id="release-run" type="submit">Compare all permitted releases</button></div>
 <details><summary>Numerical settings and separation threshold</summary><div class="inertia-settings"><label>Common output samples<input id="release-samples" type="number" min="2" max="1001" step="1"></label><label>Angle step tolerance · rad<input id="release-angle-tolerance" type="number" step="any"></label><label>Rate step tolerance · rad/s<input id="release-rate-tolerance" type="number" step="any"></label><label>Minimum useful separation · rad<input id="release-minimum" type="number" step="any"></label><label>Tie tolerance · rad<input id="release-tie" type="number" step="any"></label></div><p class="small">These are declared numerical comparison settings. They do not estimate sensor uncertainty, measurement coverage or a physical discrimination threshold.</p></details>
 </form>
 <p id="release-error" role="alert" tabindex="-1" hidden></p><p id="release-status" role="status" aria-live="polite">No release comparison has been run.</p>
 <div id="release-results" hidden><div class="table-wrap"><table><caption>Complete permitted set, with every numerical refusal retained</caption><thead><tr><th>Initial angles · rad</th><th>Smallest peak separation</th><th>Receiving result</th><th>Inspect</th></tr></thead><tbody id="release-rows"></tbody></table></div>
 <figure class="viscous-instrument"><figcaption id="release-caption"></figcaption><div id="release-plot" role="img" aria-label="Predicted separation between the loss hypotheses for each response law"></div></figure><div id="release-legend" class="legend"></div>
 <p id="release-detail" class="small"></p><p id="release-work" class="small"></p>
 <div class="inertia-settings"><label class="release-family-choice">Loss hypothesis for the motion experiment<select id="release-family"><option value="">Choose a fitted loss hypothesis</option><option value="diagonal">Independent loss</option><option value="symmetric">Symmetric cross loss</option></select></label><button id="release-apply" type="button" disabled>Copy this release into the motion experiment</button></div>
 <p id="release-adoption" class="small">Choose a loss hypothesis explicitly. Copying fills the initial state, fitted numerical values and common simulation settings; review the motion declaration before running.</p>
 <details><summary>Inspect training and complete comparison accounting</summary><pre id="release-account" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details></div>
 <p class="inertia-qualification">The notebook permits quasi-static positions. Dynamic reachability, safety and observability are unestablished. Every trajectory is conditional on its response law and training-fitted loss. Leaving observed position ranges is reported. Step agreement is not an error bound; both runs can miss behavior between retained times. Separate observations never choose this proposal.</p>
 </details>`;
 const $=id=>root.querySelector('#release-'+id);
 let result=null,selected=null,owned=null,generation=0;
 function error(e){$('error').textContent=e.message||String(e);$('error').hidden=false;$('error').focus();}
 function invalidate(message){result=null;selected=null;$('results').hidden=true;$('save').disabled=true;$('apply').disabled=true;$('status').textContent=message;$('error').hidden=true;}
 function setSettings(s){for(const[id,k]of numeric)$(id).value=s[k];}
 function settings(){return readReleaseSettings({...defaultReleaseSettings(),...Object.fromEntries(numeric.map(([id,k])=>[k,$(id).valueAsNumber]))});}
 function source(s=settings()){
  const pair=owned??getSources();return readViscousReleaseStudy({schema:RELEASE_SCHEMA,response:pair.response,viscous:pair.viscous,settings:s});
 }
 function currentMatches(){
  if(!result)return false;
  try{const pair=getSources(),now=readViscousReleaseStudy({schema:RELEASE_SCHEMA,...pair,settings:result.source.settings});return JSON.stringify(now.response)===JSON.stringify(result.source.response)&&JSON.stringify(now.viscous)===JSON.stringify(result.source.viscous);}catch{return false;}
 }
 function syncApply(){
  const match=currentMatches(),release=result?.releases.find(r=>r.index===selected);
  $('apply').disabled=!release||release.status!=='screened'||!$('family').value||!$('paired').checked||!match;
  $('adoption').textContent=match?'Choose a loss hypothesis explicitly. Copying fills the initial state, fitted numerical values and common simulation settings; review the motion declaration before running.':'This reopened comparison uses its own original sources. Applying requires the same response and viscous sources to be current in their maintained panels; source replay itself does not replace them.';
 }
 function draw(){
  const release=result?.releases.find(r=>r.index===selected);if(!release)return;
  $('caption').textContent=`Release [${release.position.map(fmt).join(', ')}] rad, from rest · the two loss hypotheses under each response law`;
  const colors=['#c7a4ff','#ffc65d','#64e0ce'],curves=release.comparisons.filter(c=>c.curve.length);
  const width=root.getBoundingClientRect().width,W=width<700?Math.max(260,width):880,H=300,left=64,right=20,top=20,bottom=55;
  const max=Math.max(.000001,...curves.flatMap(c=>c.curve.map(r=>r.separation)))*1.08,duration=result.source.settings.duration;
  const x=t=>left+t/duration*(W-left-right),y=v=>H-bottom-v/max*(H-top-bottom),picture=svg('svg',{viewBox:`0 0 ${W} ${H}`,style:'width:100%;height:auto;display:block',role:'presentation'});
  for(let i=0;i<=4;i++){const v=max*i/4,t=duration*i/4;picture.append(svg('line',{x1:left,x2:W-right,y1:y(v),y2:y(v),stroke:'#35475e','stroke-dasharray':'3 5'}),svg('text',{x:left-8,y:y(v)+4,'text-anchor':'end',fill:'currentColor','font-size':12},Number(v.toPrecision(3)).toString()),svg('text',{x:x(t),y:H-bottom+21,'text-anchor':'middle',fill:'currentColor','font-size':12},Number(t.toPrecision(3)).toString()));}
  $('legend').replaceChildren();
  curves.forEach((c,i)=>{picture.append(svg('path',{d:c.curve.map((r,j)=>(j?'L':'M')+x(r.time)+' '+y(r.separation)).join(' '),fill:'none',stroke:colors[i%3],'stroke-width':2.7,'stroke-dasharray':c.screened?'':'6 4','data-release-trace':c.modelId}));const span=el('span'),mark=el('i');mark.style.background=colors[i%3];span.append(mark,el('span',c.label+(c.screened?'':' · unresolved')));$('legend').append(span);});
  picture.append(svg('text',{x:(left+W-right)/2,y:H-8,'text-anchor':'middle',fill:'currentColor','font-size':13},'Common output time · s'),svg('text',{x:15,y:(top+H-bottom)/2,transform:`rotate(-90 15 ${(top+H-bottom)/2})`,'text-anchor':'middle',fill:'currentColor','font-size':13},'Angle separation · rad'));
  $('plot').replaceChildren(curves.length?picture:el('p','No complete pair of trajectories is available for this release.'));
  $('detail').textContent=release.comparisons.map(c=>`${c.label}: ${c.diagonal.status} / ${c.symmetric.status}; sampled peak ${fmt(c.peak?.separation)} rad at ${fmt(c.peak?.time)} s. ${[c.diagonal,c.symmetric].some(r=>r.domainStatus==='outside_observed_range')?'Leaves the observed position range. ':''}${[c.diagonal,c.symmetric].filter(r=>r.failure).map(r=>r.failure.message).join(' ')}`).join(' ');
  for(const button of $('rows').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.index)===selected));
  syncApply();
 }
 function render(){
  $('results').hidden=false;$('save').disabled=false;$('rows').replaceChildren();
  for(const r of result.releases){const row=el('tr',undefined,{'data-release-index':r.index,'data-release-status':r.status,'data-release-proposed':String(result.proposedIndices.includes(r.index))}),button=el('button','Inspect',{type:'button','data-index':r.index});button.addEventListener('click',()=>{selected=r.index;draw();});
   row.append(el('th',r.position.map(fmt).join(', '),{scope:'row'}),el('td',r.score===null?'—':fmt(r.score)+' rad',{'data-label':'Smallest peak'}),el('td',r.status==='screened'?(result.proposedIndices.includes(r.index)?'Proposed'+(result.proposedIndices.length>1?' · tied':''):'Screened'):r.status.replaceAll('_',' '),{'data-label':'Receiving'}),el('td',undefined,{'data-label':'Inspect'}));row.lastChild.append(button);$('rows').append(row);}
  const text={proposed:`${result.proposedIndices.length} proposed release${result.proposedIndices.length===1?'':'s'}; ${result.releases.length} permitted starts retained.`,not_separated:'No screened release exceeds the declared minimum separation. No informative release is proposed.',unresolved:'No release passed the complete response and numerical comparison. No proposal.',unsupported_training:'Both loss families and an executable response are required. Unsupported training is retained; no release is proposed.'};
  $('status').textContent=text[result.status]+' Neither loss family is selected automatically.';
  $('source').textContent=`${owned?'Own reopened sources':'Current source pair'} · response: ${result.source.response.source.label} · motion training: ${result.source.viscous.training.record.source.label}. Separate checks are preserved and ignored by the proposal.`;
  $('correspondence').textContent=result.source.settings.correspondence;
  $('work').textContent=`${result.diagnostics.reservedSteps} / ${result.diagnostics.stepBudget} steps reserved across the complete release × loss × response × two-step comparison. ${result.training.quadratureSegments} training quadrature segments. ${result.training.responseAdequacy==='residual_mismatch'?'The response family already has substantial training mismatch.':''}`;
  $('account').textContent=JSON.stringify({training:result.training,refusedModels:result.refusedModels,diagnostics:result.diagnostics},null,2);
  selected=result.proposedIndices[0]??result.rankedIndices[0]??result.releases[0]?.index;$('family').value='';draw();
 }
 $('form').addEventListener('submit',event=>{event.preventDefault();generation++;invalidate('Comparing the complete permitted set…');try{if(!$('paired').checked)throw new Error('Declare the source pairing before proposing a release.');result=proposeViscousReleases(source());render();}catch(e){invalidate('No current release comparison. Correct the sources or settings.');error(e);}});
 $('form').addEventListener('input',event=>{generation++;if(event.target.id==='release-paired'){syncApply();return;}invalidate('Settings changed. Compare every permitted release again.');});
 $('family').addEventListener('change',syncApply);
 $('current').addEventListener('click',()=>{generation++;owned=null;$('paired').checked=false;invalidate('Using the current response and viscous source pair. Declare their correspondence and compare.');$('source').textContent='Current source pair.';});
 $('apply').addEventListener('click',()=>{try{syncApply();if($('apply').disabled)return;const r=result.releases.find(r=>r.index===selected),family=$('family').value,parameters=result.training.families[family],input=releaseDynamicsInputs(parameters,r.position,result.source.settings);if(family==='diagonal'){input.schema=MATRIX_INPUT_SCHEMA;input.interpretation=MATRIX_INTERPRETATION;delete input.dampingCross;}applyRelease(input,`${family==='diagonal'?'Independent':'Symmetric'} loss from ${result.source.viscous.training.record.source.label}`);$('paired').checked=false;syncApply();}catch(e){error(e);}});
 $('save').addEventListener('click',()=>{try{if(!result)throw new Error('Compare first.');const text=exportViscousReleaseStudy(result.source),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=el('a',undefined,{href:url,download:'worldlaw-viscous-release.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){error(e);}});
 $('open').addEventListener('click',()=>$('file').click());
 $('file').addEventListener('change',async()=>{const file=$('file').files?.[0];$('file').value='';if(!file)return;const ticket=++generation;invalidate('Opening original release inputs…');try{if(file.size>10*1024*1024)throw new Error('Release study exceeds 10 MiB.');const text=await file.text();if(ticket!==generation)return;const original=readViscousReleaseStudy(text),computed=proposeViscousReleases(original);owned={response:original.response,viscous:original.viscous};setSettings(original.settings);$('paired').checked=false;result=computed;render();}catch(e){if(ticket===generation)error(e);}});
 let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});$('lab').addEventListener('toggle',()=>{if($('lab').open)draw();});
 setSettings(defaultReleaseSettings());
 return {sourceChanged(){generation++;owned=null;$('paired').checked=false;invalidate('Source pair changed. Declare its correspondence and compare the current permitted releases.');}};
}
