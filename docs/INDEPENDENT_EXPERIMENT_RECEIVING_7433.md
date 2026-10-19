# Independent experiment-planning receiving

Received 2026-10-19 by the independent receiving worker of team `74334802bd53`. This extends the earlier cross-route receipt without replacing its frozen source or evidence bundle. The work below distinguishes maintained component regressions, an actual owner controller and virtual instrument, and any separately received browser consumer.

## Actual owner controller and virtual instrument

The real owner V3 consumer snapshot was received at commit `f38a6f970e630a1013b3602bf0e7130b2acb15a2` in the isolated numerical-receiving worktree. Its application imported the numerical-screen wrapper around the original opaque owner controller. Source digests and the source commit were unchanged across the independent run.

The independent receiver exercised the actual `experiment-session.mjs`, actual finite-grid planner and actual virtual pendulum instrument. It did not substitute the opaque-session test double used in the maintained unit contracts.

| Check | Received outcome |
| --- | --- |
| Default proposal and acquisition | Numerical screen passed; a complete independent synthetic run was acquired with seed `94433` and 201 samples. |
| Acquisition before explicit apply | Current trained challenge and its recorded future remained unchanged. |
| Unavailable numerical screen | A complete-screen budget of one step refused a new acquisition and preserved the owner's original plan. |
| Already acquired evidence | Pending source evidence reopened byte-for-byte under the unavailable screen. A forged serialized qualification was ignored. |
| Explicit apply and historical replay | The acquired run entered training only on apply; history, derived discovery and challenge results reproduced on reopen. The reserved challenge bytes stayed unchanged. |

The model changed from `rate+spring` to `rate+gravity`. On the same retained synthetic challenge, selected position RMSE changed from `0.5643958050122141` to `0.00044101636410201695 rad`. The passing pairwise two-step sensitivity was `0.000026571572270991937 rad`. This is controlled synthetic evidence, with a known reused challenge; it is not new blinded validation or physical-hardware qualification.

The machine receipt is `independent-controller/receipt.json`. The core received source SHA-256 values are:

| Source | SHA-256 |
| --- | --- |
| `src/trajectory/experiment-session.mjs` | `b12a1f029ecc0e2deaaabba88a7bbcbd8a5d484547330d2d927613b51f018d2a` |
| `src/trajectory/planner.mjs` | `63d5161e39fa592d90f4b06efe8569879cf5b2b66db309d0e9acc65ec0300f10` |
| `src/trajectory/virtual-experiment.mjs` | `78147d6640414e2e824b5ed0794f28d1ba52b96fea6d3c50b82ec86cb8b2b053` |
| `src/experiment-design/qualify-trajectory-plan.mjs` | `66142781fee541a5a55fdff9bf15bda140bce27c5949e2f36e7f31a35c812614` |
| `src/experiment-design/screened-controller.mjs` | `1ea7e35a5ec53536efc3bfc460637306ae04217ffeea183e74d160b1d67882f7` |

## Maintained independent component regressions

`tests/screened-controller-independent-7433.test.mjs`, committed as `503d63c`, passed five direct native test cases. These deliberately use an opaque owner test double with the real planner and qualifier to reach refusal states that the normal fixture cannot produce. They test unresolved acquisition gating, detached view mutation, caller-settings mutation, stale-session rejection, pending evidence, export/reopen and original no-proposal semantics. The actual owner receipt above closes the separate composition boundary.

`tests/angular-planning-independent-7433.test.mjs`, committed as `3ed0a33`, passed six direct native test cases against the angular and duration adapters after scientist commit `3087ee57cf9e095c20afd5cdd90b7e9fefa4b3e5`. The independently injected planner is the explicitly labeled frozen owner snapshot in test support. These tests establish:

- The measured PASCO weak fit at the fixed `0.01 rad` noise setting remains uninformative for the declared 2, 4 and 8 second recording durations. Its training mismatch remains `7.552353266677547` noise units, and no recording request is returned.
- Throwing getters on challenge outcomes, source metadata and already-fitted raw training samples remain unread during every duration comparison. Clean and guarded results match.
- The fitted synthetic angular observations with withheld physical torque scale choose 4 seconds from the declared 2/4/8 second set. The scope remains 22 competitive models, eight considered and 14 omitted. The output contains a manual recording request with no observed samples, physical command or identified inertia.
- A failed considered model invalidates the design; no surviving subset produces a disagreement score.
- Changing coefficients under the same model IDs across durations refuses the comparison as an inconsistent ensemble.
- Complete reservation failure invokes no duration backend, and a later per-duration resource refusal returns no partial recommendation.

The observed PASCO four-second disagreement remains `0.0016441598885423836 rad`, below the `0.01 rad` proposal threshold, with a passing selected numerical screen. A numerical screen does not remove its training mismatch or validate the model physically.

## Independently reproduced reporting defect and fix

The receiver preserved a negative numerical counterexample instead of treating below-threshold spread as validated absence of useful separation. Two angular damping models with rate coefficients `-100` and `-101`, initial angle zero, initial rate `1 rad/s`, duration/sample interval/max step `0.1 s`, and proposal threshold `0.1 rad` produced coarse disagreement `0.09775416666666681 rad`. The selected numerical sensitivity was `2.0036934964639608 rad`, so the selected screen was unresolved.

Before scientist fix `3087ee5`, the angular/duration summary nevertheless reported `uninformative`; the duration reduction discarded the selected numerical refusal. No acquisition or recording-request leak occurred, but the summary could conceal unresolved numerical uncertainty. The independent regression failed on the prior checkpoint and passed after the fix. Angular status now retains `numerically_unresolved` even when the original coarse planner status is uninformative; duration rows retain selected screen status, reason and sensitivity. No request is issued.

The fixed received module SHA-256 values are:

| Source | SHA-256 |
| --- | --- |
| `src/experiment-design/angular-planner.mjs` | `c81a3895b0e7131e02e7b3186d16865c3979b48a6f147c32047957ea82434082` |
| `src/experiment-design/angular-duration-planner.mjs` | `c7ec360a8f53824644925c985509909bbd42cd8cf29154fc37d3b0e4ce0f4dea` |

## Scope and remaining receiving boundary

These records establish the named local component and actual-controller outcomes. The manual angular recording panel requires its own frozen actual-browser receipt before a UI claim is made. Source publication, integration into remote main and the final extracted-source delivery receipt are tracked by the coordinating integration worker.

Duration selection maximizes sampled model disagreement among the original screened winner at each declared duration. It does not estimate information per second, sensor detection power, recording cost or an optimum over continuous release conditions. Models can share numerical bias or omit the true dynamics. Unknown inertia, omitted competitive models, extrapolation and the declared unforced-rotation assumption remain explicit. An exported protocol requests a future recording; it is neither acquired evidence nor physical control.
