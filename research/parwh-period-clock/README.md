# Sampling order in the parallel Wiener–Hammerstein benchmark

**The released GRU reproduced the author’s saved predictions. On chronological multisine measurements, repeating each available input twice reduced its average RMSE from 137.166 to 3.597 mV.** The equal-work previous/current control averaged 9.067 mV. Repeat current beat both physical controls at each of the five input levels. The author’s dedicated 2015 physical model reported lower errors at all five levels.

## Measurement results

Each number is RMSE in mV. The literal column uses the published 50-row cut. The three physical columns use the chronological 50-row cut.

| Input RMS (V) | Literal GRU | Direct physical | Repeat current | Previous/current |
|---:|---:|---:|---:|---:|
| 0.100 | 1.7506 | 28.9747 | 1.3908 | 2.3817 |
| 0.325 | 3.8170 | 88.6550 | 1.9105 | 5.7082 |
| 0.550 | 5.6103 | 143.0503 | 2.8663 | 9.3189 |
| 0.775 | 7.2347 | 190.6347 | 4.3206 | 12.4078 |
| 1.000 | 10.4696 | 234.5151 | 7.4962 | 15.5176 |
| **Mean** | **5.7764** | **137.1660** | **3.5969** | **9.0668** |

Each entry below uses the same 32,693 physical events across all four columns. The published literal predictions can be placed at these events after acquisition.

| Input RMS (V) | Literal GRU | Direct physical | Repeat current | Previous/current |
|---:|---:|---:|---:|---:|
| 0.100 | 1.6988 | 28.9615 | 1.3911 | 2.3814 |
| 0.325 | 3.5455 | 88.6021 | 1.9110 | 5.7015 |
| 0.550 | 5.4371 | 143.0899 | 2.8650 | 9.3177 |
| 0.775 | 7.1956 | 190.6759 | 4.3216 | 12.4100 |
| 1.000 | 10.2979 | 234.4237 | 7.4978 | 15.5129 |

The largest repeat-current error occurred at the highest input level, first period, row 6,776. The current input was −0.552977 V, the measured output was −0.252845 V and the prediction was −0.193887 V, a +58.958 mV residual. At 1 V RMS its matched-event error was 7.5061 mV over the first period and 7.4895 mV over the second. All 35 role/amplitude worst rows and both period slices are available in the six hash-verified receipt files.

The checkpoint reproduced all five released scaled trajectories to within 5.56 × 10⁻¹⁷ and their RMSEs to within 3.08 × 10⁻⁷ mV. The independent receiver recomputed 140 error statistics with maximum disagreement 2.85 × 10⁻¹⁴ mV and recovered all 35 raw worst-row coordinates. Each direct rollout uses 32,761 recurrent updates after constructing its lag vectors. The two microstep arms use 65,529 each. No real-time latency measurement was performed.

## Data and released model

The 4TU archive `9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d` contains a 78,125 Hz two-branch electronic measurement. The MAT axes are sample, period, random-phase realization and RMS amplitude. Each realization contains two 16,384-sample periods. The estimation set has 20 phase realizations and the multisine validation set has one realization per amplitude at 0.100, 0.325, 0.550, 0.775 and 1.000 V RMS. The increasing-envelope experiment is outside this course. The historical single-branch Wiener–Hammerstein dataset is a different apparatus.

The organizer Python loader at `MaartenSchoukens/nonlinear_benchmarks@f9fb3883086870a27b31917ccde1f78c95d53cb2`, file `nonlinear_benchmarks/benchmarks.py`, uses C-order reshape and retains `sampling_time=1/fs`. For source array `X`, the literal loader emits `X[t//2,t%2]`. The two-period chronological concatenation emits `X[t%16384,t//16384]`. All 100 organizer estimation CSV trajectories agree with the latter ordering within their printed precision. At 1 V RMS, phase 4, CSV input row 3318 is 3.1868 V, chronological MAT is 3.186777 V, and literal MAT is −3.224479 V. The two nominally repeated physical periods differ by about 0.234 mV RMS at the input. Duplicating the current actuator sample is therefore an approximation. Even if the recorded period inputs were identical, averaging two recurrent outputs would still differ from retaining each output separately. The chronological second period also begins from a different recurrent history.

The 2026 benchmark paper's best released generic method at all five amplitudes is its GRU. The published RMSEs are 1.75, 3.82, 5.61, 7.23 and 10.5 mV. The original 2015 dedicated parallel block model reported approximately 0.30, 0.50, 0.38, 0.57 and 1.10 mV on its physical multisine protocol. That model is a historical comparison. This experiment reexecutes the 2026 checkpoint and makes no claim to beat the 2015 dedicated model.

## Information available to each predictor

The 2026 release `MDCHAMP/nonlinear_baselines@d9c4972f6bd59cfdde23a014bc57579e2af957aa` slices every 32,768-row estimation trajectory after row 16,383 under its literal loader. It therefore fits the first half of each physical period at all 20 phase settings. Applying that cut to chronological storage would instead isolate the first complete repeated period. Neither operation holds out new random phases. The original min–max scalers are fitted to the literal training halves. We recover the twelve original eight-unit float32 checkpoint tensors without opening saved predictions or scores, call the released `RNN`/`multi_predict_NN`/`NARXify` functions, and use their zero initial state and eight input lags, including the current input. No measured output is supplied to the GRU. The recurrent state spans the period boundary. The manual NumPy recurrence and genuine Flax rollout must differ by at most 0.00005 in scaled units on two fixed estimation cases. The Flax 0.10.4/JAX 0.4.35 pairing failed before emitting any predictions because JAX lacked `api_util.debug_info`. The Flax 0.10.2/JAX 0.4.35 pairing produced the qualified runs.

| Forecast | Sequence and measurement contract |
|---|---|
| Literal GRU | Released loader sequence, trained scalers and pretrained weights. An inverse permutation locates these predictions on physical events for the offline matched-event comparison. It uses inputs from the other physical period. |
| Direct physical GRU | Process the chronological input stream once with the same released parameters. |
| Repeat current | For each physical sample run the current input through two consecutive microsteps and average the two outputs. Both steps use already available input. |
| Previous/current control | For each physical sample run the previous input and then current input, averaging their outputs. The first previous input equals the first current input. This matches the repeat-current computation count. |
| Causal FIR32 | Per amplitude, train a 32-tap filter including the current sample and an intercept. The literal and physical variants fit phases 0–15 separately. |
| Pointwise affine | Fit one ordinary least-squares line to the equally weighted samples in estimation phases 0–15 and apply it in physical order. For a fixed set of events its squared error is invariant to row permutation. |

The FIR fits are independently evaluated on whole estimation phases 16–19. An earlier CSV/clock audit already inspected those estimation trajectories. The released GRU's original training included those phase identities. This comparison characterizes the FIR controls and makes no held-phase claim for the pretrained GRU.

## Fixed evaluation

Every native clock retains exactly 32,718 rows after discarding its first 50 rows. The literal mask removes samples 0–24 of each period, while the physical mask removes samples 0–49 of the first period. Their intersection contains 32,693 physical events. Comparing the clocks on these same events avoids changes in metric due to prefix placement. Three undefined initial literal forecasts map to the physical suffix at rows 16,384 through 16,386. The common-event gate needs none of these and the physical primary score keeps every physical suffix row.

The candidate qualifies as a physical adapter if its chronological RMSE beats both direct and previous/current at four or more common amplitudes and its unweighted mean across five amplitudes beats both means. The checkpoint reproduction additionally requires ≤0.00005 maximum scaled deviation from the saved trajectory for every amplitude and ≤0.005 mV deviation from each stored score. The primary physical predictions are evaluated against all multisine suffix rows. Exact physical equality of the two repeated periods, causal-identification uniqueness and generalization to a different apparatus were not assumptions in this gate.

Two separately implemented scores use the same immutable forecasts. The first gathers chronologically permuted arrays. The second indexes the source MAT tensor by its individual sample/period axes and accumulates residual squares with `math.fsum`. It recounts every native-suffix score, common-event score, two common-event period scores and raw worst-row coordinates. No score selects an adapter setting.

## Sources

- [Schoukens et al., 2015, electronic benchmark and dedicated method](https://doi.org/10.1016/j.automatica.2014.10.105)
- [4TU measurement archive](https://doi.org/10.4121/12950081)
- [Organizer's pinned Python loader](https://github.com/MaartenSchoukens/nonlinear_benchmarks/blob/f9fb3883086870a27b31917ccde1f78c95d53cb2/nonlinear_benchmarks/benchmarks.py)
- [Benchmark paper, Tables 7 and 9](https://www.cambridge.org/core/journals/data-centric-engineering/article/benchmarking-for-nonlinear-system-identification-submission-platform-and-baseline-results/BD06B2C87096B4A700EE173A298A0FEC)
- [Released model source and checkpoint](https://github.com/MDCHAMP/nonlinear_baselines/tree/d9c4972f6bd59cfdde23a014bc57579e2af957aa)

## Reproduction

Inspect the frozen comparison using Python’s standard library.

```sh
python verify_receipts.py
```

To reproduce the numeric experiment, run from this directory with Python 3.12, NumPy 1.26.4, SciPy 1.16.3, JAX CPU 0.4.35 and Flax 0.10.2. `prepare.py` verifies the two upstream SHA-256 digests before inference. The output directory must be fresh because all measurement receipts use exclusive creation. The original prediction archive is identified by its numerical array hashes in the receipt. The fresh lock also records elapsed compute time, so its JSON digest is run-specific.

```sh
work=$(mktemp -d)
python prepare.py "$work"
python extract_weights.py "$work"
python training_clock.py "$work"
python parwh_clock.py "$work" qualify
python parwh_clock.py "$work" controls
python parwh_clock.py "$work" predict
lock=$(sha256sum "$work/prediction-lock.json" | cut -d" " -f1)
pred=$(sha256sum "$work/official-input-only-predictions.npz" | cut -d" " -f1)
python score_locked.py "$work" score "$lock" "$pred"
score=$(sha256sum "$work/official-locked-scores.json" | cut -d" " -f1)
python independent_recount.py "$work" recount "$score" "$pred"
```

The prospective decisions were recorded in task posts 177020, 177037 and 177093. All 35 predictions were sealed at post 177106 before measured multisine outputs or the historical released prediction arrays were opened. The six individually hashed JSON receipts include the original scores, per-array locks, out-of-fit FIR controls, independent recount and estimation chronology checks.
