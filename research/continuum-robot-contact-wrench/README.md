# Base bending moment during measured contact with a continuum robot

The authors' measured-pose wrench transformation was the most accurate model of the passive push-and-retract path. Its whole-record planar moment RMSE was **0.013526 Nm**, compared with **0.021483 Nm** after adding a mounting calibration and the published component masses. Its peak error was 0.027444 Nm. The shared mounting correction alone gave the smallest peak, 0.026820 Nm, below the component model's 0.027534 Nm. The component model failed both registered gates.

The primary experiment is one 2,840-sample recording of a downward-hanging, 0.48 m tendon-driven robot. The tendons were released while the operator slowly pushed its tip with a tracked wand. A Resense HEX 12 measured the wand wrench. An independent ATI mini40 under the robot's base measured the reaction. All 2,840 samples counted. The three actuated contact paths provide separate stress tests. A path, rather than a camera frame, is the physical evaluation unit. The [prospective protocol](prospective.md) specifies the comparisons.

## Complete passive result

The error vector contains the two transverse bending moments, Mx and My. RMS and maximum are over its Euclidean magnitude. The author-contact column uses the source's 5 cm tip-to-wand mask, comprising 2,181 samples. The primary decisions used the whole record.

| Frozen arm | Whole RMS (Nm) | Maximum (Nm) | Author-contact RMS (Nm) |
|---|---:|---:|---:|
| Measured-pose adjoint, as published | **0.013526** | 0.027444 | **0.015395** |
| Adjoint plus shared mounting correction | 0.021168 | **0.026820** | 0.021282 |
| Uniform 102.00 g distribution | 0.024445 | 0.036212 | 0.025437 |
| Uniform 101.27 g distribution | 0.024355 | 0.035973 | 0.025325 |
| Component 101.27 g distribution | 0.021483 | 0.027534 | 0.021680 |
| Linear disk-kinematics model | 0.040644 | 0.088690 | 0.041935 |
| Nonlinear disk-kinematics model | 0.042767 | 0.111527 | 0.043928 |

Distributing mass over the individual components reduced RMS by 11.79% relative to the equal-total uniform arm. That comparison holds total mass, observed geometry, shared fixture calibration and filter fixed. The improvement did not extend to the published adjoint. On the three additional paths, component-model RMS was 0.103941 Nm (midway contact), 0.106627 Nm (x poke) and 0.103251 Nm (y poke). The adjoint's respective errors were 0.062689, 0.059511 and 0.054886 Nm. Those motor-driven movements include tendon and dynamic loads.

At 11.31 s, the worst passive component-model sample, the true filtered (Mx, My) was (0.041194, −0.039208) Nm. The predictions were (0.057256, −0.053067) for the raw adjoint, (0.035419, −0.061680) after mounting calibration, (0.005526, −0.034538) after adding uniform 101.27 g, and (0.013809, −0.042067) after adding the discrete distribution. The tip was displaced to (−0.065076, −0.081522, 0.467173) m. For torsion about z, the passive whole-record RMSE rose from 0.000768 Nm with the published adjoint to 0.055146 Nm with the shared fixture correction. Source-frame gravity adds no z torque, so that discrepancy is common to the mounted physical arms. The complete trace includes measured positions, the two source filtering levels, and all three predicted moment components for every arm. [All 2,840 samples](push-retract.csv)

## What the instruments and models supply

The authors' v3 processing records seconds, positions in metres, forces in newtons and torques in newton-metres. The processed wand pose already includes the fixed optical-to-sensor rotation Rx(π/2)Rz(π/6) and translation (0, −0.1137, 0) m. The adjoint rotates the wand force and local torque, applies the action–reaction sign, and adds the lever-arm cross product about the base. The released comparison applies a fourth-order 2 Hz zero-phase filter after the coordinate transformation, on top of the released 15 Hz, 100 Hz-resampled arrays. The acquisition systems timestamp on a common host wall clock. The ATI voltage channels are tared using ten initial samples and calibrated after five-sample averaging. The processor corrects the ATI block timestamp by 2.5 ms. Absolute axial pre-load is unobserved. A real-time controller would have a different information and latency contract.

The shared mounting correction was trained once on the distinct, tendon-released *touch_base* recording (2,993 rows). A six-parameter full-rank linear solve gave an effective displacement of (−12.66, 99.49, 3.39) mm and torque shift of (−0.019998, −0.007953, 0.050031) Nm. These fitted quantities do not identify a physical mount defect. All subsequent arms received the same correction. Each recording's first 100 processed disk positions supplied the pose reference for the estimated change in gravity moment. No held ATI values supplied tare, timing, masks, mass or calibration.

The component model uses the published rod mass of 5.90 g, base disk 41.22 g, seven intermediate disks of 5.25 g, tip disk 8.90 g and five optical marker sets of 1.70 g. Five disk centers are measured at 0.12 m intervals. Linear interpolation gives the other four disk centers; trapezoidal integration distributes the backbone mass. Marker centers of mass and the assembled first moment have not been independently measured. The released GVS model uses an effective *uniform* 102 g rod, so the study includes that value and a 101.27 g uniform control matching the component total. The v3 GVS solver consumes differential tendon tensions and sets the imposed tip wrench to zero. Its unmodified free-motion simulation cannot reproduce the measured wand loading.

The learned controls use measured disk positions and their offline first and second derivatives. A linear ridge and a 96-feature nonlinear ridge were fitted on all 16 quasi-static and 10 dynamic noncontact paths. Four-fold whole-path validation selected 0.0001 for both. Model weights and the seven forecast arrays for all four contact outcomes were saved and independently hash-read before opening any of the four held ATI traces. The original model and forecast hashes, each path's complete score table and all worst-row vectors are in [contact-original.json](contact-original.json) and [custody.json](custody.json).

## Reproduce

Obtain **data.zip** from Gotelli et al., *Multi-sensor dataset of a tendon-driven continuum robot in dynamic motion*, Figshare v3. The archive is 2,693,612,410 bytes, MD5 598cd9441123f9e3152d5d8bb893767c and SHA-256 1255612e370d447ef55105c9b843136c891f00a0dd6817da47484f343ab5a29c. The source data, including the processed values underlying the trace, are licensed CC BY 4.0. Credit Andrea Gotelli, Tongjia Zheng, Angela Peloso, Spencer Teetaert, Puspita Triana Dewi, Greg Zetko, Chengnan Shentu and Jessica Burgner-Kahrs. [Original data and author code](https://doi.org/10.6084/m9.figshare.31990188.v3)

Using Python 3.12, NumPy 2.2.6 and SciPy 1.15.3, run from this directory:

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python replay_contact.py data.zip --trace fresh-push-retract.csv
```

The optional CSV destination must be new. The entry point verifies the complete source archive, rebuilds the seven predictions from their original information sets, then opens the held outcomes. A separate reader recomputes the published adjoint, both uniform moment distributions, discrete component moments, contact membership, all recorded score groups and the peak witnesses. The frozen scientific verdict is preserved even when fresh floating-point model serializations differ in their byte hashes.

The independent reader ran in a fresh process on the original physical worker. It verified five original assets, recounted 110,180 arm-window rows across 35 score groups and reconstructed 244,062 component predictions. The largest difference was 4.43 × 10⁻¹² Nm. Both registered comparisons failed. [Independent receipt](contact-independent.json)
