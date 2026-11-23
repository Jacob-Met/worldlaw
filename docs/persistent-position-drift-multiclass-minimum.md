# Multiclass minimum pulse certificates

A hard pair bounds the worst-case pulse count of any policy for the full catalog. Restricting a successful multiclass policy to two possible laws gives a successful binary policy under the same persistent initial position, constant drift, and bounded position-reading errors. The largest of the exact binary minima is therefore an adaptive lower bound. A single fixed word that separates *every* pair gives an adaptive upper bound. Equality proves the multiclass minimum against sure feedback policies.

## Five finite historical four-pulse refusals

The same five source tables and noise bounds from the [all-horizon study](persistent-position-drift-all-horizon.md) were evaluated. In the words below, `u` indices refer to the original zero-based command columns.

| Original case | Prior fixed upper bound | Hardest binary minimum | Exact fixed minimum | Adaptive minimum | Attaining fixed word |
| --- | ---: | ---: | ---: | --- | --- |
| 8 | 14 | 6 | 7 | 6–7 | u2 × 2, u1 × 2, u0 × 3 |
| 12 | 10 | 6 | 7 | 6–7 | u2 × 1, u1 × 3, u0 × 3 |
| 26 | 10 | 9 | 9 | 9 | u0 × 4, u1 × 5 |
| 30 | 12 | 6 | 6 | 6 | u0 × 3, u2 × 3 |
| 34 | 18 | 17 | 17 | 17 | u0 × 8, u1 × 9 |

Cases 8 and 12 each have 729 six-pulse words over three commands. Every one has a common physical trajectory transcript under at least two laws. The seven-pulse fixed words separate all law pairs. Different six-pulse words can collide under different law pairs or on different transcripts, so these computations leave the adaptive six-pulse question open.

## Exact fixed-tape gate

Let S be the difference of the two laws' accumulated forcing, with zero initial forcing. Their initial position and drift difference contributes an arbitrary affine function of time. A common transcript exists iff some affine function approximates S to within 2ε at every tick. This is the intersection of closed strips in the two coordinates of that affine function. Within each constant-command run both curves are linear, so testing the run endpoints suffices even when all intermediate ticks are observable.

For endpoint times a<b<c, form the signed contrast

    (b−a)·(S(c)−S(b)) − (c−b)·(S(b)−S(a)).

The strips on these times intersect exactly when the absolute contrast is at most 4(c−a)ε. To see this, interpolate between the endpoints. The middle sample's residual can differ from the convex combination of the endpoint residuals by any amount in [−4ε,4ε]. Multiplication by c−a gives the displayed threshold. By the planar Helly theorem, empty intersection of finitely many strips has a witness of at most three strips. Every two distinct observation times admit an exact interpolating line, so a strict violation on some triple is necessary and sufficient for separation. Different law pairs may use different triples on the same fixed tape.

For a collision, return the midpoint of the two forcing trajectories at each run endpoint. The exact physical receiver finds one starting position and drift per law consistent with all these readings. Linear interpolation supplies the same admissible midpoint transcript at every interior tick. Equality at the threshold remains a collision. For a separated tape, save the signed contrast, threshold, and strictly positive margin of one witness per pair.

## Reproduce or supply another catalog

```sh
node scripts/active-linear-family.mjs --input catalog.json --multiclass-minimum --enumerate-through 7 --word-budget 2000
node --test tests/persistent-position-drift-multiclass-minimum.test.mjs
```

The planner first tests balanced two-block words built from the binary extremal commands at the common lower bound. This step works with compressed arbitrary-size integers. If necessary, the two options enable a finite enumeration of fixed words starting at the lower bound, subject to a total word budget. A completely rejected horizon advances only the fixed-word lower bound. A partial enumeration leaves that bound unchanged. The default performs no exhaustive enumeration and always retains a certified upper tape from the original construction or an improvement. Gauge-equivalent catalogs return their permanent physical witnesses.

Import `certifyPositionDriftTape(source, runs)` to check an independently supplied fixed word. `certifyMulticlassPositionDriftMinimum(source, limits)` designs a tape and independently certifies it from the physical equations. `replayMulticlassPositionDriftMinimum(source, saved, limits)` recomputes the declared search, bounds and tape. The caller supplies the same search limits on replay. Tests forward-simulate both returned worlds at every tick of all 1,458 six-pulse rejections, exercise one-word-short budget exhaustion, and check a three-law family whose minimum exceeds 600 decimal digits.
