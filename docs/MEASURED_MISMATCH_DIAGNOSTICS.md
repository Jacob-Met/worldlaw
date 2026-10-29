# Distinguishing measured mismatch mechanisms

These checks use the now-consumed length2 PASCO courses; none is a new independently held qualification. All original frozen adverse comparisons remain unchanged. The author's original headers identify angle in rad and angular velocity in rad/s, and the retained author README states both were collected with the PASCO PS-3220. That establishes supplied channels and units, not statistical independence, sensor error bounds or a particular rate-estimation algorithm.

## Original-channel kinematics

A diagnostic compares original angle increments with the trapezoidal integral of original supplied rate, without differentiating angle or modifying either channel. On common0.4s windows every0.1s, both training courses give0.00125544rad RMS discrepancy. A training-only affine diagnostic yields gain1.00158176 and bias1.98e−5rad/s, reducing this to0.00108656rad. Of prescribed offsets−0.05 through+0.05s in0.01s steps, zero offset minimizes the training score. Identical endpoint windows are used across offset alternatives. Consumed repetition3 gives0.00135717rad original discrepancy,0.00108238rad under the training affine diagnostic.

These small increment discrepancies do not support a large simple rate/angle lag or gain inconsistency as the explanation for roughly0.024rad forward trajectory error. This is a diagnostic comparison, not a calibrated sensor correction or proof of channel consistency: quadrature, quantization, sensor definitions and unmodeled errors remain. No inferred shift/gain/bias is applied in the product.

The existing joint-channel consumer now exposes the simpler uncorrected check, separately for original training and challenge courses. It uses original timestamp endpoints and reports actual window bounds. Complete work is bounded before integration:8192rows,2048windows and1million source segments. Missing/nonfinite channels, nonfinite arithmetic and exceeded work return unavailable/refused results. There is no binary consistency verdict and the check never chooses coefficients, scales or model family.

## Local optimizer check

The frozen two-term joint fit has scaled training score0.71055590. All eight neighboring samples in a prescribed3×3 grid (rate increments±0.0001, gravity increments±0.001) worsen it; all numerical screens pass. This argues against merely stopping just before an obvious local improving step. It is not a global-optimality proof and cannot exclude distant basins or other parameterizations. Complete nine-model forward work was reserved.

## Already offered family comparison

Before repetition3 was acquired, the maintained full-six training comparison had already selected rate+gravity+bias. Reusing that offered constant term as a conditional diagnostic is justified by the training comparison, not by inventing measured forcing. With the same three-iteration budget/scales/screens and an explicit bias bound±1rad/s², joint training score improves slightly to0.70842750, but consumed repetition3 worsens to0.02649533rad position and0.16991514rad/s rate. Position-only optimization of that family gives0.02528849rad. A constant acceleration term is not identified as a physical torque, sensor offset or external force.

## Residual structure and remaining ambiguity

A descriptive all-row projection onto predicted position, predicted rate, elapsed-time×predicted-rate and a constant reduces the consumed third-course residual RMS from0.02409562 to0.00759140rad. Its phase-like coefficients differ from the training courses. This projection uses the displayed observations themselves and is not an independent forecast, corrected source, executable law or causal diagnosis. The all-row RMS includes the initialized sample; maintained forecast summaries exclude it.

Taken together, these checks do not identify a single cause. They weaken the simple large channel-lag/gain explanation and the obvious-local-optimizer-step explanation, while retaining course-dependent amplitude/phase structure and worsening transfer from a more flexible already-offered family. Initial-state error, model inadequacy, recording variation and sensor effects remain distinguishable hypotheses requiring further source-supported evidence. No numerical screen or original adverse result was relaxed.
