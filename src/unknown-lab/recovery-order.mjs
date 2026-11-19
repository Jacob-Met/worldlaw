import { inspectRelaxationReads, planRelaxationReads } from './relaxation-order.mjs';
import { fitRecovery } from './recovery-response.mjs';

export const recoveryOrderDomain = Object.freeze({
  fast: Object.freeze([0.12,0.27]), slow: Object.freeze([0.74,0.88]),
  amplitude: Object.freeze([0.45,1.1]), error: 0.003, maxStride: 8,
});

// The delay schedule is selected before examining any notebook values.
// Challenges remain sealed, and duplicate independent recordings are never cherry-picked.
export function inspectRecoveryOrder(notebook, domain = recoveryOrderDomain) {
  const plan = planRelaxationReads(domain);
  if (plan.status !== 'separating-plan') return {plan,status:'unresolved',reason:'no-guaranteed-plan'};
  if (notebook.training.length < 2) return {plan,status:'unresolved',reason:'await-training'};
  const {training} = fitRecovery(notebook);
  const groups = plan.waits.map(wait => training.filter(row => row.delaySeconds === wait));
  if (groups.some(rows => rows.length > 1)) return {plan,status:'unresolved',reason:'duplicate-delay'};
  if (groups.some(rows => rows.length === 0)) return {plan,status:'unresolved',reason:'await-training'};
  const observations = [];
  for (const [row] of groups) {
    if (!row.qualified) return {plan,status:'unresolved',reason:'order-confounded'};
    if (row.boundary > domain.error) return {plan,status:'unresolved',reason:'screen-exceeds-budget'};
    observations.push({wait:row.delaySeconds, difference:row.estimate,recordingId:row.recordingId});
  }
  return {plan, observations, ...inspectRelaxationReads(observations,domain.error)};
}
