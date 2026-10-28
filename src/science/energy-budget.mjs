import {predict} from './torque-discovery.mjs';
const accountedTerms=new Set(['command','command_position','rate','coulomb','spring','gravity','quadratic','bias','cubic']);

/** Sampled accounting of an executable law, not a physical energy certificate.
 * Angles use the model's radian convention. Command work includes uθ coupling.
 * No trajectory observations enter model fitting through this diagnostic.
 */
export function energyBudget(model, trajectory, {inertia, command = 0} = {}) {
  if (!Number.isFinite(inertia) || inertia <= 0 || inertia > 1e12 ||
      !Number.isFinite(command) || Math.abs(command) > 1e6)
    throw new Error('Energy accounting needs positive bounded inertia and finite command.');
  // Use the maintained executable-model admission, including duplicate terms.
  predict(model, {position:0, rate:0, command});
  if(model.terms.some(term=>!accountedTerms.has(term.id)))
    throw new Error('Energy accounting does not support every term in this model.');
  if (!Array.isArray(trajectory) || trajectory.length < 2 || trajectory.length > 10001)
    throw new Error('Energy accounting needs 2 to 10001 executed states.');
  const c = Object.fromEntries(model.terms.map(t => [t.id,t.coefficient]));
  const coefficient = id => c[id] ?? 0;
  const initial = trajectory[0]?.position;
  if (!Number.isFinite(initial)) throw new Error('Invalid initial angle.');
  // Difference forms avoid subtracting large nearly equal absolute potentials.
  const potential = p => {
    const d = p-initial;
    return -coefficient('spring')*d*(p+initial)/2
      -coefficient('gravity')*2*Math.sin((p+initial)/2)*Math.sin(d/2)
      -coefficient('cubic')*d*(p+initial)*(p*p+initial*initial)/4
      -coefficient('bias')*d;
  };
  let rateWork=0, positiveRateWork=0;
  const rows=[];
  for (let i=0;i<trajectory.length;i++) {
    const state=trajectory[i];
    if (!state || !Number.isFinite(state.time) || state.time < 0 || state.time > 1000 ||
        (i && state.time <= trajectory[i-1].time))
      throw new Error('State times must be finite, increasing and within 0 to 1000 seconds.');
    const {position:p,rate:v}=state;
    predict(model,{position:p,rate:v,command});
    const kinetic=inertia*v*v/2;
    const stored=kinetic+potential(p);
    const commandPower=command*(coefficient('command')+coefficient('command_position')*p)*v;
    // Command is fixed for this execution, so integrate its affine angle
    // dependence analytically. Endpoint displacement retains reversals and
    // avoids command-power quadrature error on sparsely sampled motion.
    const commandWork=command*(p-initial)*
      (coefficient('command')+coefficient('command_position')*(p+initial)/2);
    const ratePower=coefficient('rate')*v*v+coefficient('coulomb')*Math.abs(v)+coefficient('quadratic')*Math.abs(v)**3;
    const previous=rows.at(-1);
    if(previous) {
      const h=state.time-previous.time;
      rateWork+=h*(previous.ratePower+ratePower)/2;
      positiveRateWork+=h*(Math.max(0,previous.ratePower)+Math.max(0,ratePower))/2;
    }
    const energyChange=stored-(rows[0]?.storedEnergy ?? stored);
    const balanceResidual=energyChange-commandWork-rateWork;
    const row={time:state.time,kineticEnergy:kinetic,potentialEnergy:potential(p),storedEnergy:stored,
      energyChange,commandPower,ratePower,commandWork,rateWork,positiveRateWork,balanceResidual};
    if(!Object.values(row).every(Number.isFinite)) throw new Error('Energy accounting overflowed.');
    rows.push(row);
  }
  return {schema:'worldlaw.sampled-energy-budget/v1',units:{energy:'J',power:'W'},rows,
    final:rows.at(-1),maxAbsBalanceResidual:Math.max(...rows.map(r=>Math.abs(r.balanceResidual))),
    interpretation:'Model-relative kinetic and potential energy; fixed-command work uses angular displacement, while rate work uses trapezoidal quadrature on executed states. Positive rate work means modeled energy input on these samples, not physical activity or global passivity. Balance residual retains solver and sampled rate-work quadrature error; no convergence certificate.'};
}
