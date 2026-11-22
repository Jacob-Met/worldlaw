# Ethylene setpoint transfer across two gas-monitoring sessions

**A constant equal to the source training mean beat every learned decoder when the acquisition changed.** Its RMSE was 5.822 ppm from the ethylene/CO session to the ethylene/methane session and 5.655 ppm in reverse. Removing a sensor-response direction estimated from isolated co-analyte steps helped against a learned reference in one direction, but the registered two-direction gate failed. The two recordings used different co-analytes. Recording identity and co-analyte identity therefore cannot be separated by the crossed comparison.

| Source → destination | Source mean | Development-selected reference | Same unprojected history RBF | Source nuisance projection | Equal-rank sham | Oger reconstruction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CO → CO | 5.752 | 3.178 | 2.960 | 3.115 | 3.004 | 3.280 |
| CO → methane | **5.822** | 18.898 | 16.826 | 11.167 | 15.338 | 36.202 |
| Methane → CO | **5.655** | 19.788 | 19.788 | 34.546 | 21.781 | 262.439 |
| Methane → methane | 5.631 | 3.147 | 3.147 | 3.174 | 3.135 | 3.432 |

Entries are ethylene controller-setpoint RMSE in ppm on the same causal decision times. CO and methane identify the co-analyte. Each entire source fit used the first 60% of its own native rows. The reference was chosen on the final 30% of that prefix: temporal linear regression for CO, temporal RBF regression for methane. The more bounded static RBF-SVR was the best learned method in both crossed recordings after scoring, at 6.772 and 5.847 ppm respectively. Every row and every other arm remains in the original receipt.

In the methane-trained model’s worst case on CO, eight seconds after the ethylene command fell from 16.67 to zero, the nuisance projection predicted **69.961 ppm**. Both commanded gases were zero at 39,641 seconds. Eleven of the sixteen raw responses lay beyond the corresponding channel’s observed source training range. The largest excursion lay 19.82 source interquartile ranges outside its range. In the reverse direction the worst error was −56.398 ppm, with actual ethylene 18.33 and a prediction of −38.068 at 36,256 seconds. All sixteen contemporaneous readings fell inside their individual source ranges in that case. Individual range checks therefore miss at least one severe failure.

## What was measured

Fonollosa and colleagues published two continuous experiments from one 16-channel metal-oxide sensing platform. Each experiment lasted about 12 hours and included controlled changes of ethylene and one other gas. The released target is the mass-flow-controller **setpoint**. There is no independent chamber-concentration or delivery-delay measurement in these columns. The official ZIP SHA-256 is `8b6323b801363e11343ba1a5a7718e76666b715e753b3a40dbdfd1838d953fe7`. [UCI recording and CC BY 4.0 license](https://doi.org/10.24432/C5WP4C) · [Primary experiment](https://doi.org/10.1016/j.snb.2015.03.028).

The CO session contains 4,208,261 native rows and the methane session 4,178,504. Their timestamps include respectively 122,672 and 104,950 equal successive times. The maximum gaps were 0.38 and 0.27 seconds. The common decision was the first actually observed row of each integer second, respecting row order. The two future suffixes supplied 16,833 and 16,715 decisions. The Oger control also retained predictions at all **3,354,707** native suffix samples in each source-to-destination assignment.

The training prefixes reveal two separate difficulties. First, the same transition from zero to 533.33 ppm CO at zero ethylene occurred five times. Mean readings from channel 2 at +60 to +75 seconds changed from 6,055.00 to 52.68 between the first and last occurrences, 4.44 hours apart. This is a measured response difference under matched recent commands. Earlier exposure history and the physical origin of the difference remain unresolved. Second, across 95 and 84 qualifying ethylene-only training transitions, the median sensor-vector projection onto its later measured change was −0.003 and −0.017 at +15 seconds. It reached 0.780 and 0.754 at +45 seconds. This describes the recorded array’s timing relative to the command.

The authors reported within-record ethylene RMSE of 1.7 ppm for CO and 1.3 ppm for methane. Our full-rate reconstruction gave **3.296 and 3.464 ppm**. We executed the pre-2015 Oger reservoir initialization and update methods, with the paper’s stated 100 units, spectral radius 0.1 and input scaling 10⁻⁵. The original application-specific supplementary program, its random draw and trained readout were unavailable. Our seed 1511, float64 least-squares readout and continuous-prefix initialization are explicit. The reconstruction misses the historical result; it supplies a measured matched control for this study. [Oger source](https://github.com/x75/Oger/tree/7bb8439a449f9a04fc31ae6392966ff5c16f83fc).

## Frozen comparison

The intervention direction was estimated only from source training events. Each eligible event had constant ethylene, one co-analyte step, an uncontaminated −15 to −5 second pre-window and a +45 to +60 second late window. After median/IQR normalization, sign each late-minus-pre vector by the co-analyte command change, normalize that vector and average across events. Remove the resulting unit direction before fitting the same temporal RBF model. The sham rotates its sixteen sensor coordinates by seven positions. The estimated co-analyte direction had cosine 0.784 and 0.661 with the independently computed ethylene direction in the two source files. Projection can therefore discard ethylene response as well.

All models receive current and past sensor readings. The temporal features use causal exponential averages with time constants of 2, 15 and 60 seconds. No deployed decoder uses the co-analyte commands, ethylene labels, absolute experimental schedule, future readings or target-record calibration moments. The trusted CSV reader sees interleaved text and selects numeric time/sensor columns only for forecasting. Registry 177596 froze the chronological boundaries. Registry 177686 froze the structural hypothesis before development scores. Registry 177719 bound code and full model identities before suffix sensor access. Registry 177743 bound both complete forecast archives before the scorer read suffix setpoints.

Each crossed direction had to beat the selected reference, the intact history RBF and the sham overall; it had to beat the reference and sham during the first 20 seconds after isolated co-analyte changes. Early ethylene-change error and same-session overall error each had a 5% maximum regression against the selected reference. CO as source met these relative conditions. Methane as source failed all three crossed conditions. The two sessions provide only one physical realization per co-analyte.

Run `python verify_receipts.py` to verify the 13 source/scoring receipts, the ten original tensor extents and both dummy wins. The independent receiver reconstructed 328 arm/stratum summaries (1,640 fields), including full-rate controls, and all 36 worst row identities from the original ZIP. The aggregate attachment is `att-mwrqlpaqd9hycl` (SHA-256 `dc8934bb70a3583f03c35ca0bf22dd15fe666db34085da1798d7dcbfb8485dca`). The materialized original model and forecast archives are identified and ordered in original-tensor-attachments.json and receipts/original-tensor-custody.json.

## Reproducing the computation

The original numeric runtime used Python 3.12, NumPy 1.26.4, SciPy 1.15.3 and scikit-learn 1.5.2, with single-thread BLAS. Twelve measured native jobs for training intake, the Oger calculation, full model fits, both forecasts, scoring, recount and source/failure diagnosis used 248.522 summed wall seconds and 246.866 CPU seconds. Largest observed process RSS was 317,235,200 bytes. These numbers exclude source download, software installation outside those processes, queue time and artifact receiving. The first source owner lost all free scratch. Four pre-admission requests were cancelled and the complete public ZIP was independently received by its original digest on the numeric owner. No shared caches were cleared.

For an independent run, create an empty working directory. Run `python receive_original.py "$work"` and check the ZIP against the SHA above. Copy the published receipts/chronology-source.json into that directory. For each gas name `CO` and `methane`, run the following from the source directory, substituting its name for `$gas`:

```sh
python training_view.py "$work" "$gas"
python native_reservoir.py "$work" "$gas"
python development.py "$work" "$gas"
```

Build a JSON mapping from gas name to `model` (SHA-256 of frozen-model-GAS.npz), `development` (SHA-256 of development-GAS.json), and `reference` (the chosen_reference inside the latter). Supply that mapping as the third argument of `python forecast.py "$work" "$gas" "$model_lock"` for each destination. After both finish, make a new mapping from gas name to `npz` and `json` from the two respective input-only-GAS files. Supply it to `python score_locked.py "$work" "$forecast_lock"`. Pass the resulting held-scores.json SHA to `python recount.py "$work" "$score_sha"`. Source and exposed-case diagnostics run as `python source_dynamics.py "$work"` and `python support.py "$work"`. Source digest checks and unique filenames preserve the original archive identities; a new platform can have different numerical bytes.
