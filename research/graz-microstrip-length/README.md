# Measured two-port response at withheld microstrip lengths

A multiline calibration predicted the measured scattering matrices of the 1 mm and 6.5 mm PCB standards more accurately than a covariance-weighted composition of measured standards. Weighting improved the mean across the two lengths relative to equal composition weights, but increased error at the longer standard. Three of ten predeclared comparisons passed.

| Frozen predictor | 1 mm complex RMSE | 6.5 mm complex RMSE | Equal-length mean |
|---|---:|---:|---:|
| Covariance-weighted compositions | .01678017 | .02551250 | .02114634 |
| Equal-weight compositions | .01793447 | .02483373 | .02138410 |
| Nominal-phase empirical fit | .01713773 | .02821427 | .02267600 |
| Archived multiline TRL, short 1 | .01625444 | .02446265 | .02035855 |
| Archived multiline TRL, short 2 | .01625444 | .02446265 | .02035855 |
| Maintained multiline TRL, short 2 | .01625444 | .02446265 | .02035855 |

The target is the complex arithmetic mean of 25 paired incident and reflected sweeps at each frequency, at the original probe reference planes. Errors use all four dimensionless scattering coefficients and all 299 frequencies. The experimental units are two physical standards on one PCB. Each standard has repeated sweeps under one connection. Their within-connection RMS differences from their means were .003345 and .003251. Those observations cannot measure error from reconnecting or fabricating a different standard.

## Measurement and model

Six nominal 50 Ω microstrip lines (0, 0.5, 1.5, 2, 3 and 5 mm) and two documented zero-offset shorts were available before forecasting. For each matched sweep the receiver computes S = B A⁻¹ from measured 2×2 incident/reflected wave matrices. This accounts for the instrument's switch terms. We follow the author acquisition on its recorded 1–150 GHz axis with 100 Hz IF bandwidth and −10 dBm source power. The 30 Ω standards, other shorts and DUT measurements are outside this course. The paper's complete calibration uses a different allocation of standards. Here all six methods receive the same available sources and neither held line.

For a uniform line generator G and fixed invertible left and right fixtures, the measured chain matrices satisfy M(a) M(b)⁻¹ M(c) = M(a−b+c). We used all seven unordered triples for 1 mm and all three for 6.5 mm. We averaged the two orders in raw scattering coordinates, then combined paths with nonnegative, sum-to-one weights minimizing propagated within-standard sweep covariance. Different standards are conditionally independent in this covariance model. A source occurring in multiple paths contributes a shared perturbation. No archived timestamp establishes simultaneous sweep k across standards. Unmeasured connection bias and variation in the lines can affect all predictions.

The authentic author controls run the archived nominal mTRL.run_tug with each short and the maintained multiline.run_multiline with short 2. The documented forward calibration map puts each predicted ideal line back at the measured reference planes. Its inverse round trip through the author's apply_cal had maximum error 5.67×10⁻¹⁴. The original DOI uncertainty driver used short 1 and the maintained example used short 2. The three held predictions agree to numerical precision for the reported metrics.

## Numerical admission and observations

The first protocol refused every source length before issuing forecasts. At 142 GHz on the 0.5 mm line, the unstructured chain perturbation radius was 15.6567 times the minimum singular value of the mean chain. The mean minimum singular value was .10977, and the offending sweep's was .10859. The successor retained that refusal and the same scientific inputs and scoring rules.

Direct composition in scattering coordinates cancels the intermediate chart divisions. With u=b₂₂−a₂₂ and v=c₁₁−b₁₁ the common denominator is D=b₁₂b₂₁+uv. The numerator corrections, their analytic Jacobians and both orderings appear in projective.py. pole_certificate.py uses exact binary64 input centers, rational interval bounds on square roots and the maximum observed 25-sweep deviations of each component. Every one of 4,784 path–frequency denominators excludes zero on its observed source discs. The largest certified radius-to-center ratio was .574247 at 142 GHz. The discs have no calibrated coverage for new sweeps or unknown launch bias. An independent exact complex-rational control checks 60 nonreciprocal compositions through transmission scales of 2⁻⁹⁰, both orders and 12 true-zero extensions.

The worst 1 mm component was S₂₁ at 90.5 GHz. Its measured mean was .251031+.055172i and the weighted prediction was .253734+.019220i, absolute error .036054. At 6.5 mm the worst was S₁₂ at 103 GHz. Its mean was −.044118−.223482i and the weighted prediction was .003970−.228273i, error .048326. Every comparator and all 25 complex sweeps at each witness are in comparison.json. Source order disagreement reached .07961 on the long target, illustrating how the common-fixture hypothesis can matter beyond within-connection variation. The observed discrepancies do not identify their physical cause.

The first score wrapper stopped during import because its working directory lacked the archived author module. The subsequent wrapper supplied both pinned modules and executed unchanged score.py against the already locked forecast. The independent standard-library receiver decoded 59,800 complex entries from the original held A/B records. It used scalar right division and reproduced 14,352 forecast comparisons, all ten decisions and 830 metrics/witnesses. Its largest raw complex difference was 4.75×10⁻¹⁶.

## Reproduction

Use Python 3 with NumPy 1.26.4, SciPy 1.13.1, pandas 2.2.3 and scikit-rf 1.6.2. Obtain Microstrip_measurements.zip from the DOI record and multiline.py at the pinned author commit. From this directory run `python3 replay.py Microstrip_measurements.zip multiline.py NEW_OUTPUT_DIRECTORY`. The runner verifies both original sources, builds every prediction before the held scorer runs, and checks all 12 per-length metrics and ten gate decisions. It reports byte identity and portable numerical agreement separately. The optional exact symbolic controls run with `python3 exact_complex_controls.py` and SymPy. The independent receiver additionally accepts the two original zip evidence bundles listed in comparison.json.

[Experimental release](https://doi.org/10.3217/mgd4n-gq267) · [Measurement paper](https://doi.org/10.1109/TIM.2023.3308226) · [Pinned author code](https://github.com/ZiadHatab/thru-free-multiline-calibration/tree/a622ea32e4d17c5d36ad970eb3828143c887a4cb)
