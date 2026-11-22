# Testing two release laws for water–glycerol drops on textured aluminum

The law that releases the drop when its modeled contact force reaches zero lost to both a zero-deformation release law and a seven-input Gaussian process. The comparison held out four complete surface geometries. A second result concerns the published event definition. The accompanying paper excluded 132 drops without a definitive rebound, but the released textured-surface CSV has positive contact duration and energy values in **all 1,498 rows** and supplies no event-status column. Its values support a comparison of the archived endpoints. They cannot identify the authors' 1,366-event cohort.

## Whole-surface comparison

The authors varied grid pitch (50, 100, 200, 400, 600 and 800 μm) and approximate groove depth (6 and 25 μm). Five release heights and five water–glycerol mixtures supplied variation in impact speed and liquid properties. We used both depths at pitches 50, 200 and 800 μm for training (748 drops), both 400 μm surfaces for development reporting (250), and both depths at 100 and 600 μm for the final comparison (500). All 750 untrained rows were predicted and locked in the same archive before either set of recorded endpoints was decoded. The separate smooth-surface release has 125 rows and neither endpoint column. Those rows are accounted for as endpoint-unavailable.

The table shows root-mean-square error on the recorded values. Mean gives each of the four final geometries equal weight. Worst is the largest of their four errors. Height-derived energy is dimensionless.

| Fixed model | Mean duration (ms) | Worst duration (ms) | Mean energy | Worst energy |
|---|---:|---:|---:|---:|
| Zero force | 2.917 | 5.220 | .03570 | .04771 |
| Zero deformation | 2.529 | 4.639 | .03165 | .04166 |
| Author-family isotropic exponential GP | **2.500** | 4.548 | **.02432** | **.03803** |
| Dimensionless-input isotropic exponential GP | 2.564 | **4.422** | .02541 | .04173 |
| Capillary clock and mean energy | 3.059 | 5.340 | .10603 | .10840 |

The primary rule required the zero-force arm to beat each of the four controls on all four measures. It passed 4 of 16 comparisons, all against the elementary clock and mean energy. It passed 2 of 16 comparisons on the two development surfaces. The independent reader recomputed 14,980 residual terms, 120 surface errors and all 48 split-specific comparison decisions. The largest numeric discrepancy was $1.39\times10^{-17}$.

Both largest absolute misses for zero force occurred on the deep 600 μm grid. CSV line 1103 records **35.6 ms**, compared with **14.157 ms** predicted by zero force and **17.917 ms** by the seven-input GP. Line 920 records energy **.04719**, compared with **.16743** and **.15802**. These are different drops. The original evidence files retain each input vector, prediction, recorded outcome and worst-error identity by geometry and model.

## What the instrument measured

The authors' 5,000 fps camera identified contact with the surface and the first separated silhouette. Their energy metric uses the apex height of the estimated center of gravity *above the surface* and the kinetic energy immediately before impact. Under a vertical ballistic approximation with incoming speed $u$, it is

$$\eta = v_{z,\mathrm{out}}^2/u^2 + 2 g h_{\mathrm{detach}}/u^2.$$

An unknown detachment height, lateral rebound motion and flight losses prevent interpreting $\sqrt\eta$ as a measured velocity restitution coefficient. Already on training, 98 of 748 reported apex heights inferred from $\eta u^2/(2g)$ fell below the initial spherical radius. The smallest ratio was .46692 for line 1409 (deep 800 μm), with an inferred apex height of .54534 mm and initial diameter 2.33590 mm. This rejects a universal assumption that the center detaches at one initial radius. Its cause is unresolved by the release.

## The two release models

Both arms start with the same underdamped effective mode $x''+2\zeta\omega_0x'+\omega_0^2 x=0$, $x(0)=0$, $x'(0)=u$. With $\omega_d=\omega_0\sqrt{1-\zeta^2}$, the first return to zero deformation has duration $\pi/\omega_d$. The first zero of the modeled spring-plus-dashpot force has duration $2\arccos(\zeta)/\omega_d$. In both cases the outgoing-to-incoming vertical speed ratio is $\exp(-\zeta\omega_0 T)$. At a fixed natural frequency increasing damping lengthens the zero-deformation duration and shortens the zero-force duration.

Each arm fitted one shared mapping across six training geometries. Natural frequency scales with $\sqrt{\sigma/(\rho R^3)}$. Its multiplier depends on log pitch, groove depth and their interaction. Damping also depends on the Ohnesorge and Weber numbers, with a nonnegative viscosity coefficient at fixed remaining predictors. A single fitted nonnegative multiple of $R$ supplies an effective detachment-height term. Its zero-force fit reached the lower boundary. That coefficient is a modeling parameter and was never measured independently. The joint fit used duration and energy together, with each residual scaled by its training standard deviation. Each model has 11 coefficients and three fixed optimization starts. No per-drop parameters were fitted on held data.

The mandatory GP uses exactly the seven pre-impact predictors from Jereb et al., training-only standardization, an isotropic exponential kernel, and separate likelihood-fitted regressions for each recorded endpoint. Their published study selected this family among 28 MATLAB candidates and performed 100 Bayesian optimization iterations on the whole data set. Our fit runs in SciPy on the six training geometries. It reproduces the model family without importing the published fit or exposing held rows to its tuning. A separate GP uses dimensionless and capillary inputs derived from the same seven variables.

## Sensitivity to the missing event labels

Every textured row remains in the primary numerical score. The released smooth CSV ends with spreading coefficient and lamella velocity. It supplies no contact time or energy and gives no basis for declaring its 125 drops non-rebounds. The archive also reports training-smoothed forecast of file-field availability ($748.5/749$) for all rows. This quantity cannot assess physical rebound classification.

If the paper excluded exactly 132 of these 1,498 rows, there could be 368–500 definitive final events and 0–125 in any one final geometry. To quantify the effect without assigning labels, the independent reader sorts the paired squared-error differences in the final 500 rows. Removing the 132 most favorable or unfavorable differences gives sharp extrema for the **pooled** mean over the retained rows. Every other eligible omission count lies between those limits. For zero force minus the author-family GP the interval is **[+.00009699, +.00109094]** for energy MSE. The energy loss survives every such exclusion. Duration MSE ranges from **−2.12417 to +6.84907 × 10⁻⁶ s²**, so its sign can change. These per-endpoint extrema can use different masks. They are a sensitivity calculation separate from the registered equal-surface score.

## Running the original comparison

The two organizer CSVs, complete pre-opening forecasts, all surface scores and independent recount are distributed as their original CSV and JSON files. Each file is SHA-256 verified before replay. The first command uses the Python standard library. The second also reruns the training-only fits and compares every predicted value with the frozen archive. The original fitting run used NumPy 2.2.6 and SciPy 1.15.3. The full original forecast hash and numerical refit agreement are reported separately.

```sh
python replay.py
OPENBLAS_NUM_THREADS=1 python replay.py --refit
```

Može, Jereb, Lovšin, Berce, Zupančič and Golobič released the organizer data under CC BY 4.0. The original read-only forecasts required 3.29 s of model fitting on one CPU after installation. `provenance.json` records acquisition failures, the source-only projections, the pre-opening lock and all original scientific receipts.

[Organizer dataset and licence](https://doi.org/10.17632/wsh8rxwd38.1) · [Measurement and image-reduction methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC12163178/) · [Jereb et al. regression study](https://doi.org/10.3390/biomimetics10060357)
