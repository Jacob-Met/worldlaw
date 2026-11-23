# Prospective planner for persistent position and drift

## Frozen correctness controls

The input is a finite table of rational command rates for each candidate law and a closed nonnegative per-reading noise bound. Commands draw from one declared finite menu, with repetition allowed. One unknown position and one unknown constant drift persist across the three pulses and all four readings.

* Recover the registered four-law adaptive-only case. A raw polynomial simulator must identify each planted law under extreme noise and on rational initial states.
* For any refused first/second command pair, supply a single common prefix and, for every possible third command, a full shared transcript together with two distinct laws and compatible initial-state pairs. Check these certificates by raw forward simulation.
* Compare each pair's projected observation overlap to an independent finite-dimensional polygon intersection computed from the projected noise corners and edge intersections. Include exact point intersections, disjoint sets, and zero noise.
* Cover every feasible decision boundary, including singletons, without rounding. Report out-of-family measurements explicitly. Challenge saved policy, action, measurement and state-region fields by mutation and require exact replay.
* Check positive, indistinguishable and adaptive-only catalogs. Reorder rows and relabel actions in an independent deterministic catalog sweep; unidentifiability cannot depend on enumeration order.
* Preserve the previously shipped four-law receiver's records and all existing product tests. This milestone is a source API with an executable proof. No UI change is required.

## Why the finite search is complete

Write the first three command rates of one law as a, b and c. The two observable contrasts are s = y₂ − 2y₁ + y₀ and t = y₃ − 3y₁ + 2y₀. Their clean values are s₀ = b − a and t₀ = b + c − 2a. For any desired y₀ and y₁ and any admissible first two errors, there exists an initial position and drift giving exactly these readings. In particular, restricting a putative adaptive policy to y₀ = y₁ = 0 fixes its first two commands without ruling out any law, errors or contrast values. Conversely, a policy that can decide from s after a fixed first pair works under every shift in initial position and drift. Enumerating all ordered first pairs and all third commands is therefore complete within the registered budget.

For a noise bound e, the contrast error is the image of a four-dimensional cube. Its four generators in (s,t) are (1,2), (−2,−3), (1,0), and (0,1), each scaled by an arbitrary value in [−e,e]. The resulting centrally symmetric polygon has edge directions parallel to these generators. Writing S=s−s₀ and T=t−t₀, its exact four pairs of supporting lines give

    |S| ≤ 4e,    |T| ≤ 6e,    |T−2S| ≤ 4e,    |2T−3S| ≤ 6e.

Each bound is the sum of the absolute projected generator coefficients times e. Together these include all edge normals of the polygon. For e=0 their common intersection is exactly the clean point.

For each candidate third command, the planner intersects each pair of law polygons. Comparing every lower bound on t to every upper bound eliminates t and produces a closed interval of s where those two laws can still share the same final observation. Degenerate one-point intervals remain unsafe. The endpoints of all such intervals and all feasible prefix intervals partition the axis. Between consecutive endpoints, the feasible prefixes and safe third commands are constant. A command safe at an endpoint is safe throughout the adjacent reachable open interval because every unsafe set is closed and all its boundaries were included. Splitting at the midpoint therefore lets the planner emit a closed cover using a safe endpoint command on each half. If neighboring regions meet, both commands work at their shared endpoint. The receiver uses the first listed region.

If all third commands are unsafe at some reachable s, this first pair cannot succeed. The certificate gives the exact shared prefix (0,0,s) and, for each possible final action, a final reading and initial states for two different laws. One refusal for every first pair defeats any three-pulse strategy on its prescribed common prefix. These certificates are relative to the supplied finite command menu, rate table and bounded-noise dynamics.

## Source and replay

Import the functions from `src/science/persistent-position-drift-planner.mjs`. One to six commands and two to eight laws are supported. Rates and the nonnegative noise bound use the existing exact source-rational parser. Measurements accept exact integer or rational strings, including values beyond the coefficient bound. The old four-law receiver remains available with its existing record schema.

```js
const source = {
  schema: CATALOG_SCHEMA,
  commands: ['off','zero','one','two'],
  noiseBound: 1,
  laws: [
    {id:'A', rates:[0,0,0,0]}, {id:'B', rates:[0,16,0,0]},
    {id:'C', rates:[0,16,16,0]}, {id:'D', rates:[0,16,16,16]},
  ],
};
const policy = planPositionDriftCatalog(source);
replayPositionDriftPolicy(source, policy);
const prefix = observePositionDriftCatalog(source, policy, [0,0,16]);
// prefix.rounds.at(-1).next is 'two'
const record = observePositionDriftCatalog(source, policy, [0,0,16,32]);
replayPositionDriftCatalog(source, policy, record);
```

Policy replay recomputes the canonical source and all decision regions or refusal witnesses. Measurement replay recomputes every selected command, every surviving law, all correlated initial-state strips and one compatible initial pair for each. An impossible prefix has no survivors and no next command. The records verify consistency with supplied source and measurements.

Run `node --test tests/persistent-position-drift-planner.test.mjs tests/persistent-position-drift.test.mjs` for the prospective and prior fixed-witness controls. The unrelated polygon oracle forms a convex hull of the 16 noise corners, then intersects paired polygons via edge crossings and contained vertices. The deterministic catalog sweep covers 37 catalogs with zero and positive noise, independently checks every closed region, and forward-simulates every refusal witness.
