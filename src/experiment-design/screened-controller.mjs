/**
 * Add a numerical check to an existing experiment controller. The controller
 * continues to own its sessions, observations and portable history. Screening
 * results are recomputed evidence and are never serialized as trusted claims.
 */
import {
  qualifyTrajectoryPlan, QUALIFICATION_SCHEMA, TrajectoryPlanQualificationError,
} from './qualify-trajectory-plan.mjs';

const methods = ['createExperimentSession', 'planNextExperiment', 'acquireNextExperiment',
  'applyNextExperiment', 'experimentView', 'exportExperimentSession', 'restoreExperimentSession'];
const clone = value => value === null ? null : structuredClone(value);
const format = value => Number.isFinite(value) ? Number(value.toPrecision(4)).toString() : 'unavailable';

/**
 * controller is the established experiment-session module namespace. No
 * unpublished module is imported here. Its opaque sessions are never changed.
 * This factory only gates NEW acquisition; a previously acquired recording is
 * still evidence when the design that led to it has numerical shortcomings.
 */
export function withNumericalScreen(controller, screeningOptions = {}) {
  if (!controller || methods.some(name => typeof controller[name] !== 'function')) {
    throw new TypeError('Supply the complete existing experiment controller.');
  }
  if (!screeningOptions || typeof screeningOptions !== 'object' || Array.isArray(screeningOptions)) {
    throw new TypeError('Numerical screening settings must be an object.');
  }
  const options = clone(screeningOptions);
  const cache = new WeakMap();

  function screenValidated(session, view) {
    if (!view.plan) return null;
    if (cache.has(session)) return cache.get(session);
    let result;
    try {
      result = qualifyTrajectoryPlan(session.current.discovery, view.plan, options);
    } catch (error) {
      if (!(error instanceof TrajectoryPlanQualificationError)) throw error;
      result = {schema: QUALIFICATION_SCHEMA, status: 'unavailable',
        error: {code: error.code, message: error.message},
        recommendationChanged: false, acquisitionPerformed: false};
    }
    cache.set(session, result);
    return result;
  }

  function inspect(session) {
    // Validate with the owner before using cached results. Its input and ledger
    // checks continue to reject mutated or stale session objects.
    const view = controller.experimentView(session);
    return {view, qualification: screenValidated(session, view)};
  }

  function explanation(qualification) {
    if (!qualification) return '';
    if (qualification.status === 'unavailable') {
      return `This recommendation could not be checked numerically: ${qualification.error.message} ` +
        'Reduce the design workload or correct its settings, then plan again.';
    }
    if (qualification.status === 'numerically_unresolved') {
      const selected = qualification.selectedQualification;
      if (selected?.reason === 'not_all_models_compared') {
        return 'At least one retained model failed the finer-step comparison. ' +
          'The recommendation remains visible, but a new recording cannot be acquired from this unchecked design.';
      }
      return `The recommendation is sensitive to the solver step. The sampled disagreement is ` +
        `${format(selected?.disagreementRad)} rad and its two-step sensitivity is ` +
        `${format(selected?.pairwiseSensitivityRad)} rad. Plan again with a finer step or different release settings.`;
    }
    if (qualification.status === 'screen_passed') {
      return `The proposed release passed a numerical comparison at ` +
        `${format(qualification.diagnostics.coarseMaxStep)} s and ` +
        `${format(qualification.diagnostics.refinedMaxStep)} s steps. ` +
        'This checks solver sensitivity; it does not establish a physical law.';
    }
    return '';
  }

  function experimentView(session) {
    const {view, qualification} = inspect(session);
    const blocked = view.plan?.status === 'proposed' && qualification?.status !== 'screen_passed';
    const message = explanation(qualification);
    return {
      ...view,
      // A view projection cannot alter the owner's registered plan. Existing
      // panels already disable acquisition unless a plan is proposed.
      plan: blocked ? {...view.plan, status: 'numerically_unresolved'} : view.plan,
      numericalQualification: clone(qualification),
      acquisitionAllowed: Boolean(view.available && view.plan?.status === 'proposed' &&
        qualification?.status === 'screen_passed' && !view.acquisition),
      error: blocked ? [view.error, message].filter(Boolean).join(' ') : view.error,
      notice: !blocked && message ? [view.notice, message].filter(Boolean).join(' ') : view.notice,
    };
  }

  function planNextExperiment(session, requestedSettings = {}) {
    const next = controller.planNextExperiment(session, requestedSettings);
    inspect(next);
    return next;
  }

  function acquireNextExperiment(session, requestedOptions = {}) {
    const {view, qualification} = inspect(session);
    // Delegate original no-proposal and repeated-acquisition errors unchanged.
    if (view.plan?.status === 'proposed' && !view.acquisition && qualification?.status !== 'screen_passed') {
      throw new TrajectoryPlanQualificationError(explanation(qualification),
        qualification?.status === 'unavailable' ? 'numerical_screen_unavailable' : 'numerically_unresolved');
    }
    const next = controller.acquireNextExperiment(session, requestedOptions);
    if (qualification && next.plan === session.plan && next.current === session.current) {
      cache.set(next, qualification);
    }
    return next;
  }

  function restoreExperimentSession(text) {
    const session = controller.restoreExperimentSession(text);
    // Previously acquired evidence remains intact. Only the current pending
    // recommendation is screened, from the replayed training model and plan.
    inspect(session);
    return session;
  }

  return Object.freeze({
    ...controller, planNextExperiment, acquireNextExperiment, experimentView, restoreExperimentSession,
  });
}
