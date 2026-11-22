# A finite-capacity release model fails the published WFC3/IR repeat-exposure comparison

The Hubble WFC3 infrared detector can retain charge after a bright exposure and release it during later observations. A new model reproduced the Space Telescope Science Institute's positive single-exposure decay curves to within **0.03858%**, yet overstated the afterglow from repeated illumination. On the nine published Omega Cen calibration visits, its mean per-visit log RMSE was **0.404830**. A maximum over exposures scored **0.221508**, a fitted fraction of the summed residual scored **0.076102** and a model using the published amplitude and shape by repeat count scored **0.048502**. The experiment stopped at its preregistered source criterion. All 48 Westerlund 1 dark-image response arrays remained sealed.

## Comparison and experimental unit

Long, Baggett and MacKenty's WFC3 ISR 2013-07 reports nine fits to nondithered exposures of three Omega Cen pointings in calibration program 12694. Its Table 1 supplies the fitted amplitude, fluence response and decay exponent of each visit. The observing headers independently give 1, 1, 2, 3, 3, 4, 5, 5 and 6 F125W exposures, each 349.23 s. The analysis used the actual end times of all 30 exposures. Each visit contributes 24 response ratios across four fluences (70,000, 100,000, 150,000 and 200,000 estimated electrons) and six times (200, 500, 1,000, 2,000, 4,000 and 6,000 s after the final stimulus). These ratios are values on **published fitted surfaces**. The study did not reprocess the original 2012 dark measurements. [2013 instrument report](https://www.stsci.edu/files/live/sites/www/files/home/hst/instrumentation/wfc3/documentation/instrument-science-reports-isrs/_documents/2013/WFC3-2013-07.pdf)

The common reference is the geometric mean of the two published single-exposure curves. It is retained in all folds. A source fold omits one pointing when estimating parameters. The three folds therefore share the published reference. Each method uses the same fluence, end times, repeat count and scoring grid. The mean gives each visit equal weight after computing its root mean squared log-ratio error. The 216 cells share just nine fitted visits from three pointings on one detector. They cannot supply 216 independent experimental replicates.

| Source method | Mean per-visit log RMSE |
|---|---:|
| Published repeat-count amplitude and shape, interpolated from training pointings | 0.048502 |
| Maximum plus a fitted fraction of the remaining sum | 0.076102 |
| Single strongest exposure, normalized ratio 1 | 0.221508 |
| Finite-capacity mode update | 0.404830 |
| Unrestricted sum | 0.555157 |

The source maximum uses the normalized one-pulse ratio for an equal-fluence nondithered sequence. It does not constitute a rerun of the historical operational pipeline on every telescope image. The count-conditioned control interpolates the log fitted surfaces by repeat count using the other pointings, with constant endpoint continuation. The residual-sum fit used 257 fractions in [0,1], and the capacity fit used 257 multipliers in [1,32]. The best full-source fraction was 0.16796875. All three training folds selected the lowest possible capacity multiplier, 1. The prospectively registered criterion required the capacity model to improve upon both the maximum and the fitted residual-sum control.

## Physical construction and numerical qualification

The released STScI A–γ table gives a response of the form $A(t/1000)^{-\gamma}$ electrons/s at the tabulated fluence and stimulus duration. The operational source interpolates **decay curves** across exposure duration, then across fluence. The input archive SHA-256 is `3dbb9f2c2f923d0f4a1d9e5909935fc57b508f22000625b5cf696dc2670b003e`. Its `a_gamma.fits` member has SHA-256 `4fb2c770d8d7eba4f09bb61a3466d1442af9f765b7b72e8d76141f4ec74df27d`. The original fit was developed on program 13572. The package also includes the Fermi model and a spatial correction. [Author software](https://github.com/kslong/Persistence/tree/b0b9cbeaf7a5274d1c336fb79282fa7179235377) · [Author calibration archive](https://www.stsci.edu/~long/xpub/Persistence/) · [2015 instrument report](https://www.stsci.edu/files/live/sites/www/files/home/hst/instrumentation/wfc3/documentation/instrument-science-reports-isrs/_documents/2015/WFC3-2015-15.pdf)

For the four source-qualified durations, the stipulated positive kernel admits a Laplace integral over exponential decays. The approximation uses 48 log-spaced rate bins between the inverse of seven days and the inverse of eight seconds. A slower mode with a 14-day lifetime receives the low-rate integral. All rates are positive and finite. The prediction window is 100–60,000 s, even though the integral of the finite model's released charge is well defined to infinite time. No physical trap species or lifetime was estimated from these 49 mathematical modes.

The complete numerical criterion covered 1,000 fluence knots, 999 interior geometric midpoints, 129 ages and the four actual exposure durations. The largest relative single-pulse error was 0.000385754. For the 799.232788-s stimulus at 41,268.207 e and 60,000 s, the table gave 0.000156463955 e/s and the finite response gave 0.000156524312 e/s. Total charge assigned by any tested single pulse was at most 3.20571% of the estimated incident fluence. The day-long release plus remaining charge matched the initial charge within 7.89×10⁻¹⁶ relative error on the native receiver. A separate check executed the original two author numerical functions on 1,032,516 inputs with the same table. The largest relative difference between their output and the double-precision table calculation was 2.862×10⁻⁷.

The positive representation is qualified only for the scheduled 349.232727, 352.939514, 499.231873 and 799.232788-s inputs and the stated time window. In the 49-s and 99-s reference slices, some amplitudes and exponents are negative. The minimum exponent in the 99-s slice is −7.82793. The released spatial correction also has negative entries. The model preserves those source findings and makes no positive-occupancy representation claim for these rows or spatial multipliers. No signed value was clipped to obtain the source comparison. The ratios use the spatially averaged kernels.

## Why changing capacity cannot repair the loss

For each mode let $\lambda>0$ be its release rate in s⁻¹ and let $s_j\ge 0$ be the newly loaded pulse's release rate in e/s. Let $B>0$ be the largest input mode rate over the frozen duration and fluence dictionary. For dimensionless multiplier $c\ge1$, the mode's rate capacity is $C=cB$ in e/s and its stored-charge capacity is $C/\lambda$ in e. If $r^-$ is the decayed rate just before a pulse, the update gives $r^+=r^-+s_j(1-r^-/C)$. The domain $0\le s_j/C\le1$ is required. A zero input adds zero charge, the first pulse in an empty mode loads $s_j/\lambda$ e, and an update cannot raise the mode beyond capacity.

For any chronological sequence of such inputs starting from an empty mode, the final rate after the last pulse can be written

$$
r_n(c)=\sum_{j=1}^{n} s_j e^{-\lambda(t_n-t_j)}
      \prod_{\ell=j+1}^{n}\left(1-\frac{s_\ell}{c B}\right).
$$

Every factor in the product is nonnegative and nondecreasing in $c$. Consequently $c=1$ gives the lower envelope for every qualifying history and mode. Later exponential decay and summing modes preserve the inequality. The argument extends to unequal positive pulses with the same fixed per-mode $B$. It does not extend to signed source kernels, an arbitrary initial state changing with $c$, or a different loading law.

All **168 of 168 repeated-visit cells** already overpredict their published targets at $c=1$. The 48 one-pulse cells are independent of $c$. An independent closed-form receiver reconstructed all 1,080 method-cell scores. It follows that the **minimum possible mean log RMSE over the entire continuous domain $c\ge1$** on this source grid is **0.40483048**. This certificate is specific to the frozen calibration, dictionary, scoring grid and loading rule. It does not rule out other history-dependent detector models.

The largest discrepancy occurs in visit 26, after six exposures, at 70,000 e and 6,000 s. The published ratio was **1.872433**. The minimum-capacity result was **4.714343**, the unrestricted sum **5.095527**, the fitted residual-sum control **1.751913**, and the count-conditioned control **1.926197**. All 216 rows and the certificate are included in this directory.

## Westerlund 1 source information retained

The three visits in historical program 14016 contain **7, 5 and 3** stellar exposures of the same cluster with a dither between successive frames, followed by **16 darks each**. The three HST association tables distinguish the 15 input exposures from association products. Public ICRR01YKQ RAW, IMA and FLT products were verified by FITS header ranges. The stellar FLT science unit is ELECTRONS/S. The corresponding dark IMA and FLT units are COUNTS/S, while the RAW unit is COUNTS. An initial header parser split these strings at a quoted slash. Literal-card receiving corrected the unit interpretation before the source pixels were read.

| Input property | Visit 01 | Visit 02 | Visit 03 |
|---|---:|---:|---:|
| Coordinates finite and DQ=0 across every stellar FLT | 949,653 | 955,205 | 919,363 |
| At least two FLT fluence estimates ≥40,000 e | 280,053 | 285,076 | 290,644 |
| At least two FLT fluence estimates ≥70,000 e | 187,104 | 184,781 | 182,231 |
| At least two final IMA reads carrying full-well DQ bit 256 | 170,600 | 166,624 | 161,423 |
| Both repeated ≥70,000-e estimates and repeated final-read DQ 256 | 170,345 | 166,407 | 161,184 |
| Unique physical exposures verified in catalog envelope | 58 | 49 | 25 |
| Physical predecessors of first dark, within 16 hours | 39 | 33 | 9 |

The first five rows use the identical jointly-good stellar FLT mask within each visit. The 40,000-e threshold had repeated coverage in 982, 976 and 941 of the 1,024 fixed spatial tiles. These counts establish input support on the detector. They do not measure trapped charge. FLT rate times exposure duration extrapolates from usable reads. A zero FLT DQ flag does not imply the detector remained unsaturated in later reads. At the disclosed visit-01 site (zero-based FLT row 53, column 893), the first stellar exposure ran from raw code 29,230 at read time zero to 55,444 at 352.939514 s. Its final IMA DQ word was 2304, including bit 256. The FLT fluence estimate at that site was 5.13 million e for that exposure and reached 8.83 million e in another. The RAW codes, IMA calibration flags and extrapolated FLT fluences measure different quantities. [STScI calibration steps](https://hst-docs.stsci.edu/wfc3dhb/chapter-3-wfc3-data-calibration/3-3-ir-data-calibration-steps)

The 16-hour histories compare each predecessor's native EXPSTART with the target's EXPSTART. The response age for a physical stimulus would instead run from its end to the target exposure midpoint. Two distinct MAST query paths, including separate science and calibration inventories, agreed on all 23, 21 and 20 relevant native catalog records. The member expansion verified every corresponding input header and all 48 dark schedule identities. These are archive-covered exposure histories. Their antecedent intensities were not modeled. Later darks' histories include the preceding darks, so an operational reconstruction of all 48 would require assumptions or sequential access beyond an all-forecasts-first test. Direct requests for the precomputed visit model archives returned HTTP 403. No archive map or corrected image served as an outcome. The source gate failed before any Westerlund dark forecast or score. The 2018 short-time study already examined this campaign and the 2018 area-dependent study used some 14015 visits. [STScI calibration plan](https://hst-docs.stsci.edu/wfc3ihb/appendix-e-reduction-and-calibration-of-wfc3-data/e-9-the-cycle-22-calibration-plan) · [MAST persistence products](https://archive.stsci.edu/prepds/persist/) · [2018 short-time report](https://www.stsci.edu/files/live/sites/www/files/home/hst/instrumentation/wfc3/documentation/instrument-science-reports-isrs/_documents/2018/WFC3-2018-05.pdf)

## Replay

Run `python3 replay.py` from this directory for an offline check of all original hashes, score rows, the minimum-capacity bound, and the sealed response boundary. For a full numerical reconstruction, run `OPENBLAS_NUM_THREADS=1 python3 replay.py --fetch-calibration` with NumPy available, or use `--percal PATH` to supply the exact public calibration tarball. The numerical replay reads only the published coefficients, nine source visit schedules and published fitted response surfaces. It requires no HST science image download. The two transcript formats and 216-cell table retain their original numerical precision.

The source support and qualification contracts were sealed under att-mws5566zutsqck, att-mws5jo2lzufa63, att-mws5vh3h7grj67 and att-mws5zlx6bscjwi, in that order. The numerical study used two small CPU processes for the native finite-kernel and source-fit originals, followed by an algebraically independent reconstruction. A source intake downloaded 249,583,680 bytes across the 15 stellar FLTs. Its follow-up reused digest-bound stellar FLTs, full stellar RAW reads and exactly 12 MiB per stellar IMA. The ledger reports actual bytes by product and retains the original bounded failures. No GPU or historical dark-image processing was needed.
