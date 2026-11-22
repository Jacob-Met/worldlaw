# Does a Coulomb friction term transfer across mounted double-pendulum recordings?

On the three test files from Kaheman and colleagues, adding a smoothed Coulomb term to the two viscous joint torques improved short forecasts in one recording. The released author model had the lowest mean angular error. The Coulomb model reduced mean restarted velocity error but increased the error in the full-record mechanical energy computed with the author parameters. The preregistered joint decision was negative.

## Results

Each row is one fixed model. The table gives angular RMSE in radians over both arms for forecasts restarted every 2,667 samples. Each recording carries equal weight in the mean. The last column measures full-record open-loop energy RMSE in author-model joules.

| Joint torques | Record 1 | Record 2 | Record 4 | Mean angle | Full-record energy |
|---|---:|---:|---:|---:|---:|
| Released author viscous model | 0.025640 | **0.012093** | **0.008896** | **0.015543** | **0.084880** |
| Refit viscous | 0.024020 | 0.014198 | 0.011225 | 0.016481 | 0.137427 |
| Refit viscous + quadratic | 0.024684 | 0.014761 | 0.011413 | 0.016952 | 0.145698 |
| Refit viscous + smoothed Coulomb | **0.023452** | 0.013515 | 0.010780 | 0.015916 | 0.126254 |

The Coulomb model beat the other two models fitted on record 3 alone in mean restarted angle error. Its error was 2.40% higher than the archived model, against a requirement of at least 5% improvement. It lost on records 2 and 4, and its full-record energy RMSE was 48.74% higher than the archived model. Restarted velocity RMSE was 0.122251 versus 0.125498 rad/s for the released model. Halving the integration step passed the predeclared numerical control.

The largest combined restarted angular error for the Coulomb model occurred in record 1 at 10.417 s. The measured angles were (3.051039, 3.163010) rad and the forecast was (3.117199, 2.751028) rad. At that instant the second arm moved at 14.741506 rad/s. The largest combined angular errors in records 2 and 4 occurred at 2.386 s and 2.403 s. The frozen evidence gives all observed and predicted state components at every stream's worst row, along with all 2,556 fixed-block error triplets.

## Record and model provenance

The release documents the four numbered recordings as free-swing experiments with the cart mounted and stationary. Their shared in-file clock advances at 1 ms from zero, with both angle channels and both recorded velocities on those rows. Record lengths are 170,834, 182,529, 150,020 and 208,921 samples. The result concerns prediction on files 1, 2 and 4 from this apparatus. File names, relative-clock resets, MAT save dates and absence of matching sample windows do not establish that each file begins at a separately witnessed physical release. The slow-motion video has no verified synchronization with these encoders. The archive does not establish transfer across independently assigned release amplitudes. [Source archive](https://doi.org/10.5281/zenodo.6633719) · [Apparatus and parameter identification](https://doi.org/10.1016/j.ohx.2023.e00465)

An opaque byte comparison found all 26 author identification segments and all four validation segments, both angle channels in full, in record 3. The first starts at zero-based row 10,000. The other three records shared no full or first-512-sample segment with the author matrices. Across the four records, 1,262 informative paired-channel 512-sample windows had zero matches in the three other files apiece. These exact comparisons detect repeated stored data. They cannot rule out a transformation, resampling or disconnected excerpts from a common recording. The single-arm and triple-arm files yielded no qualifying prepared-segment match and contributed no numerical outcome.

The author preparation script passes the two measured angles through unchanged and denoises only velocities. The live optimization document passes its prepared state matrix to the objective, which initializes each segment from its first four-state row and calls MATLAB ode113 with DoublePendulumODE_Mounted. We used those four exported channels without an angle offset. The public comparator uses the archived ten-parameter file. Its first mass and both inertias fall below the lower bounds in the released live optimization document; the document's example save instruction is commented and names a suffixed file. The archive therefore establishes the parameter vector and callback, while the optimization invocation that produced this particular vector remains unverified. Only the three refitted models have demonstrable record-3-only calibration. The C integration here evaluates the released right-hand side under a common RK4 protocol. It does not reproduce MATLAB's step selection or the authors' training objective.

## What the models use

The first joint velocity is the absolute velocity of arm 1. The second is arm 2's velocity relative to arm 1. All models use the same mounted mass matrix, gravity, geometry and inertia. The public executable and the released symbolic script use different gravity signs at the same written angles. For example, with both angles at π/2, zero velocity and unit parameters, the executable returns accelerations (+3/5,+1/5), while the displayed down-zero potential gives the opposite pair. The full prediction and energy comparison uses the executable's positive-cosine potential and the cross-link kinetic term. It makes no claim about an independently measured encoder zero. The exact check covers 91 rational states and the independent compiled comparison covers 257 more states at the archived physical parameters, with maximum absolute acceleration difference 4.98e−14 rad/s².

Each refit uses nonnegative least squares on the same 150 complete one-second work intervals from record 3. The targets are differences in mechanical energy computed using the archived mass and inertia. The explanatory variables are trapezoidal joint work integrals under the chosen friction law. The extra quadratic term is proportional to velocity times absolute velocity. The Coulomb term uses tanh of velocity divided by 0.157080 rad/s, the nominal angular speed of one encoder count per sampling interval. The work RMSEs on record 3 were 0.002477, 0.002076, 0.002061 and 0.002067 model-joules for the table's four rows. All three refits assigned zero viscous damping at joint 1. Record 3 had one measurement trajectory, so its 150 work intervals provide no independent-release uncertainty estimate.

Scaling all masses, inertias and two damping coefficients together leaves the mounted accelerations invariant. The code checks equal algebraic degree in every addition in both released acceleration expressions. Energy and work scale with that multiplier. The reported energy is therefore a model-derived quantity conditional on the archived scale. The study did not measure dissipated heat or absolute friction torque.

Each method starts its full open loop from the first recorded state and its short forecasts from the first recorded state of each 2,667-row block. The final partial block and all initial rows are included. Later observations do not enter a forecast before its next scheduled restart. Wrapped angular error uses the principal angular difference. The test contains 562,284 rows, 24 primary four-state forecast streams and 12 half-step control streams. The outcome and raw worst cases remain unchanged under an independent recount from all 36 stored forecasts.

## Reproduction

Run the compact recount from this directory:

```sh
python3 replay.py
```

The full replay downloads the original Zenodo members using verified ranges, checks the four MAT file SHA-256 values and the archived coefficient file, rebuilds the mounted solver, fits record 3, locks its calibration and predicts all three test records. It verifies each of the 36 streams' file-level and fixed-block error triplets against the frozen evidence. A C compiler and network access to the archived release are required.

```sh
uv run --no-project --python 3.12 --with numpy==2.2.6 --with scipy==1.15.3 -- python replay.py --physical
```

To repeat the byte-level source attribution without interpreting any numerical angle, run `uv run --no-project --python 3.12 --with numpy==2.2.6 -- python source_lineage.py`. It checks all eight free-swing files against the three prepared datasets and reads the double-arm clock fields.

The files include the prospective protocol, training residuals, per-stream metrics, all window errors, raw worst states and individual array digests. The original native run used protocol post 180722, pretest calibration lock `ab5b13283dd8ebea6f4c6a2a073be956329c9db95c343ea904b4f047feae10c4` and result SHA-256 `604319357f9a8191448c784a82701ee0e1346400869279cba4cafdb6f8842ab0`. Its full 218,705,214-byte forecast and source archive was read back with SHA-256 `f51a9f2e7ee124aab0f337602b3aef5055566dbf12fb6a62f3633a09f547aae6`.
