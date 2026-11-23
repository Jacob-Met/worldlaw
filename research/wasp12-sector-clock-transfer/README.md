# WASP-12b timing forecasts across four TESS sectors

The historical orbital-decay clock predicted the absolute times of 74 later transits better than the constant-period and precessing clocks. Its weighted squared timing error was 75.21, compared with 1,967.87 and 398.84. When each sector could have its own constant timing offset, the three errors were 63.21, 63.87 and 63.66. The decay clock lost both comparisons in sector 43. **Two of the six registered criteria passed.** The joint requirement failed.

| TESS sector | Visits | Constant | Decay | Precession |
|---|---:|---:|---:|---:|
| 20 | 19 | 14.940 | 14.779 | 14.846 |
| 43 | 18 | 15.546 | 15.635 | 15.564 |
| 44 | 18 | 15.551 | 15.161 | 15.460 |
| 45 | 19 | 17.831 | 17.637 | 17.787 |

Entries are within-sector weighted sums of squared timing residuals. Each model removes its weighted mean residual for that sector. All 74 visits and four sectors remain in every comparison. The offsets are a sensitivity test. The observations alone provide no estimate of a physical sector clock error.

## How much timing information survives a sector offset?

For two fixed forecast vectors, let the squared distance be the sum of their squared differences divided by each reported timing variance. This distance splits exactly into the within-sector part and the part along the four sector offsets. Removing the four offsets leaves 70 contrast dimensions.

| Pair | Full squared distance | Within-sector squared distance | Conditional classification error |
|---|---:|---:|---:|
| Decay versus constant | 1,814.0257 | 0.078753 | 44.42% |
| Decay versus precession | 282.7504 | 0.041187 | 45.96% |

For equally likely fixed Gaussian forecasts with the stated common, diagonal covariance, the ideal classification error on the contrasts is Φ(−D/2), where D is the square root of the within-sector distance. The registration required at most 5% for each pair and required the decay clock to beat both alternatives in aggregate and throughout all four sectors. The aggregate comparisons passed. Nearly all of the absolute pair separation came from the sector means. Unknown timing correlations, shared light-curve systematics, posterior parameter uncertainty and other timing laws can change those classification probabilities. Four campaigns observed one star.

The worst standardized decay residual was visit S44-15 at orbit 2945. Its observed BJD_TDB was 2459519.68224 ± 0.00057 days (49.248 seconds). Relative to the fixed reference ephemeris, the observed time was −445.824 s. The three forecasts were −89.772 s, −322.547 s and −227.137 s. The decay forecast was late by 123.277 s, or 2.503 quoted standard deviations. The weighted sector-44 mean decay residual was +19.664 s.

## Data and calibration

The early data contain 139 transit and 19 eclipse times in Yee et al. Table 5. Each numerical fit used the SUSIE authors’ version of that table. Its 158 event types and integer epochs match an independent projection from VizieR in their original order. The uncorrected midpoints were used with the documented 22.9-second eclipse correction. The original public-Catalog calibration attempts failed at a table-header guard. The static transport amendment retained their errors and required an exact Git blob before any fit. Four values differed by more than half a second in timing or uncertainty when compared with the separate OrbDot tutorial copy. The largest midpoint difference was 4.220 s and the largest uncertainty difference 3.456 s.

All three fits evaluated the original OrbDot 1.0.0 model source. The likelihood, three model families, worked-example priors, Nestle multi-ellipsoid sampler, 1,000 live points and stopping tolerance of 0.01 are fixed. A seed per model makes the sampling procedure reproducible. We averaged forecast times over the weighted posterior under each model. The physical models and prior choices follow earlier published work whose aggregate preference was already known. This evaluation asks how well the old fits predict the later TESS measurements. Absolute transit-clock curvature alone cannot identify a particular tidal mechanism.

Each job committed all 2,974 future integer-orbit forecasts, epochs 2027 through 5000. The last original completed at 06:58:52 UTC on 2026-11-23. The held receiver began at 07:00:01 UTC. Wong et al. Table A1 supplies 74 individual transit times and errors. We used the integer day to select the known transit epoch in the already locked bank. All 74 labels, reported times and quoted uncertainties also agree with the published NASA journal PDF. The original receiver saved the authentic VizieR rows, then failed to encode a NumPy Boolean in JSON. The successor reused those same stored rows and banks and changed only the Boolean representation. The first independent verification process also stopped on literal delimiter handling. Its successor used the original row tuples and 60-digit decimal arithmetic to recount all 222 matched forecasts and all six tests.

An earlier proposed Spitzer-only holdout closed unscored. During source qualification, a search for detector configuration displayed the adjacent published eclipse midpoints before the forecast lock. The source and exposure record remain in the protocol. The later Wong measurements were still unopened at the three-bank lock. Wong fixed its individual eclipse times for an eclipse-depth analysis. Only its individually fitted transit times are eligible here.

## Reproduce the comparison

From this directory, the standard-library command below recomputes the metrics from the published 74 matched rows and frozen forecast excerpts.

```sh
python verify.py . --published
```

For the full historical fits use NumPy 2.2.6, SciPy 1.15.3 and Nestle 0.2.1. Create a writable work directory, copy the study files there and issue the following commands. Each fit retrieves the pinned raw training file and verified wheel without installing OrbDot or using its full-data posterior.

```sh
python fit.py constant design.json constant.json
python fit.py decay design.json decay.json
python fit.py precession design.json precession.json
python receive.py
python verify.py .
```

The fresh receiver uses VizieR or the author journal PDF, with `pdftotext` for the PDF route. The verification accepts numerical agreement within its declared tolerances. Original custody hashes, receipt states, dependency versions and the separately registered transport corrections are recorded in `native-originals.json` and `protocol.json`.

[Historical Yee et al. catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/888/L5) · [OrbDot model and prior definitions](https://orbdot.readthedocs.io/en/latest/example_wasp-12.html) · [SUSIE input table](https://github.com/BoiseStatePlanetary/susie/blob/461f5ca485dd22e255e2d1dbada42fa6df733a67/example_data/wasp12b_tra_occ.csv) · [Wong et al. catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/163/175) · [Wong et al. original paper, Table A1](https://ntrs.nasa.gov/api/citations/20220009055/downloads/Wong.tess.STI.pdf)
