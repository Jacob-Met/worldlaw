# Bias and coupling in two electrothermal MEMS resonators

Doubling the last source bias and quadrupling the measured joint voltage amplitude gave a mean absolute error of **0.345169 V** across 21 held command settings. Doubling the amplitude gave **0.035520 V**. The quadratic rule lost to the source-fitted pooled gain at every setting and exceeded the zero-prediction error of 0.279473 V. The held result concerns one apparatus, one resonator pair and one positive-coupling regime.

## Measured comparison

The 3630/3790 Hz pair has 1,053 no-sound captures spanning 13 bias labels and 81 coupling commands. We selected the complete 21-product intersection of source bias commands 100 and 200 mV and held command 400 mV. For integer s from 0 through 20, the three digital coupling commands were 4s/16, 2s/16 and s/16. The authors' plotting script divides the nominal bias and coupling commands by two separately. Each capture contributed all 125,000 samples in its two signal columns. The MATLAB script uses columns and its frequency labels conflict with the general repository description. The outcome uses the Euclidean norm of the two separately centered column RMS amplitudes in volts, which is insensitive to a permutation of the columns. The scalar outcome differs from the authors' mean peak-envelope separation and the 100 mV finite-amplitude onset criterion.

| Forecast | Mean absolute error (V) | RMS error (V) | Largest absolute error (V) |
| --- | ---: | ---: | ---: |
| Quadratic, 4 times the 200 mV source | .345169 | .505839 | .963641 |
| Unchanged 200 mV source | .124290 | .200523 | .360583 |
| Linear, 2 times the 200 mV source | .035520 | .052709 | .161346 |
| Zero | .279473 | .432388 | .720360 |
| Power estimated separately at each matched product | .328959 | 1.406081 | 6.440870 |
| Pooled multiplicative fit | .042807 | .064025 | .186929 |
| Local affine extrapolation in bias | .042990 | .118774 | .517048 |
| Pooled affine fit | .043145 | .061159 | .178053 |

At the largest quadratic error, s=13, the digital coupling was 0.8125 and its plotted value was 0.40625. The 100 and 200 mV source captures had joint RMS 0.022723 and 0.401148 V. The 400 mV measurement was 0.640950 V. The quadratic model forecast 1.604592 V, the linear model 0.802296 V, the pooled gain 0.827879 V and the per-product power extrapolation 7.081820 V. The four held quarter RMS values ranged from 0.640687 to 0.641175 V. At the largest centered two-channel excursion, record index 17,608, the raw columns read −0.259186 and −0.885254 V. The seven-row excerpt centered there is in the target receipt. At zero coupling the three full RMS values were 0.019923, 0.019912 and 0.019123 V, which documents a measured background in this endpoint. These observations do not determine the origin of the background, the recording history, the actual hardware feedback or the mechanism of the abrupt change between adjacent commands. Each command contributes one record. Treating the individual voltage samples as replicate experiments would overstate the evidence.

## What the model predicts

Appendix A.1–A.2 gives a two-sensor state model with linear mechanics, thermal relaxation, high-pass sensing and quadratic electrical heating. In vector form the actuator voltages obey u=b+Ky. For any positive a, set b'=a b, K'=K/a, x'=a²x and external force F'=a²F. The readout then obeys y'=a²y, u'=a u and every component of the transformed vector field equals a² times its original value. This maps full trajectories at the same time when the initial conditions transform. It preserves periods and maps orbit families. The map alone cannot determine which orbit a finite acquisition selects. A fixed zero self-feedback diagonal satisfies the gain transformation. Fixed nonzero diagonal entries generally violate it even when the bias times cross-coupling products agree.

The authors' Figure 3 MATLAB solver explicitly zeroes the network matrix and applies equal positive model biases. The regime-1 measurement archive contains just the analysis script and 1,053 MATs. Three independently checked source MAT headers contain only a 125000×2 double data array. The plotted measurement names and source documentation do not establish per-run signed hardware gains or stable channel gain across biases. The primary physical-intervention qualification therefore remains unmet. The separately registered command-based prediction used all traces regardless of their waveform, clipping, transients or possible attractor changes. Figure 3's published qualitative onset trend was known before the study.

## Reproduction

The prospective contract is in `command_replication.json` at 1d01768cccdd03d8a1872ba75898c04d042d7624. All 168 predictions and 42 source summaries were locked at 81a9c1bc79172918a37ff473cb3fb2295fe27827, before the first target read. The exact forecast file SHA-256 is 4810ce0398021c38d4fdbf4cec01d944567e830222d48d0c189f54b9b743739f. The remaining ten bias levels were excluded prospectively and their signal values stayed unopened.

Run `python3 replay.py` for the offline check against the committed summaries. The independent raw receiver in `independent_checkpointed.py` re-read and SHA-verified all 63 original MATs from the published ZIP using normal HTTPS certificate verification. It used an independent binary MAT parser, a second-moment calculation and direct scalar fits. Across 15,750,000 voltage samples the 2,835 reported statistics matched within 2.23e−16 V and all 168 forecasts and residuals within 3.34e−16 V. Both receivers found the same failed gate. A distinct earlier recount ended on a TLS hostname mismatch before emitting a completion receipt. The first catalog original had already ended on a DNS failure. `native_receipts.json` preserves all eight original command and output identities. The 63 requested members occupy 80,382,437 compressed bytes inside the 1,414,300,985-byte archive. The complete member digests and checked central directory bind the selected inputs. The entire archive was not independently rehashed.

[Author measurement and code release](https://doi.org/10.5281/zenodo.18336535) · [Primary article, Appendices A–D](https://doi.org/10.1088/2634-4386/ae45c9)
