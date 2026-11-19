# Exact physical identifiability: compile structural no-go directions and minimum missing measurements

**Available on WORLDLAW default source path:** `npm run physical:identifiability`,
or import `designPhysicalAnchors()` from
`src/science/physical-identifiability.mjs`. Requires Node 20+;
no Python, model service, GPU, network, source-data download, or observed
measurement value. Zero arguments runs the real **five-channel sensor
observation geometry** found while falsifying the [original MAGF-ID Conf2
covariance study](../research/magfid-reference/CONF2_RESULTS.md).
The selected anchors are **unperformed and independently
authenticated measurements that would be required**. The program does not
pretend those apparatuses exist or that new measurements were collected.

The prior study physically received 85 original files (four Xsens
DOT gyroscopes + an Inertial Labs MRU-P in each of 17
source-independent car recordings) and prospectively failed:
test sensor variance prediction/observation ratios roughly 0.0005,
normalized covariance MSE improvement only +0.011676% against a
+10% required gate. Manipulating shared colored disturbance on all four
gyros changed no DOT-to-DOT difference covariance. This was an important
**physical result**, not a lack of optimization. Every attempt to learn
absolute shared noise from differences alone collides with a latent
gauge. The present compiler turns this failure into a **source-independent
algorithmic counterexample and minimum corrective measurement contract**
that anyone can apply to a different linear observation system.

## The exact linear invariant, not another synthetic data fit

At one instant let
`x=(s,u,e9,e10,e11,e15,eR)`. Here `s` is true physical
angular rate, `u` is the nuisance common to four cheap gyros,
each `ei` is a private DOT error and `eR` is the MRU error. Recorded
`y_i = s + u + e_i` for four DOTs and `m=s+eR` for the fifth.
The five source equations have **rank 5 in 7 unknowns**. Two
independent latent directions produce **exactly the same readings**.
No number of repeated measurements of these *same linear forms*
resolves either of those instantaneous non-identifiabilities.

For a requested target `c x`, the **necessary and sufficient**
structural identification condition in the offered linear model is
`c ∈ rowspace(A)`, equivalently no `v ∈ nullspace(A)` has
`c v ≠ 0`. The compiler returns an **exact rational direction `v`**
for each unresolved target and verifies that every original row has
`A v = 0`, whereas the target changes by a nonzero rational.
Unlike ordinary floating-point rank checks, this is an independently
replayable algebraic counterexample.

The original MRU gyro is **not a perfect rate oracle**: it introduces
its own unknown error. Even hypothetically authenticating *known zero
physical angular rate* resolves `s` but does not individually separate
`u` from private `e_i` for an instantaneous reading. Conversely,
independently authenticating MRU error does not resolve `u`.
The cold physical example proposes *new independent observations*
`s=0` and `e9=0`, of declared relative costs 1 and 2, respectively.
These two, if independently and genuinely measured, would make both
`s` and `u` structurally resolvable in the hypothetical linear
system. The compiler proves no offered one-anchor alternative
achieves both and that the cost 3 pair is the cheapest
two-anchor subset of the declared menu. **This is not evidence
that independent e9 calibration is physically realizable.**
The “cost” labels are hypothetical integer weights to illustrate
secondary optimization, not dollars or minutes.

## User-facing contract

Use a JSON file for any measured-device topology:

```sh
npm run physical:identifiability
node scripts/physical-identifiability.mjs \
  --input examples/physical-gyro-identifiability.json \
  --output /workspace/OWNED/sensor-identifiability.json

node scripts/physical-identifiability.mjs \
  --input examples/physical-gyro-identifiability.json \
  --replay /workspace/OWNED/sensor-identifiability.json
```

The default example declares ordered `variables`, `observations`
with exact coefficient arrays, optional physical `anchors` with positive
integer `cost`, and `targets` with exact coefficient arrays. The
design works **without any measured response values**—neither fitted
error, posterior likelihood nor observed covariance. Integer JSON
coefficients are accepted only if within JavaScript's safe integer
range; finite decimals or rationals must be strings such as
`"0.125"` or `"1/8"`. The scalar rational denominator must be
positive, both reduced numerator magnitude and denominator ≤ 10¹².

The result always includes initial exact source rank, all-target
identifiability and a counterexample for every unresolved target;
the potential *all-anchors* rank; the bounded selected subset
(if any), exact min-cardinality and cheapest offered cost only when
the complete smaller-cardinality/cost search finished; node count and
explicit budget status. Cases are distinct:

| Result | Verified meaning |
|---|---|
| `already_identifiable` | All requested targets are in original exact row span; zero anchors needed |
| `fundamentally_unidentifiable_with_offered_anchors` | Even the union of **all** offered anchors leaves a gauge; no finite schedule using those measurement types suffices |
| `optimal_structural_design` | Every smaller-cardinality subset and every same-cardinality cheaper candidate was ruled out by complete exact search; output proposed independent anchor measurements |
| `valid_design_uncertified` | A valid identifying subset exists, but search work budget exhausted before proving minimum/cost |
| `insufficient_anchor_budget` | All subsets up to the **specified cardinality** fail, although the union might be enough with a larger budget |
| `search_inconclusive` | Exhausted the search before finding a witness; must not claim impossibility |

The exact search supports 2–16 latent variables, 1–128 observed
linear channels, up to 32 proposed anchors, up to 16 target
functionals, and up to 12 anchors per design. It always searches
**complete, finite input sets** rather than greedily dropping
channels. The default 50,000 visited-node budget bounds exponential
cost; exhausting it is an explicit noncertifying outcome, **not a
weakened success test**. The zero-setup no-go requires only five
source observations; a full computed certificate replay does not
download source data.

Scientific interpretation is intentionally narrow:
linear **instantaneous structural** identifiability of a declared
observation matrix. It does not estimate noise covariance, validate
the assumed linear model, authenticate independent reference devices,
prove the physical possibility or safety of an anchor, identify a
dynamic law, infer nonlinear/PDE mechanisms, or provide a causal
intervention effect. A proposed `s=0` row is an independent
apparatus contract, not evidence that an observed platform was truly
still. For empirical qualification, independently calibrated
reference/clock/pose and **new unobserved original trajectories**
are required. Reusing the consumed car Conf2 test, changing unit
scales or calling a simulated intervention “measured” is invalid.

## Algorithmic proof and falsification

1. Parse source coefficients as reduced rationals; multiply each
   row by its exact least-common denominator; divide by its
   primitive integer content. Gaussian rank updates are performed
   by **BigInt** integer cross-elimination with normalization
   after each pivot, never a floating-point tolerance.
2. Independently evaluate row-space membership for every
   requested target using integer elimination. For each unresolved
   direction, backsolve the triangular integer echelon equations
   with reduced rational arithmetic, and replay exact `Av=0`,
   `cv ≠ 0` tests before returning it.
3. Evaluate the union of all anchors before combinatorial search.
   If the union is deficient, the result is a **global no-go for
   the offered set** even when the subset budget is small.
4. Enumerate subsets in increasing cardinality; prune only when
   even the union of all *remaining* anchors cannot satisfy
   the target queries. Choose minimum total **declared integer
   cost** and deterministic source-order tie break. If the bounded
   search ends before completing a level, retain a discovered
   witness but **never assert cardinality or cost optimality**.
5. Replay takes the complete original JSON source SHA and recomputes
   every certificate result, not just a stored green boolean.

The CI controls include original five-gyro rank-five/7-unknown
nullspace, missing-MRU and missing-stillness anchors, duplicate
sensor observations (no gain), full exact two-anchor optimum,
one-anchor budget insufficiency, exact decimal/fraction cases,
1e12-scale nearly-collinear numerical false-rank case, changed
latent model and held-out numeric-label leakage, zero-data
malformed inputs, and a bounded 26-action course that must refuse
to certify a partially explored optimum. CI also cold runs
`npm run physical:identifiability` on a fresh checkout, verifies
the output and exact replay, and runs the whole maintained WORLDLAW
test, trajectory and smoke suites. This is an **algebraic source
mechanism** with source-only falsifiers; unlike the older car study
it does not assert a new physically measured positive result.

**Next load-bearing step:** combine this compiler with an independently
actuated/reference-calibrated device and a fresh prospective real-data
split—such as the original MAGF-ID `Table_Exp/Conf_MC1` MEMSense+DOT
turntable cohort after verifying apparatus commands and instrument
clock/orientation and before any target numerical rows are consumed.
The source ZIP central directory shows 26 complete distinct filenames,
nine DOTs and one MEMSense channel each, but undocumented labels
like “Constant 10 10 1” are **not** assumed to be ground-truth
angular rates. Identifiability of an *instantaneous* model is not
a guarantee of actual dynamic experimental identifiability.
