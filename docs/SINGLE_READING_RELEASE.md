# Taking one angle reading in the coupling workbench

Open the velocity release comparison in Motion Lab, choose the response and motion sources, declare their correspondence and compare all permitted releases. The one-reading result gives the initial angle pair and one elapsed time at which to measure both angles. Choose **Inspect the single-reading release** to show that position's trajectories. The vertical line marks the sampled clock. The dot marks the smallest Euclidean angle separation among the retained comparisons at that clock.

The original whole-course table reports the smallest of each model pair's peak separations. Those peaks can occur at different times. For one reading, the workbench instead finds the smallest separation across all model pairs at each common nonzero sample time, then chooses the largest such separation across all times and permitted positions. Exact ties choose the earliest sample and first position in source order. The exported study retains the original inputs and settings, so reopening recomputes the recommendation. Its tie tolerance reports other equally useful positions for the declared comparison. A reading must exceed the configured minimum to be proposed.

The computation reuses the trajectories already integrated and screened in the release comparison. All training-fitted response laws and both loss-only alternatives must be available. A failed numerical screen, refused model or unsupported training cannot produce a proposal for the affected release. Separate challenge observations remain available for independent evaluation. These model separations do not establish physical reachability, sensor resolution or the cause of a measured force.

## Reproduce the authored transfer study

From the repository root, run `node experiments/single-reading-transfer.mjs` to emit all 30 frozen trials. The study uses two-axis torque training sources, signed skew and a separate fourth-order Runge–Kutta implementation for held motion observations. The response-law family, input rules, deterministic noise and finite measurement settings are specified by the experiment. Each arm receives one two-axis angle observation per binary classification.

| Measurement design | Mean predicted worst-pair separation (rad) | Correct skew | Correct diagonal loss | Correct symmetric loss |
|---|---:|---:|---:|---:|
| Proposed release and clock | 0.15150 | 60/60 | 24/30 | 22/30 |
| First permitted release at final clock | 0.11803 | 60/60 | 22/30 | 16/30 |
| Uniform permitted release and clock | 0.04327 | 49/60 | 15/30 | 15/30 |

All 30 proposals matched an exhaustive independent enumeration of the sampled separation curves within 1e-12 radians. All used the last sample at 2 seconds. The advantage over the first-release control on this cohort came from choosing a different initial release. The active design made 14 errors on the positive-skew half and zero errors on the negative-skew half. The four binary decisions per trial reuse its fitted source and deterministic noise, so they are not independent replicates. Performance on physical measurements remains unknown.
