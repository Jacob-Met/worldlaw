import {searchSharedTraining,SHARED_SEARCH_MAX_ITERATIONS,SHARED_SEARCH_MAX_PRODUCTS} from './shared-training-search.mjs';
import {prepareSharedTraining} from './shared-training-check.mjs';
import {serializeSharedTrainingCertificate,replaySharedTrainingCertificate} from './shared-training-replay.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const display=x=>Number(x.toPrecision(7)).toLocaleString('en-US',{maximumSignificantDigits:7});
export function renderSharedTraining(host,model,training,receiving,radiusControls){
 let ticket=0,saved=null;
 const title=node('h3','Can one shared training-reading perturbation receive the whole course?');
 const explanation=node('p','Marginal and pair checks remain above. This separate action searches for one training-offset vector received by every held-out box, or a weighted separating witness for the computed envelope. Exhausting a budget remains unresolved. Coordinates and model structure remain fixed.');
 const budgets=[['Joint search iteration budget','maxIterations',512,SHARED_SEARCH_MAX_ITERATIONS],['Joint search matrix-term budget','maxProducts',16777216,SHARED_SEARCH_MAX_PRODUCTS]].map(([name,key,value,max])=>{const label=node('label',name+' '),input=node('input');input.type='number';input.min='0';input.max=String(max);input.step='1';input.value=String(value);input.setAttribute('aria-label',name);label.append(input);return {label,input,key};});
 const run=node('button','Search shared-training evidence');run.type='button';run.className='button button-outline';
 const save=node('button','Export checked shared-training evidence');save.type='button';save.className='button button-outline';save.disabled=true;
 const importLabel=node('label','Replay checked shared-training evidence '),file=node('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Replay checked shared-training evidence');importLabel.append(file);
 const status=node('p','Not searched. The explicit radii above apply to this inspection.');status.setAttribute('role','status');status.className='shared-training-status';
 const output=node('div');output.className='shared-training-output';
 host.replaceChildren(title,explanation,...budgets.map(c=>c.label),node('p','The matrix-term budget bounds candidate-search prediction, gradient and separator terms. Source preparation, independent certificate checks, QR refits and rendering are additional bounded work; this is not a wall-clock limit.'),run,save,importLabel,status,output);
 const radii=()=>{if(radiusControls.some(c=>c.input.value.trim()===''))throw new Error('Enter both explicit reading-error radii above.');return Object.fromEntries(radiusControls.map(c=>[c.key,Number(c.input.value)]));};
 const invalidate=message=>{ticket++;saved=null;save.disabled=true;output.replaceChildren();delete output.dataset.status;file.value='';status.textContent=message;};
 for(const c of radiusControls)c.input.addEventListener('input',()=>invalidate('Reading-error assumption changed. Search again or replay matching source evidence.'));
 for(const c of budgets)c.input.addEventListener('input',()=>invalidate('Search budget changed. Run the explicit search again.'));
 const show=(certificate,check,course)=>{
  output.replaceChildren();output.dataset.status=check.status;
  output.dataset.receivingCount=String(check.receivingCount??receiving.length);
  if(course)output.append(node('p',`${course.iterationsPerformed} iterations; ${course.matrixTermsUsed} candidate-search matrix terms. ${training.length} training and ${receiving.length} receiving rows retained.`));
  if(check.status==='verified-separation'){
   const p=node('p',`Weighted discrepancy ${display(check.discrepancy)} N·m exceeds original-box support ${display(check.support)} N·m by ${display(check.gap)} N·m; numerical screen ${check.numericalTolerance} N·m.`);Object.assign(p.dataset,{gap:String(check.gap),tolerance:String(check.numericalTolerance),discrepancy:String(check.discrepancy),support:String(check.support)});p.className='shared-separation';output.append(p,node('p','No shared offset in the computed linear envelope receives this whole course under these original radii. This is numerical separating evidence, not a certified statement about QR error or physical feasibility.'));
  }else if(check.status==='verified-interior-witness'){
   output.append(node('p','One bounded training-offset vector is strictly inside every original receiving box under both influence reconstruction and an independently repeated same-structure refit.'));
   const scroll=node('div');scroll.className='shared-training-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Complete shared-training witness refit');const table=node('table'),head=node('thead'),tr=node('tr');for(const name of ['Row','Reconstructed N·m','Refitted N·m','Original-box margin N·m','Arithmetic screen N·m']){const th=node('th',name);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=node('tbody');for(const row of check.rows){const tr=node('tr');Object.assign(tr.dataset,{index:String(row.index),reconstructed:String(row.reconstructedPrediction),refitted:String(row.refittedPrediction),linearMargin:String(row.linearMargin),refitMargin:String(row.refitMargin),tolerance:String(row.numericalTolerance)});for(const value of [String(row.index+1),display(row.reconstructedPrediction),display(row.refittedPrediction),display(Math.min(row.linearMargin,row.refitMargin)),String(row.numericalTolerance)])tr.append(node('td',value));body.append(tr);}table.append(body);scroll.append(table);output.append(node('p','Scroll the witness comparison horizontally to see every numerical margin.'),scroll);
  }
  if(certificate){const details=node('details');details.append(node('summary',certificate.kind==='training-offsets'?'Every training-reading offset':'Every receiving-row weight'));const list=node('ol');for(const value of certificate.values){const item=node('li',String(value));item.dataset.value=String(value);list.append(item);}details.append(list);output.append(details);saved=serializeSharedTrainingCertificate(certificate);save.disabled=false;}
  output.append(node('p',check.qualification||course?.interpretation||'No certificate was obtained. Search exhaustion does not establish compatibility or separation.'));
 };
 run.addEventListener('click',()=>{
  invalidate('Searching the complete retained course…');
  try{if(budgets.some(c=>c.input.value.trim()===''))throw new Error('Enter both explicit search budgets.');const result=searchSharedTraining(model,training,receiving,{...radii(),...Object.fromEntries(budgets.map(c=>[c.key,Number(c.input.value)]))});status.textContent=`${result.status}: ${result.reason}.`;show(result.certificate,result.check||{status:result.status,qualification:result.interpretation},result);}catch(error){status.textContent=`Shared-training inspection unavailable: ${error.message}`;}
 });
 save.addEventListener('click',()=>{if(!saved)return;const url=URL.createObjectURL(new Blob([saved],{type:'application/json'})),link=node('a');link.href=url;link.download='worldlaw-shared-training-evidence.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);});
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];if(!selected)return;invalidate('Reading saved raw-source evidence…');const current=ticket;
  try{if(selected.size>2000000)throw new Error('Replay file exceeds 2,000,000 bytes.');const text=await selected.text();if(current!==ticket||!output.isConnected)return;const replay=replaySharedTrainingCertificate(text),context=prepareSharedTraining(model,training,receiving,radii());if(context.status!=='prepared'||context.sourceKey!==replay.certificate.sourceKey)throw new Error('Saved source differs from the current inspected model, retained rows or radii. Reopen its matching source notebook and redeclare its radii first.');show(replay.certificate,replay.check);status.textContent=`Replayed by public checker: ${replay.check.status}. Saved verdicts are not trusted.`;}catch(error){if(current===ticket&&output.isConnected)status.textContent=`Shared-training replay refused: ${error.message}`;}
 });
}
