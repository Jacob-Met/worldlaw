# Four-pulse planning with one persistent position and drift

## Frozen correctness controls

Case 16 of the published 37-catalog course has laws with rates [1,−8,5] and [−4,−7,6] on u0,u1,u2 and noise bound 1. The complete three-pulse planner refused each first pair. Four pulses u1,u1,u0,u0 give y₄−2y₂+y₀ equal to 18 or 6 before noise. The two error intervals [14,22] and [2,10] are disjoint. This is the registered first recovery.

The new horizon observes five positions from a single trajectory. Preserve the correlation of all five errors under contrast projection. Check the three-dimensional projected error cube independently against raw state feasibility or vertex enumeration. Keep exact boundary points, faces, segments and degenerate zero-noise points. Check at least one strictly adaptive four-pulse catalog against every fixed tape, one horizon-independent refusal, and complete physical reconstruction of both laws and both starts at every terminal branch of a refusal tree. Reopen records and reject altered policies, observations, selected actions and state posteriors. Preserve the established three-pulse API.

## Complete policy search

Write the pulse rates under one law as a,b,c,d, and let the first two measured positions be y₀,y₁. Subtract the affine trajectory y₀+k(y₁−y₀) from each reading. Shifting the unknown starting position and drift implements this transformation for every law and preserves each noise value. A strategy can therefore be challenged at y₀=y₁=0 to fix its first two actions, with no loss of generality. The remaining three coordinates are

    s = y₂−2y₁+y₀,   t = y₃−3y₁+2y₀,   w = y₄−4y₁+3y₀.

Their clean center is (b−a, b+c−2a, b+c+d−3a). The error vector is the sum of contributions along (1,2,3), (−2,−3,−4), (1,0,0), (0,1,0) and (0,0,1), each multiplied by its original reading error. This uses the same five errors throughout all decisions.

The error region is a three-dimensional zonotope, the image of the closed five-dimensional noise cube. Every facet is parallel to two independent generating segments. For each signed normal n given by a cross product of two generators, the support value is e times the sum of |n·g| over the five generators g. These supporting half-spaces describe the entire region. At zero noise they intersect at the clean center.

For a fixed tape and pair of laws, both regions have these same normals. Taking the smaller of their two bounds intersects them. Eliminating w by comparing every lower bound with every upper bound gives the exact polygon of prefixes (s,t) where that final action could leave the pair indistinguishable. The implementation clips closed half-planes and retains segments and points. The saved fourth-action rule selects the first final command whose ambiguity polygons exclude the observed (s,t).

The third decision must be taken before t is known. For a fixed third command, each final command has a union of pair polygons where it fails. The third command is unsafe at s if there is some t in all of those unions. A vertical sweep intersects the closed interval unions at each vertex abscissa and every crossing of nonvertical polygon edges. Between consecutive events, no polygon starts or ends and edge heights cannot change order. Testing one interior point of each open slab is therefore exact. The projection of these finite unions and intersections of compact polygons is closed, including isolated event points. The third-command compiler constructs a closed safe cover of the feasible s axis. Commands on adjacent closed regions are both safe at a shared endpoint.

If a first pair fails, its certificate records one common prefix (0,0,s). For every possible third command it supplies a reading t at which **all** final commands fail. Each final action has a reading w and two distinct laws with initial states physically consistent with the same five observations. A full refusal contains this tree for every first pair. Different future choices can have different witness continuations. Every complete branch retains one fixed starting position and drift for each law.

The finite search can grow quickly with the catalog size. For a given first pair and third command, the sweep considers all intersecting edge pairs from the ambiguity polygons of its final alternatives. A complete refusal records a terminal collision at each of the m⁴ action tapes, where m is the number of commands.

## Measured result

Replaying the 14 published three-pulse refusals at this horizon identifies cases 16, 22 and 24. The other 11 still admit complete refusal trees. Independent raw dynamics check 356 terminal collisions and both starting states for each. Case 16 has a working fixed four-pulse tape, so that recovery establishes the value of the additional pulse.

A separate five-law staircase catalog requires adaptivity even at the longer horizon. Command u0 coasts. Law k responds by 16 on the first k of u1 through u4 and by zero elsewhere. All 625 fixed four-pulse tapes have a clean collision. With no coast pulse, the constant difference between laws 0 and 4 is absorbed by drift; with coast, at least one of the four on-commands is missing, so its adjacent laws agree. The complete three-pulse solver also refuses this catalog. Four adaptive pulses identify all five laws under the closed unit-noise bound. The policy begins with u0,u1. After a high first contrast it sends u3, then selects u2 or u4 using the next reading.

## Reproduce and replay

Import `planFourPulsePositionDrift`, `replayFourPulsePositionDriftPolicy` and `openFourPulsePositionDrift` from `src/science/persistent-position-drift-four-pulse.mjs`. Use the rate catalog source schema from the three-pulse planner. The returned policy contains the canonical source, closed third-command cover and fourth-action ambiguity polygons, or the complete refusal tree.

```js
const policy = planFourPulsePositionDrift(source);
replayFourPulsePositionDriftPolicy(source, policy);
if (policy.status === 'identified') {
  const experiment = openFourPulsePositionDrift(source, policy);
  const prefix = experiment.observe([0, 0]);
  const nextCommand = prefix.rounds.at(-1).next;
  experiment.replay(JSON.parse(JSON.stringify(prefix)));
}
```

Opening recompiles the policy once. The session subsequently fits every prefix against the correlated position/drift strips and reconstructs saved actions and state witnesses on replay. The source proof covers arbitrary bounded real noise. The receiver accepts exact rational observations. Run `node --test tests/persistent-position-drift-four-pulse.test.mjs` for the original 14 refusals, an independent reconstruction from the 32 raw cube corners, the exhaustive zero-noise game, exact contact boundaries, forward simulation and tampered-record controls.
