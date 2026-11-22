# Thermal phase alignment on the Open Guided Waves composite plate

A nine-reference, frequency-dependent phase correction missed both primary development thresholds on the first intact cooling flank. In the 20–60 kHz band its mean residual RMSE was 0.000768001, compared with 0.000767278 for ordinary Cartesian quadratic smoothing. Above 5 kHz the phase correction yielded 0.00136847 against 0.00131023 for an unaligned nine-reference average. Units are the stored catch amplitudes. The 40 interleaved validation captures, second intact cycle and four artificial-damage campaigns remain unscored.

## Source and split

Moll et al. released measurements of a single CFRP plate with 12 bonded transducers, two surface temperature probes on its left side and a climate-chamber thermometer. The acquisition multiplexes 66 directed paths at each carrier. Here the source is the 40 kHz five-cycle excitation sampled at 10 MHz. Each catch trace has 13,108 samples. The experimental damage surrogate was a removable surface-mounted disc. Each placement had one acquisition campaign. The study itself reports successful 40 kHz damage examples. That published outcome and the examples on T4→T10, T4→T9 and T1→T7 were known before the split. [2019 data paper](https://doi.org/10.1038/s41597-019-0208-1) · [Five-archive collection](https://doi.org/10.6084/m9.figshare.c.4488089.v1) · [2022 same-bench author comparison, §2.2](https://pmc.ncbi.nlm.nih.gov/articles/PMC8749564/)

The immutable intact Figshare member is file 15129185, 53,609,050,314 bytes. Its ZIP64 central directory identifies 322 time-ordered 40 kHz HDF5 members. The two recorded chamber cycles reached 20.0→60.0→20.0°C and 20.1→59.9→20.0°C. At their respective peaks the two surface readings were 60.968/60.866°C and 59.836/59.975°C. Matching chamber temperature can leave a measurable plate-temperature difference. All 322 intact header records and three environmental anchors in each damage campaign were checked before received-signal access.

The bank was the first 81 ascending captures. Development comprised the 40 odd zero-based ordinals from 81 through 159 on the descending flank. Seven paths cover the six 440 mm vertical columns, T1→T7 through T6→T12, and the published oblique T4→T9 route. The 847 opened waveforms comprise 567 bank and 280 target rows. The 280 target rows represent only 40 acquisitions in one thermal cycle. No independent-specimen, independent-trial or detection-performance inference follows. Even ordinals 82–160, the second intact cycle and damage signals were excluded from every waveform read.

## What the largest baseline errors contained

The 2022 authors selected one of 81 references by minimum whole-target RMSE, then stretched time, shifted time and scaled amplitude in that order using the observed target. We reproduced this documented procedure. The linked classifier toolbox supplied no identified preprocessing implementation; our finite grids, refinement, zero-padded interpolation and scale limits are in the baseline freeze. These scores quantify target-fitted diagnostic residuals.

The largest original full-band error was T2→T8 at ordinal 159, 20.5°C. The selected heating row 6 had 23.0°C chamber temperature. Its two surface readings exceeded the target by 2.403 and 2.574°C. OBS yielded 0.00594356 RMSE and the ordered stretch/shift/scale fit gave 0.00569740, or 15.55% of target RMS. At sample 4612 the measured amplitude was −0.185541 and the fitted amplitude −0.171794. A constant offset accounted for 85.50% of squared residual energy; 90.09% lay below 5 kHz. The largest relative residual was 17.34% on T6→T12 at ordinal 117. Its DC share was 76.06%, its below-5-kHz share 80.10%, and the reference exceeded the target probes by 1.976/2.102°C. The median DC share over all 280 cases was 28.80%. These measurements locate additive mismatch. The data do not identify whether it originated in the electronics, structure or another part of the acquisition.

## Controls and physical comparison

The thermal candidate takes the nine heating references nearest each bank center in mean measured plate-surface temperature. Within each Fourier coefficient it estimates a weighted phase slope, rotates the complex measurements to the center temperature, and applies the local quadratic intercept weights. Cartesian quadratic smoothing uses the same nine references and weights. A simple neighbor mean, observed bank and in-band reproduction of the author procedure provide additional controls. The four continuous-bank variants optimize the same adjacent-reference mixing coefficient, then use identical target-informed stretch, translation and amplitude fits. A synthetic rotating coefficient, exact fractional segment mixture and additive offset exercise these operators.

Each band-limited arm receives the exact observed target component below 5 kHz. This deliberately gives a strong nuisance control and makes its low-band residual zero by construction. It supplies no independent evidence about damage or prediction. Full-wave, ≥5 kHz and 20–60 kHz errors are preserved on the same samples. The table averages RMSE equally over all 40 acquisitions and seven paths.

| Frozen arm | Full-wave RMSE | ≥5 kHz RMSE | 20–60 kHz RMSE |
|---|---:|---:|---:|
| Ordered author procedure | 0.00246968 | 0.00158799 | 0.000871534 |
| Same fit plus target mean residual | 0.00188732 | 0.00158799 | 0.000871534 |
| Same fit plus target low-band residual | 0.00158799 | 0.00158799 | 0.000871534 |
| Author procedure fitted above 5 kHz | 0.00155662 | 0.00155662 | 0.000811163 |
| Continuous observed bank | 0.00144085 | 0.00144085 | 0.000787198 |
| Nine-reference average | 0.00131023 | 0.00131023 | 0.000779629 |
| Cartesian quadratic | 0.00134910 | 0.00134910 | 0.000767278 |
| Temperature phase correction | 0.00136847 | 0.00136847 | 0.000768001 |

The phase candidate divided by the best complete control arm was 1.000942 for mean carrier RMSE (gate ≤0.95), 1.044450 for mean ≥5 kHz RMSE (gate ≤1.00), and 1.021286 for worst carrier RMSE (gate ≤1.05). All seven path-mean ratios passed their ≤1.05 guard, spanning 0.999301–1.010148. Both candidate and average-bank worst carrier cases were T6→T12 at ordinal 135, 0.00160703 versus 0.00157353. The largest relative deterioration against Cartesian quadratic was 6.60% at ordinal 81 on T4→T9. The two failed mean gates ended this representation before transfer or damage scoring.

## Replay

The default command reads only the registered waveforms from the public archive using HTTP ranges. It verifies their zero-based channel IDs, surface and chamber records, clocks, sample schema and SHA-256 against the manifest. The optional cache is an NPZ of these same 847 raw rows. Both modes compare the input bytes, refit all eight arms, compare all 6,720 scores and recompute the decision. The numerical replay was qualified with Python 3.12, NumPy 2.2.6, SciPy 1.15.3 and h5py.

```sh
OPENBLAS_NUM_THREADS=1 uv run --no-project --python 3.12 --with numpy==2.2.6 --with scipy==1.15.3 --with h5py -- python research/ogw-temperature-phase/replay.py
```

Full-archive MD5 is the archive author's metadata. Ranged replay verifies named selected rows without implying it recomputed a 53.6 GB whole-file digest. A separate native receiver cold-loaded the original source and registered stage bytes, reconstructed all 280 ordered fits, and independently selected named HDF5 rows for the two extremes, selected references and fixed controls. A second receiver rescored all 2,240 saved arm waveforms with Parseval's identity. Full-band and passband acceptance, raw cases, and reference choices are preserved in the manifest. The original MATLAB-sidecar schema refusal and the later successful header reader occurred before received-signal access.
