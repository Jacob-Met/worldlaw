# Can an electrical startup correction improve a motor-temperature observer?

A seven-input observer estimated permanent-magnet surface temperature on four complete Paderborn motor runs. The new correction averaged **3.689 °C RMSE**. A simpler correction, initialized halfway between measured ambient and coolant temperatures and relaxed toward the firmware prediction with a 600-second time constant, averaged **3.119 °C**. All four registered admission decisions failed. The three designated test runs remained sealed.

## What was observed

The publisher reports a torque-controlled 52 kW permanent-magnet synchronous traction motor, a speed-controlled load motor and 2 Hz samples. The reference labeled `pm` averages four surface temperature sensors around one magnet. Each profile is one recorded session on this motor. Training used 1,224,499 rows across 62 profiles. Development used 42,413 rows across profiles 19, 45, 52 and 67. The remaining 63,904 rows in profiles 60, 62 and 74 contributed only their IDs and counts. The released firmware used the four development profiles for early stopping, which limits their independence as a benchmark of that firmware. No new predictor used development labels to select its weights or hyperparameters.

The observer received ambient and coolant temperatures, archived d/q voltages and currents, and shaft speed in mechanical rpm. Each profile reset the observer at its first sample. Inputs at the same instant as the target were available. Torque, prior rotor temperatures and future samples were excluded. The Paderborn authors' separate thermal-neural-network demonstration starts with four true target temperatures, includes torque and scales electrical inputs using all profiles. That demonstration and the paper's vector-norm experiment have different information budgets. We did not reproduce a matched thermal-network benchmark. [Dataset and license](https://doi.org/10.34740/KAGGLE/DSV/2161054) · [Thermal neural networks](https://doi.org/10.1016/j.engappai.2022.105537) · [Authors’ demonstration code](https://github.com/wkirgsn/thermal-nn/tree/531f2275adcbb9ad562dd59cb1c8043630ae0e11)

The pinned host entrypoint runs the distributor's C feature filters and both released estimators. At start, each exponential filter takes its first observed input as its history. In training profile 21 at one second, the float model gave 58.299 °C against 20.879 °C measured, at 4,500 rpm. The opposite assumption also failed on genuinely warm starts. Training profile 47 began at 72.303 °C while its mean ambient and coolant temperature was 36.963 °C, at essentially zero shaft speed. The full starting-temperature offsets across training profiles extended from −8.479 to +35.340 °C. Unknown prior operation limits what a reset can infer. [Released firmware and training method](https://github.com/pavanyadava007/motor-temp-edge/tree/8f57a3197515ece6c2d0ad93d3a6b64efabedf3c)

## Seven estimators on identical rows

The generic correction fits a histogram gradient-boosting model to the float firmware's training residual. Its predictors are the firmware's 50 instantaneous/filtered features, two float outputs, elapsed time capped at 3,600 seconds and the first seven inputs. The four extra relaxation times are 30, 120, 600 and 1,800 seconds. The additional ridge fits use temperatures, currents, initial float PM estimate, startup speed and a regularized voltage/speed proxy. With signed mechanical speed expressed in thousands of rpm as w, the proxy is wu/(w²+0.3²). Speed-weighted time accumulates elapsed seconds multiplied by 1+min(|rpm|/3000,2) using the preceding sample. The three expanded arms share training rows, initial predictors, regularization and generic residual. Only the clock or voltage axis changes. Each training profile gets equal total weight, sampled at every 16th row. No method reads a temperature target at inference.

| Estimate | Mean of profile RMSEs (°C) | Mean of profile worst-1% absolute errors (°C) |
|---|---:|---:|
| Released float C | 3.8114 | 8.2171 |
| Released int8 C | 3.8500 | 8.4755 |
| 600 s initial-temperature correction | **3.1186** | **6.3482** |
| Generic residual boosting | 3.6874 | 8.1565 |
| Extra relaxation, elapsed time, q-axis | 3.6909 | 8.1540 |
| Extra relaxation, speed-weighted time, d-axis | 3.6822 | 8.1338 |
| Candidate, speed-weighted time, q-axis | 3.6894 | 8.1485 |

Four separate requirements were registered before opening development inputs. The candidate needed a 5% reduction in mean profile RMSE against the strongest comparison method, no profile exceeding its best comparator by more than 5%, worst-1% mean absolute error at least as good as the strongest comparator, and no profile exceeding its best comparator by more than 5% after 600 seconds. The per-profile conditions were aggregate decisions requiring all four profiles to pass. Profile 52 accounted for the most pronounced failure.

| Profile | Rows | Candidate RMSE (°C) | Simple-reset RMSE (°C) | Candidate worst error (°C) | Elapsed time of worst (s) |
|---|---:|---:|---:|---:|---:|
| 19 | 10,410 | 2.490 | 3.229 | 5.302 | 412.5 |
| 45 | 17,142 | 3.260 | 3.330 | 7.577 | 6,523.5 |
| 52 | 3,726 | 7.567 | 4.299 | 18.317 | 89 |
| 67 | 11,135 | 1.441 | 1.617 | 3.014 | 4,776 |

At 89 s in profile 52, PM telemetry was 56.855 °C and the candidate gave 75.172 °C. Coolant was already 78.805 °C at reset and rose to 88.779 °C at that row. Even after 600 s the candidate's RMSE was 5.772 °C against 4.494 °C for the simple correction. The simpler method won the aggregate while losing full-run RMSE to the candidate on the other three profiles. All counts refer to correlated time series on one machine. The report retains all seven methods, six slices, three losses and each method's raw worst row with its preceding ten samples where available.

## What the electrical channels can establish

The publisher labels d/q components in volts and amperes and describes a controller following requested torque and speed. The archive does not distinguish terminal voltage acquired by an independent sensor from a command or compensated reconstruction, or establish a Park-axis sign or peak/RMS calibration. A calibrated electrical speed and independently known voltage error would be needed for a magnet-flux interpretation. Under the usual q-axis voltage relation, replace the magnet linkage by λ′m(T)=λm(T)+g(T) and replace the additive voltage error by e′q=e_q−ω_e g(T). This leaves the q-axis voltage unchanged for the observed currents and speed. This identity concerns the seven-input observation model with unrestricted voltage error. A separately calibrated torque or flux measurement can supply additional constraints. The empirical proxy uses only archived signs and units.

## Replay

Use an x86-64 host with Git, GCC, network access to the two pinned public sources and about 1 GB of temporary disk. The CLI downloads the publisher ZIP, checks the full CSV SHA-256, compiles the tracked C weights, recreates training and development streams, stores and rereads the forecast archive before decoding development PM targets, and recounts 296,891 predictions and 504 aggregate values. All four 79-row prefix replays must exactly match the complete run forecasts. The byte lock additionally requires the original native numerical behavior. Research code and compact receipts are included here. The hashed raw publisher archive remains available from its distributor under CC BY-SA 4.0.

```sh
uv run --no-project --with numpy==2.2.6 --with scipy==1.15.3 --with scikit-learn==1.6.1 python research/paderborn-motor-start-observer/replay.py /tmp/pmsm-replay
```

The original prediction archive SHA-256 is `e40a1e992aaea2fea36ac5fb72042cbddc03e02a676f3c8ed028b9e7d93b9b9a`. The 3,725,596-byte source, prediction, label and audit archive has SHA-256 `2277be11d093a69464a7acb389469a7a7d9ddc9938b3be42cea38a0f4cc95888`. The replay computes from the public source archive and does not require access to that audit archive.
