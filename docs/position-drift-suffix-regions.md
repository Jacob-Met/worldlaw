# Choose a suffix from the measured second difference

In the Hidden-state workbench, load **Choose a suffix by measured position**. Apply the two declared prefix commands. Record the initial position and each subsequent position. The second difference of these three readings selects the complete suffix. A prefix that no law can explain stops the experiment.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-suffix-regions.json --create-notebook --output regions.json
node scripts/active-linear-family.mjs --notebook regions.json
node --test tests/position-drift-suffix-regions.test.mjs
```

The v3 source accepts two fixed prefix pulses and a finite menu of equal-length committed suffixes. For this prefix and menu it either certifies a safe choice at every feasible history or returns one common prefix with a complete two-world collision for every offered suffix. Later readings are private to the suffix choice. Intake admits up to 16 laws, 16 suffixes and ten pulses per suffix. Other fixed prefixes, fully adaptive continuations and minimum horizon are separate questions.

## Identical survivor lists can require opposite commands

All four laws in the example can explain both measured prefixes under unit error. A and B share the complete X record (0,0,2,6,7). C and D share the complete Y record (0,0,3,105,104). The earlier prefix requires Y and the later prefix requires X. Offering only the first command of each suffix leaves a common history that defeats both.

| Prefix positions | Possible laws | Committed suffix | Later positions | Result |
| --- | --- | --- | --- | --- |
| 0, 0, 2 | A, B, C, D | y1, y2 | 4, 7 | A |
| 0, 0, 3 | A, B, C, D | x1, x2 | 101, 99 | C |

The closed interval where X can fail is [−2,2]. For Y it is [3,7]. Moving the latter interval until the endpoints meet produces two physically replayable collisions at that same history. A positive rational gap reopens a policy even when it is too small for binary floating point.

## Exact projection in two variables

Subtract the line through the first two observed positions. The gauged readings at ticks zero and one are zero, and the third reading is the observed second difference s. In a given law let h0 and h1 be the clean gauged initial positions. Each lies in [−ε,ε], and they can vary independently because initial position and drift are free. Write K(t) for cumulative forcing minus t times the first command's rate. The clean prediction is (1−t)h0 + t h1 + K(t).

For two laws let d0 and d1 be the differences of their h0 and h1 values, and let ΔK be the difference of their forcings. The clean position difference is

```text
D(t) = (1−t)d0 + t d1 + ΔK(t).
```

The two trajectories can share an observation at every tick precisely when |D(t)| ≤ 2ε at all ticks. This includes the closed square restrictions at ticks zero and one. These strips define a compact difference polygon, possibly a segment or a single point. With both starts fixed, each future tick may use the midpoint of the two clean predictions.

At fixed d0,d1 the two initial-position means have independent radii ε−|d0|/2 and ε−|d1|/2. At tick two they enter with coefficients −1 and 2. The overlap of the two reading intervals at tick two contributes another radius ε−|D(2)|/2. Thus the set of possible s at this difference pair is a closed interval centered at (K₁(2)+K₂(2))/2 with radius

```text
4ε − (|d0| + 2|d1| + |D(2)|)/2.
```

The center is independent of d0 and d1. Its maximum radius gives the full projection. Minimize the penalty in parentheses on the polygon. It is linear in every cell cut by the three lines d0=0, d1=0 and D(2)=0. A bounded cell has an optimal vertex. The solver enumerates intersections of distinct directions from these lines and the strip boundaries and checks every original strip. The argument also covers a segment, a point and zero noise.

For each suffix, the union of its pair intervals gives its unsafe values of s. A single law's feasible interval is K(2) ± 4ε. The planner evaluates every endpoint and one point from each open interval between successive endpoints. Membership is constant on each such open interval. If all suffixes fail at a feasible s, choose an offending pair per suffix. Its maximizing difference pair has sufficient width to realize **that same s**. Allocate its displacement among the initial-position means and the tick-two reading overlap, reconstruct both starts, then validate every returned reading against the original physical trajectories.
