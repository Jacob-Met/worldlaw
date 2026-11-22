# Eight flash measurements for photovoltaic power prediction

An extra flash selected from other manufacturers’ module measurements improved a seven-point Huld fit, but an ADR model fitted to the same eight measurements predicted the remaining operating conditions more accurately. A warning based on the extra flash also accepted the module with the largest error. The development gate failed on both average and worst-case accuracy. Measurements from four reserved manufacturers remain unopened.

## Measurements and comparison

Sandia’s PV Lifetime project publishes CFV’s IEC 61853-1 flash-test workbook. Each of its nine module worksheets records one physical specimen at 27 combinations of irradiance and module temperature. It contains one measured maximum power per cell. This comparison uses five specimens from three manufacturers: Hanwha Q.Plus 280 and Q.Peak 300, Jinko 260, and Canadian Solar 275M and 270P. The four reserved worksheets belong to Panasonic, LG, Mission and Itek. Each row describes a controlled condition on one module. The experiment has no independent same-cell replicates or field energy-yield measurements. The laboratory adjusted its monitor to reproduce standard-test-condition (STC) power. Instrument and specimen variation limit how far the numerical differences generalize. [PV Lifetime reports](https://pvpmc.sandia.gov/pv-research/pv-lifetime-project/pv-lifetime-modules/) · [Measurement workbook](https://pvpmc.sandia.gov/download/3609/)

Each fit received measured STC power at 1000 W/m² and 25 °C. The design-only search compared all 74,613 six-point subsets of 22 eligible conditions, preserving four extreme conditions for evaluation. Maximizing the absolute Huld feature determinant selected (irradiance in W/m², temperature in °C) at (400,15), (100,25), (100,50), (400,50), (200,75) and (1000,75). The other manufacturers’ data then selected the eighth flash by their largest weighted residual variance. That point was (200,15) for the Jinko specimen and (400,25) for the others. The source weighting gives each manufacturer an equal share. The candidate uses the eighth measured residual to adjust the transferred residual curve at every operating point via source covariance. Both eight-point comparison models see exactly the same target measurements. The simpler controls use seven, one or zero target flashes as indicated.

For each specimen we scored relative power error on its 19 unqueried conditions, took the root mean square, then weighted each of the five specimen RMS values equally. The worst column is the largest absolute relative error across all 95 specimen-condition pairs. The gate requires a strictly lower mean RMS and at most the worst error of the stronger eight-point Huld or ADR model, selected by mean RMS. The five-parameter ADR and Huld curves are evaluated with pvlib 0.15.2. [ADR model](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.pvarray.pvefficiency_adr.html) · [Huld model](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.pvarray.huld.html)

| Method | Equal-specimen RMS | Worst absolute error |
|---|---:|---:|
| Transferred curve conditioned on eighth flash | 0.244232% | 1.125175% |
| ADR, eight flashes | 0.215275% | 0.913001% |
| Huld, eight flashes | 0.322253% | 1.209964% |
| Transferred mean residual, seven flashes | 0.225095% | 0.996819% |
| Huld, seven flashes | 0.321672% | 1.162905% |
| PVWatts, measured STC | 3.793420% | 16.068966% |
| Generic Huld, measured STC | 4.160128% | 16.171916% |
| PVWatts, nameplate only | 4.517709% | 16.732740% |
| Generic Huld, nameplate only | 3.832198% | 13.244890% |

The worst candidate error occurred on the Canadian Solar 270P at 100 W/m² and 75 °C. It delivered 18.699211 W. The transferred curve predicted 18.909610 W and ADR predicted 18.869935 W. The warning rule flags a module when its eighth residual falls outside the source range. It flagged only the Canadian Solar 275M and accepted the 270P. The equal-specimen RMS for the four accepted modules was 0.243899%, versus 0.245564% for the flagged module. These are development comparisons across three manufacturer groups. They do not estimate coverage or accuracy on independent manufacturers.

## Replay

With Python 3.12, run `python research/pv-controlled-flash-probe/replay.py` to verify the archived forecast digest, all 855 scored errors, the operating-point split and the negative gate. The archive retains all 1,215 power predictions, including queried conditions.

For a physical-source replay, download the workbook above and run the commands below from the repository root. The expected workbook SHA-256 is `9083c1b90616b35e10fcf127e80d386f1bf37722f946476a090ed6ef35526bca`. The replay hashes the complete file, decodes only the five development worksheets, rebuilds the anchor design and source-only probes, and refits all nine methods. The first independent replay failed the fixed 1e-8 W parity tolerance after using a different floating-point multiplication order at the nonlinear ADR fit input. Restoring the original arithmetic passed the same tolerance, with maximum delta 2.28e-13 W over all 1,215 predictions. The full-matrix manufacturer PAN fits played no role in training, selection or scoring.

```bash
uv run --no-project --python 3.12 --with pvlib==0.15.2 --with numpy==2.5.5 \
  -- python research/pv-controlled-flash-probe/replay.py --workbook measurements.xlsx
```
