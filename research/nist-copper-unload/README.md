# Extrapolating a copper indentation unload to zero force

The NIST copper study identifies two indents within one grain and associates them with two multistep force curves. The public catalog advertises a line scan across the pair and a subset of the curves. The dated acquisition receipts in `source.json` record HTTP 503 for the Figure 5 CSV and README, including an independent README refusal. The available article and supplement establish the unordered pairing. They leave the last measured branch, its depth origin and the independent local surface-to-floor height for both sites unqualified. The registered comparison therefore has **zero scored indent pairs**. The approximate depth discussed in the article is an aggregate observation.

For an exact conditional unloading law, a separate mathematical result quantifies what even a perfectly registered high-load measurement can determine. With an unknown linear compliance and observations covering 51.2% through 100% of peak force, displacement error bounded by ε permits an unavoidable **53.8197 ε** worst-case error in the inferred zero-load depth. Independently fixing the compliance reduces that multiplier to **4.5556**. These factors apply to a specified error band and model class. The study supplies no numerical ε for this calculation.

## Source and measurement contract

The authors imaged the surface before and after indentation in noncontact mode. Their supplement fits the Hertz law on 20–90% of each step’s maximum load, holding effective modulus fixed and fitting an effective radius. Only stress–strain pairs with unloading-fit R² at least 0.7 enter their subsequent stress–strain calculation. Figure S9’s before/after height profiles characterize a probe using a test grating. Its datum belongs to that grating.

Our independent question requires the final measured descending branch of each indent, its physical depth origin, and surface-to-floor depth at both sites from the independent scan. The prospectively fixed high-load window is 64/125 through 1 in force units normalized to peak load. If the source requirements were met, the score would average the two absolute errors after sorting both pairs. This is the minimum mean absolute matching error over the two possible assignments. No individual left/right or color assignment was imputed. No scientific force/height arrays or digitized plotted values entered the calculation.

Variation in effective contact area, time-dependent frame drift or creep, tip geometry and pileup can change the relationship between a displacement intercept and a scanned surface depth. Noncontact AFM has an oscillatory interaction and setpoint. The source did not establish an effective scan load for a correction here. A shift in the physical zero is a separate obstacle: observing `h_r + d + A t² + B t³` identifies only the sum of residual and offset. A shared unknown offset would cancel in the spacing of the two depths, but the two absolute depths require registration.

## Sharp high-load error bound

Let `t=(P/Pmax)^(1/3)`. Assume the displacement in one final unload obeys `h(t)=h_r+A t²+B t³` exactly, with a common physical zero. This is a residual-depth offset plus Hertz displacement and a linear-in-force compliance. Consider every point of `l ≤ t ≤ 1`, with pointwise measurement error of magnitude at most ε. Errors may be dependent and may have either sign. Treat A and B as unknown, with no finite upper bounds.

Set `q=(1−l²)/(1−l³)` and `F(t)=t²−q t³`. Both endpoints have the same value `m`; the positive derivative changes to negative at `c=2/(3q)`, so `M=F(c)` is the maximum. The polynomial `p(t)=1−2F(t)/(M+m)` equals 1 at zero and takes alternating values `+δ,−δ,+δ` at `l,c,1`, where `δ=(M−m)/(M+m)`. Its magnitude stays within δ throughout the observation interval.

Two unloading laws differing by `2 ε p(t)/δ` produce the same observations under opposite admissible errors. Both can have nonnegative coefficients after adding the same large enough common baseline law. Their intercepts differ by `2 ε/δ`. Conversely, three observation weights that reproduce 1 and annihilate both t² and t³ have signs +,−,+ and total absolute weight exactly `1/δ`. They achieve that worst-case error for every admissible noise function. The two arguments give the exact minimax multiplier `(M+m)/(M−m)`, including nonlinear estimators. With known B, subtract its contribution and use the two endpoint measurements to get `(1+l²)/(1−l²)`.

| Minimum P/Pmax | Minimum t | Unknown compliance | Known compliance |
| ---: | ---: | ---: | ---: |
| 0.125 | 0.50 | 5.86 | 1.67 |
| 0.512 | 0.80 | 53.82 | 4.56 |
| 0.729 | 0.90 | 240.48 | 9.53 |
| 0.857375 | 0.95 | 1,013.82 | 19.51 |

The 0.512 row was fixed as primary before source qualification ended. The other three rows illustrate design sensitivity. These are dimensional error multipliers, not confidence levels. They describe one conditional estimator problem and do not assign compliance, creep or elastic recovery to this instrument.

## Finite designs and reproducibility

Discrete sampling can increase the multiplier. For any three or more distinct positive load coordinates, choose the first, last, and the observed interior point that maximizes the same arch after equating the observed endpoints. These three weights attain the finite-design bound, and the alternating polynomial supplies its matching lower bound. A direct zero-load sample gives multiplier 1. With one or two distinct positive loads and unbounded unknown coefficients, the intercept has no uniform finite error bound. The solver accepts rational cube-root load coordinates so every bound it returns is exact.

Run from this directory with Python 3.

```sh
python3 replay.py
python3 intercept.py --lower 4/5
python3 sampling.py 4/5 9/10 1
```

`certificate.json` stores exact weights and extremizing polynomials. The independent reader solves separate rational systems for alternation and moment reproduction, checks 4,004 rational test locations, evaluates all 32 three-node noise corners, and constructs positive-coefficient indistinguishable laws. A further exhaustive comparison examines all 1,930 possible three-node rules across 80 fixed irregular synthetic grids, along with a zero-load anchor and a rank-deficient design. The analytic derivative and matching dual weights provide the continuous certificate.

**Sources**

- NIST dataset inventory and file descriptions. [Data.gov](https://catalog.data.gov/dataset/elastic-plastic-afm-indentation-on-copper)
- Stan and colleagues, experimental methods and Figure 5. [NIST manuscript](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=960439)
- Supporting information, §§3 and 7, with instrument fitting and tip characterization. [Author supplement](https://doi.org/10.1021/acsanm.5c05142.s001)
