# Can a rotating-disk polarization law predict a new rotation speed?

A residual-corrected electrochemical model predicted six held sweeps with mean RMSE **10.1489 µA/cm²**. Interpolating the measured source currents at the same voltage in the square root of rotation speed gave **10.0640 µA/cm²**. The corrected model won on three of six sweeps and failed its preregistered joint gate. The uncorrected physical model scored **51.0894 µA/cm²**. The largest error came near the start of the highest-speed platinum sweep and lasted over multiple acquired samples.

## Acquisition and scope

Hideg et al. released 147 raw sweep files for seven bulk pH levels, three metals and seven nominal disk rotation speeds, together with a Mathematica notebook and joint parameter/curve exports. Before inspecting currents, we selected the middle pH, 10.458. For each of Au, Ir and Pt, source speeds were 400, 625, 900, 1600 and 2025 rpm. The held speeds were 1225 rpm for interpolation and 2500 rpm for extrapolation. Each metal and speed has one file in this pH block. These are six sweep-level comparisons from three material groups. The archive roster does not establish six independently prepared electrodes or randomized order. The paper's stepped curve shape, model description and qualitative goodness of in-sample fit were already public. All 126 other raw sweeps and the 21 joint fit exports stayed closed. [Author dataset and fitter](https://doi.org/10.5281/zenodo.18601278) · [Original article](https://doi.org/10.1016/j.jcat.2026.116974)

The recorded columns give time in seconds, applied potential in volts and working electrode current in amperes. The notebook converts current to A/cm² by dividing by π × (0.25 cm)². It multiplies the first-row fourth column by 1,000 to obtain the rotation setting. These 21 converted settings agree with the filenames. No independent shaft-speed calibration was available. All 21 scans descend monotonically in potential. Each role used the actual held voltage and setting. Native row order and time were retained. The held current column was kept opaque through construction and exact prediction lock. The original experiment’s surface history, temperature and instrument drift cannot be inferred from nominal speed alone.

Two pre-score refusals remain part of the record. The first reader compared the unscaled fourth column with the nominal rpm. The next enforced increasing potential although the registered design called for monotonicity. The first failing Au400 sweep has 1,130 consecutive steps of exactly −0.0006103515625 V, decreasing from 1.7494201660 to 1.0597229004 V. The corrected guard accepts either monotone direction, refuses reversals, and validates all 21 input paths before parsing a source current. Both earlier originals stopped before selecting any measured current. Sorting is used only to interpolate source curves by voltage. Every physical score uses the complete original sequence.

## Physical model and controls

The released notebook evaluates the surface hydroxide/proton balances, Nernst diffusion-layer thickness proportional to the inverse square root of angular speed, and a charge-transfer law. Its wrapper solves the ohmic relation between applied and internal potential. In addition to diffusion, reaction rate and transfer coefficient, the notebook estimates solution resistance and charging-current offset. The pinned implementation uses the explicit author unit conversions, the 0.197-V reference potential, 1.229-V standard potential, fixed 25 °C and 13.9918 pKw. All five free quantities were fitted separately per metal using source speeds alone. Numerical closure against a separately calculated flux/kinetic identity agreed within 7.54×10⁻¹⁵ A/cm² on 333 synthetic combinations.

Our full-equations role uses a bounded SciPy least-squares solve on up to 100 equally spaced acquisition indices per training sweep. The filtered comparator uses a current threshold, 50 source indices and the archive-inspired weighting. Mathematica uses its own ArrayResample, weighting and NonlinearModelFit routines. The study runs the released forward equations with disclosed numerical approximations and does not reproduce that exact optimizer or reuse the joint source-plus-held .par fits. The source-initialization constants were publicly embedded in the notebook and their original selection history is unavailable. Fitted parameters are retained in the forecast archive as coefficients of this transfer exercise.

At a common trial current equal to the charging offset, faradaic flux vanishes. The surface concentrations then equal the bulk concentrations. All modeled rotations share an equilibrium internal potential of approximately 0.413 V at this pH, with the applied-potential shift given by resistance × charging current. All six observed voltage intervals lie above the associated fitted crossing. These sweeps therefore do not test that crossing or uniquely identify the OER pathway.

The proposed correction interpolates the two neighboring source residual curves at each held voltage in √rpm and adds them to the physical prediction. At the exterior speed it extrapolates from the upper two source speeds. The matched direct comparator applies the same operation to measured current itself. Their difference is the physical model's deviation from its own local speed interpolation, up to the common within-curve interpolation. This distinguishes the value of the nonlinear physical term from the benefit of simply having nearby measured curves. All roles score every acquired row, including the initial high-potential region.

## Held results

| Sweep | Rows | Corrected law | Local √rpm | Uncorrected law |
| --- | ---: | ---: | ---: | ---: |
| Au1225 | 1142 | 1.0250 | 2.1574 | 16.1765 |
| Au2500 | 1200 | 6.8718 | 7.9933 | 34.7683 |
| Ir1225 | 936 | 3.1346 | 3.4216 | 13.0865 |
| Ir2500 | 914 | 7.2950 | 6.9945 | 32.7421 |
| Pt1225 | 1135 | 5.5781 | 4.3609 | 39.8618 |
| Pt2500 | 1171 | 36.9889 | 35.4564 | 169.9015 |

| Role | Six-sweep mean | 1225 rpm | 2500 rpm |
| --- | ---: | ---: | ---: |
| all source linear sqrt rpm | 19.5235 | 8.4370 | 30.6099 |
| corrected physics | 10.1489 | 3.2459 | 17.0519 |
| current linear rpm | 10.5802 | 5.1592 | 16.0012 |
| current linear sqrt rpm | 10.0640 | 3.3133 | 16.8147 |
| nearest speed | 73.7260 | 66.1158 | 81.3363 |
| notebook equations filtered | 55.9147 | 21.6709 | 90.1586 |
| notebook equations full | 51.0894 | 23.0416 | 79.1373 |
| physics fixed speed | 90.2376 | 63.0010 | 117.4742 |
| physics without solution resistance | 102.3119 | 84.6405 | 119.9832 |
| scaled limiting flux | 42.4394 | 48.2414 | 36.6373 |

All entries are RMSE in µA/cm². Means weight each complete sweep equally. Adjacent voltages and repeated measurements over a shared electrode setting are correlated. At the interior speed the proposed method narrowly improved on local √rpm. At the exterior speed local linear interpolation in rpm, extrapolated from the two upper training speeds, scored 16.0012 µA/cm² and outperformed both. All 6,498 held currents and 64,980 role predictions are retained.

At Pt2500, sample 1 (zero based), 1.598815918 V, the measured current density was **3.201750 mA/cm²**. The corrected model gave 3.084500, local √rpm gave 3.089844, the raw notebook-equations role gave 2.657896 and scaled limiting flux gave 3.162030 mA/cm². The corrected model’s signed error was −117.2503 µA/cm². The first seven platinum samples all underpredicted by more than 100 µA/cm². This is an across-sweep forecast error. The data do not identify its contribution from electrode history, charging, solution resistance or reaction assumptions. All ten predictions at the same worst row appear in `score.json`.

## Reproduction

The source-only protocol is `7eeeb66d`, first frozen implementation `872b688b`, literal rotation fix `532b490a`, direction fix `166617e2`, forecast lock `b76aa811`, original score `43d4661b`. The 1,448,423-byte forecast was locked before the held currents entered the scorer. Run `python3 replay.py .` for exact byte custody and scores from stored rows. Run `python3 replay.py . /path/to/OER_fitter.zip` for the independent check from the four-column measurement files. This needs only Python's standard library. The separate fitting implementation in `model.py` requires SciPy and NumPy. No additional data or calibration fit is required to replay the stored result.

The first standalone independent receiver failed DNS before accessing its source archive. A separate native acquisition authenticated the public ZIP and escrowed its six original TSV members. A workspace execution of an independently implemented CSV reader then reproduced all 6,498 raw rows and 64,980 forecast comparisons, 130 exact metric checks, and the worst index/current with zero scalar discrepancy. The corresponding queued native receiver and the earlier input-only metadata diagnostic retain their original identities separately in `native-originals.json`.
