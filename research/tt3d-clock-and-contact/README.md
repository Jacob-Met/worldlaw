# TT3D table-tennis measurement clocks and a spin ambiguity at contact

The released timestamps allow all 139 trajectories to be audited. They do not establish which camera frames contributed to each exported 3D position. The proposed physical test would issue a forecast before the bounce from measurements available by that instant. Its input-availability requirement remains unresolved, so there is no empirical forecast or spin-accuracy score from this course. The separate synthetic calculation below exhibits two models that agree on the entire incoming center trajectory and disagree on the rebound.

## Released measurements

The authors recorded two club players in one match with a multicamera tracker rated at 200 Hz. The project page describes 130 trajectories. The pinned repository contains 139 center-position files numbered 001 through 139 and six simulated camera-view directories containing those same 139 IDs each. The exported tracker coordinate convention is metres, with the origin at the table-surface center, X along its width, Y along its length and Z up. The paper derives the 25 Hz 2D observations from the 3D export. These views cannot independently establish the time support of the original tracker.

The clock projection authenticated each complete CSV by Git blob identity and parsed only its first column. All 14,287 rows use increasing within-file timestamps in seconds. Files contain 53–200 rows and their median intersample gaps range from 5.520225 to 5.626917 ms. ID 074 contains a 66.795111 ms gap. The earliest and latest recorded timestamps are 12.056292057 and 544.308682680 s. Treating the 139 exports as independent players or assuming uniform 5 ms steps would change the sampling interpretation.

The paper's Kalman filter operates on camera calibration. The author's reconstruction benchmark segments both sides of impact and uses observations before and after contact to estimate the bounce point and spin. That algorithm evaluates retrospective reconstruction. Neither its smoothing choices nor its two-sided loss establish the original high-speed tracker's export policy. The authors advertise the public raw share as oblique and side videos. The university share timed out during the native TLS handshake and an independent retrieval route also failed. Its contents, synchronized raw detection clocks and export window therefore remain unverified. No numerical position, simulated observation or video frame entered the audit.

An exhaustive comparison of 9,591 file pairs found 11 overlapping time intervals and 128 connected components. IDs 077 and 132 have the largest intersection at 0.577966452 s. None of the intersecting pairs shares an exactly equal timestamp. The clock evidence alone does not identify duplicate observations or establish a common hardware epoch across every file. A future within-release comparison should group intersecting intervals conservatively and document the two-player, single-match sampling limit.

## A spin ambiguity even with perfect incoming positions

In the author's flight model let $K_M$ be its Magnus coefficient, $m$ the ball mass, $v$ the center velocity and $\omega$ the constant angular velocity. The spin-dependent acceleration is $(K_M/m)\,\omega\times v$. Replacing $(K_M,\omega)$ with $(cK_M,\omega/c)$ for any $c>0$ leaves the whole incoming vector field unchanged for every position and velocity. Identical initial positions and velocities therefore give identical pre-contact center trajectories. The author's published fixed coefficient chooses a scale. A claim about spin in physical units for an unknown lift coefficient needs an independent calibration or additional observable.

The contact law depends separately on ball radius and spin. For a synthetic table-tennis state with incoming velocity $(4,0,-1.2)$ m/s, radius 0.02 m, friction coefficient 0.3 and restitution 0.85, the author operator gives the following values. The doubled coefficient is an illustrative alternative in the model family, not a measured property of this match.

| Quantity | Fixed author coefficient | Doubled coefficient |
|---|---:|---:|
| $K_M$ | 0.00000486 | 0.00000972 |
| $\omega_y$ (rad/s) | 180 | 90 |
| Signed tangential slip (m/s) | 0.4 | 2.2 |
| Contact parameter $\alpha$ | 1.665 | 0.30272727 |
| Published branch | Rolling | Sliding |
| Outgoing tangential speed (m/s) | 3.840 | 3.334 |
| Outgoing normal speed (m/s) | 1.020 | 1.020 |

The source-operator outputs differ by exactly $253/500=0.506$ m/s in tangential speed. Their incoming accelerations agree, including at the example state, where both are $(-2.739802355,0,-10.400699294)$ m/s². The exact demonstration uses positive, nonzero contact slip in both cases. It makes no assertion about which branch or coefficient the 139 measured rallies occupy. No empirical error floor follows without information on the joint distribution of spin, lift and contact state.

## Reproduction

Run from this directory with Python 3. The first command uses the standard library and fetches the 139 pinned author CSVs. The second checks the synthetic contact calculation in exact rational arithmetic. The third also downloads two pinned author source modules, verifies each Git blob and runs its native flight/contact operators. The original used CasADi 3.7.2 and NumPy 2.2.6.

```sh
python audit_release.py --output clock-roster.json
python contact_witness.py
python contact_witness.py --author
```

The optional output has SHA-256 `79a5c25ca4ea69781ee2c8e964a8c680c5a58c2eb5a48f4b6ffcccd7901cf6c0`. `source_manifest.json` pins the original release and the source-read roster. `qualification.json` records both the pre-issuance refusal and the synthetic source calculation. 

[Author project](https://cogsys-tuebingen.github.io/tt3d/) · [Gossard, Ziegler and Zell, CVsports 2025](https://openaccess.thecvf.com/content/CVPR2025W/CVSPORTS/papers/Gossard_TT3D_Table_Tennis_3D_Reconstruction_CVPRW_2025_paper.pdf) · [Pinned author data and code](https://github.com/cogsys-tuebingen/tt3d/tree/f079b7918f94db42956367c806b2f1ae25b7150e)
