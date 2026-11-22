# Can paired precipitation gauges recover the reference accumulation?

A paired catch model missed its prespecified 5% RMSE improvement in both available second-winter site records. The original three-site test could not be scored. At Bratt’s Lake no second-winter half-hour met the published missing-minute requirements. Seven external site-winters stayed sealed for precipitation outcomes.

| Second winter, 2016/17 | Qualified half-hours | Paired model RMSE, mm | Strongest control RMSE, mm | Ratio (required ≤0.95) |
|---|---:|---:|---:|---:|
| CARE, Canada | 8,608 | 0.054868 | 0.055355, unpenalized paired projection | 0.991218 |
| Marshall, United States | 10,104 | 0.052473 | 0.052248, mean of the two published Eq. 4 adjustments | 1.004316 |

The reference was a double-fence automated reference (DFAR) weighing gauge. The predictors were simultaneous unshielded (UN) and single-Alter (SA) weighing gauges, gauge-height wind, air temperature, and the four adjustments that the data authors published for those gauges. Each estimate uses observations over the same preceding 30 minutes, identified by its GMT end time. It estimates an instrument reading retrospectively. Absolute precipitation and hydrometeor phase were unobserved. Smith et al. had already evaluated the published adjustments at these sites. The new comparison concerns the incremental information in the difference between two gauge responses. The empirical catch curves came from earlier winters and include these sites in their historical calibration. [Post-SPICE measurements](https://doi.org/10.1594/PANGAEA.907379) · [Smith et al., evaluation](https://doi.org/10.5194/hess-24-4025-2020) · [Kochendorfer et al., transfer functions and Table 3](https://doi.org/10.5194/hess-21-3525-2017)

## Which intervals can answer the question?

The released archive covers eight sites in two winters. The primary registration required the primary R2 reference and same-make R3A and R3U channels, finite gauge-height wind and air temperature, and gauge-height Eq. 3 and 4 fields for both comparison gauges. All five gauge/weather missing-minute flags had to be explicit zeros. A preceding gap can cause a reported accumulation to span more than one interval. Blank flags therefore supply insufficient evidence of complete contemporaneous support.

Thirteen of 16 site winters had the required channel headers. Formigal lacked the complete configuration in both winters and the first Caribou Creek release lacked the matching primary pair. Bratt’s Lake, CARE and Marshall 2015/16 provided 6,573, 7,921 and 10,178 fitting intervals, respectively. Later winters at those same sites formed the registered development set. Bratt’s Lake 2016/17 had all three raw precipitation cells present on 9,376 rows. On 9,370 of them all three gauge flags were blank. The other six contained a positive flag. Marshall’s second file included 48 timestamps from the first file’s nominal winter, after the May 2017 ending in publisher order. All 48 were excluded from the second-winter score. The acquisition audit retained the initial monotonic-order refusal and tested timestamps explicitly in a separate receiver. An overlap in clock identities establishes neither equal readings nor a recoverable corrected year.

The complete three-site comparison is unestimable. The partial two-site diagnostic was frozen separately before either later-winter target was decoded. No diagnostic result could open the remaining eligible site-seasons (Caribou Creek second winter and both winters at Haukeliseter, Sodankylä and Weissfluhjoch). Availability and weather could be inspected there. Numerical reference, raw catch and adjusted catch remained unopened. All rows within a site share a measurement system and weather history. The ratios are two site-winter summaries without an independent-row confidence interval.

## What the pair can identify

Under the proposed two-endmember model write the catches as U=L+e_U S and A=L+e_A S. Here L and S are nonnegative model amounts. Unit catch for the first endmember and the historical solid-group efficiency for the second are assumptions. For gauge-height wind u clamped to [0,7.2] m/s, the respective efficiencies are min(1, 0.860 exp(−0.371u)+0.229) and min(1, 0.728 exp(−0.230u)+0.336).

For distinct responses, the total is [(e_A−1)U+(1−e_U)A]/(e_A−e_U). If each gauge error has absolute size at most δ, the unrestricted inverse total error is at most δ times (|1−e_A|+|1−e_U|)/|e_A−e_U|. Oppositely signed errors attain this linear bound. The multiplier reaches about 6.63 at the wind cap. It excludes uncertainty in the response curves, local exposure, timing and the DFAR itself. At equal unit efficiencies the noiseless total is identified directly even though the partition is arbitrary; averaging the two readings gives error at most δ. For equal efficiency e strictly between 0 and 1 and a common positive noiseless catch y, all totals in [y,y/e] are feasible. The model has no independent validation of liquid or solid amounts.

We minimized squared gauge errors plus λ[S−π(T)(L+S)]², with π(T)=clip((2−T)/4,0,1). Temperature supplies a soft historical convention. Six fixed penalty values were compared by equal-site mean RMSE on the three first-winter fitting records. The selected value was 0.01. The other 13 methods comprised three raw controls, four publisher adjustments, two equal-weight adjustment pairs, nonnegative linear stacking, gradient boosting, the unpenalized model and fixed temperature partitioning. The two fitted statistical controls received equal total weight per fitting site. The boosting model used the same eight observed and derived predictors. No method received a later-winter reference or earlier reference as a predictor. For each site, the benchmark in the table is the lowest observed RMSE among all 13 controls. The preserved source and result files include every comparator.

## Where information was missing

In the first winter the DFAR accumulated 9.25, 13.71 and 7.86 mm at Bratt’s Lake, CARE and Marshall on intervals when both comparison gauges reported zero. On 2015-10-02 at Marshall, the half-hour ending 21:30 GMT had a 2.74 mm reference and two zero catches. Conversely, on 2015-11-11 at 15:30 GMT the reference was zero while the two gauges recorded 0.57 and 3.07 mm. The best source control at that site, the shielded Eq. 3 adjustment, returned 3.22 mm. A catch-only inverse forced to zero for zero catches cannot recover all of those reference events.

In the later CARE record, the reference accumulated 24.86 mm on both-zero intervals, including 1.96 and 1.87 mm at 07:00 and 07:30 GMT on 2016-11-03. The paired estimate totaled 445.01 mm across qualified CARE intervals against 468.28 mm in the reference. At Marshall, 2017-04-05 at 14:30 GMT, the unshielded and shielded gauges recorded 1.05 and 3.09 mm, the paired model gave 2.36 mm, and the reference was zero. Earlier that day the same model estimated 0.64 mm against 2.62 mm. The qualified-interval Marshall totals were 202.70 and 194.98 mm, respectively. These readings identify disagreement across instruments without assigning its physical cause.

## Reproduction

From a clean checkout, run the following with network access to PANGAEA. The receiver fetches the genuine publisher headers, validates header and QA support across all sites, authenticates 13 eligible raw member byte streams, and parses numerical precipitation only for the five explicitly permitted site-seasons. Fourteen methods yield 261,968 estimates over 18,712 diagnostic half-hours. A second parser checks every diagnostic clock and all input values. SciPy NNLS independently recovers the two paired projection arms. The independent receiver recomputes all 84 site/method/stratum RMSEs from the individual estimates. On the original, the largest projection difference was 1.04e−13 mm and the largest RMSE difference was 5.56e−17 mm. Public observed.json includes all 28 all-row method/site RMSE values, candidate and strongest-control strata and worst intervals, source worst examples, training lock and support manifest.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
uv run --no-project --with numpy==2.4.6 --with scipy==1.17.1 --with scikit-learn==1.9.1 \
  python research/post-spice-paired-gauges/replay.py /tmp/post-spice-replay
```
