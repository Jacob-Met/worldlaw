# Can the Cargill glass standards identify a common optical bandpass?

The archived measurements support a calibration-transfer benchmark. They leave the optical conditions needed to test a glass-derived shared bandpass unresolved. This source audit stopped before interpreting any measured corn spectrum, glass spectrum or reference assay. The outcome is a source-qualification refusal; there is no measured prediction score.

## What the source establishes

The original Cargill release contains 80 samples measured on the Foss m5, mp5 and mp6 instruments. Each spectrum has 700 channels from 1,100 to 2,498 nm in 2 nm steps. A separate table contains four properties per sample. The distributor identifies the mp5 as a model 5000 and the mp6 as a model 6500 at one site, and the m5 as a model 5000 at a second site. Its study distinguishes diffuse-reflectance corn from a separate transmission-mode gasoline dataset. The acquisition does not independently cross instrument and site for the m5. [Distributor archive](https://eigenvector.com/resources/data-sets/) · [Distributor methods](https://www.eigenvector.com/Docs/FACSS08_Calibration_Trans_CEMrev1.pdf)

The serialized arrays contain three glass spectra on m5 and four each on mp5 and mp6. None has a specimen label, glass identifier, object title, recorded serial number or description in the corresponding metadata fields. The spectral objects' only stored history entry assigns the wavelength axis. The top-level text identifies NBS glass standards and the corn cohort. It gives no glass mounting, transmission versus reflection mode, white-reference geometry, gain normalization or conversion to a common linear optical quantity. The label fields identify moisture, oil, protein and starch, without units in the archive. The author example evaluates paired corn rows by their shared index. Any future evaluation using that convention must group the same index across every instrument and target. There are no independent specimen IDs in these fields to audit sample custody.

The instruments' shared nominal wavelength axis is exact. An axis entry is a coordinate, not an observation of wavelength calibration or instrumental line shape. The maintained author notebook labels both corn and glass plots as absorbance and labels the scale as arbitrary units. A logarithmic ordinate requires its acquisition reference and conversion before an optical convolution can be interpreted physically.

## Glass pairings and the actual published comparator

Nikzad-Langerodi and Sobieczky describe three glass standards in the primary/secondary calibration example. The paper refers to the first three standards. The maintained author notebook keeps all three m5 rows and deletes the **first** mp5 and mp6 rows, retaining their last three numeric rows. The code establishes a reproducible benchmark convention. The source does not supply serials that would independently establish which physical pieces correspond. The prose may refer to the first three *matched* standards. It does not settle this ambiguity. [GCT-PLS paper](https://doi.org/10.1002/cem.3319) · [Pinned author notebook](https://github.com/B-Analytics/diPLSlib/blob/f11e224dd0e4dc3975555be54af6b7a9ae7b8819/notebooks/demo_gctPLS.ipynb)

The original `diPLSlib.models.GCTPLS` was executed at commit `f11e224dd0e4dc3975555be54af6b7a9ae7b8819` with the author example's three latent variables, regularization 10 and source rescaling. The native check used synthetic arrays, including three matched standards and an unmatched-count refusal. It establishes that the authentic comparator runs, without measuring performance on this cohort.

## Why the optical qualification matters

For shift-invariant linear measurements of a common latent spectrum, applying filter B to instrument A and filter A to instrument B produces the same convolution. Unequal illumination, different optical collection geometry, nonlinear preprocessing, or instrument-specific wavelength warps break that argument. Even in the ideal setting, another common blur can erase predictive information while preserving agreement. A match on standards alone cannot identify the absolute line-spread functions.

A finite example is included in conditional_witness.py. Two positive, symmetric, strictly unimodal unit-sum five-tap kernels have identical moments through degree three. They agree at all 2,088 interior channels of three positive polynomial reference spectra on a 700-channel grid. They give 0.401 and 0.359 on a distinct narrow feature. This is a counterexample to universal identification from three smooth standards. It does not characterize the unopened NBS spectra. A separate arithmetic example shows why averaging absorbances differs from averaging linear reflectances.

## Reproduce the qualification

The source projector accepts only the distributor's original ZIP, SHA-256 `8a2d1a03648b6ad334caaafa5d8377bf945ba1477a5082c4963d705d07cca795`. It verifies the embedded MAT identity, reads comparison metadata and the six wavelength axes, and skips numeric signal and property payloads. Whole archive and MAT bytes are read for authentication. The signal blocks are never interpreted as numeric arrays. [Original archive](https://eigenvector.com/wp-content/uploads/2019/06/corn.mat_.zip)

```sh
python inspect_source.py /path/to/corn.mat_.zip --output audit.json
python conditional_witness.py
```

For the synthetic author check, install the four scientific dependency versions in course-receipt.json, check out the pinned diPLSlib repository, and run `OPENBLAS_NUM_THREADS=1 python author_control.py /path/to/diPLSlib`. The full native check recorded the prediction digest and rejected unequal standard counts.

The resulting metadata is recorded in source-receipt.json. Two preserved intake refusals involved an empty MATLAB cell matrix and integer storage for a wavelength axis declared as a MATLAB double. Correcting these typed-reader assumptions preserved the original archive and the decision boundary. The source qualification applies to this physical identification question; the established empirical assay-prediction benchmark remains available.
