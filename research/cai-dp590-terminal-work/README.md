# DP590 terminal plastic work under seven biaxial loading programs

Hill48 had the smallest mean and worst absolute log error among the eight registered controls. The candidate, which takes the geometric midpoint of two bounds on yield strength, underestimated terminal work in all seven programs. It passed **2 of 16** comparisons, both against an axis-strength blend. The separate necessary lower-work check was satisfied in all seven programs. The radial brackets based on nominal force direction contained five of seven measured works.

The endpoint is the sum of the two signed stress–plastic-strain integrals over an archived program. Predictions use that program’s initial and terminal plastic strains and its prescribed force ratio. They can be issued before reading its stress columns, after the strain endpoints are available. One observation is one complete worksheet. The release supplies one sheet for each mixed ratio.

## Results

The forecast bank uses 0.3–105 MJ/m³ for the measured calibration knots and 0–105 MJ/m³ for numerical inversion. All seven programs had finite forecasts for all twelve reported arms. The table shows the equal-weight mean and maximum of |log(predicted work / observed work)|.

| Procedure | Mean | Maximum |
|---|---:|---:|
| Convex-support geometric midpoint | 0.236013 | 0.292405 |
| Hill48 | 0.066059 | 0.079382 |
| Net-strain Mises | 0.068929 | 0.080939 |
| Barlat Yld2000-2d, m=4 | 0.069576 | 0.091027 |
| Barlat Yld2000-2d, m=6 | 0.091215 | 0.106727 |
| Barlat Yld2000-2d, m=6, midpoint-area approximation | 0.091198 | 0.107432 |
| Hosford, m=6 | 0.092756 | 0.105502 |
| Barlat Yld2000-2d, m=8 | 0.108519 | 0.128820 |
| Axis-strength blend | 0.691848 | 0.886282 |

| Prescribed RD:TD force | Integrated RD | Integrated TD | Total work | Candidate | Hill48 |
|---|---:|---:|---:|---:|---:|
| 1:4 | −1.47936 | 21.73968 | 20.26032 | 15.95785 | 18.97565 |
| 2:4 | 0.18762 | 17.36691 | 17.55453 | 13.10386 | 16.53249 |
| 3:4 | 3.80007 | 16.15413 | 19.95420 | 15.88394 | 18.69378 |
| 4:4 | 14.35098 | 15.37109 | 29.72207 | 26.94057 | 27.54090 |
| 4:3 | 15.12353 | 4.05889 | 19.18242 | 14.72689 | 17.71855 |
| 4:2 | 19.26564 | 0.24532 | 19.51096 | 14.63932 | 18.61535 |
| 4:1 | 25.82219 | −1.77373 | 24.04846 | 18.86052 | 22.44317 |

All works are in MPa, equivalent to MJ/m³ for dimensionless strain. The largest candidate log error occurred at 2:4. Its strain endpoints were (0.000466701, 0.028427483) and terminal stresses (324.8731, 661.8579) MPa, relative to four zero initial entries. Its lower and upper work estimates were 8.71585 and 19.78905 MJ/m³. The candidate lay 4.45067 MJ/m³ below the observed signed sum. The two bracket misses occurred at 1:4 and 4:1, with measured work above each upper bound (19.72726 and 23.12804). Those two sheets also carried negative signed work on the contracting axis. Every mixed sheet had some negative increments of the stored total work, from 18 at 4:1 to 493 at 3:4.

## Observation and calibration

Cai and colleagues released two Origin projects. One contains nine cruciform programs at prescribed force ratios, the other contains independent dog-bone tensile curves. Their Figure 4 identifies the axes as true stress and logarithmic plastic strain. The source metadata original verified the publisher’s whole-file SHA-256 for both inputs. The biaxial source is available under CC BY-NC 3.0 and the companion uniaxial source under CC BY 4.0. Each replay obtains the files from Mendeley or authenticates a previously obtained copy. [Biaxial archive](https://doi.org/10.17632/tbdsbrnkj9.1) · [Uniaxial archive](https://doi.org/10.17632/62nyx7gdd3.1) · [Primary manuscript](https://ira.lib.polyu.edu.hk/bitstream/10397/106768/1/Cai_Modified_Yield_Function.pdf)

The first, calibration-only projection comprised the two pure cruciform programs and three independent uniaxial tests at 0°, 45° and 90° relative to the rolling direction. A second decoder matched all 72,276 calibration scalars from liborigin. The mixed worksheets have identical finite row masks across their four columns, with all 21,009 rows retained. Matching table indices and endpoints supports the archived coordinate integral. The archive gives no independent acquisition timestamps, raw force/area channels, or row-level validity flags for local homogeneity, shear, necking or fracture. All published rows remain in the measured endpoint.

The mean RD/TD strength at each equal-work calibration level combines the pure cruciform and independent uniaxial tensile tests. Only the independent test supplies the 45° strength. Across all 13 programmed work levels, the pure cruciform transverse/axial secant contractions were 0.490575649516… and 0.522900000000… to floating-point precision. These stored curves supply no evidence for a changing flow direction over those levels. Across 20 prespecified strains, the greatest shortfall of a pure cruciform signed work relative to the independent first-loading uniaxial reference was 2.031618%, at RD strain 0.12 (72.03506 versus 73.52889 MJ/m³). This empirical tolerance carries the calibration discrepancy forward as a sensitivity. It has no calibrated coverage probability.

## Constitutive assumption and prediction

Suppose each program has the same convex yield set at the same scalar accumulated work, and each plastic increment is associated with its current stress. The support inequality then gives s_d(W) dεᵖ_dd ≤ dW for a uniaxial stress s_d(W) d⊗d on that yield set. With positive tensile strength and increasing work, integration from a common origin gives a lower bound on terminal work from the net strain in direction d. The code reconstructs the uniaxial work required to reach each new strain on its first advancing excursion. This monotone reference is an empirical rendering of noisy curves. The 45° projection uses half the sum of the RD and TD net strains and assumes zero in-plane shear strain. Interpreting work as thermodynamic dissipation also requires matched local work-conjugate variables, equivalent tensile hardening histories and coverage of the total-work interval. Satisfaction leaves association and other causal interpretations unresolved.

For a positive normalized true-stress ray u, the pure tensile stress points imply the radial lower strength 1/(u_x/s_x + u_y/s_y). The two tensile flow normals give an upper strength by intersecting their supporting half-planes with the ray. Taking the geometric mean gives the center of the interval on log strength. For σ=ρ(W)u with a fixed u, the measured endpoint obeys u·Δεᵖ=∫dW/ρ(W). The forecast numerically inverts this integral for each arm. The mathematical radial bounds apply to actual stress direction, whereas the prospective course uses specified **force ratios**. Deformation changes areas, and the release gives no independent center-stress conversion. The midpoint-area variants approximate the ratio change using homogeneous incompressibility and half the terminal plastic strain. The two empirical bracket misses can reflect these assumptions, measurement processing, the state match or calibration.

The paper fits mixed-path information, including an evolving-exponent yield function. To keep the same input rights, the comparison executes the full in-plane Yld2000-2d source equations with fixed m=4,6,8. Each fit uses five calibration quantities per work level and a fixed penalty toward the isotropic eight-parameter vector. The 39 fits used 423 reported function evaluations. Neither the complete author coefficients nor their mixed-program targets were used in the forecast. The published exponent trend was known during design. The lower bound, upper bound and midpoint-area candidate are also reported in the archived bank as diagnostics.

A synthetic circle and a disk clipped by |(12,5)·σ/13|≤15/16 agree at the two tensile axes and the equal-biaxial direction. Their radial factors along (4,3)/5 are 1 and 325/336. A separate unit-square yield surface with a convex nonassociated potential has positive work 7/20 for axial increment 1/2, violating the associated RD lower bound. These examples delimit what the available calibration can establish.

## Reproduction and custody

Run the first command with Python 3.12, NumPy 2.2.6 and SciPy 1.15.3. The second command uses the Python standard library. Both accept already-downloaded `biaxial.opj` and `uniaxial.opj` in the given directory.

```sh
python3 research/cai-dp590-terminal-work/replay.py --archives /tmp/dp590-originals
python3 research/cai-dp590-terminal-work/independent.py research/cai-dp590-terminal-work --archives /tmp/dp590-originals
```

Six source files were fixed at d9f38093 before decoding the mixed strain columns. All seven forecasts were then saved at e239c4e1 (19,054 bytes, SHA-256 7c5d6afc99905d3f50749917507b9e0fd6659740b2edee8b3a277a05e1dc1acd). Their bytes were read back before decoding any mixed stress. The producer’s 8,421-byte score has SHA-256 4beb7ce859aa181d28be419af39a4f19571aa667cd7509b42be8f70141ba616a. The independent worker fetched both original files, found the typed columns by separately matching their headers, and summed all 42,004 component increments with exact dyadic rational arithmetic. It reconstructed all 84 signed log residuals, 21 directional minima, and 16 gates. The largest difference across 185 numerical comparisons was 6.40×10⁻¹⁴.

The source ledger preserves both early acquisition failures. The first worker had a DNS failure before downloading the data. The next authenticated both input files, then its local liborigin build failed to link libstdc++. The successful metadata decoder used an isolated linker directory pointing to the installed runtime. The publisher's two bulk-ZIP routes returned 404; its versioned per-file routes supplied the authenticated inputs.
