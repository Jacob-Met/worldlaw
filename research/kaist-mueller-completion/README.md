# Circular-polarization completion on the KAIST material spheres

Adding a physical-feasibility rule to a learned Fresnel-residual model **increased** error on 13 material spheres. Equal-material normalized absolute error rose from **0.037547 to 0.049389**, and the worst-material error rose from **0.069106 to 0.073564**. The registered candidate failed both development requirements. The twelve reserved material tensors remain unopened for evaluation.

The input for one prediction contains nine entries of a measured Mueller matrix, the angular coordinates and the wavelength. The target is the signed VV entry, which gives the output circular polarization due to incident circular polarization. Baek and colleagues estimated the matrix entries together from 36 retarder exposures and formed raw-table bins using ten jittered lookups. Thus the target concerns completion of the authors’ estimated matrix. There was no separately acquired circular-intensity validation. [Author paper and acquisition details](https://vclab.kaist.ac.kr/siggraph2020/) · [Raw material data and file formats](https://vclab.kaist.ac.kr/siggraph2020/pbrdfdataset/kaistdataset.html)

## Measured comparison

Each of three development folds withheld a complete source-label group: five billiards, five materials with metallic labels, or three with ceramic/pearl labels. Material names identify released samples and do not establish composition. Each group received forecasts from the other two. Every sphere had 3,840 prespecified angular/wavelength coordinates across five wavelengths. Of the 49,920 coordinates, 25,991 contained a finite VV target and 23,929 were missing. Another 518 had finite targets and unusable linear inputs and received the registered zero prediction. Every finite target enters every comparison. Within each material the score sums raw absolute errors and divides by summed absolute finite M00 on the scored rows. The aggregate weights all 13 materials equally.

| Method | Equal-material error | Worst-material error |
|---|---:|---:|
| Learned UU residual, unconstrained | 0.037547 | 0.069106 |
| **Registered candidate, constrained UU residual** | **0.049389** | **0.073564** |
| Direct, extra analytical features, constrained | 0.050358 | 0.073479 |
| Direct, raw features, constrained | 0.050664 | 0.073553 |
| Direct, extra analytical features | 0.050621 | 0.074598 |
| Direct, raw features | 0.051510 | 0.075888 |
| Feasible interval midpoint | 0.097281 | 0.124982 |
| Signed Fresnel UU | 0.097389 | 0.125526 |
| Pure-system cofactor with UU fallback | 0.097389 | 0.125526 |
| Gil maximum-purity endpoint with fallback | 0.106451 | 0.141216 |
| Zero | 0.566717 | 0.641838 |

Development admission required the candidate to beat every comparator on each column. The unconstrained residual beat it on 12 of the 13 individual spheres. Brass had the highest candidate material error, 0.073564 compared with 0.044226 for the same residual without the constraint. All angular observations on a sphere share acquisition and processing. The sample count does not establish independent replicates or a population confidence interval.

## Why the constraint cost accuracy

The feasibility rule seeks a circular coefficient compatible with a positive-semidefinite coherency matrix for the given linear block. Among scored bins, 10,499 had a nonempty interval and 10,101 of those contained the published VV within the registered numerical tolerance. Another 14,974 scored bins had usable linear inputs and an empty interval. The pure-system control passed no usable measured bin under its fixed repeated-eigenvalue and rank requirements, so its predictions equal the signed UU fallback. These checks concern compatibility of the released estimates with the mathematical model. The study cannot distinguish correlated estimation error, calibration error, or aggregation effects.

On the 10,499 feasible bins, clipping reduced the candidate’s equal-material error contribution by 0.00001659 relative to the unconstrained residual. On the 14,974 empty bins the registered fallback switched to the direct regressor and increased the same contribution by 0.01185859. Both models made identical zero forecasts when inputs were unavailable. These three signed contributions reconstruct the total difference. They follow from the original forecasts, with no refit.

The largest individual candidate error occurred on the chrome sphere at 500 nm and source indices (330,75,10,1). The published VV was **10.356166**, the candidate’s direct fallback gave **49.009448**, the unconstrained residual gave **13.075484**, and signed UU gave **8.151481**. The stored IQU block, in its original intensity scale, was

| Output / input | I | Q | U |
|---|---:|---:|---:|
| I | 136.679871 | 69.493790 | −12.169097 |
| Q | 84.491562 | 117.517418 | −21.391441 |
| U | 23.111851 | 51.217663 | 8.151481 |

The normalized coherency pencil has a two-by-two principal minor independent of VV, with eigenvalues −0.016601 and 0.770822. Its determinant is strictly negative in exact rational arithmetic on the stored float32 inputs. No choice of VV makes that pencil positive semidefinite. The 14,974-bin count uses the frozen numerical eigensolver. The exact certificate applies to this particular chrome bin. See [the raw witness](worst-certificate.json) and [the branch-by-branch differences](projection-branches.json).

## Physical assumptions and prior algorithms

For nonsingular Mueller–Jones systems the cofactor identity determines VV from the linear block. The implementation uses a fixed closest-pair tolerance for the repeated eigenvalue and tests both rank-one residuals. The deterministic singular Jones systems mapping right-to-right and left-to-right circular polarization have exactly the same normalized IQU block but opposite VV. Their mixtures fill the entire interval from −1 to +1. The support condition for a mixture and the maximum-purity endpoint follow the real-coherency construction of Gil and colleagues. A maximum-magnitude tie has a declared zero fallback. Signed UU is the control for a diagonal Fresnel Jones map in the authors’ paired scattering frames. The source audit records 18 finite right-handed frame pairs and six undefined normal-incidence cases. [Derivation and frame convention](source-interpretation.md) · [Ossikovski and Arteaga](https://doi.org/10.1364/JOSAA.36.000403) · [Subsequent nondepolarizing completion](https://doi.org/10.1364/JOSAA.588312) · [Gil and colleagues](https://doi.org/10.1364/OE.581147)

## Reproduce

Use Python 3.12 with NumPy 2.2.6, SciPy 1.15.3 and scikit-learn 1.8.0. The public entry point streams each of the thirteen original compressed raw members via HTTP byte ranges, checks its CRC and complete-content hashes, and retains only the registered linear and circular projections. It verifies the exact retained projection bytes against the original manifest. Obtaining all inputs requires 7,666,572,592 compressed bytes plus HTTP overhead, representing 12,436,105,890 raw bytes. The inpainted data are excluded. The public roster contains metadata for all 25 archives and the development replay requests data for only the thirteen registered members.

```sh
python check_optics.py
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 python replay_study.py /path/to/kaist-cache --fetch
python explain_projection.py /path/to/kaist-cache
python worst_certificate.py /path/to/kaist-cache/development-independent.json
```

Existing verified projection directories can be used by omitting `--fetch`. The independent reader recomputes all 285,901 errors, each wavelength and material score, the two admission decisions, and the nine measured linear values on each material’s worst row. [Registration](registration.txt) · [Source receipts](development-sources.json) · [Original result](development.json) · [Independent recount](development-independent.json) · [Execution record](course-receipt.json)
