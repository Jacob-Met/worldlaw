import {inspectObservables} from './observable-receiving.mjs';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const number=v=>Number(v.toPrecision(7)).toString();
/** Explicit follow-on inspection; the existing loop comparison is retained. */
export function appendObservableInspection(out,retained){
 const section=node('section'),button=node('button','Inspect responses hidden by integrated work'),result=node('div');button.type='button';section.id='coupled-observable-inspector';button.id='observable-inspect';result.id='observable-result';
 section.append(button,result);out.append(section);
 button.addEventListener('click',()=>{
  result.replaceChildren();
  try{
   const report=inspectObservables(retained.notebook,retained.observed.input);
   result.append(node('h4','The measurement you retain changes what can be distinguished'));
   result.append(node('p','The two-coordinate loop uses the same readings in two ways: their signed integrated work, and every individual torque response. A conservative response difference can cancel exactly in the integral while failing the actual readings.'));
   for(const c of report.candidates){
    const article=node('div');article.dataset.observableModel=c.modelId;article.append(node('h5',c.label),node('p',`Integrated work: ${c.workStatus}. Individual responses: ${c.responseStatus}. ${c.contradictingComponents} coordinate readings exceed their supplied bounds and numerical allowance.`));
    if(c.workUnresolvedResponseContradicted)article.append(node('strong','Work does not separate this model, but the individual responses contradict it.'));
    if(c.witness){const w=c.witness;article.append(node('p',`Strongest supplied-reading witness: row ${w.sampleIndex+1}, torque coordinate ${w.axis+1}, at [${w.q.map(number).join(', ')}] rad. Supplied ${number(w.observed)} N·m; fitted prediction ${number(w.prediction)} N·m; signed residual ${number(w.residual)} N·m; total reading/numerical allowance ${number(w.allowance)} N·m. ${w.extrapolated?'This witness is outside the training coordinate ranges.':'This witness is inside the individual training coordinate ranges.'}`));}
    result.append(article);
   }
   for(const pair of report.workBlindPairs)result.append(node('p',`${pair.join(' and ')} are both symmetric affine fields. Their exact closed-path work is zero for every polygon, not just this path. A larger or differently shaped closed-work probe cannot distinguish these fixed laws; individual torque responses can differ.`));
   const plan=report.pointProposal;
   result.append(node('h4','An alternative observable from the retained training'));
   result.append(node('p',`Maintained point-probe planner: ${plan.status}. This proposal is recomputed from retained training only. Neither the loop readings nor their errors select this input.`));
   if(plan.selected){const p=plan.selected;result.append(node('p',`Declared permitted angle pair [${p.q.map(number).join(', ')}] rad. Competitive vector-response disagreement ${number(p.disagreement)} N·m. ${p.extrapolatedAxes.length?'Outside training ranges on coordinates '+p.extrapolatedAxes.map(a=>a+1).join(', ')+'.':'Inside the individual coordinate ranges.'}`));}
   result.append(node('p',report.qualification));
  }catch(error){result.append(node('p',`Inspection refused: ${error.message}`));}
 });
}
