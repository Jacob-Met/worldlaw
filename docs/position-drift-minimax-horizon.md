# Pulse bounds for two persistent rate families

In the Hidden-state workbench choose **Bound the minimum for two persistent rate families**. Supply two finite convex hulls of command-rate rows and a closed absolute bound on each reading error. A member uses one fixed mixture, initial position and drift throughout the experiment.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-minimax-simplex.json --create-notebook --output minimax.json
node scripts/active-linear-family.mjs --notebook minimax.json
node --test tests/position-drift-minimax-horizon.test.mjs
```

## One primal and dual feasibility system

Write d for the raw rate difference between a mixture of the first family's vertices A and a mixture of the second family's vertices B. Its oscillation is the maximum command rate difference minus the minimum. The hardest known-member pair minimizes this value. For two command distributions P and Q, the guaranteed rate contrast is the smallest (P−Q)·(Aᵢ−Bⱼ) over every endpoint pair.

The finite zero-sum game has command pairs (u,v) as experimental actions and vertex pairs (i,j) as nature's actions. Its payoff is (Aᵢ−Bⱼ)[u]−(Aᵢ−Bⱼ)[v]. Only the two marginals of each player's joint distribution affect the expected payoff. Conversely, any two marginals have a joint realization, for example their product. Finite minimax duality therefore gives the equality of the hardest oscillation and largest guaranteed rate contrast.

The exact solver needs only linear feasibility. It solves d[u]−d[v] ≤ g for every command pair and (P−Q)·(Aᵢ−Bⱼ) ≥ g for every vertex pair, together with the simplex bounds on all four mixtures. The receiver independently substitutes the returned weights: the physical range of d must equal the least dual vertex gap, and both must equal g. If g is zero the hardest pair has a constant raw rate offset, giving an all-horizon gauge alias.

## A causal lower bound and integer upper bound

For g>0 the hardest fixed pair is a valid subproblem of the family problem. The existing exact binary theorem gives the maximum achievable distance from an arbitrary affine initial trajectory after h pulses as g·floor(h²/4)/(2h). Let L be the first h where this is strictly above 2ε. For every h<L the binary midpoint adversary provides a common measured history against any adaptive strategy. The planner exposes this causal adversary on the returned physical pair, together with its fixed parameter weights.

Implement the fractional controls P and Q by command runs with integer lengths. For block lengths x and y, each distribution times its block length must have integer counts. The middle reading minus its linear interpolation between the first and last readings has noiseless family gap gxy/(x+y). Its coefficients have absolute sum two, so each family's measured interval has radius 2ε. Separation requires the gap to exceed 4ε.

At total L, admissible first-block lengths x form an arithmetic progression: x is a multiple of the first distribution's common denominator and L−x a multiple of the second's. The feasible point nearest L/2 maximizes x(L−x); examining its neighboring congruent integers covers the two possible rounding directions. Independently, round the two balanced lengths up to admissible multiples in both orders. This always supplies an upper bound, since xy/(x+y) increases in each positive argument. A result with equal bounds proves the global adaptive minimum. Otherwise the reported interval remains open, including the possibility of a better arrangement of commands. All run counts are arbitrary-precision integers. The experiment takes one position at each run boundary, including the three used by the contrast certificate.

## A 49-pulse minimum

On the triangle fixture the hardest pair is the zero-rate law and the member with rates (0,1/3,1/3,1/3). The minimax gap is 1/3. The lower-bound distance at 48 pulses is exactly 2 with ε=1, so the closed observations can still coincide. The source-derived distributions choose a alone in the first block and equal shares of b,c,d in the second. Apply a for 25 pulses, then b,c,d for eight each. The second block always contributes eight units of forcing to the triangle family because its weights sum to one. The three-reading chord gap is 200/49, leaving strictly positive measured separation 4/49. The global adaptive minimum is therefore 49, down from the previous 68-pulse uniform schedule upper bound.

The complete receiver retains all prefix constraints on the same mixture and start, including at unequal or repeated command blocks. It handles an exhausted work budget separately from a physically empty region. At zero noise the same source gives lower bound 2 and upper bound 4. This minimax certificate does not establish equality there.
