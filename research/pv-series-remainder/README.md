# Voltage transfer across twenty series-connected photovoltaic mini-panels

Historical component curves plus a learned residual gave **9.6710 V mean run RMSE** on the three held MP4 acquisitions. A direct gradient-boosted predictor achieved **9.3643 V** and a predictor trained on residuals from a Bishop-model sum achieved **9.0635 V**. The candidate failed both registered gates. One unshaded and two differently shaded runs of the same physical string are the three experimental units.

The target is the simultaneous measured array voltage minus the selected panel's voltage, in volts. It includes any leads or contacts between the two probe locations. A reconstruction can add the measured selected-panel voltage to this conditional remainder. Predictors see shared current, previous current, fraction of the sweep, field irradiance/temperature readings and the literal acquisition label. Neither measured voltage enters a held predictor.

| Frozen arm | Development mean / worst run RMSE (V) | MP4 mean / worst run RMSE (V) |
| --- | ---: | ---: |
| Sum of individual historical profiles | 13.4961 / 19.4180 | 12.9535 / 20.5134 |
| Sum of zero-avalanche Bishop components | 34.5130 / 67.5125 | 36.6504 / 71.8949 |
| Nineteen times the pooled mean profile | 13.4358 / 19.4489 | 12.9535 / 20.5134 |
| Direct gradient-boosted trees | 5.8079 / 13.4410 | 9.3643 / 16.9708 |
| Pooled profile plus residual trees | 5.9152 / 11.3315 | 9.4046 / 17.4719 |
| Bishop sum plus residual trees | 5.3376 / 9.0645 | 9.0635 / 17.8357 |
| Individual profiles plus residual trees (candidate) | 6.2265 / 11.3389 | 9.6710 / 17.7804 |

**On MP4, the sum of all nineteen measured component profiles equals nineteen times their mean.** These two held physical features carry exactly the same component information. The respective residual trees learned from different features on the 52 training runs, since each training run removed a different selected panel and imputed the missing MP4 contribution. That training difference accounts for their different held errors.

## Where the transfer failed

The candidate's run RMSEs were 2.1765 V for NS, 17.7804 V for S1 and 9.0561 V for S2. On S1 the uncorrected empirical profile itself achieved 11.7163 V. At zero-based row 312 the measured array was 76.5625 V, the selected panel was −22.1211 V and the remainder was 98.6836 V. At the measured 0.0838125 A the candidate forecast 60.9074 V, an error of −37.7762 V. All five rows sharing that current had measured remainders between 98.0508 and 98.6836 V. At row 54 the array and selected probes read 65.6719 and −32.3789 V, giving 98.0508 V against the candidate's 62.0152 V. The repeated miss does not distinguish temperature, electrical drift, component imbalance, probe response or timing as a cause.

Test 1 was a different measurement campaign. The 57 light curves span 39.9–46.6 °C. The three MP4 runs recorded 56.9, 47.9 and 57.8 °C, respectively. MP4 NS reached 0.14375 A against a pooled 0.11198 A maximum in the historic raw light curves. Even granting linear current/irradiance scaling and bridging all gaps among each panel's three historical sweeps, their simultaneous raw current support included just 640, 644 and 968 of the 1,000 NS, S1 and S2 rows. Test 3 supplies one temperature and irradiance per run and no simultaneous per-member environmental states. Correspondence of raw V/Va sample indices is supported by the instrument acquisition and equal-length probes. There is no archived time axis for an independently calibrated latency estimate.

## Source and split

The version 1 Mendeley archive contains 264 MAT files in paired raw/processed directories. Test 1 lacks every light curve for MP4. Test 3 lacks all MP7 runs and S2 for MP2 and MP15. Only the three MP4 runs have all nineteen *other* panels characterized. Test 2 measured dark current under positive terminal voltage only. The source states that each module has twelve cells in series. Its data-description and methods text assign opposite physical orientations to S1 and S2, so the analysis preserves the file labels. The assignment of individual cell irradiances and reverse-breakdown parameters remains unknown.

Development used 40 available training acquisitions and evaluated the twelve from selected IDs 8, 12, 16 and 20. Final training used all 52 non-MP4 acquisitions. Each training acquisition received equal total weight. The nine trailing nonfinite current samples at row 1000 of MP1, MP18 and MP19 were counted. All 15 evaluated runs contain 1,000 usable rows. The two forecast archives were sealed before either evaluation score was computed. Development had no admission or tuning role. The data authors published an acquisition/processing workflow and cited the Bishop model family. This comparison uses their processed Test 1 curves and pvlib's actual implementation with separately estimated effective parameters.

Restrepo-Cuestas, Ortiz-Pasos and Durango-Flórez released the data under CC BY 4.0. [Dataset](https://doi.org/10.17632/sc3y5gks5d.1) · [Acquisition and processing](https://doi.org/10.1016/j.dib.2025.111607) · [Bishop implementation](https://pvlib-python.readthedocs.io/en/v0.15.2/_modules/pvlib/singlediode.html).

## Reproduction and original evidence

Run from this directory with Python, NumPy, SciPy, scikit-learn and pvlib 0.15.2. The original used Python 3.12, NumPy 2.5.5, SciPy 1.18.1 and scikit-learn 1.9.1. A local version 1 ZIP can be supplied with `--archive FILE`. The default downloads the 52,947,665-byte archive through the publisher's issued address and checks its SHA256. `--require-original-bits` additionally requires each prediction-vector hash to match the original.

```sh
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 python replay.py
```

The original 182835 development and final jobs both refused before sealing any predictions. The zero-avalanche term in pvlib 0.15.2 evaluated zero times an undefined power on 651 of the prescribed 2,101 diode-voltage samples. The pre-score successor 182861 set the unused breakdown voltage to negative infinity with the coefficient still zero. On a synthetic full-domain control, all 1,450 finite original values were bit-identical and the corrected values agreed with the explicit limiting formula within 9×10⁻¹⁶. No physical coefficient, numerical grid, dataset, split or score changed. The successor locks were registered together in 182874. The two completed fits took 3.70 and 4.22 seconds on their native worker; each fitted 19 diode components using 550 total solver evaluations and four tree ensembles. The two failed attempts also incurred computation.

The original result includes all seven arms for every run, their raw worst rows and the actual comparison gates. A separate worker read the original MAT5/NPY formats independently and reconstructed all 105,000 errors and all 105 signed worst witnesses. The largest difference from the native summary metrics was 1.43×10⁻¹⁴ V. The registered protocol, exact individual forecast hashes, input support ledger, raw result and custody receipts accompany this entry.
