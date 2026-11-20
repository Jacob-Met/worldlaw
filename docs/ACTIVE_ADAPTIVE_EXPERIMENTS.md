# Successive experiments under fresh unknown starting states

The Hidden-state lab can freeze a complete adaptive experiment policy for two
to five supplied linear laws. Each round chooses one of the source's complete
input/readout bundles. Separate readings determine which already frozen branch
to follow. The law is persistent; the unknown initial state and bounded errors
may change independently between experiments.

Open `/active.html`, expand **Inspect the source and design another experiment**,
and choose **Successive experiments with fresh unknown starts**. The coupled
track example has four candidate couplings and three fixed input courses.
The best fixed set needs nine readings. The exact adaptive policy guarantees
identification within six readings, conditional on the offered family and error
bound. A separate authored synthetic apparatus completes two three-reading
rounds with fresh unobserved position and velocity. It does not read a candidate
simulator or choose its persistent law from the inferred survivor set.

This is an integrated finite-family experiment capability. It does not infer
the original candidate structures, validate a physical reset, authenticate an
instrument, or establish a real-world law. Those broader discovery capabilities
remain open.

## One experiment at a time in the same apparatus

The main object remains the executable mechanism: visible candidate position
tracks, the exact input course, and the initial-state-cancelling projection.
The policy strip shows the pending experiment and its possible maximal
compatible sets. These sets are branches, not measured outcomes or probabilities.

Two interface concepts were compared before implementation:

1. A full policy tree beside the mechanism, showing every budget and survivor
   subset. This makes the complete combinatorial policy visible, but repeats
   the same experimental input many times and crowds the actual mechanism on
   narrow screens.
2. The current experiment apparatus, a short branch strip, and a received-round
   selector. This keeps the input being inspected explicit while retaining
   the complete exact policy in the portable certificate.

The second concept is implemented. After receiving a round, the apparatus
continues to show that round's own controls and readings. **Inspect the next
experiment** switches to the pending input and removes historical measurement
points from that preview. The round selector restores any recorded input and
its original readings. Candidate colors remain stable when other laws are
eliminated. The acquisition controls always name the actual pending round,
even while a historical round is being inspected.

The forecast starts are illustrative, not fitted hidden states or uncertainty
envelopes. The exact test allows arbitrary nuisance states. A terminal
singleton, an out-of-family result, or an inconclusive readout disables further
acquisition in that transcript. Keyboard focus follows freeze, acquisition,
and next-experiment inspection; reduced-motion mode steps through discrete
predictions without an automatic animation.

## Source contract

The strict schema is `worldlaw.active-linear-adaptive/v1`. Its only fields are:

| Field | Contract |
| --- | --- |
| `source` | Nonempty source description |
| `hypotheses` | Two to five exact rational state-space laws, with distinct IDs |
| `experiments` | One to eight reusable complete fixed control/readout bundles |
| `resetSemantics` | `independent-unknown-state-per-experiment` |
| `noiseBound` | Nonnegative exact rational componentwise absolute error bound |
| `maxTotalReadings` | Integer total budget from 1 through 32 |
| `workLimit` | Integer exact-work budget from 100 through 50,000 |

Each law supplies `A`, `B`, and `C`, with one to five latent dimensions and one
to four shared control channels. Each experiment supplies a distinct `id`,
two to ten fixed control vectors, one to eight distinct sorted reading ticks,
positive integer reading costs, and a nonnegative integer `actuationCost`.
Individual declared cost entries are bounded by one billion. The source
example is `examples/active-adaptive-coupled-track.json`.

This reset contract is essential. There is no shared cross-round latent state,
unknown common calibration parameter, finite stock of experiments, or
history-dependent action availability. Such courses need a different planner;
they must not be encoded by quietly assuming independent resets.

## Exact common-observation geometry

For one experiment and candidate law `h`, compile the selected outputs as

```text
y = O_h x_h + f_h + e_h,     |e_h[j]| <= epsilon.
```

The initial state `x_h` is unrestricted. For every nonempty candidate subset,
the planner computes the smallest common-tube radius

```text
rho = min_(x_h, y) max_(h,j) |O_h x_h + f_h - y|.
```

The closed tubes intersect exactly when `rho <= epsilon`. Equality therefore
preserves ambiguity. Every reported radius has exact rational primal states
and a common center, plus a dual certificate. The dual weights annihilate
each observability matrix, sum to zero across the shared observation, have
total L1 norm at most one, and attain the same forcing lower bound as the
primal radius. The receiving script verifies those conditions using independent
Python `Fraction` arithmetic.

The implementation has an explicit feasible origin. Let `M` be the maximum
absolute forced output, substitute `rho = M - d`, constrain `0 <= d <= M`, and
split each unrestricted variable into positive and negative parts. Its
inequalities have the form

```text
s (O_h x_h - y) + d <= M - s f_h,     s in {-1, +1}.
```

All right-hand sides are nonnegative at the origin. The exact Bland-pivot
solver therefore needs no numerical feasibility phase. The existing
control-box solver shares that extracted exact simplex routine while keeping
its historical certificate shape and work accounting.

Pairwise tube intersections are insufficient. Three affine lines may have
all three pair intersections but no common triple intersection. The frozen
analytic example has exact triple radius `1/8`: at error `1/10`, the maximal
sets are the three pairs; at error `1/8`, the full triple is compatible.

## Minimax policy and the reading budget

For each experiment, enumerate inclusion-maximal feasible intersection masks
within the current survivor set. They are attainable exact survivor sets:
if every common point belonged to another candidate tube, a larger feasible
intersection would exist, contradicting maximality. Smaller actual survivor
sets cannot be harder than these maximal branches.

The objective is lexicographic: minimize worst-case total readings first, then
minimize worst-case total declared cost at that minimal reading bound. Source
experiment order breaks remaining ties. The Bellman state must include both
the survivor mask `S` and remaining reading budget `B`:

```text
C(S, B) = min_a [cost(a) + max_T C(T, B - readingCount(a))].
```

Singletons cost zero. An unavailable feasible continuation has infinite cost.
An experiment whose entire current survivor set has a common observation is
skipped: an adversary can retain the same state while the experiment consumes
positive readings and nonnegative cost. The policy stores every feasible
actual subset and budget up to the minimal root budget, including subsets
smaller than the maximal adversarial branches.

Keeping `B` is necessary. In the frozen five-law slack example, one branch
already requires two further readings. The easy branch may therefore use its
two-reading cheap experiment instead of its one-reading expensive experiment.
Optimizing the easy branch lexicographically in isolation would waste that
global slack. The correct policy guarantees three total readings and cost
three; the best fixed set requires four readings and cost 103.

The static comparator exhaustively chooses subsets of the identical complete
experiment catalogue. Every pair must be separated by at least one chosen
experiment. Under the stated independent-reset semantics, a finite guaranteed
policy exists exactly when the catalogue covers every pair. The implementation
does not claim that an arbitrary continuous input or an unoffered partial
reading bundle was searched.

Geometry mask traversals, exact LP starts and affected tableau rows, maximal
mask checks, static subsets, and memoized policy state/action checks share the
single work budget. Exhaustion returns `search_inconclusive`, with no chosen
policy, worst reading count, or worst cost. Partial geometry does not establish
an impossibility result.

## Receiving and portable replay

Use the existing portable `worldlaw.active-experiment-notebook/v1` format.
The source text, original frozen plan, and each original reading text remain
separate. To create a policy notebook:

```sh
node scripts/active-linear-family.mjs \
  --input examples/active-adaptive-coupled-track.json \
  --create-notebook --output planned-notebook.json
```

Receive one complete separately acquired bundle, then independently replay:

```sh
node scripts/active-linear-family.mjs \
  --notebook planned-notebook.json --readings first-round.json \
  --output received-notebook.json
node scripts/active-linear-family.mjs --notebook received-notebook.json
```

An adaptive reading document has schema `worldlaw.active-adaptive-readings/v1`
and exact fields `source`, `acquisition`, `sourceSHA256`, `planSHA256`, `round`,
`previousReadingsSHA256`, `stateKey`, `experimentId`, and `readings`, in addition
to `schema`. The first previous-reading digest is `null`; later rounds must
name the preceding original bytes. The action and state key must be the
continuation in the original plan. A standalone plan cannot receive an
adaptive round without its complete prior notebook.

All selected reading ticks must be present. An incomplete bundle is refused
without advancing or manufacturing values. A complete bundle either follows
the frozen branch, reaches one conditionally compatible candidate, falsifies
every remaining candidate, or stops inconclusively. No readout silently
replans. Reopen recomputes the source, entire policy, chain, and every decision.
Hashes bind those bytes and claims; they do not authenticate the instrument,
physical action, reset, timing, or declared noise calibration.

## Frozen qualification and measured tradeoff

The protocol, 50 courses, independent SciPy reference, prior static compiler,
and ABBA driver were frozen in commit
`9725187e44c6fee28679535342cd4e2a8e8974c5` before production implementation.
The protocol SHA-256 is
`b309ed96dc319df87fc4f33c4ad4148e6eb51ff02f4646b4db76c12fb6e3b981`;
the course SHA-256 is
`2720864c40e6c726644b43c152c05918015cf21139fc777a6e596d6821ca3770`.
The cases include 14 analytic anchors and 36 prospectively seeded point,
integrator, coupled-state, and different-decay courses. Equivalent laws,
insufficient budget, exact closed noise contact, tiny rational forcing,
permuted families, and shared-budget slack are explicit controls.

At production core commit `41fd3c7aa83d1c87dbb488e291fb9917764f8205`,
GitHub Actions run `44692810834`, candidate job `136142415476`, independently
verified all 50 courses, 2,399 exact common-tube certificates, and 804 policy
states with zero failures. Seven courses improved worst-case reading count
over the best static catalogue set. The largest course consumed 19,930 work
units. The adaptive module SHA-256 was
`a89710023f318ff850f24c957a23b1fe0b3853b42dc5ec555f55b22db1928eb7`.

An independent peer froze 37 private acquisition episodes before the candidate
was available. The original CLI received only public sources and each chosen
bundle's observations. All 33 in-family episodes retained and identified the
persistent true law; all four out-of-family episodes rejected every remaining
law. Across 61 acquired rounds there were no unresolved or incorrect results,
and all 37 final notebooks replayed exactly. Hidden starts, truth labels, and
counterfactual observations were not given to the planner. These are separate
synthetic acquisition checks, not physical evidence or unrestricted discovery.

The same CI ran 24 fresh Node.js 22.23.4 processes in three ABBA rounds, with
three repetitions per process. The static baseline and adaptive policy solve
different capability classes; fewer acquisitions do not imply a CPU speedup.

| Frozen workload | Static median ms/repetition | Adaptive median ms/repetition | Static median max RSS KiB | Adaptive median max RSS KiB |
| --- | ---: | ---: | ---: | ---: |
| Analytic anchor | 4.7342 | 50.3977 | 59,720 | 80,894 |
| Prospective cohort | 15.4867 | 190.1007 | 64,284 | 113,328 |

The original native reference attempts were terminally refused before
admission; existing GitHub Actions ran the frozen reference and candidate.
The first reference commit also exposed an omitted nested protocol file in
the source-distribution allowlist. The explicit file list was corrected; that
initial failing run remains retained. No frozen scientific gate was changed.

The maintained browser receiver exercises real navigation, keyboard freeze,
both separate synthetic rounds, pending/history separation, complete and
out-of-family portable exports, incomplete-bundle refusal, changed-policy and
chain refusal, reduced-motion stepping, and 1920/390/320-pixel layouts. It runs
against both the repository and an independently extracted official source
distribution. Main release receiving must check those actual pixels and
replay the exported notebooks before calling the increment shipped.

## Reproduce the focused checks

```sh
node --test tests/active-adaptive.test.mjs tests/active-adaptive-view.test.mjs
node scripts/active-experiment-browser.mjs
```

The browser command requires the same sandboxed Chromium/Playwright setup as
the existing active experiment receiver. Full independent SciPy receiving,
frozen baseline comparison, historical certificate compatibility, packaging,
and ABBA measurements are specified in `.github/workflows/active-adaptive.yml`.

