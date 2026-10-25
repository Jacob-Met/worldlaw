# Continuous velocity saturation investigation

The UNKNOWN LAB probe study now has a second, continuous question: can one amplitude `a` and one positive velocity scale `s` explain the original training screens through `a*tanh(rate/s)`? This is separate from the finite declared scales in probe-response/v2. It does not modify the training notebooks or choose scales from challenge outcomes.

## Use

Load a probe study in UNKNOWN LAB, declare the scale domain, boundary resolution and work budget, then choose **Profile current probe measurements**. The authored off-grid control uses scale 0.28 rad/s; the existing 0.1/0.2/0.4 alternatives all fail, while the continuous investigation retains an outer extent near 0.2727–0.2875 with supported interior intervals.

Green means every scale in that interval has one displayed common-amplitude witness satisfying every original training screen. Amber retains potentially feasible parameters that the bounded calculation has not resolved. Dark regions are excluded. The enclosing extent may contain gaps: inspect the exact boxes rather than filling them.

The source export includes only the original probe study and declared profile settings under `worldlaw.saturation-investigation/v1`. Reopen recomputes; cached reports and alleged parameter estimates are not consumed. No measurement is acquired by the profile. Authored controls retain their synthetic provenance. A worker keeps the page responsive; changing sources/settings cancels work and removes previous results.

## Conditional enclosure

The physical hypothesis is a single amplitude in [-100,100] N·m and a positive scale within the declared domain. Fixed preparation and command, order qualification, independently acquired runs and paired-history screening endpoints come from the maintained probe receiver. The exact arithmetic treats those binary64 endpoints and domain values as the supplied rational numbers; it does not calibrate their uncertainty.

For a scale box [s0,s1] and nonnegative rate magnitude r, monotonicity gives a feature enclosure [tanh(r/s1),tanh(r/s0)]. Negative rates reverse the observation screen before amplitude contraction. Each observation produces:

* an outer amplitude interval containing every amplitude that could work at some scale in the box;
* an inner amplitude interval satisfying the screen at both feature endpoints, hence at every enclosed feature.

Intersecting outer intervals can safely exclude the whole box. A nonempty inner intersection supplies one amplitude valid for every scale in the box. This does not certify the whole outer amplitude rectangle. At the requested boundary resolution, an exact midpoint scale may supply a point witness while the rest of the box stays unresolved.

The tanh feature is analytically enclosed, without trusting Math.tanh rounding: range-reduce exp(-2x) to [0,1], use alternating-series partial sums through terms 20 and 21, round outward to a 96-bit dyadic grid, and repeatedly square with directed rounding. The monotone transformation (1-exp(-2x))/(1+exp(-2x)) preserves enclosure. For x>=32, e>2 supplies exp(-2x)<=2^-64. The maintained rational arithmetic enforces its capacity limits; a capacity failure produces no report.

## Work and unresolved parameters

Domain endpoints are in [1e-6,1e6] rad/s, resolution at least 1e-6, at most 256 visited boxes and 1024 distinct feature evaluations. Nonzero rate magnitudes must be at least 1e-8 rad/s. The default budget is 128 boxes and 512 feature evaluations.

A work limit never discards the pending queue. If feature work stops inside a box, its incoming conservative bounds are retained; no partly processed contraction is advertised as complete. Box-budget exhaustion similarly retains every queued box. When all screens contain zero, amplitude zero supports the entire scale domain; work may still tighten the amplitude outer bound. Exhausting that optional contraction cannot erase the zero witness.

Fully saturated rates can leave all declared scales supported. Zero response also leaves scale unidentified. These are expected outcomes, not a request to choose the midpoint as a physical estimate.

## Separate challenges

One deterministic training witness is frozen before challenges. Its prediction is marked within-screen, contradicted or boundary-unresolved. It is neither a unique estimate nor optimized against challenges. A failed witness alone does not exclude the family.

Each qualified challenge separately receives prediction bands from **every** retained training box. Only disjointness from all complete bands excludes the retained family for that row. Overlap is labelled outer-overlap-only: correlations within boxes and between challenge rows mean it cannot establish a jointly compatible parameter. No challenge updates the training boxes. The feature-evaluation budget is shared with training; an incomplete row reports budget-unresolved with no prefix exclusion. Order-confounded or unsupported-rate rows remain explicit.

## Verification

Native controls cover the off-grid finite-library failure, sign reversal, saturated/zero underidentification, both work caps with full interval coverage, challenge mutation invariance, family exclusion from adverse measurements, source-only reopen, insufficient training and challenge budget exhaustion. Independent directed-enclosure and rational witness review complements these tests. Browser qualification is performed against the actual app with desktop/narrow layouts, cancellation, controls, export/reopen and visible keyboard focus.

This capability addresses a continuous **velocity** scale. It does not alter duration/recovery/onset models, claim a time constant, identify a unique hidden mechanism, or establish causality.

## Post-training joint family screen

The separate joint screen asks whether **one amplitude and scale** can satisfy all original training screens and every qualified challenge screen together. It runs only after the original training investigation and frozen-witness challenge comparisons have completed. Original run roles are retained in the report and source export. A joint consistency witness is not substituted for the frozen training witness.

The joint screen reuses the directed feature enclosures and bounded complete box partition. A nonempty inner interval or midpoint witness certifies existence of a common parameter pair. Only an empty complete outer family certifies exclusion in the declared domain. A work limit preserves pending boxes; absence of a witness is never treated as exclusion. Unqualified or numerically unsupported challenge rows refuse this joint inference rather than silently dropping measurements.

Training investigation and joint verification have **separate**, equally bounded work budgets, each controlled by the displayed per-stage settings. Source/settings edits cancel both stages. Reopening the same source recomputes both; derived reports remain ignored.

The authored incompatible-challenge control has three high-rate training runs that support the full scale domain. Two different low-rate challenges separately admit scales near 0.1 and 0.5 rad/s, yet no common parameter pair survives them together. Each individual outer-overlap screen correctly remains inconclusive; the joint screen rejects this saturated-rate family. That rejection does not identify which omitted effect caused the inconsistency.

## Choose a next observation

The [prospective saturation-rate consumer](SATURATION_RATE_ACQUISITION.md) compares caller-offered complete states for separating two declared scale windows, freezes an original-input request, and receives a separately supplied observation. It preserves the original training profile and the untested scale ranges.
