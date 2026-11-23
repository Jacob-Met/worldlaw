# Prospective planner for persistent position and drift

## Frozen correctness controls

The input is a finite table of rational command rates for each candidate law and a closed nonnegative per-reading noise bound. Commands draw from one declared finite menu, with repetition allowed. One unknown position and one unknown constant drift persist across the three pulses and all four readings.

* Recover the registered four-law adaptive-only case. A raw polynomial simulator must identify each planted law under extreme noise and on rational initial states.
* For any refused first/second command pair, supply a single common prefix and, for every possible third command, a full shared transcript together with two distinct laws and compatible initial-state pairs. Check these certificates by raw forward simulation.
* Compare each pair's projected observation overlap to an independent finite-dimensional polygon intersection computed from the projected noise corners and edge intersections. Include exact point intersections, disjoint sets, and zero noise.
* Cover every feasible decision boundary, including singletons, without rounding. Report out-of-family measurements explicitly. Challenge saved policy, action, measurement and state-region fields by mutation and require exact replay.
* Check positive, indistinguishable and adaptive-only catalogs. Reorder rows and relabel actions in an independent deterministic catalog sweep; unidentifiability cannot depend on enumeration order.
* Preserve the previously shipped four-law receiver's records and all existing product tests. This milestone is a source API with an executable proof. No UI change is required.
