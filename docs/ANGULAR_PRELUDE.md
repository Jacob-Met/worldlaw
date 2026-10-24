# Starting-rate measurement from a recording prelude

This extends the existing angular challenge and its initial-state instrument. Earlier positions can estimate the starting rate without changing the learned law or fitting later challenge angles. A user supplies an explicitly bound prelude, inspects every declared trailing window, selects a window deliberately, and compares the resulting initialization with the original supplied rate. Conditional noise propagation and window sensitivity remain separate from model error.

## Source and computation contract

The input schema is `worldlaw.angular-prelude-input/v1`, with `targetRunId`, `kind`, `units: {time: "s", position: "rad"}`, a source label, and 5–4096 strictly increasing samples. All timestamps must precede or equal the challenge start. The final time **and position** must equal the challenge's first observation. Evidence kind and target run must agree; when either source declares a recording ID, both IDs must agree. These checks bind declared records; they do not independently establish acquisition authenticity. The UI additionally retains the imported file's SHA-256.

Declare unique odd trailing sample counts from 5 through 31. Each window uses the maintained centered/scaled cubic regression, extracted into `angular-kinematics.mjs` and reused by the existing torque-observation adapter. Two-pass QR avoids forming normal equations. Invalid or rank-deficient windows remain explicit unavailable rows. Longer unavailable windows are never silently removed. The current QR diagonal ratio is a conditioning diagnostic, not a matrix condition-number guarantee.

The cubic's endpoint derivative estimates rate. A caller-declared position standard deviation propagates through the linear derivative weights. With no declaration, residual scatter supplies an explicitly labeled proxy. Both assume independent position errors and locally cubic motion; neither includes approximation bias, time error, calibration error or correlated sensor noise. The conditional sigma does **not** automatically set initial-state grid widths. Window disagreement is descriptive sensitivity evidence, not a confidence interval.

`comparePrelude` requires an explicit available window. It retains the original rate and recomputes its nominal prediction, then executes the chosen derived-start grid. A single work budget reserves both sets of coarse/half-step integrations before either executes. Future observations affect receiving errors only. The physical model, training ranking, source angles and original supplied rate remain unchanged. Failed or step-sensitive predictions retain the initial-state instrument's refusal semantics.

## Existing-workbench use

Within the angular initial-state instrument, open **Estimate the start from earlier angular measurements**, import the prelude JSON, declare window sizes and a noise scale (blank selects the residual proxy), then estimate. Every declared window appears in supplied order. Choose one explicitly and apply it before running **Compare declared starts**. Restore the original supplied rate at any time. Changes to the model/run or prelude choices invalidate stale results.

The exported `worldlaw.prelude-notebook/v1` contains model, original run, source prelude and declarations, rather than trusting cached scores. `reopenPreludeComparison(text)` reruns estimation and both prediction routes from those inputs. This module replay is tested; browser notebook re-import is not yet implemented. Selecting a window after inspecting later challenge errors is exploratory reuse and must not be described as an independent predictive validation.

## Executed controls and measured reuse

Run `node --test --test-isolation=none tests/angular-prelude.test.mjs tests/prelude-investigation.test.mjs tests/trajectory-observations.test.mjs` for the 19 targeted controls. They cover exact cubic derivatives, a deliberately wrong supplied rate, invariance to changed future angles, explicit selection, input-based replay, refused future/mismatched samples, unavailable windows, source identity, shared integration budget, and unchanged existing observation-adapter behavior. A fixed 512-replicate IID Gaussian cubic experiment checks the conditional derivative scale separately from model approximation bias.

`node experiments/angular-prelude.mjs` reuses the existing PASCO source recording, verifies its published raw SHA-256 and uses only positions through the fixed challenge start at 5 s. It retains all four declared windows and their outcomes. This previously inspected recording is exploratory evidence; the declared 0.001 rad position scale is not calibrated uncertainty.

| Trailing samples | Estimated rate (rad/s) | Fixed-law future position RMSE (rad) |
|---:|---:|---:|
| Original supplied rate 0.785 | 0.785 | 0.322969 |
| 5 | 0.642857 | 0.319334 |
| 9 | 0.604906 | 0.318975 |
| 17 | 0.568154 | 0.318873 |
| 31 | 1.309550 | 0.367496 |

No winner is selected from this table. The law still mismatches the physical recording. A separate noiseless harmonic control shows why narrower conditional noise is insufficient: a 31-sample cubic window has rate bias 0.023275 rad/s while its declared-noise conditional sigma is 0.018770 rad/s. Shorter windows have more noise amplification and less approximation bias in that control. Neither this one control nor the reused physical record establishes a universal window rule, calibrated uncertainty, apparatus validity or torque-scale identifiability.

## Receiving status

Core and original adapter controls have executed locally. This increment remains separate from the frozen initial-state sensitivity candidate. The new foldout and source import still require independent review and actual-browser receiving before integration.
