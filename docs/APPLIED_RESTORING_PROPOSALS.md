# Restoring-family proposals with unknown scalar inertia

The applied-torque instrument now asks whether its original linear restoring hypothesis predicts the supplied motion adequately. The explicit comparison retains that original instrument and offers three finite families: linear, sinusoidal, and linear plus cubic restoring torque. It jointly estimates positive scalar inertia, nonnegative linear damping, and each family's restoring coefficients from the original declared calibrated joint torque and angle recordings. This is a conditional finite comparison, not unrestricted discovery or unique physical identification.

## Source and selection boundary

The original `worldlaw.applied-torque-study/v1` inputs remain unchanged, including the original linear interpretation and calibration declaration. A comparison is an explicit revision hypothesis. It does not silently change the meaning of a legacy file.

The first declared fraction of each original training recording supplies weak-window fitting rows. Each prefix-fitted model then predicts the entire original training recording from its original initial position and rate, using the supplied forcing. Only the later training angle residuals rank families. There is no state reset at the split. The default fraction is 0.7, and each recording must contain at least 17 prefix and two later samples. Original sample indices and split times remain in the result.

Qualification by the declared position tolerance comes first. An outside-tolerance family cannot displace a qualified one merely by being simpler. The selection score within that qualification class is `N × log(max(validationRMSE², positionTolerance²)) + coefficientCount × log(N)`. The default position tolerance is 0.01 rad and the heuristic ambiguity gap is 6. Neither quantity is inferred noise, a probability, or confidence. All alternatives remain visible, including those outside the competitive score set. The score cannot physically exclude a family.

An automatic proposal requires a complete, numerically screened catalog, one competitive family, and a preferred prediction within the declared tolerance. Missing or numerically unresolved alternatives produce an incomplete-comparison result. No within-tolerance family produces an explicit model mismatch. Several competitive families produce ambiguity. Original rank deficiency and physically inadmissible inertia/damping remain visible.

The full-training coefficients are refitted separately after the prefix comparison. Separate challenge observations, challenge errors, and challenge execution-budget refusals cannot alter the training decision. Challenge forecasts use each full-training candidate and the challenge's original initial state. Supplied future forcing remains an input; this does not predict unknown forcing.

## Work and numerical limits

The entire three-family forward comparison is reserved before execution. A later challenge catalog is reserved as a whole; it is never partially executed to choose a convenient winner. The feature reuses normalized weak windows, column-scaled QR, the existing forward integrator, and coarse/refined resolution comparison. Agreement at two resolutions is a screen, not convergence or an error bound. A separate weak-window work allowance bounds fitting work.

## Ordinary use and reproducibility

Open the trajectory apparatus and use **Identify inertia from applied torque**. Load original inputs or the explicitly authored nonlinear course, then choose **Compare restoring families**. The original linear result stays above the comparison. A marked original training plot shows all available prefix-fitted forecasts and the later interval used for selection. The table keeps validation error, full-training inertia, and separate challenge error distinct. An optional explicit family choice enables inspection without claiming that the family was uniquely identified.

**Save comparison inputs** stores only the original source, comparison settings, and optional explicit family choice under `worldlaw.applied-restoring-notebook/v1`. Reopening recomputes all fits and predictions. Source/setting replacement retires prior conclusions. A late file read cannot replace a newer parent source.

## Authored controls and limitations

`node tests/applied-restoring.test.mjs` checks training/challenge separation, exact parity with the original full linear fit, ambiguity at small angles, an omitted quintic law, incomplete numerical catalogs, rank and physical admission, and source-only replay.

`node scripts/applied-restoring-counterexamples.mjs` checks three generating families across three fixed noise seeds. In the authored sinusoidal example, the independent challenge error decreases from roughly 0.135 rad under the original linear hypothesis to roughly 0.0014 rad. This is synthetic behavior under explicitly provided forcing, timing and calibration, not a measured physical result.

The same counterexample multiplies every supplied torque by 1.7. The inferred inertia also changes by 1.7 while predicted motion quality stays the same. Fit quality cannot authenticate calibration. Coordinate noise, time alignment, unlisted mechanisms, unmeasured initial rates, and changed forcing can all mislead the finite catalog. Small-angle linear and sinusoidal laws remain practically ambiguous. Restoring coefficients are not constrained to be passive.

`node scripts/applied-restoring-browser.mjs` exercises the actual source-linked apparatus, source-only file download/reopen, original baseline retention, late-read invalidation, and desktop/narrow plots. It requires the maintained Chromium sandbox admission; it does not change sandbox controls.
