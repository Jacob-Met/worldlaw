import {preparePrelude} from './prelude-investigation.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number(x.toPrecision(5)).toString();
/** A source inspection foldout inside the existing prediction instrument. */
export function createPreludeControls(anchor,getRun,onSelection){
 const host=node('details');host.id='prelude-controls';
 const style=node('style');style.textContent=`#prelude-controls{padding:14px;border:1px solid #d9dfd1;border-radius:5px;background:#fafbf5}#prelude-controls summary{cursor:pointer;font-size:13px;font-weight:600;line-height:1.5}#prelude-controls[open]>p{margin:12px 0}#prelude-controls label{display:grid;gap:5px}#prelude-controls select{width:100%;min-width:0;min-height:42px;padding:9px;border:1px solid #cdd7c5;background:#fffef9;color:#203928}#prelude-controls table{width:100%;border-collapse:collapse;font-size:11px;line-height:1.5}#prelude-controls caption{text-align:left;margin-bottom:8px;color:#52634f}#prelude-controls th,#prelude-controls td{padding:7px 8px;border-bottom:1px solid #e1e5da;text-align:left}#prelude-controls button{justify-self:start}#prelude-status{overflow-wrap:anywhere}`;host.append(style);host.append(node('summary','Estimate the start from earlier angular measurements'));
 host.append(node('p','Only samples ending at the exact challenge start are admitted. Conditional noise excludes polynomial bias; shorter and longer windows can disagree. No window is automatically selected. Choosing after viewing challenge errors is exploratory reuse.'));
 const controls=node('div');controls.style.cssText='display:grid;gap:.6rem;max-width:100%';host.append(controls);anchor.before(host);
 const file=node('input');file.type='file';file.accept='.json,application/json';file.id='prelude-file';file.style.cssText='width:100%;min-width:0';file.setAttribute('aria-label','Choose angular prelude input');controls.append(file);
 const input=(label,id,value)=>{const l=node('label',label),e=node('input');e.id=id;e.value=value;e.style.cssText='width:100%;min-width:0';l.append(e);controls.append(l);return e;};
 const widths=input('Trailing sample counts (comma separated)','prelude-window-sizes','5,9,17,31');
 const sigma=input('Declared position-noise scale (rad; blank uses residual proxy)','prelude-noise','.001');sigma.type='number';sigma.min='0';sigma.step='.001';
 const button=(text,id)=>{const b=node('button',text);b.id=id;b.type='button';b.className='button outline';controls.append(b);return b;};
 const estimateButton=button('Estimate declared windows','estimate-prelude');estimateButton.disabled=true;
 const status=node('p','Original supplied rate remains active.');status.id='prelude-status';status.setAttribute('role','status');controls.append(status);
 const tableHost=node('div');tableHost.style.cssText='overflow-x:auto;min-width:0';controls.append(tableHost);
 const choices=node('select');choices.id='prelude-choice';choices.setAttribute('aria-label','Choose one declared window');choices.disabled=true;controls.append(choices);
 const apply=button('Use this window for comparison','apply-prelude');apply.disabled=true;
 const restore=button('Restore original supplied rate','restore-prelude');
 let inputData=null,prepared=null,generation=0;
 function clear(){prepared=null;choices.replaceChildren();choices.disabled=true;apply.disabled=true;tableHost.replaceChildren();onSelection(null);}
 function options(){const windowSizes=widths.value.split(',').map(s=>Number(s.trim()));const positionSigma=sigma.value.trim()===''?null:Number(sigma.value);return {windowSizes,positionSigma};}
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];if(!selected)return;const ticket=++generation;
  try{if(selected.size>200000)throw Error('Prelude file exceeds 200 KB.');const bytes=await selected.arrayBuffer();if(ticket!==generation)return;
   const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));preparePrelude(raw,getRun(),{windowSizes:[5]});
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(ticket!==generation)return;
   clear();inputData={...raw,importedFile:{name:selected.name,sha256:hash}};estimateButton.disabled=false;status.textContent=`${raw.source.label} · ${raw.samples.length} samples · ${raw.kind}. Estimate windows before choosing a rate.`;
  }catch(error){if(ticket===generation)status.textContent=error.message+(inputData?' Previous accepted prelude and selection remain active.':' No prelude is active.');}
 });
 for(const e of [widths,sigma])e.addEventListener('input',()=>{generation++;clear();status.textContent='Settings changed; original rate restored. Re-estimate the prelude.';});
 estimateButton.addEventListener('click',()=>{
  try{if(!inputData)throw Error('Import a prelude first.');const next=preparePrelude(inputData,getRun(),options());clear();prepared=next;
   const table=node('table');table.append(node('caption','Declared order; sigma is conditional and excludes approximation bias'));
   const head=node('tr');for(const text of ['Samples','Rate (rad/s)','Conditional sigma','Outcome']){const th=node('th',text);th.scope='col';head.append(th);}table.append(head);
   const placeholder=node('option','Choose a window explicitly');placeholder.value='';choices.append(placeholder);
   next.estimate.estimates.forEach(e=>{const row=node('tr');for(const text of [String(e.windowSize),e.status==='estimated'?fmt(e.rate):'—',e.status==='estimated'?fmt(e.rateSigma):'—',e.status])row.append(node('td',text));table.append(row);if(e.status==='estimated'){const option=node('option',`${e.windowSize} samples · ${fmt(e.rate)} rad/s`);option.value=String(e.windowSize);choices.append(option);}});
   tableHost.append(table);choices.disabled=choices.options.length<=1;
   status.textContent=`Original rate ${fmt(getRun().initialRate)} rad/s; window spread ${next.estimate.rateSpread===null?'unavailable':fmt(next.estimate.rateSpread)+' rad/s'}. ${next.estimate.uncertaintySource}. No estimate selected.`;
  }catch(error){clear();status.textContent=error.message;}
 });
 choices.addEventListener('change',()=>{onSelection(null);apply.disabled=choices.value==='';});
 apply.addEventListener('click',()=>{if(!prepared||!choices.value)return;const chosenWindowSize=Number(choices.value),entry=prepared.estimate.estimates.find(e=>e.windowSize===chosenWindowSize);if(entry?.status!=='estimated')return;onSelection({input:prepared.input,options:{...prepared.estimate.settings,chosenWindowSize}});status.textContent=`Explicitly using ${fmt(entry.rate)} rad/s from ${chosenWindowSize} earlier samples. Original rate ${fmt(getRun().initialRate)} is preserved. Run the comparison below.`;});
 restore.addEventListener('click',()=>{onSelection(null);status.textContent='Original supplied rate restored; no model or source observation changed.';});
 return {reset(){generation++;inputData=null;file.value='';clear();estimateButton.disabled=true;status.textContent='Original supplied rate remains active. Import a prelude for this exact recording.';}};
}
