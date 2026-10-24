import {inspectSerialNoise} from './serial-noise.mjs';
import {exportNotebook,importNotebook} from './paired-history.mjs';

export function mountSerialNoise(getNotebook) {
  const root=document.createElement('section');
  root.id='serial-noise';
  root.innerHTML='<h2>Challenge the sensor independence assumption</h2><p>Inspect the same preparation contrast under a declared stationary correlation per acquisition step. Positive correlation can cancel within pairs; the complete order matters.</p><label>Declared correlation ρ <input id="serial-rho" type="number" min="-0.999" max="0.999" step="0.1" value="0"></label> <button type="button" id="serial-inspect">Inspect current pairs</button> <button type="button" id="serial-save">Save sensitivity inputs</button> <label>Reopen sensitivity inputs <input id="serial-open" type="file" accept="application/json"></label><p id="serial-result" role="status" aria-live="polite"></p>';
  document.getElementById('interpretation').after(root);
  const output=root.querySelector('#serial-result'),rho=root.querySelector('#serial-rho');
  let retained=null, read=0;
  rho.oninput=()=>{read++;retained=null;output.textContent="Correlation changed; inspect current pairs to recompute.";};
  function inspect(notebook,value) {
    const result=inspectSerialNoise(notebook,value);
    retained={schema:'worldlaw.serial-noise/v1',rho:value,notebook:JSON.parse(exportNotebook(notebook))};
    output.textContent=result.status==='conditional'
      ?`Inspected snapshot (${result.baseline.count} pairs). Baseline ${result.baseline.verdict}, ±${result.baseline.boundary.toPrecision(5)} N·m. Declared correlation ${value}: ${result.verdict}, ±${result.boundary.toPrecision(5)} N·m; unchanged contrast ${result.baseline.decisionDifference.toPrecision(5)} N·m. ${result.interpretation}`
      :'Unresolved: recorded order with at least four pairs in each direction is required. Original evidence and baseline remain unchanged.';
  }
  root.querySelector('#serial-inspect').onclick=()=>{read++;try{if(!rho.value.trim())throw Error('Declare correlation explicitly.');inspect(getNotebook(),Number(rho.value));}catch(e){retained=null;output.textContent=e.message;}};
  root.querySelector('#serial-save').onclick=()=>{if(!retained){output.textContent='Inspect inputs before saving.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(retained,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='worldlaw-serial-noise.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
  root.querySelector('#serial-open').onchange=async e=>{const id=++read,file=e.target.files?.[0];if(!file)return;try{if(file.size>220000)throw Error('Use sensitivity JSON under 220 KB.');const raw=JSON.parse(await file.text());if(id!==read)return;if(raw.schema!=='worldlaw.serial-noise/v1')throw Error('Expected serial-noise inputs.');inspect(importNotebook(JSON.stringify(raw.notebook)),raw.rho);rho.value=String(raw.rho);}catch(err){if(id===read){retained=null;output.textContent=err.message;}}finally{if(id===read)e.target.value='';}};
}
