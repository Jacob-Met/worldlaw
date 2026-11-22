# Cross-heater transfer on the TCLab benchmark

Allowing each heater its own ambient heat-transfer coefficient and sensor time constant lowered the mean absolute error over the full two-heater validation run from 0.700791 °C to 0.568122 °C. The same change increased error on the prespecified reverse-transfer test, where heater 2 alone was switched on and sensor 1 measured the passive response. The joint promotion criterion failed.

## Experiment

Park et al. measured two independently actuated heaters on one physical TCLab device. We used the two-heater archive from their 2020 paper at DOI `10.1016/j.compchemeng.2020.106736`. Its 600-sample training and validation runs have separate open-loop command sequences. A third file contains 69 steady-state training rows for their neural Hammerstein model. The acquisition code sets both heaters, waits, then records both temperatures. In the matched continuous-time models the command at row *i* therefore drives the interval ending at that row. The recorded timestamps are the nominal row clock. [Paper](https://doi.org/10.1016/j.compchemeng.2020.106736) · [Original author archive](https://raw.githubusercontent.com/APMonitor/arduino/f36e65a70dd7122d1829883899e40e56bf6c4279/CACE_2020_source.zip)

The two centered training command columns have singular values 1100.77 and 496.96 percentage points and correlation −0.265. During the first isolated step, heater 1 ran at 80% while heater 2 stayed off. From training rows 10 to 119, the passive sensor warmed from 22.19 to 25.70 °C. The validation course reverses the active heater. Rows 10 through 59 have heater 1 off and heater 2 at 100%.

The authors' four-state model has two heater body temperatures, two sensor temperatures, heater-specific electrical gains, equal body heat capacities, ambient convection and radiation, and equal-and-opposite heat exchange between the bodies. Their fitted model shares the ambient coefficient and sensor lag between heaters. Our single candidate allows both to vary by heater. It retains the same pairwise heat exchange and fixes ambient temperature at the released 23 °C. Training gave coefficients 5.709 and 4.890 W m⁻² K⁻¹ and lags 21.48 and 16.46 s. An independent-heater control refits the remaining parameters with the exchange terms removed. Distinct command directions make this comparison possible. They alone cannot uniquely identify heat capacity, electrical gain, sensor lag, and every heat-transfer mechanism.

We registered the candidate, controls, input bounds and joint criterion before scoring. The candidate had to beat both the native author energy model and the tied-coefficient refit by more than 0.05 °C over the full run, and beat both on the passive sensor during the reverse step. The trusted CSV reader extracted time, heater commands and the first measured temperature pair for prediction. It discarded later temperatures. The twelve forecast arrays were locked before scoring. Every validation row and both sensors were retained. The initial condition counts in the full score. All matched roles use only the measured pair at row zero. The native printed ARX role follows its released zero-command equilibrium initialization. Registration `176444`, forecast lock `176467`.

## Results

The full metric is the arithmetic mean of the 1,200 absolute prediction errors. The reverse-step metric averages the 50 errors for passive sensor 1. All values are in °C.

| Forecast | Training MAE | Validation MAE | Reverse-step passive MAE |
|---|---:|---:|---:|
| Author energy balance, GEKKO | 0.225218 | 0.700791 | 0.208147 |
| Author energy balance, RK4 | 0.228208 | 0.701201 | 0.211206 |
| Tied ambient coefficients and lags, refitted | 0.225283 | 0.721669 | 0.211494 |
| Separate ambient coefficients and lags | 0.188625 | 0.568122 | 0.224255 |
| Independent heaters, refitted | 0.815388 | 4.338685 | 0.286481 |
| Author printed ARX, native equilibrium | 2.047287 | 5.446413 | 7.448894 |
| Author printed ARX, observed initial pair | 0.218445 | 3.354492 | 1.430384 |
| Author ANN, matched initial pair | 1.481164 | 1.488179 | 1.460135 |
| Split model, heat exchange disabled | 4.872958 | 1.537183 | 0.287151 |
| Split model, heater inputs swapped | 10.224645 | 10.445139 | 6.948173 |
| Split model, inputs delayed 30 rows | 3.346991 | 3.404774 | 0.304548 |
| Constant initial temperatures | 31.394175 | 30.083350 | 0.295800 |

The baseline with the authors' saved coefficients ran under local GEKKO 1.3.2 and reproduced their reported 0.70 °C MIMO result after rounding. The authors report 2.66 °C for ARX and 1.55 °C for the Hammerstein network. Our printed-coefficient ARX and source-network replay have their own results in the table. The matched ANN uses the released steady-state architecture, training objective and 140 s / 20 s dynamic constants. Its output cascade is integrated from the measured pair. The native printed ARX reaches different initial temperatures under its zero-command steady-state equations. The paper's published MIMO scoreboard has no FOPDT entry.

The split model reduced sensor 2 MAE from 0.653732 to 0.326445 °C and increased sensor 1 MAE from 0.747851 to 0.809799 °C. Between rows 9 and 59, passive sensor 1 warmed 0.65 °C and driven sensor 2 warmed 9.02 °C. The split model predicted 0.296 and 9.073 °C. The native author energy model predicted 0.362 and 8.418 °C. Removing inter-heater exchange from the fixed split fit raised full-run MAE to 1.537183 °C. Refitting the independent heaters gave 4.338685 °C.

The largest split-model error occurred at row 37, still under the 0/100 heater command. Passive sensor 1 read 22.99, 19.45 and 23.09 °C on rows 36–38. The split model predicted 22.888079 °C at row 37 and the native model predicted 22.905002 °C. The training maximum over 30-row block MAEs was 0.333670 °C. Twelve of 20 validation blocks exceeded it. The block containing row 37 averaged 0.209790 °C and therefore missed the largest single error. The data do not establish what caused that reading. The two-channel record supports prediction on this pulse schedule. It provides no replicated-device uncertainty interval or uniquely identified exchange law.

## Reproduce the comparison

Download the linked original `CACE_2020_source.zip`. With Python, NumPy and SciPy, run the receiver in this directory.

```sh
python check_transfer.py /path/to/CACE_2020_source.zip validation-predictions.npz
```

The command verifies the author and forecast SHA-256 digests, checks the input rows and role roster, recomputes every full and reverse-step MAE and worst sample, and replays four continuous-time models with an independent adaptive integrator. The largest discrepancy between the adaptive solver and the frozen RK4 forecasts was 0.000010 °C. The largest for the split candidate was 0.00000025 °C.

The archive SHA-256 is `4cb422489a5396e8e4d156fc7b00f89e4bd7cb9a83561aacbbeee046d6c182ed` and the forecast SHA-256 is `e2c8cf1acab7646e1401c21857ac1ccd1f9536244af4fec69b2d21d18e3d6cb9`. The dynamic training CSV SHA-256 is `65cebd10bde3f07be40b1e9a0d8d81fa3009719bb548c56233710a4d5a5d13c7`. The validation CSV SHA-256 is `4817678bdd839128f2bbf9eb3add7d2793119a95da2dadb304aef9640136e1d9`.
