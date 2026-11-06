import {sampleLocalMotionComparison} from './local-motion-comparison.mjs';

const node=(tag,text)=>{
  const out=document.createElement(tag);
  if(text!==undefined)out.textContent=text;
  return out;
};
// Preserve small nonzero values rather than rounding them to a displayed zero.
const number=value=>Number.isFinite(value)?Number(value.toPrecision(5)).toString():'unavailable';
const refusal=response=>response.error?.message||response.reason||'Local response unavailable.';
const mode=value=>number(value.real)+(value.imaginary===0?'':(value.imaginary<0?' − ':' + ')+number(Math.abs(value.imaginary))+'i');

/** Display a frozen comparator report on the existing clock; never solve or fit here. */
export function mountLocalMotionComparison(container) {
  let report=null,index=0,label='';
  const details=node('details');
  details.id='studio-local-motion-comparison';details.hidden=true;
  const summary=node('summary','Inspect local response at this instant');
  const source=node('p');source.id='studio-local-motion-source';
  const clock=node('p');clock.id='studio-local-motion-time';clock.setAttribute('aria-live','off');
  const scope=node('p','Each derivative and frozen mode belongs to this law’s own returned state. These are floating-point local calculations, not finite-time growth, nonlinear stability, physical validation or between-sample bounds.');
  const totals=node('p');totals.id='studio-local-motion-counts';
  const region=node('div');region.className='motion-comparison-table-wrap';
  region.tabIndex=0;region.setAttribute('role','region');
  region.setAttribute('aria-label','Local response of every original competitive law at the shared sample');
  const table=node('table');
  const caption=node('caption','Original order and complete population; identical law labels do not merge rows.');
  const head=node('thead'),header=node('tr');
  for(const text of ['Law / equation','Own executed state','Torque derivatives','Frozen modes (1/s) / availability']) {
    const th=node('th',text);th.scope='col';header.append(th);
  }
  const body=node('tbody');body.id='studio-local-motion-rows';
  head.append(header);table.append(caption,head,body);region.append(table);
  details.append(summary,source,clock,totals,region,scope);container.append(details);

  function clearRows(){body.replaceChildren();}
  function rowFor(outcome,state,response) {
    const row=node('tr');row.dataset.originalIndex=String(outcome.index);
    const law=node('th','L'+(outcome.index+1)+' · '+(outcome.equation||outcome.id||'Unlabelled law'));
    law.scope='row';
    const own=node('td',state?'θ '+number(state.position)+' rad · ω '+number(state.rate)+' rad/s':'No complete executed trajectory');
    const derivatives=node('td'),modes=node('td');
    if(response.status!=='computed') {
      row.dataset.status='refused';derivatives.textContent='Unavailable';
      modes.textContent='Refused: '+refusal(response);
    } else {
      const local=response.row;row.dataset.status=local.status;
      derivatives.textContent='∂τ/∂θ '+number(local.torqueByPosition)+' N·m/rad; ∂τ/∂ω '+number(local.torqueByRate)+' N·m·s/rad';
      modes.textContent=local.modes?.status==='available'
        ? local.modes.eigenvalues.map(mode).join('; ')+(local.modes.nearRepeated?' · near-repeated modes':'')
        : local.status+': '+(local.reason||local.modes?.reason||'Frozen modes unavailable.');
    }
    row.append(law,own,derivatives,modes);body.append(row);
  }
  function paint() {
    if(!report||!details.open)return;
    clearRows();
    const counts=report.responseCounts;
    totals.textContent=counts.computedLaws+' of '+report.candidateCount+' original laws have a computed response course; '+counts.refusedLaws+' refused. Whole-course sample counts: '+counts.available+' available, '+counts.nonsmooth+' nonsmooth, '+counts.unresolvedNumeric+' numerically unresolved. These counts are not counts at the selected instant.';
    source.textContent=label;
    // A fully refused motion report still exposes every original refusal.
    if(!report.motion.results.some(row=>row.status==='completed')) {
      clock.textContent='No shared executed instant is available.';
      for(const outcome of report.results)rowFor(outcome,null,outcome.response);
      return;
    }
    try {
      const sample=sampleLocalMotionComparison(report,index);
      clock.textContent='Exact sample '+index+' · t '+number(sample.time)+' s · inertia '+number(sample.execution.settings.inertia)+' kg·m² · fixed command '+number(sample.execution.settings.command)+' N·m';
      for(const outcome of sample.results)rowFor(outcome,outcome.state,outcome.response);
    } catch(error) {
      clearRows();
      clock.textContent='Local readout unavailable: '+error.message;
      for(const outcome of report.results) {
        const row=node('tr');row.dataset.originalIndex=String(outcome.index);
        const law=node('th','L'+(outcome.index+1)+' · '+(outcome.equation||outcome.id||'Unlabelled law'));law.scope='row';
        const cell=node('td',outcome.response.status==='refused'?'Refused: '+refusal(outcome.response):'No value substituted for the unavailable exact sample.');
        cell.colSpan=3;row.append(law,cell);body.append(row);
      }
    }
  }
  details.addEventListener('toggle',paint);
  return {
    setReport(value,sourceLabel) {
      report=value;label=sourceLabel;index=0;clearRows();
      details.hidden=false;source.textContent=label;clock.textContent='Open to inspect the shared clock’s exact sample.';
      totals.textContent='';paint();
    },
    setSample(value) {index=value;paint();},
    unavailable(reason) {
      report=null;label='';clearRows();details.hidden=false;
      source.textContent='Local response comparison unavailable for this source.';
      clock.textContent=reason;totals.textContent='';
    },
    retire() {
      report=null;label='';index=0;clearRows();details.hidden=true;
      source.textContent='';clock.textContent='';totals.textContent='';
    }
  };
}

