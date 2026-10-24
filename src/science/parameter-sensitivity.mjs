import {evaluate, predict, TERMS} from './torque-discovery.mjs';
import {fitLinearColumns} from './linear-fit.mjs';

export const PARAMETER_SENSITIVITY_MAX_ROWS = 256;
/** Fixed-coordinate, fixed-structure least-squares response; not a confidence set. */
export function parameterSensitivity(model, observations, readingRadius = 0.01) {
  if (typeof readingRadius !== 'number' || !Number.isFinite(readingRadius) || readingRadius < 0 || readingRadius > 1e6) throw new Error('Reading radius must be finite and between zero and 1000000 N·m.');
  const original = evaluate(model, observations);
  const n = original.count;
  const base = {schema:'worldlaw.parameter-sensitivity/v1', count:n, readingRadius,
    terms:model.terms.map(t=>t.id), maxRows:PARAMETER_SENSITIVITY_MAX_ROWS,
    interpretation:'Coefficientwise response of unconstrained least squares to independently bounded torque-reading changes, conditional on fixed exact coordinates and the inspected structure. Not a confidence interval, feasible-law set, or physical identification.'};
  if (n > PARAMETER_SENSITIVITY_MAX_ROWS) return {...base,status:'work-limit',coefficients:[]};
  if (!n || n <= model.terms.length) return {...base,status:'insufficient-rows',coefficients:[]};
  const columns = model.terms.map(term => {
    const basis = {...model,terms:[{id:term.id,coefficient:1}]};
    return original.rows.map(row=>predict(basis,row));
  });
  const fitted = fitLinearColumns(columns, original.rows.map(r=>r.jointTorque));
  if (!fitted) return {...base,status:'rank-unavailable',coefficients:[]};
  const influence = model.terms.map(()=>[]);
  for (let row = 0; row < n; row++) {
    const target = Array(n).fill(0); target[row] = 1;
    const response = fitLinearColumns(columns,target);
    if (!response) return {...base,status:'rank-unavailable',coefficients:[]};
    response.coefficients.forEach((value,j)=>influence[j].push(value));
  }
  const coefficients = model.terms.map((term,j)=>{
    const weights = influence[j];
    const amplification = weights.reduce((sum,value)=>sum+Math.abs(value),0);
    const radius = readingRadius*amplification;
    const center = fitted.coefficients[j];
    const lower = center-radius, upper = center+radius;
    if (![amplification,radius,center,lower,upper].every(Number.isFinite)) throw new Error('Coefficient sensitivity arithmetic overflowed.');
    return {id:term.id,unit:TERMS.find(t=>t.id===term.id).coefficientUnit,inspectedCoefficient:term.coefficient,refittedCoefficient:center,
      inspectedToRefitShift:center-term.coefficient,amplification,radius,lower,upper,
      crossesZero:lower<=0 && upper>=0,influence:weights,
      upperWitnessOffsets:weights.map(value=>Math.sign(value)*readingRadius)};
  });
  return {...base,status:'computed',conditionEstimate:fitted.conditionEstimate,coefficients,
    numericalQualification:'Floating-point QR response; analytic linear perturbation formula, not outward-rounded certified interval arithmetic. Different coefficients generally require different witness perturbations.'};
}
