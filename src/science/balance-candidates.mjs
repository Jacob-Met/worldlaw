import {prepareTorquePredictor, DiscoveryError} from './torque-discovery.mjs';

export const BALANCE_SCAN_SCHEMA = 'worldlaw.balance-candidates/v1';
export const MAX_BALANCE_CELLS = 4096;
export const MAX_BALANCE_REFINEMENTS = 64;
const fail = (message, code = 'invalid_input') => { throw new DiscoveryError(message, code); };
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6;
const opposite = (a, b) => (a < 0 && b > 0) || (a > 0 && b < 0);
const interpretation = 'Numerical candidates of the declared executable law at zero rate and fixed command. This finite scan is not exhaustive: tangent roots, close pairs and unsampled oscillations can be missed. Floating-point zeros and sign changes are not rigorous root enclosures, physical equilibrium evidence, stability classifications or sticking/contact predictions.';

/** Refuse arithmetic collapse instead of manufacturing a sampled zero.
 * Evaluation itself stays with the maintained predictor and its term order.
 */
function guardProducts(terms, command, position) {
  for (const {id, coefficient} of terms) {
    if (coefficient === 0) continue;
    let feature;
    switch (id) {
      case 'command': feature = command; break;
      case 'spring': feature = position; break;
      case 'gravity': feature = Math.sin(position); break;
      case 'cosine': feature = Math.cos(position); break;
      case 'bias': feature = 1; break;
      case 'command_position':
        feature = command * position;
        if (command !== 0 && position !== 0 && feature === 0)
          fail('A nonzero command-position feature underflows during this scan.', 'unresolved_numeric');
        break;
      case 'cubic':
        feature = position ** 3;
        if (position !== 0 && feature === 0)
          fail('A nonzero cubic feature underflows during this scan.', 'unresolved_numeric');
        break;
      case 'rate': case 'coulomb': case 'quadratic': case 'rate_squared':
        feature = 0; break;
      default: fail('The balance scan does not support every model term.', 'unsupported_term');
    }
    const contribution = coefficient * feature;
    if (!Number.isFinite(feature) || !Number.isFinite(contribution) ||
        (feature !== 0 && contribution === 0))
      fail('A nonzero term cannot be represented during this scan.', 'unresolved_numeric');
  }
}

function vanishesAtRest(term, command) {
  return term.coefficient === 0 ||
    ['rate', 'coulomb', 'quadratic', 'rate_squared'].includes(term.id) ||
    (command === 0 && ['command', 'command_position'].includes(term.id));
}

/**
 * A bounded inspection of an existing law; no fit, trajectory or new datum.
 * minPosition/maxPosition are unwrapped radians in the law's existing frame.
 * Every failed evaluation refuses the whole scan; no gap is bridged.
 */
export function scanBalanceCandidates(model, {
  command = 0, minPosition, maxPosition, cells = 256, refinements = 48,
} = {}) {
  if (!finite(command) || !finite(minPosition) || !finite(maxPosition) ||
      minPosition >= maxPosition)
    fail('Use a finite fixed command and an increasing angle range within +/-1000000.');
  if (!Number.isInteger(cells) || cells < 1 || cells > MAX_BALANCE_CELLS ||
      !Number.isInteger(refinements) || refinements < 1 || refinements > MAX_BALANCE_REFINEMENTS)
    fail('Use 1 to 4096 scan cells and 1 to 64 bisections per sign change.', 'work_limit');
  prepareTorquePredictor(model);
  const snapshot = {schema:model.schema, terms:model.terms.map(({id,coefficient})=>({id,coefficient}))};
  const torque = prepareTorquePredictor(snapshot);
  const result = {
    schema:BALANCE_SCAN_SCHEMA,
    source:{model:snapshot, command, rate:0},
    settings:{minPosition, maxPosition, cells, refinements},
    units:{position:'rad', command:'N*m', rate:'rad/s', residual:'N*m'},
    status:'finite_scan', evaluations:0, candidates:[],
    coverage:{exhaustive:false, allTermsVanishAtRest:false},
    interpretation,
  };
  if (snapshot.terms.every(term=>vanishesAtRest(term,command))) {
    result.status = 'all_terms_vanish_at_rest';
    result.coverage.allTermsVanishAtRest = true;
    return result;
  }
  const evaluate = position => {
    guardProducts(snapshot.terms, command, position);
    result.evaluations++;
    return {position, residual:torque(command, position, 0)};
  };
  const width = maxPosition - minPosition;
  const samples = [];
  for (let i=0; i<=cells; i++) {
    const position = i===0 ? minPosition : i===cells ? maxPosition : minPosition + width * (i/cells);
    if (!Number.isFinite(position) || (i && position <= samples[i-1].position))
      fail('The requested grid has indistinguishable floating-point positions.', 'unresolved_numeric');
    samples.push(evaluate(position));
  }
  for (let i=0; i<samples.length; i++) {
    const sample = samples[i];
    if (sample.residual === 0) {
      result.candidates.push({
        kind:'sampled_zero', position:sample.position, residual:sample.residual,
        initialBracket:[sample.position,sample.position],
        finalBracket:[sample.position,sample.position], endpointResiduals:[0,0],
        iterations:0, termination:'floating_zero',
      });
    }
    if (i===samples.length-1 || !opposite(sample.residual,samples[i+1].residual)) continue;
    let left = sample, right = samples[i+1];
    let iterations = 0, termination = 'iteration_limit';
    const initialBracket = [left.position,right.position];
    for (; iterations<refinements;) {
      const midpoint = left.position + (right.position-left.position)/2;
      if (midpoint === left.position || midpoint === right.position) {
        termination = 'adjacent_floats';
        break;
      }
      const middle = evaluate(midpoint);
      iterations++;
      if (middle.residual === 0) {
        left = middle; right = middle;
        termination = 'floating_zero';
        break;
      }
      if (opposite(left.residual,middle.residual)) right = middle;
      else left = middle;
    }
    const best = Math.abs(left.residual) <= Math.abs(right.residual) ? left : right;
    result.candidates.push({
      kind:'sign_change', position:best.position, residual:best.residual,
      initialBracket, finalBracket:[left.position,right.position],
      endpointResiduals:[left.residual,right.residual], iterations, termination,
    });
  }
  return result;
}
