import {diagnoseStateSupport} from './state-support.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const number=n=>Number(n.toPrecision(4)).toLocaleString('en-US',{maximumSignificantDigits:4});
/** Rebuild on model/evidence changes so a former diagnostic cannot persist. */
export function renderStateSupport(host,model,observations){
 const title=node('h3','Does one observed state hold this law together?');
 const button=node('button','Test every state omission');button.type='button';
 const status=node('p','Refit the inspected structure after omitting each exact command, angle and rate group. This does not change the notebook or select a new law.');status.setAttribute('role','status');
 const result=document.createElement('div');
 host.replaceChildren(title,button,status,result);
 button.addEventListener('click',()=>{
  try{
   const report=diagnoseStateSupport(model,observations);result.replaceChildren();
   if(report.status==='work-limit'){status.textContent=`Not computed: ${report.uniqueStates} states and ${report.rowModels} reserved row-model operations exceed the complete-course limits (${report.limits.states} states; ${report.limits.rowModels} row-model operations). No partial winner is reported.`;return;}
   status.textContent=`${report.fittedCount??0} of ${report.uniqueStates} omissions fitted the same structure; ${report.unavailableCount??0} unavailable. All ${report.count} training rows remain in the notebook.`;
   const list=document.createElement('ul');
   for(const row of report.results){
    const state=`u ${row.state.command}, θ ${row.state.position}, ω ${row.state.rate}`;
    list.append(node('li',`Omit ${state}: ${row.removed} removed, ${row.remaining} retained. `+(row.status==='fitted'?`Prediction shift over the original training states: RMS ${number(row.predictionShiftRMS)} N·m; maximum ${number(row.maxPredictionShift)} N·m. Coefficient changes: ${row.coefficients.map(c=>`${c.id} ${number(c.change)}`).join(', ')||'none (zero model)'}.`:row.status==='structure-unavailable'?'The maintained fitter could not return this exact structure; numerical rank or executable coefficient limits may prevent it.':'Fewer than eight rows remain for the maintained fitter.')));
   }
   result.append(list,node('p','These are conditional deletion sensitivities, not confidence intervals or proof of a bad observation. Removing a state can destroy excitation even with many remaining rows. Stable coefficients do not establish a correct physical law. Held-out values are never used.'));
  }catch(error){result.replaceChildren();status.textContent=`Diagnostic unavailable: ${error.message}`;}
 });
}
