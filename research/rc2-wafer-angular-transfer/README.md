# Angular transfer on a corrected RC2 wafer scan

A first-order thin-film model fitted jointly at 60° and 70° predicted the 50° response with a normalized Jones error of 0.000407 RMS. A simpler version using 60° alone reached 0.000359 and also won on the worst spectral region. The two-angle model therefore failed its registered comparison. Both sheet models outperformed the authors’ full Fresnel fit on this specimen. The table covers all 591 retained wavelengths from 210 to 800 nm.

| Frozen forecast | All-band RMS | Worst region RMS |
|---|---:|---:|
| Joint thin sheet, 60° and 70° | 0.000407220 | 0.000518907 |
| Single-angle thin sheet, 60° | 0.000359228 | 0.000385018 |
| Authors’ Fresnel fit, thickness and two Cauchy coefficients | 0.001817655 | 0.002705552 |
| Authors’ Fresnel model, fitted thickness | 0.001897809 | 0.002845496 |
| Nominal 2 nm film | 0.001900299 | 0.002893779 |
| Linearly extrapolated additive residual | 0.003769757 | 0.006562664 |
| Shared additive residual | 0.010220679 | 0.016607136 |
| Bare silicon | 0.014901875 | 0.022268389 |

The target is the complex ellipsometric ratio of one measurement at one held angle. Each error is the absolute determinant between unit-normalized Jones vectors. The three fixed regions are 210–<400, 400–<600, and 600–800 nm. The proposed model won 12 of 14 registered contrasts. Its worst individual error was 0.001060581 at 394 nm. The observed Ψ/Δ there were 36.144917°/176.818680°, and the prediction was 36.139776°/176.691554°. The complex ratios were −0.7292884−0.0405350i and −0.7290593−0.0421451i respectively. The 70° donor contributed 63.1% of the local two-angle coefficient weight. These observations leave open the roles of neglected film terms, substrate dispersion, calibration, and aperture averaging.

## Specimen and optical model

The FAIRmat vendor file and its paired electronic lab notes identify a single J.A. Woollam RC2 scan of a commercially purchased nominal 2 nm SiO₂ layer on silicon. The source export reports window correction. Its E, depolarization, and reflectance records each share 1,088 wavelength settings at the three angles. Only E rows in the authors’ valid substrate wavelength range entered the forecasts and scores. The separately published SpectraRay Mueller file and the historical pyElli NeXus example were excluded. The latter carries a different same-day timestamp. [FAIRmat acquisition and notes](https://github.com/FAIRmat-NFDI/pynxtools-ellips/tree/dc620d7d47c97c3c0c6140ffb46060103eab35ac/examples) · [Vendor conversion method](https://fairmat-nfdi.github.io/pynxtools-ellips/tutorial/convert_your_first_dataset.html)

The stock pyElli Solver2x2 fit uses a Cauchy dielectric, semi-infinite Aspnes silicon, air, and each nominal angle as a point setting. The ELN describes an objective, angular spread of 0.2 rad, no instrument calibration and backside_roughness=false. These fields do not supply an angular weighting function, wafer thickness or rear-boundary termination. The reported result concerns the instrument's corrected output under the model assumptions. The authors’ unweighted Ψ/Δ least-squares method was run with its original parameter initialization and bounds on the two permitted angles. The source example itself fits three angles. No values from its published fit entered this course. [Author fitting program](https://github.com/PyEllips/pyElli/blob/cda9ffd6ecc112707b1a9cab120d16440260b4e2/examples/gallery/plot_03_custom_fitting.py)

For an optically thin film the first-order change in the complex ratio is an angular coefficient times one spectral factor proportional to d(εf−1)(εf−εs)/εf. The joint estimator fits this complex factor independently at each wavelength by least squares across the two calibration angles. Its effective flexibility differs from the three-parameter Cauchy model. The angle weighting, substrate and factorization are fixed in advance. The absolute angular coefficient in sheet_limit.py remains finite at the bare Brewster zero. It agrees with independent finite differences in 144 synthetic checks to 2.02×10⁻¹² per nm.

The fixed-index and free-index Fresnel fits returned thicknesses 2.024913 and 1.778042 nm with calibration raw-angle RMS 0.253963° and 0.246654° respectively. The free fit’s scaled local Jacobian singular values were 208.81, 19.50 and 0.8192. The protocol specifies these parameter units. These are fitted values and local sensitivities. This one angular transfer does not determine true thickness or dispersion independently.

## Reproduction

Run in a disposable Python 3.12 environment. The registered forecast used pyElli 0.23.1, lmfit 1.3.4, NumPy 2.3.5, SciPy 1.17.0 and pandas 2.2.3. The SHA-256 of the official pyElli wheel is 9cb23948451a386db4f70b8a4b5546dd33e1c971b3a22e7eec87351f615ccef6.

```sh
python -m pip install 'pyElli==0.23.1' 'lmfit==1.3.4' 'numpy==2.3.5' 'scipy==1.17.0' 'pandas==2.2.3' 'h5py==3.16.0'
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python replay.py
```

An optional `--vendor-file PATH` accepts the original 482,497-byte export. The program authenticates the source, reads only calibration response rows during prediction, closes the prediction file, and starts the held-angle reader in a separate process. It checks every published whole/region metric and worst-band location, then independently recounts 4,728 point errors. BLAS or optimizer variation is reported separately from agreement with the original serialized forecast. The original local and native locks were identical, 259,159 bytes with SHA-256 4855ad5d1bbd812333b631ad51d4610124ffba6cf18536f928042c0bf82820e2. The independent standard-library recount on a third worker matched at 3.47×10⁻¹⁸. See protocol.md, native-result.json and receipts.json for the complete gates and run identities.
