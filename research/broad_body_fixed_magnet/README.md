# Does a gyroscope identify a body-fixed magnet well enough to improve heading?

A rolling estimate of a magnetic offset reduced average heading error on four BROAD recordings with magnets attached at 1, 2, 4 and 5 cm. The genuine default VQF scored 3.610° and the rolling correction scored 2.247°. A simpler rolling sphere calibration scored 2.203°, and the gyro correction beat default VQF on only the two closest distances. The registered joint gate failed. Heading deteriorated on three recordings with a magnet fixed in the room and on four clean recordings.

## Whole-trial optical results

Each entry is the arithmetic mean of the per-recording heading RMSE, in degrees, over the organizers' movement intervals. Equal recording weights keep long movements from dominating. All 88 predictions, with 264 per-trial metrics, were scored. The receiver counted 496,397 valid moving optical samples across the 11 recordings. Samples within a recording are dependent.

| Magnetic input to the same native VQF | Attached, four | Magnet in room, three | Clean, four | Attached trials won by gyro correction |
|---|---:|---:|---:|---:|
| Default raw magnetometer | 3.610 | 2.460 | 2.529 | 2/4 |
| First 20 s of magnetic data, then inertial | 5.354 | 10.053 | 20.518 | 4/4 |
| Fixed first-60-s gyro calibration | 2.869 | 9.926 | 3.760 | 4/4 |
| Rolling axis midpoints | 5.400 | 2.460 | 2.529 | 2/4 |
| Rolling algebraic sphere | **2.203** | 2.513 | 2.545 | 2/4 |
| Released full hard-/soft-iron ellipsoid | 3.106 | 2.460 | 2.534 | 3/4 |
| Rolling gyro, time-shifted training rotations | 3.208 | 2.460 | 2.563 | 2/4 |
| Rolling gyro correction | 2.247 | 7.455 | 3.645 | — |

| Magnet distance (recording ID) | Default VQF | Sphere | Rolling gyro |
|---|---:|---:|---:|
| 1 cm (32) | 7.652 | 4.261 | 3.233 |
| 2 cm (33) | 3.704 | 2.620 | 2.003 |
| 4 cm (35) | 0.864 | 0.906 | 1.464 |
| 5 cm (36) | 2.219 | 1.026 | 2.290 |

The gate required a lower attached mean and at least three strict wins over each of the seven comparators, plus at most 0.2° mean and 1.0° individual degradation against default VQF on both the room and clean groups. Both retention gates failed. These distinct motions were recorded once per distance on one apparatus. They do not estimate a magnet-distance response curve independent of motion.

## A magnetic fit can improve while heading worsens

Room-magnet trial 31 had 74 accepted gyro correction intervals. Its heading RMSE rose from 2.997° to 10.752°. At the worst candidate sample, index 31,748 (111.118 s), the recorded magnetic vector was [6.784, 40.466, −17.543] µT and angular velocity was [8.711, −5.823, 0.153] rad/s. The optical quaternion in scalar-first order was [0.83109, −0.31945, −0.24696, 0.38244].

| Method | Absolute optical heading error at this same sample |
|---|---:|
| Default VQF | 6.14009° |
| Initial field then inertial | 7.68778° |
| Fixed 60 s gyro | 21.46879° |
| Rolling midpoint | 6.14009° |
| Rolling sphere | 6.14029° |
| Rolling ellipsoid | 6.14009° |
| Shifted gyro control | 6.14009° |
| Rolling gyro | 18.58367° |

Two samples earlier the gyro fit accepted an offset [4.8254, 0.3432, −1.2095] µT. On the preceding validation interval its vector prediction RMSE had improved from 6.1236 to 4.2158 µT. The uncorrected and gyro-corrected VQF magnetic-disturbance flags were both zero at the worst sample. Heading includes accumulated filter history, so this particular two-sample-old change alone cannot explain the 18.58° error. The raw observation shows where local magnetic predictability and optical heading accuracy disagreed. The complete role outputs, flags and two previous accepted decisions are in `worst-source-decisions.json`.

## Physical assumptions and source checks

With known rotation Q mapping the older sensor frame to the current frame, a constant world field and a constant additive body bias b imply m(t) − Q m(s) = (I − Q)b. Rotations around only one axis leave the parallel component of b unidentified. Synthetic one-axis rotation hid an 8 µT component. Multi-axis rotation identified the synthetic offset to 3.55×10⁻¹⁵ µT. An anisotropic sensor matrix S generally gives SQ ≠ QS. Spatial field gradients, inaccurate relative rotation, changing magnet attachment and clipping each invalidate a premise of the transport equation. Checking the supplied ±1 mT range only screens sensor-scale excursions.

Three development recordings used only gyroscope, accelerometer and magnetometer inputs. On the 3 cm recording, the fixed first-60-s gyro fit estimated [−0.68, 0.45, 13.36] µT. Its subsequent 0.49 s magnetic forecast RMSE was 8.574 µT against 8.782 µT with no offset. Four well-excited successive windows had z-offsets 13.4, 13.5, 2.7 and −0.5 µT. The public recordings contain no per-sample magnet-mount switch. The recording label cannot establish invariant on/off epochs. The rolling method accepted 51 windows on this development recording and none on the source room and clean recordings. Its false corrections on other room/clean movements were prospective failures.

All eight roles used the released VQF 2.1.2 C++ implementation with its default parameters. Corrections were estimated from an 8.008 s trailing training segment and screened on a disjoint 4.004 s past segment. A new decision occurred every 1.001 s. The rotation lag was 0.49 s. Every rejected window used raw magnetic measurements. Trial identity, optical orientation, movement mask and magnet distance were unavailable to the estimator. The source-day and parameter qualification, full method definition and retrospective worst checks are in the registered protocol and receipts. A deliberate source-input change after 80 s left preceding corrected values unchanged. The complete equations and numerical admission conditions are in `rolling_field.py`.

The source qualification retained two failed originals. An initial synthetic rotation fixture supplied an incompatible Euler-angle shape and produced no physical outcome. A separate JSON diagnostic could not serialize an ellipsoid bias returned with a complex dtype. A new source-only receiver checked its imaginary component; all three observed source recordings had exactly zero. The frozen physical implementation accepts that case and otherwise falls back to raw magnetic input for the ellipsoid role.

## Reference frame, timing and measurement boundary

BROAD used a handheld rigid board, a 120 Hz OptiTrack system and five markers. The released data align optical orientation with the IMU through separate daily all-direction recordings. That calibration includes a magnetic heading reference. Gyroscope and optical angular-speed traces supply each trial's clock offset/drift alignment; optical quaternions are resampled to the IMU clock, 2,000/7 Hz. The optical orientation is an independent motion measurement in that aligned frame. These published, sensor-assisted frame/time calibrations constrain claims of absolute magnetic independence and online deployment. The forecast used the three IMU arrays plus sampling rate only. The source MAT byte stream contains all variables; the forecast decoder selected the IMU variables and left the optical and movement arrays unmaterialized.

The registered 11-record split left the optical quaternions and official movement masks sealed until all native output arrays had been fixed. The dataset and VQF already have a public evaluation history. The four-distance split is new to this calculation, not an unseen historical benchmark. The full-array receiver retained per-role heading, inclination and total RMSE, every worst moving sample and each method's heading error at the candidate's own worst sample. The official scorer and an independently derived relative-quaternion calculation agreed within 3×10⁻⁷° for all 264 scalar metrics.

## Reproduce the result

Run `python3 replay.py` here to authenticate the recorded inputs to the recount, verify all prediction identities and score summaries, and reconstruct the gates with the Python standard library. The per-recording and raw same-sample values are in `official-optical-scores.json`. The original native producer's 88 full-array SHA-256 values are in `forecast-lock-owner-original.txt`.

To rebuild the full forecast, use Python with NumPy and SciPy, g++ with C++17, and network access to the source-pinned public GitHub files. Use `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 physical_gate.py forecast native-factors.zip`. Run `python3 physical_gate.py score native-factors.zip --sha SHA256` with the actual archive digest. Cross-platform BLAS, compiler and libm differences can change the last bits in a fresh numerical construction. The original factor archive on the native execution worker has 56,556,288 bytes and SHA-256 `5724d2783acd7315202ca63b205acb7f52c56f4977522f729982d44f36096df0`. This Git tree contains its identification and scores. Before scoring, the original receiver rehydrated the full arrays with the genuine VQF quaternion operation, verified their byte hashes, and checked the complete archive inventory. The forecast and optical receiver have separate native original identities in `custody.json`.

The producer used 8.16 user CPU seconds and 0.28 system CPU seconds, with 205,230,080 bytes maximum resident memory for its largest waited process. The optical receiver used 3.45 user and 0.32 system CPU seconds and 129,798,144 bytes on the same basis. The separate worst-sample receiver used 0.10 CPU seconds. These costs omit upstream acquisition, source qualification and queueing.

The primary sources are the [BROAD dataset and measurement paper](https://www.mdpi.com/2306-5729/6/7/72), [pinned data and scorer](https://github.com/dlaidig/broad/tree/7e2f8189bb4a3ac91eae32c69b6bc87f08a6e2ad), [VQF source](https://github.com/dlaidig/vqf/tree/86ba56bdd3158b9b05f9f9fe5596866ba326438c), and [released ellipsoid implementation](https://github.com/nliaudat/magnetometer_calibration/tree/bd96a8973553ed5cad13b5bd7385b2ab0f74fdb4).
