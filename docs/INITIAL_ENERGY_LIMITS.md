# All-time limits for the declared starting box

In Trajectory Challenge's existing **Could the starting measurement change the prediction?** instrument, **Check all-time model limits** applies the same angle/rate half-width declarations to the original supplied point state. The existing sampled-start calculation remains separate and unchanged.

This increment supports exactly the frozen angular acceleration law `q'' = rate*q' + gravity*sin(q)`, with nonpositive rate coefficient, negative gravity coefficient, correct angular units and explicitly unknown physical inertia. Additional model terms are not discarded, even when zero. Unsupported laws, a box outside the admitted principal well, or an unproved energy barrier produce no limit; this does not prove escape. A prelude-derived starting rate remains separately available to the sampled-grid instrument and is not relabeled an original supplied rate here.

## What the result establishes

For `k = -gravity > 0` and `c = -rate >= 0`, the normalized energy is

`E = v²/2 + k(1 - cos(q))`, with `E' = -c*v² <= 0`.

For the complete independent initial rectangle, let `M = max(abs(q endpoints))` and `V = max(abs(v endpoints))`. Inside the principal well, the initial energy is at most `V²/2 + k(1-cos(M))`. A certified upper bound strictly below `2k` prevents crossing either potential barrier. It also bounds speed by the outward square root of twice that energy bound. Zero initial rate uses monotonic potential to retain the initial maximum angle. Nonzero rate requires a separately certified potential barrier above the full initial energy.

These are coarse limits for every future time under the exact declared model. They are not phase predictions, numerical integration error bounds, physical validation, coefficient confidence, or a physical energy measurement in joules. The result does not acquire or fit any data. Later positions, displayed horizon and integration step do not enter its calculation.

## Source and arithmetic custody

The initial box covers exact binary64 center ± exact binary64 half-width AND the actual rounded endpoints used by the existing sampled-start calculation. Those two operations can differ; both are retained. The adapter preserves original model/run identifiers, law coefficients and initial declarations. Source, selected law, width, prelude or pending source-load changes retire derived limits. A late calculation cannot restore retired output.

The implementation reuses the maintained exact-rational arithmetic and outward projection exports. Private 80-bit dyadic intervals have a 256-bit endpoint guard. Cosine uses the fixed degree-128 Taylor polynomial plus the degree-129 absolute Lagrange remainder and a complete source-rounding Lipschitz correction. Pi is enclosed by two fixed 32-term alternating rational series in Machin's identity. Integer square-root search returns only a candidate whose exact square dominates the radicand. Up to 64 angle bisections retain an already certified upper barrier when a comparison is ambiguous.

The directed-operation reservation is 80,000, with a 100,000 hard cap. The maximum successful fixed path is 68,853 directed interval operations. Rational pi preprocessing, rational bisections and integer square search are separately bounded; the directed count is not a total CPU-work claim. Malformed endpoint arrays are rejected before decoding. Exact-rational input/temporary and endpoint bit limits prevent unbounded coefficient growth. Display endpoints are projected from raw dyadic values to five decimal places using integer floor/ceiling, including negative endpoints; they never round inward.

## Reproduce

Run the ordinary application with `npm start`, open `/trajectory.html`, admit angular source, select a supported rate-plus-gravity model, and use the existing initial-state widths. Native receiving:

```sh
node --test tests/initial-energy.test.mjs tests/initial-energy-input.test.mjs tests/initial-energy-format.test.mjs tests/initial-energy-malformed.test.mjs
```

The isolated native prototype was independently compared with the preserved Python implementation: nine statuses match, and all successful position/rate outputs and raw energy/barrier/potential evidence match exactly. Separate Python controls used a high-precision cosine oracle. Actual candidate browser receiving used an explicitly authored angular source through ordinary file import and model selection, not an injected result. Seven behavior groups covered supported/unsupported laws, nonzero rate, barrier refusal, width retirement and stale completion, with desktop/narrow captures. A separate final typography check preserves attribution to the final panel bytes. No real-sensor, deployment or universal physical safety claim follows from this receiving.

## Retain and reopen the same starting question

**Save starting question** writes only the existing `worldlaw.initial-state-receipt/v1` source fields: frozen model, complete original run and declared angle/rate half-widths. **Reopen starting question** accepts those source-only questions and the existing sampled-sensitivity receipts in the same family. Any saved `result` is ignored. Limits and exact endpoint hulls are recomputed through the maintained admission and invariant functions.

Reopening requires the same currently selected frozen law and complete original recording. Matching names alone are insufficient: the maintained canonical model/run binding checks coefficient values, original initial rate, timestamps, positions and source metadata. A mismatch does not replace the current law or run. Select the original context first. The ordinary trajectory notebook continues to refit its original training source on reopen; this local question path does not change that contract.

A prelude notebook is not an original supplied-state question and is refused. A sensitivity receipt with a changed derived starting rate cannot match the original run even when its ID is unchanged. Explicit derived-state fields/options also refuse. Source metadata is still a caller declaration: an indistinguishable forged copy cannot authenticate the physical origin of a rate. No new independence or acquisition claim is made.

Export, pure reader and browser file admission share a 3,000,000-byte UTF-8 limit. During replacement the old question is retained but its output and save action are unavailable. A refused replacement restores the last accepted question and limits; a successful replacement updates the shared width controls only after complete admission and binding. Width/source/model/prelude changes invalidate the transaction, so late file reads or hashes cannot overwrite the new context. High-energy questions can be retained and reopen as unresolved; a saved answer cannot turn one into a confinement result.

Native replay controls:

```sh
node --test tests/initial-energy-receipt.test.mjs
```

These cover source-only and legacy roundtrips, saved-answer poisoning, full-source mismatch despite identical IDs, explicit prelude ambiguity, malformed/multibyte bounded input, immutability and retained high-energy refusal. The numerical invariant is unchanged.

Source-only export uses compact JSON so valid deeply nested source metadata cannot exceed the reopen limit merely because indentation expands it. A depth-1300 admitted metadata control roundtrips successfully. Oversized export produces a visible refusal while retaining the accepted question and limits; it does not throw an uncaught UI error.

The replay increment received six native control groups and nine browser groups: eight ordinary source-to-save/reopen/mismatch/replacement/race/layout controls, plus a separately labeled isolated actual-component save-refusal control. The latter is not an ordinary source-import or physical-data claim. The original invariant implementation and its earlier proof receiving remain unchanged.

## Compare original angle readings

After establishing a complete limit, **Compare original readings** checks every original row under an explicitly supplied uniform **angle-reading half-width (rad)**. This is separate from the starting-state widths: the reading bound does not enlarge the independently supplied initial box. The same radius bounds each reading; it does not establish sensor calibration, statistical independence, a common offset or confidence.

Exact rational reading intervals are compared with the invariant's raw outward endpoints. Strict separation rejects only the conjunction of frozen law, starting box, original coordinate/course interpretation and declared reading bound. Boundary contact overlaps. Overlap remains inconclusive: it does not establish that one trajectory explains all the rows. The comparison inherits the original source's angle zero, unwrapping and forward-time interpretation without authenticating them or converting coordinates. No rates, forecasts, model ranking or observations are changed.

The complete original row ledger retains index, time, angle, exact reading interval and exact separation gap, with 100-row pages. Unsupported or unproved limits remain unavailable rather than implying escape. Changing the reading radius retires its comparison and disables saving until recomputed; the existing model limit remains. Source, law, starting-width and prelude changes retire both. Rechecking the starting question resets the optional reading comparison visibly.

Saving a comparison retains the optional source-only root declaration `readingComparison: {angleReadingHalfWidth: number}` in the existing `worldlaw.initial-state-receipt/v1` family. Only that field is admitted, with a finite numeric radius from 0 through 100 rad; initial `options` remain unchanged. Reopen checks the same complete original run and law, recomputes the invariant and comparisons, and ignores saved answers. Old questions without this field remain compatible. **Older readers explicitly refuse questions containing the new field**; they do not silently discard the reading declaration. The compact 3 MB UTF-8 export/open limit remains unchanged.

Qualification for this increment is recorded separately from the prior replay/browser evidence above. Six new native groups cover exact signed contact/separation, all 4,096 retained rows, invalid declarations, unchanged invariant/source, forged results and original-source mismatch; the six retained replay groups also pass. Separate execution against the actual older reader verifies refusal of the new declaration and byte-identical legacy export. Eight ordinary authored-source browser groups cover comparison, complete ledger pages, save/reopen, dirty-draft refused replacement and delayed-source retirement. Three final focused groups qualify source setup and desktop/narrow cell containment after a ledger-only layout repair. Independent source/native review and root visual review are attributed in [the qualification receipt](receipts/initial-energy-readings/qualification.json). These are authored software controls, not real-sensor validity.

### Explain the smallest uniform half-width for overlap

The same reading result also explains the least uniform half-width that would make every original reading interval overlap the **unchanged outer model bound**. If that bound is `[L,U]`, the exact diagnostic is `max_i(max(L-q_i, q_i-U, 0))`, over every admitted original row. It does not change the declared radius, initial-state widths, law or source. It is neither calibrated sensor uncertainty nor proof that one model trajectory can explain all readings. An outer enclosure can include positions that a particular trajectory never reaches.

The exact rational value remains accessible in its disclosure; the compact decimal display uses integer floor/ceiling to enclose it outwards. Every tied attaining row retains its original index, time and angle. A bounded witness-number control navigates directly into the existing ledger page and focuses that original row. At zero, all rows already overlap and no enlargement is needed for this necessary check; those rows are not described as conflicts. A value above 100 rad remains diagnostic and does not relax the input limit.

This is derived output, not a new saved declaration. The unchanged source-only save/reopen path recomputes it. Replacing the original source or changing widths/radius retires the associated result and witness navigation. Complete admission still limits the run to 4,096 rows. The additional pass work is bounded by three rational comparisons and one subtraction per row, two final comparisons and one directed binary64 projection; the retained witness list is at most the original row count. Decimal presentation is separately bounded to the admitted rational sizes.

Native controls for this explanation:

```sh
node --test tests/initial-energy-threshold.test.mjs tests/initial-energy-readings.test.mjs
```

## One bounded-speed course through the original readings (#592)

The existing reading comparison additionally checks a necessary common-course
condition. It starts with the complete admitted original starting-angle box,
clips every declared reading interval to the unchanged outer angle bound, and
propagates reachability using the invariant's certified outer speed. Every time
gap is obtained by exact subtraction of the original binary64 timestamps.
The original admission still requires strictly increasing recording times; the
starting box and first reading share the same original time and permit zero
travel between them.

The first strict contradiction remains permanent while the complete original
population is processed. A speed certificate retains both original identities,
clipped intervals, exact elapsed time, required and allowed travel, and a
strictly positive excess. The ordinary page links each reading witness into the
existing ledger, including witnesses on different pages. A reading already
outside the angle bound keeps its position explanation.

Survival is **inconclusive**: it admits only a bounded-speed course relaxation,
not a trajectory of the frozen differential equation. A contradiction rejects
the conjunction of the model, original starting box, original coordinate/time
interpretation and declared reading bound. It neither identifies the failed
assumption nor establishes physical-law falsification. No fitting, rate
inference, automatic radius adoption or change to starting widths occurs.

The existing source-only receipt is unchanged. Reopening recomputes both the
invariant and this check; cached answers are never an input. The course helper
is an internal admitted-data seam, not a new public rational wire format.

Complete work is reserved before processing: for N original rows, N+1 entries
include the starting box, with a conservative 34(N+1)+16 arithmetic/comparison
call reservation and a 140,000-call ceiling. N is bounded by the maintained
4,096-row admission. This accounting does not count BigInt/GCD cost, bounded
input decoding, or upstream invariant preparation as unit arithmetic calls.
Internal rational endpoint strings have explicit character and 4,096-bit
bounds, positive denominators and fixed two-endpoint shape. Failure returns no
partial course result. Zero certified speed permits exactly zero travel;
negative/asymmetric speed bounds or an initial box outside the certified domain
are refused rather than interpreted as contradictory readings.
