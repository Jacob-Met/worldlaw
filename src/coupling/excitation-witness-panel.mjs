import {EXCITATION_SCHEMA,inspectExcitation,exportExcitation,importExcitation} from './excitation-witness.mjs';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function mountExcitationWitness(host,{getNotebook}){
 let generation=0,accepted=null;
 const heading=el('h2','Which responses does this fitting support fail to distinguish?'),intro=el('p','Construct explicit affine response hypotheses when the maintained fitter refuses a family for insufficient excitation. This is a source-support equality check, not physical validation or a bounded feasible-law search.');
 const controls=el('div'),label=el('label','Illustrative coefficient amplitude (N·m/rad) '),amplitude=el('input');amplitude.type='number';amplitude.step='any';amplitude.value='1';amplitude.id='excitation-amplitude';label.append(amplitude);
 const run=el('button','Inspect exact fitting-support witnesses');run.id='excitation-run';run.type='button';const save=el('button','Save source question');save.id='excitation-save';save.type='button';save.disabled=true;
 const openLabel=el('label','Open saved source question '),open=el('input');open.type='file';open.accept='.json,application/json';open.id='excitation-open';openLabel.append(open);
 const sourceDetails=el('details'),summary=el('summary','Retained notebook and declared amplitude'),input=el('textarea');input.id='excitation-input';input.rows=8;input.style.width='100%';input.style.boxSizing='border-box';input.setAttribute('aria-label','Input-only excitation question');sourceDetails.append(summary,input);
 const status=el('p');status.id='excitation-status';status.setAttribute('role','status');const result=el('div');result.id='excitation-result';
 controls.append(label,run,save,openLabel);host.append(heading,intro,controls,sourceDetails,status,result);
 function clear(message){generation++;accepted=null;save.disabled=true;result.replaceChildren();status.textContent=message;}
 function sourceChanged(){clear('Source changed. Recompute from this notebook; prior witnesses are cleared.');input.value=JSON.stringify({schema:EXCITATION_SCHEMA,notebook:getNotebook(),amplitude:Number(amplitude.value)||1,amplitudeUnits:'N·m/rad'},null,2);}
 amplitude.oninput=()=>{clear('Amplitude changed. Recompute before saving.');try{const raw=JSON.parse(input.value);raw.amplitude=Number(amplitude.value);input.value=JSON.stringify(raw,null,2);}catch{}};
 input.oninput=()=>clear('Source question edited. Recompute before saving.');
 run.onclick=()=>{clear('Checking admitted materialized coefficients and every fitting coordinate…');try{
  const r=inspectExcitation(JSON.parse(input.value));accepted=r.input;amplitude.value=String(r.input.amplitude);save.disabled=false;
  const explanations={
   'exact-support-witnesses':`${r.witnesses.length===2?'Two':'One'} distinct response ${r.witnesses.length===2?'hypotheses match':'hypothesis matches'} every fitting coordinate exactly.`,
   'no-rank-refusal':'The maintained fitter has not refused a family for insufficient excitation. This inspector offers no support witness.',
   'no-executable-base':'No executable fitted response is available as a starting point for this construction.',
   'single-coordinate-support':'All fitting rows use one coordinate pair. This line-support construction needs two distinct pairs.',
   'no-exact-line-certificate':'The fitting coordinates do not pass the exact line-support check, even though the numerical fitter refused a family.',
   'materialization-refused':'The constructed coefficients could not retain exact fitting equality after rounding. No witness is published.'
  };
  status.textContent=explanations[r.status];
  result.append(el('p',`${r.fittingIds.length} fitting rows including revisions; ${r.separateCheckCount} separate checks retained but unused to construct witnesses.`));
  if(!r.witnesses.length)result.append(el('p','Numerical rank refusal alone does not certify an exact line, and rounded coefficients must pass exact source equality.'));
  for(const witness of r.witnesses){
   const section=el('section');section.append(el('h3',`${witness.family} declared response hypothesis`),el('p',`Exactly equal predictions at all ${witness.exactEqualFittingRows} fitting coordinates. Amplitude ${r.input.amplitude} N·m/rad; it is an illustration, not an estimated parameter bound.`));
   const table=el('table'),head=el('tr');for(const text of ['Permitted angle pair (rad)','This witness direction'])head.append(el('th',text));table.append(head);
   for(const contrast of witness.contrasts){const row=el('tr');row.append(el('td',JSON.stringify(contrast.q)),el('td',contrast.separates?'Separates exactly; detectability unassessed':'Same response exactly'));table.append(row);}section.append(table);
   const details=el('details');details.append(el('summary','Actual admitted coefficients and exact torque contrasts'),el('pre',JSON.stringify({model:witness.model,contrasts:witness.contrasts},null,2)));details.querySelector('pre').style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';section.append(details);result.append(section);
  }
  if(r.rejected.length){const reasons={'model-admission':'the maintained model API did not admit these coefficients','amplitude-rounded-away':'rounding removed the requested coefficient change','materialized-coefficients-break-exact-equality':'rounded coefficients changed a fitting prediction'};result.append(el('p',`Refused constructions: ${r.rejected.map(x=>`${x.family}: ${reasons[x.reason]}${x.rowId?` at observation ${x.rowId}`:''}`).join('; ')}`));}
  result.append(el('p','Use the existing acquisition controls for any separately acquired response. A new off-support coordinate can remove this displayed direction; it does not establish global identification. Source-only save preserves the original notebook, including its untouched challenge and revision provenance.'));
 }catch(error){accepted=null;save.disabled=true;result.replaceChildren();status.textContent=`Refused: ${error.message}`;}};
 open.onchange=async()=>{const file=open.files?.[0];open.value='';if(!file)return;clear('Reading independent saved source question…');const ticket=generation;try{if(file.size>3*1024*1024)throw Error('Question exceeds3MiB.');const next=importExcitation(await file.text());if(ticket!==generation||!host.isConnected)return;input.value=JSON.stringify(next,null,2);amplitude.value=String(next.amplitude);status.textContent='Independent saved source question loaded. Recompute before saving; main notebook is unchanged.';}catch(error){if(ticket===generation&&host.isConnected)status.textContent=`Refused: ${error.message}`;}};
 save.onclick=()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([exportExcitation(accepted)],{type:'application/json'})),a=el('a');a.href=url;a.download='worldlaw-excitation-witness.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return {sourceChanged};
}
