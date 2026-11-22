# Predicting the waves from Aalborg’s freely heaving sphere

The spherical-cap volume driver failed its registered comparison at the highest release. Across four repetitions and three surface gauges, a causal filter of measured body motion gave **1.351111 mm RMS error with the cap driver and 1.156625 mm with constant waterplane area**. The 16.815% increase occurred on all four repetitions. The cap improved the farthest gauge, but lost at the middle and nearest gauges. A useful separate result emerged from the blind numerical submissions. A constant-area filter trained on the two smaller releases reduced gauge error for all four numerical models when driven by each model’s own predicted heave.

This is a prospectively locked **archival replay**. A public description of Figure 19 exposed approximate high-release gauge peaks and arrival ordering before the forecasts were produced. The actual high-release time samples, per-repetition errors and entrants’ rankings remained sealed through protocol registration. The producer then parsed only the held experimental time and body-motion columns, plus the four submitted numerical predictions. It locked every forecast before a separate receiver parsed the experimental gauge columns. The released high-drop body motion is additional information at each time. The numerical submissions and their postprocessed versions use only release-time simulation information and lower-release training data.

## Motion-conditioned result

All 3,025 nonnegative 2 ms timestamps were scored from release through 6.048 s. Each cell is a measured elevation in metres before conversion to millimetres for this table. WG3 is nearest the sphere.

| Driver or control | All gauges RMS, mm | WG1, mm | WG2, mm | WG3, mm |
|---|---:|---:|---:|---:|
| Spherical cap | 1.351111 | 0.665654 | 1.049653 | 1.982836 |
| Constant area | **1.156625** | 0.804394 | **0.932200** | **1.580283** |
| Development convex combination | 1.407704 | 0.749824 | 1.190349 | 1.991413 |
| Cap driven by the next repetition’s motion | 1.354690 | 0.667298 | 1.053128 | 1.987759 |

The cap beat the opposite-cubic, free-pair, free-asymmetric and development convex fits on all three gauges and all four repetitions. Against constant area, it won one gauge and zero repetitions. Against the cyclic donor it won all three gauges but only two repetitions, below the registered three-repetition threshold. Up to 4.56 s, cap and constant-area RMS were 1.460965 and 1.210564 mm. After 4.56 s, they were 0.937235 and 0.972789 mm. These fixed time slices describe the finite basin and combine direct and reflected contributions wherever each occurs.

The cap’s worst error was at **2.112 s on WG3, repetition 4**. The instrument measured +9.828200 mm. The cap predicted +2.678412 mm, constant area +7.437197 mm, the free asymmetric predictor +8.271157 mm, and opposite cubic +11.718072 mm. Thus even the relatively weak pooled free asymmetric fit came closer at this particular cell. The frozen score records include all 32 forecasts at the same instant and nine surrounding three-gauge measurements.

## Initial-release-only comparisons

For each entrant, its submitted three-gauge result and the filtered versions of its own simulated body motion are compared on precisely its original support. Linear interpolation of a precomputed simulation maps it to those experimental timestamps. The empirical filters learned from separate lower releases, an additional calibration resource compared with the original blind submissions. All numbers below are pooled RMS errors in mm.

| Submitted simulation | End time scored, s | Experimental grid rows per run | Submitted wave heights | Constant-area map of its heave | Cap map of its heave |
|---|---:|---:|---:|---:|---:|
| RANS2 | 6.000 | 3,001 | 1.292707 | **1.237443** | 1.408743 |
| RANS3 | 6.000 | 3,001 | 1.540773 | **1.211253** | 1.390736 |
| RANS4 | 6.048 | 3,025 | 5.501040 | **1.151521** | 1.357748 |
| RANS5 | 6.048 | 3,025 | 5.535835 | **1.155832** | 1.344288 |

RANS2 also had the lowest submitted RMS on the common 0–6.000 s interval. RANS3 had the same 3,001-row support. Even if all 24 extra rows had the worst absolute error seen anywhere in each run, the first 3,001 rows would still have RMS error of at least 5.311 mm for RANS4 and 5.339 mm for RANS5. The constant-area filter improved the RANS2 result by 0.055264 mm on that overlap. For RANS4, the largest submitted error occurred on WG3 at 1.730 s, where it predicted −1.829016 mm against measured −18.756600 mm. RANS5’s largest miss was on the same gauge and repetition 2 ms earlier. The published archive supplies gauge names and units. Distinguishing mesh, wave extraction and simulation-setting effects would require controlled comparisons among those components. The best of the five release-height-only templates was the scaled 0.3D mean at 1.757 mm. The zero waveform gave 4.601 mm. The seven remaining entrants submitted only heave; their files contain displacement and time.

## Geometric constraint

With upward body displacement z, radius R and s clipped to [−R,R], the still-plane displaced volume relative to equilibrium is −πR²s+πs³/3. Differencing the volume gives a causal flux driver, with a zero initial increment for release from rest. A model with independent kernels on the clipped linear and cubic increments fully contains the tied cap construction. The experiment tests whether the restricted coefficient transfers across amplitudes. Multiple radiation operators can produce the observed surface traces. The 0.1D→0.3D development RMS was 0.691383 mm for cap and 0.691448 mm for constant area. That 0.000065 mm difference favored the cap at only one development gauge. The pooled ordering reversed on 0.5D. The free-pair fit extrapolated unstably from the smallest release and was retained alongside the stronger regularized and blended controls.

The four high releases are repetitions in the same tank at the same height. Evidence across bodies, facilities or a continuous range of amplitudes would require additional experiments. The positive postprocessing result applies to these archived predictions and the extra calibration data from the two lower releases.

## Reproduction and original custody

Run `python3 replay_scientific_receipt.py` from this directory for the standard-library replay of the reported gate. Add `--write-original-score score-original.json` to reassemble the unchanged 29,410-byte native score report (SHA256 `4c2dcb5c106411832fcb6ef52379a6c3f2009fec4fae79f1fb75b7530dc1fe71`) from the distributed score rows. The native originals used Python and NumPy with one BLAS thread. The distributed scripts provide the source model fit, forecast lock, raw scoring and independently implemented scalar recount. The original forecast archive has 36 members (32 prediction roles and four solver clocks), 3,618,133 bytes, SHA256 `9ab6306f9f9b0665873c73e3e8d2866d9c50140a935e54520312e427591b3f7f`. The 5,389-byte registry binds every member and all four conditional heave fingerprints. The producer’s worker and a separate full-byte receiver both hold the exact archive. The original taskboard attachment returned an archive-capacity refusal. The registered bytes remain in the two verified copies.

Rebuilding a fresh lock uses `lock_predictions.py PARAMS EMPTY_DIRECTORY`, with PARAMS taken from `forecast-registry.json`. A restored original archive and registry can be verified directly with `score_locked.py DIRECTORY ARCHIVE_SHA REGISTRY_SHA`. The receiver refuses an incomplete inventory or altered member before parsing the measured held gauge columns. Use a fresh output location when rescoring. Fresh numerical fits may differ across BLAS versions. The registered original forecast bytes and their receipt are authoritative.

The source intake initially used eight rounded 0.76 s periods and stopped because 6.080 s exceeded the released 6.048 s record. A separate eight-clock-only receiver verified the support before its pre-score successor. The complete scientific scoring retained every nonnegative native row; that initial failed intake is preserved in the development record.

The institutional source is Kramer and colleagues’ OES heave-decay archive. See the [paper](https://doi.org/10.3390/en14020269) and [source ZIP](https://www.oceanenergysystems.org/documents/55575-datafile.zip/). The apparatus, exposure ledger, preregistration, every role’s score, development outcomes and native resource receipts are included in this directory.
