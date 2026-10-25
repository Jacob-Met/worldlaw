# Delay versus gradual command response

The existing Trajectory Challenge can compare a finite declared family of command
delays and first-order response times. Open `/trajectory.html`, use **How does the
command reach the mechanism?**, and load the controlled gradual-response oscillator
or an original known-inertia bundle. This extends the maintained timing instrument,
integral fitter and RK4 solver; it does not introduce another dynamics engine.

## The question exposed by the control

An independently authored oscillator has a 0.04 s delay followed by a 0.18 s
first-order command response. A delay-only training fit prefers 0.20 s and changes
the command gain from authored 1.6 to approximately 1.4776. Its separate-recording
RMSE is 0.012851263574033767 rad, compared with 0.23547204703435806 rad for the
instantaneous assumption. The apparent delay improves prediction while absorbing
an omitted response mechanism.

The extended declared family offers delays `[0, .04, .08, .12, .2]` and response
times `[0, .09, .18, .27]`. Training chooses the offered pair `(0.04, 0.18)`;
separate-recording RMSE is 0.00011970690162329944 rad. These are synthetic numerical
controls, not measured actuator parameters, blind generalization, calibrated
uncertainty or physical causal identification.

## Declared model and original evidence

Let `c(t)` be the left-held recorded command, `d` the offered delay, `u(t)` the
applied command hypothesis and `tau` the response time. Positive `tau` means

`tau × u'(t) + u(t) = c(t − d)`.

The mechanical model remains `I × theta'' = fittedTorque(theta, theta', u)`.
Zero response time is the existing delayed held command. Zero delay and zero
response time preserve the original instantaneous computation.

The common pre-recording command is explicitly supplied for every run. A positive
response time additionally assumes the applied command initially equals that value:
an initial equilibrium declaration. A finite preceding interval of constant command
does not itself establish equilibrium. Runs requiring different initial applied
states or prehistories are outside this first response family.

Original angles, timestamps, supplied inertia/rate, run identity, source labels and
training/challenge roles remain intact. No interpolated angle is fitted as an
observation. Model command-domain metadata distinguishes the declared applied-input
extrema from the original recorded-command extrema, including a prior command outside
the recorded range.

## Exact command propagation, maintained mechanics

Within a segment with constant delayed target `c`, initial applied command `u0`
and duration `h`, the input is `u(s) = c + (u0 − c) exp(−s/tau)`. Its endpoint,
integral and double integral are evaluated analytically. The existing timeline
partitions original observation intervals at delayed command changes and composes
these moments. Small `h/tau` uses the integrated onset series to retain tiny changes
without subtracting nearly equal targets; longer intervals use the decaying
deviation from the target to preserve its integrated impulse.

The original integral fitter receives the exact filtered-command column. Its
position/rate quadrature, scaled QR, term-subset search and heuristic score remain
the same. The original RK4 evaluates the analytic input at each of its four stage
times, rather than holding a midpoint or endpoint value through the whole step.
The final command diagnostic is explicitly a left limit; a target change only at
the terminal observation is outside the integration interval.

For every positive response time, the study reserves a coarse maximum step of
`min(requestedMaxStep, tau/4)` and a genuinely twice-finer course. The resolution
wrapper receives that actual coarse maximum, so both runs cannot accidentally
collapse onto the same response-time cap. Direct rollout rejects an underresolved
positive response declaration. The `tau/4` choice is an engineering resolution
rule, not an error bound; mechanical stiffness and shared numerical bias can still
matter, and both predictions remain available for sensitivity inspection.

## Complete family and source-only replay

Offer 1–17 distinct delays including zero and 1–9 distinct response times including
zero, with 2–64 total pairs. Positive response times are 0.00001–30 s; delays are
0–30 s. The complete fitting-size and coarse-plus-refined step budgets are checked
before any model is fitted. Very short response times can therefore refuse a large
request rather than producing an incomplete, apparently favorable family.

Every pair is fitted and selected using training recordings only. Separate motion
then challenges the frozen candidates. A failed receiving run prevents a mean over
survivors. The table retains all failures, adequacy diagnostics, actual coarse step
limits and numerical comparisons. Constant command can leave the whole family
competitive. The displayed first choice does not establish identified dynamics.

Gradual inputs use `worldlaw.command-response-inputs/v1`, containing only the original
bundle and explicit options. Saved derived answers are ignored. The old
`worldlaw.command-timing-inputs/v1` remains valid for pure delay; adding a positive
response family under that old schema is refused, preventing a silent downgrade.
Input edits, source changes and stale file completions retire predictions and export.
The preexisting angular-only journey remains usable, with this known-inertia
instrument disabled for that evidence.

## Two rendered instruments

**Command and motion** shows original commands and the analytic applied-input
hypothesis beneath observed versus predicted angle, on one elapsed clock. The gray
comparison is the best pure-delay candidate selected from training. It makes the
compensating-delay failure visible beside the gradual response. Sampled points along
the smooth input curve are display evaluations of a hypothesis, not new measurements.

**Whole delay comparison** becomes a two-dimensional grid of every offered delay
and response-time pair. Color shows the separate-recording RMSE on a logarithmic
scale; the orange ring remains the training-selected pair. Missing complete scores
are marked separately. The full numerical table and candidate selector remain
available. This discrete grid is neither a continuous optimum nor a confidence region.

Both compositions are exercised in actual desktop and 390 px Chromium, including
keyboard execution, actual download/reopen, forged answer and schema-downgrade
refusal, late file completion, legacy notebooks and the measured angular regression.
The main remaining experience limitation is the number of expert declarations;
the initial-state, library and numerical assumptions still require judgment.

## Verification and scope

```sh
node tests/command-timing.test.mjs
node tests/command-response.test.mjs
npm run verify
node scripts/command-timing-browser.mjs . /tmp/worldlaw-command-response
```

The eight added native groups include 27 independent 90-digit antiderivative
controls, held-step superposition at original observations, exact pure-delay
compatibility, the closed-form oscillator, challenge-value isolation, complete
resolution budgets, versioned input-only replay and absent excitation. The nine
existing timing groups remain intact. An independent peer also checked 1,000
random two-segment moment-composition identities across response times 1e-5–10 s
and intervals 1e-7–10 s; worst normalized discrepancy was 3.22e-15.

The composed native course and 21-group live browser course have passed. Exact
published-source hashes, current-main composition, commands, browser sandbox
observation and captures accompany the native issue/PR and receipt directory.
No hardware acquisition, external deployment, provider spend or submission is claimed.

Ownership: [WORLDLAW #185](https://github.com/Jacob-Met/worldlaw/issues/185),
retained team `hamon-62c186-20261024` lead. Coupled restoring #183, angular forecasts,
Motion, UNKNOWN LAB and PR #9 retain their owners and action-specific boundaries.
