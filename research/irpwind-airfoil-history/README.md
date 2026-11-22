# Prescribed-pitch airfoil history across incidence and frequency

Eight threshold-memory states improved the mean lift error of the instantaneous-rate calibration on four development conditions. They failed the prospectively specified condition-transfer gate. The mean root-mean-square error (RMSE) was 0.100970 for the memory model, 0.105975 for the rate calibration, and 0.097533 for the best established baseline in each condition. Each condition had equal weight. The two faster reserved lift responses stayed unopened.

| Mean pitch | Reduced frequency | Rows | Completed cycles | Best established baseline | Baseline RMSE | Rate calibration | Threshold memory | Memory loop-area error |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| 5° | 0.010 | 2,500 | 7 | MHH, OpenFAST constants, direct angle | 0.040148 | 0.050771 | 0.052236 | 1.074258 |
| 5° | 0.050 | 1,250 | 18 | MHH, OpenFAST constants, assumed quarter-chord pivot | 0.067101 | 0.060009 | 0.053726 | 0.774165 |
| 15° | 0.010 | 1,913 | 4 | MHH, Jones constants, direct angle | 0.126186 | 0.162799 | 0.152100 | 0.781609 |
| 15° | 0.050 | 1,250 | 18 | MHH, Jones constants, assumed quarter-chord pivot | 0.156698 | 0.150323 | 0.145820 | 0.524562 |

The reference column selects the smallest RMSE among six published-model configurations in each condition. It is a comparison envelope. The candidate beat it in two of four conditions. Its penalty on the slow 5° case was 30.1%, above the allowed 10%. On the 15°, 0.050 case the measured lift at 0.592 s was 1.96751, with measured incidence 23.461°. Jones MHH with the assumed pivot predicted 1.19773. Threshold memory predicted 1.11794. Improvement in that case's overall RMSE coexisted with a larger peak error.

## Measurement and access

The IRPWIND release identifies this experiment as CENER’s NACA643-418 in DTU’s RED tunnel. The section has 0.25 m chord and 0.5 m span at 30 m/s and Reynolds number 500,000. Section 3.3 of the accompanying report describes integrating the surface pressures from 63 taps at 41% span. These lift coefficients therefore do not carry a structural balance’s inertial load. The report supplies no CENER-specific pressure-line phase correction, encoder-pressure latency, wind-axis rotation formula, blockage correction or chordwise pivot coordinate. The synchronization description in section 3.4 applies to the separate Oldenburg rig. A loop in this study describes released lift versus released incidence, with both acquisition effects and flow history possible. [IRPWIND release, report and conversion notebook](https://zenodo.org/records/1135424)

The conversion notebook reads the ASCII time, AoA, flap, Cl, Cdp and Cm columns and concatenates by case. The pitch files provide equally spaced 0.008 s rows and trailing padding. Cases are prescribed motions with nominal ±10° amplitude. The actual incidence range narrows as rate rises. The source split assigned both means at 0.010 and 0.050 to development and both means at 0.100 to reserve. The registry checks complete release files, then slices only the named development lift responses. The neutral-flap steady polar contributes its angle, lift, pressure drag and moment. Three exactly repeated static angles (−1.999°, 14.031°, 24.891°) were averaged at identical incidence before all interpolations. The first native baseline original stopped at a strict uniqueness assertion before opening any dynamic responses.

## Methods and scoring

All six reference streams use the same zero-flap static polar. They comprise static interpolation, the Øye dynamic separation model with time constant three chord transit times, and four configurations of the Hansen–Gaunaa–Madsen (MHH) four-state model. The latter use Jones or OpenFAST constants and either direct measured angle or a three-quarter-chord effective angle assuming a quarter-chord pivot. The actual functions come from welib commit `dd67c604bd9034991d243820d4f6967c74ca5827`. The OpenFAST label denotes the constant set in welib. Each MHH state starts at its first-sample equilibrium. The driver applies RK4 in three substeps per observed interval to the authentic continuous derivative, interpolating between the previous and current endpoints. Pitch rate uses the backward difference and starts at zero. Six substeps changed the initial 151-sample control by at most 0.00005435 in lift. [Author model source](https://github.com/ebranlard/welib/blob/dd67c604bd9034991d243820d4f6967c74ca5827/welib/airfoils/DynamicStall.py)

The calibration models fit residuals on top of the Jones assumed-pivot prediction. Five piecewise-linear incidence features span −5° to 25°. The rate control adds their products with backward pitch rate divided by 100°/s. The memory model additionally switches eight relays on at 10°, 14°, 18° or 22°, and off four or eight degrees below their trigger. The state approaches the relay position exponentially with entry/exit time constants of three/twelve chord transit times. Each regressor is centered against its instantaneous upper threshold. Fitting minimizes mean case-weighted squared error with a fixed 0.001 ridge penalty. Each whole condition is predicted using coefficients learned only from the other three. All models have access to measured incidence through the current sample. The evaluation made four held-condition folds within development, with no internal cycle treated as an independent experiment.

RMSE uses every finite row of the condition, including initialization. The secondary loop integral uses the trapezoidal sum of lift against incidence in degrees, between successive upward mean crossings after a two-degree rearming excursion. The table reports mean absolute error between paired observed and predicted signed integrals in coefficient-degrees. The source table retains each integral, every worst time, observed and predicted lift, measured angle and rate. A separate receiver reconstructed all 36 method–condition score records from the stored forecasts using scalar squared-error accumulation and integrals between interpolated crossing positions.

Development admission required at least 5% lower mean RMSE than the envelope, at least 2% lower mean than the fitted rate control, three of four wins against the envelope and no condition more than 10% worse. Only the rate criterion passed. The two 0.100 lift responses stayed outside training, prediction scoring and method selection. This comparison provides development evidence at one section and one tunnel speed.

## Replay

Run the standard-library recount from this directory:

```sh
python replay.py
```

For a fresh physical replay, install the numerical dependencies and fetch the public source files:

```sh
uv run --no-project --python 3.12 --with numpy --with pandas --with scipy --with netCDF4 -- python replay.py --refit
```

The refit verifies the two release file digests and three welib Git blob identities, reconstructs the six physical and three calibrated streams, and checks all 36 score records and 12 fits against `frozen-results.json`. Frozen original SHA-256 values are `fd0b97361d975889bc09d72dde087078bb9b990a99476d0bcbf91759d4d945c0` for reference streams and development measurements, `39b74db34b3e19d2d7e1158bb4af997fc10ab058694d93cc494973fe0238c7f8` for calibration forecasts and `f0bc8084e9650bfcdfb9004818106a9adc00e304c78ec6686c967cb785ff499a` for the complete results table.
