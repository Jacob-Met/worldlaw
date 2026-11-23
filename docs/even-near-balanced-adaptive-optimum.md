# Two infinite horizon classes with an exact adaptive optimum

For the registered grouped position/drift catalog, let **H=2n with n≥5 and n≡1 or 5 modulo 6**. The unrestricted adaptive first-failure radius is

    e = (n²−1)/(48n).

The fixed optimum equals e. The construction below supplies a causal obstruction at equality against every adaptive controller. This extends the previously proved matching horizons by H≡2 or 10 modulo 12. It includes H=10 (1/10), **H=14 (1/7)**, H=22 (5/22) and H=26 (7/26). Combining H=13 and H=14 gives minimum fourteen throughout [7/52,1/7). At nonconsecutive higher horizons this theorem supplies a radius; a minimum interval requires the neighbouring-horizon evidence as well.

## Why two category words suffice

Write B for either baseline command ref/group and S for any suffix. The balanced A and B masses are (1,2,1,2)/6 and (2,1,2,1)/6. Their rate difference is zero on B and 1/6 on S. The nominal display sums the mean μ of their rates over the actual action prefix. The best affine fit to the rate-difference trajectory supplies the two opposite shifts in origin and drift. By the [three-tick strip criterion](nine-pulse-causal-obstruction.md), each triple of ticks with span L and middle index j contributes at most j(L−j)/(24L) to the required original observation noise.

For L≤2n−1 this is at most n(n−1)/[24(2n−1)]≤e. For a triple spanning all 2n pulses, every off-center split j≠n has j(2n−j)≤n²−1. At j=n the unscaled integer count contrast is bounded by n² and attains this absolute value only for BⁿSⁿ or SⁿBⁿ. Therefore all proper prefixes and all other full category words can retain the nominal display. For an actual ordinary word the receiver intersects slope bounds at run endpoints and recovers one intercept. This handles an uninterrupted suffix block inside a noncritical tape even when its endpoint chord alone is too loose.

The [fixed experiment](fixed-tape-optimum.md) has s=6k suffix pulses, with 6k the multiple of six at distance one from n, and H−s references. Its radius s(H−s)/(24H)=(n²−1)/(48n) gives strict identification below e.

## Terminal construction from literal counts

On a critical word let N_c count suffix command c. Since 3 does not divide n, some group has Nₓ≠Nᵧ or Nₓ≠N_z. A can shift mass between that group's x and y vertices. B can shift mass between its neutral vertex and its x−z vertex. Both preserve the group mass and both baseline rates.

Use σ_A=+1 and σ_B=−1. Write h_l(t)=σ_l(clean_l(t)−nominal(t)). Before adding drift, the signed rate above the nominal rate is zero on B and 1/12 on S for either balanced world. Modify just one world: for Nₓ≠Nᵧ, add −1/[6n(Nₓ−Nᵧ)] to the A x mass and subtract it from the y mass. Alternatively, for Nₓ≠N_z add +1/[6n(Nₓ−N_z)] to the B x−z mass and subtract it from the neutral mass. This choice uses the completed word, after all previous replies have been delivered.

The signed change δ_l(c) has magnitude at most 1/(6n). Its sum Δ_l over the complete suffix is −1/(6n) for the modified law, zero for the other. All masses remain nonnegative because the smallest balanced mass is 1/6. The total physical suffix contrast becomes n/6−1/(6n)=8e. Set α=1/12−2e/n=(n²+1)/(24n²). For n≥5,

    α ≥ 1/(6n),     2e/n ≥ 1/(6n),     (n−1)α ≤ 2e.

**Baseline first.** Set σ_l p_l=e and σ_l v_l=−2e/n. The signed deviation goes from +e to −e during the first n commands. Every suffix increment α+δ_l(c) is nonnegative. For a proper prefix omitting s≥1 suffix commands its accumulated δ is at most (s−1)/(6n), since the total is −1/(6n) for the modified law. The other law accumulates zero. The rise is at most (n−s)α+(s−1)/(6n)≤(n−1)α≤2e. At the final tick h_A+h_B=2e.

**Suffix first.** Set σ_l p_l=−e and σ_l v_l=−α−Δ_l/n. Each suffix step is 2e/n+δ_l(c)−Δ_l/n≥0, and these n steps sum to 2e. Both signed deviations reach +e at the switch. Each subsequent signed baseline drift lies in [−α,0], so any proper baseline prefix moves by at most (n−1)α≤2e. At the final tick h_A+h_B=−2e.

In both orders clean_A−clean_B=h_A+h_B. Return their midpoint at the last tick. Each law has one original mixture, origin and drift for the whole transcript. Earlier replies were the nominal μ on the commands received, independent of any future input. A controller stopping early inherits both physical explanations from any completion.

## Replay at large horizons

```sh
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-even-near-balance.json
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-even-near-balance.json --runs runs.json
```

A run is {"command":"x0","repeats":"1"}. The default source has H=14. The receiver returns the nominal rate table, retained run endpoints, any exceptional terminal correction and two original source worlds. For a repeated final command it also checks the penultimate tick before the terminal adjustment. Affine interpolation covers the intervening nominal readings. With R runs the ordinary strip calculation uses O(R²) arithmetic operations and O(R) retained points. The exceptional construction uses constant-dimensional counts and O(R) arithmetic. Rational bit sizes grow with the supplied counts.
