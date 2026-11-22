# Can gust order and recent particle arrivals improve a two-second sand-detection forecast?

The detailed predictor lost to boosted trees using two-second summaries on both later field dates. Its Brier score was 54.4% higher at Jericoacoara and 12.4% higher at Rancho Guadalupe. The first date had only one interval with no detected particles and the second had 26. These records give little evidence about long periods of intermittent transport. The registered rule stopped the study before any Oceano signal was opened.

## Measured comparison

Each forecast asks whether any retained Wenglor counter records a particle in the next two seconds. A forecast uses the previous 60 seconds from the same half-hour. Previous target intervals become observed history for later forecasts. Wind inputs are horizontal speed at the lowest released U1 anemometer; particle inputs are integer detections, pooled across the counters available in that block. No calibrated flux is an input. The reporters and wind sensors have different sampling volumes. The field study documented vertical separations of about 0.2–0.5 m and a spanwise separation of about 1 m at these two sites. A zero is a counter observation. The experiment does not determine the instant at which individual grains start or stop moving.

| Later field date | Half-hours | Active / scored intervals | Coarse boosted Brier | Gust + arrivals Brier | Coarse boosted log loss | Gust + arrivals log loss |
|---|---:|---:|---:|---:|---:|---:|
| Jericoacoara, 20 Nov 2014 | 4 | 3,479 / 3,480 | 0.00018764 | 0.00028966 | 0.00073339 | 0.00087313 |
| Rancho Guadalupe, 24 Mar 2015 | 7 | 6,064 / 6,090 | 0.00187433 | 0.00210648 | 0.00597853 | 0.00633903 |

The predictor had to reduce Brier score by at least 5% relative to every control on each date, and match or lower the best control’s equal-date log loss. It passed neither requirement. The reversed-wind control scored 0.00031347 and 0.00209611. Thus the true gust order helped against that particular control at Jericoacoara and lost at Rancho Guadalupe. Equal weighting applies to half-hours within each date. Neighboring forecasts share 58 seconds of history. The two dates and 9,570 intervals are reported without an independent-sample uncertainty interval.

At Jericoacoara, 226 seconds after 10:10, the candidate predicted 0.83970 after two particles in the preceding two seconds. It then received zero; the observed wind rose from 6.09 to 8.84 m/s across the ten 0.2-second means of the scored bin. At Rancho Guadalupe, 692 seconds after 13:31, five prior detections were followed by zero despite a forecast of 0.89459. The scored wind fell from 7.15 to 5.06 m/s over those two seconds. These future winds describe the misses and were unavailable to the forecasts. The replay retains all ten models’ predictions, every issue key, and the full wind/count traces around their six worst errors on each date.

## Why test the order of events?

A diagnostic on two earlier dates exposed a limitation of the two-second summaries. At Rancho Guadalupe the boosted forecast was 0.999523 after 25 particles spread across five counters as 12, 5, 4, 3 and 1. Wind reached 8.94 m/s in the preceding two seconds, but the last 0.2-second average fell to 6.88 m/s and the last particle arrived 0.36 seconds before issuance. The next bin was empty. All four largest training-date errors had no particles in the last 0.2 seconds. A shape-inspection script initially printed five measurements each from two already-designated fitting blocks. Those rows and the diagnostic informed the mechanism; they are excluded from the later-date comparison.

All four source clocks were read from the files at 25 Hz. Hours, minutes and seconds determine the tick. The extractor rejects off-grid and duplicate ticks; missing or nonfinite past inputs or target counts exclude that issue for all methods. The first 30 bins of each block have insufficient history. All remaining 870 bins of each of the 34 half-hours qualified. Calendar date and site name select the split and weights. They are absent from predictor features. Instrument count and sonic height are available to every fitted arm.

The training set consists of 23 half-hours at Jericoacoara on 13 and 14 November 2014 and Rancho Guadalupe on 23 March 2015, yielding 20,010 training issues. Fit weights give each site, then each date within site, then each block within date equal weight. The gust model uses excess squared horizontal speed above training quartiles of 7.272, 8.198 and 9.133 m/s, decayed with 0.2, 0.6 and 2 s time constants over four seconds, plus uninterrupted exceedance lengths. Arrival features comprise the last detected pulse age and the count and occupancy across five trailing intervals. The candidate adds both sets to a standardized ridge-penalized logistic model using the coarse summaries. These are velocity-history descriptors; no bed-shear or grain-scale force was measured here.

Controls include constant training prevalence, 95/5 persistence, coarse logistic and boosted trees, logistic and boosted models receiving twenty ordered 0.2-second speed/count pairs, arrival-only and gust-only additions, and a joint model reversing wind order within each two-second bin while preserving the arrival sequence. The model families had identical access to source instruments. Only their representation and estimator differ. All settings were fixed before the two later dates were scored. The outside-site archive contains a further 120 Oceano half-hours on 12 dates. The development decision gives no estimate of performance there.

## Published minute-level threshold analysis

Martin and Kok’s source workbook reports activity and effective wind thresholds for whole minutes. These aggregate quantities use wind and arrivals during the minute being analyzed; they cannot serve directly as prospective next-bin probabilities. The separate receiver evaluates the published Poisson false-negative correction from the released counts, and projects the lowest-sonic wind along its half-hour mean before taking a Hazen wind quantile. Across 390 clock-matched fitting-date minutes, the reconstructed activity differed from the source workbook by 0.02895 on average and up to 0.21062. In the largest difference, the released counts gave observed detection frequency 0.4000 and corrected activity 0.56062, versus 0.35 in the workbook. Across 131 jointly defined wind thresholds the mean absolute difference was 0.8570 m/s and the maximum was 5.3679 m/s. These measurements establish partial cross-release agreement; exact processing parity is unresolved.

An initial workbook reader stopped on an XML namespace. Its successor assumed exactly 45,000 physical rows in each wind file and stopped on a file with a different length. The working receiver aligns the recorded clock and leaves missing samples unavailable. The event study’s original forecast and score files were complete when an independent validator rejected a rounded logistic probability of exactly one. The corrected validator accepts the closed interval [0,1], reproduces the original machine-epsilon log-loss clipping, and checks the unchanged 95,700 forecasts against the source counter ticks. The largest score discrepancy is 1.39 × 10⁻¹⁷. No model or forecast was regenerated for that correction.

## Reproduce the original comparison

Run the following from the repository root. Python 3.11.18, NumPy 2.4.6, SciPy 1.17.1 and scikit-learn 1.9.1 were used for the original measurements. The program downloads the selected public text members with byte ranges, checks source member CRCs and SHA-256 hashes, fits on the three original dates, predicts the fixed later dates and recomputes the metrics from the raw instrument files. No Oceano signal or workbook sheet is read. A scratch cache can be supplied with `--cache`. The source repository supplies the archive-level MD5 metadata. The selective reader does not independently hash the entire 2.1 GB ZIP.

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
  uv run --no-project --with numpy==2.4.6 --with scipy==1.17.1 --with scikit-learn==1.9.1 \
  python research/aeolian-two-second-detections/replay.py /tmp/aeolian-replay
```

The primary time series come from Martin et al.’s field release. The authors published the threshold workbook separately. [Time series](https://doi.org/10.5281/zenodo.4992068) · [Field methodology](https://doi.org/10.1016/j.aeolia.2017.12.003) · [Threshold study](https://doi.org/10.1029/2017JF004416) · [Minute workbook](https://doi.org/10.5281/zenodo.574896)
