import {MAX_ROWS} from '../data.mjs';
import {RANK_TOLERANCE, fitLinearColumns, linearColumnRank} from '../science/linear-fit.mjs';
import {normalizeSettings, stiffnessDesignBasis} from './science.mjs';
import {normalizePermittedStates} from './experiment.mjs';

export const MAX_STIFFNESS_DESIGN_WORK = 2_000_000;
const need = (ok, message) => { if (!ok) throw new Error(message); };

function diagnose(basis) {
  const rank = linearColumnRank(basis.columns);
  // A zero right-hand side tests the maintained fitter's design admission only.
  // No coefficients from this diagnostic are exposed as a response model.
  const fitterRankPassed = fitLinearColumns(basis.columns, basis.inputs.map(() => 0)) !== null;
  return {rank, coefficientCount: basis.terms.length, unresolved: basis.terms.length-rank,
    fitterRankPassed, rankDiagnosticsAgree: (rank === basis.terms.length) === fitterRankPassed,
    support: {...basis.support}, designSupported: fitterRankPassed && basis.support.eligible};
}

/** One-step, input-only diagnostics for ONE explicitly offered structure. */
export function planStiffnessInputDesign(rawInputs, requestedSettings, choice, rawPermitted) {
  need(Array.isArray(rawInputs) && rawInputs.length > 0 && rawInputs.length <= MAX_ROWS,
    'Use 1–' + MAX_ROWS + ' retained input rows.');
  const settings = normalizeSettings(requestedSettings);
  const permitted = normalizePermittedStates(rawPermitted);
  const basis = stiffnessDesignBasis(rawInputs, settings, choice), before = diagnose(basis);
  const work = 3 * (basis.inputs.length + 1) * (permitted.length + 1) * basis.terms.length ** 2;
  const result = {schema: 'worldlaw.stiffness-input-design/v1',
    declaration: basis.declaration, terms: [...basis.terms], inputCount: basis.inputs.length,
    before, permittedCount: permitted.length, work, workLimit: MAX_STIFFNESS_DESIGN_WORK,
    rankTolerance: RANK_TOLERANCE, ranked: [], selected: null,
    method: 'one_step_declared_input_rank_and_position_support',
    interpretation: 'Only input coordinates enter this diagnostic. Numerical rank and position support do not establish response adequacy, physical identifiability, confidence, globally optimal design or authority to actuate. Unknown torque predictions remain absent.'};
  // Admission of the bounded baseline precedes this prospective-scan budget.
  if (work > MAX_STIFFNESS_DESIGN_WORK) return {...result, status: 'work_limit'};
  if (!permitted.length) return {...result, status: 'no_permitted_inputs'};
  const domain = Object.fromEntries(['command', 'position', 'rate'].map(axis => [axis,
    {min: Math.min(...basis.inputs.map(row => row[axis])), max: Math.max(...basis.inputs.map(row => row[axis]))}]));
  result.ranked = permitted.map((state, index) => {
    const after = diagnose(stiffnessDesignBasis([...basis.inputs, state], settings, basis.declaration));
    const rankChange = after.rank-before.rank, supportGain = before.support.missing-after.support.missing;
    const fitterRankGain = !before.fitterRankPassed && after.fitterRankPassed;
    // Normalized numerical rank can decrease when an extreme new row rescales columns.
    // Preserve that result and never promote a numerically regressing proposal.
    const nonRegressing = rankChange >= 0 && (!before.fitterRankPassed || after.fitterRankPassed);
    const improves = nonRegressing && (rankChange > 0 || supportGain > 0 || fitterRankGain);
    return {index, state: {...state}, after, rankChange, supportGain, fitterRankGain, nonRegressing, improves,
      extrapolated: ['command', 'position', 'rate'].filter(axis => state[axis] < domain[axis].min || state[axis] > domain[axis].max)};
  });
  result.ranked.sort((a, b) => Number(b.improves)-Number(a.improves) ||
    Number(b.after.designSupported)-Number(a.after.designSupported) || b.rankChange-a.rankChange ||
    Number(b.fitterRankGain)-Number(a.fitterRankGain) || b.supportGain-a.supportGain || a.index-b.index);
  result.status = before.designSupported ? 'already_supported' : result.ranked[0].improves ? 'proposed' : 'no_gain';
  if (result.status === 'proposed') result.selected = result.ranked[0];
  return result;
}
