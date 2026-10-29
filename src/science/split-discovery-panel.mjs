import {discover,discoverSplit,discoverHeterogeneous,discoverInputOrigin,evaluate} from './torque-discovery.mjs';
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
/** Training-only complete named-feature search; held-aside rows only evaluate the winner. */
export function renderSplitDiscovery(container,training,challenge,options){
 const basis={training:structuredClone(training),challenge:structuredClone(challenge),options:structuredClone(options)};
 container.replaceChildren(el('h3','Complete named-feature search with split coefficients'),el('p','Experimental complete search over the existing named feature set and declared maximum term count. Every admitted structure must resolve before ranking. This comparison leaves the selected workbench law unchanged.'));
 const form=el('form'),fields={},method=el('select'),methodLabel=el('label','Declared reading-noise treatment ');for(const [value,text]of [['equal','Equal-noise split search'],['ratios','Original per-reading ratios'],['input-origin','Equivalent input origins with original ratios']]){const option=el('option',text);option.value=value;method.append(option);}method.style.width='100%';method.style.minWidth='0';methodLabel.append(method);form.append(methodLabel);
 for(const [key,title,value]of [['lossScale','Declared soft-L1 scale (N·m)',options.lossScale??.01],['noiseSigma','Declared score noise floor (N·m)',options.noiseSigma],['maxTerms','Maximum terms per structure',options.maxTerms??4]]){
  const label=el('label',title+' '),input=el('input');input.type='number';input.step='any';input.min='0.0000001';input.max='1000000';input.value=String(value??.01);if(key==='maxTerms'){input.min='1';input.max='9';input.step='1';}label.append(input);form.append(label);fields[key]=input;
 }
 const run=el('button','Compare complete original and split searches');run.type='submit';run.style.whiteSpace='normal';form.append(run);const output=el('div');output.setAttribute('role','status');container.append(form,output);
 const clear=()=>output.replaceChildren();method.addEventListener('change',clear);Object.values(fields).forEach(input=>input.addEventListener('input',clear));
 form.addEventListener('submit',event=>{event.preventDefault();clear();try{
  if(Object.values(fields).some(input=>!input.value.trim()))throw Error('Declare the scale and score noise floor.');
  const declared={...basis.options,loss:'soft_l1',lossScale:Number(fields.lossScale.value),noiseSigma:Number(fields.noiseSigma.value),maxTerms:Number(fields.maxTerms.value)};
  // Split preflight runs before any comparison fit; neither path consumes challenge rows.
  const result=(method.value==='input-origin'?discoverInputOrigin:method.value==='ratios'?discoverHeterogeneous:discoverSplit)(basis.training,declared);if(['ratios','input-origin'].includes(method.value))output.append(el('p','Declared-ratio training RMSE '+result.selected.metrics.normalizedRmse+'; adequacy '+result.diagnostics.adequacy+'. Ranking uses original physical residuals divided by supplied ratios. These declarations are not inferred reliability or calibrated confidence.'));let original;
  try{const fit=discover(basis.training,declared);original='Original search selected '+fit.selected.id+'; held-aside RMSE '+evaluate(fit.selected,basis.challenge).rmse;}catch(error){original='Original search unresolved: '+error.message;}
  if(method.value==='input-origin')output.append(el('p','Only structures already containing bias use equivalent input origins. Other structures retain the prior solver. Complete work and original-coordinate checks precede the unchanged training score.'));
  const held=evaluate(result.selected,basis.challenge);
  output.append(el('p',original),el('p','Split search selected '+result.selected.id+' across '+result.diagnostics.examinedCandidates+' examined structures; reserved work '+result.diagnostics.robustWorkReserved+'. Held-aside stable RMSE '+held.rmse+' N·m.'));
  output.append(el('p','The unchanged ranking score uses the declared noise floor. A large floor can prefer a bias-only law despite poor held-aside prediction. Split arithmetic preserves residual increments; ordinary physical predictions remain rounded. Held-aside readings do not rank or fit candidates.'));
  const table=el('table');table.style.width='100%';table.style.tableLayout='fixed';table.style.overflowWrap='anywhere';table.append(el('caption','All retained structures · training score only'));
  const head=el('tr');for(const text of ['Terms','Training score','Stable RMSE'])head.append(el('th',text));table.append(head);
  for(const model of result.candidates){const row=el('tr');row.append(el('td',model.id),el('td',String(model.metrics.score)),el('td',String(model.metrics.rmse)));table.append(row);}const detail=el('details');detail.append(el('summary','Inspect all retained structures'),table);output.append(detail);
 }catch(error){output.append(el('p',error.message));}});
}
