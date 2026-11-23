# Transferring a voltage map across a reversed magnetic-field sweep

Reflecting the magnetic-field coordinate **while retaining the current and its ramp direction** predicted both held voltage-change maps better than the proposed joint field, current and voltage reflection. The joint reflection improved on copying the same-field source measurement, but it lost all four registered comparisons against the strongest alternative.

| Held current ramp | Same-field copy RMSE | Field reflection RMSE | Joint reflection RMSE | Worst field-row RMSE, field / joint |
|---|---:|---:|---:|---:|
| Increasing, file 25 | 0.00119107 | 0.00019382 | 0.00048471 | 0.00065685 / 0.00072705 |
| Decreasing, file 26 | 0.00118877 | 0.00018093 | 0.00047700 | 0.00051655 / 0.00067118 |

Errors are in the recorded Keithley channel units labeled `e-2V`. Each map contains 231 field settings and 231 current settings. Results for all six comparators appear in `comparison.json`.

## Which measurements were compared?

The measurements come from a single September 2021 Al–InAs side-device cooldown in the Zhang/Frolov release. An early quartet (files 7–10) has both current ramps at both field sweep directions, with 301×301 acquired coordinates per file, nominal ±5 mT and ±0.5 µA. A later quartet (23–26) has the same four traversal assignments, 231×231 acquired coordinates, ±2 mT and ±1 µA. Both quartets use DC readout with the lock-in disabled. The setup scripts specify the source channel and Keithley measurement channel, and the recovered settings include the controller field endpoint and instrument range. The two files in each current-ramp pair share the scan start timestamp. These are four acquired branches per quartet from one device. Rows and interpolated displays are not independent runs.

The inventory found partial scans. For example, files 16 and 17 contain 6,332 and 6,231 rows where 40,401 would be needed for a complete 201×201 grid. The frozen comparison selected the two complete mirrored quartets described above before any response values were opened. The source logs identify commanded current and field. They provide no independently measured microscopic field zero or matched trapped-flux state.

[Author data, instrument settings and scripts](https://zenodo.org/records/6416083)

## Frozen calculation

For each field row and current traversal, the observable is the voltage change from that row's zero-commanded-current reading. A constant additive voltage offset on the row cancels. Each forecast uses the increasing-field records, and the target's zero-current reading is used only to form the target difference. The study evaluates changes in voltage rather than an independently calibrated absolute voltage.

The proposed reflected map takes the source at the negative field and negative current on the opposite current ramp and reverses the sign of its voltage change. This mapping would hold under an appropriate phase/field inversion of the device law, odd dissipation and reflected dynamical histories. Those conditions need more than a static equilibrium symmetry. Electrical offsets, field offsets, hysteresis and differing preparations can all affect this comparison.

The controls copy the same coordinate, reflect just the bias and traversal, reflect just the field, average those three maps and the joint reflection, or learn a linear combination of all four. The learned comparator was fitted only to the early quartet with the fixed ridge rule. Its four weights were 0.35100, 0.18418, 0.28537 and 0.15879. For the later quartet, files 23 and 24 supplied every arm's predictors. All six forecasts for files 25 and 26 were locked before their voltages were read. The study requires the joint arm to beat all five controls on each map's RMSE and worst field-row RMSE. There are no outcome-selected cuts. The authors' microwave-driven Shapiro calculations address a different drive and observable; no inference about a fractional Josephson effect follows from these DC maps.

The largest absolute joint-reflection error was on file 25 at −0.504348 mT and +0.704348 µA. The recorded value was 0.146904118, and the zero-current reference was 0.00110370224. The resulting target was 0.14580041576. Joint reflection predicted 0.15061676048; the field-only prediction was 0.15010183899. The trained blend was closest on this particular row while losing the complete-map comparison. All quantities use the archived channel's units.

## Reproduction

Obtain the original ZIP whose name begins `[Full raw data and summaries] 2021-09-27_Side_20210530`. Its SHA-256 is `152b9a7566679d65b37dd7e9a899d3dc5b4e9a2a35b3f2cb8983b4fb367e90c5`. Run the following commands with NumPy installed from a new working directory containing the three study files.

```sh
python junction.py /path/to/september.zip forecast
python junction.py /path/to/september.zip locked.npz
python audit.py /path/to/september.zip locked.npz result.json
```

The first command reads the two early training pairs and the later source pair. The scoring command reads the later held pair. The independent implementation reconstructs voltage-change maps by their numeric coordinates, refits the early mixture through a spectral solve, and recounts all 640,332 forecasts and residuals. The retained original forecast SHA-256 is `2b156d27ddb959b50417b9862eab845d3992a478bc1c73e86ac144d3412dd17e`; the original score SHA-256 is `66feb524742388eb5d4d4f2af31d5d4679d5b637b4a007370b4366f93f557cd6`. The premeasurement commit is `f322eb30183557c2102fd7ebded3274b030bd60e`.
