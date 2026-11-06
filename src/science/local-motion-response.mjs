import {prepareTorquePredictor, DiscoveryError} from './torque-discovery.mjs';

const supported = new Set(['command','rate','coulomb','spring','gravity',
  'quadratic','bias','command_position','rate_squared','cosine','cubic']);
const fail = (message, code = 'invalid_input') => { throw new DiscoveryError(message, code); };

// Compensation preserves small contributions when large signed terms cancel.
// These remain floating-point derivatives, not exact interval enclosures.
function sum(values) {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value)
      ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}
// A nonzero analytic factor may disappear before inertia scaling. Keep that
// loss unavailable; a true zero factor remains an ordinary zero derivative.
function product(...factors) {
  if (factors.some(value=>value === 0)) return 0;
  const value = factors.reduce((total,factor)=>total * factor, 1);
  return value === 0 ? null : value;
}
function partials(id, coefficient, command, position, rate) {
  switch (id) {
    case 'spring': return [coefficient, 0];
    case 'gravity': return [product(coefficient, Math.cos(position)), 0];
    case 'cosine': return [product(-coefficient, Math.sin(position)), 0];
    case 'cubic': return [product(3, coefficient, position, position), 0];
    case 'command_position': return [product(coefficient, command), 0];
    case 'rate': return [0, coefficient];
    case 'quadratic': return [0, product(2, coefficient, Math.abs(rate))];
    case 'rate_squared': return [0, product(2, coefficient, rate)];
    case 'command': case 'bias': case 'coulomb': return [0, 0];
    default: return fail('Local response does not support every model term.', 'unsupported_term');
  }
}
const unresolved = reason => ({status:'unresolved_numeric', reason, eigenvalues:null,
  pattern:null, kind:null, nearRepeated:null});

function modes(positionGradient, rateGradient) {
  const a = positionGradient, b = rateGradient;
  if (a === 0 && b === 0) return {status:'available', kind:'repeated-real',
    eigenvalues:[{real:0, imaginary:0},{real:0, imaginary:0}],
    pattern:'position_drift', nearRepeated:true};
  const scale = Math.max(Math.abs(b), Math.sqrt(Math.abs(a)));
  const bs = b / scale, as = (a / scale) / scale;
  const discriminant = bs * bs + 4 * as;
  const nearRepeated = Math.abs(discriminant) <=
    32 * Number.EPSILON * (bs * bs + 4 * Math.abs(as));
  let eigenvalues, kind;
  if (discriminant < 0) {
    const real = b / 2, imaginary = scale * Math.sqrt(-discriminant) / 2;
    if (!Number.isFinite(imaginary) || imaginary === 0 || (b !== 0 && real === 0))
      return unresolved('The conjugate-mode components cannot be represented at this scale.');
    eigenvalues = [{real, imaginary}, {real, imaginary:-imaginary}];
    kind = 'complex-conjugate';
  } else {
    // Product recovery retains the slow mode under strong rate feedback.
    const large = scale * (bs / 2 + (b < 0 ? -1 : 1) * Math.sqrt(discriminant) / 2);
    const small = large === 0 ? 0 : -a / large;
    if (!Number.isFinite(large) || !Number.isFinite(small) ||
        (a !== 0 && (large === 0 || small === 0)))
      return unresolved('A nonzero real mode cannot be represented at this scale.');
    eigenvalues = [large, small].sort((x,y)=>x-y).map(real=>({real, imaginary:0}));
    kind = discriminant === 0 ? 'repeated-real' : 'distinct-real';
  }
  const pattern = a > 0 ? 'one_growing_one_decaying'
    : a < 0 ? (b < 0 ? 'decaying' : b > 0 ? 'growing' : 'neutral_oscillation')
    : b < 0 ? 'neutral_position_decaying_rate' : 'neutral_position_growing_rate';
  return {status:'available', eigenvalues, kind, pattern, nearRepeated};
}

/**
 * Frozen local response along an executed scalar trajectory. It does not fit,
 * choose a law, change the trajectory, or establish finite-horizon stability.
 * In particular, instantaneous modes at moving states are not global growth rates.
 */
export function localMotionResponse(model, trajectory, {inertia, command = 0} = {}) {
  if (typeof inertia !== 'number' || !Number.isFinite(inertia) || inertia <= 0 || inertia > 1e12 ||
      typeof command !== 'number' || !Number.isFinite(command) || Math.abs(command) > 1e6)
    fail('Local motion response needs positive bounded inertia and finite fixed command.');
  // Reuse maintained admission, then validate the exact private snapshot too.
  prepareTorquePredictor(model);
  const snapshot = {schema:model.schema,
    terms:model.terms.map(({id,coefficient})=>({id,coefficient}))};
  const torque = prepareTorquePredictor(snapshot);
  if (snapshot.terms.some(term=>!supported.has(term.id)))
    fail('Local response does not support every model term.', 'unsupported_term');
  if (!Array.isArray(trajectory) || trajectory.length < 2 || trajectory.length > 10001)
    fail('Local motion response needs 2 to 10001 executed states.');
  const nonzeroCoulomb = snapshot.terms.some(term=>term.id === 'coulomb' && term.coefficient !== 0);
  const counts = {available:0, nonsmooth:0, unresolvedNumeric:0, stationaryEquation:0};
  const rows = trajectory.map((state,index)=>{
    if (!state || !Number.isFinite(state.time) || state.time < 0 || state.time > 1000 ||
        (index && state.time <= trajectory[index-1].time))
      fail('Executed-state times must increase within 0 to 1000 seconds.');
    const position = state.position, rate = state.rate;
    const jointTorque = torque(command, position, rate);
    const derivatives = snapshot.terms.map(term=>partials(term.id,term.coefficient,command,position,rate));
    const torqueByPosition = derivatives.some(value=>value[0] === null)
      ? null : sum(derivatives.map(value=>value[0]));
    const nonsmooth = nonzeroCoulomb && rate === 0;
    const torqueByRate = nonsmooth || derivatives.some(value=>value[1] === null)
      ? null : sum(derivatives.map(value=>value[1]));
    const stationaryEquation = rate === 0 && jointTorque === 0;
    if (stationaryEquation) counts.stationaryEquation++;
    const row = {index, time:state.time, position, rate, jointTorque, stationaryEquation,
      torqueByPosition, torqueByRate,
      positionResponse:torqueByPosition === null ? 'unavailable' : torqueByPosition < 0 ? 'restoring' : torqueByPosition > 0 ? 'amplifying' : 'zero_linear_response',
      rateResponse:torqueByRate === null ? 'unavailable'
        : torqueByRate < 0 ? 'opposes_rate_perturbation' : torqueByRate > 0 ? 'reinforces_rate_perturbation' : 'zero_linear_response',
      status:null, jacobian:null, modes:null};
    if (nonsmooth) {
      counts.nonsmooth++; row.status = 'nonsmooth';
      row.reason = 'Nonzero sign-rate torque has no ordinary derivative at zero rate; no sticking or crossing model is inferred.';
      return row;
    }
    if (torqueByPosition === null || torqueByRate === null) {
      counts.unresolvedNumeric++; row.status = 'unresolved_numeric';
      row.reason = 'A nonzero analytical derivative contribution is below representable finite values.';
      return row;
    }
    const a = torqueByPosition / inertia, b = torqueByRate / inertia;
    if (![a,b].every(Number.isFinite) || (torqueByPosition !== 0 && a === 0) ||
        (torqueByRate !== 0 && b === 0)) {
      counts.unresolvedNumeric++; row.status = 'unresolved_numeric';
      row.reason = 'The declared inertia scales a nonzero derivative outside representable finite values.';
      return row;
    }
    row.jacobian = [[0,1],[a,b]];
    row.modes = modes(a,b);
    row.status = row.modes.status;
    if (row.status === 'available') counts.available++;
    else counts.unresolvedNumeric++;
    return row;
  });
  return {schema:'worldlaw.local-motion-response/v1',
    source:{model:snapshot,inertia,command}, rows, counts,
    units:{torqueByPosition:'N·m/rad', torqueByRate:'N·m·s/rad', eigenvalue:'1/s'},
    interpretation:'Analytical floating-point derivatives of the declared executable law, evaluated at every supplied executed state. Frozen local modes at a moving state do not establish equilibrium, finite-horizon growth, nonlinear stability or physical truth. No between-sample or error enclosure is claimed.'};
}
