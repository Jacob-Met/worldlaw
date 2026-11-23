# The grouped families' unrestricted five-pulse noise radius

The largest first-failure radius over all five-pulse feedback policies is **1/29** for the eight-command grouped catalog. The only optimal first pair is `ref, ref`. The runner-up, `group, ref`, first fails at 1/31. The previously exhibited four-leaf program attains 1/29. At equality **every** five-pulse policy now has a physical collision, so at least six pulses are required. The exact minimum remains five on 1/40 ≤ ε < 1/29. The [six-pulse physical tree](persistent-feedback-tree.md) attains six there.

## Replay the physical result

```sh
python3 scripts/verify-five-pulse-global.py \
  examples/active-position-drift-five-pulse-minimum.json \
  examples/active-position-drift-five-pulse-global-certificate.json \
  --history '["ref","ref","group","x1","y1"]'
```

The standard-library receiver checks all 64 ordered first pairs and all 512 continuations per pair. It reports all exact thresholds. The optional command word displays the two constant mixtures, two starts and drifts, six shared readings, and both clean trajectories on that boundary path. Alternative branches share observations until their commands diverge. The notebook CLI in [the five-pulse minimum experiment](position-drift-five-pulse-minimum.md) still guides the optimal four-leaf program from actual readings.

## Covering every controller

Subtract an affine trajectory to normalize the first two readings to zero. The unknown initial position and drift in each counterfactual world absorb this translation. A physical collision may therefore give a controller two initial zero readings, fixing an ordered first pair. Index every later reading by its entire command history. The root reading is shared by all 512 continuations; the next by those with the same third command, and similarly at the next levels. Each leaf has one private persistent physical state per family. One feasible assignment on the complete tree defeats any continuation strategy. Conversely, infeasibility rules out a causal adversary on the finite action tree; the controller can choose a safe child at each reachable history. The shipped four-leaf receiver already realizes this choice at the maximizing prefix.

For each prefix a one-core sparse linear program minimized ε over 5,706 coordinates and 16,384 raw inequalities. Its output was rationally reconstructed before scientific use. The independent receiver evaluates all 32,768 terminal pairs and 65,536 physical trajectories from the original source vertices. It also checks a positive combination of the raw inequalities: all shared reading, mixture, origin and drift coefficients cancel, leaving −ε ≤ −R. This lower proof matches the physical collision at R for each separate prefix. Three initial command pairs already fail at zero noise.

## Packet layout

The packet binds the ordered command names and the two families' named vertices. It lists the first pairs in lexicographic source-index order, including repeats. Each base64-encoded gzip block contains a JSON record with four fields: the first-pair indices, the rational radius, the rational coordinates and a sparse list of positive dual row weights. Coordinates appear in order of first use, as the verifier traverses the lexicographically ordered leaves. For each leaf it first allocates missing shared readings, then the origin, drift and all but the last mixture weight per family. The remaining weight is the complement to one. The original row ordering is the nonnegativity of free masses, their unit-sum upper bound, and the upper and lower position tube at each of six ticks. Forged, missing and extra coordinates or source rows cannot satisfy both checks.

For an independent coarse bound, the six x/y/z differences of any A/B mixtures sum to one and the reference difference is zero. The A weights (1/6,1/3,1/6,1/3) and B weights (1/2,1/6,1/6,1/6) give difference 1/6 on every nonreference command. Their binary midpoint bound is 1/20. The complete causal trees tighten it to 1/29.
