# Can these PIV files support a held rotating-cylinder force comparison?

**The archive does not establish the required pair of force-labelled interventions.** The nominal 137 RPM table contains only time, translational speed and position in all 40,000 rows. The nominal 411 RPM table does have seven columns, but its documented angular-speed column peaks at 138.6654 RPM. A separately frozen geometry check also found a large mismatch between encoder travel and camera mask travel under the released common time origin. The force comparison remains unscored. The drag, lift and PIV velocity fields stayed closed.

## What the release contains

Gehlert and Babinsky report force-balance and planar PIV acquisitions for a 60 mm diameter cylinder at Reynolds number 20,000. Their paper gives four configurations, five-run mean force traces, 3 kHz measurement of load and kinematics, an inertial-force subtraction and midspan PIV averaged over five to six runs. Its published figures already show comparisons of a near-wall interpolation method to the force balance, including a high-spin lift curve of about 24 N. These are prior aggregate exposures. The public ZIP contains three configuration folders. The two PIV modes within each folder correspond to different start locations in the camera's fixed coordinate frame. [Cambridge dataset](https://doi.org/10.17863/CAM.37305) · [Author methods and comparison](https://doi.org/10.2514/6.2019-0347) · [Related boundary-layer study](https://doi.org/10.1017/jfm.2021.121)

| Folder spin ratio | Acceleration distance | Rows × columns in the force/kinematics file | Readme description and actual coverage |
|---|---:|---:|---|
| 0 | 3 diameters | 30,000 × 3 | Time, translation speed and position are present. |
| 1 | 2 diameters | 40,000 × 3 | The readme lists seven columns for both spinning cases. This file ends at position on every row. |
| 3 | 2 diameters | 40,000 × 7 | Only file with columns labelled drag and lift coefficients. The stated RPM field ranges from −1.3097529 to 138.6654. |

Under the rule fixed before the independent row recount, 10,415 rows in the nominal 411 RPM file had times ≤5 seconds and translational speeds from 0.40 to 0.46 m/s. Their median was 137.03593 RPM. Using the paper's 0.03 m radius and 0.43 m/s terminal speed yields a surface-speed ratio of 1.00119. At the maximum RPM, zero-based row 3769 records 1.256321 s, 0.18567816 m/s, 0.024 m, 0.74642822 m/s² and 138.6654 RPM. A file copy would be one possible explanation worth checking. The two spinning folders share all 40,000 time values, only 602 same-ordinal velocity values and 18,352 same-ordinal position values. Their distinct kinematic bytes and this aggregate speed do not determine which spin belongs to the released force columns. No multiplier, relabelling, inferred load or replacement condition was applied.

The original repository bitstream is 1,351,560,391 bytes. Its published MD5 is 741bce55204fdb910d38db0132baef9f. Full download produced SHA-256 be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367. The first catalog request rejected the assumed filename; the repository names it `Open Access Data.zip`. Range reads confirmed the ZIP directory and 2,012-byte author readme before the full-file check. A second original stopped at the missing columns in the nominal ratio-one table. Both refusals remain in the source and receipt record.

## An independent position check using masks

The RTF states that PIV and the force/kinematics recording began together and gives 800 Hz for folders 0 and 1 and 1,200 Hz for folder 3. The paper gives a broader camera range. The diagnostic used the release-specific rates. It used initial-position acquisitions only, mode 202 for the nonrotating case and 2202 for the others. It did not treat modes 222/2222 as second simultaneous exposures or concatenate them. Mask zero means a vector was unavailable in all runs. A zeroed fluid-velocity entry would not represent the true speed of the body.

The predeclared test tracks a unique, isolated four-connected component of permanently masked camera cells, with area and shape consistent with a projected cylinder disk. It uses the component centroid and bounding-box midpoint as two distinct position estimators. Each reported travel is relative to its own frame-zero location. A flag requires both estimated travels to differ from absolute encoder travel by over 15 mm, in the same direction, for three consecutive sampled frames. The score keeps frames at which a component ceases to qualify. The code searches no time lag, sign, gain or frame alignment.

| Spin folder | Paired / examined frames | Longest consecutive mismatches | Frame and time of largest centroid discrepancy | Encoder travel | Mask centroid travel | Mask box travel |
|---|---:|---:|---|---:|---:|---:|
| 0 | 25 / 42 | 14 | 768 at 0.9600 s | 50.600 mm | 164.215 mm | 164.255 mm |
| 1 | 26 / 42 | 17 | 550 at 0.6875 s | 0 mm | 160.867 mm | 161.346 mm |
| 3 | 29 / 42 | 19 | 840 at 0.7000 s | 0 mm | 164.973 mm | 166.032 mm |

On the worst folder-three frame the masked component covered 1.0773 nominal disk areas; both estimators placed it roughly 0.165 m from its initial x-coordinate. A SciPy component-labelling implementation independently read the original quality masks and encoder columns and checked all 126 frames, including 80 paired frames, within 5.28×10⁻¹⁶ in the reported numerical comparisons. No response traces were decoded. These are geometric properties of an ensemble quality mask. Undocumented exported time offsets, cropping, masking operations and run selection remain possible. The measurements do not prove that the physical acquisition triggers were unsynchronized. They show that the literal exported index-to-time mapping does not align the two recorded position proxies within the declared tolerance.

## What the contour mathematics can establish

For planar solenoidal velocity, the signed first vorticity moments over an annulus are determined by velocity on its two boundaries. The derivation, including both orientation signs, is in `BOUNDARY.md`. It leaves the interior vorticity distribution unspecified. A single plane of a three-dimensional incompressible flow can have nonzero planar divergence. A compact interior field then gives identical boundary velocity but a changed first moment. Exact polynomial checks in `contour_identities.py` retain these divergence terms. Inferring actual force further requires a correctly paired time history, body-displacement correction and outer-domain or finite-control-volume terms. The authors' own interpolation and the established finite-control-volume methods supply the relevant comparisons should a future calibrated acquisition support them. [Noca, Shiels and Jeon](https://doi.org/10.1006/jfls.1999.0219)

## Replay

Run `python3 replay.py .` in this directory for the offline source, row-count, mask and exact-contour checks. With the original archive available, `python3 independent_source.py "/path/to/Open Access Data.zip"` performs a new complete row census using the standard library. `python3 independent_mask.py "/path/to/Open Access Data.zip"` performs the second segmentation and time comparison with NumPy and SciPy. The eight original native receipts and their captured output hashes distinguish the two failed intake attempts from the successful source operations. A cross-spin load transfer, a measured force advantage and a cause for the metadata differences remain open.
