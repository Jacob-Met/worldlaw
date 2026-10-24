# Conditional predictions from repeated measured starts

The existing free-trajectory challenge asks whether a learned law predicts a separate recording from one supplied initial state. This additional instrument asks a different question: can the **same frozen law** predict short future segments when each segment starts from an explicitly declared measured prefix? Local predictive skill can coexist with a poor long free-running trajectory. The comparison does not identify whether accumulated error comes from parameter bias, timing, omitted dynamics or initial measurement uncertainty.

The instrument stays in the angular trajectory workbench. It reuses the existing prefix derivative kernel, initial-state numerical screen and no-learning baselines. It does not fit a physical coefficient, change model ranking, select a horizon, plan a release or replace the original challenge.

## Declaration and computation

Supply zero-based origin indices and forward sample counts. Every origin needs the complete declared odd prefix window (5–31 positions) ending at that origin. Future receiving positions never enter that origin's derivative estimate or forecast. The unchanged angular model receives the measured origin angle and the estimated rate. Constant-rate and persistence baselines use the same segment and initialization.

Every origin/horizon pair must fit completely in the recording. A missing tail is refused rather than silently shortened. The maximum is 64 origins, eight horizons, 96 combined pairs, and 1,000 future samples per pair. All coarse and half-step integration work is reserved under one bounded budget before any prediction. Prefix failures, model failures and step-sensitive results remain explicit trial outcomes. If any required origin fails at a horizon, its aggregate model **and paired baseline scores** are unavailable; successful survivors do not create a favorable replacement population.

Forecast-only admission shares the maintained source/time/state validator with the solver and accepts two or more points. The fitting boundary still requires five points; no training minimum is relaxed. Exact one-, two-, three- and four-future-sample controls exercise both boundaries.

Per-horizon RMSE pools equal-sized future segments, excluding each initial sample. Skill uses the existing meaning, `1 − model MSE / baseline MSE`. There is no horizon winner. Origins and horizons may overlap, so counts are prediction/observation pairs rather than independent experimental replicates. Later measurements can legitimately initialize later origins; changing a later position must leave an earlier origin's forecast unchanged, but need not leave a later origin unchanged.

The prefix's conditional derivative sigma is retained for inspection. It assumes the declared independent position noise (or uses a residual proxy), and excludes local-polynomial approximation bias and acquisition/calibration uncertainty. It is not an automatic uncertainty band. The current instrument uses one prefix window declaration for all origins. Repeatedly choosing origins, windows or horizons after viewing errors is exploratory reuse.

## Existing-workbench flow

After importing an angular recording and fitting a model, use **Does the law predict motion from repeated measured starts?** The offered default origin spacing depends only on record length; it is not optimized against outcomes. Declare the origins, forward sample counts and prefix window, then run **Compare conditional forecasts**.

The summary retains each declared horizon. Its chart shows recorded motion and separate forecast segments; the horizon selector changes the view without refitting. Expand the detailed table to inspect every origin, prefix boundary, actual elapsed duration, estimated rate, receiving RMSE and outcome. On irregular clocks, equal forward sample counts need not imply equal durations; the per-trial table retains this distinction. Editing inputs clears stale results and export availability.

`worldlaw.rolling-origin-notebook/v1` exports the model, normalized source recording and declarations. `reopenRollingOrigin(text)` recomputes all outcomes from those inputs. Cached scores are never used as evidence. Module replay is tested; importing this notebook into the main model-selection route is not implied.

## Executed scientific controls

Nine focused native controls cover an analytic oscillator against matched baselines, per-origin future-position invariance, complete work reservation, insufficient-tail and duplicate-declaration refusal, retained failed rollouts, input-based replay, wrong-law prediction error, and one unavailable prefix among otherwise successful origins. The partial-failure control verifies that no successful subset produces an aggregate score.

`node experiments/rolling-origin.mjs` runs the maintained PASCO challenge with a frozen weak-fit law and explicitly declared 9-position prefixes, origins every 100 samples from indices 100 to 1900, and horizons of 10, 50 and 100 samples. It retains the source/model identities and every trial. This is exploratory reuse of an already-inspected physical recording, not an unseen mechanism or new independent experiment. All 57 pairs pass the declared numerical screen, using 11,196 reserved integration steps.

| Horizon on this 100 Hz recording | Origins | Frozen-law RMSE (rad) | Constant-rate RMSE (rad) | Persistence RMSE (rad) |
|---:|---:|---:|---:|---:|
| 0.1 s | 19 | 0.028847 | 0.060349 | 0.240148 |
| 0.5 s | 19 | 0.072534 | 1.161355 | 0.846569 |
| 1.0 s | 19 | 0.072314 | 2.740560 | 0.915625 |

The original-start free trajectory still has RMSE approximately 0.322969 rad. The smaller conditional errors do not replace that result: these forecasts receive repeated state information that the original-start forecast does not. The observations support local predictive usefulness of the frozen law within this recording, while leaving the cause of long-horizon failure unresolved. Numerical agreement is not physical validity, and these errors are not calibrated confidence or evidence of independent replicate performance.

## Receiving status

The implementation is isolated under native claim #35 and depends on the shared prefix helper from #28. The actual-browser receiver exercises canonical keyboard activation, actual input download and recomputation, invalid-tail refusal, stale-output clearing and responsive charts alongside the preceding initial-state/prelude workflows. It is authored and syntax checked; independent review and actual-browser execution remain required before integration.
