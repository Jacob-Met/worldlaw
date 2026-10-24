# One shared training-reading perturbation

The Studio has an explicit **Search shared-training evidence** action below the retained marginal and pairwise sensitivity comparisons. Running either existing comparison does not run this search. The new action asks whether a single bounded change to the retained training torque readings can receive the complete held-out course under the inspected fixed model structure and exact declared coordinates.

The two torque-reading radii above the action apply to this inspection. Training offsets satisfy |delta_i| <= trainingRadius. Every receiving box has its original receivingRadius. Model selection, source import/reopen, appended measurements and radius changes invalidate the displayed result. Search-budget edits also clear it. Marginal and pair results are retained when the separate search runs.

## What a result establishes

`verified-interior-witness` retains one offset for every training row. The public checker rebuilds the influence calculation from raw source, verifies the inclusive offset bounds, adds those offsets to the original training readings, and independently repeats the maintained same-structure least-squares fit. Every receiving row must have strictly positive screened interior margin both under influence reconstruction and under the repeated refit. The two predictions must agree within the numerical screen. Training offsets may touch their allowed bounds; the strict interior requirement applies to the original receiving boxes. The consumer exposes every offset and every receiving margin.

`verified-separation` retains one weight for every receiving row. Write H for the computed training-to-receiving influence matrix, c for the conditional refit predictions, y for observed receiving torque and v for the retained weights. The checker recomputes

    discrepancy = v^T (y-c)
    support = trainingRadius * ||H^T v||_1 + receivingRadius * ||v||_1

from every row. It combines the shared training influence before taking absolute values. A positive discrepancy-minus-support gap beyond the engineering numerical screen supplies separating evidence for this computed linear envelope. A weight can be zero without dropping that row from the declared course. Unlike pairwise comparisons, arbitrary weights can expose a contradiction involving three or more rows.

`unresolved` covers exhausted budgets, unavailable source rank/work bounds, arithmetic range refusals, stalled candidate search, candidate/refit disagreement and contacts too close to the numerical boundary. Failure to find a certificate is not evidence of compatibility. Zero-radius equality/contact is never accepted as a strictly interior witness.

These statuses concern a floating-point calculation. They do not certify QR error, exact linear-program feasibility, law adequacy, acquisition independence, calibrated confidence, or physical feasibility. The public checker uses separately recomputed values; it is not a formally verified or interval-arithmetic proof system.

## Search and verification are separate

The candidate generator starts at zero training offsets. It minimizes squared receiving-box distance using projected gradient steps bounded by the Frobenius-norm Lipschitz estimate. It aims at an inset receiving box with half the declared receiving radius to help discover an interior candidate. The inset is a search heuristic only. Both positive and separating certificates are checked against the ORIGINAL declared radii.

A residual direction supplies candidate receiving weights. Those weights are normalized to maximum absolute component one. Any direction is acceptable only if the independently evaluated support inequality passes. Search convergence or residual size alone never establishes the result.

Default budgets are 512 iterations and 16,777,216 candidate-search matrix terms. Public maxima are 4,096 iterations and 67,108,864 terms. Zero budgets deliberately return unresolved. Each iteration reserves three complete training-by-receiving matrix passes before proceeding; no subset replaces an over-budget course. Source preparation, certificate rechecks, QR refits and rendering are additional work outside that counter. The underlying contracts still admit up to 256 training and 128 receiving rows. These bounds are not wall-clock responsiveness guarantees.

The positive checker reconstructs all receiving predictions and repeats a QR fit; the separation checker reconstructs the entire weighted support. The public checker always rebuilds its context from raw model, ordered training/receiving rows and radius settings. The searcher's prepared-context helper must never be used to admit imported prepared objects.

## Portable replay

**Export checked shared-training evidence** is enabled only after an accepted public check. The JSON contains the normalized raw model and ordered numeric rows, the original radius settings and the candidate vector. It does not trust a saved verdict. `replaySharedTrainingCertificate(text)` reruns the public checker; changed source/radii/structure/order or a candidate that no longer passes refuses.

The Studio replay additionally requires the certificate source to match the currently inspected notebook/model/radii. Reopen the matching source notebook and redeclare its radii before replay. Importing a certificate never silently replaces the notebook. Pending file reads are invalidated by input changes, a new search or source remount.

The source key is an exact serialization binding, not cryptographic authenticity or a provenance attestation. The raw numeric rows are sufficient to recompute this calculation; original recording files, acquisition metadata and verified independent acquisition are not established by this export. Retain the source notebook separately.

## Independent controls

The affine three-row oracle uses training coordinates -1 and +1 with zero torque and receiving coordinates -1, 0 and +1 with readings -0.5, +0.5 and -0.5. Every marginal and pair interval overlaps at training radius one and zero receiving radius, yet weights (-0.5, 1, -0.5) cancel all affine predictions and have discrepancy one with zero training support. This is the new capability beyond pair tests.

Positive controls provide an explicit shared affine offset vector and independently check all refitted predictions. Corner enumeration compares support against all 256 extreme offsets for eight training rows using maintained QR. Other controls cover the original-radius/inset distinction, inclusive training bounds with strict receiving interior, strict receiving-boundary refusal, bounded unresolved work, reordered source, complete 256-by-128 denominators, candidate/source tampering and portable public replay.

The browser course exercises the actual imported consumer, native/DOM numerical agreement, preserved marginal/pair results, invalidation, source-notebook reopen and narrow keyboard scrolling. A 256-training/128-receiving course runs actual nonzero default budgets, records the resulting checked or unresolved outcome and compares it with native computation. Its measured elapsed time is a single runtime observation, not a convergence or cross-device responsiveness guarantee. Test source alone is not a claim that a runtime gate passed; actual receipts record executions separately.
