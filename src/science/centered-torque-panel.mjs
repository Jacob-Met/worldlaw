import {renderPeriodicOrigin} from './periodic-origin-panel.mjs';
import {renderAffineOrigin} from './affine-origin-panel.mjs';
import {renderInputOriginActual} from './input-origin-actual-panel.mjs';
import {openInputOriginTorqueSource,parseInputOriginTorqueSource,serializeInputOriginTorqueSource,INPUT_ORIGIN_SOURCE_SCHEMA} from './input-origin-torque-source.mjs';
import {openHeterogeneousTorqueSource,parseHeterogeneousTorqueSource,serializeHeterogeneousTorqueSource,HETEROGENEOUS_SOURCE_SCHEMA} from './heterogeneous-torque-source.mjs';
import {openSplitTorqueSource,parseSplitTorqueSource,serializeSplitTorqueSource,SPLIT_SOURCE_SCHEMA} from './split-torque-source.mjs';
import {openCenteredTorqueSource,serializeCenteredTorqueSource,parseCenteredTorqueSource} from './centered-torque-source.mjs';
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function renderCenteredTorque(container,model,training,challenge){
 container.replaceChildren(el('h3','Resolve small response changes with explicit numerical representations'),el('p','Experimental fixed-structure soft-L1 comparison. Choose a retained torque origin, split coefficients, or equivalent input origins with an existing bias; ordinary solver predictions remain rounded. This does not replace the selected law.'));
 const form=el('form'),label=el('label','Declared soft-L1 scale (N·m) '),scale=el('input');scale.type='number';scale.min='0.0000001';scale.max='1000000';scale.step='any';scale.value='.01';label.append(scale);form.append(label);
 const button=el('button','Fit centered response for inspected terms');button.type='submit';button.style.whiteSpace='normal';button.style.maxWidth='100%';form.append(button);container.append(form);
 const methodLabel=el('label','Experimental numerical representation '),method=el('select');
 for(const [value,text]of [['centered','Training origin + increment'],['split','Split coefficients with bounded continuation'],['heterogeneous','Split coefficients with declared per-reading noise ratios'],['input-origin','Equivalent input origins with declared noise ratios']]){const option=el('option',text);option.value=value;method.append(option);}method.value='centered';method.style.width='100%';method.style.maxWidth='100%';method.style.minWidth='0';methodLabel.style.display='block';methodLabel.style.maxWidth='100%';methodLabel.append(method);form.prepend(methodLabel);
 const requiresBias=()=>['centered','input-origin'].includes(method.value)&&!basis.terms.includes('bias');
 const open=source=>source.schema===INPUT_ORIGIN_SOURCE_SCHEMA?openInputOriginTorqueSource(source):source.schema===HETEROGENEOUS_SOURCE_SCHEMA?openHeterogeneousTorqueSource(source):source.schema===SPLIT_SOURCE_SCHEMA?openSplitTorqueSource(source):openCenteredTorqueSource(source);
 const parse=text=>{const raw=JSON.parse(text);return raw.schema===INPUT_ORIGIN_SOURCE_SCHEMA?parseInputOriginTorqueSource(text):raw.schema===HETEROGENEOUS_SOURCE_SCHEMA?parseHeterogeneousTorqueSource(text):raw.schema===SPLIT_SOURCE_SCHEMA?parseSplitTorqueSource(text):parseCenteredTorqueSource(text);};
 const serialize=source=>source.schema===INPUT_ORIGIN_SOURCE_SCHEMA?serializeInputOriginTorqueSource(source):source.schema===HETEROGENEOUS_SOURCE_SCHEMA?serializeHeterogeneousTorqueSource(source):source.schema===SPLIT_SOURCE_SCHEMA?serializeSplitTorqueSource(source):serializeCenteredTorqueSource(source);

 const output=el('div');output.setAttribute('role','status');const save=el('button','Download original response inputs');save.type='button';save.style.whiteSpace='normal';save.style.maxWidth='100%';save.disabled=true;container.append(output,save);let accepted=null,generation=0;let basis={training:structuredClone(training),challenge:structuredClone(challenge),terms:model.terms.map(t=>t.id)};
 const identity=el('p','Inspected terms: '+basis.terms.join(', '));const fileLabel=el('label','Reopen original response inputs '),file=el('input');file.type='file';file.accept='.json,application/json';file.style.maxWidth='100%';fileLabel.append(file);container.append(fileLabel,identity);
 const clear=()=>{generation++;accepted=null;save.disabled=true;output.replaceChildren();};scale.addEventListener('input',()=>{clear();button.disabled=requiresBias();});
 method.addEventListener('change',()=>{clear();button.disabled=requiresBias();button.textContent=method.value==='centered'?'Fit centered response for inspected terms':'Fit split response for inspected terms';});
 form.addEventListener('submit',event=>{event.preventDefault();clear();try{
  if(!scale.value.trim())throw Error('Declare a scale.');
  const source={schema:method.value==='input-origin'?INPUT_ORIGIN_SOURCE_SCHEMA:method.value==='heterogeneous'?HETEROGENEOUS_SOURCE_SCHEMA:method.value==='split'?SPLIT_SOURCE_SCHEMA:'worldlaw.centered-torque-source/v1',training:structuredClone(basis.training),challenge:structuredClone(basis.challenge),terms:[...basis.terms],scale:Number(scale.value)};
  const result=open(source);if(result.status!=='converged')throw Error('Centered fit unresolved: '+result.status);
  accepted=source;save.disabled=false;
  const table=el('table');table.style.width='100%';table.style.tableLayout='fixed';table.style.overflowWrap='anywhere';table.append(el('caption','Response residuals · every original row · N·m'));const header=el('tr');for(const s of ['Evidence',method.value==='centered'?'Origin + increment RMSE':'Split-coefficient RMSE','Rounded-output RMSE'])header.append(el('th',s));table.append(header);
  for(const [name,scores] of [['Training',result.training],['Held aside',result.challenge]]){const row=el('tr');row.append(el('th',name),el('td',String(scores.rmse??'Absent')),el('td',String(scores.roundedRmse??'Absent')));table.append(row);}if(['heterogeneous','input-origin'].includes(method.value))output.append(el('p','Declared-ratio RMSE: training '+result.training.normalizedRmse+'; held aside '+result.challenge.normalizedRmse+'. Physical residuals below retain torque units. Ratios are original declarations, not inferred reliability.'));output.append(table,el('p',method.value!=='centered'?'Stable residual retains split coefficient products. Physical solver predictions remain rounded. Continuation solves the same declared final soft-L1 scale under the complete work cap. Held-aside rows never fit the law.':'Stable residual = (reading − origin) − increment. Rounded residual = reading − rounded(origin + increment). Their difference is numerical representation, not newly measured precision. Held-aside rows never fit the law.'));
  if(method.value==='input-origin')output.append(el('p','Input origins are chosen from training coordinates only. The existing bias preserves the offered feature span; executable coefficients and both stationarity checks use original coordinates. This changes numerical representation, not the physical law or declared uncertainty.'));
  if(method.value==='input-origin'){const acquisition=el('section');output.append(acquisition);renderInputOriginActual(acquisition,source);const execution=el('section');output.append(execution);renderAffineOrigin(execution,source);if(source.terms.some(t=>['gravity','cosine'].includes(t))){const periodic=el('section');output.append(periodic);renderPeriodicOrigin(periodic,source);}}
  const detail=el('details');detail.append(el('summary','Inspect original rows and executable response'));const pre=el('pre',JSON.stringify(result,null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(pre);output.append(detail);
 }catch(error){output.append(el('p',error.message));}});
 file.addEventListener('change',async()=>{
  clear();const token=generation,selected=file.files?.[0];if(!selected)return;
  button.disabled=true;
  try{
   if(selected.size>4*1024*1024)throw Error('Open at most 4 MiB of original inputs.');
   const text=await selected.text();if(token!==generation)return;
   const result=parse(text);if(result.status!=='converged')throw Error('Centered fit unresolved: '+result.status);
   basis=structuredClone(result.source);method.value=basis.schema===INPUT_ORIGIN_SOURCE_SCHEMA?'input-origin':basis.schema===HETEROGENEOUS_SOURCE_SCHEMA?'heterogeneous':basis.schema===SPLIT_SOURCE_SCHEMA?'split':'centered';button.textContent=method.value==='centered'?'Fit centered response for inspected terms':'Fit split response for inspected terms';scale.value=String(basis.scale);button.disabled=false;
   identity.textContent=selected.name+' · terms: '+basis.terms.join(', ')+' · training '+basis.training.length+' · held aside '+basis.challenge.length;
   output.append(el('p','Original source reopened and recomputed. Fit to inspect residuals; selected workbench law is unchanged.'));
  }catch(error){if(token===generation)output.append(el('p',error.message));}
  finally{if(token===generation){file.value='';button.disabled=requiresBias();}}
 });
 save.addEventListener('click',()=>{if(!accepted)return;const blob=new Blob([serialize(accepted)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=accepted.schema===INPUT_ORIGIN_SOURCE_SCHEMA?'input-origin-torque-original-inputs.json':accepted.schema===HETEROGENEOUS_SOURCE_SCHEMA?'heterogeneous-torque-original-inputs.json':accepted.schema===SPLIT_SOURCE_SCHEMA?'split-torque-original-inputs.json':'centered-torque-original-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 if(!model.terms.some(t=>t.id==='bias')){button.disabled=true;output.append(el('p','This comparison requires an inspected structure already containing a constant bias. It will not silently add one.'));}
}
