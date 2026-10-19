/** A reproducible simulated instrument. The discovery module never imports this. */
const units = {command:'N·m', position:'rad', rate:'rad/s', jointTorque:'N·m'};
function generator(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
function validate(values) {
  if (!values || !['command','position','rate'].every(key => Number.isFinite(values[key]) && Math.abs(values[key]) <= 1e6))
    throw new Error('Virtual instrument requires finite command, position and rate.');
}
// Independently written oracle, separate from feature-library/prediction code.
function instrument({command, position, rate}) {
  return 1.7 * command - 0.25 * rate - 2.4 * Math.sin(position) + 0.12;
}
export function executeLab(values, {experimentIndex = 0, seed = 17} = {}) {
  validate(values);
  if (!Number.isInteger(experimentIndex) || experimentIndex < 0 || !Number.isInteger(seed)) throw new Error('Invalid virtual experiment identity.');
  const random = generator(seed + 65537 * (experimentIndex + 1));
  const noise = (random() - 0.5) * 0.002;
  const {command, position, rate} = values;
  return {command, position, rate, jointTorque:instrument(values) + noise};
}
export function createLab({seed = 17} = {}) {
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer.');
  const random = generator(seed);
  const initialSamples = Array.from({length:64}, (_, index) => {
    const values = {command:(random()-0.5)*1.2, position:(random()-0.5)*0.24, rate:(random()-0.5)*1.4};
    return executeLab(values, {seed, experimentIndex:index+100});
  });
  // Fixed evaluation conditions are never passed to discovery or the planner.
  const evaluationSamples = Array.from({length:61}, (_, index) => {
    const values = {command:0.45*Math.cos(index*1.731), position:-2.35+4.7*index/60, rate:0.65*Math.sin(index*2.193)};
    return {...values, jointTorque:instrument(values)};
  });
  const candidateInputs = Array.from({length:49}, (_, index) => ({command:0, position:-2.4+index*0.1, rate:0}));
  return {
    id:'virtual-geared-pendulum-v1', label:'Virtual geared pendulum', provenance:'synthetic_virtual_instrument',
    description:'A declared synthetic torque instrument. Initial observations span only ±0.12 rad; broad-angle interventions distinguish a spring from sinusoidal gravity. It does not represent a physical measurement.',
    initialSamples, evaluationSamples, candidateInputs, units,
    options:{noiseSigma:0.01, maxTerms:4, ambiguityDelta:6},
  };
}
