# Can weighed fractions predict a complete powder diffraction profile?

The five-mixture model gave the smallest average error on three held specimens. It failed its registered criterion for consistency across specimens. On mixtures f and h, a sum of the measured pure-phase patterns weighted by the Cu mass absorption coefficients was closer. Independently fitting nine diffraction peaks on the development set also beat the model on those same two mixtures.

## What was measured

The IUCr CPD quantitative phase analysis round robin includes eight separately weighed corundum, zincite and fluorite mixtures and patterns of the pure phases. Two near-equal mixtures g and h are separate preparations with slightly different fractions. Alternative file formats for one pattern share the physical measurement. Each held specimen is one comparison unit. The 7,251 angular bins resolve its profile.

The organizers describe a Philips instrument with a Cu tube at 40 kV/40 mA, three seconds per 0.02° step, unspun back-packed samples and flat-plate Bragg–Brentano reflection. The general kit specifies 5–150°, whereas the later round-robin paper describes 15–145°. Two native Philips headers and all eleven coordinate sequences support the complete 5–150° grid used here. No individual flux monitor, packing-depth or independent absolute intensity calibration was authenticated. [Organizer kit](https://www.iucr.org/__data/iucr/powder/QARR/data-kit.htm)

The study uses immutable research copies in RietX. An independent GSAS tutorial contains identical g/h files. MAUD's h file has the same ordered text records after removing line-end differences. The initial source job ended at DNS resolution, a malformed source assembly failed before execution, and a corrected source job received HTTP 403 from the organizer archive. None supplied experimental outcomes. Published weighed fractions, XRF measurements, method comparisons and RietX inverse results were known. [Versioned standards and native converter documentation](https://github.com/yue-here/rietx/tree/0c3e7ccd8e0e347f950fc56320890546e2d410aa/tests/data)

## Information given to each model

Development used the three measured pure-phase patterns and mixtures a–e. For each held mixture f, g or h, the predictors received its weighed fractions alone. The registered response subtracts each spectrum's own angular mean and divides by its own angular RMS about the mean. This defines a shape comparison invariant to a constant background and positive scan scale.

Conditionally, the centered profile satisfies `X_i(q)=g_i sum_c m_ic S_c(q)`. An unknown scan gain absorbs a common mixture attenuation factor. To estimate three fixed phase shapes, the model inferred development scan scales using the composition matrix and the measured directions of the centered profiles. The development composition condition number was 1.4214. The smallest-to-next eigenvalue ratio was 0.0214, the gap 0.1070 and the smallest-to-largest inferred scale ratio 0.2746. All registered screens passed. Packing, preferred orientation, angular shifts, microabsorption, nonconstant backgrounds and changes in phase profiles can each affect transfer.

The peak-fit comparison used the released lmfit 1.3.4 pseudo-Voigt plus linear model. Fifty-four fits covered three isolated peaks per phase, each on its pure spectrum and all five development mixtures. The resulting relative gains were 0.59151, 0.91716 and 1.84329 in corundum/zincite/fluorite order. These gains weighted the measured pure references at prediction. The historical Rietveld analyses estimate phase fractions from an observed mixture spectrum. Here a held spectrum becomes available only to the scorer. [Released lmfit implementation](https://github.com/lmfit/lmfit-py/tree/1.3.4)

## Held whole-specimen RMS error

| Role | f | g | h | Equal-specimen mean |
| --- | ---: | ---: | ---: | ---: |
| projective | 0.106783 | 0.061638 | 0.283546 | 0.150656 |
| pure_mac | 0.083006 | 0.123576 | 0.275667 | 0.160750 |
| peak_fit | 0.083793 | 0.125660 | 0.276689 | 0.162047 |
| raw_ols | 0.125865 | 0.176555 | 0.343938 | 0.215452 |
| unit_ols | 0.254864 | 0.237258 | 0.377501 | 0.289874 |
| pure_mass | 0.167574 | 0.340805 | 0.447035 | 0.318471 |
| pure_norm | 0.331515 | 0.422593 | 0.533929 | 0.429346 |
| nearest | 0.658057 | 0.287257 | 0.485788 | 0.477034 |

The registered joint gate required the best mean and at least two wins against each of the absorption-weighted and peak-fit predictions. The projective model won only on g against both. Its estimated normalized g–h separation was 0.075396 versus 0.264020 measured. Every smooth mixture rule substantially underestimated this difference. The nearest-development rule overestimated it at 0.485659. These thresholds and specimen groupings were fixed before receiving held counts.

The largest projective miss occurred on h at 36.22°, bin 1561. The detector recorded 3,192 counts, giving 8.483801 normalized units. The prediction was 13.830398, compared with 12.033406 from absorption weighting, 11.832299 from peak fitting and 9.554873 from the nearest mixture. By 36.28° the same specimen reached 6,577 counts, or 17.821495 normalized, and the model predicted 17.130451. The signed residual reverses locally. The record alone does not identify the source of that difference.

## Conversion, original evidence and replay

The first grid check refused the printed 1e angles. Of its 7,251 ordinates, 124 differ from nominal by up to 0.00001°. Every printed angle resolves to exactly its ordinal in the original native 0.02° grid. A second check required identical native-truncated and printed counts. That refused 2,108 bins, as the benchmark documentation explains. The 1e converter rounds squared packed counts to nearest, while the corundum converter truncates. All 14,502 values matched the documented convention. The forecast uses the native truncated counts for both. Both failed originals remain recorded. The spelling and versioned source of these rules are in protocol.json.

The complete 24-vector forecast was frozen at 84727224e7dc6508bf08eef4c01aa580355ba128, matrix SHA-256 `3b7c9aea29abeb1229b1cf9c6e515647751dd570a9bf058edf452d8cea13b7ff`. The independent scoring process restored and verified every one of its 1,392,192 bytes before interpreting any held counts. A third process independently reparsed the pinned research copies and recomputed all 174,024 residuals with 55-digit Decimal arithmetic, including the 24 extrema, the same-bin comparisons and g–h separation. All 24 RMS differences were within 5.56e−17. Its initial parser counted a blank text line as a record and stopped. The corrected reader skips whitespace-only lines and requires exactly two numerical fields on every retained record.

Run `python3 replay.py .` in this directory for the offline score and receipt checks. With access to the pinned upstream repository, `python3 score.py` reconstructs the locked binary forecasts and scores, while `python3 independent.py` recomputes the measurements independently. For development reconstruction the pinned runtime is NumPy 2.2.6, SciPy 1.15.3 and lmfit 1.3.4. The immutable compact coefficients are the authority for the forecast. Source scans remain at the upstream repositories. The ten original job identities, output digests, exit codes, resource use and scopes are in native-receipts.json.
