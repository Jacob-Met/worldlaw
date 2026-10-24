import {parameterSensitivity} from './parameter-sensitivity.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const number=value=>Number(value.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6});
export function renderParameterSensitivity(host,model,observations){
 const title=node('h3','How tightly do these readings determine each coefficient?');
 const label=node('label','Declared absolute torque-reading error (N·m) ');
 const input=node('input');input.type='number';input.min='0';input.max='1000000';input.step='any';input.value='0.01';input.setAttribute('aria-label','Parameter sensitivity torque-reading error');label.append(input);
 const button=node('button','Inspect coefficient sensitivity');button.type='button';button.className='button button-outline';
 const status=node('p','Keep the inspected structure and exact command, angle and rate coordinates fixed. Refit that structure and propagate independently bounded reading changes through the maintained least-squares fitter.');status.setAttribute('role','status');
 const output=node('div');
 host.replaceChildren(title,label,button,status,output);
 input.addEventListener('input',()=>{output.replaceChildren();status.textContent='Reading-error assumption changed. Recompute before interpreting coefficient bounds.';});
 button.addEventListener('click',()=>{
  output.replaceChildren();
  try{
   if(input.value.trim()==='')throw new Error('Enter an explicit reading-error radius.');
   const report=parameterSensitivity(model,observations,Number(input.value));
   if(report.status!=='computed'){
    status.textContent=report.status==='work-limit'?`Not computed: all ${report.count} readings exceed the complete ${report.maxRows}-row diagnostic budget. No subset was substituted.`:report.status==='rank-unavailable'?'This inspected structure is numerically rank deficient on these coordinates. No unique coefficient envelope is reported.':'Too few readings remain for this fixed-structure calculation.';return;
   }
   status.textContent=`${report.count} training readings; each torque reading may change independently by ±${number(report.readingRadius)} N·m. Coordinates and structure remain fixed. These are separate coefficientwise refit ranges, not a jointly achievable coefficient box.`;
   const list=node('ul');
   for(const c of report.coefficients){
    const item=node('li',`${c.id}: refit ${number(c.refittedCoefficient)}; coefficient range ${number(c.lower)} to ${number(c.upper)} ${c.unit}; worst-case shift ±${number(c.radius)} ${c.unit}. ${c.crossesZero?'The range includes zero.':'The range excludes zero under this declaration.'}`);
    if(Math.abs(c.inspectedToRefitShift)>1e-10*Math.max(1,Math.abs(c.refittedCoefficient)))item.append(node('p',`The inspected coefficient is ${number(c.inspectedCoefficient)}; the conditional refit changes it by ${number(c.inspectedToRefitShift)} before adding reading errors.`));
    const detail=node('details');detail.append(node('summary','Inspect a worst-case reading perturbation'));
    detail.append(node('p','Add these offsets to the training readings in their retained order and refit this same structure to reach this coefficient’s upper bound. The lower witness negates them. Other coefficients need different witnesses.'));
    detail.append(node('p',c.upperWitnessOffsets.map((value,index)=>`${index+1}: ${number(value)}`).join('; ')));
    item.append(detail);list.append(item);
   }
   output.append(list,node('p',report.interpretation),node('p',report.numericalQualification),node('p','A small residual does not imply a tightly determined parameter. These ranges do not require every perturbed fit to pass a model-adequacy test. No probabilities, coordinate errors or systematic calibration model are inferred. Reopen the source notebook and declare the same radius to recompute this diagnostic.'));
  }catch(error){status.textContent=`Parameter sensitivity unavailable: ${error.message}`;}
 });
}
