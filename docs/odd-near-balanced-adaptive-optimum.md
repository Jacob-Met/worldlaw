# Exact adaptive radius at odd near-balanced horizons

For the registered eight-command A/B source, let H=2n+1≥21 be congruent to 3 or 9 modulo 12. Its unrestricted adaptive radius is

    e = [n(n+1)−2]/(24H).

A fixed tape separates strictly below e. At e, each adaptive controller admits a causal transcript with two persistent physical explanations. Examples include H=21 at 3/14 and H=27 at 5/18. The different [early-feedback construction](fifteen-pulse-early-obstruction.md) closes H=15 separately. The [even-horizon construction](even-near-balanced-adaptive-optimum.md) uses a smaller correction at equal block lengths.

## Which transcripts require a terminal adjustment?

In the [fixed optimum](fixed-tape-optimum.md), choose k nearest H/12. The nearest 6k to H/2 is 3/2 away, hence k(H−6k)/(4H)=e. Its tape opens with H−6k references and visits each suffix command k times.

Use the original source mixtures A=(1,2,1,2)/6 and B=(2,1,2,1)/6. Return their cumulative mean μ through the penultimate reading. A command from B={ref,group} has zero rate difference and one from S={x0,y0,z0,x1,y1,z1} has difference 1/6. As in the even theorem, fitting one affine line to the cumulative difference is equivalent to the three-time chord bounds. A span of L ticks requires at most floor(L²/4)/(24L). On any proper span this is ≤n/48≤e. On the full span a split at j contributes at most j(H−j)/(24H), already ≤e except at j=n,n+1. There the numerator attains n(n+1) only for opposite pure blocks. Replacing any one category loses at least min(j,H−j)=n>2. Thus exactly four full category words can require a different last reply. Every earlier reply depends only on received commands.

## Unequal blocks

Let b be the baseline length and s the suffix length, in either order, so {b,s}={n,n+1}. Write d=2, C=d/(6b), α=1/12−2e/b and β=1/12−2e/s. Then

    s/6−C = 4eH/b,
    α ≥ C,          (s−1)α ≤ 2e,
    2e ≥ (s−1)C,    β ≥ C/s,     (b−1)β ≤ 2e.

For the inequalities, α=(b²+d)/(12bH) and β=(s²+d)/(12sH). Both b,s≥10 and H≤2min(b,s)+1, giving b²,s²≥4H. This implies α≥C. The two proper-length inequalities reduce respectively to b²,s²≥d(H−1). For the fourth inequality b(bs−d)≥4H(s−1) follows from b²≥4H and 4H≥bd. Finally b(s²+d)≥2dH proves β≥C/s.

Neither s=n nor s=n+1 is divisible by three. Some group g has N_x≠N_y or N_x≠N_z. Use the source's within-group A x/y or B (x−z)/neutral mass transfer, respectively, as in the even theorem, with C replacing 1/(6n). The weight change is −C/(N_x−N_y) for A or +C/(N_x−N_z) for B. Both keep the group mass and all baseline rates. Its magnitude is ≤C≤1/30 and both donor weights are ≥1/6. With signs σ_A=1, σ_B=−1, the signed changes δ_l satisfy |δ_l(c)|≤C. Their suffix totals are Δ=−C in the modified law and zero in the other. Put h_l=σ_l(clean_l−μ).

* **Baseline first.** Use signed origin +e and signed drift −2e/b for both laws. Both h reach −e at the switch. Each subsequent rise is α+δ_l(c)≥0. At a proper suffix prefix omitting r≥1 commands, the perturbed law's accumulated change is ≤(r−1)C because its total is −C. The unperturbed law has zero change. Hence the rise is at most (s−r)α+(r−1)C≤(s−1)α≤2e. At the end h_A+h_B=−2e+2sα−C=2e.
* **Suffix first.** Use signed origin −e and signed drift −β−Δ_l/s. During the suffix, each rise is 2e/s+δ_l(c)−Δ_l/s≥0, and the total rise is 2e. Both reach +e at the switch. Subsequent baseline drifts lie in [−β,0], so every proper baseline prefix fits the closed tube. Finally h_A+h_B=2e−2bβ+bC/s=−2e.

The physical terminal gap is |h_A+h_B|=2e. Return the midpoint only after the last command has arrived. The receiver replays the two source worlds from their original weights, origins and drifts, including the penultimate tick of a long final run. Its cost depends on the number of supplied runs and the bit lengths of their counts.

## Reproduce

```sh
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-odd-near-balance.json
python3 scripts/near-balanced-even-obstruction.py examples/active-position-drift-odd-near-balance.json --runs runs.json
```

The existing command accepts odd and even sources. H=15 illustrates the limit of this proof. At b=7,s=8, α=17/420 is below C=1/21. Two *literal* tapes show the need for an earlier change at the fixed radius. Put W=x0 x0 y0 z0 z0 x1 y1 z1. If every proper reading is μ, even a free terminal reading on ref⁷ W forces ε≥35/232, and W ref⁷ forces ε≥14/93. Both exceed 3/20. The [two sparse original-row certificates](../examples/fifteen-pulse-nominal-prefix-limits.json) use only nonnegative weights; the test sums their actual source-position inequalities and recovers −ε≤−35/232 and −ε≤−14/93. The later early-feedback construction establishes the unrestricted H=15 radius 3/20.
