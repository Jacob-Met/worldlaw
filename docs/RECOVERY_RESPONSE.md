# UNKNOWN LAB: fixed-preparation recovery challenge

The additive recovery instrument in `/unknown-lab.html` asks whether the same
preparation's response remains constant or relaxes during a subsequent wait.
Preparation duration is held fixed; waiting delay is varied. The separately
maintained duration-response panel varies preparation duration instead. Neither
panel replaces the paired-history/order estimator or authenticates acquisition.

## Executable workflow

The virtual course uses independent paired instrument readings and a small-step
Euler recovery instrument. Two recordings at 0 and 1 s train the finite candidates;
separate seeds produce challenge recordings at 3 and 5 s. A persistent-offset
control and a changed-response challenge retain alternative and failed results.
The response fitter never calls this virtual instrument.

For supplied evidence, first import paired evidence into the existing workbench,
start a recovery course, declare the fixed preparation/readout protocol, recording
identity and waiting delay, then add the current readings as training or challenge.
Import another independently acquired paired recording and repeat. The protocol
requires matched measurement conditions, including command, position, rate and
preparation; labels alone cannot verify compliance. Each recording reuses the
maintained paired-order correction. Missing or insufficient counterbalancing
withholds the corresponding scientific comparison.

Export contains inputs, model-grid assumptions and original observations. Import
recomputes fits, forecasts and contradictions. It never trusts stored conclusions.
The ordinary paired notebook and the duration-response notebook remain separate
supported inputs; source classification cannot change midway through a course.

## Model and scientific boundaries

Candidates are zero preparation contrast, a persistent contrast A, and fixed-grid
exponential responses A exp(-delay/tau). The declared amplitude interval and finite
tau grid are assumptions, not discovered mechanisms. Fit uses training only.
For every training recording, its existing three-standard-error screen constrains
the same amplitude. Intersecting all constraints gives the feasible amplitude
range; an empty range refuses the candidate. A representative weighted fit is
clamped into the feasible range. Numerically unexcited exponential candidates are
refused, rather than producing infinite or unidentifiable coefficients.

Separate recordings test frozen training forecasts. Every qualified challenge
must be consistent with one shared amplitude in the original training range;
individually overlapping predictions cannot conceal mutually contradictory
amplitude requirements. A qualified contradiction remains challenged even if
another challenge has missing order qualification. Unqualified challenges otherwise
produce incomplete, never a successful all-recording comparison.

The bounds are inherited heuristic screens, not calibrated confidence intervals.
They assume the declared noise model and linear acquisition-order correction.
Correlated readings, nonlinear drift, inconsistent preparation/readout conditions,
changing instruments and omitted dynamics can mimic or invalidate a recovery law.
A compatible exponential does not establish physical memory or identify a unique
mechanism. Finite-grid selection does not optimize a continuous time constant.

Recording identities must be distinct. The same measured state/torque rows cannot
be reused by changing pair labels, recording names, row order or chronology-index
offsets. This is a conservative duplicate guard; different bytes still do not
prove independent physical acquisition. Synthetic and measured evidence cannot be
mixed. Supported budgets are 2–32 training recordings, at most 32 challenges,
1–16 candidate times from 0.05 to 60 s, and delays up to 60 s. An aggregate
2 MB UTF-8 budget is enforced before adoption. Export uses compact JSON when
pretty formatting would exceed that budget, so every admitted course can reopen.

## Experience choice

Two compositions were considered: another separate model dashboard, or an
additional instrument course directly below the paired apparatus. The second
keeps the matched-readout experiment visible and distinguishes the two independent
experimental axes: preparation duration and subsequent recovery delay. The actual
forecast curves confront training circles and challenge squares; table rows keep
refused hypotheses visible. Color identifies executable responses, and dashed
curves explicitly retain training contradictions. Controls use native keyboard
behavior and the results table contains its own narrow-screen scroll.

## Receiving

Run the focused science tests and the actual launched browser course:

```sh
node --test --test-isolation=none tests/recovery-response.test.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-recovery node scripts/recovery-browser.mjs
node scripts/unknown-lab-browser.mjs
node scripts/unknown-duration-browser.mjs
node scripts/smoke.mjs
node scripts/trajectory-smoke-92be.mjs
```

The focused course covers persistent/decaying/zero and out-of-family inputs,
negative amplitudes, unexcited terms, shared-amplitude challenge contradictions,
chronology refusal, withheld-data invariance, source/protocol/budget rejection,
renamed/reindexed reuse, representative amplitude feasibility and input-only replay.
The browser course executes controls, current-evidence addition, export/reopen,
atomic invalid-import refusal, keyboard activation and desktop/narrow layouts.
Exact received source and outcomes belong in the PR receipt. No physical experiment,
provider execution, cloud qualification or calibrated uncertainty is claimed.

## Received increment — 2026-10-24

The final seven-file increment is composed against main
`59fcbad6250b56a40e0a58bc2da73c22e75cf474`. Every existing base blob was checked
against its Git blob SHA; only the intended `src/unknown-lab/app.mjs` hookup
changes an existing file. Newly merged preparation-duration planning, continuous-duration comparison and
initial-state sensitivity are preserved. The recovery scientific module's
SHA-256 is `4d6e837996315db4357dd09c3455cbc3a32ae0be7a1a733bc1b6b28644333bb7`.

Verification was performed in local Node 24.19 and an authorized Linux receiving
host using Node 22.23.4 and Chrome 156. The complete suite at the preceding
`3824ee811a84279a2ebfd8a47646498675fbe317` composition ran 283 tests: 282 passed,
one existing conditional skip, zero failures. That full run preceded the final
chronology-index deduplication and aggregate UTF-8 budget guards. The final
focused recovery course passes all 13 tests, including the new guards, in both
ordinary and `--no-opt` execution; the remote receiving course also passed 13.
Composition tests at `2cffb812` for recovery, duration-response, duration planning
and initial-state sensitivity pass 36/36. These records do not claim that the
entire final current-main suite was rerun.

The actual Chrome course passes ten recovery behavior groups: executable
relaxing/persistent/changed-response controls, separate challenge contradiction,
input-only export/reopen, atomic renamed-recording refusal, current paired-evidence
addition, native keyboard activation, desktop and narrow layouts, and no uncaught
JavaScript exceptions or outside requests. The earlier final-guard composition
also passed the existing UNKNOWN LAB 16-group course, duration-response nine-group
course, and both launched product and trajectory smokes. After composing current
main, the recovery ten-group course and the overlapping duration-planner
11-group course both passed.

Receiving found and corrected two harness problems before acceptance. Two native
Enter attempts did not activate the focused button: supplying a complete native
key event including carriage-return text, with focus and observed-outcome checks,
resolved the failure. Product click handlers were not weakened or bypassed to
make the keyboard assertion pass. Initial screenshots captured an earlier panel
because smooth scrolling had not settled. The final harness disables smooth
scrolling for capture, waits for the target scroll position, and captures the
entire recovery section's actual bounds. Root independently inspected both final
1440 px and 390 px captures: recovery controls, forecasts, training/challenge
results and export/import are present; the narrow results table scrolls internally.
Runtime behavior passing was kept distinct from this later visual acceptance.

The root receiving host retained the final captures under
`/tmp/hamon-3eeb-worldlaw-receive-current/evidence/recovery-current/` as
`recovery-1440.png` and `recovery-390.png`; the commands above reproduce them in a
chosen output directory. Source/merge status is recorded separately in the PR.
These are authored virtual experiments and declared imported-evidence workflows,
not independently acquired physical recovery observations.

The final `59fcbad` source composition preserves the continuous-duration mount;
affected recovery, duration, duration-planning and continuous-duration tests
pass 42/42. Its overlapping browser receiving is recorded in the PR.
