# Fiber-grating spectra on a plate with three holes

Can the released distributed strain measurements predict the full reflected spectrum of a short grating under a steep strain gradient? Gianotti and Magne provide measurements on one perforated aluminium coupon, including two distributed systems, discrete gratings and the loading-machine record. The released geometry establishes which devices share a face. The measurements do not identify the longitudinal optical coupling needed for a unique spectral prediction, and their clocks support only a qualified load match. A second, prospective test of interpolation between measured spectra stopped at its first unloaded reference. **No loaded spectrum or distributed strain ordinate was decoded by either test.**

## What the files establish

The archive is version 2.1 of [the authors’ release](https://doi.org/10.5281/zenodo.22655280). It contains 544 ZIP entries. Campaign A and B used the same specimen and layout under different acquisition settings. The journal Table 1 and Figure 2 place the three 8 mm type-I gratings on fiber #1 opposite the 3 mm type-III point-by-point gratings on #2 and the blank OFDR lead #4. The journal explicitly mirrors the opposite face into the OFDR coordinates and describes interrogation of the line shared with #2. The ReadMe reverses the names of the two faces. Fiber identifiers and the relative face pairing agree. The journal figure is a schematic; registered processed strain curves use a spatial alignment and force-dependent bending correction. The FEM reference is a calculation. The factory peak detector #132 gives peak locations, whereas the proposed endpoint was a full native spectrum. [Journal article](https://doi.org/10.1088/1361-665X/aeb51b) · [Conference paper](https://doi.org/10.58286/32456).

The source review included the papers’ qualitative spectral-shape and sensor-accuracy discussions, their published estimate of the bending correction and selected mesh-convergence values. None of these values entered the clock fit or reference threshold. Files contain one selected load sequence on the coupon; saved exposures and wavelength samples do not represent separate specimen trials.

## Load and clock support

The clock replay reads all 1,000 machine force/time samples, 22 loaded FBG file timestamps with their saved-exposure times, and 19 distinct fixed-reference 5 mm OFDR file starts. It keeps device clocks and branch labels intact. Ten branch/load pairs have the same nominal force in both instruments. Their file starts differ by 6–155 seconds in absolute value. At ±10 N, linear interpolation of machine force admits one offset interval for all 20 paired file starts, from −57981.625806 to −57980.779939 seconds. This is a registration calibrated using the force labels. There is no independent synchronization witness. At ±5 N at most 19 of 20 starts are compatible. All 41 starts together have no common offset at any of the four fixed tolerances (2, 5, 10, 20 N).

The largest full-exposure force range among the nominal matches occurs on the descending 809 N file. Eight saved frames span 34.999 seconds. Its first frame corresponds to 809.595–809.599 N across that calibrated interval; the full window covers 595.410–809.599 N. The corresponding OFDR file starts 41 seconds earlier. The 408 N rising file has ten exposures across 44.998 seconds and stays within 407.77–408.56 N. Equal load labels therefore give quite different support for whole-file averaging. OFDR acquisition durations, mechanical creep and the absence of independent clock synchronization limit further pairing claims.

## Why a strain trace does not give a unique spectrum

In an ideal rectangular-window model, a 5 mm-period sinusoidal strain perturbation integrates to zero over both 5 mm and 10 mm windows. Its amplitude after a 3 mm average is still 0.504551 of the input. This is an illustration of spatial ambiguity; the physical OFDR cross-correlation operator need not have rectangular support. A quoted optical ranging resolution of 9 μm does not describe the reconstructed strain gauge length.

In a scalar weak-reflection model, consider three separated, equal-shaped subgratings with coupling weights (1,2,4) or (4,2,1). Both have exactly the same autocorrelation coefficients (21,10,4). Consequently they produce identical unloaded intensity at every detuning and under any uniform shift of detuning. Apply one identical continuous phase field that rises by π only in the gap before the last subgrating. Their normalized resonant powers become 1/49 and 25/49. Thus even a known phase field together with the entire unloaded intensity need not determine the loaded intensity when longitudinal coupling is unknown. These are constructed examples, not measurements of either grating’s coupling. A calibrated transfer model using additional optical information remains possible.

## The unloaded reference rejected the fallback

A separate protocol fixed a native-spectrum target before opening the unloaded data. It required all three published type-I carrier wavelengths to select one of the four instrument channels, each with a positive contrast at least twice the strongest competitor. Contrast is maximum response within ±0.75 nm of the carrier minus the median response in both 1.5–3 nm flanks. The first recorded unloaded exposure is dated 19 February 2026 at 15:59:41.89120. Each channel has 20,000 native ordinates from 1460 nm in 0.008 nm steps. The contrasts below are in the exported ordinate units.

| Nominal carrier (nm) | Channel 1 | Channel 2 | Channel 3 | Channel 4 | Admitted channel |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1551.16 | 21.85 | 0 | 0 | −0.92 | 1 |
| 1560.68 | 23.09 | 0 | 0 | 0.995 | 1 |
| 1569.44 | 0 | 24.63 | 0 | 21.46 | Unresolved |

At the third carrier, the strongest contrast belongs to channel 2 and is only 1.148 times the channel 4 contrast. This fails both the common-channel requirement and the registered margin. It does not prove a misconnection or an erroneous carrier wavelength. Development and reserve spectra remained unopened, and there is no measured forecast score for the candidate or its five comparators. The preregistered channel gate and source controls remain in the directory.

## Reproduction

With the original data.zip and Python 3, run `python3 research/gianotti-grating-clock-aperture/replay.py /path/to/data.zip`. It verifies the archive SHA-256, compares the entire clock report to the frozen result, reconstructs the twelve reference contrasts using decimal input and wavelengths, and checks the weak-reflection counterexample. The independent reference parser reads four rows from the first unloaded member only. The original NumPy reference implementation also supports `python3 research/gianotti-grating-clock-aperture/reference_channel.py --archive /path/to/data.zip`. Both use raw native amplitudes without an inferred calibrated power conversion. Original run identifiers and the exact reference result accompany the replay.
