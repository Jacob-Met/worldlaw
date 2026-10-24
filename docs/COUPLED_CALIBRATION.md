# Coupled circulation under systematic encoder calibration

After comparing a loop in Coupling Lab, open **Does the encoder calibration act
together or separately?** Supply a positive gain interval and calibration basis.
Both offered hypotheses use that same marginal interval: one common gain on both
coordinates, or independent gains. Original readings and torque bounds are
preserved. Identity gain and zero offset defaults are copied assumptions, not
inferred sensor precision.

The model is `q_true[a,i] = gain[a] * q_nominal[a,i] + offset[a]`, with each offset
constant throughout the course. Offset bounds remain in the input, but offsets
cancel every segment difference exactly. No rotation, cross-axis mixing or
time-varying drift is represented. Torque errors remain independent of angle
calibration in their declared physical convention. This is a physical reading
calibration hypothesis, not a coordinate transformation with an implicitly
changed conjugate force.

## Exact composition and witnesses

The module reuses `analyzeCirculationBoxes` at zero independent angular radii and
zero integration allowance. The maintained scalar angle-box dynamic program
supplies exact per-axis work extrema and original torque endpoint witnesses.
The small `exportExactDyadic` wrapper validates finite numeric input and exposes
the existing binary64 decomposition without changing the solver.

Shared gain multiplies the exact sum of coordinate work intervals. Independent
gains multiply each coordinate interval separately before exact summation.
Interval products inspect their four endpoint products using integer/exponent
arithmetic. The explicit positive-gain admission preserves coordinate orientation;
zero, negative, nonfinite, inverted or above1000 gain bounds refuse.

The original physical-J integration allowance expands the calibrated result once
afterward. It is neither multiplied by gain nor counted once per coordinate.
The minimum/maximum polygon witnesses retain gain choices and original torque
endpoint flags. Shared-gain witnesses use exactly the same factor on both axes.
They attain polygon extrema; the separate integration allowance is not an acquired
or reconstructed source reading. An exactly constant coordinate contributes zero.

Saved `worldlaw.coupling-encoder-calibration/v1` files contain only normalized
original inputs and calibration declarations. Reopening recomputes. Source/input
changes invalidate conclusions. A late detached import cannot resurrect an old
inspector. An independent saved calibration course does not replace the nominal
law comparison above it.

## Executed authored controls

A square with torque `[theta2, 1.02 * theta1]` has approximately0.02J nominal work.
With±1% gain uncertainty, the shared hypothesis retains[.0198,.0202]J while
independent gains admit[-.0002,.0402]J. Adding independent±.001Nm reading bounds
gives[.01584,.02424]J and[-.0042,.0442]J respectively. These are authored controls,
not measured sensor calibration or a physical mechanism result. Native binary64
inputs are treated as their exact represented values.

Six native groups pass via `node tests/circulation-calibration.test.mjs`, including
complete1024 reading-corner enumeration with every gain endpoint and actual
attaining joint witnesses, offset cancellation, reversal, unit gain, source-only
replay, constant axes and invalid declarations. Separate Python Fraction controls
qualify the proposed composition on nine reading/gain combinations. Browser
receiving remains a separate gate using `WORLDLAW_CALIBRATION_RECEIVING=1` with
the maintained circulation browser harness, alongside existing allowance and
coordinate-box flags. Do not treat these native passes as browser or deployment
verification.

The consumer stays attached to the actual original-loop instrument, preserving
nominal laws and the independent-coordinate inspector. A separate calibration
page was rejected because it would separate the dependence hypotheses from their
source readings. The witness selector exposes actual common-factor versus
independent-factor assignments rather than a decorative uncertainty illustration.

## Interpretation limits

The result is conditional on explicitly offered systematic error models. It does
not choose or authenticate an instrument model, refit physical laws, receive a
full torque field, establish continuous-path work, passivity, dissipation,
statistical confidence or a biological/physical cause. Shared positive gain alone
cannot reverse fixed total-work sign; independent gains can remove a sign
exclusion when coordinate work contributions cancel.
