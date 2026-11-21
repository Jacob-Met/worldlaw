# One bounded input for several hidden-state laws

The Hidden-state apparatus at `/active.html` can now design one continuous
input for **three to five** declared linear laws. It minimizes the number of
optional scalar readings, then their declared cost, then numeric tick order.
For that selected schedule it maximizes the **smallest pairwise affine
distance**, using the same input for every pair. Independent arbitrary initial
states remain allowed for every law.

This is exact, source-conditional experiment design. The app does not operate
an actuator, verify a sensor, calibrate noise or discover these laws from data.
The broader observation-to-discovery research remains open.

## Use the actual apparatus

Start `npm start`, open `/active.html`, expand **Inspect the source and design
another experiment**, and choose **One interior input for three response laws**.
The source supplies an affine impulse family through a fixed input channel and
a second channel whose interval is `[-1,1]`. The initial hidden state disappears
before the offered reading, because these particular transition matrices are
zero.

The three outputs at tick 1 are `0`, `1+v` and `1-v`. The minimum pair distance
is `min(1-|v|, 2|v|)`. Both endpoints and the midpoint collapse a pair. The
maximum is exactly `2/3`, attained at `v=±1/3`. The deterministic circuit order
selects `-1/3`; the three predicted outputs are `0`, `2/3` and `4/3`. This is a
small analytic example of why enumerating only control-box corners does not
solve the several-law problem.

The exact input table and **One input · every candidate pair** strip belong to
the same prospective plan. The latter shows the smallest gap and the exact
distance of each pair. Choose a pair with the mouse or keyboard to inspect its
initial-state-canceling reading combination in the existing apparatus. The
traces remain labeled illustrative forecasts, not uncertainty envelopes or
observed motion.

Freeze the plan before entering separate readings. With the example's declared
error bound `1/4`, a reading of `0` leaves only `zero_response` compatible;
`10` falsifies every offered law. A coupled course with only part of its selected
schedule supplied can leave several laws compatible. Neither compatibility nor
an exact mathematical separator establishes physical truth. Exported notebooks
retain original source and reading bytes, exact plan digests, every prior
outcome and the same CLI replay path.

Two interface directions were considered: a two-dimensional input-surface map,
or all pair distances attached to the existing temporal apparatus. The latter
uses the actual common input and works for up to eight free scalar inputs;
an input-surface map would require choosing and labeling a lower-dimensional
slice. The three response traces, shared control timing and selectable
annihilating projections keep the scientific mechanism central. Desktop,
390px and 320px receiving, keyboard selection, reduced motion and actual
fresh-package replay are required before release.

## Source contract and command line

Use `worldlaw.active-linear-joint-control/v1` for 3–5 laws. The existing
`worldlaw.active-linear-control-box/v1` continues to require exactly two laws
and reproduces its previous plan bytes and work counts.

```sh
node scripts/active-linear-family.mjs \
  --input examples/active-joint-control-three-responses.json \
  --output new-joint-plan.json

node scripts/active-linear-family.mjs \
  --input examples/active-joint-control-three-responses.json \
  --replay new-joint-plan.json

node scripts/active-linear-family.mjs --notebook exported-joint-notebook.json
```

The new schema uses the same source, hypotheses (`id`, `A`, `B`, `C`), independent
`controlBounds`, offered ticks, positive integer reading costs, noise bound and
work limit as the binary schema. It permits 2–10 input ticks, 1–4 channels,
1–5 latent dimensions per law and at most eight nonfixed scalar intervals.
At most eight readings may be selected. The hard work limit is 100–50,000.
Only independent intervals are supported: coupled input budgets, shared latent
constraints, undeclared state restrictions and competing control fields are
refused. Reading time and dynamics do not change when other readings are omitted.

Source coefficients have the existing bounded rational input budget. Interior
controls produced by exact optimization can have wider fractions. Readout
evaluation accepts those computed fractions only after exact replay of their
original prospective plan; it does not relax the source parser.

## Why the joint optimization is exact

For pair `p`, stack the two laws' unknown-state observability rows into `F_p`.
Independently initialized states make its output difference an affine family
with forcing `D_p u`. Its l-infinity distance is

`d_p(u) = max_c f_pc(u)`,

where `c` ranges over signed left-kernel circuits normalized to l1 norm one,
and `f_pc(u)=w_pc^T D_p u`. The circuit enumeration is complete over the offered
reading menu. At any fixed input, every pair may independently choose the
witness that attains its own distance. Consequently,

`min_p max_c f_pc(u) = max_(c_p for every pair) min_p f_p,c_p(u)`.

Both maximizations commute when we also maximize over the common input. Each
finite witness tuple therefore supplies a linear program:

`maximize t`, subject to `t <= f_p,c_p(u)` for every pair and `u` in the box.

Every robust optional reading schedule contains a qualifying circuit for each
pair at its common input. The union of those supports is a no-larger schedule
that remains robust. Enumerating all tuples therefore also enumerates a minimum
schedule. The planner compares union cardinality, reading cost and numeric tick
order, and then all tuple optima on the winning union. It visits larger unions
as well so the distinct full-menu maximum remains certified. It recomputes
every selected pair's exact distance at the returned common input rather than
reporting a chosen witness's lower bound as that pair's distance.

The `potential` array is explicitly labeled **independent pairwise box maxima**.
They may require incompatible inputs. Only `jointPotential` describes the
greatest jointly attainable full-menu worst-pair distance. `jointProof` describes
the selected reading schedule. For example, outputs `0,v,1` on `v in [0,1]`
have independent pair maxima all equal to one, but their common worst-pair
maximum is only `1/2`; noise `3/10` rules out a robust joint experiment.

## Exact LP and independently checked certificates

For one tuple, write `u=lo+range*v`, `0<=v<=1`, and let `L` be the smallest tuple
line at the lower corner. Set `t=L+z`, `z>=0`. The point `v=z=0` is feasible and
all right-hand sides are nonnegative. This shift cannot remove a better
solution, because the lower corner already attains `L`. It avoids an artificial
feasibility phase and retains negative intermediate tuple optima.

The rational primal tableau uses the smallest-index entering variable and
smallest-index leaving basic variable among minimum-ratio ties, following
[Bland's finite pivot rule](https://doi.org/10.1287/moor.2.2.103). No floating
tolerance decides a pivot, constraint or certificate. Every LP checks primal
feasibility, dual feasibility and exact equality of the objectives.

A second certificate discards the tableau. Nonnegative pair multipliers are
normalized to sum to one. Their weighted witness coefficients define a single
linear form whose exact box maximum bounds the chosen tuple. The returned
common input attains the same bound. This check also covers a zero shifted
optimum, fixed coordinates and entirely negative tuple margins. A tuple upper
bound alone is not a global certificate; global optimality additionally relies
on completed circuit and tuple enumeration, which replay recomputes.

At every work limit the planner reports `search_inconclusive`, no selected
schedule and no chosen input. An attained partial joint margin is explicitly a
lower bound. The solver never promotes interrupted work to an infeasibility
or optimality claim. Closed noise tubes must be strictly separated by more
than `2 * noiseBound`; exact contact is refused. For a complete noisy no-go,
the blocking pair may change as the input changes.

## Locked independent receiving

Protocol SHA256:
`936eabca645701cece049fdec2357217aecf964bd7190b6b2c247eb232e50b05`.
It was frozen before production edits against main
`e594f01ef511aee2ad26607fe5b086abbd72068d`.

The 48-course fixture contains interior optima, exact contact, noncentered and
fixed boxes, equivalent laws, zero forcing, different latent dynamics,
coupled states, oscillators, numeric time ties and a five-law/ten-pair course.
Thirty seeded generated courses were fixed prospectively. Separate exact
envelope and per-tuple vertex checks agreed on 100 one-control and 20
two-control rational courses before implementation.

`scripts/active-joint-control-receiving.py` independently compiles Fraction
forward responses, enumerates every optional schedule and minimal dependency,
and solves all signed-tuple LPs with a free margin using NumPy 1.26.4 and
SciPy 1.14.1. Its absolute and primal/dual tolerances remain `1e-9`. Separate
primal distance LPs test every returned pair and independently generated
readout. It also recomputes each returned box certificate with exact Fractions.
The frozen Node reference independently enumerates all rational LP vertices,
including on the full menu; it imports no production algebra.

The cold benchmark runs three ABBA rounds, each process fresh, on the same
worker and Node version with `--max-old-space-size=1536` and three repetitions.
Exact semantic digests must match. The comparison is against the prospectively
frozen exhaustive reference, **not a previously shipped continuous solver**.
Measured times, memory, precise source hashes and official release results
belong in the PR and retained workflow receipts. No speedup or scientific
receiving result is claimed merely from authored tests.

The planner first counts the visits required by the full signed-witness tree.
If those visits alone exceed the remaining work budget, it omits signs whose
exact maximum over the actuator box is strictly negative. A maximum of zero
remains eligible. Other searches preserve their original traversal and saved
plans replay with their original accounting.
