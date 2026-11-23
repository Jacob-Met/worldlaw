# Predicting unsaturated conductivity from retention and a saturated measurement

A model that redistributed capillary conductance across pore-size ranges reduced the mean development error from 1.7331 to 0.6797 log₁₀ units relative to the initial saturated-conductivity-scaled van Genuchten–Mualem calculation. A boosted regression using the same information reached 0.4217. **The capillary model failed all five predeclared development gates.** The 74 reserve cores remained unopened.

## Measurements and split

Hohenbrink et al. released drying measurements from 572 undisturbed soil ring samples. Each identifier denotes one ring. The KSAT instrument measured saturated hydraulic conductivity of the undisturbed samples using constant or falling head. HYPROP inferred unsaturated conductivity from the evaporation mass balance and the gradient between two tensiometers. Retention and HYPROP conductivity share measurements and processing. A coordinate group identifies a reported location; positions have approximately 100 m accuracy. A separately registered trial, an independent unsaturated conductivity sensor and individual instrument/time logs would support different conclusions. Some ancillary soil-property observations were pooled. [Measurement paper](https://doi.org/10.5194/essd-15-4417-2023) · [Data release](https://doi.org/10.5880/fidgeo.2023.012)

The model receives the new core's complete released retention curve (including air-entry and WP4 observations where available), its measured saturated conductivity and the query pF, defined as log₁₀ of suction head in cm. It predicts the positive HYPROP conductivity in cm/day. Every eligible HYPROP row is scored. Air-entry conductivity and saturated conductivity serve different purposes and are excluded from the target. The released Param and HydCurves tables use target conductivity during fitting and remained unopened. The source authors explicitly excluded measured bulk saturated conductivity from their joint fit because it can reflect larger connected pores.

Of 409 records flagged for KSAT, KIT furnished 174. Eight lacked coordinates and three lay within 10 km of a TUBS development sample. The fixed training set thus contained 163 KIT cores in 67 coordinate groups, with 11,453 conductivity rows. Development used all 161 TUBS cores in 50 groups. Jena (47), Dresden (24) and UFZ (3) formed the unopened reserve. The transfer is between the named contributors over the released processing protocol.

## Models and decision

Three VG controls use the original bin-weighted retention fit, per-observation weights with dry WP4 observations upweighted by 10, and a fit constraining saturated water content to exceed or equal the largest observed water content. All use measured bulk saturated conductivity and relative tortuosity 0.5. The published PDI-VG code fits four retention parameters and calls the authors' absolute-prediction mode at 20 °C, with 6 cm pore-size cutoff, saturated tortuosity 0.062 and both film and vapour conductivity enabled. Two training-only intercept corrections, residual ridge and residual histogram boosting provide four additional controls. All regressors use site- and core-balanced training weights. [Author PDI source and examples](https://doi.org/10.5281/zenodo.10950456) · [Absolute-conductivity theory](https://doi.org/10.5194/hess-27-1565-2023)

For capillary saturation S and the author model's capillary conductivity Kc, write J = √(Kc/√S). The candidate divides the unsigned cumulative integral J into seven suction intervals, weights the nonnegative increments, then squares their sum, multiplies by √S and adds the unchanged film and vapour terms. Fourteen bounded coefficients let the weights depend on the ratio of measured bulk Ks to the model's saturated liquid conductivity. Returning all weights to one reproduced the complete PDI output on development to 8.9×10⁻¹⁶ maximum relative difference. This construction assumes that retention and the saturated measurement carry transferable information about which pore-size ranges conduct water.

Each core's error is the root mean squared log₁₀ residual over its rows. Each site receives the arithmetic mean over its cores, then each site has equal weight in the headline mean. A core contributed 18 to 199 measurements. For the two suction slices, only cores and sites with at least one row in that slice contribute. Quantiles use linear interpolation of sorted site scores.

| Method | Whole-curve mean | 90th-percentile site | pF < 2 (47 sites) | pF ≥ 2 (50 sites) |
|---|---:|---:|---:|---:|
| VG, original weighting | 1.7331 | 3.3082 | 1.8718 | 1.6875 |
| VG, per-observation weighting | 1.8348 | 3.2078 | 1.5389 | 1.9137 |
| VG, constrained saturated content | 1.7853 | 3.0951 | 1.4973 | 1.8582 |
| Absolute PDI-VG | 0.7247 | 1.1555 | 0.8668 | 0.6404 |
| VG, learned intercept | 1.9442 | 3.7627 | 1.1548 | 2.1373 |
| PDI, learned intercept | 0.8155 | 1.4811 | 0.9028 | 0.7297 |
| Residual ridge | 0.5368 | 0.8871 | 0.3915 | 0.5688 |
| Residual histogram boosting | **0.4217** | **0.7442** | 0.4130 | **0.3889** |
| Weighted capillary integral | 0.6797 | 1.0305 | 0.7835 | 0.5896 |

The five gates required a whole-curve mean ≤0.95 times the lowest comparator mean, strict wins at ≥60% of sites against the single best overall comparator, a 90th-percentile error ≤1.05 times the lowest comparator tail, and a mean ≤1.10 times the lowest comparator error in each suction slice. Each slice had to contain ≥20 sites. The candidate won at 13 of 50 sites. An independent 45-digit receiver checked all 121,941 forecasts, all 1,449 core-method scores and every site and slice against the saved observations.

## Failures that set the scope

The worst KIT stock curve was KIT_210 (RMSE 6.1735). At pF 2.634, its measured bulk Ks of 22,908.68 cm/day produced a forecast of 10^3.79420 cm/day against 0.000398 cm/day. Its 199 HYPROP retention observations started at pF 1.659, five WP4 readings lay in the dry range, and there was no air-entry reading. The fitted saturated water content, 0.37836, lay below the largest observed content, 0.4214. The wet-end curve and the mapping of bulk Ks to matrix flow both contribute uncertainty. The data do not partition the error between those effects.

TUBS_216 (UBA_29, 77.5 cm depth) produced both the worst candidate row and the worst candidate core. All 36 residuals were negative, over pF 2.282–3.108 and measured K 0.002399–0.30903 cm/day. The mean signed residual was −1.92090 and RMSE 1.92283. The original VG control reached 0.23409 on this core. At pF 2.437, measured K was 0.112202 and the candidate predicted 10^−2.96985 cm/day. The core had bulk Ks 147.910839 cm/day, 199 HYPROP retention observations, one air-entry reading and four WP4 readings. Its full curve is in observed.json.

The first training program stopped before accessing data because SciPy was absent. A separate dependency-complete run retained the original scientific code. During a subsequent training control, the authors' vapour expression returned NaN at an auxiliary head of 10⁻⁸ cm for KIT_007 because the water content rounded 1.11×10⁻¹⁶ above the fitted saturated content. Actual query outputs were finite. The auxiliary saturated reference uses only capillary and film conductivity, since vapour diffusion vanishes with gas-filled porosity. An independent analytic evaluation across all 163 training fits gave maximum relative errors of 7.40×10⁻², 6.07×10⁻⁴, 4.75×10⁻⁶, 3.71×10⁻⁸ and 2.90×10⁻¹⁰ as fixed head decreased from 10⁻² to 10⁻¹⁰ cm in two-decade steps. The comparison uses the frozen 10⁻⁸ cm value.

An ideal Poiseuille bundle illustrates nonuniqueness. At radii 2 and 1, take (count, length) pairs [(2,1), (16,2)] in the first bundle and [(1,2), (32,1)] in the second. Stored pore volume by radius is identical (8π and 32π), as are entry thresholds indexed by radius and total saturated conductance (40 common units). When only the narrow pores remain wet, their relative conductances are 1/5 and 4/5. This example assumes ideal parallel paths and common fluid and contact conditions. A separate metadata-only UNSODA screen found core, horizon and preparation identifiers, including successive compactions and samples combined across measurements. Its hydraulic tables remained unopened. [UNSODA release](https://doi.org/10.15482/USDA.ADC/1173246)

## Replay

Use Python 3.12, NumPy 1.26.4, SciPy 1.13.1 and scikit-learn 1.5.2, plus 7-Zip or py7zr. Download the unchanged GFZ DataFiles.7z and the authors' pdi.py. The entry point verifies their SHA256 digests, reads only the selected records, locks and rereads all development forecasts, then decodes development labels. The release's fitted parameter and hydraulic model-curve tables and the reserve institutions' scientific rows are never parsed.

```sh
python replay.py 2023-012_Hohenbrink-et-al_DataFiles.7z pdi.py ./output
```

The replay checks all nine methods' means and tails in three slices, the five gate decisions, coverage and the raw worst-core identity. Its compact forecast-file layout differs from the originally frozen packet. The original 3,284,000-byte forecast had SHA256 3a64c6cb5fda8be3c133a76262642c2b818fa8db952c0562e9bf897a5548845e. Its separate 1,334,401-byte compressed copy was reread before labels. The study supports a development comparison on one processed endpoint and the stated finite nonuniqueness example.
