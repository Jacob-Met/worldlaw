# Joint bounded-noise checks for nonlinear intervention readouts

The `worldlaw.active-vandermonde-nonlinear/v1` source describes a known linear
state transition with a shared scalar polynomial actuator law. Each intervention
episode has its own unrestricted initial state. A received reading set is
consistent only when **one initial state and one bounded error vector per
episode, together with one shared polynomial, explain every supplied reading**.

This is a conditional consistency certificate for the declared finite model. It
does not authenticate measurements, establish the sensor error bound, identify
an unrestricted physical law, or establish transfer to unseen physical systems.

## Why checking a nullspace basis is insufficient

For `A = 0`, `b = C = 1`, an episode sampled at ticks 0, 1, 2 and 3 has the form
`[x0, g(u), g(u), g(u)] + error`. With absolute reading error at most 1, the
readings `[0, 0, -2, 2]` require both `g(u) <= -1` and `g(u) >= 1`.
Nevertheless, the independent basis residuals `y1-y2` and `y1-y3` each have
absolute value 2, equal to their individual error bound. They therefore passed
the former basis-only check. Their combination `y2-y3` has residual 4 and bound
2, proving that the complete episode is impossible.

The same problem affects catalog membership. For `[0, 1, 3, 3]`, all readings
together force `g(u) = 2`. A selected invariant using only `y1` incorrectly
admits the zero law at its error boundary. The family remains feasible, but the
zero hypothesis must be falsified. Conversely `[0, 0, -1, 1]` admits the zero
law exactly on the closed boundary and must remain accepted.

There is a second coupling across amplitudes. Individually feasible episode
responses need not be values of any one polynomial of the declared degree.
Checking an arbitrary basis of polynomial residuals again gives necessary
constraints without guaranteeing a common bounded-error explanation.

## Complete exact geometry

Write one observed episode as

`y = O x0 + h g + e`, with `|e_i| <= epsilon`.

For every minimal row dependency, or circuit, `w` of the observation matrix
`O`, feasibility requires

`|w·y - (w·h)g| <= epsilon ||w||_1`.

The receiver uses the existing complete rational circuit enumeration in
`active-linear-family.mjs`. Every separator in the left kernel decomposes into
circuits with compatible signs, so these constraints are sufficient as well as
necessary. A row with `w·h = 0` directly checks dynamics. Every other row gives
a closed interval for `g`. Their intersection is the exact response interval
for that episode; an empty intersection produces a rational contradiction.

If all episode intervals are nonempty, write their centers as `c_k` and radii
as `r_k`. The Vandermonde matrix `V` maps polynomial coefficients to the episode
responses. For every circuit `v` of `V`, the receiver checks

`|v·c| <= sum_k |v_k| r_k`.

The same sign-compatible decomposition proves that these checks exactly decide
whether the complete interval box intersects the polynomial image. Zero-width
intervals and exact equality remain valid. Candidate catalog laws must put each
of their responses inside the corresponding complete episode interval.

All acceptance decisions and contradiction witnesses use rational arithmetic.
The existing numerical Fisher condition estimate remains a prospective design
diagnostic. The readout repair does not change prospective schedule selection,
coefficient estimates or their existing conservative error bounds.

## Product entry point and replay

The maintained CLI already dispatches this source schema through the shared
experiment-record module:

```sh
node scripts/active-linear-family.mjs --input source.json --output plan.json
node scripts/active-linear-family.mjs --input source.json --replay plan.json \
  --readings readings.json --output result.json
node scripts/active-linear-family.mjs --input source.json --replay plan.json \
  --readings readings.json --replay-readings result.json
```

The readings document must contain the exact `sourceSHA256` and `planSHA256`
returned by planning, the readings schema, source attribution, acquisition type,
and one correctly indexed episode for each frozen amplitude. Output paths must
be new files. Portable notebooks use the same receiver:

```sh
node scripts/active-linear-family.mjs --input source.json --create-notebook \
  --output notebook.json
node scripts/active-linear-family.mjs --notebook notebook.json \
  --readings readings.json --output received-notebook.json
node scripts/active-linear-family.mjs --notebook received-notebook.json
```

Valid pre-change plans, closed-boundary readouts and portable notebooks retain
their exact serialized bytes. A saved false certification is refused on replay
because recomputation now finds the contradiction. Its original source and
readings can be received again to obtain the corrected result. Historical
basis residual fields remain diagnostic and need not enumerate every failing
episode; complete joint feasibility determines the acceptance decision.

## Qualification of the repair

The regression tests in `tests/active-vandermonde-joint-noise.test.mjs` cover
the explicit false certificates, cross-amplitude incompatibility, exact
fractional boundary contact, zero observation rows, and all 343 integer
three-reading courses with values from -3 through 3.

An independent qualification froze 162 rational synthetic cases at SHA256
`59f4fbe4266cf6ba61bf1e924520592dccf2edf8c48e741514cc6d5b20a94daa`.
It used one to three hidden state variables, degrees two through four, five to
nine amplitudes, irregular observation ticks and pulse masks, bounded errors,
corruptions and higher-degree outsiders. A separate solver worked directly on
the original stacked reading inequalities, with a distinct initial state for
each episode. SciPy 1.14.1/HiGHS proposed solutions; Python rational arithmetic
verified every primal explanation or dual contradiction. All 486 family and
fixed-hypothesis checks produced exact witnesses, with no unresolved numerical
case.

Both source versions refused 12 designs whose actuator response was absorbable
by the initial state; independent exact initial-state witnesses verified those
structural refusals. Among the remaining 150 cases, the repair agreed with every
family and catalog verdict. Five old family acceptances became correct
out-of-family abstentions. All 150 prospective plans stayed identical, and 145
readout results stayed identical. These are implementation qualification
results, not an empirical generalization benchmark.

On the pinned pre-change source `35019ebaf004323a0860181d15c7b505bbeb34bb`,
paired full-suite runs used Node 22.23.4, one test worker and a 1536 MiB Node heap.
The baseline had 2457 passing tests and the candidate had 2463, each with one
skip and zero failures. Both launched-product smoke commands passed. Fourteen
maintained-CLI checks also verified byte-identical valid legacy replay and
refusal of changed source bytes, wrong plan bindings, changed prospective plans
and an old false certificate. Full case data, solver witnesses, execution
receipts and logs remain separate from the source distribution.

## Off-grid identifiability

The seven signed amplitudes from −3/2 to 3/2, spaced 1/2 apart, admit an exact counterexample even with noiseless readings. For the unit-gain law `g(u) = u`, a periodic ripple `±sin(2πu)/2` vanishes at every measured amplitude. A degree-seven term `±∏(2u−2v)/128`, with one factor per measured amplitude `v`, also vanishes at each one. A gain change `±max(0,u−3/2)` is invisible inside the measured range. Adding any of these six terms to the reference gives identical readings for all starting states on this schedule. An arbitrarily long episode at the same amplitude cannot separate these laws.

The executable audit uses the exact plant `A=0, b=C=1`, so each reading after the initial state equals its actuator response. It verifies the complete receiver output for indistinguishable courses and requires a cross-amplitude polynomial contradiction when the readings separate. The schedules and alternative laws are fixed in `tests/active-vandermonde-domain.test.mjs`.

| Amplitudes added to the original seven | Degree-seven alternatives rejected | Periodic alternatives rejected | Gain changes rejected | Unit-gain control |
|---|---:|---:|---:|---|
| None | 0/2 | 0/2 | 0/2 | Accepted |
| 1/4 | 2/2 | 2/2 | 0/2 | Accepted |
| 2 | 2/2 | 0/2 | 2/2 | Accepted |
| 1/4 and 2 | 2/2 | 2/2 | 2/2 | Accepted |

These are deterministic synthetic witnesses selected to examine the measurement support. The fractions above count those witnesses. To assess transfer, freeze candidate laws first, then acquire independently chosen intervention levels and record the design range, noise budget and admissible law class. For any finite set of distinct levels, the product of the factors `(u−v)` over those levels produces another polynomial invisible there. An independently justified degree bound changes this conclusion. Two noiseless polynomials of degree at most `d` that agree on `d+1` distinct levels agree everywhere.
