# Explicit smooth-family revision

WORLDLAW #81 adds an explicitly declared alternative to the original global and one-hinge response family. It tests a finite family; it does not identify an arbitrary smooth law or physical mechanism.

## Model and origin

The added response is `τ = a + d·u + e·ω + b·θ + c·(θ − θ₀)³`, including only the currently declared nuisance terms (`a`, `d·u`, `e·ω`). The user declares the origin `θ₀` in radians. It stays fixed during fitting and is never searched. Changing the origin changes the offered family because there is no independent quadratic coefficient.

At fixed command and angular rate, its slope is `∂τ/∂θ = b + 3c·(θ − θ₀)²`. It varies with angle, so the cubic does not use constant left/right slopes. A genuine hinge has no derivative at its knot. Unrestricted fitted slope signs establish no passivity, restoring-force, contact, topology or safety claim.

The cubic requires four distinct training positions and full numerical rank with the declared nuisance terms. Original alternatives remain in the comparison. The ranking heuristic penalizes fitted coefficients plus a searched hinge knot; the fixed cubic origin is not a searched parameter. Scores and competitive sets are not probabilities or confidence intervals.

## Revision boundary and earlier evidence

Expansion records one `smooth_cubic` event: origin, declared reason and number of acquisitions already received. Replay fits the original family up to that boundary and expands it for subsequent requests. The panel retains original-family and expanded-family training errors at the boundary.

Earlier frozen predictions, residuals and acquisition provenance retain their original family and exact replayed values. Expansion clears any pending request; freeze a new forecast before receiving another reading. A second expansion is refused. Start a new experiment to change the declaration. Permitted input states also remain fixed after the first acquisition.

Canonical freezing reconstructs retained inputs and verifies displayed training and historical evidence. Substituting cached fit coefficients does not replace the canonical forecast. Stale or modified requests cannot admit readings.

## Training and checks

Training observations alone determine coefficients, ranking, adequacy and competitive models for planning. Separate checks are evaluated afterward. Changing check values leaves training fits, revision evidence, pending forecasts and historical errors unchanged.

The user chooses when and whether to expand the family. The software does not establish that this human decision was independent of previously viewed checks. Source labels, check roles and provenance remain supplied declarations, not authenticated instrument identity or experimental independence.

Forecast spread is a finite-model planning heuristic, not information gain or authority to actuate. Training mismatch withholds the recommendation. Explicitly freezing a declared state does not establish that an inadequate family is adequate.

## Versioned input replay

Original studies and experiments keep v1 until expansion. Expanded studies use `worldlaw.stiffness-notebook/v2` with `cubicOrigin`. Expanded experiments use `worldlaw.stiffness-experiment/v2`, retaining a v1 initial study plus the revision event. Earlier requests retain v1; requests from the expansion boundary onward use v2.

Saves retain inputs, settings, acquisitions, pending-state selection and the revision declaration. Replay recomputes results rather than trusting imported fits. Malformed or repeated events, unsupported fields, version/family mismatches and future acquisition boundaries are refused. Revised accounts are not silently downgraded.

These are reproducible input records, not authenticated recording-time logs. Editing admitted inputs and reopening produces a recomputed account; replay cannot prove what an instrument or person knew at a historical time.

## Limits and remaining mismatch

Experiments admit at most 32 acquisitions, 512 distinct permitted states, one family expansion and 101 declared knots. Existing observation and text limits apply. A fit-work budget of 2,000,000 bounds sequential replay; the bounded initial study is fitted during admission before that gate. These are work bounds, not a wall-clock deadline.

Origins and input coordinates must be finite within ±1,000,000. Numerical rank and coefficient-executability checks can refuse a candidate within these ranges. Extrapolation remains explicit.

The authored fifth-order response still produces training mismatch after expansion. Success on the supplied smooth course does not establish coverage of every smooth response. The family remains global, declared one-hinge and linear-plus-cubic about one fixed origin.

## Source qualification

Root received the candidate against maintained source: **512 native checks passed, one inherited skip**, followed by **23 actual experiment-browser groups and 16 legacy notebook-browser groups**, with zero uncaught page exceptions and zero outside requests. The optional live Node/Chromium notebook-exchange test is skipped and is not counted as passing evidence; the separate launched browser courses below did run. This composition preserves the maintained curvature-witness and scalar prediction-sensitivity contributions on `eda5d56862ad60cfe0125bc274399ea16154d3c8`.

Independent core review reran all 11 revision controls and checked four expansion boundaries, exact earlier-history preservation, held-out removal noninterference, forged-forecast refusal and finite-difference derivatives.

Actual Chrome receiving covered keyboard expansion, original/expanded evidence, saved replay, stale imports, mismatch and separate-check behavior. Desktop and 390px checks passed. The narrow layout repair changes the mobile investigation track to `minmax(0,1fr)`, letting the existing profile scroller contain wider model labels. The document-overflow assertion was preserved.

This records source and browser qualification of the candidate, not merge, deployment, physical validation or actuation authority.

Detailed retained evidence: [verification](receipts/stiffness-revision-254045/verification.json), [experiment browser](receipts/stiffness-revision-254045/experiment-browser.json) and [legacy notebook browser](receipts/stiffness-revision-254045/notebook-browser.json).
