# Angular-law comparison across declared conditions

WORLDLAW's Trajectory Challenge now compares three coefficient-sharing assumptions on the same original recordings: complete pooling, shared restoring coefficients with condition-specific dissipation, and independent coefficients for every condition. Models are selected using training only, then executed from a separate recording's measured initial position and rate.

This is an additive recovery contribution to [issue #29](https://github.com/Jacob-Met/worldlaw/issues/29). The original `hamon-171b58b2f93b-20261023/mechanism` attribution is preserved. It does not implement #33 geometric scaling or alter the maintained QR, weak operator, angular normalization, or rollout kernels.

## Use the actual application

Run `npm start`, open Trajectory Challenge, and choose **Compare recordings across conditions**. The same component is available through `npm run trajectory` and the maintained standalone trajectory build.

1. Choose [physical-environments-training-03ae912a3e15.json](../examples/physical-environments-training-03ae912a3e15.json) in **Choose training bundle or saved source comparison**.
2. Select **Fit training recordings**. The complete candidate ledger and training trajectories are computed in this browser.
3. Choose [physical-environments-challenge-03ae912a3e15.json](../examples/physical-environments-challenge-03ae912a3e15.json) in **Choose separate challenge bundle**. This executes the training-selected models; it does not refit them.
4. Inspect each recorded motion, signed prediction-minus-observation strip, and angle RMSE. **By condition** keeps each original recording central; **By model** isolates each sharing assumption.
5. **Export sources** saves original recordings, their evidence roles, provenance, and the versioned protocol. Reopen that file and fit training to recompute the same comparison. Fitted coefficients and scores are not imported as evidence.

Malformed replacement sources leave the previous valid comparison usable. All candidates, rank failures and failed forecasts remain visible. Challenge controls are disabled before training has been fitted.

## Fixed comparison

The implementation admits 2–4 explicit environments, 2–4 training runs per environment, at most 16 runs and 8,192 training samples in total. Challenge input must include exactly the same environment IDs with 1–2 separate runs per condition and at most 8,192 samples. Every run preserves unknown inertia explicitly, declared seconds/radians/radians-per-second units, source identity and supplied initial rate.

The maintained full-run and copied-subwindow checks are applied to every pair across all training and challenge sources. These are recording-separation screens; they do not independently establish how the author acquired the recordings.

The offered terms, in fixed order, are rate, rate sign (Coulomb), position (spring), sine of position (gravity), rate times absolute rate (quadratic), and a constant bias. Every subset of at most four terms is tried, including the zero-acceleration model: 57 subsets under three sharing modes, or 171 candidate attempts.

| Mode | Coefficient sharing | Free coefficients for s restoring and d dissipative terms, E conditions |
|---|---|---:|
| Pooled | Every selected coefficient shared | s + d |
| Shared restoring | Spring, gravity and bias shared; rate, Coulomb and quadratic local | s + E d |
| Independent | Every selected coefficient local to its condition | E(s + d) |

All candidates use the same complete weak rows, with one-second windows, half-second stride, and nine-point local rate estimates for nonlinear dissipative features. No observations or windows are thinned. The weak operator normalizes each row by its position-noise gain; overlapping-window covariance is not whitened.

The score is `n log(max(weakRMSE², 0.01²)) + k log(n)`, with the actual expanded free-coefficient count k. A delta of six defines the retained competitive band. This is a selection heuristic, not calibrated model probability. Declaration order resolves exact ties while the full tied set remains reported.

Sample and complete-window support, local-rate work, and all expanded matrix work are admitted before fitting. The comparison permits at most 2,048 weak windows and reserves the entire 171-candidate search. Forecast work reserves the exact per-observation integration schedule for all selected modes at both steps before execution, capped at one million integration steps in total. These units count integration steps, not derivative evaluations.

## Reserved measured receiving

The [source dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset/tree/cbf82673641ecd65e902ad5c38a048387649a2a0) is pinned to `cbf82673641ecd65e902ad5c38a048387649a2a0`. It describes PASCO recordings of a nominal 0.330 m pendulum under air and small-paper-baffle conditions. Repetitions 1 and 2 in each condition trained this comparison; repetition 3 was reserved.

The original interval 5–15 seconds was retained without recentering, resampling, time rebasing, or smoothing of exported observations. Zero-based CSV data row 500 is the initial sample at 5 s; row 1500 is the last sample at 15 s. Each source supplies 1,001 samples. Initial rates for the reserved runs are the recorded values −0.157 rad/s in air and 3.142 rad/s with the baffle. The scored 1,000 future positions exclude that supplied initial state.

The procedure, 15 source/dependency files, four raw training hashes, and complete training ledger were frozen before the reserved CSVs were fetched:

- Fitting source commit: `128b1206ca84f3cdedc29ede8a1ef94447f8baaf`.
- Freeze time: 2026-10-27 09:02:36.968229 UTC.
- [Training freeze](receipts/shared-environments-20261027/training-freeze.json), SHA-256 `0aefae630b2e9d0cc8cfd61ed0a9203b3c013fa52467056d0a8fdd156817f45d`.
- [Complete training ledger](receipts/shared-environments-20261027/training-ledger.json), SHA-256 `27c94780ec2cf8128860f1fa81bce8f3bbc6df7202ffd95784efd52137291650`, remained byte-identical after receiving the challenge.
- [Challenge receiving](receipts/shared-environments-20261027/challenge-receiving.json) preserves both integration resolutions and every recording outcome.

The training comparison used 76 weak windows. All 171 candidate fits succeeded; the best candidate within each mode was executed. It selected independent Coulomb, gravity and bias terms (six coefficients); two other independent-mode candidates, using linear-rate or quadratic-rate dissipation, remained within delta six. This does not uniquely identify a physical dissipation mechanism.

| Reserved condition | Pooled angle RMSE | Shared-restoring angle RMSE | Independent angle RMSE |
|---|---:|---:|---:|
| Air, repetition 3 | 0.03173623 rad | 0.03469819 rad | 0.02668708 rad |
| Small baffle, repetition 3 | 0.01534141 rad | 0.01160782 rad | 0.00966396 rad |

Halving the maximum integration step from 0.01 s to 0.005 s preserved every ranking. Refined errors were 0.03173589 / 0.03475156 / 0.02669502 rad in air, and 0.01534166 / 0.01168397 / 0.00965121 rad with the baffle, in the same mode order.

The largest RMS difference between base and refined predictions was 0.00017487 rad. That refinement diagnostic includes the fixed initial sample; position RMSE excludes it. For a comparison on the same future-sample support, multiply the reported refinement RMS by sqrt(1001/1000). The closest model gap still exceeds the corresponding summed refinement changes by about 6.6 times. Agreement at these two resolutions supports the reported ordering; it is not an error bound relative to an exact solution.

The training-selected independent models also had lower reserved-recording errors in both observed conditions. Shared restoration improved on pooling for the baffle but worsened the air prediction. This result does not identify a physical cause: condition-specific coefficients can absorb measurement-reference differences, initial-state error, omitted dynamics or actual mechanism changes. A baffle can affect inertia or angle zero. One reserved repetition per condition does not establish statistical significance, unseen-environment transfer, geometry, physical inertia or absolute torque. No fitting or protocol tuning followed challenge receipt.

## Independent mathematical receiving

The retained independent reviewer designed exact linear damped-oscillator fixtures with common spring k = 4 and damping gamma = 0.12 / 0.45, plus a deliberately different-spring case k = 4 / 6.25. The root executed these through the real weak preparation and fitter, and through the maintained rollout on separate analytic initial conditions.

At training intervals 0.02 s and 0.01 s, correctly specified coefficient errors were below 1e-6 and 6e-8, respectively. Maximum errors decreased approximately sixteenfold under that refinement. Fine-grid analytic forecast RMSE was below 1e-8 per condition; integration-step changes were below 3e-9 RMS. Incorrectly forcing a common spring in the different-spring fixture yielded forecast RMSE above 0.1 in both conditions.

Parameter counts 2/3/4 for fixed spring-and-rate models, residual nesting, the expected log(76) one-parameter score penalty, complete 171-entry ledgers, zero and duplicate-column rank failures, source preservation, challenge-only perturbation, budget refusal, and source-only reopening were verified. Regression tolerances were calibrated from the first analytic refinement result before the reserved measured recordings were opened. They were not independently preregistered or universal solver guarantees.

See [analytic-oracle.json](receipts/shared-environments-20261027/analytic-oracle.json) and run `node --test tests/shared-environments.test.mjs`.

## Visual and integration decisions

Both actual by-condition and by-model arrangements were received at desktop and 390-pixel widths with identical fitted models and sources. By-condition is the default because it shows each original recording once and retains the alternative forecasts together; by-model remains available for isolated inspection.

Initial pixels exposed inherited nonwrapping table rules and overlaid predictions hiding small discrepancies. Scoped typography and wrapping repaired the outcome table. Signed residual strips now derive prediction minus observation directly at the paired timestamps, with a symmetric shared scale within each evidence role. Primary per-recording angle errors remain readable on narrow screens without scrolling the detailed table.

The actual browser course covers file upload, training, separate challenge, the complete ledger, signed residuals, both arrangements, keyboard focus, reduced motion, ordinary source export, fresh-session replay and malformed replacement. The exported source-only file reproduced both training and challenge outcomes exactly in the received browser. Source and packaged receiving details accompany the PR; no mock inference or sandbox weakening was used.

## Reproduce

```sh
python3 examples/physical-environments-03ae912a3e15/build-bundle.py
node --test tests/shared-environments.test.mjs
node scripts/receive-shared-environments.mjs examples/physical-environments-training-03ae912a3e15.json .receipts/environment-receiving examples/physical-environments-challenge-03ae912a3e15.json
npm start
```

The source README includes reserved-fetch validation. Complete author license and attribution, raw CSVs and extraction code remain in [physical-environments-03ae912a3e15](../examples/physical-environments-03ae912a3e15). The browser receiver accepts installed Playwright and Chrome paths through `PLAYWRIGHT_MODULE` and `BROWSER_PATH`; it does not install dependencies.
