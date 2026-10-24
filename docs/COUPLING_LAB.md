# Coupling Lab: two-coordinate response discovery

Open `/coupling.html` from the maintained WORLDLAW server (`npm start`), or choose
**Coupling Lab** from Discovery Studio. The lab compares explicitly declared
quasi-static torque responses at two angular coordinates. It asks whether each
response can be explained independently, whether the cross terms can be equal,
or whether separate directional cross terms are needed.

This is an added finite model investigation in the existing product. Motion Lab,
the scalar Studio, angular trajectory discovery, UNKNOWN LAB, and their source
and integration ownership remain intact. No measured two-coordinate apparatus
has been qualified by this increment.

## The working experiment

The default authored instrument initially provides 32 paired observations in a
narrow angle range. Choose **Use suggested input**, then **Acquire simulated
response**. Review the frozen predictions and the actual new simulated torque
pair, then repeat with the next proposed input. An observation is acquired from
a separately implemented response formula; saved separate-check observations
are never used as acquisitions.

The declared reciprocal course retains a useful failure as well as its eventual
improvement. Initial independent-response selection has 0.482929151491 N·m RMSE
on the 25 separate check states. The first acquired pair raises that error to
0.654498960916 N·m. The second pair changes selection to reciprocal coupling and
reduces the same error to 0.000509826992 N·m. Neither intermediate result is
discarded. This is one deterministic synthetic course, not empirical evidence
of physical discovery or a general claim that active selection improves error.

Other supplied controls retain independent responses, reject reciprocity when
directional coefficients are needed, expose an underexcited coordinate design,
and retain an omitted nonlinear response as training mismatch. Reproduce all
five courses with:

```sh
node experiments/coupling-discovery.mjs
node tests/coupling.test.mjs
```

The response field compares executable torque vectors at permitted angle pairs.
The alternative paired-gauge composition shows each declared angle and the two
families' torque values. These are instruments for comparing responses, not
reconstructions of bodies or animations of physical motion. Both views use the
same model and input selection. The field is the default because cross-coordinate
differences remain visible across the whole input set; gauges are useful for
inspecting one chosen acquisition. Narrow displays use a separate plot coordinate
layout and vertically stacked gauges so labels remain readable.

## Model and numerical contract

The three affine families use the same relation, with different coefficient
constraints:

\[
\begin{bmatrix}\tau_1\\\tau_2\end{bmatrix}
= K\begin{bmatrix}\theta_1\\\theta_2\end{bmatrix}+b.
\]

| Family | Matrix constraint | Fitted parameters |
|---|---|---:|
| Independent | Both off-diagonal coefficients are zero | 4 |
| Reciprocal | The two off-diagonal coefficients are equal | 5 |
| Directional | All four matrix entries are independent | 6 |

Both bias terms are fitted in every family. Positions use radians and responses
use N·m under a supplied common coordinate convention. A reciprocal response
matrix alone does not prove a conservative or passive mechanism, a physical
connection, or mechanism topology. Arbitrary scale or coordinate changes can
alter this comparison. Rates, inertia, contact transitions and changing external
loads are not inferred here.

`src/science/linear-fit.mjs` extracts the existing scalar fitter's exact
column-normalized, twice-reorthogonalized QR and library-rank arithmetic. The
scalar consumer imports those primitives unchanged; three complete existing
discovery/proposal JSON courses were byte-for-byte equal before and after the
extraction. Coupling fits stack the two response coordinates into one linear
system, preserving equality of a reciprocal cross coefficient. Rank-deficient
families are shown as not estimable, never filled with invented coefficients.
The scaled QR diagonal ratio is a numerical diagnostic, not a full condition
number or calibrated parameter uncertainty.

Training ranking is the maintained noise-floor criterion adapted to `2n` scalar
response readings:

`2n * log(max(pooled_training_mse, noiseSigma²)) + parameter_count * log(2n)`.

The default ambiguity delta is 6. A caller supplies positive `noiseSigma` as a
common torque-noise assumption; it is not estimated from checks. Training RMSE
above three times this assumption is reported as mismatch. No coefficient-sign
or energy constraint is silently imposed.

## Questions, observations and replay

`planCoupling` ranks only the explicitly supplied finite `permitted` input set.
With an adequately excited design, it uses the largest Euclidean separation of
competitive models' two predicted torque values. A separation above
`2 * sqrt(2) * noiseSigma` is a heuristic proposal threshold, not a probability
or safety margin. Any coordinate outside the training range is displayed.

If the complete directional design is rank deficient, a separate pilot policy
selects an input that increases numerical design rank. Missing coefficients
remain absent. No-permission, no-rank-gain, full-rank-but-unexecutable, model
mismatch and uninformative outcomes remain distinct. The caller's permitted set
is a declaration, not independent permission for hardware activity.

Each explicit acquisition records its permitted input index and raw observation.
Reopening reconstructs the original fit and every revision, evaluates the new
observation against the models from **before** that revision, then refits. Saved
derived results are ignored. The final separate-check rows remain outside all
fitting, ranking and proposal arithmetic. They are visible and reused for
comparison, so they are not described as a blind confirmation cohort.

## Evidence format and boundaries

Save a default course to obtain a complete valid input file. The JSON schema is
`worldlaw.coupling-notebook/v1`, with:

- `source`: explicit `kind` (`synthetic` or `measured`), label and reference.
- `units`: exactly `position: "rad"` and `torque: "N·m"`.
- `assumptions`: `quasiStatic: true` and a nonempty coordinate-convention note.
- `options`: positive `noiseSigma` and nonnegative `ambiguityDelta`.
- `training`: 8–2048 observations; `challenges`: 0–2048 separate observations.
- `permitted`: at most 512 distinct angle pairs.
- `revisions`: at most 64 ordered additions, with at most 2048 fitting rows total.

An observation has a unique `id`, a two-element `q` angle array, and a two-element
`torque` array. A revision's angle pair must exactly match its permitted index.
Inputs are finite and bounded; files are limited to 2 MB. Empty check evidence
has a null error rather than a perfect score. Explicit source classification
and references survive export; this application does not authenticate them.

The notebook conservatively refuses exact repeated angle/torque values across
fitting, checks and revisions even if an observation is renamed. Genuine repeated
quantized readings can occur; this rule does not establish that they were copied.
It prevents this particular consumer from counting them as fresh evidence. It
does not prove independence of any accepted acquisition. IDs and source notes
remain supplied assertions.

Imported notebooks never attach an oracle merely because their label or source
reference resembles an authored course. The user can record a separately supplied
response or explicitly start a new virtual course. Failed imports preserve the
current valid notebook; a late file read cannot overwrite a newer experiment.
Evidence remains local, and saving is an explicit download.

## Receiving

The dependency-free browser receiver launches the actual maintained server and
an installed Chrome/Chromium binary. No app or acquisition output is mocked:

```sh
BROWSER_EXECUTABLE_PATH=/path/to/google-chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-coupling-receipts \
node scripts/coupling-browser.mjs
```

It covers the actual two-acquisition course, retained first-probe error,
completed download, file reopen, measured-source classification, manual response,
renamed-evidence refusal, asynchronous import replacement, diagonal/directional/
nonlinear/underexcited controls, trusted keyboard activation, responsive field
and gauge views, reduced motion, runtime exceptions and external requests.

The first visual receiver passed its interaction assertions but inspection found
unreadably small mobile plot labels. The revised consumer uses compact plot
coordinates and stacks its gauges. The initial source transfer also hit an output
size limit; subsequent bounded transfers checked SHA-256 before receiving.
Two broader test failures came from omitted legacy receiving fixtures, not a
passing scientific result; restoring the exact telemetry JSON and raw PASCO CSVs
made both affected files pass (17 tests). All such preliminary failures remain
separate from final composed-source evidence.

The final integration composition includes main `a4620e1c` (angular prelude and
UNKNOWN probe work). It passes 360 native tests, with no failures and one existing
optional Playwright portability test skipped, both launched HTTP smoke paths,
and all 15 coupling/scalar Chrome workflow groups. The source-package receiver
also found older omissions in its explicit allowlist: the initial-state and new
prelude experiments plus duration receipts. Those maintained files are now
included. A candidate archive contains 224 source files; every archived file
matches its recorded SHA-256. This packaging check is a working-tree candidate,
not an installed release or an independently authenticated commit object.

Native tests include independent analytic matrix recovery, collinear and constant
inputs, an unoffered nonlinear law, directional/diagonal controls, check-only
counterfactual invariance, exact input replay, reuse/units/input refusal, absent
check evidence and bounded execution. A passing fixture establishes these
numerical and software contracts. Real sensor error, physical reciprocity,
temporal dynamics, instrument control and unfamiliar apparatus transfer remain
unqualified.
