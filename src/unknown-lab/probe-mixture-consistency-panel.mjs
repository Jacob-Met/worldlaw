import {inspectProbeMixtureConsistency,exportProbeMixtureConsistency,importProbeMixtureConsistency,MIXTURE_CONSISTENCY_SCHEMA} from './probe-mixture-consistency.mjs';
import {PROBE_MIXTURE_FAMILIES} from './probe-mixture.mjs';
const fmt=x=>Number(x.toPrecision(6)).toString();
export function mountProbeMixtureConsistency(host,study,config,owner){
 const section=document.createElement('section');section.className='probe-consistency';
 section.innerHTML=`<style>.probe-consistency p{overflow-wrap:anywhere}.probe-consistency select:focus-visible{outline:3px solid #ffad5c;outline-offset:3px}.probe-consistency{border-bottom:1px solid #315460;padding-bottom:24px;margin-bottom:24px}</style><h3>Can one coefficient vector satisfy every screen?</h3><p>Search the whole declared coefficient box, independently of the representative fit. This is a bounded numerical consistency investigation, not a forecast or a physical identification.</p><label>Mixed family <select class="family"></select></label><label>Evidence scope <select class="scope"><option value="training-only">Training observations only</option><option value="all-evidence">All observations · retrospective consistency</option></select></label><label>Iteration budget <input class="iterations" type="number" min="0" max="4096" step="1" value="512"></label><label>Matrix-product budget <input class="products" type="number" min="0" max="1000000" step="1" value="1000000"></label><div class="secondary-actions"><button class="inspect" type="button">Inspect coefficient consistency</button><button class="save" type="button" disabled>Save consistency inputs</button><button class="open" type="button">Reopen consistency inputs</button></div><input class="file" type="file" accept="application/json,.json" hidden><p class="status" role="status">Not inspected</p><div class="result"></div><p class="error" role="alert"></p>`;
 host.append(section);const $=name=>section.querySelector('.'+name);
 for(const family of PROBE_MIXTURE_FAMILIES){const option=document.createElement('option');option.value=family.id;option.textContent=family.id;$('family').append(option);}
 if(config){$('family').value=config.family;$('scope').value=config.scope;$('iterations').value=config.maxIterations;$('products').value=config.maxProducts;}
 let accepted=null;
 function request(){if(!$('iterations').value.trim()||!$('products').value.trim())throw Error('Declare both nonnegative work budgets.');return {schema:MIXTURE_CONSISTENCY_SCHEMA,study,family:$('family').value,scope:$('scope').value,maxIterations:Number($('iterations').value),maxProducts:Number($('products').value)};}
 const invalidate=()=>{accepted=null;$('save').disabled=true;$('status').textContent='Changed inputs · inspect again';$('result').replaceChildren();};
 for(const key of ['family','scope','iterations','products'])$(key).oninput=()=>{owner.begin();invalidate();};
 $('inspect').onclick=()=>{owner.begin();try{
  const raw=request(),result=inspectProbeMixtureConsistency(raw);accepted=raw;$('save').disabled=false;$('error').textContent='';$('status').textContent=(raw.scope==='training-only'?'TRAINING ONLY':'RETROSPECTIVE ALL EVIDENCE')+' · '+result.status;
  const target=$('result');target.replaceChildren();const line=text=>{const p=document.createElement('p');p.textContent=text;target.append(p);};
  line(result.interpretation);line('Reason: '+result.reason+'. Iterations: '+(result.iterationsPerformed??0)+'; matrix products: '+(result.matrixTermsUsed??0)+'. Coefficient domain: −100 to 100 in each listed unit.');
  const cert=result.certificate;
  if(cert?.kind==='coefficient-witness'){
   line('Consistency witness · '+result.labels.map((label,i)=>label+' = '+fmt(cert.values[i])).join('; '));
   for(const row of result.sourceRuns){const family=PROBE_MIXTURE_FAMILIES.find(f=>f.id===result.family),value=family.features(row.probe).reduce((s,x,i)=>s+x*cert.values[i],0);line(row.id+' ['+row.role+']: witness value '+fmt(value)+' N·m inside observed screen ['+row.screen.map(fmt).join(', ')+'].');}
  }else if(cert?.kind==='coefficient-separator'){
   line('Computed separation gap '+fmt(result.check.gap)+' exceeds numerical tolerance '+fmt(result.check.numericalTolerance)+'. This challenges the declared family plus coefficient domain and observation screens.');
   for(const [i,row]of result.sourceRuns.entries())line(row.id+' ['+row.role+']: separating weight '+fmt(cert.values[i])+'.');
  }
 }catch(e){invalidate();$('error').textContent=e.message;}};
 $('save').onclick=()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([exportProbeMixtureConsistency(accepted)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-probe-mixture-consistency.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('open').onclick=()=>$('file').click();
 $('file').onchange=async event=>{const version=owner.begin(),file=event.target.files?.[0];if(!file)return;try{if(file.size>5000000)throw Error('Use a request below 5 MB.');const raw=importProbeMixtureConsistency(await file.text());if(owner.current(version))owner.adopt(raw);}catch(e){if(owner.current(version))$('error').textContent=e.message;}finally{event.target.value='';}};
 if(config)$('inspect').click();
}
