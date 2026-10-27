import {historicalCourseContext} from './historical-course.mjs';
import {renderSharedTraining} from './shared-training-panel.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function renderHistoricalTraining(host,state,eventIndex,modelIndex,throughEvent=eventIndex){
 host.replaceChildren();host.id='historical-training-receipt';
 let c;try{c=historicalCourseContext(state,eventIndex,modelIndex,throughEvent);}catch(e){host.append(el('p',e.message));return;}
 host.append(el('h4','Could earlier reading error explain this acquired course?'));
 const endpoint=el('select');endpoint.id='historical-course-end';endpoint.setAttribute('aria-label','Challenge original law through acquisition');
 for(let i=eventIndex;i<state.history.length;i++)if(state.history[i].experiment){const o=el('option',`Through acquisition ${i}`);o.value=String(i);endpoint.append(o);}endpoint.value=String(throughEvent);
 const label=el('label','Challenge this original law through acquisition ');label.append(endpoint);host.append(label);endpoint.addEventListener('change',()=>renderHistoricalTraining(host,state,eventIndex,modelIndex,Number(endpoint.value)));

 if(c.status!=='available'){const p=el('p','Historical shared-training check unavailable: '+c.reason);p.id='historical-training-unavailable';host.append(p);return;}
 host.append(el('p',`This uses only the ${c.training.length} source rows preceding this acquisition and the inspected earlier structure and coefficients. The complete ${c.receiving.length} acquired rows from acquisition ${eventIndex} through ${throughEvent} test one common perturbation of those same earlier readings. Intermediate refits never replace this original law or training prefix. The fixed-prior verdict and the later outcome-reusing fit above remain unchanged. This is a retrospective explanation under newly declared reading bounds, not the prospective planning guarantee.`));
 host.append(el('p','Source row custody: '+c.rowSources.map(x=>`acquisition ${x.eventIndex} row ${x.rowIndex+1} → original row ${x.sourceIndex+1}`).join('; ')));
 const controls=[['Earlier training-reading radius (N·m)','trainingRadius',.02],['Acquired reading radius (N·m)','receivingRadius',c.receipt.bounded?.radii.jointTorque??.01]].map(([label,key,value])=>{const wrapper=el('label',label+' '),input=el('input');input.type='number';input.min='0';input.max='1000000';input.step='any';input.value=String(value);input.setAttribute('aria-label',label);input.dataset.historicalRadius=key;wrapper.append(input);host.append(wrapper);return {key,input};});
 const search=el('div');host.append(search);
 renderSharedTraining(search,c.model,c.training,c.receiving,controls,{description:'Explicit action on the original pre-acquisition training prefix and this selected acquired course. Search for one bounded training-offset vector that explains every received reading, or a checked separator. Exact coordinates and ordinary least squares only. Neither result rewrites the fixed earlier prediction or establishes physical truth; search exhaustion stays unresolved.'});
}
