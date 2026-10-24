import {profileStiffnessKnots} from './knot-profile.mjs';
import {evaluateStiffness} from './science.mjs';

const $ = id => document.getElementById(id);
const number = value => value !== 0 && Math.abs(value) < 1e-5 ? value.toExponential(2) : Number(value.toPrecision(5)).toString();
export function createKnotProfilePanel({onInspect, onOffer, onActivity, onError}) {
  let study = null, result = null;
  const status = $('knot-profile-status'), detail = $('knot-profile-detail');
  const grid = $('knot-profile-grid'), computed = $('knot-profile-inspect'), offer = $('knot-profile-offer');
  function reset() {
    result = null; grid.disabled = computed.disabled = offer.disabled = true;
    status.dataset.status = 'not_run'; delete status.dataset.knot;
    status.textContent = 'The declared grid is unchanged. Search the current training observations for a transition between its angles.';
    detail.textContent = '';
  }
  function render() {
    status.dataset.status = result.status;
    grid.disabled = !study.fit.selected;
    computed.disabled = offer.disabled = !result.proposed;
    delete status.dataset.knot;
    if (result.status === 'work_limit') {
      status.textContent = 'Complete profile withheld: this source exceeds the bounded search workload.';
      detail.textContent = 'No partial winner is offered. The existing declared-grid study remains available. Use a separately justified smaller training source to investigate this optional profile.';
      return;
    }
    if (result.status === 'baseline_rank_deficient' || result.status === 'insufficient_position_support' || result.status === 'unidentifiable') {
      status.textContent = 'No profile admitted: ' + result.status.replaceAll('_', ' ') + '.';
      detail.textContent = 'The unchanged nuisance columns need full numerical rank, and each hinge needs three distinct training angles on both sides. No substitute model was invented.';
      return;
    }
    if (!result.proposed) {
      status.textContent = 'The declared grid retains the preferred explanation. No better-scoring new change angle was found.';
    } else {
      const model = result.proposed, check = evaluateStiffness(model, study.dataset.heldOut);
      status.dataset.knot = model.knot;
      status.textContent = 'Computed candidate κ = ' + number(model.knot) + ' rad. Training RMSE: ' +
        number(result.improvement.trainingRmseBefore) + ' → ' + number(model.metrics.rmse) + ' N·m.';
      detail.textContent = (check.count ? 'Separate-check RMSE ' + number(check.rmse) + ' N·m across ' + check.count +
        ' supplied checks; ' + check.extrapolationCount + ' outside the training input ranges. ' : 'No separate checks are supplied. ') +
        'Checks did not generate or select this candidate. ';
    }
    if (!result.proposed) detail.textContent = '';
    const unresolved = result.intervals.filter(entry => ['projection_unavailable','projected_column_unavailable',
      'nonfinite_profile','stationary_unresolved','stationary_rounded_to_boundary'].includes(entry.status)).length;
    detail.textContent += result.examinedIntervals + ' observed-angle intervals inspected; ' + result.proposedKnots.length +
      ' computed angle proposals; ' + result.profile.filter(entry => entry.status !== 'fitted').length +
      ' native support/rank refusals retained.' + (unresolved ? ' ' + unresolved + ' stationary calculations remain unresolved or rounded.' : '') +
      ' This is a finite-precision hypothesis search, not a certified optimum or physical-cause finding.';
    if (result.proposed && study.settings.knots.length >= 101 && !study.settings.knots.includes(result.proposed.knot)) {
      offer.disabled = true;
      detail.textContent += ' The declared grid is full (101 angles); remove an angle and refit before adding another.';
    }
  }
  function act(action) { onActivity(); try { action(); } catch (error) { onError(error); } }
  $('knot-profile-run').addEventListener('click', () => act(() => {
    reset();
    result = profileStiffnessKnots(study.dataset.observations, study.settings);
    render();
    if (result.proposed) onInspect(result.proposed, true);
  }));
  grid.addEventListener('click', () => act(() => onInspect(study.fit.selected, false)));
  computed.addEventListener('click', () => act(() => { if (result?.proposed) onInspect(result.proposed, true); }));
  offer.addEventListener('click', () => act(() => {
    if (!result?.proposed) throw Error('Compute a new angle candidate first.');
    onOffer(result.proposed.knot);
  }));
  return {update: next => { study = next; reset(); }};
}
