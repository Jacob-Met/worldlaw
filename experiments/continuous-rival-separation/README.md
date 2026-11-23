# Continuous actuator separation on the six development rosters

The signed-pulse course refuses the first acquisition on the same four spring and gravity worlds as the expanded-rival planner. Hold amplitude magnitude 0.95 for sustained excursion, or use unit magnitude on three segments and 1/√3 on the first or last. That interior magnitude maximizes |u−u³| on [−1,1]. Enumerate all sixteen sign patterns for each mask. All 48 designs use the same four two-second segments, initial state (0.25, 0), 0.04-second sampling, position/rate limits of ±12, and position noise σ=0.002. Each design competes on the minimum pairwise RMS across every fitted rival and 200 post-initial positions. The winning schedule receives the original RK4 refinement check.

| Development world | Expanded planner RMS/σ | Signed-pulse RMS/σ | First acquisition |
|---|---:|---:|---|
| 1001 spring | 0.040 | 0.477 | Refused |
| 1002 spring | 0.210 | 2.361 | Refused |
| 1003 gravity | 1.817 | 1.878 | Refused |
| 1004 gravity | 0.158 | 1.138 | Refused |
| 1005 Duffing | 327.206 | 201.445 | Passed |
| 1006 Duffing | 4.089 | 8.227 | Passed |

The threshold is 3 on each world. The original expanded-rival roster contains up to six models. On world 1001 the positive and negative saturated cycles drive the cubic-actuator variants into nearly coincident trajectories despite different restoring terms. In world 1004 the gravity-plus-cubic fit adds a restoring coefficient of −0.0000064754941. The development measurements cover these 48 schedules. They give no upper bound on the best schedule for those specific fitted coefficient vectors. Neither calibration nor final evaluation was accessed.

## A uniform exact-support counterexample

Start with the first fitted model from each of worlds 1001–1004. Form a distinct law by adding ε sin(q) to a spring model or ε q to a gravity model, with ε=10⁻⁹. All original drive, damping and restoring coefficients agree between the pair. The models have different supports within the declared finite library. The intervening controller must apply a common command to the hypothetical pair. At any position within the ±12 radian domain, the added torque has magnitude at most εM, with M=1 or 12 respectively.

Let e be the position difference, k the absolute original restoring coefficient and d the common nonnegative damping. Unit inertia and identical initial states give zero initial error. Because the common restoring term has Lipschitz constant k, the input to the difference equation e″+de′ has magnitude at most k|e|+εM. Its causal position kernel is (1−exp(−dt))/d ≤ t for d>0, with equality at d=0 in the limiting kernel. Iterating the resulting nonnegative integral inequality gives

    |e(t)| ≤ ε M (cosh(√k t)−1)/k.

At eight seconds this bounds even the largest instantaneous separation, in noise units, by 0.000369, 0.000771, 0.005870 and 0.008311, respectively. Every admissible schedule therefore fails the three-noise-unit criterion on each constructed pair. This is a uniform counterexample over the law class when added coefficients can approach zero. The constructed perturbation differs from the archived fitted alternatives. A recovery guarantee would need a minimum effect assumption or a target defined in terms of distinguishable forecasts.

## Replay

Run `node experiments/continuous-rival-separation/verify.mjs` from the repository root. The output reports all six ordered scores, selected schedules, limiting model pairs and numerical refinement errors. Compare it with `observed.json`. This is a development-only falsification. The production acquisition policy remains the original two-rival policy.

The six rosters were reconstructed with `restoreContinuousSession` and `jointActuatorRestoringRivals` at `96c984e8f93598df2926e45a28840d53a249d450` from each archived `candidate/continuous-law-development.tgz:evidence/development/world-*/active/round-1-plan.input.json`. Only each model's ID and fitted term coefficients are retained. The original archive is Actions artifact 14865225011, SHA-256 `e8bac61ac3f0eb639ca039d27952e8f0a65ffd6f6118c980ca32860c47d09128`, from run 45268239303.
