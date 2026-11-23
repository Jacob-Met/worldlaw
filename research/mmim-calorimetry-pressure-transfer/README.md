# Can calorimetry predict the temperature dependence of solvent vapor pressure?

He, Zhao, Zhang and Feng measured water, ethanol and methanol mixed with 1,3-dimethylimidazolium dimethylphosphate. Four low-temperature pressure readings calibrated each of 15 composition series. The locked forecast contains the remaining 83 higher-temperature manometer readings and ten predictions per reading. The calorimetric temperature correction lost all eight registered comparisons. Omitting the heat-capacity correction reduced both the average and worst-curve error. An independent receiver reconstructed the complete score and integrated the primary prediction for every observation.

## Pressure transfer

Each curve contributes its mean absolute natural-log pressure error. The table gives the equally weighted mean and maximum of these 15 errors. The same two comparisons within each solvent complete the eight gates. Every gate requires a strict win over every other arm. These curves come from one campaign.

| Frozen procedure | Equal-curve mean | Worst curve |
|---|---:|---:|
| antoine_shared_shift | 0.027675 | 0.084249 |
| per_curve_clausius | 0.031912 | 0.085382 |
| per_curve_activity_slope | 0.032437 | 0.087913 |
| caloric_residual_slope | 0.033808 | 0.089562 |
| nrtl_pressure | 0.034875 | 0.064834 |
| nrtl_pressure_heat | 0.056343 | 0.227150 |
| caloric_no_cp | 0.065277 | 0.176412 |
| caloric_ideal_vapor | 0.075758 | 0.194678 |
| caloric_cp | 0.082589 | 0.203568 |
| fixed_activity | 0.100255 | 0.238740 |

For the largest primary miss, water with ionic-liquid mole fraction 0.56 at 429.75 K, the observed pressure was 39.15 kPa and the prediction was 28.587 kPa. The archived compiler expanded uncertainty is 1.29 kPa. On that curve, the reduced activity-coefficient change from the last anchor at 419.15 K to the worst row implies a finite-secant partial excess enthalpy of −39.509 kJ/mol under the frozen vapor and liquid-volume corrections. The calorimetric model gives −3.820 kJ/mol over the same interval. The secant comes from manometry. The decomposition in `diagnosis.json` preserves the complete eight-point trace, all four anchors and every forecast at the worst row.

## What was measured

The He ThermoML article contains 18 datasets. The three binary manometry datasets contain 143 pressure readings across 15 solvent/composition combinations. Each solvent has seven mixing-enthalpy rows at 298.15 K, including endpoints, and 20 mixture heat-capacity rows on four temperatures up to 323.15 K. The calculation uses measured densities and excludes viscosity. Of 143 pressure temperatures, 137 exceed the largest calorimetric temperature. The extrapolation fixes the interpolated partial excess heat capacity above 323.15 K. CoolProp 7.2.0 supplies the pure-solvent equation-of-state quantities for the virial and Poynting corrections. Errors can reflect that extrapolation, calorimetric composition derivatives, activity calibration or the pressure corrections. The observations do not isolate one cause.

The strongest mean procedure is a train-selected shared-shift Antoine fit. Pressure-only NRTL has the smallest worst-curve error. The registered NRTL implementation uses five starts, two directed interactions affine in inverse temperature and fixed nonrandomness 0.3. It is a fitted member of the published model family. The available He abstract did not furnish an executable regression or its coefficients.

The registration gives a synthetic local excess-Gibbs-energy perturbation. It preserves the calibration and calorimetry at the observed temperatures while changing a held activity. Its amplitude may be arbitrarily small. This establishes nonuniqueness under the stated smoothness assumptions and supplies no bound on the magnitude of a real pressure error. A separate ebulliometer campaign has 24 water pressure rows, all at ionic-liquid mole fractions below the He range. The registered gate for opening that campaign failed. Its pressure ordinates remain unscored.

## Reproduce

Run these commands in this directory with Python, NumPy and SciPy. The original producer used Python 3.12.3, NumPy 1.26.4 and SciPy 1.15.3. The independent reader uses only the standard library. It verifies the source, EOS, bank and score digests, recounts every pressure/error/gate, and computes the caloric transport directly by quadrature using the archived fitted coefficients. It performs no independent parameter fit.

```sh
curl -fL 'https://trc.nist.gov/ThermoML/10.1016/j.fluid.2010.07.005.xml' -o article.xml
python3 transport.py forecast article.xml reproduced-bank.json
python3 transport.py score article.xml reproduced-score.json --bank reproduced-bank.json --bank-sha256 "$(sha256sum reproduced-bank.json | cut -d' ' -f1)"
python3 independent.py article.xml pure.json forecast.json score.json 911084e5e80ce584b7949dbad13ed38001af65f1b7f3dd400ae0f9331b224c43 1eb6235336349d1f80e39037b4b0847d3d1c110004c1f40b3dbd108e514982ce
python3 diagnose.py article.xml forecast.json score.json pure.json
```

The initial preregistration was commit `0e96b2c44c1a26d74b2a166b91fc2321bb078a55`. One original stopped at a missing SciPy import. A second stopped at a formatting mismatch between equal numerical temperature keys. The one-to-one numeric lookup repair was frozen at `451d4ada383355425af6b406da4431016b35dfbd` before forecast completion and before held pressures were scored. The bank receipt precedes the held receiver. The distinct-worker recount compared 993 numerical entries with maximum absolute difference 6.25e−16. Its maximum relative difference for the 83 primary predictions was 1.41e−11.

[He et al. mixture data](https://trc.nist.gov/ThermoML/10.1016/j.fluid.2010.07.005.xml) · [External campaign metadata](https://doi.org/10.1021/je100483d) · [CoolProp release](https://pypi.org/project/CoolProp/7.2.0/)
