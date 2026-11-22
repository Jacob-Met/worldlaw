# Can nine pH baths resolve seawater carbon concentrations?

**The temperature series failed to improve average recovery of either total alkalinity (TA) or dissolved inorganic carbon (DIC) on 16 held batches.** A single-bath estimate with a dilution-based alkalinity calibration gave mean absolute errors of **54.746 TA and 45.267 DIC µmol/kg**. Combining the same calibration with nine pH baths gave **54.841 and 46.175 µmol/kg**. The nine-bath estimator reduced the largest error by 0.192 µmol/kg, from 436.900 to 436.707. It failed the two mean-error gates and passed the worst-error gate.

The experiments changed salinity and equilibrating gas independently. Twenty-five preparations from one Atlantic water stock supplied five salinity groups crossed with five gas levels. Each preparation supplied 44 sealed bottles. We used the authors’ optical, zero-indicator-extrapolated total-scale pH at nine recorded bath temperatures per batch, together with measured salinity, reactive phosphate and silicate. Separate open-cell HCl titrations measured TA and coulometry measured DIC. All 25 batches and all 225 reported baths entered the study. Of 100 replicate slots for each assay, 99 TA and 99 DIC values were present. [Woosley and Moon, 2023](https://doi.org/10.1016/j.marchem.2023.104247) · [Raw optical measurements](https://doi.org/10.26008/1912/bco-dmo.905235.1) · [Zero-dye pH and nutrients](https://doi.org/10.26008/1912/bco-dmo.905357.1) · [Independent carbon assays](https://doi.org/10.26008/1912/bco-dmo.905278.1)

## Where the temperature information comes from

At a given temperature and measured pH, the carbonate-system charge balance can be written

$$A=z_i C+b_i.$$

Here $A$ denotes TA and $C$ denotes DIC in µmol/kg. The coefficient $z_i$ is the mean alkalinity contribution per mole of dissolved carbonate carbon. The intercept $b_i$ includes the contributions of borate, water, phosphate, silicate and the other specified acid–base species. Different temperatures can identify the absolute concentrations only to the extent that these lines are distinguishable within measurement and model error. In the carbonate-only limit with $b_i=0$, scaling both concentrations together leaves the same pH trajectory.

We evaluated the coefficients with PyCO2SYS 1.8.3.4 for the study’s Millero (2010) carbonic constants and Lee et al. boron–salinity relationship, at atmospheric sea pressure and on the total pH scale. The solver uses its Dickson bisulfate and default fluoride option, the measured nutrient concentrations, its salinity-based conservative constituents, and zero additional ammonia, sulfide and user-defined alkalinity. The authors previously evaluated dissociation-constant choices using this experiment. Our parameterization and the archived indicator correction therefore carry that historical source exposure. Covariance from shared dye calibration and dissociation constants is possible. [Official solver](https://pyco2sys.readthedocs.io/en/latest/) · [Full registered assumptions](registration.txt)

A premeasurement calculation shows the size of the ambiguity. Two modeled waters at salinity 35 have (TA, DIC) equal to (2260, 2040) and (2366.920, 2140). They have equal pH at 20 °C. At all nine temperatures from −1.5 to 40 °C, a single common observed pH trajectory could fit either water with componentwise errors at most 0.00022143. This is a finite example under the fixed chemistry. It does not determine the actual error distribution of the optical apparatus. [Synthetic controls and witness](conditional-witness.json)

## The 16 held batches

The nine central salinity–gas combinations provided the only assayed calibration data. The sixteen combinations on the outside of the experimental design were forecast together before their carbon assay values were decoded. The source gas identified the intervention group and was excluded from model inputs. The calibration estimated a single TA-to-salinity slope. This expresses the expectation that dilution or evaporation changes conservative alkalinity proportionally to salinity and that gas equilibration changes carbon content. The strongest elementary comparator uses this predicted TA and the bath closest to 25 °C to obtain DIC. The registered joint estimator fits the complete optical trajectory with that same calibrated alkalinity constraint. Its fixed weighting gives each whole optical trajectory one block of weight. No held batch determined the relative weights, slope or choice of bath. [Split](split.json) · [Locked forecasts](locked.json)

| Method | TA MAE | DIC MAE | Worst error in either concentration |
|---|---:|---:|---:|
| Calibrated TA/salinity, one bath | 54.746 | **45.267** | 436.900 |
| Calibrated TA/salinity, nine-bath median | **54.746** | 46.097 | 436.900 |
| **Registered joint estimator, calibrated TA and nine baths** | **54.841** | **46.175** | **436.707** |
| Calibrated affine TA, one bath | 55.529 | 46.008 | 439.130 |
| Calibrated affine TA, nine-bath median | 55.529 | 46.612 | 439.130 |
| Fixed TA = 66 × salinity, one bath | 60.271 | 52.465 | 461.136 |
| Fixed TA = 66 × salinity, nine-bath median | 60.271 | 52.488 | 461.136 |
| Supervised ridge on salinity and pH trajectory | 101.987 | 98.815 | 493.144 |
| Free optical least squares | 1296.863 | 1219.473 | 2477.432 |
| Free optical scaled least squares | 1315.615 | 1238.777 | 2477.311 |
| Free optical minimax | 1397.520 | 1318.314 | 2476.706 |
| Free inverse, coldest and warmest baths only | 2461.136 | 2334.987 | 13726.907 |

Errors are in µmol/kg, weighting each held batch once. The largest registered error occurred at batch 26, salinity 38.5266 and source equilibrating-gas value 162.6 µatm. Its four TA titrations were **2082.19, 2081.68, 2080.86 and 2081.75**. Its mean was 2081.62, compared with 2518.520 from the salinity calibration alone and 2518.327 after adding the complete optical trajectory. The four DIC results were 1678.9, 1677.7, 1678.2 and 1678.3, giving a mean of 1678.275 versus the joint prediction of 2052.927. For the five highest-salinity batches, measured TA ranged from 2081.62 to 2529.67 and the single-stock calibration predicted 2514.49 to 2541.95. These measurements establish a limitation of this calibration under the held preparations. No mineral or process measurements in this comparison identify why the batches differ.

## Feasible concentrations and the raw bath witness

For a pH allowance $\varepsilon$, the two endpoint pH values at each bath give affine lower and upper bounds on $A$ at each nonnegative $C$. We intersected all nine strips in the nonnegative $(A,C)$ plane. These are deterministic compatibility tests under fixed chemistry and engineering tolerances. They are not confidence intervals. The containment check requires the measured concentration pair to satisfy the full joint intersection.

| Allowed pH deviation | Empty | Finite | Unbounded | Contain both assay values | Both widths ≤20 µmol/kg |
|---|---:|---:|---:|---:|---:|
| ±0.0005 | 16 | 0 | 0 | 0 | 0 |
| **±0.003** | **15** | **1** | **0** | **0** | **0** |
| ±0.010 | 2 | 4 | 10 | 1 | 0 |

When the nine intervals for $z_i$ overlap, an admissible slope $k$ allows both $A$ and $C$ to increase along $(k,1)$ from a feasible point. This gives a mathematically unbounded interval in the specified fixed-constant model without an external concentration cap. Arbitrarily large concentrations would change seawater composition and can exceed the physical domain of those equilibrium constants. The finite two-water example above remains within ordinary concentration scales.

Batch 26 illustrates the opposite failure. Three of its registered ±0.003 inequalities, the lower bounds at −1.703 and 14.985 °C and the upper bound at 40.003 °C, have a nonnegative weighted sum that requires **0 ≤ −5.98591 µmol/kg**. Exact rational arithmetic on the stored coefficient bits confirms this inconsistency. The same verification is provided for all 15 infeasible held batches and five infeasible calibration batches. Entering the actual TA and DIC assays into the registered forward solver at 14.985 °C gives pH 8.348621, compared with measured 8.368000. The result concerns joint compatibility of these source measurements, the assumed chemistry and the allowed error. It does not isolate an optical or chemical cause. [Per-bath measured values, forward residuals and exact certificates](bath-diagnostics.json)

The raw versus summary temperature audit also found a genuine duplicate temperature group in batch 2. Two separate four-bottle groups were measured near 35 °C, with recorded group temperatures 34.980 and 34.964 °C. Both groups remain at those temperatures. Of 3,600 raw optical readings, two had missing individual thermometer values and all had a source calculation temperature. No 40 °C group was assigned to batch 2. [Raw bath audit](raw-bath-clocks.json)

## Reproduce

Use Python 3.12, PyCO2SYS 1.8.3.4, autograd 1.8.0, NumPy 2.2.6 and SciPy 1.15.3. The command obtains and verifies all three original BCO-DMO CSV files. It projects numeric fields for prediction, hashes the complete forecasts, and only then reads the held assay values for scoring. The summary CSV contains carbon values in other columns. The predictor process receives a separate file containing only the permitted optical and nutrient fields and an assay file limited to the nine calibration batches.

```sh
python replay.py /path/to/source-cache --fetch --work /path/to/new-output-directory
```

The independent reader works from the original assay CSV. It verifies 600 component prediction errors, 675 individual bath-strip tests, both registered decisions, and the worst rows and replicates. The separate coastal two-temperature study did not meet this course’s admission requirements and its records were left unopened. [Observed results](observed.json) · [Independent recount](independent.json) · [Source identities](source-registry.json) · [Execution receipts](course-receipt.json)
