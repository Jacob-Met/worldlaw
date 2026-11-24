# Recover an affine oscillator from sampled state transitions

A state-only fit can have nearly zero weak residual while its continuous forecast is wrong at the sampling cadence. For v′=−2v sampled every second, each pair obeys (v₁−v₀)=λ̃(v₁+v₀)/2 with λ̃=2 tanh(−1)=−1.52318831. A triangular weak fit at this cadence returns that coefficient with maximum training residual 6.94e−17 on eight clean acquisitions. From unit velocity it forecasts 0.218016 after one second. The physical velocity is 0.135335. The state-transition receiver recovers −2 on the identical acquisitions, with maximum one-step position/velocity discrepancies below 9e−16.

## Identification at a sufficient cadence

The model family is q′=v, v′=aq+bv+c+gu. Each supplied real command is held over its declared interval; instantaneous command samples do not specify this control. Let h be that interval's length and z=(q,hv). With A=ah² and B=bh, the homogeneous interval map is M=exp(C), where the two rows of C are (0,1) and (A,B). The sampled affine map adds two offset vectors, one for a unit bias and one for the command. Estimate its two rows by normalized QR against (q,hv,1,u), using separate transition pairs within each original acquisition.

The determinant of M is exp(B). By the two-dimensional characteristic equation, exp(C) is a linear combination of I and C, so M₂₁=A M₁₂. When the QR design, relative M₁₂ and determinant clear the stated conditioning checks, A=M₂₁/M₁₂ and B=log(det M). Apply a unit acceleration to the normalized continuous system at zero initial state to obtain the two-component offset vector. Project the two fitted offsets onto this vector to recover ch² and gh². The receiver divides by the appropriate powers of h, rebuilds the executable four-term model and checks both physical state components on every original transition at every supplied cadence. Cadences are tried in decreasing relative pivot strength. State tolerances are given separately for position and velocity.

A complete period erases identification even with diverse starting states and held commands. At h=1 the two undamped springs with angular frequencies 2π and 4π return the same complete state for every initial state and every constant command; even their constant offsets are invisible. The receiver refuses this cadence. Adding h=1/4 for the first spring identifies its generator and replays both cadences. Positive determinant alone does not establish realizability. A positive-determinant affine map outside this physical generator family fails the complete replay.

Use `recoverAffineOscillator(runs, {positionTolerance, velocityTolerance, minimumRelativePivot})`. Each run has a unique id, a positive step, measured [position, velocity] pairs and one explicitly held `intervalCommands` value per interval. The numeric relative pivot defaults to 1e−8. A rank-deficient command design, a near-returning or nearly singular map, or an unreplayable state transition produces an explicit refusal. This estimator checks a specified affine family. It provides a state-only finite-cadence control for broader nonlinear discovery and leaves the original campaign's protected measurements untouched.

## Matched comparison against the public weak fitter

Native task receipt 194022 registered the six damping/cadence/actuator triples, eight identical acquisitions, two measurement perturbations, changed commands and acceptance gates before the comparison. The baseline was the actual `synthesizeWeakEvolution` implementation at e4da6a8cdc3d048ebb41965e3bf2dbe2439bfa47. Both methods received the same 17 measured position/velocity pairs per acquisition and the same constant real command. Neither received acceleration labels. On three new initial-state and command combinations per world, each method forecast 13 checkpoints over 1.8 seconds.

| Training sensor perturbation amplitude | Weak fits returned | Direct fits returned | Worst weak forecast error | Worst direct forecast error | Direct wins |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 6/6 | 6/6 | 0.306788 | 3.56e−15 | 6/6 |
| 1e−6 | 6/6 | 6/6 | 0.306790 | 2.52e−7 | 6/6 |
| 1e−3 | 6/6 | 6/6 | 0.309688 | 2.53e−4 | 6/6 |

The clean weak errors ranged from 0.002675 to 0.306788. At perturbation amplitude 1e−3 the smallest direct advantage occurred at damping −0.6 and cadence 0.25 (0.002787 weak, 0.0002524 direct). The disturbances are the two registered deterministic sensor patterns, so a population-level noise claim remains unmeasured. The exact no-noise limit, changed initial conditions, and changed control amplitude qualify the estimator for the specified affine full-state family. The original six-world campaign observes position and a commanded initial velocity; its later velocities are unmeasured.

The full 18-row receipt is `docs/receipts/affine-transition-identification/paired-course.json`. The public comparison test always reruns the direct model against the saved predictions of the actual pinned weak fitter. It also reruns the weak fit when the installed baseline has the registered Git blob. To replay both methods from different checkouts, pass the absolute path to the pinned baseline's `src/science/operator-synthesis.mjs` in `WORLDLAW_WEAK_BASELINE` when running `node --test tests/affine-transition-comparison.test.mjs`. The test checks the exact baseline source blob first.
