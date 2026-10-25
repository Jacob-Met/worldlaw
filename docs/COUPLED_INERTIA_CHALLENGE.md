# Challenge frozen inertia with separate synchronized observations

In `/coupling.html`, open **Estimate inertia from a separate motion record**. After fitting an admitted positive-definite inertia and nonnegative damping, choose **Freeze current training above** in **Does the same law survive another motion?** Open a separate angle/torque record, declare the shared apparatus and coordinate conventions, specify weak-window settings and two torque tolerances, then evaluate.

This tests the constant symmetric inertia plus diagonal damping relation against observed challenge angles and supplied torque. It never fits challenge data, changes the frozen coefficients or copies values into the motion simulator. It is not a future-motion prediction. The separate prospective free-response work remains independent.

## Source custody and interpretation

The training snapshot contains its original observation record and window settings. Its source label, settings, torque declaration and five coefficients stay visible. Changing or fitting another record above does not replace the snapshot. Explicitly freezing again replaces it and clears the old correspondence declaration. Opening new raw challenge observations also clears correspondence. Authored pair buttons explicitly replace both inputs and load a clearly synthetic declaration.

The same five primary training coefficients evaluate both original and every-second-row challenge samples. Coarser challenge data is never fitted. Each separate source must have a different label. Complete reused courses and repeated changing five-row angle/torque blocks are refused regardless of labels, course IDs or clock shifts. Unchanged five-row blocks alone are ignored so that independent recordings can share an initial rest. Exact independent repetitions may still be conservatively refused. This screen cannot authenticate acquisition independence: perturbed copies, common calibration errors, hidden forces and selective challenge collection remain possible.

Tolerance is applied separately to every weighted residual component, in N·m. The result reports the count outside the declared limits, pooled RMS and largest absolute residual. These are weak torque-balance diagnostics, not sample-wise torque errors, trajectory errors, confidence intervals or parameter uncertainty. Overlapping windows are correlated. Window width changes filtering and may suppress particular residual frequencies. A small residual does not establish physical inertia or complete forcing.

Use the original-source window slider to inspect the supplied motion interval, each coordinate’s weighted torque, unchanged-model balance and signed difference. The coarser readout names original row indices and times for the nearest-start coarser window; endpoints can differ. Its summary is sensitivity to the source representation, not independent evidence or an error bound. Challenge library rank describes excitation of the offered five columns; a rank-deficient challenge can still falsify a frozen model and does not fit or identify a replacement.

Units must be seconds, radians and N·m with the same ordered, signed work-conjugate coordinates across sources. Unknown sensor alignment is not repaired by this comparison. General coordinate mixing can turn diagonal damping into a full matrix outside the offered family.

## Authored analytic controls

**Load authored passing pair** retains the known inertia `[[1.4,.4],[.4,1.4]]` and damping `[.2,.2]` of the maintained reference, but changes the imposed challenge motion to `[sin(2t+.31), cos(t-.27)]`. Its complete RHS torque produces weighted challenge RMSE approximately `1.71939e-8 N·m`.

**Load authored missing-force pair** preserves the deliberately incomplete source: true inertia `[[2,.3],[.3,1.5]]`, damping `[.2,.4]` and restoring stiffness `[.5,.8]`. Supplied actuator torque omits restoring torque from the complete RHS. Training `[sin(t), cos(2t)]` gives tiny residuals with effective inertia `[[1.5,.3],[.3,1.3]]`. The changed-frequency challenge exposes this omission: pooled weighted RMSE `0.814149418 N·m`, with axis RMS `1.076954187` and `.407244679 N·m`.

The continuous residuals before window averaging are `-1.5 sin(2t+.31)` and `+.6 cos(t-.27)`. An independently implemented antiderivative review agrees with the production weak evaluation. These 801-row sources are authored analytic controls, not physical measurements or independently acquired evidence. Known truth appears only in explanatory source descriptions; the fitting routine receives observation rows.

## Save and reopen

**Save frozen comparison inputs** downloads `worldlaw.coupled-inertia-challenge/v1` with exactly `schema`, `training`, `challenge` and `settings`. Training contains `record` and `settings`; challenge is a raw `worldlaw.coupled-inertia-observations/v1` record. Challenge settings contain `windowSamples`, `stride`, `toleranceNm` and a nonempty `correspondence` declaration. No cached coefficients, verdicts or plot samples are saved. Reopening admits the source and recomputes training, then evaluates the challenge. Unsupported fields and forged result blocks refuse.

Failed reads retain previous admitted inputs and invalidate the displayed result. A later explicit action, edited challenge setting or new file cancels pending file-read application. Changing the separate investigation above leaves the frozen challenge intact. Inputs stay local to this browser; the feature does not send observations to a service.

## Experience direction and receiving

The signature action is a direct confrontation between supplied torque and the same frozen physical relation under changed motion. The primary composition aligns three instruments on one original time domain: motion, balance and residual. It lets the same amber inspection interval cross all three plots and exposes where apparent training success fails. This continues WORLDLAW’s executable scientific apparatus rather than adding detached metric cards.

The browser course also renders a materially different split composition: source motion beside torque balance, with a full-width residual below. Both consume exactly the same computed data. Actual 1440px and 390px captures were inspected after comparing both compositions. The aligned composition was selected because one horizontal position has the same time and inspection interval across all three instruments; the split version makes the two upper instruments harder to read. The final chart left margin was increased from 70 to 98 SVG units after visual inspection found crowded axis labels, then the actual browser course was rerun.

Current-source receiving was completed on main `598e8b52d3d8a9321f600faf658c3a616940d0d8` plus the exact published runtime changes, including the final axis-spacing fix. The full native suite passed 782 of 783 tests with zero failures and one inherited opt-in skip. Both launched application smoke courses passed. The actual sandboxed Chrome 156 consumer passed all 15 challenge groups and all 16 maintained identification regression groups, with no page exceptions or offsite requests. Namespace, PID, network and seccomp/TSYNC sandbox admission was observed in the same browser.

An independent antiderivative implementation checked 4,060 primary/coarser scalar residuals on irregular clocks with maximum difference `6.43006e-11 N·m`; twelve complete identification reports remained exactly equal after weak-operator extraction. Review found a nonenumerable training-setting admission gap; strict nested-object admission was repaired and exercised by the final native suite. The actual downloaded source envelope had SHA-256 `91b14f6bb104dff2730aa25d4a9760a8e7739875d6f88f64e844adf70311d32e`. Download custody is compared exactly against the authored source generated in the same Chrome runtime: Node and Chrome transcendental arithmetic can differ by one final binary64 bit.

See [verification](receipts/inertia-challenge-e794/verification.json), [actual challenge receiving](receipts/inertia-challenge-e794/browser.json), [identification regression](receipts/inertia-challenge-e794/identification-regression.json), [desktop](receipts/inertia-challenge-e794/desktop.png) and [narrow view](receipts/inertia-challenge-e794/narrow.png). These are authored software and numerical qualifications, not physical acquisition or future-trajectory validation.

Reproduce from a complete source tree:

```sh
node --test tests/*.test.mjs
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-inertia-challenge-receiving \
node scripts/coupling-inertia-challenge-browser.mjs
BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-inertia-identification-regression \
node scripts/coupling-inertia-identification-browser.mjs
```

Both browser courses launch the actual maintained server and require Chrome sandbox admission before product navigation. No sandbox-disabling flag is used. The existing identification and response flows must continue passing alongside this addition.

