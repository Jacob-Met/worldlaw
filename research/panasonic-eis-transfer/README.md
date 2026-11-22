# Predicting Panasonic 18650PF pulse voltage from impedance spectra

Fourteen measured impedance spectra each admit a nonnegative relaxation model within **1 mΩ** of every measured real and imaginary component. Their narrow zero-initial-state voltage envelopes contain **22 of the 42** subsequently scored pulse observations. Allowing uncertain initial polarization contains all 42, with a median interval width of **197.78 mV**. Both preregistered engineering tests failed.

## Reproduce the comparison

Use Python 3.11, NumPy 1.26.4 and SciPy 1.13.1 to reproduce the original optimization environment. Both commands use SciPy to decode the entire MATLAB structure, including its Voltage array. The comparison checks immutable source hashes and indexes one pre-pulse voltage and the three registered response voltages per event. The spectral replay selects only current and time from the decoded structure. Poststep voltage does not enter its predictions. This trusted projection applies to the native pre-outcome calculation as well. Setting one BLAS thread makes the modest dense optimization problems run faster.

```sh
python research/panasonic-eis-transfer/compare_response.py --details
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python research/panasonic-eis-transfer/replay_spectra.py
```

Both commands fetch the public files they require from the pinned licensed mirror. Both accept `--source-dir DIRECTORY` for an existing extracted copy. The directory must contain `Panasonic 18650PF Data/`. The first command prints the pooled scores and individual gates. The details flag adds the 42 raw paired observations and summaries by horizon and spectrum. The second command rebuilds the eight point values and four intervals per row without using response voltage. The manifest preserves the original pre-outcome predictions separately from the released raw measurements.

## Source and operating point

Phillip Kollmeyer measured one nominal 2.9 Ah Panasonic 18650PF cell in a temperature chamber at the University of Wisconsin–Madison. The 25 °C March 11 HPPC discharge record contains 102,800 rows and 67 discharge pulses. Fourteen lowest-current pulses correspond to fourteen April 27–29 EIS records by nominal ampere-hours discharged. The test uses all fourteen, with the recorded samples nearest to 1, 5 and 9 seconds after onset. The three points per pulse and all pulses from one cell share experimental history.

Each spectrum contains 54 actual frequencies from 0.00142 to 6000 Hz, including the inductive high-frequency end. The tester requests a nominal 10 mV excitation and records AC current amplitudes from 0.05357 to 0.48803 A. The transfer pulses draw about 1.449 A. A common nominal chamber temperature and a closely matched Ah counter do not establish identical internal state, temperature, linearity or aging 47 days apart. The split pulse record omits intervening constant-current discharges. Only about 9.9 seconds of continuously sampled zero current immediately precede each selected pulse. A gap between files supplies no rest-duration evidence.

This course uses Panasonic measurements only. Akpinar's BATTLM paper uses a separate Stanford group of six second-life M50T cells for its EIS-to-pulse comparison. Its Panasonic dynamic-drive fits use additional HPPC and drive-cycle calibration. Our EIS-only 80-point method is a matched-information implementation inspired by that spectral approach. The released paper supplies algorithm descriptions and numerical summaries. Its Panasonic dynamic-drive calibration is a different information contract. [Kollmeyer dataset, version 1, CC BY 4.0](https://doi.org/10.17632/wykht8y7tg.1) · [Pinned raw-data redistribution](https://huggingface.co/datasets/bsebench-org/panasonic-kollmeyer-2018-raw/tree/0f3c96601aa8dcc25f697ef32f3ac918d24433b9) · [BATTLM, 2026](https://doi.org/10.3390/batteries12090373)

## Spectral model and feasible responses

The assumed impedance is the sum of an instantaneous resistor, a series inductor and a nonnegative distribution of first-order relaxation resistances. This is a restricted passive circuit class. Each of its spectra obeys

```text
Z(ω) = R₀ + iωL + ∫ [1 / (1 + iωτ)] dμ(τ),   R₀, L, μ ≥ 0.
```

The fixed compatibility tolerance is ±1 mΩ on each of 108 coordinates per spectrum. This is an engineering allowance. Independent instrument-error estimates and a sampling model for coverage probabilities are unavailable. The 256-point finite spectra supply constructive witnesses for all 14 cases, with maximum component residual between 0.2985 and 0.6432 mΩ. Replaying 168 finite extremal witnesses on a second worker reproduced their predicted drops within 1.14 × 10⁻¹³ mV and all their spectral residuals within 1 mΩ.

The outer calculation encloses the spectral and step-response kernels on 640 intervals covering zero to infinite relaxation time, with variable measure dν = dμ / (1 + τ) when τ is expressed numerically in seconds. Each box bounds a nonnegative interval mass. Dual prices, corrected for numerical residuals, bound the attainable drop. The program uses floating-point guard margins. The reported endpoints are outer bounds, and the finite-spectrum inner witnesses establish achievable differences. A finite unscaled resistance placed at infinite τ contributes zero at finite times and nonzero frequencies. A sequence of resistances growing proportionally to τ can retain finite ν and approach an integrating response. The outer closure admits this limiting case.

Time-domain prediction uses the measured positive discharge current, zero-order-held between samples, with branch states propagated exponentially. The recorded voltage is compared to the regular plateau response immediately before a sampling boundary. The series inductor remains in the frequency fit. Physical slew and sampled impulse response are unknown. The interval uses the minimum and maximum measured drive in the plateau to bound the positive RC convolution. The comparison assumes constant open-circuit voltage during each short pulse. It carries no independent bound on OCV drift or on transfer from the EIS amplitude.

The primary envelope assumes zero initial relaxation state. A second envelope allows a prior current bounded by ±25 A throughout the past, propagated by the same stable model. The assumed current cap uses the tester's channel rating. Prior polarization then decays over the contiguous observed rest. The known pre-pulse voltage removes one voltage offset while leaving individual branch states uncertain. The earlier sensitivity calculation also remains in the manifest. Its tolerance is the greater of 1 mΩ and 1.25 times the largest component residual of the finite-band DRT80 fit, giving 6.64–46.24 mΩ. All fourteen largest residuals occur at the lowest observed frequency.

## Frozen external results

The primary and bounded-prehistory gates each required all 42 observations inside and every interval at most 10 mV wide. These criteria were registered before reading any pulse response. Seven point models were fixed in advance. The primary point comparator was selected by mean relative complex impedance error on the 11 held frequencies per spectrum at row indices 2 modulo 5. The extended relative-error 256-atom model won at 0.3063%, ahead of the 80-atom model at 1.3293% and four-RC at 2.9017%.

| Envelope | Inside | Width ≤10 mV | Median width (mV) | Maximum width (mV) |
|---|---:|---:|---:|---:|
| Fixed 1 mΩ, zero initial state | 22/42 | 37/42 | 6.82 | 19.35 |
| Fixed 1 mΩ, bounded prehistory | 42/42 | 0/42 | 197.78 | 1066.74 |
| Residual-sized sensitivity, zero state | 42/42 | 0/42 | 32.76 | 167.21 |
| Residual-sized sensitivity, bounded prehistory | 42/42 | 0/42 | 362.79 | 2382.38 |

| Point forecast | MAE (mV) | RMSE (mV) | Worst absolute error (mV) |
|---|---:|---:|---:|
| One RC | 10.59 | 15.79 | 71.14 |
| Two RC | 7.38 | 14.91 | 68.30 |
| Three RC | 7.22 | 14.39 | 63.19 |
| Four RC | 6.71 | 12.35 | 46.03 |
| DRT80 relative least squares | 7.07 | 13.06 | 51.98 |
| DRT256 minimax | 7.49 | 12.84 | 47.16 |
| DRT256 relative least squares, preselected | 7.41 | 12.78 | 47.61 |
| Strict zero-state interval midpoint | 6.77 | 12.85 | 51.14 |

The midpoint improved mean absolute error against the preselected comparator and increased its worst error. The registered joint accuracy test failed. Four RC was strongest on the subsequently opened pulse outcomes. It retains its original comparator status.

At target row 99,108 the recorded voltage fell from 3.23691 to 3.00259 V over 9.006 seconds, a 234.32 mV drop. The strict zero-state interval of 173.50–192.85 mV missed by 41.47 mV. The same construction allowing the bounded prehistory gave −351.34 to 715.40 mV. At the opposite end of nominal discharge, the first pulse's one-second drop was 58.72 mV against a zero-state interval of 79.00–86.88 mV. A single offset or error direction would obscure these opposite failures. The course does not identify which of aging, state mismatch, nonlinearity, OCV drift or initial polarization caused either observation.

At the worst event, the original acquisition clock gives 95,105.960996 s at the beginning of the observed rest (row 98,917), 95,115.857995 s at the baseline (row 99,017), 95,115.966001 s at pulse onset (row 99,018), and 95,124.971997 s at the readout. The 9.896999-second rest ends at the baseline sample. Across the fourteen rest segments all logged current values are exactly 0 A and the largest adjacent sampling gap is 0.110008 seconds. Between-sample behavior remains a zero-order-hold assumption.
