# Can early capacity shape distinguish cells under the same fast-charge protocol?

A forecast trained on 41 historical lithium-ion cells performed worse on a separate 42-cell author release when it added a model of early capacity rise and longer-term decline. The archived historical early forecast had an RMSE of **86.42 cycles**. Adding the capacity-shape correction increased RMSE to **208.09 cycles**. Calibration within repeated protocols reduced the new signal’s weight to exactly zero. The resulting candidate, shuffled-feature control and policy-only control give identical predictions for any finite cohort. This algebraic tie rules out the registered strict-improvement criterion before an Attia validation measurement is needed.

The study uses physical time-to-0.88-Ah discharge capacity, the author’s 80%-of-nominal end-of-life criterion. All measured capacity/voltage prefixes and terminal cycle-life values for the 45 Attia validation cells remained sealed. The source study is public, including its published aggregate observations. We inspected identifiers and checked the equality and availability of archived early forecasts to authenticate the cell mapping.

## Where the added signal failed

| Historical cell or group | Observation |
| --- | --- |
| Development row 7, zero-based | Physical life 691 cycles. The archived early forecast was 586.0523 cycles. The shape residual raised the forecast to 1,777.3257, an error of +1,086.3257 cycles. |
| Cycles 39, 40 and 41 of that cell | The source gives 1.0694541, **2.8840845**, and 1.0694818 Ah. The isolated high capacity has unknown cause. Its effect on the fitted residual RMS placed that feature 529.25 training standard deviations above its training mean. |
| Largest opposing pair | Historical rows 0 and 1 shared a charging protocol. Physical lives were 1,852 and 2,237 cycles. Shape forecasts were 2,464.81 and 2,073.14 cycles, reversing their order and contributing −75,396.46 cycle² to the calibration cross-product. |

The correction at row 7 adds **1,191.2734 cycles** to the archived early forecast. Individual contributions in cycles are intercept +11.7688, constant-capacity coefficient −26.6723, early-rise coefficient −250.0863, linear term +42.5792, quadratic term +175.5948, and residual RMS +1,238.0891. The frozen fit consumed the published sample value as recorded. Its effect does not identify the cause of that measurement.

## External fit and declared test

For cycles 2–100, set `x=(n−2)/98` and fit discharge capacity in Ah to the four basis functions `1`, `1−exp(−(n−2)/24)`, `x` and `x²`. The four fitted coefficients and the RMS residual enter a ridge correction in cycles to each archived historical forecast. Initial rise and later decline are modeling terms. These passive capacity traces do not uniquely identify electrochemical mechanisms. Two controls used the same early forecast and measured capacity trace with either all 99 capacities or four conventional capacity summaries. Historical charge schedules identified exact repeated protocols.

All roles learned weights on the 41-cell source split. The 42-cell development array selected among ridge penalties 0.1, 1, 10 and 100 by absolute RMSE. This particular author export contains 42 records, while the earlier Severson paper describes a 43-cell primary test. We used every exported row. The released historical Severson forecast vectors and the later Attia OED checkpoint are distinct source objects.

| Historical development role | RMSE, cycles | Selected ridge penalty | Within-policy slope | Frozen slope |
| --- | ---: | ---: | ---: | ---: |
| Archived historical per-cell forecast | 86.4173 | — | 0.732302 | 0.732302 |
| Same forecast plus four capacity summaries | 87.7762 | 10 | 0.383293 | 0.383293 |
| Same forecast plus 99 cycle capacities | 96.2586 | 100 | 0.165044 | 0.165044 |
| Same forecast plus capacity-shape residual | 208.0918 | 100 | −0.559338 | **0** |

Only three development protocols repeated, with group sizes 2, 3 and 2. De-meaning within each group yields **four independent contrast dimensions**. The shape cross-product is −57,203.4151 cycle² and its centered sum of squares is 102,269.8611 cycle². Their ratio is −0.5593379561. The registered calibration clips to [0, 1]. This sparse calibration is a property of the released historical cohort.

On a validation protocol with pre-validation CLO prior `c`, the registered candidate is `c + slope × (u_i − mean(u))` for each accepted early forecast. Each compared role assigns `c` to the cell missing its accepted early forecast. With slope zero both the candidate and the control that rotates the added features within a protocol give exactly `c`, for arbitrary finite features and every physical endpoint. The preregistered gate required strictly lower mean within-protocol RMSE plus six of nine protocol wins versus each comparator and the shuffle on matching 45- and 44-cell panels. Equality makes that criterion impossible. There are **zero observed Attia validation scores** from this experiment.

## Which validation information was available

After four closed-loop rounds, the authors chose the top three CLO protocols, four literature-inspired protocols and two representative protocols, then physically tested five cells per protocol. Those nine selected interventions are the prospective validation population. The policy-level CLO mean and each individual early forecast have different information and different units of analysis. The planned cell deviation also uses contemporaneous accepted peers after they complete cycle 100.

The legacy author README explicitly places the early voltage-difference and full capacity rows in the same order as the March 2019 file of channel-indexed early forecasts. The original MATLAB exporter sorts once by protocol and writes the capacity and voltage records from the same cell in each loop iteration. All 45 channel IDs and barcodes are unique. All **44** available compact forecasts agree exactly with the original channel-indexed predictions. Channel 12 is the one missing compact forecast and is covered by the authors’ 2,000-cycle prediction-interval rule. Channel 46 is documented as a bad contact and is absent from the 45-cell release. The planned complete panel retains all 45 physical targets. A separate panel retains the 44 accepted forecasts. The post-hoc 145-cycle validation mean shift was ineligible as a prediction input.

The exact later OED checkpoint has MATLAB feature indices 1, 2, 8, 10 and 11. They represent cycle-2 capacity, maximum early capacity rise, and three features of the cycle-100-minus-10 voltage curve. The planned direct checkpoint replay and the held physical endpoint-order check were **unexecuted**. The source-order and early-forecast checks above were executed. No numerical agreement between the checkpoint replay and those 44 validation forecasts has been measured here.

## Reproduction and custody

Run `python3 independent_fit.py` to fetch eight pinned author blobs from the external historical cohorts and repeat the model's penalty choice, zero shrinkage and worst-cell result using Python’s standard library. It uses a primal normal-equation solver and checks the outputs of the producer’s NumPy dual ridge fit. The first cold receiver encountered an unhandled UTF-8 byte-order mark in an author CSV. The corrected reader strips that marker after verifying the exact original Git blob. Both native operation receipts are in `native-originals.json`.

`python3 verify_receipts.py` checks the immutable local results, worst-cell decomposition, contrast calculation, original gate and restricted data use. `forecast.py` and `score.py` are archived prespecified programs. The ordinary verifier runs offline and reads neither validation data nor the network. Across seven native jobs, including the first cold parser refusal, the measured totals were 3.751 seconds of process wall time, 0.688316 CPU seconds and a maximum of 37,457,920 bytes for the largest waited process. These figures exclude queueing and software publication.

Source and protocol identities are in `source-qualification.json`. The producer fit is `historical-model.json` (SHA-256 `56656d8ae4f5fb05f76152cf53c0e4db9ff38aef228e68cc66af63bfbf8b4a39`). The independent recount uses only eight older historical files. The description of cohort selection and the end-of-life definition comes from the [Attia et al. publication](https://doi.org/10.1038/s41586-020-1994-5). The original row and early-forecast dependencies are documented in the [author validation archive](https://github.com/petermattia/battery-parameter-spaces/tree/ec9508f9d2d6098f6e9a46dfaf79a222e65d7491/Validation), the [published figure source](https://github.com/chueh-ermon/battery-fast-charging-optimization/tree/0068fd0136bcd65884f5cd94b2b967c1ba73a668) and the [OED processing code](https://github.com/chueh-ermon/BMS-autoanalysis/tree/c82ab7704211a6aee75bd926714b82d1f95e1a0e).
