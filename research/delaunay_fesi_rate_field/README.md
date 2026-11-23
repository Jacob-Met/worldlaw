# Can magnetic-field rate corrections be isolated at a fixed reversal history?

**The four PWM series failed the registered input-matching test before any PWM magnetic field H was decoded.** None of the 24 lower-to-highest-frequency comparisons kept the measured induction path within 0.00625 T of its counterpart. That prevents this experiment from attributing a field change to excitation rate alone. The separate sinusoidal experiment was retired after a positional-column error exposed derived summaries of all intended held fields. Neither experiment produced a prospective field-error score.

## Physical apparatus and release

Delaunay, Solimene, de la Barrière and Ragusa supplied two ring cores built from four nonoriented FeSi laminations each. Both have 70 mm outside and 55 mm inside diameters. Their verified cover shows a 100 mΩ primary shunt and secondary winding voltage. The READMEs specify 0.1002 Ω. Primary current determines the inferred magnetizing field and secondary induced voltage gives the flux-density rate. These released traces already incorporate acquisition and processing. No independent phase or delay calibration, per-run temperature or full pre-cycle magnetic state was established. Each frequency file is a separate acquired setting on the named ring. Amplitudes and carrier choices on the same ring do not supply independent material specimens.

| Ring | Measured sheet thickness | Resistivity | Classical field coefficient d²/(12ρ) |
|---|---:|---:|---:|
| 20 | 0.1969 mm | 59.07 × 10⁻⁸ Ω m | 0.00546944 A s/(m T) |
| 35 | 0.3471 mm | 48.93 × 10⁻⁸ Ω m | 0.02051884 A s/(m T) |

The author record is [Zenodo 17579041](https://doi.org/10.5281/zenodo.17579041), dated 11 November 2025. All three publisher MD5 digests matched. The whole-file SHA-256 digests are 3698b1fc0010ff6b340cee37466261f5931001a998a855c9be356393161cebf8 (431,608-byte cover), 6c96d621204caa4779c03995b228e470aba894cb89df668cb6748ba52b119caa (327,980,839-byte Ring20 ZIP), and befa32cddc535360bd2d1e59a16d5eeca69d83e3d1a59e3c57db0a5b8b777120 (267,450,312-byte Ring35 ZIP). The [authors’ paper](https://doi.org/10.1016/j.physb.2026.419296) had already disclosed that biased minor-loop behavior depends on the preceding major-loop excitation. No BIAS, QDC or loss-table values were used.

## The sinusoidal column error

The cover and both ring READMEs enumerate time, field H, induction B and induction rate, in that order. Every one of the 120 registered SIN files has the literal header `t_s,B_T,H_Aperm,dBdt_Tpers`. Source 2ad5888 collected the header but selected numeric column positions from the documentation. It treated actual H as B and computed extrema, an endpoint difference and a derivative-integration residual. All 99 source and 21 assigned held files were affected. A limited preview surfaced the contradiction before field predictions. The complete derived summaries remain in `retired-sine-original.txt`; its 46,904 bytes constitute a record of the exposure, not induction measurements or blind outcomes. No full H waveforms were emitted and no original target was replaced. The preceding 814-byte Python 3.8 dependency refusal occurred before the application ran.

## Pulse-width-modulated induction paths

The subsequent registration 119cbc20 selected every fixed-ratio PWM series with at least three rates at the common 1.25 T fundamental and 0.95 modulation index. Original archive-name enumeration identified four series. This design avoids file pairs whose nominal fundamental and carrier change independently. The author setup regulates the fundamental amplitude while applying an open-loop smoothed PWM voltage. Equal fundamental settings and equal carrier ratio therefore do not guarantee identical induction paths.

The producer validated the exact header before decoding the three named input columns. Each acquired cycle was interpolated to 32,768 phases and rotated by the phase of its own B fundamental. No H or target-derived alignment was used. The comparison required both a pointwise path match and a cyclic bijection of prominent reversals with bounded differences in timing and level. See `pwm_registration.json` for all frozen thresholds. The 0.5% maximum-path threshold is this study’s assumption. The paper gives that figure for the fundamental amplitude only.

| Ring | Carrier ratio | Target frequency | Comparisons | Passing | Range of largest path differences |
|---|---:|---:|---:|---:|---:|
| 20 | 301 | 300 Hz | 5 | 0 | 18.206–100.903 mT |
| 20 | 51 | 300 Hz | 5 | 0 | 59.246–125.955 mT |
| 35 | 301 | 400 Hz | 7 | 0 | 7.435–72.742 mT |
| 35 | 51 | 400 Hz | 7 | 0 | 11.206–118.006 mT |

The largest discrepancy occurred on Ring20 at carrier ratio 51 for 20 versus 300 Hz. At aligned grid index 17,133 the two inductions were −1.104265876 T and −1.230220631 T, a gap of 0.125954755 T. Both traces contained 102 prominent turns in the same cyclic order. The smallest maximum difference, 0.007435270 T on Ring35 at ratio 301 for 200 versus 400 Hz, exceeded the 0.00625 T threshold as well. All 24 pairs had equal source/target turn counts. Only 23 yielded a cyclic bijection under the specified nearest-turn rule. Carrier timing, apparatus response and magnetic history remain potential contributors. These measurements establish an input mismatch for the chosen threshold; they do not determine the cause or rule out another physical model driven by differing histories.

An independent standard-library implementation read only t and B from the original PWM archives, computed its fundamental with scalar trigonometric sums and interpolated by binary search. It agreed on every maximum and grid index across 24 comparisons, with largest value disagreement 6.67 × 10⁻¹⁶ T. This independently confirms the decisive full-path gate. It did not recompute the ancillary turning-point correspondence.

## Rate envelope and replay

`RATE_ENVELOPE.md` derives a conditional bound on signed field increments after subtracting the classical eddy-current term. For a matched reversal state, positive mixtures of softened square-root excess fields place the next increment between the square-root and linear secants. This calculation uses the physical rate at the matched state. It does not establish that either material obeys the model. The failed path match prevented application to PWM H.

Run `python3 replay.py .` to verify the archived outputs, all assignments, gate decisions, row-level extrema and limiting-law numerical checks. With the original author ZIPs, `independent_path.py DIRECTORY` repeats the raw induction checks from this directory. `native-receipts.json` identifies all six original jobs, including the first dependency refusal. No prediction, correction to the original archive, or magnetic loss number is implied by the replay.
