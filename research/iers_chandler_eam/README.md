# A fixed equatorial shape in a Chandler-response hindcast

An independently oriented elliptical response reduced mean yearly pole-position RMSE from **35.690975 to 35.582494 milliarcseconds (mas)** across 2015–2024, an improvement of **0.108480 mas, or 0.30%**. It beat the matched isotropic and 90°-rotated models in all ten calendar years and passed the predeclared joint gate. The measured improvement is small beside the absolute position error. Every hindcast starts from that year's observed January 1 pole and uses realized atmospheric, oceanic, land-water and sea-level forcing through the year.

| Frozen model | Mean yearly RMSE (mas) | Years won by the fixed ellipse against this role |
| --- | ---: | ---: |
| EGM2008-oriented ellipse, fitted mean/trend/annual excitation | 35.582494 | — |
| Isotropic response, same forcing and fit | 35.690975 | 10/10 |
| Ellipse rotated 90°, same forcing and fit | 35.800133 | 10/10 |
| Isotropic published-period kernel with fitted mean excitation only | 121.568739 | 10/10 |
| Annual, trend and free mode without fluid forcing | 42.432756 | 6/10 |
| Anchored linear trend and annual position fit | 61.041771 | 9/10 |
| January 1 persistence | 166.040760 | 10/10 |
| Development-fitted multiplier on the elliptical correction | 36.063748 | 10/10 |

## Where the models fail

Across the twelve development years (2003–2014), the orientation ranking ran the other way. The ellipse scored 13.473154 mas, the isotropic model 13.460300 and the rotated ellipse 13.451634. Fitting a scalar multiplier on the elliptical correction to development trajectories gave −3.398158 and a development score of 13.447135 mas. That control degraded on the later decade. The annual/free model without the fluid forcing won in 2016, 2017, 2022 and 2023. In 2022 it achieved 24.812027 mas against the fixed ellipse's 49.115279 mas.

The largest daily error for the candidate occurred on 2024-08-23. In the east-positive terrestrial frame the measured pole was (201.355, −458.204) mas, versus the elliptical prediction (147.990, −525.176) mas. The radial errors at that same date were 85.633, 85.789 and 85.945 mas for the ellipse, isotropic and rotated models. The released score includes both coordinates of every model at the worst date in every year and its surrounding dates. The full forecasts and 3,643 measured dates support independent reconstruction of every residual.

## Input and measurement contract

The target is the stopped IERS 20 C04 0h UTC series in ITRF2020, ending 2025-05-05. Its 5,067,517 bytes have SHA-256 c17ba033b94de0b227250cad22f5ae41cfe03af4a049d46efa66b47872a42e27. The complex position uses C04 x minus i times C04 y. GFZ excitation uses its own x plus i times y, converted from dimensionless radians to mas. The operational GFZ v1.0 AAM and MPIOM OAM contain mass and motion components at 00, 03, …, 21 UTC. AAM already includes an inverted-barometer correction and OAM a global-mass correction. Twelve tidal terms were removed in the product processing. HAM v1.2 supplies daily mass and motion components, SLAM v1.2 a mass contribution only. The HAM header describes midnight while **both its hour field and its MJD record noon**. Each civil day's eight AAM/OAM samples were averaged and combined with that day's one HAM/SLAM sample. Each model used the resulting excitation as constant over that civil day. This common aggregation convention leaves the precise averaging window of the original physical fields uncertain.

The atmosphere and modeled ocean share weather forcing. We excluded the GFZ G-AHS residual, which is constructed by deconvolving geodetic C04 itself, along with GAM and forecast products. GFZ inputs had their own release-specific reference means removed. The source-only nuisance terms therefore matter. They comprise a mean, linear trend, annual sine and annual cosine in each coordinate, fitted separately within each model by year-balanced least squares. Only the January 1 C04 coordinate in each target year entered initialization. No subsequent response was used to reset the free mode, choose a coordinate sign or fit a coefficient. The trusted reader hashed the whole C04 text before selecting permitted response columns.

## Dynamics and interpretation

The IERS equation is χ = p + (i/σ) dp/dt. With T=434.2 days and Q=179, take σ=(2π/T)(1+i/(2Q)). The isotropic one-day step for constant χ is p₁ = χ + exp(iσ)(p₀−χ). The observed Chandler period is already embedded in the GFZ product conventions, so this calculation does not independently estimate it. The continuous IERS equation supplies the reference operator. We integrate it forward with our explicit daily aggregation. The IERS online geodetic-excitation deconvolution has a separate filtering convention.

From Chen et al.'s zero-tide EGM2008 moments A=8.0100829, B=8.0102594 and C=8.0364807 in units of 10³⁷ kg m², the linear rigid equatorial mode has axial ratio r=√[A(C−A)/(B(C−B))]=1.003348886. The counterrotating-to-corotating free amplitude ratio is 0.001671644. The candidate transformed the isotropic propagator E to SES⁻¹, with S stretching by r along the second principal axis and orienting the first at longitude −14.928509°. This reduced model preserves the measured-period convention while imposing a rigid-body shape. Chen et al.'s full nonrigid theory includes frequency-dependent pressure and motion response, elastic mantle, fluid core and compliances. Their published historical comparison already reported different rankings for spectral and time-domain errors. We did not implement that complete theory or test its superiority.

At time t with matched initial state and constant excitation, the exact operator norm of the shape correction is exp[−πt/(TQ)] |sin(2πt/T)| (r−1). For changing piecewise-constant excitation, successive forcing jumps superpose with their individual propagation times. This bound applies when the nuisance excitation is held fixed. Across the deployed roles, which each had their own source fit, the RMS separation from the isotropic predictions was only 0.081–0.334 mas per year.

An **exploratory postscore diagnostic** crossed the two frozen sets of nuisance coefficients with the two frozen propagators, with no refitting. Averaging both orders of substitution, the geometry change reduced mean yearly RMSE by 0.118869 mas, while the fitted-coefficient change increased it by 0.010389 mas. These finite differences explain the recorded 0.108480 mas gain under the stated model choices. They cannot identify a mechanical origin. For any candidate invertible generator L and trajectory obeying dp/dt=L(p−χ), an unobserved excitation component can absorb a change of L through χ=p−L⁻¹dp/dt. Ten successive years of one Earth record are dependent comparison units. This result concerns a retrospective conditional hindcast with observed boundaries and realized inputs.

## Verification

The protocol and kernel were frozen at 77ca12da6715cc36be904af5e970eba1fbbbda6a. All 89 input file digests, covering 28,989,183 bytes, preceded the first source fit at 362cccf00fd75bda64adc6b1c88b7ba8ebb16c5d. The 388,125-byte forecast archive was locked at f172d3592bf0bbe4e1ef4ccb36bf4e8446849932 with SHA-256 340e1d29d668a8ded4764ff878a01b06dbd63a6223c86279e9464edd5b2aa3a8. Each year contributed one score, the square root of its mean squared two-coordinate distance from January 2 through December 31.

A separate standard-library receiver authenticated all 89 public files, grouped their original date/hour fields, and reconstructed all 58,288 scalar forecasts from the frozen source coefficients using complex scalar dynamics. It then checked 7,286 held coordinate values, all 80 role-year scores and every worst-date index. The largest two-coordinate forecast disagreement was 1.63×10⁻¹¹ mas and the largest score discrepancy was 1.57×10⁻¹³ mas. It did not independently refit the development regressions. The initial document intake retained its 3 MB refusal for the 16,680,474-byte product description. The subsequent source-only original authenticated the complete document.

Run `python3 replay.py` for the offline held-score and algebra replay. Run `python3 cold_recount.py` for full public-input retrieval and an independent trajectory reconstruction. The source fitter requires NumPy 2.2.6.

[Official IERS excitation equation](https://hpiers.obspm.fr/eop-pc/analysis/excitactive.html) · [Stopped C04 product](https://datacenter.iers.org/versionMetadata.php?filename=latestVersionMeta/234_EOP_C04_20.62-NOW234.txt) · [GFZ product definition](https://rz-vm480.gfz.de/files/ESMGFZ/EAM/ESMGFZ_EAM_Product_Description_Document.pdf) · [Geodetic-residual provenance](https://isdc.gfz.de/ggfc-oceans/gahs) · [Chen et al., 2010](https://doi.org/10.1029/2009JB007094)
