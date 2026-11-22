# Forecasting bridge strain at higher truck speeds

An axle-weighted model using two measured bridge frequencies had **0.8592 µm/m** mean waveform error on ten held fast crossings. A simpler forecast transported the observed 5.6 m/s strain profile along the new measured truck trajectory and reached **0.1225 µm/m**. The shared modal model lost all three registered performance comparisons. All ten held passages and five gauges had usable observations.

## Measured transfer

Each table entry averages waveform RMSE in µm/m, weighting each gauge and passage equally. The last column is the largest five-gauge mean for a single crossing. Each higher-speed group has five distinct runs with the same loaded vehicle.

| Fitted model or profile | All held | 11.1 m/s | 13.9 m/s | Worst passage |
|---|---:|---:|---:|---:|
| Mean 5.6 m/s spatial profile | 0.1225 | 0.1029 | 0.1420 | 0.1769 |
| Static weighed axles | 0.1269 | 0.1075 | 0.1463 | 0.1795 |
| Mean crawl spatial profile | 0.1334 | 0.1118 | 0.1549 | 0.1883 |
| Separate spatial curve by load | 0.1335 | 0.1134 | 0.1536 | 0.1882 |
| Zero change | 0.7867 | 0.8046 | 0.7689 | 0.8091 |
| Axle basis with speed and squared speed | 0.8190 | 0.5828 | 1.0551 | 1.0964 |
| Two historical modes on weighed axles (primary) | 0.8592 | 0.3290 | 1.3894 | 1.4532 |
| Fourteen delays on weighed axles | 0.8927 | 0.7759 | 1.0094 | 1.0225 |
| Two historical modes on separate-load curves | 0.9274 | 0.6077 | 1.2471 | 1.2722 |

On the four development runs reserved for choosing regularization, two historical modes on separate load profiles reached 0.06960, the 14-lag model 0.07111 and the primary model 0.07355 µm/m. The development group covers crawl and medium speeds. Its ranking did not carry over to the two faster groups. The primary model's worst passage was run 4 at 13.9 m/s. The medium profile's worst passage was run 1 at that speed.

## What happened at the largest error?

The largest primary error occurred on a different crossing, loaded 13.9 m/s run 5, at gauge `Str_255Z`. At UTC nanosecond 1714040960152000000, the gauge read 2246.592749 µm/m. Subtracting its own first 100 scored observations' mean of 2249.56696637 gives a change of **−2.97421737 µm/m**. The clock places this reading 28.242 seconds after the optical time origin, inside the inferred axle crossing interval of 23.8464 to 29.5841 seconds. The measured truck speed was 13.5175 m/s and the optical distance fit had a 0.1680 m RMS residual.

| Same gauge and timestamp | Predicted change (µm/m) | Signed error (µm/m) |
|---|---:|---:|
| Mean 5.6 m/s spatial profile | −3.0081 | −0.0339 |
| Static weighed axles | −2.7488 | +0.2254 |
| Fourteen delays on weighed axles | −4.2304 | −1.2562 |
| Two historical modes on separate-load curves | −4.7187 | −1.7444 |
| Two historical modes on weighed axles | −13.9509 | −10.9767 |

At this timestamp the primary forecast was 11.2021 µm/m below the separately fitted static model and 9.7205 below the separately fitted delay model. These are paired output differences. The original forecast archive contains aggregate model outputs. It cannot uniquely apportion the candidate's internal oscillator contributions. The complete gauge record contains 8,217 actual timestamps and 1,947 scored observations, with every forecast reported wherever the original forecast grid covers that timestamp. The source gives no measured instantaneous axle force. This test establishes a failure of the fitted forcing and modal representation to transfer at the selected gauges and speeds.

The public CSV contains the exact decompressed bytes of the original trace. The original gzip SHA256 is recorded in the trace receipt. CSV SHA256 is `bf0699ddf6034dda99b8bb411b953fb9336289cc5239bcaad385bc36fee9e465`.

[Complete gauge record (CSV)](worst-passage-trace.csv) · [Registration, reference levels and all nine signed errors](failure-trace.json)

## The test

A three-axle truck crossed the same prestressed concrete box girder several times on April 25, 2024. We trained on all 31 loaded and unloaded crossings at crawl speed and 5.6 m/s. We withheld all five loaded 11.1 m/s crossings and all five loaded 13.9 m/s crossings. Those are distinct physical passages on a single test day. The release has no high-speed unloaded crossing. Version 2 includes five unloaded medium-speed records absent from version 1. The primary measurements are the five strain channels used in the authors' response figures, expressed in µm/m. [Source paper](https://doi.org/10.1061/JBENF2.BEENG-8394) · [Version 2 measured data](https://doi.org/10.5281/zenodo.20522191)

| Load state | Front / middle / rear axle mass | Crawl | 5.6 m/s | 11.1 m/s | 13.9 m/s |
|---|---|---:|---:|---:|---:|
| Empty | 6,860 / 2,820 / 2,660 kg | 11 | 5 | 0 | 0 |
| Loaded | 9,340 / 7,160 / 4,750 kg | 10 | 5 | 5 | 5 |

The truck travelled east to west. We registered the passage using the measured 10 Hz front-reflector distance and the authors' surveyed geometry before examining strain. Figure 6 gives front-overhang and inter-axle distances of 0.96, 4.50 and 1.35 m. The reflector laser was approximately 25 m west of the station origin. The two barrier lasers were 71.71 m apart. The 50 m main span and 73.62 m instrumented reference length describe different physical extents. At the higher held speed, a rear tandem passes a single location in approximately one sample interval. The check therefore uses proximity to observed barrier returns and permits a return to coincide with more than one expected axle time. The validation cannot distinguish every tyre or determine a moving contact force.

All 41 front-range fits succeeded. Measured held speeds were 10.621–10.780 and 13.135–13.562 m/s. Across those ten passes, the largest RMS optical fit residual was 0.345 m and the largest absolute offset from an expected axle-crossing time to the nearest short-range barrier return was 0.147 s. On the first unloaded crawl the RMS position residual reached 0.751 m. The third unloaded crawl included 1.076 s of optical data before inferred entry. All five unloaded medium-speed records began after inferred entry, by 0.125–0.699 s. The endpoint subtracts each waveform's first observed half-second in the common scoring interval. For a late record, this measures change relative to a partly loaded bridge. Predictions and observations are referenced separately.

## Why share the axle loads?

A spatial strain influence line measures the strain associated with a point load as it moves across the structure. In the static model, the response to a truck is the sum of three shifted copies of this line weighted by axle mass. For the empty truck, its front axle outweighs the rear pair by 1,380 kg. By the triangle inequality, the magnitude of its ideal full-line spatial Fourier multiplier is at least 1,380 kg at every frequency. This explains why the empty-truck response can help estimate a shared spatial curve. It supplies no uncertainty bound on finite, noisy passages.

The candidate adds two damped temporal responses to the shared spatial curve. Both oscillator frequencies (3.00348 and 3.845675 Hz) and damping ratios (2.06537% and 4.43589%) are medians from the authors' independent January 1–April 21 tracking file. Each gauge has its own spatial coefficients. A competing model applies the identical oscillators to separate curves for each load state. Other controls use the mean observed crawl and medium-speed station profiles, direct static axle weighting, speed-dependent terms, and 14 unconstrained time lags on the very same weighted axle positions. The candidate and all controls receive the complete optical traversal. This tests speed transfer with the optical trajectory available offline.

The source gives static axle loads. Road contact forces, lateral wheel placement, vehicle suspension response and instantaneous mode amplitudes are unknown. A finding at these speeds and gauges cannot isolate one of those mechanisms. The source's strain “accuracy” field is expressed as 80 mV/V/mm, a sensitivity. Interpreting it as a calibrated error tolerance in µm/m would require further information.

## Replay and evidence

Use Python 3.11 or later, NumPy, SciPy and h5py. The original numerical environment used NumPy 2.2.6, SciPy 1.15.3 and h5py 3.13.0. Download the full version-2 HDF5 from the authors' release. From this directory run

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python replay_bridge.py /path/to/box_girder_bridge_experiment_data_full.h5
```

The entry point checks all 9,732,963,908 source bytes against the published MD5, reconstructs all 41 optical clocks, then fits to the 31 development passages. All nine forecasts for all ten held cases are built before the entry point projects any held strain. It compares all 450 original curve scores and worst timestamps, and reports original/reconstructed numeric-array hashes separately from tolerance-based agreement. Compressed ZIP member order can change across Python processes. Each observed gauge has its own timestamp sequence.

The original forecast SHA256 was `999bf1c09e6dd0648144bb235f60e8dd87cab12d491923f638e950bb9048b315` before high-speed strain projection. An independent standard-library implementation on a third machine decoded the locked forecasts and original observations directly. It checked 947,340 scalar forecasts and 2,376 aggregate and worst-point quantities. The largest absolute discrepancy was 9.10×10⁻¹³. All three strict performance gates failed and the completeness gate passed. All original training selections, timing, and raw per-gauge results are retained below.

[Prospective specification](model_protocol.md) · [All 41 clocks](clock-qualification.json) · [Forecast member hashes and training selections](frozen-prediction-registry.json) · [All original observations' derived scores](held-original.json) · [Independent result](independent-receipt.json) · [Independent reader](independent_bridge.py)
