# Exact active-law discrimination under unknown initial conditions

Worldlaw can now design a **prospective unit-input experiment that proves which measurements could separate competing finite linear dynamical laws**, even when each law is allowed a different, completely unknown initial state. This is a source-only experiment compiler, not a sensor, data fit, actuator or discovery of the actual law.

## Why ordinary prediction-distance designs can be wrong

For declared hypothesis h:
- latent state: x(t+1) = A_h x(t) + B_h u(t)
- scalar reading: y_h(t) = C_h x(t)
- initial x_h(0) is unbounded and *unknown*, and may differ between hypotheses.

The input sequence u(t) must be frozen **before observing any outcomes**. At each offered time t, Worldlaw computes exact rational O_h(t)=C_h A_h^t and forced response f_h(t). For a selected sequence S, two hypotheses are indistinguishable for some allowed initial states iff

    f_j(S) - f_i(S) is in column_space([O_i(S), -O_j(S)]).

This is a stronger, physically meaningful test than checking whether the two laws' forecasts differ when arbitrarily initialized to zero. A proposed course is **certifiably structurally separating** if the exact augmented column rank grows. A left-nullspace dual vector w then has wᵀO_i = wᵀO_j = 0 and wᵀ(f_j-f_i) ≠ 0, so no choice of either initial state can explain the same noiseless readouts.

When each prospective reading has independent-or-correlated but **componentwise bounded** error |e(t)| ≤ ε (the errors need *not* be stochastic or independent), the same witness proves robust separation if

    |wᵀ(f_j-f_i)| / ||w||₁ > 2 ε.

The compiler now maximizes this ratio **exactly**, using rational arithmetic. For
B = [O_i(S), -O_j(S)] and d = f_j(S)-f_i(S), finite linear-programming duality gives

    min_x ||d - Bx||_infinity = max_(B^T w=0, ||w||_1<=1) |w^T d|.

The maximum is attained by a minimal dependent set of rows, called a circuit.
On that support, the left kernel has dimension one and its vector has no zero
entries. Otherwise a nonzero kernel perturbation preserving the active L1 face
would make the point a convex combination rather than an extreme point.
Every circuit has at most rank(B)+1 rows. The implementation recovers all of
them by enumerating only sets of exactly rank(B)+1 rows. To see why this is
complete, remove one row from a circuit and extend the remaining independent
rows to a basis of the full row space. Restoring the removed row gives a
rank(B)+1-row set with a one-dimensional kernel. Its unique relation is the
original circuit, with zeros on the extra basis rows. Conversely, the nonzero
support of a one-dimensional kernel cannot contain a smaller nonzero relation.

Zero coordinates must therefore be stripped, not rejected. The implementation
deduplicates these minimal supports, normalizes the final nonzero coefficient
to one and restores increasing support order. It checks each retained
annihilator exactly. This preserves the canonical scientific witnesses while
avoiding the redundant algebra on every smaller subset.

Full-menu circuits are computed once per model pair. Restricting to circuits
supported on a selected schedule gives that schedule's exact distance. The
distance cannot decrease when readings are added. A full-menu distance at most
2ε proves overlap of the two closed error tubes and prevents a smaller schedule
from guaranteeing separation. **Equality is overlap**, not success.

The field `marginLowerBound` remains for callers and contains the exact distance
when `noiseMarginExact` is true. The existing status
`noise_separation_not_certified` is accompanied by `noiseOverlapProven: true`
when a complete full-menu calculation proves overlap. Exhausted circuit searches
report incomplete lower bounds and `search_inconclusive`; they never turn a
missing witness into an impossibility claim.

This replaces the earlier canonical-basis lower bound. For a late velocity pulse
and the two coupling gains 1 and 2, the full schedule 0,1,2,3,4 has exact distance
3/8, whereas the earlier basis reported 1/8. The forcing difference is
[0,0,0,0,1]; the affine fit -3/8+t/4 attains a maximum residual of 3/8, matching
the circuit supported at ticks 0,3,4. The earlier subset search already found
those three readings; this example establishes the improved full-menu margin,
not a previously failed three-reading design.

## A falsifiable cold case

    node scripts/active-linear-family.mjs \
      --input examples/active-linear-family-decays.json \
      --output /workspace/active-decays-certificate.json

The hypothetical candidates are scalar decays A=1/2 versus A=1/3, each with a unit input gain and arbitrary unknown initial state. The input is a unit impulse followed by zeros. Ordinary future predictions differ if both states are set to zero, but with *unobserved* initial state, either model can fit two measurements. The exact controller finds **three readings** sufficient, including an initial-state anchoring observation at t=0, and a noise-bounded separating witness. It enumerates all smaller cardinalities and then minimizes declared integer cost among equal-cardinality choices.

    node scripts/active-linear-family.mjs \
      --input examples/active-linear-family-decays.json \
      --replay /workspace/active-decays-certificate.json

The replay checks the **exact original input byte digest** and recomputes the full rational certificate. A changed input, forged margin, or altered selected schedule fails closed.

## Independent controls and limits

    node --test tests/active-linear-family.test.mjs
    npm run verify

The unit tests independently compare 64 held-out law/input cases with a dense numerical augmented-rank oracle, verify a genuinely zero-input negative control, same-law equivalence, mutated inputs and certificates, a high-noise refusal, and an insufficient-budget outcome.

The exact finite enumeration accepts 2–5 named hypotheses, 1–5 latent variables per hypothesis, 1–4 input channels, 2–10 control ticks, at most 12 candidate reading ticks and up to eight selected measurements. Costs are positive integer declarations. The 50,000-node default hard ceiling counts affine rank checks, rank-complete circuit extensions and schedule traversal together; it cannot be waived into a claim of optimality. Rational input coefficients must be literal exact integers or fractions; there is no approximate decimal parser.

### Five hidden coordinates and two sufficient readings

`examples/active-linear-family-signed-cycles.json` declares two hypothetical
five-state cycles. One returns the state unchanged after five ticks; the other
reverses its sign after five ticks. A unit input at control tick 4 gives
`y(10)-y(0) = 1` or `-1`, regardless of all five unknown initial coordinates.
Readings at ticks 0 and 10 therefore separate the laws. Their normalized
affine distance is exactly 1, sufficient for the declared error bound 1/4.
At error bound 1/2 the closed error tubes touch and the compiler refuses robust
separation.

The full pair matrix has rank ten, but its only circuit uses two rows. The
rank-complete eleven-row extension exposes this circuit through nine zero
coefficients. The exact designer can certify the two-reading optimum with a
100-node work limit; it does not assume or estimate the hidden initial state.

```sh
npm run active:family -- --input examples/active-linear-family-signed-cycles.json
node --test tests/active-linear-rank.test.mjs
```

Certificates include actual search-work accounting. Saved v1 exact-circuit plans
and readouts remain replayable: the verifier recognizes their historical
enumeration and reproduces the complete original result through the shared
rational core, including counters and exhaustion. New planning always uses the
rank-complete search; there is no user-facing algorithm switch. An older
inconclusive certificate stays inconclusive on replay even when a new plan can
now finish within the same budget. The original source, plan and readout digests
remain bound, and forged historical counters still fail verification.

**What this does not establish:** a real experimental channel exists, input actuation is safe or achievable, a model's A/B/C is correct, noise is actually bounded by ε, or the world fits these linear laws. Actual physical qualification requires independently acquired source measurements, calibrated error bounds and a prospective unseen-source intervention. Evidence-level labels in the CLI are intentional; the source-only proof cannot be promoted to empirical causal identification.


## Joint active choice: change the physical input before choosing readings

The higher-order source schema **worldlaw.active-linear-interventions/v1** accepts a finite prospective intervention menu. Each item supplies a named, ordered control-vector sequence and a nonnegative declared action cost. Every model receives exactly that same control sequence, but retains its own independent unconstrained initial state. The optimizer compares pairwise law-separating rank under each control course and searches minimum observation times with exact dual witnesses. Ties among certified courses use action cost plus sensor reading cost. It neither reads outcomes nor performs actions.

Cold source-only example:

    npm run active:family -- --input examples/active-intervention-family-decays.json --output /workspace/active-intervention-source-certificate.json
    node scripts/active-linear-family.mjs --input examples/active-intervention-family-decays.json --replay /workspace/active-intervention-source-certificate.json
    node --test tests/active-intervention-family.test.mjs

The original and dynamic source-identifiability compilers address the row space of a single declared law. Joint intervention design instead separates **two independent unknown-state latent laws**. A no-actuation option is retained as a negative control: in the two-decay example its whole trajectory remains observationally ambiguous, while an early declared impulse permits an exact three-reading certificate. Later excitation is an independently priced alternative, not a strawman.

The optimum is explicitly finite: up to eight named interventions, each with up to ten control ticks, five-dimensional latent laws, up to twelve candidate readout ticks, and 50,000 exact work nodes per intervention. Each offered intervention is evaluated; exhaustion prevents globally certified optimality. Bounded noise uses exact affine-set distance. This deterministic set separation is not statistical power or a probability of discovering the true law.

This is **not** an automated physical laboratory. Actual actuation requires source-bound hardware calibration, verified noise, actuator safety, and independent held-out real-world interventions. No certificate on the offered menu is never a proof that no different physical action could separate models.


### Coupled hidden-state source example

The same exact compiler handles an actual multi-coordinate law family, not merely scalar decays. The source-only example **examples/active-intervention-coupled-kinematics.json** declares latent position and velocity, measured position alone, and competing coupling gains k=1 versus k=2. Its transition is A = [[1,k],[0,1]], with B = [[0],[1]], C = [1,0]. Initial position and hidden velocity may independently differ under either model.

With idle input, any finite trajectory can be attributed to a suitable latent position/velocity, and the mechanisms remain observationally equivalent. After a declared velocity pulse at tick 0, three prospective position readings at ticks 0,1,2 give an exact integer certificate: y(0) - 2 y(1) + y(2) = k times the input. The second difference cancels **both** nuisance initial coordinates and separates the two coupling laws without the planner seeing future outcomes. The exact projected normalized gap is 1/4 position units, sufficient against the declared 1/100 per-readout adversarial error bound. This is conditional kinematics, not an authenticated actuator or physical experiment.

    npm run active:family -- --input examples/active-intervention-coupled-kinematics.json
    node --test tests/active-intervention-family.test.mjs

The test independently varies initial position and hidden velocity over 25 held-out pairs and checks both source models and the zero-input negative. This couples the algebraic certificate to a reproducible dynamical interpretation instead of a synthetic rank-only claim.

## Receive readings against the frozen plan

Keep planning and outcomes in separate files. The prospective command writes
both the exact source-byte SHA-256 and a digest of its deterministic plan.
`--readings` requires `--replay` of that earlier plan; it will not silently plan
another intervention after seeing outcomes.

The readout document has this shape (copy both digests from your saved plan):

```json
{
  "schema": "worldlaw.active-linear-readings/v1",
  "source": "Identify the separate recording or declared synthetic generator here",
  "acquisition": "supplied",
  "sourceSHA256": "COPY_SOURCE_DIGEST_FROM_PLAN",
  "planSHA256": "COPY_PLAN_DIGEST_FROM_PLAN",
  "interventionId": "COPY_CHOSEN_INTERVENTION_FOR_MENU_PLANS",
  "readings": [{"tick": 0, "value": "3/2"}]
}
```

For a fixed control course, omit `interventionId`. For a finite menu it must name
the chosen intervention. `acquisition` is `synthetic` or `supplied`; neither
label verifies physical origin. Values are exact integer or fraction literals.
Readings can arrive in any order and may be a nonempty subset of planned ticks.
Missing ticks remain visible. Duplicate ticks, unselected ticks, the wrong
intervention and mismatching digests are refused. Outcomes never alter the plan.

For each law, the receiver computes

    min_x ||y(S) - f_h(S) - O_h(S)x||_infinity.

The law is compatible iff this value is at most ε. A strict excess supplies an
exact annihilator explaining its rejection. Complete circuit enumeration is
required to declare compatibility; an exhausted search remains inconclusive.
There may be one, several or **zero** compatible laws. Zero means the supplied
readings contradict the entire offered family under the declared conditions.
It calls for investigating the model, input, timing, calibration or error bound;
the receiver does not invent a winner. One compatible law is still a conditional
candidate, not authenticated physical truth.

### Complete cold synthetic example

First create a prospective coupled-kinematics plan:

```sh
node scripts/active-linear-family.mjs \
  --input examples/active-intervention-coupled-kinematics.json \
  --output /workspace/coupled-plan.json
```

The selected pulse and ticks 0,1,2 have an independently hand-calculated trace
[0,0,1] for coupling 1 and zero initial position/velocity. Create its separately
labeled synthetic readout after saving the plan:

```sh
node --input-type=module - <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const plan=JSON.parse(readFileSync('/workspace/coupled-plan.json','utf8'));
const readings={
  schema:'worldlaw.active-linear-readings/v1',
  source:'Hand-calculated synthetic pulse: coupling 1, zero initial position and velocity',
  acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,
  interventionId:plan.chosenIntervention,
  readings:[{tick:0,value:0},{tick:1,value:0},{tick:2,value:1}]
};
writeFileSync('/workspace/coupled-readings.json',JSON.stringify(readings,null,2)+'\n',{flag:'wx'});
JS
node scripts/active-linear-family.mjs \
  --input examples/active-intervention-coupled-kinematics.json \
  --replay /workspace/coupled-plan.json --readings /workspace/coupled-readings.json \
  --output /workspace/coupled-result.json
```

The result retains only `unit_coupling`. With the same frozen plan, a separate
synthetic readout [0,0,10] rejects both laws. With only tick 0 supplied, both remain
compatible and the missing planned ticks are reported. Neither synthetic outcome
is a physical acquisition. Keep the first result rather than overwriting it.

Replay after restarting the process:

```sh
node scripts/active-linear-family.mjs \
  --input examples/active-intervention-coupled-kinematics.json \
  --replay /workspace/coupled-plan.json --readings /workspace/coupled-readings.json \
  --replay-readings /workspace/coupled-result.json
```

The receiver recomputes all decisions and checks the source, plan and original
readout-byte digests. Editing a value, certificate or selected intervention
invalidates replay. Output files are created exclusively; an existing receipt is
never overwritten by the CLI. These hashes establish byte identity and numerical
reproducibility, not trusted acquisition time, chronology or physical provenance.

## Independent numerical receiving

The unchanged original 13 active-family tests remain part of acceptance. The
additional exact controls and cold CLI process course are in
`tests/active-linear-noise.test.mjs`. An independent receiver freezes 48 generated
two/three-law courses with seed 3511609 and compares all affordable schedules
against the primal minimax linear program in SciPy HiGHS. It does not import the
production nullspace or circuit code. Absolute margin tolerance is fixed at 1e-8;
false certified schedules and inconsistent readout decisions are not allowed.

```sh
python -m pip install numpy==1.26.4 scipy==1.14.1
python scripts/active-noise-primal-receiving.py \
  --module src/science/active-linear-family.mjs \
  --output /workspace/active-noise-oracle.json
node --test tests/active-linear-family.test.mjs \
  tests/active-intervention-family.test.mjs tests/active-linear-noise.test.mjs
npm run verify
```

SciPy is a receiving dependency only; the product and exact solver still require
only Node.js. The workflow retains the full oracle inputs, comparisons and
failures as artifacts alongside the unchanged pinned Nullgarden receiver.

The rank-extension receiver adds 64 prospectively frozen signed-cycle courses
with seed 3540113, one to five latent dimensions, two or three hypotheses and
eleven offered ticks. Zero-input, zero-sensor and identical-law controls remain
in the cohort. It compares exact margins, optimal reading count/cost and supplied
readout decisions to the unchanged primal LP, with the same 1e-8 tolerance.
Scientific fields, including canonical witnesses, must also match source-pinned
main `9924453de132d02f0589369454b9f08676c45ff3`; only work counts and their
description may differ. Additional 100-node courses cannot assert false
optimality. Fresh-process ABBA runs use the same Node flags, one common warmup
and eight repetitions of the analytic anchor per process.

The saved-record receiving fixture was generated by the actual CLI from pinned
main `9924453de132d02f0589369454b9f08676c45ff3` before compatibility edits. Its
SHA-256 is `ef2a62a2d4d9ec6f630a4b0e833420bab21a572e9f2ac97f7b2b982fbff35f30`.
It retains fixed-course, intervention-menu, inconclusive and idle plans plus
six positive, all-falsified and partial readouts. Separate fresh CLI processes
must reproduce every original scientific field, digest and work count. These
records are labeled synthetic; their preservation is a persistence check, not
new physical evidence.

```sh
git show 9924453de132d02f0589369454b9f08676c45ff3:src/science/active-linear-family.mjs > /workspace/worldlaw-rank-baseline.mjs
python scripts/active-rank-extension-receiving.py \
  --oracle scripts/active-noise-primal-receiving.py \
  --baseline /workspace/worldlaw-rank-baseline.mjs \
  --candidate src/science/active-linear-family.mjs \
  --output /workspace/active-rank-receiving.json
```

## Planning for one missing reading

Use `worldlaw.active-linear-one-erasure/v1` in a fixed-input linear-family source to require separation after **any one scheduled reading is missing**. The planner charges for every scheduled tick, including the lost one. Each entry in `singleDeletionProofs` identifies the missing tick, the retained ticks, and the exact pairwise noise margins on that projected schedule. The per-reading error bound and the unknown initial states still apply.

To run the example from the repository root:

```sh
node scripts/active-linear-family.mjs --input examples/active-linear-one-erasure.json --output /tmp/one-erasure-plan.json
node scripts/active-linear-family.mjs --input examples/active-linear-one-erasure.json --replay /tmp/one-erasure-plan.json
```

The ordinary readout command accepts the surviving scheduled ticks and reports `withinDesignedErasureBudget`. If more than one reading is missing, its per-law consistency checks still describe the supplied readings, but the prospective one-loss guarantee no longer applies. All certificates describe the specified model family and error bound. Physical origin and calibration require separate evidence.
