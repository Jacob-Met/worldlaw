# Does the zinc-point calibration transfer to later calcium oxalate mass loss?

The frozen zinc-anchored forecast failed its primary comparison. In group 7 it predicted the 320–850 °C mass curves with mean specimen-label RMSE **0.501541 mass-percentage points**. The same reference template with a vertical adjustment alone scored **0.494400**. Zinc improved on early-landmark translation (0.557834) and the empirical ridge predictor (0.655247). Its temperature correction helped in the second reaction window but increased error against the vertically adjusted template in the third.

**105 released row labels contain 80 distinct full curves.** Five bitwise-identical full curves cross early-calibration and held roles. The ten group 7 held labels include nine distinct later curves, one of which is also found in early calibration. Giving the nine distinct held curves equal weight again favors the simpler reference (0.499289 versus 0.503411). This secondary sensitivity leaves the original label-based score and decision intact. The released records establish equality of their stored masses. They give no explanation of the repeated records or independent physical specimen identities.

## Physical source and information budget

Naya et al. measured calcium oxalate monohydrate under an air flow of 50 mL/min with one programmed heating ramp of 20 °C/min from 20 to 900 °C. The archive describes 15 specimens in each of seven groups. Groups 2–5 used a common calibration on the same SDT2960. A fifth operator on that instrument used a two-year-old calibration (group 6). A sixth used a 2 °C discrepancy at zinc melting (group 7). Group 1 used a different, older-calibration STA1500. The calibration sign, full calibration map and an independently measured furnace temperature trace are unavailable. The comparison grid follows the authors’ package example, 1,000 evenly spaced points from 40 to 850 °C. Their published group 7 outlier finding and qualitative last-stage difference were known before this archival forecasting exercise. [Experimental protocol](https://doi.org/10.1007/s10973-014-4039-1) · [Pinned ILS source and release data](https://github.com/cran/ILS/tree/a46be10f6073c94c103888056bcf2caea0f78b37)

The source template and empirical regression received all 60 reference labels from groups 2–5. For each of groups 1, 6 and 7, only the first five labels’ early curves (through 280 °C) entered calibration. Ten other labels per group supplied the later outcomes. Trusted deserialization materializes the matrix before the predictor selects its allowed slices. Neither DSC nor IDT was used. No curve was reassigned after scoring.

The source documentation gives logical dimensions of 15 × 1,000 × 7. The actual R object has 105 rows and 1,000 columns. The first acquisition refused the matrix before selecting masses. The package's own labeling and plotting code binds contiguous blocks of 15 to each group. A narrow acquisition correction adopted that order before forecast construction. The source hashes are in `layout-receipt.json`. The protocol, numerical methods, corrected layout and pre-score forecast were recorded at `b4de2fca`, `982e5444`, `206c2d35` and `9f042447` respectively.

## Forecast and controls

The reference and early group-mean curves supplied five fractional dehydration crossings between 15% and 85% of the early step. The zinc role fit an affine temperature map for each possible sign of a 2 °C discrepancy at 419.527 °C, then chose the smaller early sum of squared landmark errors. The reference was sampled on the inverse map by linear interpolation with endpoint clipping. A 45–70 °C mean mass adjustment was shared with the vertically matched controls. The free affine map and constant translation used the same early landmarks. The nominal gain was anchored at 40 °C. The ridge regression used four early features and 12 disjoint five-label blocks of the source groups. Repeated archived source curves make those blocks statistically dependent. The prespecified comparator identities, signs and selection rules are in `protocol.json`.

Group 7 had a mean early crossing shift of +2.350356 °C. Its early signed zinc fits scored 0.031342 (+) and 0.093387 (−) °C². The chosen map was 0.99859604 × reference temperature + 2.5890004 °C. These numbers describe the fitted map on the supplied grid. At one heating rate a pure temporal lag can produce an apparent temperature shift, and a single fixed point does not determine an arbitrary calibration function. The group comparison also changes operator. Forecasting success alone could not identify a thermometer error or separate thermal lag, specimen kinetics and preparation.

| Frozen role | 320–850 °C | 320–<560 °C | 560–850 °C |
| --- | ---: | ---: | ---: |
| constant | 0.526293 | 0.279709 | 0.663345 |
| constant minus | 0.672719 | 0.597233 | 0.727398 |
| constant plus | 0.526293 | 0.279709 | 0.663345 |
| free affine | 0.549464 | 0.304951 | 0.688633 |
| gain | 0.666703 | 0.305718 | 0.856946 |
| gain minus | 0.810021 | 0.643303 | 0.925257 |
| gain plus | 0.666703 | 0.305718 | 0.856946 |
| raw reference | 0.550924 | 0.364538 | 0.663120 |
| reference | 0.494400 | 0.323847 | 0.595717 |
| ridge | 0.655247 | 0.454263 | 0.782507 |
| translation | 0.557834 | 0.312505 | 0.697347 |
| zinc | 0.501541 | 0.273937 | 0.629488 |
| zinc minus | 1.218199 | 0.750023 | 1.498586 |
| zinc plus | 0.501541 | 0.273937 | 0.629488 |

Entries are means of within-label RMSE in mass-percentage points. The whole grid has 654 values per label. The two subwindows contain 296 and 358. Zinc beat the ridge on 8/10 primary labels and beat translation in both windows, but only beat the vertically matched reference on 3/10. The original joint outcome is **fail**. Group 1 scored 0.803977 for zinc versus 0.323983 for ridge. Group 6 scored 0.575450 versus 0.350284 for the raw reference and 0.354037 for translation. These groups had no reported deliberately displaced zinc point. Every individual score, including the unselected signs, is retained.

## Worst raw outcome

Group 7 label 13 at grid index 878 (zero based), 751.891892 °C, retained 39.247460% mass. Zinc predicted 40.992088%, an overprediction of 1.744628 percentage points. At the same coordinate the vertically adjusted template gave 40.307492%, ridge 39.561293% and translation 41.369058%. All fourteen role values, the nine-point neighborhood and all ten held measurements at the same temperature are in `score.json`. The mechanism of this individual error is unresolved.

## Duplicate records and validation

The independent reader parsed the original R XDR object directly, validated its type, full byte layout and dimensions, then grouped the input by exact big-endian binary64 byte strings. It repeated the grouping for the full curve, the early 297 bins and each of the three scoring windows. All five membership partitions agree. The per-group counts of distinct full curves are 11, 15, 13, 13, 15, 14 and 13. Groups can share an exact curve. The 60 reference labels comprise 43 different full curves. No reference-class member occurred among calibration or held labels.

| Early calibration label | Held label with the same complete curve |
| --- | --- |
| Group 1 row 1 | Group 6 row 10 |
| Group 1 row 3 | Group 1 row 12 |
| Group 1 row 4 | Group 1 row 7 |
| Group 6 row 1 | Group 6 row 7 |
| Group 7 row 2 | Group 7 row 7 |

Group 1 held rows 6, 9 and 10 were also identical to one another, as were group 7 held rows 10 and 12. All 80 classes, their members, partition labels and per-window byte digests are in `duplicate-and-score-recount.json`. Labels are one based. Archive overlap limits the independence of the reported transfer, even though the predictor admitted only the registered early slices for calibration.

## Reproduction

Run `python3 replay.py .` from this directory for the stored-score and duplicate-census check. For a fresh independent reconstruction from the original archive, run `python3 independent.py . /path/to/TG.RData`. Without the final path it retrieves the pinned public file. `independent.py` uses only the Python standard library. It rebuilds all 274,680 forecast/measurement comparisons, all 1,512 reported summary and per-label scalar checks, and all 30 archived target-vector hashes. It checks all original decisions and worst coordinates. The original 27,468 predictions were fixed before scoring. The native execution totals and preserved failures appear in `native-originals.json`.

The strongest inference from these records is a comparison of mass forecasts on this one released coordinate and group configuration. The dataset cannot establish that group 7 represents ten independent unseen specimens or determine the actual zinc calibration function.
