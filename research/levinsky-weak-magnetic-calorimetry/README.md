# Magnetic work predicts held-field heat-capacity differences in a cobalt coordination solid

On two low-temperature windows, adding the measured field dependence of magnetic work to linear calorimetric interpolation reduced held-field RMS error from **0.47045 to 0.07050 J kg⁻¹ K⁻¹**. A shape-preserving cubic using calorimetry alone scored **0.36132**. Fitting one nonnegative magnetic scale brought the pooled error to **0.06670**, but increased error at 3 T. The three-field improvement gate therefore failed. These six projections come from one material with overlapping temperature windows.

## Instruments, specimens and units

Levinsky et al. recorded heat capacity and isothermal magnetization for the layered cobalt coordination material at the University of Groningen and partner laboratories. The archive README and supplementary Fig. S11 identify the magnetic isotherms as measurements of the same polycrystalline sample used for calorimetry. The heat-capacity header reports 3.585 mg. The later magnetometry header reports 2.865 mg and its filename calls that mass a maximum. The measurements share sample lineage. The archive does not establish that an identical mass and orientation survived remounting, or supply a distribution for that difference. The fitted multiplier is a predictive nuisance parameter. The observations cannot isolate mass, orientation or demagnetizing-field effects. [Article and methods](https://doi.org/10.1038/s41467-024-52837-x) · [Version 1.0 data and README](https://doi.org/10.34894/ZPLHDY)

We use the instrument's sample heat capacity after its addenda correction, convert µJ/K to specific heat with 3.585 mg, and convert moment from emu to J/T with 1 emu = 10⁻³ J/T before dividing by 2.865 mg. The field coordinate is the recorded applied μ₀H in tesla. Internal induction was unavailable. Heat capacity was collected on cooling. Magnetization used the increasing and decreasing branches of the unique primary cooling block. The same-temperature startup and trailing cycles were excluded. Eight isotherms from 5 to 26 K support the two windows. Thermal and magnetic measurement clocks refer to distinct instrument runs. They do not represent a synchronized response to a pulse.

The paper already compares magnetometry-derived entropy changes with calorimetry in Fig. S11, and computes adiabatic temperature change by matching entropy between field-dependent calorimetric curves in Fig. 3. That published prior evidence includes reported low-temperature disagreement with the direct pulse result. The pulse experiment used a thermocouple bonded between thin single crystals in the ab-plane. This study forecasts **integrals of heat-capacity differences** at withheld calorimeter settings. No direct pulse temperature, single-crystal magnetization, 10 T heat-capacity response, or Origin project was decoded.

## The quantity that can be checked

For applied-field coordinate h, specific moment m, and equilibrium entropy S at fixed sample configuration, the Maxwell relation gives ∂S/∂h = ∂m/∂T. Taking one more temperature derivative yields ∂²A/∂T² = (C_h−C_0)/T, where A(T,h) is the integral of m(T,b) from b=0 to h. Multiply by a compact weight φ and integrate in temperature. When φ and its slope both vanish at the endpoints, integration by parts twice gives

```text
X(h) = ∫ φ″(T) A(T,h) dT
Y(h) = ∫ φ(T) [C_h(T) − C_0(T)]/T dT.
```

An equilibrium model with matching state, axis and units predicts X=Y. This test avoids a low-temperature entropy offset and direct differentiation of noisy moment readings. Its two integrated projections cannot establish that an arbitrary entropy surface is unique. The source uses approximate sample alignment and a finite-rate experiment. The fitted forecasts test transfer of the observed magnetic dependence under these conditions.

In each window u is the fractional position from its lower to upper temperature and φ=16u²(1−u)². Moment is piecewise linear in measured field. The two magnetic branches are integrated separately before averaging. The producer evaluates the weak derivative of piecewise-linear A from jumps of its thermal slopes. The receiver independently integrates φ″A on each interval. Sample heat capacity divided by measured sample temperature is interpolated from the native sample-temperature grid. The producer uses the three-point Gaussian rule, exact in real arithmetic for the resulting degree-five integrand. The receiver uses a polynomial antiderivative. Three nominal-zero field files have equal weight after integration.

## Original support refusal and narrower test

The six-window original exited before producing any forecasts. The captured native program required *every* magnetic integration gap to be below 0.08 T, stricter than a check only on an explicitly blank moment. The input census had 27,573 magnetic rows and one blank moment, in an excluded trailing 8 K repeat at negative field. Within the main run there were six intervals exceeding the guard, at 32, 38, 41 and 47 K. Both endpoints in each interval had a recorded moment. The largest interval on the 47 K rising branch ran from 5.249515 to 5.331769 T over 16.34 s, compared with a median step of 0.01003 T. This is a refusal under the registered numerical course, independent of any judgment about the physical validity of the original measurements.

The subsequent experiment retained the 0.08 T cutoff. Before opening held responses it selected the two original compact windows wholly below the first failed isotherm: 5–20 and 11–26 K. The four other windows were unscored. For these low windows the held reader converts only the response rows needed to bracket the interval, including the adjacent measured temperature on either side. Each of 1, 2 and 3 T contributed 39 distinct bracketing temperatures. The original, broader admission failure remains in the record.

## Held settings and controls

Calibration used complete calorimetric settings at 0, 0.5, 1.5, 5 and 7 T for the admitted windows. Magnetization across the field range was available before forecasting. For each held field the model first interpolated between neighboring calibration values of Y. It then added the magnetic difference between measured X at the held field and X interpolated from those same two neighbors. The fixed model uses coefficient 1 for that correction. The fitted model estimated a single positive coefficient, 1.0571734, by holding out each interior calibration field once. The corresponding ascending-only and descending-only scales were 1.0599054 and 1.0542821. All forecasts were committed before held calorimetric values were converted. Each of the six projected errors has equal weight.

| Method | RMS, J kg⁻¹ K⁻¹ | Largest absolute error |
|---|---:|---:|
| Fitted magnetic correction, averaged branches | 0.06670 | 0.11548 |
| Magnetic correction at fixed unit scale | 0.07050 | 0.12307 |
| Nominal magnetic work alone | 0.18457 | 0.31175 |
| Calorimetry, nearest field | 1.55441 | 2.94829 |
| Calorimetry, linear in field | 0.47045 | 0.64281 |
| Calorimetry, linear in squared field | 0.74819 | 1.31976 |
| Calorimetry, shape-preserving cubic in field | 0.36132 | 0.59450 |
| Calorimetry, shape-preserving cubic in squared field | 0.40734 | 0.57831 |

| Held field | Fitted correction RMS | Fixed correction RMS |
|---|---:|---:|
| 1 T | 0.01002 | 0.02353 |
| 2 T | 0.10600 | 0.11146 |
| 3 T | 0.04485 | **0.04399** |

All six target projections were present. Against the best of seven registered reference methods, the fitted model passed the 5% pooled improvement threshold (5.39%) and the worst-error guard. It lost the all-three-fields comparison. The ascending-only diagnostic scored 0.06631 and the descending-only diagnostic 0.06711; neither replaced the frozen averaged-branch primary. At the largest primary error, 2 T over 5–20 K, the measured contrast was −2.87657 J kg⁻¹ K⁻¹. The fitted model gave −2.99206, fixed correction −2.97506, linear interpolation −2.67786 and cubic interpolation −2.83862. The complete source-bound magnetic work, temperature-resolved C/T records and frozen forecasts are retained in the two JSON packets.

## Reproduce

Download `Associated_data.zip` from the published record. The released archive has 184,616,973 bytes, publisher SHA-1 `dac4c48fa9d5701918f41ff1c1c80591b31462d3` and independently computed SHA-256 `e12c9d0b23f14ecf7cc78ea2039b3db6b32e8cfb4541b1b21b62a6a09ae7a8cb`. Python 3.11+ and its standard library suffice.

```sh
python3 replay.py /path/to/Associated_data.zip /tmp/levinsky-clean
```

The replay verifies the source, rebuilds and hashes the forecast before scoring, compares the output with the stored score, and invokes the independent source reader. The primary forecast SHA-256 is `ee8c92010b178b45d509511a733db5f9fa870030ef2edd198d3c85b354283936`, and the score SHA-256 is `3955f02819d9506298ec85b782a249f744878937bb44c78c1033abc1ab3c69cb`. A separate cold retrieval of the publisher archive reconstructed all 60 forecasts and six measured projections. Its maximum forecast difference was 3.47 × 10⁻¹⁴ J kg⁻¹ K⁻¹. The printed gate decisions include the failed all-fields comparison.
