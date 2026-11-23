# Can a finite settling column predict the front of a coarser glass suspension?

A source-calibrated front model that depletes a finite column of particles **failed its registered transfer test**. On 13 complete glass-bead releases at two larger grain sizes, its mean size-group error was **46.40 mm**. The published slumping model with its attenuation fitted on source runs reached **29.57 mm**. Fitting that same threshold structure directly to source front positions reached **28.24 mm**. A hydraulic model with no settling had **103.26 mm** error. The observations support variation of the front trajectories with the release conditions. They do not identify a suspension profile or an individual particle’s settling velocity.

## Measurements and split

The PALAGRAM monograph archive specifies three physical lock-release setups and a SedFoam simulation series. The paper says 288 combined runs and the Zenodo description says 287 output files. The authenticated Git input census contains 288 raw files, of which 269 are physical and 19 numerical. Assignment requires the source author attribute. The runs_CYRIL directory contains 21 Cyril/Marie records from setup 2 in addition to the 148 Cyril records from setup 1. The Zenodo catalog original failed DNS before file retrieval. Subsequent work used the independent author Git release at tag 1.0.0, commit d7559b7772e59c26358b9cd931f915e218de5dd9. This establishes the selected Git objects without assuming a whole-Zenodo-ZIP checksum match. The paper’s aggregate regime observations and the threshold near 0.01 were already public and known before selection. [Author release](https://github.com/cgadal-papers/palagram_monograph/tree/d7559b7772e59c26358b9cd931f915e218de5dd9) · [Zenodo](https://doi.org/10.5281/zenodo.10854247) · [Published analysis](https://doi.org/10.1002/9781394216727.ch2)

We selected every setup-1 Cyril release recorded at 7.24° with initial lock depth 0.202112 m and length 0.099 m. The development set includes 20 silica sand, 15 saline water, 18 fine glass (64.20 µm) and eight medium glass (135.06 µm) releases. All eight 186.87 µm and five 250 µm glass releases were held in full. The 74 raw Git blobs and notebook IDs are listed in design.json. Concentrations vary within material and size groups. These observations come from one flume and camera. Instrument drift, changing bead shape distributions, manual preparation and changing subpixel visibility are possible size-associated differences; they were not independently measured here.

The measured endpoint is the original image-derived streamwise front position. The 45 registered comparisons use dimensionless time 5 through 16 in steps of 0.25, with the original reduced-gravity/lock-length timescale for each release. Inputs contain the initial geometry, mixture properties and recorded time grid; no held position, displacement offset, fitted Froude number or attenuation entered prediction. One of 585 held positions, the last cell of run_024, lacked the required finite adjacent samples. Every release satisfied the predeclared 36-cell minimum, and each of the 12 model arms had the same 584 measured cells.

## Models and frozen comparison

The predeclared candidate assumes an initially uniform suspension and a sharp settling interface. If the effective dimensionless settling rate is K, the active fraction is max(1−Ku,0) at dimensionless time u. Front speed is proportional to the square root of that fraction, times a common exponential hydraulic decay. A matched, perfectly mixed active column replaces that factor with exp(−Ku/2). They agree to first order in Ku but diverge as the finite column empties. In this comparison saline buoyancy remains, while the selected particulate releases have essentially matching carrier and ambient densities. This design does not test partial retention of buoyancy in mixtures of salt and sediment.

The candidate computes the isolated-bead settling speed by solving the finite-Reynolds-number drag balance and multiplies it by (1−volume fraction)^4.65. The hindrance exponent is fixed as an approximation across the two held sizes. Both the finite and mixed models use the published energetic Froude form, the same three fitted scale/decay/settling parameters, source observations and bounds. The strongest established baseline uses the author’s hinge at St=0.01, the mean source Froude number, and a source-only slope fitted to released per-run attenuation values. Its directly fitted version uses the original source paths; each role is assessed at identical times. The global published mechanism had used data from this apparatus previously, so this is a new locked split and matched recalibration of a known model. No held per-run fitted quantities were read.

The release encodes 2,650 kg/m³ in the glass-bead files, while the monograph says 2,500 kg/m³. The primary and all comparators use the released value. The separately frozen sensitivity uses 2,500 kg/m³ in glass model fitting and forecasting, keeping the observation times fixed. Neither value is authenticated as a direct per-run density measurement.

## Results

Values are within-run RMSE in mm. The source column averages 61 releases. Each held column averages all runs of that size. The primary column gives the two sizes equal weight.

| Model | Source | 186.87 µm | 250 µm | Balanced held |
|---|---:|---:|---:|---:|
| Finite column, corrected + hindered settling | 30.40 | 40.06 | 52.75 | 46.40 |
| Mixed column, corrected + hindered settling | 29.63 | 37.42 | 63.88 | 50.65 |
| Finite column, literal Stokes | 29.69 | 26.59 | 37.74 | 32.16 |
| Mixed column, literal Stokes | 28.89 | 28.30 | 36.45 | 32.37 |
| Finite column, corrected drag alone | 29.77 | 35.69 | 44.99 | 40.34 |
| Hydraulic decay, no settling | 38.51 | 73.08 | 133.45 | 103.26 |
| Constant velocity | 38.49 | 73.35 | 133.65 | 103.50 |
| Published Fr/attenuation rule, source runs | 32.51 | 27.92 | 31.22 | 29.57 |
| Threshold quadratic fitted to source paths | 31.09 | 29.18 | 27.30 | 28.24 |
| Source polynomial with grouped ridge selection | 26.58 | 166.91 | 466.42 | 316.67 |
| Finite column, prose glass density | 31.73 | 37.79 | 54.05 | 45.92 |
| Fixed medium-glass mean | 59.41 | 40.79 | 99.95 | 70.37 |

All three hydraulic/particle fit parameters stayed in their defined bounds. The finite candidate’s fitted hydraulic decay was effectively zero, with a Froude multiplier of 0.8350 and a settling multiplier of 1.0971. The uncorrected Stokes alternatives did better than the corrected drag + hindrance variants in aggregate. Partial comparisons give different rankings: the mixed corrected model wins at 186.87 µm but loses at 250 µm. The polynomial has the best source score and extrapolates badly in both coarse groups. No unconstrained polynomial prediction was clipped. All twelve roles and all gate conditions are in score.json.

At the candidate’s largest error, 250 µm run_022 (“silibeads200m_300m -- run03”), u=16 corresponds to 5.136306 seconds. Consecutive camera positions were 0.4065291 and 0.4065249 m. Their time interpolation gives **0.4065265 m**. The finite model predicts **0.5210845 m**, overshooting by **114.56 mm**. The source-only published rule gives 0.3980347 m, its directly fitted version 0.4208892 m, the matched mixed model 0.5325567 m, and the polynomial −0.3839814 m. In this run the effective settling speed changes from the raw Stokes estimate of 0.05631 m/s to 0.03408 m/s under finite-Re drag and to 0.02970 m/s with hindrance. That reduces modeled depletion and allows the front to travel farther. The front record cannot establish which assumption caused the miss. score.json contains all predictions at that row and all 13 candidate-worst camera neighborhoods.

## Verification and reproduction

The prospective rules/design were committed at e11fcfbb959b9ae4f40002bce31fb8caf646fe5f and exact predictor at f37fd385bc44a5df3ecf34fbdf4d382f7033ddf7. Training took 1.078 seconds inside the single-threaded native producer. Its complete 7,020 forecasts were received and committed at 42f60f99fbb80c4d2281c14f9d823256767974c3, SHA-256 ff6046ef1b367cd64cf56c568013de64a8f1059b1960f936f56b69963d0a53da, before opening the held positions. The receiver subsequently produced 7,008 finite residuals. A separate CPU original read the 13 authenticated Git blobs, used its own scalar clock interpolation and 65-digit decimal score calculation, and reproduced 156 run scores, 24 size means, 12 balanced scores and every worst index. Its maximum score or worst-error discrepancy was 6.40×10⁻¹⁴ mm.

Run `python3 replay.py` in this directory for the standard-library replay of the locked forecasts and published observations. To receive native measurements again, point `PALAGRAM_GIT` at a Git repository containing the stated upstream commit, install NumPy 2.2.6, SciPy 1.15.3 and h5py 3.12.1, and run `python3 independent.py`. The five native outcomes, including the separate DNS refusal, remain in native_receipts.json. This is a prospective-within-archive comparison on one pair of bead-size changes, not a measurement of the vertical concentration field or a deployment prediction across rivers, grain shapes or apparatuses.
