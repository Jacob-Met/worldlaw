/** Authored analytic oscillator recordings. Independent of the fitted solver.
 * Exact closed-form transitions of I θ'' + c θ' + k θ = g u(t-d) + b.
 */
import {RUN_UNITS} from './data.mjs';

export function commandTimingExample() {
  const inertia = .84, damping = .55, spring = 3.2, gain = 1.6, bias = .12, delay = .137, before = .2;
  const alpha = damping / (2 * inertia), omega = Math.sqrt(spring / inertia - alpha * alpha);
  function evolve(position, rate, command, dt) {
    const equilibrium = (gain * command + bias) / spring, a = position - equilibrium, b = (rate + alpha * a) / omega;
    const decay = Math.exp(-alpha * dt), cs = Math.cos(omega * dt), sn = Math.sin(omega * dt);
    return [equilibrium + decay * (a * cs + b * sn), decay * ((-alpha * a + omega * b) * cs + (-alpha * b - omega * a) * sn)];
  }
  function run(id, initial, pulses, cadence) {
    const times = Array.from({length: 241}, (_, i) => i * cadence);
    const transitions = pulses.map(([index, value]) => ({at: times[index], value}));
    const delayed = transitions.map(event => ({at: event.at + delay, value: event.value}));
    let position = initial[0], rate = initial[1], clock = 0, active = before, next = 0;
    const samples = times.map(time => {
      while (next < delayed.length && delayed[next].at <= time) {
        [position, rate] = evolve(position, rate, active, delayed[next].at - clock);
        clock = delayed[next].at; active = delayed[next++].value;
      }
      [position, rate] = evolve(position, rate, active, time - clock); clock = time;
      let command = before;
      for (const transition of transitions) {if (transition.at > time) break; command = transition.value;}
      return {time, position, command};
    });
    return {id, label: `Analytic delayed oscillator ${id}`, kind: 'synthetic', units: {...RUN_UNITS}, inertia, initialRate: initial[1],
      source: {label: 'Authored closed-form damped oscillator with held forcing; not a physical recording', recordingId: `analytic-${id}`,
        method: 'closed_form_piecewise_constant_forcing', trueDelaySeconds: delay}, samples};
  }
  return {bundle: {schema: 'worldlaw.trajectory-bundle/v1', label: 'Authored oscillator: command and motion do not start together', units: {...RUN_UNITS},
    trainingRuns: [run('training', [.4, -.2], [[0, .8], [23, -.6], [61, .3], [90, 1], [136, -.8], [189, .4]], .02)],
    challengeRuns: [run('separate', [-.3, .45], [[0, -.4], [17, .9], [67, -.7], [122, .5], [161, -.2], [209, .7]], .023)]},
    options: {delays: [0, .05, .1, .137, .2, .3], beforeStart: before, terms: ['command', 'rate', 'spring', 'bias'], noiseSigma: .00001, maxStep: .01}};
}
