# Two views of the same levitated drop

For 24 held movie pairs, the camera-1 vertical bounding-box distribution predicted camera 2 with mean log-height-ratio RMS **0.017328**. The ellipse-based descriptor gave **0.013317** and the development-fitted five-feature predictor gave **0.013966**. The registered common-support rule failed. Its source still carried information about camera 2. The condition-only mean scored 0.024599 and the horizontal-width control scored 0.039017.

## Measurements and two distinct questions

Rible and colleagues recorded 72 drops using orthogonal, synchronized Photron cameras. Each of eight fluids and three nozzle sizes has three retained replicates. The highest-numbered release in each combination was held out. Surfactant with the purple nozzle uses R3/R4/R5 after reshoots. Each camera contributes 51,023 held frames. These are repeated observations of 24 releases on one apparatus. The paper's material trends were already public.

The corrected archive is 20,343,112 bytes with SHA-256 f48db4e3a6b9992ed6d040ac1a5fba2881a2c8a469c3a4fb6853af0595652307. Its 144 time-series files have 72 matching basenames per camera. The properties tables report 2,000 frames/s and camera-wide scales of 10.69833918 and 10.35475698 pixels/mm. Camera 2 omits one developmental ID and repeats the R5 surfactant-purple row identically. Five other reported counts differ by one between cameras. Independently authenticated timestamps for each released frame were unavailable. [Corrected release](https://doi.org/10.5281/zenodo.18896271) · [Experimental methods](https://doi.org/10.1103/s7rj-swb3)

The first protocol, frozen at 9edf4aeb, required a same-index map between the example author MAT cache and the corrected observations to qualify a comparison in physical units. The filename, camera, frame rate and 2,001 frame IDs matched development movie E3_R1_DW_Green_1_25_24. The first-frame bounding dimensions were 48 by 61 in both files. The major axis was 60.811912 in the cache and 61.042830 in the export. Across the movie, height and width differed by up to 2 and 3 in pixel-scale coordinates, and the largest angle difference was 1.875372 degrees. None of the registered conversions reproduced the six fields. The source code also labels a resolution in pixels/mm while one conversion path multiplies lengths by it. The absolute-unit course stopped there, preceding any held-camera access. Its first parser refusal on MAT storage type remains archived separately. [Author code](https://github.com/genepatrickrible/Aerodynamic-levitation-of-nanofluid-drops/tree/e8e7bc57ac6682b4005b2e97d140b6aa3517b2c0)

The second protocol, frozen at 2a364c18 before opening the held movies, uses the corrected exports alone. For any shape in ideal horizontal orthographic projection, vertical extrema are the same in both views. Constant positive magnification cancels upon dividing heights by each camera's own median. Segmentation, sensor roll, finite perspective, varying magnification and temporal coverage can still differ. A maximum column chord and a second-moment ellipse width are separate measurements.

For each role we forecast 19 log quantile ratios from 5% through 95%. The predictor saw camera 1 for each held movie and both cameras only for the 48 development movies. The held camera-2 median first enters the receiver to define the scored response. All 192 binary64 vectors were locked before target access. Whole-movie quantiles discard timing and ordering. The ellipse comparator's success cannot identify a three-dimensional ellipsoid or a mechanical oscillation mode.

| Predictor or control | Mean within-movie RMS | Movies on which common box scored lower |
|---|---:|---:|
| Projected moment ellipse | 0.013317 | 3/24 |
| Five development-fitted features | 0.013966 | 5/24 |
| Development-fitted common-box gain | 0.016220 | 8/24 |
| Maximum vertical chord | 0.016451 | 4/24 |
| Common vertical bounding box | 0.017328 | — |
| Same-condition development target mean | 0.024599 | 18/24 |
| Horizontal-width control | 0.039017 | 23/24 |
| Constant relative height | 0.072972 | 24/24 |

## Two different failures

The largest registered common-box error occurred at the 95th percentile of the held surfactant-purple R5 movie. Camera 2's 95th percentile was 31 against its median of 30, a log ratio of 0.032790. The common box gave 0.092373, the ellipse 0.072868, and the horizontal control 0.045462. All 19 coordinates and eight alternatives are retained for every movie.

The complete-distribution comparison found a more severe discrepancy in distilled-water green R3. Camera 1 recorded heights from 37 to 50 around a median of 43. Camera 2 recorded 22 heights from 1 to 6 and the other 1,979 heights from 40 to 54, with median 46. At frame indices 298–300, camera 1 reported 38, 38 and 38. Camera 2 reported 4, 43 and 1. The whole-distribution Wasserstein-2 distance in normalized log height was **0.305577**, the minimum RMS over equal-mass couplings of the two observed marginals. The 20 largest monotone-pair costs contribute 96.00% of squared distance. This movie scored only 0.010428 on the registered 5–95% grid. All observations remain in the calculations. The descriptors alone cannot establish whether the extremes arose in the physical drop, cameras or image processing.

## Reproduction

The 88,523-byte forecast lock has SHA-256 85553b37821788217503851ea1c71ad373f6056451c94e6d00b77a9e5e17d19c. Files ending in b85.txt contain zlib-compressed JSON encoded in Base85. Run `python3 replay.py` for offline stored-forecast scoring. Run `python3 independent_recount.py` to retrieve the corrected archive and recalculate the metrics from the two cameras' released descriptors. The independent 64-digit receiver rebuilt 3,648 residuals and all 24 complete-distribution and ordinal RMS measures. Across 1,160 comparisons, its largest numerical discrepancy was 1.034 × 10⁻¹⁶. The independent receiver uses the immutable forecasts, so this check covers scoring and raw-target provenance.
