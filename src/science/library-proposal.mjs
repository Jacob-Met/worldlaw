import {discover, discoveryRobustWork, TERMS, DEFAULT_TERMS, DiscoveryError} from './torque-discovery.mjs';
import {SOFT_L1_MAX_WORK} from './robust-fit.mjs';

// A complete search of the already executable library, never of held-out rows.
// This is a training ranking proposal, not a claim of physical identification.
export const MAX_LIBRARY_PROPOSAL_WORK = 25_000_000;
export function libraryProposalWork(rowCount, termCount, maxTerms) {
  let combinations=1, work=rowCount;
  for(let k=1;k<=Math.min(termCount,maxTerms);k++) {
    combinations=combinations*(termCount-k+1)/k;
    work+=combinations*rowCount*(k*k+k+1);
  }
  return work;
}

export function proposeScalarLibrary(observations, requestedOptions={}) {
  const baseTerms=requestedOptions.terms??DEFAULT_TERMS;
  if(!Array.isArray(baseTerms)||!baseTerms.length||new Set(baseTerms).size!==baseTerms.length||
    baseTerms.some(id=>!TERMS.some(term=>term.id===id)))
    throw new DiscoveryError('The baseline needs unique maintained feature IDs.');
  const terms=[...baseTerms,...TERMS.map(term=>term.id).filter(id=>!baseTerms.includes(id))];
  const maxTerms=requestedOptions.maxTerms??Math.min(4,baseTerms.length);
  if(!Number.isInteger(maxTerms)||maxTerms<0||maxTerms>baseTerms.length)
    throw new DiscoveryError('The baseline maximum term count is invalid.');
  if(!Array.isArray(observations))throw new DiscoveryError('Expected original training observations.');
  const reservedWork=libraryProposalWork(observations.length,baseTerms.length,maxTerms)+
    libraryProposalWork(observations.length,terms.length,maxTerms);
  if(reservedWork>MAX_LIBRARY_PROPOSAL_WORK)
    throw new DiscoveryError(`Complete library comparison needs ${reservedWork} work units; limit ${MAX_LIBRARY_PROPOSAL_WORK}. No partial ranking is produced.`,'work_limit');
  const robustWork=discoveryRobustWork(observations.length,{...requestedOptions,terms:baseTerms,maxTerms})+
    discoveryRobustWork(observations.length,{...requestedOptions,terms,maxTerms});
  if(robustWork>SOFT_L1_MAX_WORK)
    throw new DiscoveryError(`Complete robust library comparison needs ${robustWork} work units; limit ${SOFT_L1_MAX_WORK}. No partial ranking is produced.`,'work_limit');
  // Reserve both complete robust searches before either starts. Never silently
  // substitute least squares for another declared estimator.
  const baseline=discover(observations,{...requestedOptions,terms:baseTerms,maxTerms});
  const expanded=discover(observations,{...requestedOptions,terms,maxTerms});
  const addedTerms=expanded.selected.terms.map(term=>term.id).filter(id=>!baseTerms.includes(id));
  const scoreImprovement=baseline.selected.metrics.score-expanded.selected.metrics.score;
  const proposed=addedTerms.length>0&&scoreImprovement>baseline.options.ambiguityDelta;
  return {schema:'worldlaw.scalar-library-proposal/v1',status:proposed?'proposed':'no_clear_revision',
    baseline,expanded,addedTerms,scoreImprovement,reservedWork,robustWork,
    proposedTerms:proposed?[...baseTerms,...addedTerms]:null,
    interpretation:'Training-only finite-library ranking. Added terms are hypotheses; independent prediction and physical validity remain unestablished.'};
}
