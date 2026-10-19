# Independent trajectory session receiving and training-stability experiment

Reviewed on 2026-10-19 with Node 24.19.0, in the isolated WORLDLAW workspace.
This review owns its tests and experiments; it did not edit the root-owned data or
session modules or change production integral ranking.

## Receiving result

```sh
node tests/trajectory-session-review-92be.test.mjs
```

**12/12 tests pass.** The fixtures use independently written closed-form damped
spring trajectories from `experiments/integral-discovery-92be.mjs`; their truth
does not import the fitting feature evaluator or forward solver.

The tests exercise the actual `validateBundle → createChallenge → exportChallenge
→ restoreChallenge` path, not a mock. The received behavior is:

| Property | Observed result |
|---|---|
| Independent training and challenge runs | Analytic training selects command + rate + spring; altered-start aggregate challenge error is below 0.001 rad. |
| Challenge future-position isolation | Replacing future observed angles with values near 200 rad changes residuals and metrics; every fitted coefficient, training rank, and predicted trajectory remains identical. |
| Challenge initial state and command | Changing the challenge initial position, supplied initial rate, and command changes that run's predictions; fitted coefficients and rankings remain identical and the other challenge run is unchanged. |
| Training-order preservation | Displayed receiving results correspond to the first candidates in training-derived order, without challenge-error sorting. |
| Notebook trust boundary | Export contains source evidence, settings, and selections. Fabricated cached models, results, and zero-error summaries added to an exported notebook are ignored and recomputed on reopen. |
| Selection persistence | A valid alternative model and challenge-run selection survives reopen; unavailable model/run IDs are refused. |
| Units | Integral residual/noise units are rad; derivative residual/noise units are N·m. Derivative evidence is derived only from training runs. |
| Provenance | Source metadata is deep copied and preserved by the bundle/notebook layer; kind remains a caller declaration. |
| Evidence separation guard | Duplicate IDs, common declared recording IDs, renamed full copies, clock-shifted copies, and matching contiguous subwindows of at least five samples are refused across roles. |
| Failed forward execution | A request exceeding the solver step budget produces explicit failed results, null aggregate selected error, zero completed runs, and reproducible failures after reopen. |
| Validation | Unsupported units, missing rate/inertia, sparse sample arrays, malformed source serialization, malformed/oversized JSON, excessive durations, and invalid settings produce typed refusals. |

### Concrete defects found and corrected by the integration owner

The first independent test run had nine passes and two failures. Both root-owned
fixes were independently rerun successfully:

1. **Clock-shifted copied evidence bypass.** Exact JSON comparison of relative
   floating-point timestamps did not identify a copied 0.025-s trajectory after
   adding an epoch of 10⁹ s. The root replaced that comparison with one that
   respects representable timestamp precision while requiring equal sensor
   values. Tests cover positive and negative epoch shifts.
2. **Untyped provenance failure.** A direct-JavaScript source object's `toJSON`
   returning `undefined`, `null`, or a primitive caused an untyped `TypeError`.
   The root now verifies the serialization and parsed object before reading its
   label. Such functions cannot be encoded in imported JSON, but the public JS
   validator now fails consistently as well.

The forward-solver reviewer additionally found that a renamed contiguous subset
of a training run could enter the challenge role. The root added matching
subsequence detection, and this review added explicit five-sample, middle-window,
and suffix regression cases, including shifted clocks. All now pass. These
checks detect obvious copied evidence; they do not authenticate acquisition
independence or establish that two different noisy recordings are unrelated.

### Actual bundled examples independently received

Both examples were processed by the real session API and exported/reopened. The
model and ranking recomputed identically in each case.

| Bundle | Training/challenge runs | Training-selected structure | Aggregate challenge angular RMSE | Failed rollouts |
|---|---:|---|---:|---:|
| `examples/trajectory-pendulum-92be.json` | 2 / 2 | command + rate + gravity + bias | 0.000656174818 rad | 0 |
| `examples/trajectory-ambiguous-92be.json` | 2 / 1 | rate + spring | 0.564395805012 rad | 0 |

Both sources declare **synthetic** data. For the pendulum example, received
coefficients were approximately command 1.600177949, rate −0.239983083, gravity
−2.200527009, and bias 0.079945275. Its two selected-model challenge errors were
0.000699116210 and 0.000610219067 rad. The ambiguous example retains the
training-selected spring even when the wide-angle challenge exposes substantial
error; challenge observations do not silently rewrite the law.

These are integration receipts for controlled scalar fixtures, not validation on
physical apparatus, arbitrary topology, or unknown inertia.

### Independent solver checks

Direct runs of `tests/trajectory-forward-92be.test.mjs` and
`tests/trajectory-resolution-92be.test.mjs` passed 11 and 8 tests respectively.
The resolution wrapper's shared budget was also read independently: it subtracts
the coarse step count before attempting refinement, retains coarse evidence when
refinement cannot be executed, and reports unavailable/null differences when a
half step is unrepresentable or the shared budget is exhausted. Two-resolution
agreement is explicitly not a calibrated numerical error bound.

## Bounded training-run stability experiment

The first integral comparison produced useful independent predictions but
spurious fourth terms in 23 of 24 cases. This follow-up evaluates whether
**training-only run folds** improve that weakness. It is retained in
`experiments/integral-stability-92be.mjs`; production model selection was not
modified.

Run:

```sh
node experiments/integral-stability-92be.mjs
```

The script emits complete JSON with selected coefficients, per-run fold errors,
coefficient signs, mean fold errors, retained failures, and reserved challenge
errors. It exports `trainingRunStability(trainingRuns, options)` for reproducing
individual cases. The experimental API accepts three or four training runs and
at most four terms. The current two-training-run UI examples therefore do not
qualify for this experiment without additional independently acquired training
data.

### Protocol

For every offered structure estimable on the complete training set:

1. Omit one complete training run.
2. Fit that fixed structure's coefficients using only the other training runs.
3. Free-run the resulting model on the omitted training run, using its declared
   start and commands.
4. Repeat for all three training runs. Mark a structure unavailable if any fold
   cannot estimate or execute it.
5. Select a structure using one of the declared rules below, then use its
   coefficients refitted on all training runs.
6. Only after selection, create and evaluate the reserved altered-start challenge.

No reserved challenge data are accepted by the ranking API, and reserved errors
never change a candidate's rank. Each fold's forward evaluation uses maximum step
0.025 s and a 20,000-step limit. Reserved challenges use maximum step 0.005 s.
The finite library and maximum term count match the original comparison.

The three declared alternatives are:

- **Minimum fold error:** choose the structure with smallest mean omitted-run
  squared position error.
- **One-standard-error simplicity heuristic:** find the minimum-error structure,
  add the empirical standard error of its three per-run MSE values to its mean,
  and choose the fewest-term structure within that threshold; mean error breaks
  ties. With three heterogeneous runs this is a complexity heuristic, not a
  confidence interval.
- **Sign-consistent folds:** among structures whose coefficient signs agree in
  every estimable fold, choose the lowest mean fold error. If none qualify,
  retain the minimum-error structure. Sign stability is not physical
  identifiability and can preserve a biased extra term.

Fold errors contain sensor, initial-position, model, and integration errors.
Leaving out a run can also remove essential excitation. The experiment therefore
has explicit limitations even though it keeps reserved challenges untouched.

### Original 24 cases

The original two families, three seeds, and four noise levels are identical to
`INTEGRAL_DISCOVERY.md`. Exact structure means the complete true three-term set,
not merely including the correct restoring term.

| Rule | Exact structure | Spurious fourth term | Mean reserved challenge RMSE | Better / worse / unchanged versus original |
|---|---:|---:|---:|---:|
| Original integrated score | 1/24 | 23/24 | 0.002714752 rad | — |
| Minimum fold error | 1/24 | 23/24 | 0.004308558 rad | 3 / 11 / 10 |
| One-standard-error simplicity | 16/24 | 8/24 | 0.003382905 rad | 9 / 11 / 4 |
| Sign-consistent folds | 8/24 | 16/24 | 0.002685564 rad | 5 / 2 / 17 |

Simple cross-validation did not cure the extra-term problem. The simplicity rule
improved structural recovery substantially but worsened average reserved
prediction. Sign consistency gave a small average improvement while retaining
many spurious terms.

### Fresh seeds and coefficients: 12 additional cases

The rules were then evaluated unchanged on seeds 101, 307, and 911, position noise
0.001 and 0.01 rad, and both restoring families. The corresponding parameter
sets `(inertia, stiffness, damping, command gain)` were:

- `(0.65, 1.7, 0.12, 0.85)`
- `(1.1, 3.4, 0.4, 1.8)`
- `(0.9, 2.6, 0.28, 1.15)`

Training/challenge starts and sampling remained the same as the original study.
These are new synthetic coefficient/noise cases, not independent real apparatus.

| Rule | Exact structure | Mean reserved challenge RMSE | Better / worse / unchanged versus original |
|---|---:|---:|---:|
| Original integrated score | 0/12 | 0.020028879 rad | — |
| Minimum fold error | 2/12 | 0.005304526 rad | 4 / 3 / 5 |
| One-standard-error simplicity | 2/12 | 0.005304526 rad | 4 / 3 / 5 |
| Sign-consistent folds | 4/12 | 0.004045066 rad | 4 / 3 / 5 |

The lower averages do not remove concrete regressions. In the spring case with
seed 101, σ=0.01, inertia 0.65, stiffness 1.7, damping 0.12, and gain 0.85:

- Original command/rate/spring/bias model: **0.001473973 rad**.
- Minimum-fold and simplicity command/rate/spring/quadratic model:
  **0.025359180 rad**.
- Sign-consistent command/rate/spring model: **0.014364304 rad**.

The simpler model has the correct term set but a worse full-training coefficient
estimate for this particular reserved trajectory. Correct structure and smallest
prediction error are distinct criteria under biased noisy regression.

### True fourth-term check: eight additional cases

To check whether the alternatives merely prefer three terms, the experiment
added a true constant torque bias of 0.005 or 0.08 N·m to each restoring family,
using seeds 101 and 307 and σ=0.001 rad. The independent oracle implements this
through its input torque; recorded command retains the original actuator value.
All four rules recovered the true four-term structure in all eight cases and
selected the same models. Mean reserved error was **0.000198655 rad**.

### Decision

**Do not replace the production ranking with any of these rules on this evidence.**
Run-fold stability is useful evidence about model fragility and supplies viable
alternative structures, but these 44 controlled cases show a real tradeoff
between exact structure recovery and reserved trajectory accuracy, including
large relative regressions. No strategy is a uniformly superior correction.

The experiment supports a future explicitly labeled stability diagnostic or
optional research comparison after acquiring at least three suitably varied
training runs. It does not justify silently selecting a different production law,
using challenge data to choose settings, or presenting stable coefficient signs
as calibrated uncertainty. A stronger next method would model correlated
regressor/initial-state error or use compact-support weak-integral equations,
while retaining these same counterexamples and reserved-run checks.
