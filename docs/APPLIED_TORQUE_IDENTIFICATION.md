# Scalar inertia from calibrated applied torque

The **Identify inertia from applied torque** instrument lives inside the existing Trajectory Challenge. It accepts a separately declared physical channel, `appliedTorque`, rather than reinterpreting ordinary actuator commands. The investigator declares the balance `appliedTorque = I × angularAcceleration + c × angularRate + k × position`.

This bounded model identifies constant scalar inertia, nonnegative linear damping and linear stiffness. Stiffness may be negative; a numerical candidate is not a passivity or stability certificate. Arbitrary mechanism topology and coupled inertia matrices are outside this instrument.

## Original inputs and custody

Use `worldlaw.applied-torque-study/v1`, explicit `s`, `rad`, `N·m` and `rad/s` units, a calibration-basis declaration and separately labelled training/challenge recordings. Each run retains `inertia: null`, supplied initial rate, kind, source metadata and original samples containing only time, position and applied torque. Conflicting per-run units, arbitrary command channels and supplied inertias refuse. Calibration and acquisition independence are declarations, not authenticated measurements.

The maintained trajectory validator checks sample limits, timestamps, source metadata and copied evidence. Its internal unit-inertia surrogate exists only for admission; it is never fitted, forecast or exported as physical evidence. Retained source contains unknown inertia and the original applied-torque channel. Fitting receives training runs only. Challenge angles and initial rates cannot change fitted coefficients.

## Identification and execution

The maintained compact weak operator integrates against `phi(x)=x²(1−x)²`, whose value and first derivative vanish at both endpoints. The position-target column represents integrated acceleration without estimating pointwise acceleration or using supplied starting rates. Linear damping uses the shared integrated first-rate feature. Applied torque is left-held over each original interval, matching the maintained forward solver.

Shared column-normalized QR fits `[I,c,k]` against the applied-torque weak feature. All three columns must be numerically independent. Rank deficiency supplies no candidate or forecast. Nonpositive or numerically out-of-domain inertia, negative damping and nonfinite/oversized coefficients remain rejected. Executable inertia must exceed `1e-12 kg·m²`; coefficient magnitudes are bounded by `1e12`.

Window residuals have torque-integral units `N·m·s²` after division by the dimensionless position-operator gain. They are not pointwise torque errors, independent forward errors or calibrated uncertainty. Shared samples, noisy regressors/torque, calibration and discretization can bias the fit. The conditioning estimate is a QR diagonal ratio, not an exact condition number.

Each separate challenge runs the unchanged maintained solver with inferred inertia, unit applied-torque gain, torque terms `−c × rate` and `−k × position`, and its supplied initial state. Observations never reset predictions. Coarse/refined numerical results and complete forecast failures remain visible. A work-budget refusal does not erase the training candidate.

## Consumer and replay

The instrument overlays original observations and predictions and exposes conditional coefficients and the calibration basis. Window duration, stride and forward step are editable. Edits retire old conclusions. A pending replacement file clears previous source authority and disables recomputation until admission; a newer explicit edit or example cancels that pending import.

Save writes `worldlaw.applied-torque-notebook/v1` with normalized original inputs and settings only. Reopening recomputes identification and every forecast. Nondefault forward steps survive import, recomputation and export. Portable input/output is bounded to three million UTF-8 bytes.

## Authored controls and limits

For `theta=sin(t)+0.2cos(2t)` with independently generated applied torque at `I=3`, `c=0.6`, `k=2`, 0.002-second sampling identifies approximately `[2.999258,0.601841,1.999197]`. A separate different-frequency challenge gives position RMSE about `0.000662 rad`. Finer sampling improves the result; held-command discretization remains visible. A single-frequency control has rank two and refuses separate inertia/stiffness identification.

Native controls additionally cover irregular clocks, held-out and initial-rate mutation, source-only replay, command/unit/copied-source refusal, negative inertia, forward-budget refusal and UTF-8 size limits. These are authored software controls, not physical acquisitions or proof that measured mechanisms obey the offered law. Actual browser and integration receipts are recorded separately after execution.
