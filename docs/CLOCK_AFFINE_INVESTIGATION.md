# Joint affine-clock investigation

This successor tests a limitation exposed by the fixed-offset receiver. In an authored source with a 1% clock-rate difference, the best offered constant offset can fit the early course while failing later observations. The investigator can now declare one finite family of clock scales and offsets and test every map against the same fixed physical law and original source.

## Explicit correspondence

Each offered map uses

`torqueTime = torqueOrigin + scale × (stateTime − stateOrigin) + offset`.

The two origins are declarations, not fitted values. Scale is dimensionless; offset and the maximum interpolation gap use torque-clock seconds. Scales are admitted between 0.5 and 2, offsets within ±60 seconds, and there are at most 65 distinct complete hypotheses. This is a finite comparison, not a continuous optimizer or a claim of true clock calibration.

The operator keeps all original torque timestamps unchanged. It maps state timestamps into that clock, intersects admitted source support over the entire family, then checks that **no original torque index** supports both training and challenge anywhere in the family. This is stronger than checking each clock hypothesis separately: a torque reading could support training under one map and challenge under another. That cross-map case refuses the complete investigation.

After this common admission step, each candidate calls the maintained fixed-offset receiver at zero additional offset. The established fixed-law predictor, interpolation, residual scores and units therefore remain the numerical owner. Original state indices are remapped into every result, alongside original state time, corresponding torque-clock time and original torque bracket indices. Rejected state rows retain their candidate-specific support failure reasons. No candidate is scored on a more favorable subset.

Only training RMSE selects hypotheses. Every map within the explicitly declared absolute tolerance is retained. Challenge scores remain separately visible for every hypothesis. Save/reopen stores the original model and inputs and recomputes all derived results.

## Consumer design

The instrument belongs beside the existing constant-offset comparison. Two compositions were considered: separate offset profiles for each scale, and one two-dimensional offered-hypothesis diagram. The latter exposes the joint scale/offset family directly without suggesting a continuous fitted surface. Each marker denotes one actual offered map; the retained set is green, with exact training/challenge errors in the accompanying table. Original correspondences and the complete global custody sets are inspectable below it.

The panel is mounted beside the fixed-offset instrument on predecessor merge `27ce620aec41c2b0ddb0876683bedcc6f49f0b00`. It supports fixed Studio-law capture, a declared synthetic control, source import, recomputed input-only reopening, source edits and pending-import invalidation. The numerical table scrolls within a keyboard-focusable region on narrow screens so values stay intact. `scripts/clock-affine-browser.mjs` exercises the actual Studio at desktop and 390-pixel widths, including keyboard activation, source-only download/reopen, Studio invalidation and delayed file reads; `npm run verify` covers the maintained native and launched-application courses.

## Executed science and controls

The authored delayed source with 1% clock-rate error selects the correct offered map. Constant-offset candidates retain a later challenge discrepancy exceeding 0.05 N·m while the correct affine map predicts its challenge to numerical roundoff. A separately authored irregular linear source also recovers a negative clock-rate difference with nonzero clock origins. These are numerical controls, not physical measurements.

Twelve direct native groups cover joint versus offset-only behavior, independent reconstruction of every original torque bracket, challenge-mutation invariance, clock-origin translation, cross-map-only reading leakage, common exclusions, flat ambiguity/wrong-law mismatch, source-only replay, invalid maps, the independent irregular source and the full 65 × 2,048 candidate/state limit with 4,096 torque readings. The complete family executed in approximately 267 ms in the local Node 24 run; this is a development observation, not a runtime guarantee.

Clock-rate error, changing dynamics, incorrect torque calibration and other instrument defects can remain confounded. A better affine map does not establish a physical cause. Linear interpolation remains an unverified observation assumption; temporal correlation and acquisition independence are not established by source-index separation.

A retained confounding counterexample has perfectly aligned clocks and a torque-instrument gain of 1.25 on a linear command course. The offered scale-0.8 hypothesis fits both training and challenge exactly despite the true cause being gain. Successful challenge prediction therefore does not establish clock drift; another observable or independently established instrument calibration is needed to distinguish those explanations. This is an executed negative control, not an omitted limitation.
