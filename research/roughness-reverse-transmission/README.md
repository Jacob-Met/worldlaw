# Predicting a reversed transmission spectrum across surface roughness levels

On two held roughness levels, the donor-consensus prediction had mean normalized RMSE **0.094921**. Copying the forward spectrum gave 0.108222, and the strongest calibrated reference on the same metric gave 0.102882. A simpler operator that keeps features at their measured frequencies did better than the candidate, at **0.086216**. The registered joint criterion failed. The candidate improved the prediction for the 68 µm surface but increased error for the sandblasted 1.36 µm surface relative to copying the forward spectrum.

## Data and prediction contract

The five Figure 4 files from Heo et al. each contain one averaged spectrum per direction (0°, 180°, 90°, 270°), in arbitrary units. The individual acquisitions are absent. We locked the split before reading numeric spectra. Three development levels (0.61, 9.2 and 140 µm) supply all four directions. At the two held levels (1.36 and 68 µm), every model receives the roughness label, the shared frequency grid, and the 0°, 90° and 270° spectra. Each predicts the entire 180° spectrum. The author methods describe 400–600 kHz and use 0.68 µm for the smooth surface. The released Figure 4 files span 200–800 kHz at 0.8 kHz spacing and label the smooth file 0.61 µm. All 751 bins enter the full-band result. The separate methods-band evaluation includes all 251 bins from 400 through 600 kHz. [Paper](https://doi.org/10.1098/rspa.2020.0657) · [Versioned source data](https://doi.org/10.5061/dryad.dv41ns1wc)

For each bracketing development surface, the registered operator learns how the reverse-minus-forward residual depends locally on forward signal and slope. It aligns measured forward and transverse spectral features monotonically between surfaces. The consensus rule projects the smooth-reference prediction at each frequency onto the interval between the two registered donor predictions. That interval is a model construction. Its endpoints have no coverage interpretation. Model selection used only development surfaces, including a reconstruction of the 9.2 µm surface from its two neighbors. All twelve arms below were fixed before held scoring.

## Results

Each level contributes equally. NRMSE is the root mean square error divided by the RMS of the measured reverse spectrum in the same band. Frequencies within a spectrum measure one apparatus response. They do not provide 751 independent runs.

| Forecast | 1.36 µm, full | 68 µm, full | Mean, full | Mean, 400–600 kHz |
|---|---:|---:|---:|---:|
| equal | 0.114488 | 0.101956 | 0.108222 | 0.166902 |
| smooth reference | 0.115388 | 0.100526 | 0.107957 | 0.165851 |
| transverse gain | 0.104265 | 0.118428 | 0.111346 | 0.167031 |
| transverse additive | 0.112669 | 0.112626 | 0.112648 | 0.438994 |
| transverse ratio | 0.114895 | 0.136165 | 0.125530 | 0.172995 |
| cross level affine | 0.108819 | 0.096945 | 0.102882 | 0.163311 |
| local transverse affine | 0.103729 | 0.105525 | 0.104627 | 0.235029 |
| donor difference | 0.120466 | 0.057971 | 0.089218 | 0.156943 |
| fixed frequency operator | 0.120347 | 0.052084 | 0.086216 | 0.160673 |
| registered operator | 0.128331 | 0.049812 | 0.089072 | 0.166274 |
| donor consensus | 0.117319 | 0.072524 | 0.094921 | 0.160468 |
| nonlinear kernel | 0.116292 | 0.077645 | 0.096968 | 0.167353 |

Two of four gates passed. Across 400–600 kHz, consensus beat the mean error of every calibrated reference (0.160468 versus 0.163311 for the closest reference). Neither held target duplicated a visible input. It failed to beat every comparator over the full band and failed to beat every calibrated reference individually on both held levels. The unrestricted registered operator reached **0.049812** on 68 µm, and local transverse affine calibration reached **0.103729** on 1.36 µm. All results use the single frozen prediction set.

| Surface | Zero-based row | Frequency | Measured forward / reverse | Candidate reverse | Signed error |
|---|---:|---:|---:|---:|---:|
| Sandblasted 1.36 µm | 561 | 648.8 kHz | 0.639497 / 0.446476 | 0.643257 | +0.196781 |
| 68 µm sandpaper | 736 | 788.8 kHz | 3.129364 / 3.494592 | 3.235586 | −0.259006 |

The smooth development file reproduces the 0° curve exactly in the 90° column and the 180° curve in the 270° column. It cannot supply an independent transverse calibration. In 0°, 180°, 90°, 270° order, the sandblasted file contains 57, 58, 62 and 65 nonpositive values. The corresponding 68 µm counts are 0, 1, 0 and 0. Signed values are retained throughout.

A per-frequency least-squares check also tests one common multiplicative gain for both measured directional pairs. Even an unrestricted scalar gain at every bin leaves residual-vector RMS of 0.017301 and 0.028193 arbitrary units. The largest unavoidable residual norms are 0.080627 at 428.8 kHz and 0.149180 at 711.2 kHz, respectively. This only excludes exact fits by that scalar calibration. The paper describes exchanging the excitation and receiver leads. These averaged scalar spectra lack matched complex port, transducer and loading calibration. The reciprocal two-port example in port_network.py exhibits unequal loaded voltage transfer with symmetric impedance. A claim about material nonreciprocity or the effect of viscosity would require additional measurements. The held comparison also changes surface treatment and shares the apparatus used for calibration.

## Replay

Run with Python, NumPy and SciPy in this directory.

```sh
python replay_transmission.py
python replay_transmission.py --archive /path/to/dryad-version-89473.zip
```

The replay checks the source member digests, reconstructs all 24 predictions before decoding either held target, verifies each stored prediction vector, and recounts the verdict. It prints portable numeric differences separately from original byte identity. The complete source ZIP necessarily contains all columns. Only the allowed columns enter prediction. The original source archive SHA-256 was 1dbe6a6e5c5a86e73862e32a9606bbf062d51e98f82df710d2b82ef7376f0caf. The original 24-vector archive was locked under d5c33a008fc7bb90d940c0315558ae3c7e674733acb190d10d5d367761ff764c. The NPZ carries the same 24 little-endian numeric payloads with their array headers and the registry binds each payload separately.

The split, source and vector lock were recorded at research posts 178705, 178762 and 178777, respectively. The initial score report has SHA-256 fe90a6b23d50c903ceef08b082edd5d6e65ab620dbe2d67199ef3905dcc19631. A separate worker used Python's CSV and binary readers for the complete recount, checking 18,024 scalar forecasts and 290 metric/worst-row values. The largest numerical difference was 1.11 × 10⁻¹⁶. The original scores, vector registry, independent receiver and receipt accompany this replay.
