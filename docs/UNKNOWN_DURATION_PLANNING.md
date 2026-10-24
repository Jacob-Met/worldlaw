# Choosing a duration from complete prediction sets

This follows the frozen duration-response comparison in Unknown Lab. It reuses
`fitDurationModels` and accepts training runs only. It does not inspect challenge
outcomes when selecting a new acquisition.

The user supplies a finite duration grid, future contrast-screen radius, even
balanced pair count, overhead per pair and acquisition-time budget. Each offered
duration propagates every surviving amplitude interval through its fixed offered
hypothesis. Two hypotheses are separated only when the gap between their complete
prediction intervals exceeds twice the proposed radius (plus 1e-12 N·m numerical
margin). Midpoint disagreement is insufficient. All candidates, over-budget rows
and unresolved pairs remain in the exported record.

Declared acquisition cost is `pairs * (duration + overheadPerPair)`: one
conditioned preparation plus user-declared reset/reference/read overhead per
pair. These are explicit scheduling assumptions, not measured hardware timing.
Among full-separation candidates the lowest-cost duration wins. If none fully
separates, the algorithm chooses the most separated pairs then lower cost.
If all affordable intervals overlap, no plan is exportable. A single surviving
hypothesis similarly supplies no discrimination objective.

## Actual consumer

The added section in `/unknown-lab.html` offers an ambiguous synthetic training
example at 0.1/0.2/0.3 s. Its seeds 100–102, 32 pairs and noise 0.005 N·m retain five
saturation time constants. At proposed contrast radius 0.01 N·m, 0.5 s separates 0/10
hypothesis pairs, 1 s separates 7/10, and 2 s separates 10/10. With 32 pairs, 0.1 s overhead
and 300 s total budget, 2 s costs 67.2 s and is selected. Budget 40 s instead retains the
partial 1 s choice. Zero response cannot distinguish its overlapping hypotheses.

Export produces an input-based manual acquisition plan with predictions and no
new observations. Changing training or planning inputs revokes it. Adding
challenge observations does not change the plan. The explicit virtual acquisition
button uses the original apparatus's coupling/noise controls, a distinct seed,
shuffled order and zero drift, adding an actual synthetic challenge to the
existing study. The achieved contrast bound is compared to the planned radius;
an over-radius acquisition is retained with an explicit unqualified precision
message. Measured studies require separately supplied observations.

## Evidence and limits

Six focused local Node24 tests pass with `--test-isolation=none`: complete-set
separation, budget/partial retention, zero/noise refusal, training-only acceptance,
immutable input replay, malformed constraints and touching-interval refusal.
The existing duration tests also passed with this new module before its final
numerical-margin refinement. The browser script
`scripts/unknown-duration-planner-browser.mjs` is prepared but not yet run; it
checks planning/export, separate acquisition, frozen fit, stale-plan revocation,
imprecise acquisition, responsive layout/focus and absence of external requests.

An exploratory read-only experiment with 20 future seeds 500–519 retained the true
offered tau 1.3 at every tested duration. A 0.5 s challenge left 3–4 hypotheses;
1 s and 2 s left one. This is an exploratory synthetic comparison, not calibration
or blind physical validation. The all-pair planning criterion is deliberately
conservative about which offered hypothesis is true.

The model grid, amplitude bounds and existing three-SE screen remain finite,
uncalibrated assumptions. The planner cannot rescue an omitted model, validate
physical acquisition timing or establish causality. Out-of-training-duration
requests are flagged as extrapolation. Successful virtual acquisition does not
establish transfer to a physical mechanism.
