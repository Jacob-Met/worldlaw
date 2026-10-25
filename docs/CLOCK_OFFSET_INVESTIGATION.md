# Fixed-law clock-offset investigation

The Studio's **Test the instrument clock** instrument compares a fixed executable torque law with separately timestamped torque readings. It addresses a concrete ambiguity in the telemetry adapter: aligned commands and observations are assumed there, while a sensor clock offset can make an otherwise useful law look wrong.

This is an additive investigation. It neither corrects Studio observations nor refits the law. Select **Use inspected Studio law** to capture its current terms, or open an investigation containing an explicit fixed model. **Authored delayed-sensor control** loads a separately declared unit-command law and synthetic source, clearly identified as such.

## Observation interpretation

Positive offset means `torque-clock time = state-clock time + offset`. At each original state time the maintained `predict` evaluates the fixed law. The torque receiver uses an exact source sample when its time matches, otherwise linearly interpolates between its original two surrounding samples. It never extrapolates. A bracket wider than the declared `maxGap` is not admitted. This bound is a sampling declaration, not an error estimate: curved or discontinuous signals can invalidate linear interpolation even across a small gap.

Every offered offset uses exactly the same original state rows: a state is excluded from all candidates if any candidate lacks admissible torque support. Original state indices and torque bracket indices remain inspectable. Maximum input sizes are 65 unique offsets in ±60 seconds, 2,048 state samples and 4,096 torque samples. No continuous offset search is claimed.

States explicitly declare `training` or `challenge`. Each role needs at least two common-support rows. Across the entire offered grid, no original torque sample may contribute to both roles. A shared bracket refuses the investigation and requires a wider guard interval. This prevents direct reading reuse; it does not authenticate independent collection or remove physical serial correlation.

Only training RMSE determines the retained offset set: every candidate within `tieTolerance` N·m of the minimum is retained. A unique offset is displayed only when that set has one member. Challenge RMSE is reported for all offered candidates but never used in selection. A failed challenge remains a failed challenge; neither coefficients nor offset are changed in response. A wrong law can remain wrong at every offset, and a flat or periodic signal can leave offsets ambiguous.

## Consumer and replay

The residual profile is the central comparison, with green training and rust challenge curves, exact numeric table and expandable original-source bracket inspector. Two visual arrangements were considered: overlaying each shifted time series, and plotting residual against offered offset. The offset profile was chosen because it makes the competing clock hypotheses and independent challenge disagreement legible on narrow screens; the source-bracket inspector preserves the underlying time correspondence without hiding it behind overlapping traces. Connecting lines only join offered candidates and do not imply continuous inference.

Editing the original JSON retires the prior comparison and disables saving. Studio law/source changes retire a snapshot captured from Studio. An explicitly opened investigation retains its own separately labeled model. Async file imports are discarded if intervening edits make them stale. Files contain only the model and original input; reopening reruns the operator and ignores any injected derived result.

## Qualification

`node tests/clock-offset.test.mjs` exercises ten groups: independent bracket reconstruction, delayed torque, challenge-mutation invariance, flat ambiguity, wrong-law mismatch, common support and no extrapolation, gap refusal, cross-grid custody, invalid declarations, input-only replay, irregular clocks, signed offsets and the full declared work bound. The authored control selects +0.2 seconds and predicts its separately designated challenge segment to numerical roundoff; this is software qualification, not measured physical evidence. The full 65 × 2,048 candidate/state control completed in roughly 125 ms in the local Node 24 run; that single timing is not a product latency guarantee.

Browser receiving and integration status are recorded in the PR receipt after execution. No physical mechanism, calibrated uncertainty, actual sensor synchronization, provider route, hardware operation or deployment is established here.
