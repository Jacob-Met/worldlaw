# An explicitly unknown restoring reference

The applied-torque apparatus can compare an unknown restoring reference without changing the original angle coordinates. This is an optional extension of the maintained three-family comparison. The original linear, sinusoidal and linear-plus-cubic families remain present and unchanged. The expanded catalog adds:

- **Linear restoring with reference:** `τ = I q″ + c q′ + k q + b`. Where finite, the derived zero is `−b/k` radians. A negative stiffness is not interpreted as stable equilibrium.
- **Sinusoidal restoring with reference:** `τ = I q″ + c q′ + s sin(q) + d cos(q)`. The restoring torque can be written `A sin(q − φ)`, with `A = hypot(s,d)` and `φ = atan2(−d,s)`, represented in `[−π,π)` modulo a full turn. The law also has an opposite zero at `φ + π`.

The inference reuses the existing weak operator, normalized QR and forward solver. It does not estimate a new sensor coordinate or shift observations. The reference is conditional on the offered restoring law and supplied torque calibration; it is not a measured equilibrium or authenticated physical alignment. At zero fitted gain no finite reference is supplied. At weak fitted gain a phase can be unstable even when numerical coefficients and predictions are finite.

## Preserve the original interpretation

The ordinary comparison remains the default, with the same three alternatives, calculations, outputs and notebook schema. Select **Also compare an unknown restoring reference (five families)** to request the expanded comparison. The authored example then uses an explicitly labelled +0.25 rad recorded datum with unchanged applied torque and initial rates.

Every old alternative remains in the expanded table and plots. A failed old family is not silently removed to make the new one win. If any candidate remains incomplete, the complete-catalog automatic proposal remains withheld even if an added candidate forecasts well. An explicit family choice is an inspectable hypothesis, not qualification of that model or recovery of a unique physical reference.

The shared rules are unchanged: weak fitting uses the declared prefix; later original training angles compare predictions beginning at the original initial state; qualification by the declared position tolerance precedes the heuristic complexity score; full-training coefficients are fitted separately. Separate challenge observations and challenge execution refusal cannot choose or revoke a training proposal. The entire five-family prediction and weak-window workload is reserved before fitting, and every failed candidate remains visible.

## Reopen original evidence

The optional mode has its own `worldlaw.applied-restoring-reference-notebook/v1` format. Saved data contains the original applied-torque source, comparison settings and optional explicit family choice. It contains no fitted reference, coefficients or forecast. Reopening recomputes everything and restores the mode. The original three-family notebook retains its original meaning; the two dedicated parsers refuse each other's schema.

Changing the mode, source or assumptions retires the current result and choice. A pending file read cannot overwrite a newer mode/source selection. The actual instrument shows original training traces, all available prefix predictions, the later validation region, conditional reference parameters and separate challenge predictions.

## Executed authored controls

Run `node scripts/applied-restoring-reference-counterexamples.mjs` for the committed reproducible controls.

Adding a constant +0.25 rad to the same original angles makes the maintained three-family catalog miss its declared tolerance. The added sinusoidal-reference family yields later-training RMSE about 0.001887 rad and separate challenge RMSE about 0.001473 rad. Its inferred inertia is about 0.699551 kg·m² and its phase is 0.249797 rad. The equally sized linear-reference model has later-training/challenge errors about 0.044817/0.141529 rad. These are authored software controls, not physical measurements.

Across recorded shifts 0, 0.25, 0.6 and 1 rad, the sinusoidal-reference coefficients transform as expected and its physical inertia and residuals remain equal to arithmetic precision. At some shifts the older catalog includes an unresolved family, so the overall result honestly remains incomplete rather than promoting the added candidate automatically. Full-turn periodicity is checked independently.

Small-amplitude courses leave both reference families competitive. A deliberately wrong constant torque zero of +0.1 N·m moves the inferred phase by roughly 0.0295 rad while separate motion error stays near 0.000120 rad. Low error therefore cannot authenticate the reference or torque zero.

A true zero-restoring course produces tiny spurious fitted gains around 0.0006 N·m from the maintained finite-window/sample calculation. Small coordinate perturbations move their fitted phases by roughly 0.35 rad. The catalog supplies no automatic proposal. These unstable conditional parameters must not be presented as recovered physical alignment. Flat records also remain rank-deficient, and numerical failures retain every unresolved family.

Eight focused native groups cover these controls, source-only replay, complete work reservation, challenge noninterference and cross-schema refusal. Independent prior-version comparison also preserves entire default outputs for three authored source families. The actual browser receiver is `scripts/applied-restoring-reference-browser.mjs`; it uses maintained Chromium sandbox admission and tests keyboard use, five-family plots, narrow layout, raw notebook reopening, and stale-input retirement.
