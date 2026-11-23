# Predicting opposed illumination on one resolution chart

A direction-dependent correction to the opposite lamp's measured image reduced mean squared spatial-shape error from **0.429988 to 0.419174** over 98 held illumination directions. It improved on the opposite-lamp predictor on **77 of 98** pairs and beat the ten frozen controls on the aggregate. The improvement is 2.52% relative to pure opposition. The comparison predicts the shape of a 256 × 256 tile on one lithographic resolution chart. The calibration came from 48 distinct complete lamp pairs in the same scan.

The correction lost to angular interpolation on 38 lower-contrast tiles. For the four nominal brightfield directions, using the opposite frame directly was more accurate. These two failures bound the aggregate improvement.

## Measured inputs and endpoint

Tian et al. used a programmable red LED array to illuminate a resolution target. The authors report 293 exposures with one LED at a time and a second acquisition using four LEDs at a time. The public chart directory lists one series, Iled_1.tif through Iled_293.tif. The published parameter script enumerates a 293-position circular lattice. Its 8.1485 system magnification, 6.5 µm camera pitch, 0.6292 µm nominal wavelength, 0.1 objective NA, 4 mm LED pitch and 67.5 mm sample distance apply here. [Tian et al., 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4102371/) · [Author data page, dataset 2](https://sites.bu.edu/tianlab/open-source/) · [Author code](https://github.com/Waller-Lab/FPM)

The first, middle and last TIFF headers each declare one uncompressed 2,560 × 2,160 unsigned 16-bit plane. Each lacks an acquisition-description tag and a link to a second TIFF directory. Before reading a crop, the receiver checked the dimensions, orientation, final directory, and all 66 strip offsets/lengths for that file. For each permitted frame it received a full-width band of 256 rows, then retained the central 256 columns. This excluded other frames from each authorized acquisition stage. The measurement value is an unsigned camera count. The response scale, ADC saturation level, per-lamp irradiance, dark field and instrument gain were not independently calibrated here.

Lamp assignments follow the natural filename order of the released sequential example and the column-major ordering of the actual chart mask. The release has no contemporaneous per-exposure log to verify this correspondence independently. Under that convention, frames j and 294−j have opposite lattice positions. There are 146 such pairs plus the central lamp. The preregistration assigns 48 full pairs to development, chooses one donor from each of the other 98 pairs and includes the center lamp. All 195 development crops were received before generating forecasts. Each of the 1,078 float32 forecasts and all 11 complete role files were hashed before any of the remaining 98 file views or image ranges were requested.

An ideal real transmittance up to a scalar phase, illuminated by opposed plane waves and viewed through a Hermitian pupil up to a scalar phase, gives conjugate image fields and matching spatial irradiance. The scored observable subtracts each measured tile's own mean and normalizes its Euclidean norm. This removes positive scalar fluence differences and a spatially uniform offset. The scoring transformation of the held tile supplies no input to the predictor. The method estimates neither absolute counts nor an optical component. There is no measured proof that the target is real-valued or the pupil Hermitian. The predicted spatial shape can also contain features shared by the specimen, camera or illumination. At the edge of the crop, nominal ray-opposition mismatch is bounded by 0.00428 NA if the assumed optical and LED centers coincide. Details and the finite-field qualification are in [conditional-law.md](conditional-law.md).

## The measured comparison

Lower scores indicate better prediction. For two nonconstant tiles normalized to unit vectors, squared shape distance equals twice one minus their spatial correlation. The zero-shape predictor has a squared error of one in exact arithmetic. All 98 held images enter the published aggregate.

| Forecast | Mean squared shape error | Mean after removing the shared source direction |
|---|---:|---:|
| Odd correction to opposed illumination | **0.419174** | **0.581700** |
| Opposed illumination directly | 0.429988 | 0.600996 |
| Angular kriging | 0.456383 | 0.642852 |
| Quarter-turn correction sham | 0.485860 | 0.659736 |
| Nearest other direction | 0.710790 | 0.944044 |
| Adapted rank-one optical reconstruction, source first-percentile pedestal | 0.738490 | 0.875165 |
| Shell average | 0.758182 | 1.180518 |
| Zero shape | 1.000000 | 1.000000 |
| Global average | 1.066547 | 1.000000 |
| Nearest other direction on the same shell | 1.171308 | 1.572034 |
| Adapted rank-one optical reconstruction, uncorrected intensity | 1.417580 | 1.465635 |

The corrected forecast retains the measured opposite shape and uses a direction-odd kernel to estimate the spatial difference. The 48 calibration pairs selected a bandwidth of 0.75 lamp pitches and a 0.3 ridge coefficient. Angular kriging selected 1.5 and 0.3. The rotated sham selected 6 and 0.3. The development scores for these three fits were 0.485633, 0.486206 and 0.551679, respectively. Pure opposition scored 0.497888 there. There was no complete brightfield pair in development.

The optical controls use the released singleton object/pupil update equations with the chart's parameters. They operate on the 195 observed tiles, process lamps in increasing nominal radius and forecast the withheld locations. Both ran ten iterations with a 768 × 768 object and a 256 × 256 pupil. One used the raw camera intensity and one subtracted the source tile's first percentile before taking the square root. The released full-image driver also needs a sample-specific setup and user-selected background windows. These center-tile adaptations test an author-derived forward model under our data budget. They do not recreate the paper's complete chart reconstruction. [Released core and driver](https://github.com/Waller-Lab/FPM/tree/e02a1123cf27da8299fa90aa0525232de6eab9d1)

| Registered subset | Pairs | Odd correction | Pure opposition | Angular kriging |
|---|---:|---:|---:|---:|
| Nominal brightfield | 4 | 0.071259 | **0.067342** | 0.897533 |
| Nominal darkfield | 94 | **0.433978** | 0.445420 | 0.437611 |
| Target spatial RMS above 4 and at most 16 DN | 38 | 0.805879 | 0.815818 | **0.619415** |
| Target spatial RMS above 16 DN | 60 | **0.174260** | 0.185630 | 0.353130 |

Held spatial RMS ranged from 5.183 to 9,773.518 DN. All 98 weights in the fixed one-DN floor diagnostic therefore equal one. The brightness/contrast strata use the measured target to describe errors after scoring. They were never supplied to a selector. A source-common-direction diagnostic removed one normalized grand-average source vector from each predicted and observed shape; this preserved the aggregate ranking at the top. It does not identify the origin of that direction. These 98 pairs share a specimen, camera and training bank.

## Worst measured case

The candidate's largest shape error was **1.265618** on target 64 with donor 230. Zero shape scored **1.000000** and angular kriging scored **1.095462** on the same target. Pure opposition scored 1.289457 and the rotated correction scored 1.353400. At the candidate's largest residual within this pair, sensor row 1092, column 1294 (zero-based), the target measured 461 DN and the donor 154 DN. These correspond to 37.48 and 10.38 within-frame standard deviations. The corrected unit-vector prediction was 0.035709 at that cell, against a measured 0.146408. The same-area extreme on development pair 276←18 had been visible before the holdout opened. No artifact-free reference distinguishes optical structure from the camera response at that location. The largest deterioration relative to the direct donor on any held pair occurred on 44←250, from 0.901988 to 0.964482.

## Separate multiplex question

The folder supplies no realized four-LED pattern roster or separately identified composite stack. The paper establishes that the experiment was conducted. It does not bind the published singleton files to physical composite target files. If raw camera background at exposures 1 s and 2 s is D1 and D2, then a linear, unsaturated four-lamp, 1 s camera intensity would be half the sum of the four individual 2 s intensities plus D1−2D2. With equal cardinality, differences between patterns eliminate the fixed background term. Under ideal nearest-integer quantization the contrast error from quantization alone is bounded by one plus one quarter of the L1 distance between the pattern rows, in stored count units. Neither simultaneous-intensity transfer nor absolute illumination was scored. Synthetic sums would not provide independent measurements.

## Reproduction and custody

Run `python3 replay.py` from this directory to verify the recorded score digest, all 3,234 scalar row values and their aggregates, all registered strata, the adverse-geometry cross-checks, and the strict primary decision. This replay uses the recorded measurements' scalar score table and does not fetch author images. A separate native implementation recomputed all 3,234 array-level scores with vectorized reductions and rechecked all 1,078 per-image hashes. Its first comparison stopped at a fixed absolute tolerance of 2 × 10⁻¹². A diagnostic receiver retained each discrepancy; the largest was 4.025 × 10⁻¹² for the zero-shape score on target 190. Only the ordering of the mathematically tied zero-shape maxima changed, from target 260 to 74. All ten nonzero predictor worst directions, the original eleven raw worst-position readbacks, all 121 same-location comparisons, the primary gate and the 77 pairwise wins agreed. The smallest corrected-versus-opposed pair difference was 7.584 × 10⁻⁵. The first receiver remains recorded as a failure. [Scoring contract](scoring_contract.md) · [Complete split](singleton-split.json) · [Acquisition and compute originals](native-receipts.json)

The initial 195-file source acquisition elapsed 368 s. The complete forecast producer ran for about 32 s on one requested CPU, using 30.27 user CPU seconds and 570,580,992 bytes peak RSS. The measured ROI footprint is 38,404,096 bytes across all 293 files. The 1,078 uncompressed float32 predicted shapes contain 282,591,232 bytes. Public evidence here includes the digest of each whole role, the completed scalar table, the routines, and raw counts at the reported adverse positions. The resolution-target image tiles and reconstructed frame arrays remain in their original research custody. Author data use is subject to the laboratories' credit and noncommercial-use terms. [Dataset and usage terms](https://sites.bu.edu/tianlab/open-source/) · [Source code license](Waller-Lab-LICENSE.txt)
