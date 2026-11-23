# Can the released QCM-D figures test transfer to a higher harmonic?

The published figure files do not identify a measured 11th- or 13th-harmonic frequency/dissipation pair on the same wet film run as the lower-frequency inputs. The proposed physical prediction stopped at source qualification. There are zero measured forecasts and zero measured scores. The positive result below concerns a constructed acoustic layer.

## What the deposited files identify

The paper describes an E1 instrument recording odd overtones 3 through 13, illustrates a fifth-harmonic response in Figure 2, and reports a Dfind Smart fit using harmonics 3, 5, 7 and 9. Across Figures 2–4, 22 CSV paths contain five distinct byte sequences. Each sequence recurs unchanged under different figure captions, including model-derived thickness and elastic-modulus folders. Reading the CSV header distinguishes the measured channels from those captions.

| Composition | Labeled frequency and dissipation | Nonblank rows | Identical paths |
|---|---|---:|---:|
| A6B65A6 | f5, d5 | 15,244 | 5 |
| A6B34A6 | f5, d5 | 22,866 | 5 |
| A7B42A7 | f3, d3 | 15,837 | 4 |
| A6B44A6 | f3, d3 | 15,188 | 4 |
| A3B22A3 | f3, d3 | 18,023 | 4 |

The A3B22A3 file has seven additional unnamed columns. Six contain numerical tokens. The only two textual markers inside those seven columns both read `f3 [Hz]`, at row 10277 in columns 7 and 8. Their physical identity cannot be inferred from the number of columns. The Figure 1 ZIP lists light-scattering data and a microscopy archive. Figure 5 lists four AFM images. The reported ellipsometry measurements characterize dry films on gold. They provide no calibrated relation between dry thickness and wet film density or hydration on an individual QCM run. The audit inspected filenames, hashes, column labels, lexical classes, and row counts. It did not interpret numerical response cells, inspect fit rows, or decode microscopy images.

A measured test would require synchronized same-run frequency and dissipation pairs at the declared input harmonics and at least one independently measured held harmonic, plus frequency-normalization, dissipation/bandwidth, timing and replicate conventions. This finding applies to the named figure deposits. It makes no assertion about undeclared channels or the original instrument recordings.

## Two different limits of a homogeneous layer

For a homogeneous, isotropic no-slip shear film with a fixed backing impedance, the transfer matrix depends on the film through its characteristic impedance `sqrt(rho G*)` and phase `h omega sqrt(rho/G*)`. For any positive a, multiplying density by a and dividing both thickness and complex modulus by a leaves both quantities unchanged at every frequency. Consequently even complete acoustic loads cannot distinguish all three parameters in this class.

A second construction concerns prediction itself. A Kelvin–Voigt modulus and a passive spring, solvent and single Maxwell arm can match at one harmonic and separate at another. At the fifth harmonic choose relaxation time 1/omega5, reduce the equilibrium spring by half the Maxwell strength, and reduce the solvent viscosity by the Maxwell strength divided by 2 omega5. Both remaining coefficients are positive in the recorded example. The two complex loads agree at 25 MHz and differ by 267.878 and 367.249 Pa s/m at 55 and 65 MHz, respectively, or 0.8851% and 1.0803% of the Kelvin–Voigt load. A second implementation using traveling waves reproduced all twelve complex loads within 9.10e-12 Pa s/m. These synthetic differences supply no estimate of measured film error.

Run `python3 replay.py .` in this directory for an offline recount. The SHA-256 identities and ZIP member inventory are in `source-schema.json`. `audit_archives.py` accepts a directory containing the five original ZIP files and independently checks their whole hashes and member lists, the CSV copies, and the wide-file fields.

[Paper and methods](https://doi.org/10.1039/D1NR01122G) · [Figure data, Zenodo 4719516](https://doi.org/10.5281/zenodo.4719516)
