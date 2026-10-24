import {predictionSensitivity} from './prediction-sensitivity.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const number=value=>Number(value.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6});
export function renderPredictionSensitivity(host,model,training,receiving){
 const title=node('h3','Do uncertain coefficients still predict these held-out readings?');
 const controls=[['Training torque-reading radius (N·m)','trainingRadius'],['Held-out torque-reading radius (N·m)','receivingRadius']].map(([text,key])=>{const label=node('label',text+' '),input=node('input');input.type='number';input.min='0';input.max='1000000';input.step='any';input.value='0.01';input.setAttribute('aria-label',text);label.append(input);return {label,input,key};});
 const button=node('button','Inspect held-out prediction sensitivity');button.type='button';button.className='button button-outline';
 const status=node('p',`${training.length} training readings and ${receiving.length} retained held-out readings. Held-out outcomes do not enter the fit.`);status.setAttribute('role','status');
 const output=node('div');host.replaceChildren(title,...controls.map(c=>c.label),button,status,output);
 for(const {input} of controls)input.addEventListener('input',()=>{output.replaceChildren();status.textContent='Reading-error assumption changed. Recompute before interpreting the held-out comparison.';});
 button.addEventListener('click',()=>{
  output.replaceChildren();
  try{
   if(controls.some(c=>c.input.value.trim()===''))throw new Error('Enter both explicit reading-error radii.');
   const report=predictionSensitivity(model,training,receiving,Object.fromEntries(controls.map(c=>[c.key,Number(c.input.value)])));
   if(report.status!=='computed'){status.textContent=`Prediction sensitivity unavailable: ${report.status}. Complete inputs: ${training.length} training and ${receiving.length} held-out readings. No subset was substituted.`;return;}
   status.textContent=`${report.outsideCount} of ${report.receivingCount} held-out readings outside the conditional perturbation range; ${report.boundaryCount} numerically unresolved at its boundary; ${report.notExcludedCount} not excluded. This is a per-row check, not joint compatibility or physical validation.`;
   const scroll=node('div');scroll.className='prediction-sensitivity-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Complete held-out sensitivity comparison');
   const table=node('table'),head=node('thead'),heading=node('tr');
   for(const text of ['Row','Conditional prediction N·m','Held-out reading N·m','Disposition']){const th=node('th',text);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
   const body=node('tbody');for(const row of report.rows){const tr=node('tr');Object.assign(tr.dataset,{index:String(row.index),center:String(row.refittedPrediction),radius:String(row.radius),status:row.status});for(const text of [String(row.index+1),row.prediction.map(number).join(' to '),row.observation.map(number).join(' to '),row.status+(row.extrapolation.length?`; outside training ${row.extrapolation.join(', ')} range`:'')])tr.append(node('td',text));body.append(tr);}table.append(body);scroll.append(table);output.append(node('p','Scroll the comparison horizontally to see every disposition.'),scroll);
   const details=node('details');details.append(node('summary','Inspect prediction dependence and a witness'));
   const label=node('label','Receiving row '),select=node('select');select.setAttribute('aria-label','Receiving row witness');for(const row of report.rows){const option=node('option',String(row.index+1));option.value=String(row.index);select.append(option);}label.append(select);details.append(label);const witness=node('div');details.append(witness);
   const show=()=>{const r=report.rows[Number(select.value)];witness.replaceChildren(node('p',`Command ${number(r.input.command)}, angle ${number(r.input.position)}, rate ${number(r.input.rate)}. Inspected point prediction ${number(r.inspectedPrediction)} N·m; conditional refit ${number(r.refittedPrediction)} N·m.`),node('p',`Shared-reading prediction radius ${number(r.radius)} N·m; treating separate coefficient ranges as independent would give ${number(r.independentCoefficientBoxRadius)} N·m. Boundary tolerance ${r.numericalTolerance} N·m.`),node('p','Add these offsets to training readings in retained order and refit this same structure to reach this row’s upper prediction endpoint. Negate them for its lower endpoint. Other rows can require different witnesses.'),node('p',r.upperWitnessOffsets.map((v,i)=>`${i+1}: ${number(v)}`).join('; ')));};select.addEventListener('change',show);show();
   output.append(details,node('p',report.interpretation),node('p',report.numericalQualification),node('p','All declared coordinates remain exact. Extrapolation marks departure from a coordinate’s observed range, not proof of physical invalidity. Reopen the source notebook and redeclare both radii to recompute this comparison.'));
  }catch(error){output.replaceChildren();status.textContent=`Prediction sensitivity unavailable: ${error.message}`;}
 });
}
