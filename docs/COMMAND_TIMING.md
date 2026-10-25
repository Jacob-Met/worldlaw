# Command timing in Trajectory Challenge

WORLDLAW can compare a finite declared family of nonnegative command delays in
known-inertia recordings. Open the existing `/trajectory.html`, load paired
source runs, and use **Does the command arrive late?** The normal instantaneous
fit remains visible above the timing instrument.

## Scientific question and preserved evidence

The conditional model is

`I × θ''(t) = fittedTorque(θ(t), θ'(t), recordedCommand(t − delay))`.

Recorded command is held from one original timestamp to the next. A positive
delay requires an explicitly supplied constant command before the start of
**every** offered recording, valid for at least the largest delay. This first
instrument admits a common prehistory value; it does not guess missing history
or support different prehistory values per run. Original angles, timestamps,
initial rates, inertia, source labels and training/challenge roles are retained.

Delay is an offered hypothesis, not automatically a physical actuator latency.
A clock offset, actuator response, wrong model, calibration or starting state
can contribute to the apparent best delay. A fitting score is not causal
identification, a posterior probability or an uncertainty interval.

## Maintained mechanisms

`command-timeline.mjs` partitions each original observation interval at actual
shifted command changes. It computes the command's double integral exactly for
the declared piecewise constant input. The existing `discoverIntegral` uses
that column with its original position/rate quadrature, scaled QR and finite
term-subset search. No intermediate angle is invented or used as an observation.

The same timeline splits the existing `rollout` RK4 steps at command events,
including events between source samples. This is an extension of the maintained
integrator. The two-resolution wrapper forwards the identical timing
declaration to both runs and retains the shared step budget. Explicit zero delay
preserves the original fitting and trajectory numbers.

The instrument offers command, linear rate, linear position, sinusoidal position
and constant torque terms. It fits every delay using **training recordings only**,
then fixes the training selection before evaluating any later challenge angle.
The table retains every offered delay, fitting failure, full-course receiving
failure, adequacy diagnostic and available coarse/fine discrepancy. A failed
challenge run prevents a mean over the remaining survivors. Constant command can
leave all delays tied; the first training choice then carries no identified timing.

An entire delay × recording × coarse/fine request is reserved before any fitting
or rollout. The limits are 2–17 distinct offered delays including zero, delay
0–30 s, at most 1,000,000 combined RK4 steps and 20,000,000 declared fitting-size
units. The last is an input-complexity bound, not an instruction count or elapsed
time estimate. An oversized request refuses the whole family.

## User journey and visual decision

The default instrument places recorded and delayed commands directly beneath
the corresponding observed/predicted motion on one elapsed clock. An orange
dashed prediction can remain visible when it closely overlaps the recorded angle;
the gray zero-delay prediction remains as the original comparison. This makes
the timing hypothesis legible in the actual physical response.

The second composition, **Whole delay comparison**, shows every successfully
received finite delay against its separate-recording RMSE, while the highlighted
choice stays training-selected. It is a discrete comparison, not a continuous
optimum. Both compositions were exercised in actual Chrome, with narrow layout
and keyboard controls. The main remaining experience limitation is the volume
of expert declarations; prehistory, library and numerical assumptions still need
an informed investigator.

**Save timing inputs** downloads `worldlaw.command-timing-inputs/v1`: original
bundle plus explicit options only. Reopening re-establishes the same source in
the main trajectory application and recomputes the instantaneous and delayed
comparisons. Saved claimed answers are ignored. Edits, source changes and late
file completions retire old plots; angular-only unknown-inertia evidence cannot
be used for this command-timing claim.

## Independently constructed control

The controlled delayed oscillator is authored from closed-form transitions of
an underdamped linear oscillator under held forcing. It does not call the fitted
RK4 or the new timing integral. True parameters: inertia 0.84 kg·m², damping
0.55 N·m·s/rad, spring 3.2 N·m/rad, command gain 1.6, bias 0.12 N·m, delay
0.137 s and prior command 0.2 N·m. Training and challenge runs use different
initial states, pulse sequences and sample cadence; each retains 241 observations.

With offered delays `[0, .05, .1, .137, .2, .3]`, the training criterion chooses
0.137 s. In the separate authored recording, instantaneous-command RMSE is
0.15364235274027815 rad; selected-delay RMSE is 0.00013270724926792884 rad. The
remaining error includes the existing sampled position quadrature. A tiny
coarse/fine solver difference does not certify that quadrature or physical validity.

These are synthetic numerical controls, not physical acquisitions, blind
generalization, a calibrated latency estimate or a contest qualification.

## Verification

```sh
node tests/command-timing.test.mjs
npm run verify
BROWSER_EXECUTABLE_PATH=/path/to/chrome node scripts/command-timing-browser.mjs . /tmp/worldlaw-timing-receiving
```

The nine focused groups cover an independent exact held-force solution,
events between samples, unknown prehistory, zero-delay parity, shared-resolution
timing/budget, the analytic oscillator, challenge-mutation isolation, source-only
reopen, complete work refusal, absent excitation and failed later-rollout retention. The real browser course
launches the normal application and checks 12 groups including actual downloads,
fabricated-answer rejection, late-file and mid-installation edit retirement, both visual compositions,
keyboard focus, 390 px layout, the measured angular regression and reload.
Chrome sandbox admission uses the maintained helper and retains the observation.

Native execution in the local workspace initially refused two tests because
localhost listening was unavailable. The first remote transfer omitted existing
experiment/evidence dependencies and failed nine groups; no product source was
changed to hide those failures. After transferring the original dependencies,
the complete baseline composition passed 750 tests with one existing optional
skip, followed by both launched product smokes. Current-main composition and exact
published/merged source receiving are recorded on the native issue and PR.

The final pre-publication composition over main `fbf0bf0b9c82d2180e9bb71f3a458b8fa6b6ed7d`
passed 791 of 792 native tests with zero failures and one existing optional
Node/Chromium exchange skip, plus both launched smokes. The timing-specific
12-group real Chromium course passed separately. Exact source hashes, commands,
input identity, browser sandbox observation and desktop/narrow images are in
[`receipts/command-timing-62c186/verification.json`](receipts/command-timing-62c186/verification.json)
and [`browser.json`](receipts/command-timing-62c186/browser.json).

Ownership: [WORLDLAW #173](https://github.com/Jacob-Met/worldlaw/issues/173),
team `hamon-62c186-20261024` lead. The existing angular forecast, coupled-inertia,
Motion, UNKNOWN LAB and PR #9 owner/hold boundaries are preserved.
