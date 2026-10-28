import {renderRateDissipation} from './rate-dissipation-panel.mjs';
import {energyBudget} from './energy-budget.mjs';
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const format=x=>Number(x.toPrecision(5)).toString();

export function renderEnergyBudget(container,model,trajectory,options) {
  container.replaceChildren(text('h3','Where the predicted energy goes'));
  try {
    const result=energyBudget(model,trajectory,options),last=result.final;
    const table=document.createElement('table');
    table.append(text('caption','Executed model accounting · joules (J)'));
    const body=document.createElement('tbody');
    for(const [label,value] of [
      ['Kinetic + potential change',last.energyChange],
      ['Work supplied by command',last.commandWork],
      ['Work from rate-dependent terms',last.rateWork],
      ['Positive rate-work portion',last.positiveRateWork],
      ['Remaining balance residual',last.balanceResidual],
      ['Largest absolute residual at sampled states',result.maxAbsBalanceResidual]]) {
      const row=document.createElement('tr'),heading=text('th',label);heading.scope='row';
      row.append(heading,text('td',format(value)));body.append(row);
    }
    table.append(body);container.append(table);
    container.append(text('p',last.positiveRateWork>0
      ? 'Rate-dependent terms supply energy on this sampled prediction. Inspect their signs before interpreting them as friction.'
      : 'No positive rate-work appears at these sampled states. This does not establish passivity between samples or beyond this trajectory.'));
    container.append(text('p',result.interpretation));
    container.append(text('p','Potential is relative to the initial angle and includes bias torque. A conservative unstable potential may release stored energy without positive rate-work. Inertia and fixed command are the simulation declarations; no measured energy or authenticated physical law is inferred.'));
    renderRateDissipation(container,model,trajectory);
  } catch(error) {
    container.append(text('p','Energy accounting unavailable: '+error.message));
  }
}
