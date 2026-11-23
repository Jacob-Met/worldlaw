# The adaptive minimum at noise 1/10 is eleven pulses

For the registered eight-command, two-family position/drift catalog, **ten pulses cannot identify the family with a sure guarantee, even when every command can depend on every prior position reading**. The [fixed eleven-pulse receiver](fixed-tape-optimum.md) identifies both families at this noise. At ten pulses the unrestricted first-failure radius is exactly 1/10: the fixed ten-pulse tape succeeds at every smaller noise. The unrestricted eleven-pulse radius is also exact at 5/44.

## One causal reading rule

Let A have fixed source masses (1,2,1,2)/6 and B masses (2,1,2,1)/6. The mean of their rate vectors is μ. In source order ref,group,x0,y0,z0,x1,y1,z1, its entries are 0,1/2,1/4,1/12,−1/12,1/4,1/12,−1/12. The difference of the two rate vectors is zero on the baseline commands ref/group and 1/6 on all six suffix commands.

Start at reading zero. Through tick nine, return the running sum of μ on the commands actually received. At tick ten, use the same sum except on the category words B⁵S⁵ and S⁵B⁵, where B denotes either baseline command and S any suffix command. For these two cases, the table supplies two physical worlds and their terminal midpoint after the controller has committed its final action. The table never changes a prior reading.

A deterministic controller interacting with this rule generates one actual history. Two fixed mixtures, origins and drifts fit that entire history within closed error 1/10. The choice of a retrospective witness can depend on the completed history because the readings which determined the actions were already fixed causally. Either physical world can generate the same observed decision path from its start. A shorter sure-success program could be padded to ten pulses while retaining its earlier decision, so the obstruction also covers it. The same argument applies to sure guarantees required for each setting of a controller's random choices.

## The 1,022 ordinary category words

Let fₜ denote the cumulative suffix count divided by six. The two balanced clean rate histories differ by fₜ. If |fₜ−a−bt|≤2ε at every tick, give A origin −a/2, drift −b/2 and B origin +a/2, drift +b/2. Both physical paths then fit the running μ sum. Such an affine line exists exactly when all pairwise slope intervals

    [(fⱼ−fᵢ−4ε)/(j−i), (fⱼ−fᵢ+4ε)/(j−i)]

intersect. For any feasible slope b the required intercept is in the intersection of the closed intervals [fₜ−bt−2ε, fₜ−bt+2ε]. Pairwise overlap for these intervals is sufficient. The verifier checks all 1,024 ten-bit words with exact rational arithmetic and reconstructs the line on each of the 1,022 ordinary words.

An independent geometric derivation explains the only exceptions. The best uniform straight-line approximation to a finite scalar trajectory is determined by a triple of times: eliminating the intercept and slope from the closed strips gives the normalized second differences. For this midpoint rule the least noise on a ten-tick category word is the maximum over i<j<k of

    |(k−i)(Nⱼ−Nᵢ) − (j−i)(Nₖ−Nᵢ)| / [24(k−i)],

where N is the cumulative, unscaled suffix count. On any interval of length n the numerator is bounded by floor(n²/4), since the two subinterval counts lie between zero and their lengths. For n≤9 the ratio is at most 5/54. For n=10 exceeding 1/10 requires integer numerator 25. This requires a split exactly at five with one half all baseline and the other all suffix. The ordinary rule at those two words requires exactly 5/48.

The same balanced midpoint gives an unrestricted upper bound floor(H²/4)/(24H) at every positive horizon H. Choose the chord slope joining the two endpoints of the cumulative suffix count; the range of the residual is at most q(H−q)/H with q suffix pulses. Centring that residual by its midrange gives physical measurement error at most q(H−q)/(24H). This argument applies to any feedback controller on the resulting causal word. When H ≥ 11 is congruent to 11, 0 or 1 modulo 12, an integer q nearest H/2 is a multiple of six. The fixed construction uses q=6k suffix pulses and H−q references, attaining q(H−q)/(24H). Thus feedback cannot improve the radius at any of these horizons. The first three examples are H=11,12,13 with exact unrestricted radii 5/44, 1/8 and 7/52.

In fact no single virtual rate table can do better than 5/48 uniformly. Subtract its reference rate and write uᵧ and u𝓏 for virtual rates on y0,z0. Five refs followed by five z0 must be fit by A, whose z0 rate is zero, and the analogous y0 tape must be fit by B. Their three-checkpoint chords require |uᵧ|,|u𝓏|≤4ε/5. With five refs followed by all six suffix commands except z0, A's accumulated source rate equals one. Omitting y0 instead makes B's sum zero. The two chord bounds require uᵧ−u𝓏≥1−8ε. Combining these gives ε≥5/48. This is why the terminal reading genuinely depends on the completed actions.

## Closed physical witnesses at the exceptional words

The first five commands have one category, the next four the other, followed by a final command of that second category. Group together words with the same first-five multiset, next-four multiset and terminal command. The two directions have 6·126·6=4,536 and 252·5·2=2,520 groups, respectively. The packet assigns one pair of persistent physical worlds to each of these 7,056 groups, with 6,210 distinct pairs. Each pair stores three masses per law, the fourth being their nonnegative complement, plus both origins and both drifts.

The constructor requires each world's deviation from μ to remain in [−1/10,1/10] at all prefix submultisets in both blocks, including tick nine. At tick ten it requires the two clean positions to differ by at most 1/5. These constraints allow their midpoint as a common terminal reading and accommodate every order in each group. The independent standard-library verifier enumerates all **497,664 literal exceptional words**, advances both worlds on every actual command and checks **10,948,608 world/tick positions** using integers scaled by exact rational denominators. Together with the ordinary category proof this covers all **8¹⁰ = 1,073,741,824** action words without constructing a full decision tree.

For example, five references followed by x1,y0,z0,y1,x0 yields terminal reading 3/5. The reverse-category tape x1,y1,x0,y0,z0 followed by five references yields 67/120. On both paths the first ten readings, including tick zero, are the running μ sum. The terminal midpoint can depend on the actual final action.

## Replay and regenerate

```sh
python3 scripts/verify-ten-pulse-terminal-adversary.py examples/active-position-drift-fixed-tape-optimum.json examples/ten-pulse-terminal-adversary.json
python3 scripts/verify-ten-pulse-terminal-adversary.py examples/active-position-drift-fixed-tape-optimum.json examples/ten-pulse-terminal-adversary.json --commands ref ref ref ref ref x1 y0 z0 y1 x0
```

With `--commands`, the receiver returns the exact shared readings and two complete physical witnesses. Use any prefix of up to ten commands. The separately packaged SciPy constructor locates rational candidate witnesses; the verifier only uses the Python standard library.

```sh
python3 scripts/design-ten-pulse-terminal-adversary.py examples/active-position-drift-fixed-tape-optimum.json /tmp/ten-adversary.json
python3 scripts/verify-ten-pulse-terminal-adversary.py examples/active-position-drift-fixed-tape-optimum.json /tmp/ten-adversary.json
```
