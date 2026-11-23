# How closely can total pressure constrain a binary vapor composition?

A convexity-based pressure inversion contained all 60 measured interior vapor fractions in three acetal mixtures. Its intervals were too wide to predict those fractions accurately. At 353 K every interior interval covered the entire mole-fraction scale. Pressure-only Wilson and NRTL fits predicted the independent gas chromatograms much more closely on all three isotherms. Three of twelve registered criteria passed, all for containment.

## What was measured

Kim, Sapei, Keskinen and Aittamaa used a circulating still to measure total pressure and chromatographed condensed vapor and liquid samples. The NIST ThermoML archive distinguishes the pressure measurement from the gas mole fraction. We paired rows by liquid mole fraction and temperature before decoding any gas fraction. The archived XML had been deserialized as a document. Only datasets 1, 2, 4 and 8 supplied numerical calibration properties. Published parameter values and aggregate errors in Table 6 were known before prediction. Sixty interior assays and six deterministic pure endpoints were reserved through forecast lock. The separate azeotrope estimates derived by imposing equal liquid and vapor fractions were excluded.

| Binary partner | Rows / interiors | Contained | Median interval width | Midpoint MAE | Pressure-fitted NRTL MAE | Largest midpoint error |
|---|---:|---:|---:|---:|---:|---:|
| Acetone, 328 K | 21 / 19 | 19 | 0.24219 | 0.06666 | 0.00362 | 0.25784 |
| Ethyl acetate, 348 K | 19 / 17 | 17 | 0.32031 | 0.12415 | 0.00314 | 0.35387 |
| 2-propanol, 353 K | 26 / 24 | 24 | 1.00000 | 0.25066 | 0.00238 | 0.49400 |

All fractions and errors are on the unit mole-fraction scale. At 353.35 K and 93.9 kPa the liquid 2-propanol fraction was 0.9944 and the gas measurement was 0.994. The inversion returned [0,1] and predicted 0.5. Pressure-fitted Wilson gave 0.9938042. The curvature diagnostic also lacked sign resolution. At the observed interior pressure maximum, the two preregistered finite-difference ranges for log pressure were [−11.55, 8.32] and [−5.75, 3.61] per squared mole fraction. They are finite differences at the reported compositions. Neither supplies a derivative remainder bound. The width limit was 0.05, containment threshold 90%, and the midpoint had to improve both the mean and maximum absolute error on all six point controls on each isotherm.

## Which constraints enter the inverse?

In a stable binary near-isothermal liquid with ideal vapor and negligible composition-dependent liquid-pressure correction, equilibrium at row i supplies a supporting line in liquid fraction z. Up to common affine terms for the two pure standard states, its value is

```
L_i(z) = log(P_i / 1 kPa) + z log(y_i) + (1−z) log(1−y_i).
```

Each line must attain the upper envelope at its own liquid fraction. Ordering vapor fractions orders the slopes. Nondecreasing slopes and active neighboring lines imply all the finite support inequalities on an ordered set of liquid fractions. Conversely their pointwise maximum gives one convex piecewise-linear extension. Such a construction may contain corners and does not specify a smooth material. At a pure endpoint the appropriate terminal coordinate uses its one-sided limit.

The inner calculation uses nominal liquid fractions and a grid spacing of 1/256 for vapor fractions. A forward and reverse propagation of unions of log-pressure intervals shares one latent pressure per row. For each mixture the two most separated feasible grid states at the widest row have archived *complete* pressure and vapor paths. The independent reader checks each path against every other supporting line with 55-digit decimal arithmetic. At the first interior 2-propanol row the two witnesses give vapor fractions 1/256 and 214/256. These alternatives demonstrate substantial ambiguity inside this specific finite-data model. They do not establish two real fluids with those vapor fractions. The outer calculation covers the full vapor domain with 256 cells and bounds the support terms separately, allowing additional paths. Its midpoint at successive rows need not itself form a common feasible path. The 2e−12 outward log guard is numerical.

The original sensor pressure estimate was ±0.15 kPa and the reported composition accuracy 0.005. For latent pressures we used the archive's row-specific expanded pressure uncertainties and an engineering allowance of 0.06 K⁻¹ on the magnitude of the temperature derivative of log pressure. All outer liquid-fraction boxes use ±0.005 around the reported interior values and assume their ordering is preserved. Minimum adjacent nominal spacings are 0.0077, 0.0103 and 0.0056. Ranks can overlap on the first and third curves. The pressure adjustment to midpoint temperature supplies no corresponding bound on vapor-fraction variation with temperature. Comparisons with actual row-temperature gas assays are therefore empirical near-isothermal diagnostics; the interval is a conditional numerical relaxation.

A separate local check follows from differentiating the two common-tangent conditions at an interior azeotrope. For fixed temperature, stationary pressure, positive vapor curvature and positive volume gap, the local slope s satisfies (vapor volume − liquid volume) P″ = vapor Gibbs curvature × s(s−1). Two positive slopes can give one local curvature when s(s−1) is between −1/4 and 0. This identity concerns a local observation. Endpoints and the rest of the pressure curve can supply additional information.

## Predictions and replay

All point controls use the reported row temperature. They comprise ideal-liquid Raoult, original UNIFAC, Wilson and NRTL at published coefficients, and separate pressure-only fits of Wilson and NRTL. The last two use the authors’ relative-pressure squared objective and four fixed starts. The pure constants came from Table 5. The SRK vapor calculation uses the quadratic attractive and linear covolume mixing rules, assumes zero binary vapor interaction coefficient, and includes a Poynting factor using the tabulated liquid volumes. Original UNIFAC uses the DDBST subgroup assignments and `thermo==0.6.0`. The paper supplies the fitted coefficients and aggregate comparison, without an archived row forecast bank. The same-input pressure refits provide a separate matched comparison.

The first source HTML request returned HTTP 403. The versioned NIST archive was subsequently authenticated by its published SHA-256. Two native forecast attempts failed while reconstructing a complete pressure witness. The first proposed remedy handled roundoff alone. The actual fix rejects an intrinsically empty pressure-difference edge before adding an upstream interval; an adversarial test covers this case. Both failures preceded all gas-assay extraction. The forecast file was locked and read back at 07:40:28 UTC on 2026-11-23 before the independent gas series were opened. The separate decimal receiver reproduced all 462 forecast components, all 12 decisions and the six complete tangent witnesses. The full numerical results, frozen input rights and native receipts accompany the study.

Run `python replay.py` from this directory. The standard-library verifier checks both frozen banks against the authenticated XML in the 189 MB versioned NIST archive. Supply `--xml /path/to/je049816w.xml` to use a local copy. To regenerate fits and bounds, install NumPy, SciPy and `thermo==0.6.0`, then run `python forecast.py je049816w.xml new-forecasts.json`. Solver versions may change final floating-point bytes. The original archived forecasts remain the comparison reference.

[Original measurements and methods](https://doi.org/10.1021/je049816w) · [Versioned NIST ThermoML distribution](https://data.nist.gov/od/ds/mds2-2422/ThermoML.v2020-09-30.tgz)
