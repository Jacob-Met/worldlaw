import {contrastWitness} from './prediction-contrast.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const number=value=>Number(value.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6});
export function renderPredictionContrasts(output,report){
 const section=node('section');section.id='prediction-contrasts';section.setAttribute('aria-labelledby','prediction-contrasts-heading');
 const heading=node('h3','Do the held-out changes agree with one shared perturbation?');heading.id='prediction-contrasts-heading';section.append(heading);
 const status=node('p');status.className='contrast-status';status.setAttribute('role','status');section.append(status);
 if(!report.contrastAssessed){status.textContent=`Pairwise contrast check unassessed: ${report.status}${report.reason?` (${report.reason})`:''}. The marginal reading comparison above remains available when computed. No pair subset was substituted.`;section.append(node('p',report.interpretation));output.append(section);return;}
 status.textContent=`${report.outsideCount} of ${report.expectedPairCount} receiving pairs outside the shared-perturbation contrast range; ${report.boundaryCount} numerically unresolved; ${report.notExcludedCount} not excluded. All ${report.receivingCount} receiving rows contribute to this complete pair course. These are necessary checks, not joint feasibility.`;
 section.append(node('p','Each comparison is the first listed row minus the second. Shared training-reading errors are combined before their absolute bounds. This can expose a contradiction even when both individual reading intervals overlap.'));
 const label=node('label','Inspect receiving pair '),select=node('select');select.setAttribute('aria-label','Receiving contrast pair');
 for(const pair of report.pairs){const option=node('option',`${pair.firstRow+1} minus ${pair.secondRow+1}: ${pair.status}`);option.value=String(pair.index);select.append(option);}label.append(select);section.append(label);
 select.value=String((report.pairs.find(p=>p.status==='outside')??report.pairs[0]).index);
 const detail=node('div');detail.className='contrast-detail';section.append(detail);
 const show=()=>{
  const pair=report.pairs[Number(select.value)],witness=contrastWitness(report,pair.index),first=report.marginal.rows[pair.firstRow],second=report.marginal.rows[pair.secondRow];
  Object.assign(detail.dataset,{pairIndex:String(pair.index),firstRow:String(pair.firstRow),secondRow:String(pair.secondRow),center:String(pair.center),radius:String(pair.radius),observedCenter:String(pair.observedCenter),observedRadius:String(pair.observedRadius),predictionLower:String(pair.prediction[0]),predictionUpper:String(pair.prediction[1]),observationLower:String(pair.observation[0]),observationUpper:String(pair.observation[1]),status:pair.status});
  const coordinates=r=>`command ${number(r.input.command)}, angle ${number(r.input.position)}, rate ${number(r.input.rate)}`;
  detail.replaceChildren(node('p',`Rows ${pair.firstRow+1} minus ${pair.secondRow+1}: ${pair.status}. Predicted contrast ${pair.prediction.map(number).join(' to ')} N·m; observed contrast ${pair.observation.map(number).join(' to ')} N·m.`),node('p',`First row: ${coordinates(first)}. Second row: ${coordinates(second)}. Their marginal dispositions are ${first.status} and ${second.status}.`),node('p',`Shared-reading contrast radius ${number(pair.radius)} N·m; declared receiving contrast radius ${number(pair.observedRadius)} N·m. Engineering boundary tolerance ${pair.numericalTolerance} N·m.`),node('p','Upper-endpoint witness: add these offsets to all training readings in retained order, refit the unchanged structure, then subtract the second prediction from the first. Negate every offset for the lower endpoint. Other pairs can require different witnesses.'),node('p',witness.upperWitnessOffsets.map((value,index)=>`${index+1}: ${number(value)}`).join('; ')));
 };select.addEventListener('change',show);show();
 section.append(node('p',report.interpretation),node('p',report.numericalQualification),node('p','A common receiving offset cancels from these differences; the marginal comparison remains necessary. Reopen the source notebook and redeclare both reading radii to recompute. Saved derived results are not accepted as evidence.'));
 output.append(section);
}
