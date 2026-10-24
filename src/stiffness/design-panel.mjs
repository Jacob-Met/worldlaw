import {MAX_ROWS} from '../data.mjs';
import {planStiffnessInputDesign} from './design.mjs';
const $=id=>document.getElementById(id);
const number=value=>Number(value.toPrecision(6)).toString();
const label=choice=>choice.family==='global'?'Global':choice.family==='piecewise'?`One hinge at ${number(choice.knot)} rad`:`Smooth cubic at origin ${number(choice.origin)} rad`;
const stateText=s=>`command ${number(s.command)} N·m; angle ${number(s.position)} rad; rate ${number(s.rate)} rad/s`;
function supportText(s){return s.requiredPerSide!==null?`${s.left} left / ${s.right} right distinct angles; require ${s.requiredPerSide} each; ${s.missing} missing`:s.requiredDistinctPositions!==null?`${s.distinctPositions} distinct angles; require ${s.requiredDistinctPositions}; ${s.missing} missing`:`${s.distinctPositions} distinct angles; no additional position-count gate for this structure`;}
function cell(tr,text,title,header){const td=document.createElement('td');td.setAttribute('headers',header);const caption=document.createElement('span');caption.className='design-cell-label';caption.setAttribute('aria-hidden','true');caption.textContent=title;td.append(caption,document.createTextNode(text));tr.append(td);return td;}
/** Inspection state only. The existing experiment request remains the acquisition authority. */
export function createInputDesignPanel({onFreeze,onActivity,onError}){
 let session=null,choiceKey=JSON.stringify({family:'global'}),plan=null;
 const select=$('input-design-structure'),button=$('input-design-freeze');
 const atCapacity=()=>session.study.dataset.observations.length>=MAX_ROWS;
 const capacityMessage=()=>`Observation capacity reached (${MAX_ROWS} rows). Input diagnostics remain inspectable, but another reading cannot be admitted. Start a new experiment with fewer retained training rows before freezing an input-design request.`;
 function request(index){if(atCapacity())throw Error(capacityMessage());onFreeze(index);}
 function render(){
  const settings=session.study.settings,offered=[{family:'global'},...settings.knots.map(knot=>({family:'piecewise',knot})),...(Object.hasOwn(settings,'cubicOrigin')?[{family:'cubic',origin:settings.cubicOrigin}]:[])];
  if(!offered.some(choice=>JSON.stringify(choice)===choiceKey))choiceKey=JSON.stringify(offered[0]);
  select.replaceChildren(...offered.map(choice=>{const option=document.createElement('option');option.value=JSON.stringify(choice);option.textContent=label(choice);return option;}));select.value=choiceKey;
  const rows=$('input-design-rows');rows.replaceChildren();button.disabled=true;delete button.dataset.designIndex;plan=null;
  try{plan=planStiffnessInputDesign(session.study.dataset.observations,settings,JSON.parse(choiceKey),session.permitted);}catch(error){$('input-design-status').dataset.status='unavailable';$('input-design-status').textContent='Input diagnostic unavailable: '+error.message;$('input-design-before').textContent='';for(const key of ['rank','coefficientCount','unresolved'])delete $('input-design-before').dataset[key];$('input-design-proposal').textContent='No design proposal admitted.';return;}
  const before=plan.before,status=$('input-design-status');status.dataset.status=plan.status;status.dataset.capacityReached=String(atCapacity());
  status.textContent=`${plan.status.replaceAll('_',' ')} · ${label(plan.declaration)} · ${plan.inputCount} retained training input rows. Only coordinates enter this diagnostic; no torque forecast is produced.`+(atCapacity()?' '+capacityMessage():'');
  const beforeText=$('input-design-before');beforeText.dataset.rank=before.rank;beforeText.dataset.coefficientCount=before.coefficientCount;beforeText.dataset.unresolved=before.unresolved;
  beforeText.textContent=`Numerical rank ${before.rank} / ${before.coefficientCount} coefficients; ${before.unresolved} unresolved. Maintained fitter rank check ${before.fitterRankPassed?'passed':'not passed'}. Position support: ${supportText(before.support)}. ${before.rankDiagnosticsAgree?'Rank diagnostics agree.':'Rank diagnostics disagree; the fitter check still governs support.'}`;
  const selected=plan.selected;
  $('input-design-proposal').textContent=selected?`Proposed state #${selected.index}: ${stateText(selected.state)}. After adding these coordinates: rank ${selected.after.rank} / ${selected.after.coefficientCount}; ${selected.after.unresolved} unresolved; ${selected.after.support.missing} missing position supports. ${selected.after.designSupported?'Rank and position gates would pass.':'The selected structure would still lack support.'} Extrapolated axes: ${selected.extrapolated.join(', ')||'none'}.`:
   plan.status==='work_limit'?`Prospective scan withheld: estimated work ${plan.work} exceeds ${plan.workLimit}. Reduce the declaration to inspect prospective gains.`:
   plan.status==='already_supported'?'This structure already passes its rank and position gates. That does not establish response adequacy or physical identifiability.':
   plan.status==='no_gain'?'No single declared input improves the admitted rank or position support. A different declared course may be needed.':'Declare permitted states to inspect their input support.';
  if(selected&&!atCapacity()){button.disabled=false;button.dataset.designIndex=selected.index;}
  for(const row of plan.ranked){const tr=document.createElement('tr');tr.dataset.designIndex=row.index;if(selected?.index===row.index)tr.className='selected';
   cell(tr,`#${row.index}: ${stateText(row.state)}`,'Declared state','design-state-heading');
   cell(tr,`${row.after.rank} / ${row.after.coefficientCount}; change ${row.rankChange>0?'+':''}${row.rankChange}; ${row.after.unresolved} unresolved; fitter ${row.after.fitterRankPassed?'passed':'not passed'}`,'Rank after adding input','design-rank-heading');
   cell(tr,supportText(row.after.support),'Position support after','design-support-heading');
   cell(tr,`${row.improves?'Improves support':'No admitted improvement'}; ${row.after.designSupported?'rank and position gates pass':'still unsupported'}${row.nonRegressing?'':'; numerical regression'}; extrapolated axes ${row.extrapolated.join(', ')||'none'}`,'Qualification','design-qualification-heading');
   const target=cell(tr,'','Request','design-request-heading'),freeze=document.createElement('button');freeze.type='button';freeze.dataset.designIndex=row.index;freeze.textContent='Freeze this declared state';freeze.disabled=atCapacity();freeze.addEventListener('click',()=>act(()=>request(row.index)));target.append(freeze);rows.append(tr);
  }
  if(!plan.ranked.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent=plan.status==='work_limit'?'Prospective rows withheld by the work limit.':'No permitted input rows.';tr.append(td);rows.append(tr);}
 }
 function act(action){onActivity();try{action();}catch(error){onError(error);}}
 select.addEventListener('change',()=>act(()=>{choiceKey=select.value;render();}));
 button.addEventListener('click',()=>act(()=>{if(!plan?.selected)throw Error('No input-design proposal is available.');request(plan.selected.index);}));
 return {update:next=>{session=next;render();}};
}
