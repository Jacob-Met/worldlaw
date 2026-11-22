# Can one screened pumping test predict drawdown at an entire withheld well?

At the TestUM field site near Wittstock/Dosse, allowing the model to distinguish three observation depths improved one of three withheld wells. It increased the mean held-well error by 2.10% relative to the depth-independent Theis solution. The result closes the pressure comparison on this release. The proposed transfer to temperature was conditional on the hydraulic result and was never executed.

## Physical measurements and use of the data

Heldt and colleagues released one pumping and recovery record at NMR04. Water was pumped from 9–10 m below ground at a measured 5.82 L/min. Three other wells have concurrent pressure observations in the 7–8, 10–11 and 13–14 m screened intervals. The released drawdowns have already been corrected for atmospheric pressure. The nine channels each have 933 one-second observations. The source well has 467 observations at two-second intervals. The principal clock uses the logger's 332-second pump interval. The activity log allows 333 seconds. Absolute day metadata also differ between the work log and some filenames. All comparisons use elapsed seconds within the shared release.

The thermal experiment used a different well, W2_2z_C06, with a continuous 7–14 m screen. Its forcing was measured as total wellhead flow and temperature. Three of the 18 thermocouple-equipped wells also have hydraulic observations. Neither the pumping data nor the wellhead flow gives the vertical distribution of inflow at C06. The authors' full 3-D OpenGeoSys study included site investigations and pumping at three source depths. Only one source-depth record is in this 91-entry archive. Its contents include the thermocouple and pressure data and processing programs. They do not include the authors' simulation deck, mesh or simulation output. The comparisons below concern two homogeneous hydraulic models. They do not compare the authors' OpenGeoSys forecast with measured temperatures. [Data and file documentation](https://doi.org/10.1016/j.dib.2021.107035) · [Released dataset, CC BY 4.0](https://doi.org/10.17632/rjzt4hjb8h.1) · [Original predictive simulation](https://doi.org/10.1016/j.jhydrol.2021.126229) · [Follow-up sensitivity analysis and site description](https://doi.org/10.1186/s40517-023-00255-5)

## Competing physical models

Both models use the same measured source location, reported pumping rate, pulse length and horizontal distance to each observation well. The Theis pulse is the difference of two confined-aquifer exponential-integral step responses. The finite-screen calculation averages a three-dimensional transient over the finite source and observation intervals. A cosine expansion enforces reflecting horizontal boundaries at 6 and 15 m. The apparent radial diffusivity, positive scale and vertical-to-horizontal conductivity ratio describe a homogeneous, flat confined aquifer. Surface elevations vary at the actual site. The models omit variations in wellbore storage, stratification, local topography and measured pipe backflow. [USGS treatment of finite well penetration](https://pubs.usgs.gov/wri/1986/4199/report.pdf)

Each fold fits all times and depths from two wells and predicts the third. The fixed grid has 41 diffusivities between 0.01 and 10,000 m²/s. The finite-screen arm also searches 23 conductivity ratios from 0.003 to 1. Each candidate's positive gain is fitted on the training wells. Each well contributes equally to the primary mean of the three RMSEs. The decision requires at least a 10% reduction in that mean and no individual ratio above 1.05. Source pressure rows and examples of large depth differences were inspected before the comparative fits. These three whole-well folds are development diagnostics from one pumping event. Nine channels and 8,397 times-by-channel values do not constitute independent experiments.

| Entire well held out | Theis RMSE (mm) | Finite-screen RMSE (mm) | Ratio | Largest finite-screen signed error (mm) |
|---|---:|---:|---:|---|
| W2_2z_D09 | 1.1680 | 1.2588 | 1.0777 | +4.625 at 3 s, 7.5 m |
| W2_2z_U01 | 1.2038 | 1.1358 | 0.9435 | −6.199 at 335 s, 7.5 m |
| W2_2z_U07 | 1.0381 | 1.0868 | 1.0469 | −6.603 at 340 s, 7.5 m |

At U07, 340 s after pump start, the 7.5 m receiver measured 13.734 mm of drawdown and the model predicted 7.131 mm. At the source, 301.432 mm of drawdown at 332 s became −134.370 mm at 334 s. The authors documented pipe-water backflow after pumping stopped. The mismatch at U07 does not by itself identify the effect of backflow on this receiver. The one-second clock alternative gives a mean ratio of 1.0047. Doubling grid resolution in both dimensions at the primary clock gives 1.0062. Both miss the decision limits. The result does not establish that all models of partial penetration must lose.

## Independent measurements and bounds

An independent receiver reads the observations and coordinates again, evaluates the Theis integral by adaptive quadrature, and replaces the cosine expansion with 3-D complementary-error-function image sources. Six-point Gaussian integration covers each of the two screens. Over all 16,794 scalar primary predictions the largest disagreement between numerical implementations is 0.000156 mm. This checks the implemented ideal equations independently of their accuracy on the wells.

At a common time and well, any model giving one prediction at all depths must incur an absolute error at least half the observed range. Direct decimal arithmetic gives 1.2 mm at D09 (10 s), 2.7 mm at U01 (339 s) and 2.6 mm at U07 (340 s). These are minima against these actual recorded values. Measurement uncertainty and local hydraulic differences both affect them.

A separate exact control uses two passive parallel paths with the same head at both ends. Conductances (1, 2) and (2, 1) yield identical total flux for every imposed head drop. The upper path carries one third versus two thirds of total flow, and its unit-volume transit time at unit total flow is 3 versus 1.5. The construction demonstrates a common-port ambiguity in that class of hydraulic models. Neither pair was fitted to the site. A spatially resolved site model or independent interval-flow measurements can supply information beyond those common-port observations.

## Replay and thermal data custody

The public replay downloads the authors' 38,777,114-byte archive, checks its SHA-256, opens only coordinate and pressure members, repeats both clock fits and the refined-grid sensitivity, and independently reconstructs the primary forecasts. It writes every pressure forecast and observation as an NPZ alongside the fitted models and complete worst errors. The supplied result JSON reports the original native comparison. NumPy and SciPy are required.

```bash
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/wittstock-screened-pumping/replay.py --cache /tmp/wittstock-input --output /tmp/wittstock-results
```

During initial workbook schema inspection, one local type query decoded cells in the first preinjection temperature row (22 May 2019 at 13:40). Only type names were emitted from its sensor cells. This occurred more than 29 hours before heat injection began. No numerical temperature was displayed, fitted or scored. No post-injection temperature responses were opened for this study. In particular the hydraulic decision supplies no estimate of thermal accuracy.
