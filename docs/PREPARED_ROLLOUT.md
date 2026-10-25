# Reusable torque evaluation inside forward inference

The maintained trajectory solver snapshots the executable torque law once per
rollout. Every numerical stage still checks its coordinates and finite torque,
uses the same shared feature implementation in the same term order, and retains
the same state bounds, command timeline, integration steps and failure behavior.
Later mutation of the caller's model cannot alter the captured equation.

This reduces repeated model validation and coordinate-object construction in
the ordinary **Trajectory Challenge → Which law predicts another recording? →
Compare training-trajectory coefficient refinement** journey. It changes neither
the fitted structure nor the scientific interpretation of a successful fit.

## Receiving against the maintained baseline

Baseline source: `f1d3dd08e1d3303b0e8b296b496c18738abb7b0b`. On Linux x86-64,
Node 22.23.4, five alternating measured calls after warmup produced these
complete-consumer medians:

| Consumer | Baseline | Prepared evaluator | Result parity |
| --- | ---: | ---: | --- |
| 41-trial, 501-position forward coefficient search | 556.946 ms | 138.426 ms | Entire returned result exactly equal |

The measured search reserves 270,272 integration steps. The speed ratio is 4.02×
on this authored workload; it is not a claim about every model, browser or host.
The implementation does not remove work reservations or introduce an unverified
solver shortcut.

The reproducible receiver additionally compares every returned row, diagnostic
and error against the baseline for 180 successfully executed changed-input
courses, including all supported feature types, delayed/gradual commands and
Coulomb contact. Six distinct negative courses preserve their exact failures.
An eight-structure cross-recording selection and every attempted refinement
coefficient, score and selected trial also remain exactly equal. Source inputs
are checked for mutation. The first receiver accidentally omitted required
pre-recording commands on its delay courses; this was corrected, and every
positive course must now execute before it can count as parity evidence.

```sh
WORLDLAW_BASELINE_DIR=/absolute/path/to/pinned/baseline \
WORLDLAW_BASELINE_COMMIT=f1d3dd08e1d3303b0e8b296b496c18738abb7b0b \
WORLDLAW_RECEIPT_PATH=/absolute/path/to/receiving.json \
node experiments/prepared-rollout-receiving.mjs
```

The committed [receiving record](receipts/prepared-rollout-287/receiving.json)
contains timing samples, input/result hashes, the 77 passing affected native
checks, two launched HTTP consumers, and 12 actual Chrome workflow groups.
Those browser groups exercise source import, keyboard opt-in, original/refined
forecasts, every retained trial, source-only download/reopen, refusal paths,
desktop/390-pixel layouts and the retained PASCO transfer loss. Screenshots were
inspected; this is receiving of the existing interface, not a visual redesign.

On the receiving host, `/usr/local/bin/google-chrome` is a launcher that injects
`--no-sandbox`; the unchanged browser preflight refused it before navigation.
Using the installed `/usr/bin/google-chrome-stable` directly with
`chromiumSandbox:true` passed every required protection. No launcher, host
security setting or test admission requirement was changed.

## Scientific experiment not promoted

Before choosing this execution improvement, 480 independently authored noisy
oscillator courses tested target-only covariance whitening of overlapping weak
windows. Most densely overlapping cases became worse on the separately authored
release. At requested stride 0.025 s and position noise 0.001 rad, mean forward
RMSE increased from 0.000109144 to 0.000533845 rad; only one of 32 seeds improved.
Target whitening alone omits the shared noise in the feature columns. The
experiment is retained in [the rejected result table](receipts/prepared-rollout-287/whitening-rejected.json),
and no whitening option or accuracy claim is added to the product. Existing
training-trajectory refinement remains the maintained mechanism.
