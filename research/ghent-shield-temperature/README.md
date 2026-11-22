# Can passive temperature and recent weather reproduce an actively ventilated reference?

A thermal-memory correction reduced pooled RMS disagreement from 0.183 to 0.097 °C on two Ghent weather stations. Gradient boosting with the same available measurements reached 0.092 °C. The physical correction passed the passive, static and lagged-linear comparisons, then failed the prespecified competing-model gate. The separate June 9–15 deployment remained sealed for numerical evaluation.

## Instruments and observations

Hellebosch and colleagues collected quarter-hour averages on the Sterre campus in 2023. This study uses only the May 27–June 1 device intercomparison and only Campbell 1 and Campbell 2. Each tripod recorded its own passive temperature (Tap), actively ventilated temperature (Taa), shortwave irradiance (SWR), wind speed, relative humidity and black-globe temperature. Coordinate workbooks place the stations about 3.64 m apart. Every comparison pairs the two temperature channels within a single station row. The 17 portable consumer devices and any cross-station substitution are outside this evaluation. The authors already reported diurnal differences among their instruments. Here the endpoint is agreement with each Campbell station's active reference using the same available passive-side measurements. [Dataset and instrument workbooks](https://doi.org/10.5281/zenodo.13785282) · [Author study](https://doi.org/10.1175/JAMC-D-24-0243.1)

During intercomparison the passive sensors were at 1.84 m. The active sensors were at 1.79 m on Campbell 1 and 1.84 m on Campbell 2. During the later deployment these active heights were 1.79 and 1.87 m. The readings therefore include instrument, shielding and local placement differences. The released battery channel measures voltage. Per-interval fan speed, aspiration energy, airflow and independent true air temperature are unavailable. Source quality control removed problematic observations for multiple reasons, including known loss of power. An individual gap has no released cause code.

All clocks have an explicit UTC+02 offset and 900-second spacing. The two development files each contain 576 complete quarter-hour records. Only header, timestamp, location, height and availability information were read from the separate deployment files. In that deployment Campbell 1 lacked wind at one row, and Campbell 2 lacked the active temperature at two rows. Its numerical temperatures and forcings supplied no model inputs, tuning or scores.

## Frozen comparison

Each of four expanding training windows used both stations through the preceding date and predicted all 96 quarter-hours on both stations on May 29, May 30, May 31 and June 1. This yielded 384 scored rows per station and 5,376 predicted temperatures across seven methods. Estimates use measurements available at the end of the interval. No active-temperature history enters any predictor. The time blocks share weather and are correlated; there are two instruments and four evaluation days.

Identity returns Tap. A second control adds a fitted station offset. A radiation/wind control fits a station term and irradiance divided by one plus the square root of wind speed. The static ridge adds Tap, globe-minus-passive temperature, relative humidity, irradiance, wind, the ventilated load term and cyclic local time. The candidate adds current departures from strictly prior exponential averages of Tap, globe-minus-passive temperature and ventilated load, with fixed 30-, 60- and 120-minute scales. Histories initialize from the first observation of each day and reset after a missing source interval. Another ridge sees the same three quantities at 1, 2, 4 and 8 previous intervals. Gradient boosting receives the union of the static, raw-lag and exponential-history inputs. The ridge fits use training-only scaling. All settings are fixed, with no search. The executable records the precise inputs and settings.

The candidate had to reduce RMS by at least 3% relative to both identity and static ridge at **each** station, with MAE no higher than identity. It also had to match or improve both history controls on the mean of the two station RMS ratios, each normalized by that station's identity RMS. All but the boosting comparison passed. The prespecified diagnostic with SWR at least 400 W/m² and wind below 1 m/s had **zero** scored rows at either station.

| Method | Campbell 1 RMS (°C) | Campbell 2 RMS (°C) | Mean station-normalized RMS |
|---|---:|---:|---:|
| Passive temperature | 0.13339 | 0.22168 | 1.00000 |
| Station offset | 0.13643 | 0.18654 | 0.93210 |
| Radiation and wind | 0.14749 | 0.11326 | 0.80829 |
| Static ridge | 0.12451 | 0.11581 | 0.72788 |
| Raw-lag ridge | 0.10867 | 0.09439 | 0.62022 |
| Thermal-memory ridge | 0.10136 | **0.09318** | 0.59009 |
| Gradient boosting | **0.08673** | 0.09753 | **0.54506** |

The largest candidate error on Campbell 1 was +0.33566 °C at 10:45 on June 1. The active probe read 16.22 °C, the passive probe 16.71 °C, irradiance was 104.3 W/m² and wind was 1.532 m/s. Boosting's error on that row was +0.125 °C. Irradiance rose from 149 to 719.1 W/m² between 11:00 and 11:15, after the peak. On Campbell 2 the largest candidate error was +0.29348 °C at 12:15 on May 30, with 823 W/m² irradiance, wind 2.058 m/s and active temperature 15.41 °C. Both boosting peaks fell at 07:15 June 1, with +0.27474 and +0.33663 °C on stations 1 and 2. The verifier exports the surrounding nine quarter-hours for every tied station/arm peak wherever scored rows exist. The records do not isolate a physical time constant or establish shield or fan causation.

## Reproduce

Download the two original files `Campbell1_device_intercomparison.csv` and `Campbell2_device_intercomparison.csv` from the dataset into one directory. The entrypoint authenticates both byte streams and reads only these filenames. Python 3.12, NumPy 2.2.6, SciPy 1.15.3 and scikit-learn 1.8.0 were used for the original run.

```sh
uv run --no-project --python 3.12 --with numpy==2.2.6 --with scipy==1.15.3 --with scikit-learn==1.8.0 -- python research/ghent-shield-temperature/replay.py /path/to/source /tmp/ghent-development
python3 research/ghent-shield-temperature/verify_scores.py /path/to/source /tmp/ghent-development
```

The independent standard-library verifier checks the exact 768 source rows, all 5,376 prediction values against the archived original (absolute tolerance 1e−10 °C), every reported metric, all worst-row ties and the decision. It writes complete worst episodes with every model's estimate. The original uncompressed forecast JSON has SHA-256 `cea85fdfd80340f3691563830304ac3549a9a9f1633c093f1c79b58004f006ae`. Its subset of raw observations and all estimates are attributed to the Hellebosch et al. source and this analysis. [Original dataset and CC BY 4.0 license](https://doi.org/10.5281/zenodo.13785282)
