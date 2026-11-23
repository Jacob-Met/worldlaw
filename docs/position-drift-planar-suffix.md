# Choose a suffix from a two-dimensional measurement region

In the Hidden-state workbench, load **Choose a suffix from two measured positions**. After three fixed pulses, subtract the affine line through the first two positions from the remaining two. Call these residuals s and t. The workbench uses the resulting point to select the entire remaining command sequence.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-planar-suffix.json --create-notebook --output planar.json
node scripts/active-linear-family.mjs --notebook planar.json
node --test tests/position-drift-planar-suffix.test.mjs
```

The v4 planner accepts exactly three fixed prefix commands, two to four laws and one to four offered suffixes. Suffixes have equal lengths of one to six pulses. It gives a policy for this declared menu or one measured prefix that defeats every offered suffix, with two physical worlds per suffix and their own common later positions. It does not optimize the prefix, the pulse count or an unrestricted adaptive policy.

## An example where both measured coordinates matter

All four laws survive the following normalized prefixes. Holding either coordinate fixed still leaves histories that require opposite suffixes.

| s | t | Required suffix |
| --- | --- | --- |
| −1 | −2 | y1, y2 |
| −1 | −3 | x1, x2 |
| −3/2 | −2 | y1, y2 |
| −1/3 | −2 | x1, x2 |

The unsafe polygon for X is the parallelogram defined by |t| ≤ 2 and |3s−2t| ≤ 2. For Y the same region is translated by (1,−1). Their projections onto each coordinate axis overlap, while the two closed parallelograms are disjoint. The oblique contrast 3s−2t also happens to separate these particular polygons. The implementation retains both coordinates for general inputs. Truncating both alternatives to one pulse yields a single prefix at which both shorter choices fail.

## Projection with all later measurements

Use the same normalized forcing K and clean-position differences d0,d1 as in the [two-prefix-pulse planner](position-drift-suffix-regions.md). At each tick j the difference between clean law predictions is D(j)=(1−j)d0+j d1+ΔK(j). Simultaneous close readings require |D(j)| ≤ 2ε throughout the whole tape. This compact polygon bounds the difference pair even when the offered suffix has many pulses.

For a fixed point in that polygon, the mean initial positions vary independently in intervals with radii ε−|d0|/2 and ε−|d1|/2. At ticks two and three, the two reading intervals intersect with independent residual radii ε−|D(2)|/2 and ε−|D(3)|/2. Therefore the attainable (s,t) region is a translated sum of four line segments. The initial means contribute in directions (−1,−2) and (2,3), and the two reading overlaps contribute in directions (1,0) and (0,1).

Cut the difference polygon at the four zero lines for d0,d1,D(2),D(3). On each resulting cell every radius is affine in the difference pair. For any fixed selection of the four endpoint signs, its projected corner varies affinely and is a convex combination of the corresponding corners at cell vertices. Those corners are all physically attainable. The full observation region is convex because it projects linear inequalities in physical starts and common measurements. Consequently the convex hull of all 16 corners over all checked arrangement vertices is exactly the pair's unsafe history polygon. Degenerate segments, points and zero error are included.

A suffix is unsafe at the union of its pair polygons. The existing exact vertical-section solver checks whether these finite unions share a point across the entire menu. It visits event abscissae at polygon vertices and edge intersections, plus each intervening slab. Endpoints and isolated point contacts are included. If the intersection is empty, the receiver chooses the first suffix outside its unsafe union. Otherwise the witness uses one common prefix in that intersection. For each suffix a separate four-variable solve reconstructs both raw positions and drifts, then validates every reported position. Edge-touch, vertex-only contact and a positive 60-digit rational displacement are covered by the tests.
