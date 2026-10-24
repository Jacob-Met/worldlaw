# Stiffness Lab: a changing response as an executable hypothesis

## Use the actual product

Run `npm start` and open **Stiffness Lab** from the Discovery Studio, or visit
`http://127.0.0.1:4193/stiffness.html`. Node 20+ is sufficient; no dependency
installation or cloud service is needed.

Load one of the explicitly simulated sources, import the maintained
`worldlaw.observations/v1` JSON/CSV format, or reopen an input notebook. The
global baseline and changing-response hypotheses use the same declared
nuisance terms. Inspect any fitted candidate without changing the training
winner. Supply a separate check file to challenge every frozen candidate.
Saving downloads the observations, source declarations and exact search
settings; reopening recomputes the comparison.

The response field draws conditional model curves at the displayed command
and rate. Only raw observations matching that state are plotted. The complete
error comparison evaluates every input row, including rows not in that slice.
The alternative torque gauge shows predictions at the selected angle; it is
not an instrument reading or an asserted physical mechanism.

## What the mechanism does

For each declared change angle κ, fit

`τ = b + a·u + d·ω + k·θ + h·max(0, θ − κ)`

using the maintained `src/science/linear-fit.mjs` column-normalized,
two-pass QR primitive. Bias, command and rate are individually optional,
explicit nuisance terms. The global baseline omits only the hinge. The left
and right slopes are k and k+h; continuity is imposed, while slope signs are
unrestricted. No passivity or physical-restoring constraint is imposed.

The search accepts 8–4096 training rows and 1–101 distinct offered knots.
Every changing candidate requires three **distinct** training angles strictly
on each side, plus full numerical column rank. Repeated rows do not count as
additional distinct positions. Unsupported knots, rank failures and
unexecutable coefficients remain in the complete profile.

The ranking heuristic is

`n log(max(training MSE, assumed noise²)) + (coefficient count + searched knot count) log(n)`.

Counting the searched knot penalizes flexibility relative to the baseline.
This is an explicitly declared finite-search heuristic, not a calibrated
information criterion, posterior or confidence set. The competitive score
difference and noise floor are caller assumptions. Three assumed noise units
is a descriptive mismatch screen, not a statistical test with an established
false-positive rate.

## Evidence roles and limits

Only training observations enter fitting, ranking, automatic initial-grid
generation and the competitive set. Separate check values may change displayed
check error, never the fit. Check replacement retains its supplied source
declaration. Independence, measurement accuracy and origin are not
authenticated. Retuning after inspecting a check reuses that evidence and does
not create a fresh validation experiment.

The notebook schema is `worldlaw.stiffness-notebook/v1`, with only `schema`,
`dataset` and `settings` at the top level. Claimed saved results are rejected.
Imports are atomic and versioned against newer user actions; late file reads
cannot replace newer evidence. There is no automatic upload or persistence.

A fitted kink does not identify a contact, mechanism topology, sensor defect,
physical stiffness or causal law. A smooth omitted response can favor a
piecewise approximation. A single-change family can fail a two-change
response. Observing only one side cannot locate a change outside that range.
The finite grid can miss an off-grid change. Extrapolated check rows are
counted across angle, command and rate. No physical actuation occurs.

## Actual authored controls

These results were executed using the independently written fixture source,
not by using the fitted evaluator to generate its own observations. They are
controlled software experiments, not physical validation.

| Source | Training decision | Global check RMSE | Preferred check RMSE |
| --- | --- | ---: | ---: |
| Change at 0.4 rad | Piecewise at 0.4 rad | 0.6278179045 N·m | 0.0007043348 N·m |
| Global linear | Global | 0.0007043814 N·m | Same baseline |
| Smooth cubic omitted by the family | Ambiguous change angles; training mismatch | 0.3807775923 N·m | 0.3119288861 N·m |
| Change outside training angles | Global on observed range | 1.2210940345 N·m | Same baseline; 52/92 checks extrapolate |

The smooth example retains its failure: a better piecewise score does not
remove the mismatch. The narrow example fits its observed interval well yet
fails later checks, preventing a good training fit from becoming a claim of
general validity. Full numeric outputs are in the adjacent receipt.

## Experience decision

Two actual rendered compositions were compared: a conditional response field
with raw source marks and rival curves, and a torque dial with model needles
at the inspected state. The response field is the default because it makes
the missing change and the baseline error visible directly; the dial is a
secondary inspection view. Both use executable predictions. Desktop and
390px captures preserve source/forecast labels, readable axes and the
complete decision. Keyboard controls and reduced-motion behavior were
received in actual Chrome.

## Receiving and retained failures

Initial source was main `2dde8158ece31a1e16eb162f9388483472fdd022`.
The final composed receiving baseline is maintained
`88f483ae95ab1e5448c588b60c2954f67dd93cb5`, including the coupling team's
merged shared QR extraction and the newer repeated-state diagnosis.
No coupling or scalar-discovery implementation was copied or overwritten.

Executed on an authorized isolated Linux host, Node **22.23.4**, installed
Chrome, with source blobs verified against their Git identities:

- `node --test tests/stiffness.test.mjs`: 15/15 substantive controls passed.
- `node --test --test-concurrency=2 tests/*.test.mjs`: 387 passed, 0 failed,
  1 inherited optional browser dependency skip (388 total).
- `node scripts/smoke.mjs` and `node scripts/trajectory-smoke-92be.mjs`:
  both launched-product courses passed.
- `BROWSER_ARTIFACT_DIR=/path/to/receipts node scripts/stiffness-browser.mjs`:
  16 actual Chrome workflow groups passed, including real file download,
  reopen, changed checks, atomic refusal, late reads, keyboard, 1440/390px
  layouts, alternative rendering and ordinary Studio acquisition. No uncaught
  page exceptions or external requests.

Failures were used to repair the candidate before integration: the initial
HTML number-step declaration rejected its own valid noise default; it now
accepts the admitted numeric domain. Refreshing main initially dropped the
new navigation link; the composed exact anchor is now received. The growing
Studio navigation already overflowed a 390px viewport at 415px before the
new link, and 480px with it; wrapping the existing controls now contains both.
An early browser receiver looked for an obsolete Studio status selector;
it now checks the live observation count and executes an actual acquisition.

Published commit/tree, independent review and package digest are recorded
with the PR. These results establish implemented, exercised source and
browser behavior. Installed-service deployment, independently measured
mechanical qualification, provider qualification and submission are separate.
