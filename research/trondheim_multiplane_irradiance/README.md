# Can north, south and horizontal pyranometers predict the irradiance on a 60° pergola?

The geometry-informed model reduced mean absolute error on informative hours of 2025 from 11.79 to 10.51 W/m² against the strongest development-year control. It increased root-mean-square error from 22.29 to 24.85 W/m² and won only seven months. **The preregistered joint gate failed.** This is hourly reconstruction from simultaneous measurements at one building in Trondheim. Each annual cohort contains observations from the same installation.

## Measurements and exposure

Mulu Bayray Kahsay and Natasa Nord released hourly measurements from the NTNU/SINTEF ZEB Laboratory for 2023–2025. The timestamp ends the preceding averaging hour. We use horizontally oriented rooftop irradiance H and due-south and due-north vertical façade irradiance S and N to predict outward-facing, south-oriented pergola irradiance at 60° tilt. These are measurements at different positions. Sky visibility, reflections, snow, shading and the contributing measurement samples can differ. The authors set negative nighttime radiation to zero. They report a representative 3.2% total uncertainty for the pyranometers. There is no synchronized angular radiance or site-specific per-hour calibration truth in this comparison. [Dataset and CC BY 4.0 license](https://doi.org/10.17632/g86rtgzvkh.2) · [Instrumentation, acquisition and filtering](https://doi.org/10.1016/j.dib.2026.113014)

The west instrument points at 240° azimuth and its 2023 readings are unavailable. Published site descriptions disagree about the tilted roof plane (30° versus 40°). The inner pergola sensor also has an ambiguous viewing convention. The comparison uses none of those channels. All three archived irradiance workbooks were hashed, and only the header was extracted before the protocol freeze. The sources' published completeness and illustrative summaries and the older site model rankings were available. [Earlier site geometry and instruments](https://doi.org/10.3389/fenrg.2022.1082092)

We fit to 2023, selected the strongest control from 2024, and locked every 2025 prediction and interval at commit `2f78d4cae115b0d511c2b0157926a7fa0e52877b` before the scorer opened 2025 outer-pergola values. The trusted predictor intake hashes the complete workbook; its selected scientific columns exclude the target in 2025. No 2025 target is used for feature construction, calibration, selection or clock assessment. The output SHA-256 is `98a9c946341b490502d618f77d19a5ec6aa03cc8bdfef46397e46dc7d02d5d5d` (786,991 bytes). All 8,760 rows scored. Hours with H ≥ 20 W/m² formed the primary panel (3,626 hours). The calendar months below describe one continuous year.

## What the three intensities determine

For an ideal cosine receiver with normal n seeing common radiance L, its reading is the integral of L times the positive part of n·ω over all directions. With c=cos(60°), s=sin(60°), the target normal is c times the upward normal plus s times the south normal. Subadditivity and nonnegativity alone imply

    max(0, cH − sN) ≤ E60 ≤ cH + sS.

For a more restrictive scene, let the upper and lower hemispheres have separate uniform diffuse radiances plus one effective upward incident solar beam. Write F=min(S,N). The two opposite vertical instruments each receive the same diffuse irradiance F. Their difference recovers the signed horizontal southerly beam component. The unknown vertical beam projection Bz lies between max(0,H−2F) and H. Under this model,

    E60 = cH + sS − (c+s−1)F − min(c Bz, s max(0,N−S)).

When S≥N the result is a point independent of upper/lower diffuse partition. When N>S the displayed Bz range gives a sharp conditional interval. For example H=80, S=30, N=50 admit upper/lower horizontal diffuse contributions of (60,0) or (0,60) with vertical beam 20 or 80 and northward component 20 in each case. The two pergola predictions are 45.00 and 37.68 W/m². The beam can have a different elevation in those examples; its direction is unmeasured by H,S,N alone. Beam direction/sign can also change within the measured hour. A fixed 20% ground-reflected fraction with source-feasible clipping supplies the standalone point in the general case. The learned physics arm adds a source-trained residual.

The equal-capacity empirical, geometry-residual and Perez-residual boosted regressions have identical sensor/clock features and training budget. Other controls include a simple linear fit, a richer empirical ridge, two analytic alternatives and the positive-sum upper envelope. A maintained pvlib DIRINT/Perez implementation uses trailing-window midpoint solar position, GHI, standard pressure and a fixed albedo. Only 2023 GHI was used to select among three clock interpretations. UTC provided the smallest training solar-profile error, which does not establish original timestamp provenance. GHI remains a same-hour input. The earlier 725-chain study reported Perez1/Perez1 as strongest for pergola; its one-minute measurements, ancillary inputs and obstruction masks differ. The implementation here is an hourly comparator. [Earlier model-chain comparison](https://doi.org/10.1016/j.solener.2024.112924)

## Held 2025 results

| Frozen role | Informative MAE (W/m²) | Informative RMSE (W/m²) |
|---|---:|---:|
| Geometry model + learned residual | 10.51 | 24.85 |
| Same-capacity empirical | 11.79 | 22.29 |
| Empirical ridge with clock features | 13.62 | 26.57 |
| Linear sensor fit | 14.00 | 30.57 |
| Two hemispheres + beam, fixed ground fraction | 14.25 | 30.39 |
| Interval midpoint | 14.27 | 30.40 |
| Always use the south-beam formula | 17.54 | 33.41 |
| Hourly DIRINT/Perez + learned residual | 26.43 | 52.46 |
| Subadditive upper envelope | 31.35 | 44.30 |
| Hourly DIRINT/Perez | 34.58 | 63.62 |

The practical candidate beat four fitted controls on informative MAE. Against the development-selected empirical model it lost the prespecified RMSE comparison and won 7/12 monthly MAEs (8 required). Full-year MAE/RMSE were 4.52/16.02 versus 5.04/14.37 W/m². The complete monthly, signed-component and all-hour denominators and errors are in the original score JSON.

The narrow model missed 3,333/3,626 informative readings. All 2,579 S≥N hours are point predictions and show some discrepancy beyond 1e−8 W/m²; the point equality itself is not a realistic metrological acceptance rule. Of 1,047 N>S hours, 754 readings lay outside the conditional interval. Even the broad common-field geometric bound missed 200 informative readings (176 above and 24 below). Under a separate deterministic ±3.2% scenario about each measured channel, conservative propagation still leaves 787 narrow-model misses and 43 broad-bound misses. The box is a sensitivity calculation; instruments' stated uncertainties do not guarantee hard independent error bounds.

On April 24 at 16:00 the measured (H,S,N) were (395.009,267.243,94.192) W/m² and the pergola recorded 79.220 W/m². The beam model gave 394.467, learned residual 361.025, and empirical control 320.833. The arbitrary-radiance lower bound for an identical field was 115.932. On June 6 at 11:00 the pergola instead reached 851.888 W/m², above the broad upper bound of 717.873. The empirical ridge returned 855.584, geometry-residual 682.684 and hourly Perez 300.482. Both signs matter. A local obstruction or differing sky view could contribute, but the logged channels cannot assign cause. The source-year warning was already substantial: on February 6, 2024 at 11:00 the pergola measured 128.748 while the pure geometry model gave 603.003 W/m².

## Replay

Run `python recount.py forecasts.npz development.json score-original.json` in this directory. It checks all 87,600 finite role errors, the ten worst hours for every role, 44,376 scalar/rebuilt-array checks and the final gate. The independent reduction has maximum metric disagreement 2.85e−14 and zero discrepancy for five reconstructed physical quantities per hour. Use an additional `publisher` argument to reacquire the original public workbook and check it against its frozen whole-file SHA. The native first receiver used that public workbook. The offline receiver uses a timestamp/value CSV extracted afterward from the same 2025 file. The forecast and scoring commands and their exact gates are in the five source files frozen at `6ffcbc4a02b9ac78381fe94bc5adeecb3825df24`. The native fit used Python 3.12, numpy 2.2.6, pandas 2.2.3, pvlib 0.13.1, scipy 1.15.3 and scikit-learn 1.6.1. Reported numerical observations belong to the stored originals.

The first inventory completed on deposit v1. The second authenticated the v2 roster and then exited 1 on an HTTP 500 from its separate methods XML request. All v2 workbook headers and whole-file digests were subsequently authenticated. The initial prediction request exceeded the provider's console-retention limit before execution; the bounded-console original ran the same source and inputs. The full output was recovered in pages and the archive verified separately. No failed transport or source request is counted as a scored execution.

**Data credit.** Mulu Bayray Kahsay and Natasa Nord, *ZEB Lab Measured Solar Radiation and PV Power Datasets*, version 2, CC BY 4.0. The bundled forecast archive includes three extracted input channels. The measured target CSV contains the published 2025 timestamp and outer-pergola readings converted from Excel to CSV. Numerical reductions and model estimates are derived here. [Original deposit](https://doi.org/10.17632/g86rtgzvkh.2) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

The first ordinary publication gate passed the scientific recount and npm verification, then correctly rejected a compressed CSV under the repository package policy. The release carries the identical 189,911 decompressed CSV bytes directly, SHA-256 5002dc73bf7f06d4b39a48394f98ed71badf69bfc6802274fd4bfd6fc303fcc0.
