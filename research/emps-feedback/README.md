# Identifying the feedback shortcut on the EMPS positioning stage

The Electro-Mechanical Positioning System records a prismatic joint under a digital feedback controller. The training and pulse recordings each contain 24,841 samples at 1 kHz. The second recording repeats the nominal reference and introduces a pulse signal. We measured how much of its position trace can be reconstructed from the logged motor voltage and the training reference at the original sample index.

## Reproduce the diagnostic

Use Python, NumPy and SciPy with the two original MATLAB recordings. The receiver checks the training SHA-256 and the evaluation Git blob before loading the records. Its three roles are the source reference, the controller inverse and the same inverse with the source reference circularly shifted by 100 samples.

```sh
python research/emps-feedback/audit_feedback.py DATA_EMPS.mat
python research/emps-feedback/audit_feedback.py DATA_EMPS.mat --pulse-mat DATA_EMPS_PULSES.mat
```

The frozen inverse uses the nested control gains in the training file. With reference $r_k$, voltage $u_k$, sampling period $h=0.001$ s, and position $q_k$, its recurrence is

$$
\hat q_k=\frac{k_p r_k+\hat q_{k-2}/(2h)-u_k/k_v}{k_p+1/(2h)}.
$$

The estimator starts at zero and applies one additive position correction using sample 19. It scores rows 20 onward. It never reads an evaluation reference or updates its state from later measured positions. The same-step derivative with respect to logged motor voltage is −6.222 µm/V. A positive independent motor force accelerates this physical stage forward. The opposite sign identifies the inverse as an estimate of position consistent with the recorded controller action.

The acceleration estimates depend on the differentiation window and encoder quantization. The seven training reversals recur every 3,120 samples. The near-stationary intervals covered only 3–8 consecutive samples across the tested derivative windows. At 3.113 s the inferred motor force was −65.51 N and a seven-sample quadratic estimate of inertial force was −65.22 N. The encoder step was 50 nm. These repeated crossings leave friction history, differentiation and delay confounded. With the two measured initial positions used only in a training diagnostic, inversion reached 18.5 nm RMSE on the last third of training. The registered zero-initial-state, sample-19-anchored inversion gave 0.001172 mm across the training score window.

## What the pulse recording shows

On the 24,821 scored positions, the training reference alone reached 0.650940 mm RMSE. Incorporating the logged controller voltage brought this to 0.090754 mm. Shifting the same reference by 100 ms increased the error to 10.636909 mm. On the worst inverse row, at 24.840 s, the stage measured 0.0037438994 m and the inverse predicted 0.0036149148 m. The signed error was −0.128985 mm. The first 250 scored rows gave 0.001138 mm RMSE. These values describe one recording of the same stage under the repeated reference.

| Inputs and model | Position RMSE (mm) | Worst signed error (mm) | Original sample |
|---|---:|---:|---:|
| Voltage, original dynoNet source fitted for 50,000 steps | 13.887121 | +36.710689 | 24390 |
| Voltage, released symmetric physical parameters | 9.170842 | −22.398529 | 24840 |
| Voltage, released asymmetric physical parameters | 9.330413 | +16.238912 | 16130 |
| Voltage, later author checkpoint executed with native initialization | 7.020317 | +42.430659 | 20 |
| Released PNARX predictions, independently rescored | 2.651596 | +5.964755 | 2338 |
| Training reference only | 0.650940 | −1.211426 | 23370 |
| Training reference and voltage, controller inverse | 0.090754 | −0.128985 | 24840 |
| Training reference shifted by 100 ms and voltage, controller inverse | 10.636909 | −18.558582 | 14843 |
| Voltage-derived force plus pulse marker, symmetric parameters | 139.972854 | +233.209056 | 24840 |
| Voltage-derived force plus pulse marker, asymmetric parameters | 161.214984 | +270.660402 | 24840 |
| Voltage-derived force plus marker shifted by 100 ms, asymmetric parameters | 163.785311 | +272.663042 | 24840 |

The later checkpoint's largest error occurred at the very first scored row. It predicted 0.04274747 m against 0.00031681 m. Its released workbook reports 5.011 mm on its historical protocol. Our 7.020317 mm is the observed result of running the published epoch-24,000 checkpoint with the pinned operators on this file. The PNARX row reuses the authors' saved predictions and exactly recovers their stored 2.651596 mm. An independent process checked every role's original worst sample and recomputed all 11 RMSEs within 2.85 × 10⁻¹⁴ mm. A second machine reconstructed the three schedule roles and the PNARX score from the published sources.

### Why adding the pulse marker fails

The archive contains a pulse marker with 25 onsets and values 0 and 5. The preregistered force-sum arm assumed it represented an additional force to add to the already logged command. At 24.840 s, the marked input was 5 and the logged command was −0.889865 V. The asymmetric sum arm predicted 0.27440430 m against 0.00374390 m. All of those original outcomes are retained.

The organizer's validation model explains the input distinction. In the supplied Simulink model, the recorded pulse signal feeds a sum *after* the saturated controller command. The sum feeds both the simulated command logger and the plant, whose first block multiplies by the motor gain. The validation script compares logged force as `gtau * vir`. Adding the marker again changes that prescribed input. The MATLAB comment labels the pulse in newtons, while the executable diagram sums its numeric value before the N/V gain. This establishes the published signal path. The experiment did not independently calibrate force on the hardware.

A postscore check subtracted the same-step reconstructed controller force from the logged motor force. Over the scored suffix, subtracting zero, the numeric marker as newtons, or its negative left 126.442, 122.894 and 129.990 N RMS. Subtracting the marker multiplied by the motor gain left 1.741 N RMS. Following the Simulink diagram's single unit delay and ±10 V saturation before adding the marker gave 4.018 N RMS. Neither identity was exact on the recorded hardware. The off-marker residual was 0.164 N RMS. In the first diagnostic the source marker's unsigned 8-bit dtype wrapped the negated value from −5 to 251. The signed float64 recount above corrects that arm and preserves the original diagnostic as failed. No prediction was refitted. The validation model was `Simulink_EMPS_Rigide_Pulse.slx`, SHA-256 `548f838ad85dc9fac38a092df03755827d3c2e76bd8a9ba89a7de36c529fd9e3`.

The held reference was used only for a postscore wiring check. It agreed with the source reference to 6.67 × 10⁻¹⁶ m maximum absolute difference. The suffix positions were available to the trusted extractor, which returned only the first 20 positions to the predictors. The controller inverse reconstructs the trajectory under this logged feedback action. It cannot show what the plant would do if an experimenter independently changed motor force.

### Frozen identities

The organizer archive SHA-256 was `f0e575c2aba2cb1e236516eefb17674b7e1e4a28de6bfcdc5b5ad68193ef9f59`. Its pulse recording (`0eab75bb1f6b16228ee78791343a88bf9bfd9a51036ac9807d7b5fc11c0e1704`) was byte-identical to the author's independently fetched Git file. The nine experimental predictions (`745e380b1964b8d361eb60ffd7e57a15c106a6abbfe7ac06f74274ebb08127da`) and two supplemental predictions (`5f9786d55427f7495a74247587d50881367db8b9369571b4cc272a7016f3f384`) were committed before scoring. The full training fit took 831 s on one CPU core and produced checkpoint `3db66c465d8b7e2de17088871ea55d2f79fbaabf8232a8274f002b1e19457ab8`. The later released model used the dynoNet operators from `forgi86/dynonet@56699401b141065a45403a18977333e0ec8d7303`.

## Source and comparator scope

The public evaluator scores `1000 * RMSE` over rows 20 onward. The measured `vir` signal is motor voltage. The recorded gain is 35.1506518825 N/V. Each comparison identifies whether it receives only voltage, the known source schedule, or a second copy of the recorded pulse marker. All methods had the same 20-sample observed-position allowance. The nine registered experimental roles use the sample-19 anchor. The supplied 2024 dynoNet uses its native zero-history IIR initialization. The supplied PNARX prediction omits its first six lag rows and is compared at the original sample indices.

The original released dynoNet EMPS training script fits a 1→10 dynamic bank, a 10→5 static map and a 5→1 dynamic bank. Its companion EMPS test script at commit 56699401 ignores the selected pulse path and labels unconverted metres as millimetres. The comparison here actually runs the frozen full 50,000-step training budget and reads the pulse file through the corrected receiver. The historical paper describes a different architecture. Another released dynoNet baseline uses a distinct model and checkpoint. DS3M's reported 1.8 mm uses a learned encoder over the allowed 20 input/output samples. That published result has a different training protocol and no matched checkpoint was available here. [DS3M, Table 4](https://arxiv.org/abs/2611.25274)

[Public EMPS benchmark and scoring package](https://github.com/MaartenSchoukens/nonlinear_benchmarks/tree/f9fb3883086870a27b31917ccde1f78c95d53cb2) · [Measured recordings and preprocessing](https://github.com/forgi86/sysid-neural-continuous/tree/956aa7ecd73061b0321c6f6098d74c9e4a7ce67a/examples/EMPS) · [Original dynoNet source](https://github.com/forgi86/dynonet/tree/56699401b141065a45403a18977333e0ec8d7303) · [Released later baseline](https://github.com/dariopi/dynonet_baseline/tree/4b4d609d65a2f9015828efedf6e9f7fce2c35cfe) · [Released PNARX trajectory](https://github.com/MDCHAMP/nonlinear_baselines/blob/d9c4972f6bd59cfdde23a014bc57579e2af957aa/results/PNARX_EMPS.npz)
