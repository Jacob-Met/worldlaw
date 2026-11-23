# FloWave floor-plate moment transfer across a current intervention

Four wave directions and a measured vertical force gave a full-rank fit to the surface observations in all 62 wave conditions. The fitted model failed all eight criteria on the 31 runs with a current. Its mean complex moment error was **5.205 Nm**, compared with **0.0259 Nm** for scaling the corresponding no-current measurement by the observed vertical force. The maximum errors were 19.345 and 0.0689 Nm. A separate scalar reconstruction from the raw acquisition reproduced all 1,116 condition errors across the three registered clock interpretations.

| Frozen method | Mean vector error (Nm) | Worst vector error (Nm) |
|---|---:|---:|
| matched_donor | 0.025873 | 0.068913 |
| gauges_force_ridge | 0.044007 | 0.127252 |
| joint_flexible | 0.048300 | 0.175703 |
| force_ridge | 0.053534 | 0.183290 |
| joint_two_ray | 0.094573 | 0.366967 |
| surface_two_ray | 0.095457 | 0.289300 |
| joint_four_ray_damped | 0.103329 | 0.372774 |
| joint_one_ray | 0.114561 | 0.366224 |
| zero | 0.129927 | 0.299393 |
| joint_four_ray | 5.204687 | 19.345172 |
| joint_small_aperture | 5.224496 | 19.418436 |
| joint_still_water | 10.822915 | 120.663064 |

The two components are Mx and My at the issued frequency. A norm includes the real and imaginary errors in both. Each comparison uses the same three simultaneous force channels and nine wave gauges as available information. Inputs and outcomes are Fourier projections from the registered 32-second window. This evaluates conditional reconstruction of instrument measurements on one plate and one tank; it does not evaluate future on-line pressure, identify the torque origin or validate a calibrated spatial pressure field.

## Why the four-direction fit failed

The nine wave gauges lie on the union of two perpendicular lines, y=0 and x=0.273 m. For a calm diagonal wavevector, a four-wave field proportional to sin(a(x−0.273))sin(ay) vanishes at every gauge. The original surface-only course stopped at its fixed condition-number threshold before a forecast bank existed. The two affected conditions were ETC0003 and ETC0007. Its unchanged source and registration are included. No held moment field was converted in that original.

The distinct joint model added the aperture-integrated vertical pressure observation to the design. It assumed a 508 by 464 mm centered rectangular footprint rotated 22.5°, a continuous water depth of 2 m, linear wave pressure, a nominal uniform current and equal row weights after converting the observed force into equivalent surface displacement. The two smallest singular values were both about **0.0002872**. With condition number about **20,125**, the two training fits assigned constituent surface wave amplitudes as large as **20.95 and 21.72 m** to a commanded 0.03 m wave. The respective observation residual norms were only 0.000500 and 0.000630 m. The singular values describe this normalized observation model. They do not establish a physical instrument noise bound.

At ETG0006 (−112.5°), the design itself was better conditioned at 42.14. Its direct pressure moment had error 0.2771 Nm. The residual correction already fitted on calm-water runs had magnitude **19.2507 Nm** at this held input. It put the final Mx at 3.86364−18.86635i Nm against the measured −0.12494+0.01845i Nm. My was −0.20255+1.29091i against −0.02645+0.00248i Nm. This decomposition uses the original frozen predictions and wave coefficients. It supports a numerical explanation of the failed transfer without uniquely attributing the sensor discrepancy to cross-talk, reflections or any flow mechanism.

For unrestricted directions, two distinct four-wave fields can each vanish on the entire gauge cross. A linear combination cancels their vertical pressure integrals as well. The explicit nominal 30°/60° example gives moment integrals of only 2.12×10⁻⁷ and 1.11×10⁻⁷ m³ at unit angular coefficient variation. The zero gauge/force observations follow algebraically; the two small moment integrals are numerical evaluations on the stated nominal rectangle. They do not establish a material lower bound on instrument accuracy.

## What the experiment measured

The source contains 74 matching run identities across the force plate, nine wave gauges and acoustic Doppler sensor. Thirty-one wave-only runs calibrate all fitted models. Thirty-one wave-plus-current runs form the held set: 11 following-frequency, 11 opposing-frequency and nine direction conditions. The 12 current-only runs supply off-drive diagnostics. Common nominal settings are separate recorded runs. Published Fz/WG4 illustrations were exposed before this work. The source paper provides a measured correlation analysis without a published Mx/My forecasting procedure.

In ETG0001 the force file contains 40,960 rows, twice the nominal count. The primary uses the documented sampling rate on the first block. Neither using the second block at the nominal rate nor treating all rows as one 512 Hz record changed the joint failure. The author establishes a common digital trigger; the distributed text files do not record independent channel timestamps. The actual wetted transfer, moment reference height, coordinate cross-talk, individual instrument phase and timing of the extra block remain uncalibrated here. The photos and revised Figure 3 identify the sensor dimensions and surrounding floor panel; they do not certify every part of the custom wetted force path.

## Reproduce the study

Download the original DataShareET.zip and authenticate SHA-256 `7275a2c6c580bde15b8f1ed0ab89aea3d52da436c43580fa08608b01cc457e3f`. The commands use Python 3.12 and NumPy. The scalar receiver uses the standard library alone. Run from this directory with new output paths.

```sh
python3 geometry.py
python3 joint_pressure.py forecast DataShareET.zip forecast.json
python3 joint_pressure.py score DataShareET.zip score.json --bank forecast.json --bank-sha256 "$(sha256sum forecast.json | cut -d' ' -f1)"
python3 independent.py DataShareET.zip forecast.json score.json "$(sha256sum forecast.json | cut -d' ' -f1)" "$(sha256sum score.json | cut -d' ' -f1)"
python3 diagnose.py forecast.json score.json
```

The original calibration bank had 410,352 bytes and SHA-256 c26dd92650dc8e0abbc25b7cf732470d953ea110fa5380a9955e89fbf4265508. Its complete object upload and verified full readback finished before the held receiver started. Original score.json is included verbatim (43,276 bytes, SHA-256 37e984247efc68eb42f9eba5fd912541384a4c36f6f1424ce55cad890baa47c1). A fresh reader on a different worker independently acquired the original Edinburgh archive and checked every score against a compensated scalar Fourier calculation. All three clock interpretations gave 0/8 gates. The largest discrepancy across 1,590 comparisons was 1.43×10⁻¹⁴. Different numerical libraries can change the serialized bank hash; use authenticated original hashes for custody and numerical tolerances for reconstruction.

The original source-only PDF permission error, the first Figshare reader's metadata-key error, the first four-ray refusal and the diagnostic transport's pre-admission size refusal remain in the study history. All stage-specific inputs, group membership and metrics are recorded in registration.md, joint-registration.md, score.json and the native receipt ledger.

[Edinburgh data release](https://doi.org/10.7488/ds/3120) · [Gabl et al., Data 2021](https://doi.org/10.3390/data6100103)
