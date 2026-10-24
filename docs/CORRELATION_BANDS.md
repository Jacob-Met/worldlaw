# Prospective continuous-correlation noise budgets

Open UNKNOWN LAB's authored correlation-budget reversal. Order 101 has normalized variance at most 0.254073143 over the five offered correlations −0.9, −0.5, 0, 0.5, 0.9, yet the maintained covariance calculation gives approximately 0.274839 near correlation −0.28435. A budget of 0.26 therefore does not hold over that continuous band. Order 85 remains below the budget throughout the declared band. These are authored acquisition schedules and a hypothetical covariance family, not measured sensor validation.

## Scientific contract

The original v2 comparison, noise hypotheses, periodic hypotheses, pair indices and source notes remain inputs. Add one sourced increasing correlation band inside [−0.999, 0.999], an unchanged normalized variance budget in [0, 4], 1–64 retained cells per plan, and a shared exact-arithmetic work limit of 100–40000 units.

This bounded dense analysis admits 2–16 complete plans, each with 8–16 adjacent pairs and acquisition span at most 31. Every plan must have the same paired-reading count and at least four pairs per order, as in the maintained comparison. Longer gaps or larger plans are refused as a whole; they are never downsampled, truncated, or called continuously qualified from finite hypotheses. Existing finite-comparison tools remain available separately.

For exact mathematical signed contrast weights wᵢ, normalized stationary AR(1) variance is the polynomial

`V(ρ) = Σᵢⱼ wᵢ wⱼ ρ^|xᵢ−xⱼ| = Σₖ cₖ ρᵏ`.

Weights are the exact fractions ±1/(2 × the corresponding AB or BA count). They are checked against the maintained floating-point weight function. The existing serial covariance function remains the independent executable witness check. Negative correlations retain integer-lag signs; no fractional-time interpretation is introduced.

All JSON numbers mean their **parsed IEEE-754 binary64 values**, interpreted exactly as rational numbers. Thus decimal text `0.9` means the binary64 value produced by JSON parsing, not the mathematical decimal fraction 9/10. Budgets and correlation endpoints use this same rule. The exact engine transforms the lag polynomial into Bernstein coefficients on the full declared interval. Bernstein basis functions are nonnegative and sum to one, so the greatest coefficient bounds the polynomial above. Exact de Casteljau subdivision preserves complete coverage and supplies exact midpoint witnesses. The cell with the largest upper bound is refined until the declared cell limit or exact equality of the global upper and witnessed lower bounds.

The reported statuses compare rationals only:

- `below-budget-entire-band`: the complete upper bound is strictly below the unchanged budget.
- `witness-exceeds-budget`: an exact witness is strictly above the budget.
- `exact-budget-boundary`: the maximum is exactly equal to the budget.
- `unresolved-budget`: the retained bracket does not decide those relations.

No epsilon enlarges the budget. Arithmetic capacity exhaustion refuses the complete course instead of returning a partial classification. The vendor 4096-bit rational capacity is preserved; this consumer additionally refuses intermediate results above 2048 bits and reserves a conservative complete-course work bound before coefficient construction. Display numbers are adjacent outward binary64 projections; rounded labels never determine a status. Exact fractions remain inspectable. The maintained covariance diagnostic is evaluated at a displayed binary64 witness coordinate and is distinguished from the exact rational witness used for classification.

These are exact algebraic bounds for the declared mathematical model, not certification that AR(1), marginal sensor variance, independence, calibration or any physical instrument assumption is true. Noise, periodic gain and smooth drift remain separate quantities. No observed readings select rho or alter the plans.

## Method selection and independent controls

A midpoint Taylor/second-derivative envelope was compared with rational Bernstein subdivision on the same short plans. With four cells, the Taylor upper estimate for order 85 was 1.23476, while the exact Bernstein upper bound was 0.250772655. Bernstein therefore answered the budget question earlier in this control. This is not a general performance guarantee: exact arithmetic has bit and work limits, and dense polynomial degree scales with acquisition span.

Primary sources informing the method:

- Yves Bertot, Frédérique Guilhot and Assia Mahboubi, *A formal study of Bernstein coefficients and polynomials*, Mathematical Structures in Computer Science 21 (2011), 731–761, DOI: https://doi.org/10.1017/S0960129511000090. The paper formally studies de Casteljau computation and polynomial reasoning; its proof does not certify this application implementation.
- Ralph Baker Kearfott and Dun Liu, *A Brief Review of a Method for Bounds on Polynomial Ranges over Simplexes*, author manuscript: https://interval.louisiana.edu/preprints/2018-NAFIPS-range-bounding.pdf. This describes Bernstein range bounding and subdivision.

An independent Python Fraction oracle produced exact reference bounds using binary64 endpoints, including degree 31. Its reference fractions are embedded in native tests; Python is not a runtime dependency. Other tests check original covariance values throughout the covered band, complete contiguous cells, unchanged inputs and translated indices, exact boundary and adjacent representable budgets, sparse inputs, unsupported spans and complete work refusal.

## Actual instrument and lifecycle

Two visual compositions are available. Shared budget strips make the finite-to-continuous budget reversal easy to compare across plans. Per-plan correlation instruments expose where the upper bounds remain loose, with keyboard-selectable retained cells and an exact-witness disclosure. They use a common variance scale, a fixed budget line, original finite hypotheses as points, and the retained band witness. Stepped bounds are explicitly not a response trace. Neither visual computes additional scientific samples.

The instrument runs exact arithmetic in a module worker. A 10-second wall-time limit terminates a stalled worker without partial classification. The previous complete source-bound comparison remains available through an explicit Restore action; it is never mislabeled as the failed draft. Input edits or replacement terminate the pending worker; generation checks reject late worker/file/example results. Raw download/reopen recomputes the original declarations. The new example uses an explicit maintained server route; existing drift, band and Motion-reference routes are preserved. Actual desktop/narrow and keyboard receiving qualified the composed source as recorded below. The shared-strip teal ring remains visible for subpixel brackets: its center is the outward-rounded lower projection of the exact witness, and its radius does not represent uncertainty.

## Pinned rational arithmetic provenance

The file `src/unknown-lab/chronos-exact-halfplanes.mjs` is a **verbatim** copy of maintained `Jacob-Met/chronos-vision/app/exact-halfplanes.mjs` at commit `1c17c4d0ebd808726419f63579bded8dcd6cad3c`:

- Git blob: `eb6552489373b2890b1b99fc829badf204218be7`.
- SHA-256: `3f2020d8adac92ac1b82331dd5b30964a889a85d249e81cd16bb9dbba99b1150`.
- Imported exports: rational construction, arithmetic, comparison, serialization, and outward enclosure. Geometry exports are unused.
- Existing 4096-bit refusal behavior is unchanged; this consumer adds a shared operation ledger.
- No `LICENSE` or `LICENSE.md` was present at the pinned repository revision. This is provenance for authorized reuse within the same owner's engineering estate, not an assertion of an external license grant.

Current WORLDLAW's input-enclosure, separability and shared-training modules were inspected before reuse; they supply floating-point/QR machinery rather than this exact-rational API. No competing rational engine or general optimizer was created.

### Measured resource correction

Independent review exposed a formerly admitted 16-plan × 16-pair × 64-cell request that ran for several minutes before being stopped. The unpublished contract was tightened to the limits above. That request now refuses during reservation in approximately 7 ms locally. Measured supported wide-band controls completed in approximately 2.11 s (two 16-pair plans, six cells), 1.39 s (three 12-pair plans, eight cells), 1.20 s (four 8-pair plans, sixteen cells), and 0.40 s (eleven 8-pair plans, one cell). These measurements are hardware-specific evidence, not runtime guarantees; the consumer wall-time limit supplies the separate lifetime bound. The original reference oracle is not part of runtime.

## Qualified source and receiving record

The composed base is `204acd8b356d72b2a0858422f0eb4f8bcc5e95c5`. The complete native suite passed **708 tests, zero failures and zero skips**. Independent review checked exact covariance, coverage, strict budget classification and resource refusal. The final real sandboxed Chromium consumer passed **nine groups with zero exceptions**, including served example loading, worker computation, keyboard cell inspection, both visual compositions, raw download/reopen, exact equality, worker timeout/restoration, edit cancellation, delayed-file invalidation and narrow layout.

[Native source manifest and receipt](verification/correlation-band-native.json) records the full test run before the display-only correction; numerical source remained unchanged. [Final browser receipt](verification/correlation-band-browser.json) records the corrected panel and receiver hashes, actual sandbox status, screenshot identities and review history. The screenshot paths in that receipt identify receiving-host artifacts.

Pixel review exposed a real issue despite the first passing browser course: a subpixel maximum bracket could disappear, obscuring order 101's continuous-band budget violation. A permanent witness ring corrected the rendering. The first corrective browser attempt caught an omitted SVG title attributes argument; it was corrected before publication. The final receiver asserts actual marker geometry and the order-101 finite point below budget versus exact witness above budget. Root inspected the corrected shared strips, desktop instruments and narrow view. These receipts qualify this composed candidate, not a future deployment or physical sensor model.
