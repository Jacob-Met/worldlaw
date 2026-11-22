# Do measured pickup phases predict a separately played mixed-pickup note?

Across 48 held switched-pickup recordings, the shared circuit predicted the sustained 25-harmonic spectral shape with **4.119 dB** mean per-take RMSE. A simpler fitted real gain plus smooth frequency envelope scored **4.057 dB**. The circuit won on two of six string means and on one of two switch types. The registered joint gate failed.

The measured phase still mattered. The straightforward coherent sum scored 4.954 dB, against 7.967 dB for the unsigned sum and 15.497 dB for reversed polarity. The circuit with phase discarded scored 7.643 dB. These are forecasts across separately played takes on one electric guitar; they do not identify component impedances.

| Forecast method | Sustained-note RMSE (dB) | Early-event RMSE (dB) |
|---|---:|---:|
| Ideal point geometry | 13.754 | 14.033 |
| Nominal finite apertures | 13.388 | 13.673 |
| Fitted finite apertures and envelope | 9.609 | 9.960 |
| Coherent complex sum | 4.954 | 5.746 |
| Unsigned magnitude sum | 7.967 | 8.432 |
| Incoherent power sum | 8.019 | 8.466 |
| Opposite polarity | 15.497 | 15.786 |
| Fitted real gain and envelope | 4.057 | 4.858 |
| Phase-blind circuit | 7.643 | 8.168 |
| Measured magnitudes with geometric signs | 5.311 | 5.908 |
| Coherent sum and smooth envelope | 4.169 | 4.932 |
| Neighboring mixed-position interpolation | 6.458 | 6.862 |
| Empirically corrected coherent sum | 4.376 | 5.187 |
| Shared circuit | 4.119 | 4.992 |

Each of the 48 held takes had an eligible sustained frame. On the neck–middle switch, the circuit scored 4.413 dB and fitted real gain scored 4.097 dB. On middle–bridge the order reversed, 3.825 versus 4.018 dB. On the early measurement the circuit scored 4.992 dB and fitted real gain scored 4.858 dB. The stronger overall comparator in both measurements was fixed by the observed all-take ranking among the 13 registered controls. Complete string, switch and position means are in `scores.json`.

## Two different worst cases

The largest whole-take circuit error was the B string, 50 mm pluck, neck–middle switch. Its sustained-note RMSE was 8.425 dB, compared with 7.471 dB for fitted real gain and 6.345 dB for an unweighted coherent sum.

The largest single sustained-mode miss was elsewhere: the 16th partial of the D string, 50 mm, neck–middle. The measured mixed partial was −32.148 dB and the circuit forecast was −53.839 dB. At this same partial, fitted real gain gave −55.006 dB, coherent sum −58.758 dB, point geometry −23.194 dB and fitted finite geometry −32.727 dB. The isolated channels had a relative phase of −154.97° near 2,376 Hz; fitted circuit weighting changed it to −157.26°. A separate-take pluck envelope and the switch transfer can both change modal depth. The early measurement's largest miss was the 13th partial of the high E string at 130 mm, neck–middle: measured −36.474 dB against a forecast at the −60 dB floor. None of the results trims these cases.

## What a pickup switch can identify

The instrument was a modified Squier Stratocaster. The authors recorded its three isolated pickups simultaneously. They recorded the actual neck–middle and middle–bridge switch positions on separate occasions, using one moderately loud open-string note at each marked pluck position. A source recording therefore supplies relative phase among the pickups for one excitation. The target recording has its own excitation, time origin and overall level.

The hardware description identifies three added 1/8-inch output jacks, one for each original pickup. This establishes that the three sensors could be acquired together. It does not give the per-coil transfer functions or the change in electrical loading between the isolated and switched recording configurations. [Instrument drawing and experimental description](https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2015/MohamadDixonHarte-DAFx2015-PickupPositionModelling.pdf)

The six measured string lengths were 649–652 mm. The neck, middle and slanted bridge pickups lay 157–160, 99–102 and 38–49 mm from their corresponding bridge saddles. A point-sampled ideal string predicts a signed modal contribution proportional to sin(kπq/L) sin(kπd/L)/k for pluck position q and pickup distance d. Equation 12 of Mohamad, Dixon and Harte adds a finite spatial aperture for each pickup and the pluck. The comparison uses the published forward equations, with both nominal and source-fitted widths. The pick was reported as 0.88 mm thick; its effective contact width and the pickup sensing aperture were not measured for these notes. The fixed nominal comparison uses our 15 mm effective aperture assumption. The paper illustrates 20 and 40 mm apertures in Figure 3 and uses its simpler point equation during inverse fitting. The fitted finite-aperture comparison permits 0.1–60 mm for each pickup from calibration takes. The historical inverse task estimated pluck/pickup positions from an already recorded note, a different information contract. [Paper, equations 3–12 and Table I](https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2017/MohamadDixonHarte-JASA2017.pdf)

For a hypothetical direct parallel connection, let the two coil admittances be Y₁ and Y₂, the common measurement load YL, and isolated outputs V₁ and V₂ measured with that load. Kirchhoff's current law gives a mixed voltage of [(Y₁+YL)V₁+(Y₂+YL)V₂]/(Y₁+Y₂+YL) under identical excitation. Our candidate represents each coil as a series R–L branch with parallel capacitance and represents the load by a parallel conductance and capacitance. It estimates one set of positive, regularized coefficients across every marked position, both switch configurations and all six strings, with middle-coil resistance and gain setting arbitrary scales. One separate set is fit per spectral measurement. Synthetic complex evaluation against independently computed current balance agreed within 1.1×10⁻¹⁴ on 500 cells.

Coil impedance, actual loaded gain and pluck force were not independently measured. For any nonzero predicted mixed partial and measured magnitude y, a separate-take excitation envelope y/|prediction| reproduces that magnitude. Thus predictive performance can test transfer of a constrained circuit model, but cannot yield unique component values or attribute a discrepancy to the circuit. Matched phase-blind and opposite-polarity controls test the importance of signed contributions. The strong real-gain plus smooth-envelope comparator can account for frequency response without claiming to identify electrical components.

## Data boundary

The public author tree at d9d55a600210e40e6531d4b74891771c0a9a3718 contains 240 distinct Git LFS identities totaling 708,679,536 bytes. The three simultaneous single files have identical byte lengths at all 48 string–position combinations. Their Broadcast Wave time-reference fields were all zero. The author-reported simultaneous acquisition, equal array lengths and a common analysis frame support within-take phase comparison; the empty timing fields supply no independent synchronization measurement. The source receiver verifies every WAV's whole SHA-256 and declared byte length, then reads mono 44.1 kHz, 24-bit PCM. The first header parser stopped at its 512-byte ceiling on the 602-byte BWF metadata chunk. The range reader subsequently verified chunk offsets 12, 36, 646 and 728, stopping before the first sample at offset 736. Both original receipts are retained. [Author dataset and file naming](https://github.com/ZulfadhliM/electric-guitar-samples/tree/d9d55a600210e40e6531d4b74891771c0a9a3718)

Training allowed the 144 single-pickup recordings and 48 actual mixed takes at 30, 70, 110 and 150 mm. The other 48 mixed takes, at 50, 90, 130 and 170 mm, stayed closed through forecasting. Every held case supplies new single-pickup covariates from the same marked condition. Only 170 mm extrapolates past the largest calibrated position. Six strings on one guitar do not establish transfer to a new instrument. The result concerns normalized mixed-spectral shape on separately played takes, without a sample-wise phase or voltage target.

## The weak source event

The initial extractor selected the first block whose RMS reached 4% of the peak block RMS and analyzed a 12-period frame starting two periods later. It used the same 25-partial count as the author's open-string analysis. The author's published inverse decoder instead used a 3-period Hamming frame and its own onset and spectral-peak refinement procedure. The original early-frame endpoint is retained as a sensitivity check.

In the 30 mm B-string, middle–bridge training take, the early trigger occurred 30,400 samples into the file. The early 12-period frame had RMS about 0.00035 of digital full scale. Its measured sixth partial was −43.13 dB relative to the strongest partial, while the coherent sum predicted −5.42 dB. By sample 37,546, RMS reached 0.02188 and one-period correlation reached 0.987. The fixed-frequency sixth partial there measured −4.95 dB. No cause is known for the earlier, weaker event.

Before accessing any held mixed takes, the primary measurement was fixed to the highest-energy 12-period frame with lag-period correlation at least 0.80 and RMS at least half the maximum frame RMS. A 64-sample grid and a common joint frame are used for each simultaneous single-pickup triple. Each separate mixed-take measurement independently selects its own frame. A missing stable frame refuses the complete comparison. The window selector sees only the recorded take and never compares a frame to a forecast. At the corrected development measurement the same sixth partial was −4.758 dB against the coherent forecast of −5.378 dB. The study retains the original weak-event scores alongside the primary measurement.

All reported spectra have 25 partials, normalized to their own strongest partial with a −60 dB floor. The error unit is one physical take's equal-partial RMSE in dB. Each switch group, string and marked position receives its own summary. The prospective gate requires the shared-circuit model to beat every one of 13 controls overall, beat the strongest overall control for both switches, and win on at least four of six string means against that control. The early measurement cannot change the gate. No inferential sample count is formed by treating a take's 25 harmonics as 25 independent experimental repetitions.

## Original forecasts and independent recount

The physical split, two waveform measurements and final 14-method gate were separately registered. On the 48 source takes from the odd-indexed marked positions, leaving out each complete source position in turn gave the shared circuit 4.720 dB and the real-gain comparator 4.664 dB. All 28 complete float64 forecast arrays (two measurements × 14 methods) were fixed in a 241,433-byte archive with SHA-256 `7e55ad13f0bd702fdf210bc847879adcc5441694398a743c889c597c9369cfec`. The target receiver checked the complete archive and every array before opening a held mixed WAV.

A standard-library implementation then recounted all 33,600 per-partial residuals, 1,344 per-take scores, both sets of group means, every individual worst and the gate. The native owner and original SHA identities are in `custody.json`. The complete 605,907-byte derived evidence archive had SHA-256 `70fdae61d6f522032358ae5f9b0f459ab864a3499e26d28dad97a15fe6da9483`. Its 56 members are represented here by typed numerical arrays and original measured records. A separate optional six-fragment read of the already locked forecast returned two completed members and four unresolved capacity responses. Their original IDs are retained. A single subsequent paged read of the complete derived evidence archive succeeded and its whole-file hash verified. The source audio stays with its authors.

The separate positive-real-gain bound searches both gain endpoints and all nonnegative stationary roots of each partial-to-reference amplitude ratio. For the B-string source failure, no frequency-independent positive real gain on the second observed channel could place the sixth partial below −18.701 dB in the early frame, versus its measured −43.130 dB. On the sustained frame the corresponding bound was −18.672 dB and the measured partial was −4.758 dB. Passing a lower envelope is only a one-sided consistency check.

Run `python3 replay.py` from this directory to authenticate the published inputs, reconstruct the native prediction and complete derived archives byte for byte, and independently recount the original scores. The original acquisition and model entry points are `training_intake.py`, `stable_training_intake.py` and `electric_course.py`. A fresh acquisition uses the pinned public Git LFS data via the authors' GitHub release, Python with NumPy/SciPy, and approximately 709 MB for all 240 source WAV payloads in one pass. The two training measurements originally verified 584,974,272 bytes each. The final receiver verified 123,705,264 bytes across the 48 held WAVs and computed both measurements in one pass. Four targeted source-position raw diagnostics additionally verified 49,139,728 bytes. These are successful payload totals; transport retries and protocol overhead are excluded.

The two source-feature originals used 6.10 and 8.08 total user-plus-system CPU seconds, the whole-position source qualification 1.52, and the final fit/forecast 0.83. The held physical receiver used 3.84 CPU seconds and 171,302,912 bytes maximum resident memory for its largest waited process. Queueing and independent archive transfer are outside those CPU figures.
