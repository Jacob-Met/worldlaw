# Continuous actuator experiments

Worldlaw can now design and execute a continuous, amplitude-scheduled input from fitted trajectory alternatives. This is an integration capability. It does not qualify the twenty-two-law or independent twenty-law discovery frontier, establish unique structure, or reverse the failed primary comparison in [the prefix experiment](NOISY_PREFIX_RESULTS.md).

## The actuator contract

A `worldlaw.hann-bursts/v1` waveform has three adjacent, equal-duration bursts. In the local clock of burst i,

u_i(t) = A_i sin²(πt/L) sin(2π f_i t + φ_i), 0 ≤ t ≤ L.

The frequency, phase and allocation of total energy vary continuously. The envelope and its first derivative vanish at joins. The same scalar waveform may multiply a declared spatial or kinetic actuator profile.

The descriptor contains `duration`, three `cycles` measured over the full duration, three `phases`, three positive `energyShares` summing to one, `rms` and `peak`. Amplitudes are computed from the exact trigonometric integral of the squared waveform. The total scalar command energy is rms² × duration. The maximum amplitude across bursts is a conservative peak bound; the realized maximum need not equal that bound. Infeasible energy/peak combinations are refused.

For a vector actuator, mean channel energy equals scalar energy multiplied by the mean square of its profile. A unit-amplitude cosine on 32 sites has mean square 1/2. Every comparison must fix the same complete profile, initial condition, observation convention, energy target and peak cap across arms.

The input schema `worldlaw.continuous-input/v1` carries a start time, waveform and, for a vector input, its complete profile. Unexpected descriptor metadata is refused. Compiled inputs are immutable snapshots. Recorded command samples must agree with that descriptor. Forecasts evaluate the descriptor at every Runge–Kutta stage. Recordings without it retain linear interpolation between recorded commands. Reused preparation must belong to the identical unchanged recording; foreign or fabricated preparation is refused.

Validation requires at least eight reported samples per cycle of the highest carrier-plus-envelope frequency. This is an explicit resolution rule, not a strict band-limit theorem: the joined bursts are continuously differentiable but not globally band-limited. The descriptor is known exogenous actuator information, available identically to all learners and baselines. It is never inferred from future measured states.

## Product use

POST to the existing `/api/trajectory/operator-discovery` endpoint with ordinary disjoint training and selection recordings and this optional request:

```json
{
  "continuousPlan": {
    "initialEstimate": [0.2, 0.1],
    "step": 0.025,
    "steps": 128,
    "search": {
      "rms": 0.1,
      "peak": 0.5,
      "cycleBounds": [2, 8],
      "maxEvaluations": 37,
      "method": "pattern",
      "seed": 8719
    }
  }
}
```

The response includes the complete executable input descriptor, every attempted schedule, exclusions, simulated separation, total scalar energy, mean channel energy and conservative physical peak bound. The initial state is explicitly a supplied estimate. The planner never obtains the evaluator's clean initial state or its reference records. Periodic requests additionally supply spacing and a complete profile.

The primary optimizer is deterministic coordinate pattern search over frequencies, phases and normalized positive energy weights. It scores the minimum pairwise, channel-scaled squared prediction distance of up to four fitted alternatives at every fourth sample. It halves its coordinate steps after a sweep with no improvement. This is a local fixed-committee prediction-separation objective. It is not Fisher information, nuisance-refitted distinguishability, a global maximum or a structural certificate.

All attempts, including infeasible waveforms and nonfinite hypothesis trajectories, consume the declared simulation budget. When no schedule is feasible, the search returns an explicit refusal. An objective score of zero carries no identification claim. The same module exposes a seeded one-draw random schedule that retains refusal without rejection sampling, plus an equal-budget random-search comparator. Neither function reads acquired outcomes.

The twenty-two-world dictionary also accepts the same continuous descriptor, and its pilot-only planner uses the released four-candidate committee with this continuous search. Its old integer-drive API remains available for historical regression.

## Independent simulator boundary

The independent source is pinned to Jacob-Met/nullgarden at `c8dfb73b3990d4737171aca83a1397529116ca23`. That version supports only a constant-amplitude chirp. The evaluator-only adapter therefore makes a deliberate, visible input-interface extension: it wraps the exported world RHS to substitute the new command at every original midpoint stage. It preserves the complete world object, including hidden-state initialization, projection, delayed history, equations, 24-substep integrator and noise generator.

The original `reference.plan` is preserved. The applied input is separately bound in `appliedActuator.input` and in the learner's observation descriptor. The adapter allocates recording identities from integer acquisition sequences assigned independently of the world; original producer IDs contain law names. Every actually applied midpoint command must equal the descriptor, including between observation samples. Only observations enter learning.

Parity checks compare all state samples, noise draws, references, recorded commands and hashes of every midpoint-stage command for the original chirp, over the four development laws, twenty evaluation laws, four omitted mechanisms and all three SNR levels. Continuous-command plumbing is checked separately. These checks provide no new law-identification score.

Four of the eight evaluation PDEs ignore the actuator. They remain in subsequent cohort denominators; the adapter never adds a forcing term to their equations. The producer's noise scales with the clean RMS of each recording, so equal actuator energy does not imply equal realized SNR or fixed sensor variance.

## Verification and remaining work

Run:

```sh
node --test tests/continuous-input.test.mjs tests/state-operator-continuous-http.test.mjs
NULLGARDEN_SOURCE=/path/to/frozen/nullgarden node scripts/verify-continuous-input-adapter.mjs output
npm run verify
```

The dedicated hosted workflow retains the original adapter report and runs it inside a Linux cgroup with 4 GiB memory, no swap and a two-CPU quota. The Node heap cap is separately declared and is not substituted for that kernel limit.

The full fresh comparison still requires prospective cohort registration, a genuinely free-support weak-form baseline, complete denominators, sham and omitted-mechanism results, and zero wrong structural admissions. This integration must not be represented as satisfying that gate.
