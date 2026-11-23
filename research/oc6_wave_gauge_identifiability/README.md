# What can five OC6 wave gauges identify?

The OC6 Phase Ib basin study measured a bichromatic gravity wave at five longitudinal stations. The published difference-frequency expansion has six complex amplitudes. Four describe second-order interactions between the incident and reflected long and short waves. Two describe free waves propagating in opposite directions. We test which amplitudes the gauge geometry can distinguish and apply the result to the five measured complex ordinates published for wave B4.

## Sources and measurement scope

Wang et al. fitted three amplitudes to the five centerline gauges. Their Equation 7 gives the full six-wave basis. Table 4 gives the two primary reflection *magnitudes* for each wave. Figure 7 distinguishes five measured complex elevations (symbols) from the fitted field (lines). Robertson and Wang give the nominal forcing periods and three distinct sensor layouts. Fowler's instrument report places the ten-gauge wave checks at the end of the campaign, in a separate series. The five capacitance gauges shared the basin with the five resistance gauges during wave checks. Only the side line accompanied the column-load runs. Pooling all ten as a single longitudinal wave field assumes lateral uniformity, instrument compatibility and synchronized complex measurements. [Wang et al., 2021](https://doi.org/10.1016/j.oceaneng.2021.110026) · [Robertson and Wang, 2021](https://doi.org/10.3390/en14196417) · [Fowler, UMaine report 21-47-1860](https://wdh.energy.gov/api/datasets/oc6/oc6.phase1b/files/umaine-21-47-1860-nrel-deepcwind-rev0-20210405.pdf)

The original load question concerned whether pitching an isolated column by five degrees predicts the change in a column within the three-column assembly. The published experimental roster yields 74 relevant load-run records across D/F/P/Q/N/R and 15 separate wave checks. Two instrumented positions supply independent column loads. The symmetry reconstruction of the remaining column adds no measurement. Separate wave checks cannot establish the absolute phase of every load run. For a matched wave, an unrestricted assembly-by-pitch interaction enters only the pitched assembly and can take any value when only the other three conditions are observed. B1 and B3 repeat the same pair of periods at two forcing levels. They supply two distinct amplitudes at that pair.

The DOI resolves to Phase Ib. The OEDI 4474 page links onward to Phase Ia. The authoritative Wind Data Hub record lists public access and DAP download, whose client requires registration. We used ordinary public publications and catalog metadata. The raw time series and component-load outcomes remain unopened. The separate calibration figure below tests wave-elevation compatibility. It supplies no held load prediction or external validation of the three-amplitude benchmark. The exposed publication examples include two upright aggregate rows for B1/B2, rounded Table 4 primary reflection summaries and the B4 wave illustration. [Phase Ib archive](https://doi.org/10.21947/1775070) · [Data format](https://wdh.energy.gov/api/datasets/oc6/oc6.phase1b/files/oc6-phase-ib-data-format.pdf)

## The missing coefficient and the reflection relation

For the nominal full-scale water depth of 250 m, solve $gk\tanh(kd)=\omega^2$ at each parent and at their difference frequency. With short-wave and long-wave numbers $k_2,k_1$, write the six longitudinal modes as the forward/backward pairs at $k_b=k_2-k_1$, $k_d=k(\omega_2-\omega_1)$, and $k_p=k_2+k_1$. Multiply the model-scale sensor distances by 50. Wang's forward convention uses $e^{-ikx}$. Reversing all signs preserves the geometry-only norms. The complex-observation calculation uses Wang's sign.

Let $A_0$ contain all columns except the backward bound wave $v$. The five retained columns are numerically independent at each of the 15 printed designs. The six-mode solutions for gauge measurements $y$ obey $a_-=t$ and $a_{\rm keep}=b-ut$, where $b=A_0^{-1}y$ and $u=A_0^{-1}v$. Conjugating a null vector and exchanging forward/backward members preserves the null space. When the null space has complex dimension one, applying this operation twice gives the original vector. The exchange therefore preserves the absolute magnitude of each pair. In particular $|u_1|=1$ for the normalized missing bound component.

For a longitudinal bidirectional wave at second order, suppose reflection of **both** parent directions through the vertical plane preserves the scalar elevation kernel. For complex measured parent reflection coefficients $r_1,r_2$ referred to the same origin, the co-propagating bound waves then obey $t=\gamma a_{b+}$, where $\gamma=r_2\overline{r_1}$. This assumes the incident and reflected waves share the same transfer kernel under reversal. It does not extend to a body-load transfer function in an arbitrary configuration. If $|\gamma|=\rho<1$, then

$$a_{b+}=\frac{b_1}{1+\gamma u_1},\qquad |a_{b+}-b_1|\le\frac{\rho}{1-\rho}|b_1|.$$

The bound is sharp over unknown reflection phases. The target's amplification of uniform complex errors at the five probes lies between $\|(A_0^{-1})_{1,:}\|_1/(1+\rho)$ and $\|(A_0^{-1})_{1,:}\|_1/(1-\rho)$. Both phase endpoints are attainable. The B2 product of the printed primary reflection magnitudes is .001677, the largest in Table 4. Even allowing half a final printed percentage unit in either direction, the largest resulting correction to the five-mode target is under 0.173%. This relative bound concerns turning on the backward bound coefficient in a model *already retaining both crossed waves*. It says nothing about discarding the crossed waves.

| Wave | Three-mode condition number | Five-mode condition number | Three-mode coherent alias | Five-mode target noise gain, maximum | Pooled ten-probe condition number |
|---|---:|---:|---:|---:|---:|
| B1 | 1.057 | 2.237 | 1.686 | 1.046 | 43.53 |
| B2 | 1.390 | 4.629 | 1.109 | 2.089 | 20.51 |
| B3 | 1.057 | 2.237 | 1.686 | 1.046 | 43.53 |
| B4 | 7.825 | 18.843 | 3.000 | 4.750 | 357.50 |
| B5 | 7.262 | 65.709 | 1.106 | 3.876 | 54.99 |

The first four columns use the five centerline wave-check probes. Coherent alias is the exact worst target bias from three omitted unit-bounded complex waves, with phases chosen to align at the target estimator. Actual source amplitudes and coherent alignment are unknown. The noise gain allows each complex gauge error to lie in a unit disk. For example, B4's three-mode target noise gain is 1.764 while its five-mode counterpart reaches 4.750. A more flexible representation can amplify measurement error. The conditional ten-station calculation pools printed positions from both lines. Increasing the number of formal equations does not establish lateral wave-field equivalence.

All computations use the printed nominal periods and coordinates at $g=9.81$ m/s². The authors separately allowed primary wavenumbers to vary by up to 1.5% when fitting primary waves. Their survey instrument uncertainty and basin depth uncertainty are distinct from decimal printing and dispersion-model errors. The included half-last-digit sensitivity has an inconclusive smallest-singular-value bound for B5. It cannot certify conditioning of the actual acquisition. The independent implementation compared all 90 complex null-vector entries after common normalization (maximum absolute difference $2.06\times10^{-13}$). The 480 direct fixed-phase inverse computations match the one-row formula within $1.33\times10^{-14}$.

## One measured wave check

In B4 the five readings can be checked against a second symmetry condition. Under horizontal reversal the two counterpropagating parent-pair elevation kernels also coincide. Denote the short-wave and long-wave reflection magnitudes by $R_2$ and $R_1$. The crossed component at $+k_p$ is proportional to the long-wave reflected parent, whereas the component at $-k_p$ is proportional to the short-wave reflected parent. Their necessary modulus relation is $|a_{p+}|=(R_1/R_2)|a_{p-}|$. Its common factor cancels even when its absolute value is unknown. We require the co-bound and this crossed constraint simultaneously and leave both free waves unrestricted.

The first relation fixes a circle in the single complex null coordinate $t$. On that circle the squared difference $|a_{p+}|^2-(R_1/R_2)^2|a_{p-}|^2$ is a constant plus one sinusoid. Its minimum and maximum therefore follow without searching over phase. Degenerate lines, points and a constant second residual are handled by using the latter relation directly on the first circle. The two magnitude relations are necessary conditions. Intersections, if they exist, can have multiple phases, and by themselves would not establish a full physical realization.

The raster in the original paper is PDF object 234 on printed page 10. It is 1,446 × 514 pixels. The extractor locates the full black axis frame, learns each symbol shape from the three separate legend keys, and compares all vertical locations near each surveyed gauge. Fitted lines are never used as measured ordinates. At the first gauge the black magnitude diamond partly covers the blue real-part dot. Nineteen blue template pixels remain visible there, and no second vertical location more than seven pixels away passes even the minimum overlap. Numerical extraction rules and all competing symbol scores are in the replay.

| Full-scale station x (m) | Plotted real (m) | Plotted imaginary (m) | Plotted magnitude (m) |
|---:|---:|---:|---:|
| −247.95 | 0.01950 | 0.00165 | 0.01950 |
| −124.45 | 0.02655 | −0.01000 | 0.02827 |
| 2.55 | 0.00957 | −0.00755 | 0.01201 |
| 125.55 | 0.00007 | −0.01245 | 0.01216 |
| 248.55 | −0.02309 | −0.00137 | 0.02295 |

The maximum disagreement between a separately plotted magnitude and the magnitude computed from its two components is 0.000288 m. Using nominal dispersion, the three-mode fit recovers 0.013215 m for the forward bound wave and 0.025736/0.024872 m for the two free waves. The three magnitudes round to the authors' 0.013/0.026/0.025 m. This is a check on the source and extraction. The center positions read from the graph are within 0.30 m full scale of the nominal stations.

**The two reflection constraints conflict with the plotted B4 field.** At the stated nominal positions the entire squared crossed-residual range is positive, from 0.0001244033 to 0.0001244151 m². Every compatible five-station field would need at least one complex elevation to change by 0.004570 m. With the graph-derived positions the lower bound is 0.004588 m. The unrestricted square inverse can interpolate all five phasors, so its zero residual provides no independent evidence.

For uncertainty propagation we allow each of the two published Table 4 reflection magnitudes to move by half a printed step, either parent period to move by 0.005 s, each longitudinal station to move by 0.005 m of decimal rounding plus 0.0015 m of survey error at model scale, and depth to move by 0.025 m at full scale. The resulting lower bound on required complex-gauge error is 0.0028471 m. Allowing a further independent ±1.5% shift in each parent wavenumber initially gives an inconclusive one-box calculation. Covering those same two intervals with all 256 rectangles gives a numerical worst lower bound of 0.00241037 m.

A second implementation independently verifies that complex-gauge changes of **0.0024 m or less cannot suffice anywhere in this extended input box**. It brackets the finite-depth dispersion roots from rational period/depth limits using interval arithmetic. For each rectangle it forms $s$, the five retained amplitudes, and chooses a binary64 matrix $R$ as a trial left inverse. The residual $I-RA_0$ is carried into an entrywise nonnegative error bound. For $b=Ry$, this yields $|s-b|\le M|s|+g\epsilon$. The proof checks an explicit positive vector $S>|b|+MS+g\epsilon$ at 55 decimal digits with outward-rounded intervals. This bounds $|s|$ componentwise. Every rectangle then satisfies $|b_{p+}|-\ell|b_{p-}|>(MS+g\epsilon)_{p+}+\ell(MS+g\epsilon)_{p-}$ with $\ell$ the upper reflection-ratio bound. The smallest verified excess is 0.0000418430 m. The proposed floating inverse and vector need only pass these inequalities.

An eight-pixel vertical center allowance in either direction covers the half-height of the largest legend mark. Adding one pixel of independent uncertainty to each vertical frame endpoint permits at most $\sqrt{2}(0.06)(8+1)/(417-2)=0.00184018$ m of complex ordinate error. The 0.0024 m exclusion exceeds this explicit graphical allowance. Actual sensor calibration, time-window mismatch, departures from a longitudinal bidirectional field and higher-order effects remain outside the box. Experimental uncertainty in the five complex elevations was unavailable. One selected published wave-check figure cannot determine the cause, verify a new component-load prediction, or stand in for a held basin campaign.

## Reproduction

Run with Python, NumPy, Pillow, PyMuPDF and mpmath. The command reads the public article PDF or its exact embedded JPEG, verifies the source hash, rebuilds the geometry for all five conditions and three layouts, digitizes the figure, checks the equalities, and verifies all 256 interval witnesses. Synthetic positive, corrupted-crossed-wave and zero-reflection controls run separately.

```sh
python research/oc6_wave_gauge_identifiability/replay.py --paper /path/to/wang-2021.pdf
```

The script also accepts `--jpeg /path/to/figure7-original.jpeg`. The source paper SHA256 is `efbd30a6cf641ef57024f09ce6a989d28e196f0c04204b0366d6440beda238dd`; the embedded JPEG is `c232830c94c3a8ad0effb88a1439bd51ddc20de880af7a8e7be0d4fd6570c8ab`. Only the derived numerical readings and replay code are redistributed. [Public paper PDF](https://wdh.energy.gov/api/datasets/oc6/oc6.phase1b/files/wang-oc6-1b-valid-of-cfd-pred-of-diff-freq-wave-excitation-on-fowt-semisub.pdf)
