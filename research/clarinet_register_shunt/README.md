# Predicting an open clarinet register hole from a closed-hole measurement

**One shared shunt position predicted the complex reflection spectra for three held tube lengths with a mean unit RMSE of 0.012294.** A separately fitted shunt for each hole diameter scored 0.013574. The comparison passed its prespecified criterion of winning at least six of nine complete acquisitions against every comparator. The six wins over the separate fits came from the 1 mm and 3 mm upper bodies. The separate fit won all three 2 mm comparisons. The error is dimensionless and measures both the real and imaginary components.

The measured inputs and targets are the authors’ small-signal impedance spectra from three manufactured upper bodies, six interchangeable straight lower tubes and one configuration without an added lower tube. Each held acquisition supplies its **measured closed-hole spectrum**. The task predicts the separate open-hole acquisition for that condition. It gives no forecast of a musician's register transition, nonlinear losses at playing amplitude, or upstream geometry on a new instrument.

## Apparatus, sources and held units

Szwarcberg, Colinot, Vergez and Jousserand published the measurements and MATLAB waveguide code in [Zenodo 16169580](https://doi.org/10.5281/zenodo.16169580). The complete 180,389,410-byte archive matched the publisher MD5 b0a4803fad80df3e512b9acbf0652640 and SHA-256 c6805fceb01a4a106d4ff1ca265d6fc5d99729b55abc5df4df0e6ef30cdfd7d2. The [article](https://doi.org/10.1016/j.ymssp.2026.114360) already disclosed its qualitative playing results and the seven mean first closed resonances in Table 1. Those numbers were background exposure. Neither open spectra nor player records informed assignment.

All 21 files have the explicit complex double variables Z_closed and Z_open and an identical 19,501-point frequency vector (100–4,000 Hz in 0.2 Hz steps). The author's plotting script labels the normalization Z/Zc and maps each file to its upper and lower body. The first metadata parser handled the numeric headers but failed on an opaque MATLAB string. The subsequent header-only reader established the complex variable names and dimensions before any field decoding. The actor received the archive as opaque bytes; the forecast reader decompressed and interpreted numeric payloads only for requested fields. It validated the complete file SHA before selecting each field.

We calibrated on lower bodies 1, 3, 5 and 7 (40.0, 115.6, 222.8 and 403.2 mm from junction to outlet). We evaluated lower bodies 2, 4 and 6 (75.6, 166.0 and 267.9 mm). Each upper body has a different hole diameter. The article describes a 65 mm measurement adaptor. Its de-embedding and inter-run phase calibration were not independently verified. Using both conjugacy signs and an added nominal cylindrical adaptor as source-only checks favored the released-model convention without an extra adaptor. This is a calibration result, not an independent verification of the physical reference plane.

## Structural prediction and controls

At one frequency, a local shunt changes junction admittance by addition. The upstream acoustic transfer transforms that addition into a fractional linear map of the input reflection. It has a repeated fixed point. If the upstream transfers agree, three aperture diameters can have three different shunt strengths and a common fixed point. The fitted point and strengths were allowed to vary independently with frequency. The model therefore does not imply a broadband causal parameter identification. The data support a same-apparatus interpolation with this constraint. They do not demonstrate a unique shunt location, a physical loss parameter or equivalent manufacturing across the upper bodies.

For each frequency, four measured calibration lengths supplied the paired open and closed spectra. The estimator formed the candidate fixed points from exact roots of pairwise constraints, included zero and infinity, fitted the complex strengths, and chose the point minimizing calibration reflection error. A separate-diameter estimator used the same algorithm on each diameter's own pairs. General two-port maps were fitted by normalized homogeneous least squares. The minimum third-to-first training singular-value ratio was 0.007038. All 1,579,581 serialized complex predictions were finite and no learned role triggered its fallback. Full definitions are in `protocol.json` and `SHUNT.md`.

The author comparison driver explicitly overrides the 12.7 mm chimney value in its geometry file with 10 mm. The two direct source-bound controls preserve that choice, the per-length two-frequency calibration of the viscothermal filter, 44.1 kHz sample rate and the pressure-release outlet. The relative control applies the known hole-change transfer to the measured closed spectrum; the direct control predicts open reflection from dimensions alone. The protocol also scored a separate training-selected sign/adaptor variant; it selected the relative control's default and therefore tied it everywhere.

| Frozen role | Mean unit RMSE | Shared model wins out of 9 |
|---|---:|---:|
| Common fixed point, three shunt strengths | 0.012294 | — |
| Separate fixed point for each diameter | 0.013574 | 6 |
| General two-port map for each diameter | 0.147394 | 9 |
| Length-interpolated measured hole change | 0.107666 | 9 |
| Closed spectrum carried forward | 0.129198 | 9 |
| Author direct open prediction | 0.223430 | 9 |
| Author shunt applied to measured closed spectrum | 0.025429 | 9 |
| Author convention selected on calibration | 0.025429 | 9 |
| Mean measured hole change per diameter | 0.118716 | 9 |

| Hole diameter | Shared model RMSE at 75.6 mm | At 166.0 mm | At 267.9 mm |
|---|---:|---:|---:|
| 1 mm | 0.007271 | 0.005103 | 0.008295 |
| 2 mm | 0.011205 | 0.007761 | 0.014934 |
| 3 mm | 0.020302 | 0.011420 | 0.024355 |

The unit is one complete upper/lower-body acquisition. The nine units share three upper and three held lower bodies. Adjacent frequency samples are correlated. The general two-port control had a maximum absolute error of 29.0472 at 1,795.8 Hz. Its least-squares fit was unrestricted and the protocol did not clip predicted reflections. Neither that extreme predicted magnitude nor the model's lower aggregate RMSE establishes superiority over an untested passivity-constrained general estimator.

## Worst observed sample

At 2,820.6 Hz on the 3 mm upper body and the 75.6 mm lower section, the original normalized impedances were 11.58990 − 0.81898i closed and 8.96173 + 5.18858i open. The measured open reflection was 0.842075 + 0.082256i. Both common and separate shunts predicted 0.710168 + 0.049544i, for an error of **0.135902**. The authored relative transfer missed by only **0.003984** there, and carrying forward the closed measurement missed by 0.092546. The general two-port and interpolated-change controls also beat the shared model on that row. `raw-score.json` preserves its nine-frequency neighborhood and all nine roles.

## Reproduction and custody

Before the first held Z_open was decoded, the producer sealed 81 complex64 forecast vectors in an 11,477,643-byte NumPy archive, SHA-256 5cae02c22786be38fad002e70c6749fb3b822bbf27738f04bfaa857bbc4a812b. The first receiver checked every vector hash, array shape, frequency-axis bytes and role assignment. A second, standard-library implementation independently parsed the original MATLAB channels and archive, recounted all 1,579,581 complex residuals, checked 81 unit metrics, all nine worst rows and all 81 neighborhood predictions. The maximum scalar difference was 3.56 × 10⁻¹⁵. A fresh Git checkout also reconstructed the complete archive and every per-vector hash from 24 binary shards under gpu-jobs commit 52d9d657e2bbfd1b812661a46ea8bfdcfee5b1b4.

Run `python3 replay.py .` for the self-contained scoring-record and shunt-algebra checks. Run `python3 cold_receive_archive.py` from this directory with access to the archive repository to authenticate all forecast bytes. The sources for recomputing the original forecasts and direct held comparison are `forecast.py`, `score.py` and `independent_recount.py`. The latter takes the official ZIP and the locked predictions.npz and requires only the Python standard library. Additional original capability refusals and optional runtime checks are described in `SUPPLEMENT.md`.
