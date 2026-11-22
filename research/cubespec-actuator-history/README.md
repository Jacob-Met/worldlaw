# Does actuator history improve CubeSpec mirror forecasts?

A correction based on the past voltage applied to three piezo actuators reduced development RMSE by **0.777%** relative to the corresponding amplitude-specific linear model. An equal-size finite-lag correction performed better at every amplitude. The organizer’s joint nonlinear feedback model was the strongest saved model at each amplitude. The stopped-input correction failed the prospectively fixed development gate, and the official test displacements remained unopened.

| Development RMSE in µm | 100 mV | 200 mV | 300 mV |
|---|---:|---:|---:|
| Authentic amplitude-matched 28-state linear model | 0.114010 | 0.218229 | 0.232358 |
| Authentic pooled linear model | 0.249297 | 0.176431 | 0.655693 |
| Authentic joint nonlinear feedback model | **0.089053** | **0.131419** | **0.167053** |
| Gain correction | 0.114722 | 0.217541 | 0.229891 |
| Instantaneous clipping | 0.114180 | 0.217637 | 0.229987 |
| Finite-lag correction | 0.113098 | 0.212751 | 0.229252 |
| Stopped-input correction | 0.113550 | 0.216786 | 0.229874 |

The recorded 300 mV run shows the largest individual error from the stopped-input model. On training realization 6, period 2, sensor 2 at zero-based sample 8175, it predicted **1.993304 µm** against a measured **0.269482 µm**. Applied voltages were 0.256772, 0.486126 and 0.339518 V. The largest absolute error for the joint nonlinear model was 0.929538 µm, on period 1 of the same sensor and realization. The executable replay retains every forecast and residual needed to inspect these samples.

## Experimental units and gate

At each voltage amplitude, the two original training triplets comprise six designed random-phase multisine realizations. We fitted the corrections using realizations 1–3 and scored them on 4–6. Each realization contains two 8192-sample steady-state periods recorded at 6400 Hz on three displacement sensors. The authentic pre-trained models used both training triplets. This comparison measures the added correction conditional on those fixed models. Independent transfer to the official evaluation blocks remains unmeasured.

The within-triplet inputs are deliberately dependent. For example, a pair of 100 mV realizations has same-channel correlations near 1, −0.5 and −0.5. Across 351 applied-input comparisons, after allowing channel permutations, sign changes and circular shifts, the largest train/test similarity was 0.03438. We treated the three excitation amplitudes as distinct designs and the two periods as repeated measurements. No IID uncertainty interval was calculated.

Each of nine methods supplied 18 scalar forecast streams per amplitude (three sensors × three scored realizations × two periods), for 486 stream RMSEs across the three amplitudes. Each RMSE uses samples 100–8191 in a period and retains the original sequence and channels. Means weight all sensors, realizations and periods equally, then give each amplitude equal weight. The full 5 × 3 saved-model table, including each off-amplitude linear prediction, is in [frozen_result.json](frozen_result.json).

The gate required a mean gain of at least 1% over the amplitude-specific linear baselines, at least 0.5% over the best gain, clipping or lag correction, improvements over linear in at least two amplitudes, and at most a 2% loss at any amplitude. The final condition required a lower overall RMSE than the per-amplitude minimum across all five saved models. The same joint nonlinear model supplied all three minima. Stopped-input RMSE averaged 0.186737 µm, compared with 0.185034 µm for finite lags. The joint nonlinear model averaged 0.129175 µm.

## Model and initialization

All four corrections start from the organizer’s 28-state linear model for the corresponding amplitude. Three gain coefficients and, for the extended corrections, nine additional coefficients are shared across all amplitudes and sensors. The instantaneous feature clips each actuator’s centered command at three thresholds. The lag features subtract its command at delays of 1, 2 and 4 samples. The history-dependent feature updates an internal memory to the projection of its previous value onto the interval from voltage minus the threshold to voltage plus the threshold; its output is voltage minus the updated memory. Each threshold is 0.25, 0.50 or 1.00 times that actuator’s 100 mV fit-triplet RMS about its mean. All features enter through the same linear transfer, with fixed diagonal-scaled ridge 1e−6.

Forecasts consume only the measured applied voltages and parameters fitted on training data. The organizer’s periodic convention concatenates both recorded periods, prepends the last 1,000 input samples, initializes the state to zero and removes the prefix from its output. This uses a known periodic input record. The five authentic models exactly reproduced explicit period concatenation and prefixing on source controls. Each of 162 training actuator/realization/threshold combinations traversed at least twice its threshold within the first 19 prefix samples, enough to erase every possible initial scalar stop memory. These data concern steady-state periodic operation on one instrument. They do not establish live-onset performance or a rate-independent physical mechanism.

## Reproduce

A Linux machine with Python 3.12, a C++17 compiler, network access to the public source, and uv can run the source-level comparison. From the repository root:

```sh
uv run --no-project --python 3.12 \
  --with 'freq-statespace @ git+https://github.com/merijnfloren/freq-statespace.git@ad43d976bee664494117febc3cf82c86790c7347' \
  --with 'jax[cpu]==0.12.1' \
  python research/cubespec-actuator-history/replay.py --output /tmp/worldlaw-cubespec
```

The replay verifies the organizer’s complete archive and five model digests, extracts only its six training arrays, fits the corrections, writes raw forecast streams and independently recomputes the reported scores and memory controls. It uses the existing float32 model weights. The first receiver explicitly rejected a float64 model skeleton before making a forecast. A separate worker independently verified all 486 stream RMSEs to within 2.67e−15 µm on the original retained forecast bytes.

Floren, Peri, De Maeyer, De Munter, Vandepitte and Noël introduced this CubeSpec dataset in ISMA-USD 2024. Floren released the baseline models in 2026. [Organizer’s dataset and models](https://github.com/merijnfloren/fsm-benchmark-data/tree/9389f33c0ee83d549c8c3a82fcb330ca706ab9e0) · [Benchmark definition](https://www.nonlinearbenchmark.org/benchmarks/fine-steering-mirror) · [Baseline model release](https://doi.org/10.5281/zenodo.19591136)
