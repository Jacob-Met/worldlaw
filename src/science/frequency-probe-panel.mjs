import {compareFrequencyOffers} from './frequency-probe.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(tag==='p')n.style.cssText='font-size:.875rem;line-height:1.5;color:#36514b';return n;};
const fmt=n=>Number(n.toPrecision(6)).toString();
/** To be mounted inside the accepted frequency report, not as a second planner. */
export function mountFrequencyOffers(root,report,session,{useInput}){
  const section=el('section');section.id='frequency-offers';section.append(el('h4','Which offered state separates the sampled periods?'));root.append(section);
  if(session.lab||!Object.hasOwn(session.base,'offeredInputs')){section.append(el('p','Import explicit input-only offered states with the original observation source to compare a permitted next measurement. No additional state is assumed permitted.'));return;}
  try{
    const plan=compareFrequencyOffers(report,session.base.offeredInputs);section.dataset.status=plan.status;
    section.append(el('p',`${plan.status.replaceAll('_',' ')} · ${plan.models.length} distinct competitive sampled models · ${plan.outcomes.length} original offers. ${plan.interpretation}`));
    const table=el('table');table.style.cssText='width:100%;table-layout:fixed;font-size:.8rem;overflow-wrap:anywhere';
    const header=el('tr');for(const text of ['Original offer','Angle (rad) / command (N·m) / rate (rad/s)','Predicted spread','Status'])header.append(el('th',text));table.append(header);
    for(const outcome of plan.outcomes){const row=el('tr');row.append(el('th',String(outcome.sourceIndex+1)),el('td',[outcome.input.position,outcome.input.command,outcome.input.rate].map(fmt).join(' / ')),el('td',fmt(outcome.spread)+' N·m'),el('td',outcome.previouslyObserved?'Already observed':outcome===plan.selected?'Ranked first':'Retained'));table.append(row);}
    section.append(table);
    if(plan.status==='proposed'){
      const button=el('button','Use this offered state for a new measurement');button.type='button';button.id='frequency-use-offer';button.disabled=session.discovery.observations.length>=4096;
      button.onclick=()=>{if(button.disabled||!section.isConnected)return;useInput({...plan.selected.input});};section.append(button);
      section.append(el('p','Copies the exact original input to ordinary Studio acquisition. Obtain and enter a separate torque reading, then infer again. The proposed forecast is never recorded as an observation.'));
    }
    const details=el('details'),pre=el('pre'),select=el('select'),label=el('label','Inspect original offer ');select.id='frequency-inspect-offer';label.htmlFor=select.id;
    for(const outcome of plan.outcomes){const option=el('option',String(outcome.sourceIndex+1));option.value=String(outcome.sourceIndex);select.append(option);}label.append(select);
    details.append(el('summary','Inspect sampled predictions for each original offer'),label,pre);pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    // Never stringify every offer×model prediction into one enormous DOM node.
    // Every original outcome remains selectable; materialize only the inspected one.
    const inspect=()=>{if(details.open)pre.textContent=JSON.stringify({outcome:plan.outcomes.find(o=>o.sourceIndex===Number(select.value))??null,models:plan.models},null,2);};
    details.addEventListener('toggle',inspect);select.addEventListener('change',inspect);section.append(details);
  }catch(error){section.append(el('p','Offered-state comparison refused: '+error.message));}
}
