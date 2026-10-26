/** Closed-form independent trajectory; the production integrator is not an oracle. */
export function covarianceRun(id, position, rate, {noise = .004, seed = 19, count = 241, step = .05} = {}) {
  const damping = .2, frequency = 2, w = Math.sqrt(frequency ** 2 - damping ** 2 / 4), b = (rate + damping * position / 2) / w;
  let state = seed;
  const random = () => {state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + 1) / 4294967297;};
  return {id, label: id, kind: 'synthetic', dynamics: 'unforced_scalar_rotation', inertia: null, initialRate: rate,
    source: {label: 'Independent analytic damped oscillator with authored position errors', recordingId: id},
    samples: Array.from({length: count}, (_, i) => {
      const time = i * step, clean = Math.exp(-damping * time / 2) * (position * Math.cos(w * time) + b * Math.sin(w * time));
      return {time, position: clean + noise * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random())};
    })};
}
export const covarianceOptions = {terms: ['rate', 'spring'], maxTerms: 2, windowDuration: 1, windowStride: .1, noiseSigma: .01};
export function covarianceBundle() {
  return {schema: 'worldlaw.angular-bundle/v1', units: {time: 's', position: 'rad', initialRate: 'rad/s'},
    trainingRuns: [covarianceRun('training-a', 1, .2), covarianceRun('training-b', -.7, .1, {seed: 271})],
    challengeRuns: [covarianceRun('separate-release', 1.3, -.4, {noise: 0, seed: 801})]};
}
