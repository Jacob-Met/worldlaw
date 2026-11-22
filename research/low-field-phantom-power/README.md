# Can corner noise forecast low-flip-angle phantom image power?

**The six development scans failed the registered spatial check, so the low-angle forecast was never scored.** This study used a single physical calibration phantom measured by Keenan and colleagues on four 0.55 T MRI systems. It preserves two separate results: missing AFI intensities prevented a raw joint estimator, and measurements at the higher VFA angles failed to support a common background-power correction. No human images were used. [Original data and author code](https://doi.org/10.6084/m9.figshare.25892944.v2)

## What failed on the images

For each of three runs on each of two development scanners, the study measured power at 5.4772°, 9.6549°, 17.019° and 30°. It used four corner boxes to estimate a power floor and checked four separately located boxes at the centers of the image faces. An acceptable face-to-floor ratio was 0.67–1.50. Every development run failed. The other two scanners and the 1°, 1.7627° and 3.1072° images from all 12 runs remain unevaluated. The target would have been squared magnitude; no low-angle prediction accuracy was measured.

| Scanner and run | Range of four face-to-floor ratios | Highest / lowest corner power | Estimated floor fraction at 1° |
| --- | ---: | ---: | ---: |
| Commercial 1, MID37 | 102.29–255.60 | 1.022 | 3.84% |
| Commercial 1, MID256 | 104.91–253.72 | 1.019 | 3.69% |
| Commercial 1, MID276 | 105.37–249.40 | 4.200 | 3.79% |
| Prototype 1, MID110 | 3.32–3.48 | 1.017 | 0.82% |
| Prototype 1, MID382 | 3.38–3.50 | 1.024 | 0.75% |
| Prototype 1, MID574 | 3.40–3.58 | 1.043 | 0.85% |

The last column uses a high-angle model extrapolation. It is an admission diagnostic, and does not contain a measurement from the 1° image. The predeclared candidate required a fraction above 1% on every development run. The full input rules and all six numerical records are available. [Registered protocol](power-admission.md) · [Original result](power-development.json)

At 9.6549° on Commercial 1 MID37 the four face measurements were 0.001954, 0.002252, 0.943766 and 1.177936 in normalized power units. Their average, 0.531477, was **255.60 times** the corner floor of 0.00207933. The two large values came from the boxes starting at image indices (60,0) and (60,120). Each box covered 8×8 pixels and slices 8 through 47. These are coordinates in the reconstructed image. We cannot identify their contents or attribute the difference to receiver noise from the released data. The result specifically rejects carrying the frozen corner estimate to these face locations. The separate reader reproduced 192 box-by-angle values using an independent MAT projection. [All box values and worst case](independent-physical-boxes.json)

## What the release can identify

The source inventory includes three VFA repetitions on each of four scanners. Each contains seven image contrasts and a processed B1 field. Separate AFI intensity pairs are missing. The authors' AFI processing forms a signal ratio, clips low field values, smooths, then resamples the field for VFA. Distinct original pairs can yield exactly the same released map. Eleven archived VFA fits used four angles. Prototype 1 MID574 used all seven, so reusing its archived fitted result for lower-angle forecasting would include the proposed targets. The independent NMR reference describes same-batch witness samples at 20 °C. Individual NMR reference values and all IRSE outcomes were kept out of the comparison. [Source qualification and sequence timing](raw-afi-qualification.md) · [Per-file stored protocols](per-file-protocol.json)

The active author reconstruction configuration specifies noise adjustment, Cartesian Fourier reconstruction, Inati adaptive coil combination and extraction before the saved magnitude stack. Scanner-specific raw noise calibration, sensitivity weights and reconstruction build identifiers were unavailable. Under those conditions the identity for additive, zero-mean complex noise at a fixed receiver cannot establish equal mean-square offsets at the corner, face and phantom interior. A common positive reconstruction gain cancels when both the inputs and the target are divided by the same high-only intensity scale before squaring. The authors' vial masks used all seven angles, so the admission instead used its own high-only central support. The software interpreted only the high-four numerical spans and processed B1 on the six development runs. It authenticated the other source files as bytes and inspected shape and sequence metadata. [Original acquisition and reconstruction methods](https://doi.org/10.1002/mrm.30281)

## Replay

With Python 3.12, NumPy 2.2.6 and SciPy 1.15.3, this command downloads only the six permitted development phantom MAT files (approximately 236 MB), verifies their hashes and reproduces the registered gates and the independent box recount:

```bash
python replay_phantom.py --download-development
```

For a local copy, name each allowed file by its numeric Figshare file ID followed by `.mat` and run `python replay_phantom.py --source-dir /path/to/files`. The exact original filenames, folder assignments, hashes and dimensions are provided for all 20 T1 sources. The replay also checks the design-only 420-point synthetic near-degeneracy calculation. [Source inventory](figshare-roster.json) · [MAT structure receipt](mat-structural-receipt.json) · [Synthetic result](design-ceiling.json)
