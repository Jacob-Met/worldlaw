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
