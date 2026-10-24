# Additive compatibility from sparse source readings

The Studio's existing additive-source inspector now checks a complete observed
slice even when it contains no full four-corner rectangle. The original
rectangle views and their limits remain available. The new graph result is a
separate statement about **joint compatibility on the finite observed slice**.
It does not establish a physical law, identify a hidden cause, predict unobserved
states, fit a particular feature library or give calibrated confidence.

## The source gap and actual course

Import `examples/sparse-additive-source.json`. These are original authored
mathematical readings of `tau = command * position`, not physical measurements.
Six states form an alternating loop:

`(0,0), (0,1), (1,1), (1,2), (2,2), (2,0)`.

Two further readings form a disconnected tree, bringing the source to eight
observations for the maintained Studio importer. There is no complete 2×2
rectangle. Yet an alternating sum of six original torques is −3 N·m, whereas
all separate command and position effects must cancel to zero.

Open **Challenge the additive law library**, choose command/angle with rate
exactly zero, explicitly assume exact coordinates and declare the absolute
reading-error bound. With zero radius, the rectangle view honestly reports no
complete rectangles while the joint source view supplies the six-reading
contradiction. Every signed table entry identifies an original source row. The
figure is a coordinate-constraint graph, not simulated physical motion or an
interpolated measurement.

At radius 0.5 N·m, an additive assignment touches all necessary bounds and is
compatible on the observed slice. The UI exposes its coordinate contributions
and every original reading. At radius 0.49, the strict contradiction returns.
Changing the declaration removes the old conclusion until explicitly rerun.
Save/reopen uses the existing source notebook; assumptions must be redeclared,
and no computed graph or substituted observation is persisted as evidence.

Two genuine views inspect the same certificate: the signed cycle exposes
cancellation step by step; the coordinate-group view displays the two input
families and the connecting source readings. The cycle is the default because
it avoids crossing edges for the six-reading example. The source table and
exact-bound disclosure are authoritative in both views. Long witnesses retain
the complete signed table without attempting an unreadably dense diagram.

## Shared source preparation

`src/science/additive-source.mjs` extracts the maintained admission and exact-state
grouping from `separability.mjs`. It preserves coordinate validation, declared
fixed value, absolute torque radius, original row indices, repeated-state
intersection and the existing outward binary64 intervals. The rectangle
algorithm, result schema, work counter and limits are unchanged.

The graph consumes this same preparation directly. It therefore does not first
need to enumerate rectangles. A dense 13×7 additive source can exceed the
preserved rectangle output limit while the independently bounded graph still
receives it. The UI reports either computation's refusal separately; it does
not suppress the other valid result or turn a refusal into compatibility.

## Exact constraint mechanism

For each exact state, intersect the original torque bounds using exact dyadic
arithmetic on the admitted binary64 readings and radius. The decomposition is
adapted from the maintained Cycle Work angle-box implementation. No display
rounding or numerical tolerance decides the result.

An additive response `a(x) + b(y)` can be written as the difference of coordinate
potentials `A(x) − B(y)`, where `A=a` and `B=−b`. Each observed upper/lower torque
bound yields one directed difference constraint. Repeated readings retain the
original rows supplying each strongest endpoint; their source identity is not
replaced with an average.

Bellman–Ford with a virtual zero-cost root has two complete outcomes:

- **Compatible on the observed slice:** exact node potentials satisfy every
  original reading bound. The returned contributions form a constructive
  certificate. Gauge freedom, unobserved states and unsupported functions remain
  unknown; compatibility does not mean the current finite-feature fit succeeds.
- **Additivity excluded:** a directed negative cycle supplies original row
  indices and signs. Coordinate contributions cancel exactly, but the sum of the
  source upper constraints is strictly negative. This is an auditable
  infeasibility certificate under the declared assumptions.

**Incompatible repeats** are returned separately when two original readings at
one exact state have disjoint intervals. They challenge deterministic-state or
bound assumptions and are not labeled an interaction. **No source states** is
also distinct. Existing rectangle arithmetic is outward-rounded and may be less
conclusive near numerical boundaries than this exact graph calculation.

The maintained source admission allows at most 4,096 rows. Exact graph search
requires `nodeCount × directedEdgeCount ≤ 2,000,000`; callers may lower the limit
but cannot raise it. Refusal returns no partial compatible assignment. All
returned exact numbers are serializable integer/power-of-two pairs. A final
certificate check guards constructive results and strict negative-cycle bounds.

## Qualification

The isolated mechanism first produced 523 certificates checked by a separate
Python `Fraction` verifier: 280 constructive assignments and 243 exact negative
cycles. A retained independent reviewer then tested 320 fresh courses, including
185 exclusions, 53 repeat conflicts and 82 constructive assignments. These
include ordered axis choices, tiny/subnormal values, off-slice readings,
source-row custody and near-limit graph work controls.

After integration, the reviewer accepted the frozen shared preparation,
rectangle module and graph module. Its same 320 independent exact certificates
pass the integrated API, and all 320 complete rectangle results match the prior
maintained implementation. Six new native graph groups and eight preserved
rectangle groups pass, including all six ordered axis pairs, equality,
disconnected trees, subnormal strict signs, source immutability, no-data and
independent graph/rectangle refusal.

Native reproduction:

```sh
node tests/additive-graph.test.mjs
node tests/separability.test.mjs
BASELINE_SEPARABILITY_MODULE=/absolute/path/to/prior/src/science/separability.mjs \
python independent-review/additive-graph-review.py
```

The independent prior module is the unchanged rectangle implementation from
merged #118 (`1c9d34b1d44e8707a08e60e59c7da97ac1c0e9d3`). Browser and portable
receiving results are recorded alongside the final feature receipt. The exact
source evidence and qualifications remain separate from the larger still-open
physical-law discovery goal.

## Actual browser receiving

Seven sandboxed Chrome groups pass for the distributed authored input: sparse
contradiction with zero rectangles; signed original rows and exact dyadic bound;
both cycle and coordinate-group views at 1440 and 390 pixels; changed-bound
invalidation and constructive equality; strict exclusion below the boundary;
actual downloaded source notebook reopen with new declarations; and distinct
repeat conflict without page exceptions. The first rendered pass revealed
cramped mobile table headers and small node labels. The second pass enlarges
labels, preserves words in headings and provides both real source views. All
five final captures were inspected. The signed cycle remains the default
because its ordered witness avoids crossings, while the coordinate grouping
makes the two source-input families directly comparable.

Normal browser receiving uses installed Playwright and Chromium through
`PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH`, and `BROWSER_ARTIFACT_DIR`.
The receiving environment ran out of disk space before its first browser
launch, so subsequent execution used an explicitly approved task memory
directory for temporary browser files and output. Chromium retained namespace,
PID, network and seccomp sandboxing. No disabled-sandbox switch or source
substitution was used. This execution environment limitation is separate from
product correctness.

## Portable receiving

The actual source ZIP contains 536 files and 21,629,683 bytes, SHA-256
`060db16134c475f51cbe40ac5bcb475c1f1f78802461488221a9a14486d96a69`.
All member hashes were verified before exercising the extracted application.
Its graph/rectangle native groups pass (14), independent exact certificates and
complete rectangle parity pass (320 each), and sequential sandboxed browser
receiving passes 7 graph, 6 preserved rectangle and 8 interaction groups. The
five graph captures are byte-identical to the inspected source captures. The
source also passes the four preserved interaction native groups and both
maintained launched-product smokes. Five unrelated packager refusal controls
remain intact. No broad-suite result is inferred from these targeted checks.

The source reference is merged #118, with every available inherited blob
verified against its Git identity. The explicitly labeled working-tree ZIP
does not claim an exact remote source tree: the previously unavailable
`docs/receipts/branch-response-20261024/desktop.png` is absent locally and its
remote blob must remain untouched. No placeholder replaces it; all runtime
inputs and this increment's captures are present. Final receiving prose and
receipt are added after archive construction without changing runtime bytes.
