# A boundary-free granular flow comparison stops at its input gate

Only one of six outer walls in a quasi-two-dimensional annular shear experiment supplied two radial stations with a measured mean stress ratio above the published yield threshold. The prospective comparison required three walls. We closed the comparison before extracting particle-speed ordinates. This is a limit on the support in the published stress figure. The velocity accuracy of the cooperative model remains unassessed by this study.

Fazelpour and Daniels drove the same rough inner wall and changed the shape or compliance of the stationary outer wall. They obtained tangential speed from particle tracking and stress from photoelastic contact forces. Both measurements are spatial averages. The authors averaged speed over 10,000 frames and stress over 2,000 frames, and omitted stresses close to either wall. The measurements pertain to steady flow. The leafspring series had also appeared in the earlier material-parameter study. The six walls are the experimental units. [Paper](https://doi.org/10.1039/D2SM00683A) · [Author manuscript](https://arxiv.org/abs/2205.11675) · [Dataset](https://doi.org/10.5061/dryad.866t1g1v8)

## Why absolute speed needs more information

Let r denote the actual radius, v the tangential grain speed, μ the shear stress divided by pressure, and g the granular fluidity. The reported signed shear component is (v′−v/r)/2. Adding Ωr to v changes neither this shear nor g for fixed μ. Recovering speed from shear therefore needs a measured particle speed or an independently justified slip condition. The imposed rotor speed supplies a boundary speed for the hardware. The authors used measured near-wall grain speed to anchor the integration. Their second-order cooperative fluidity equation additionally used experimentally determined fluidity boundary conditions. They already reported a qualitative association between outer-wall slip and excess optical fluctuations on these six walls. That association and the published wall ordering were known before this work.

On an interior annulus with positive pressure, a measured μ field, and the published material parameters, write the fluidity equation as

$$g'' + g'/r - g/\xi^2 = -g_{\rm loc}/\xi^2.$$

Every solution is a particular solution plus two homogeneous solutions. Integrating signed shear adds a third free coefficient, the rigid rotation Ω. A comparison of speed components orthogonal to these three contributions would remove the unmeasured boundary inputs. Equivalently, take an interior test function φ with φ, φ′ and φ″ zero at its endpoints, and let ψ = φ″ + φ′/r − φ/ξ². Substitution of g = r(v/r)′/(2μ) and integration by parts yield

$$-\int (v/r)\,[r^2\psi/(2\mu)]'\,dr + \int r\, g_{\rm loc}\,\phi/\xi^2\,dr=0.$$

These identities concern the reduced cooperative model on its measured stress domain. A speed comparison built this way would assess the interior shape allowed by the model. Regions below yield have zero local source. If all usable samples were below yield, the projected particular response would be identically zero. The admission criterion required observable above-yield support before opening any speed ordinates. The study stopped before fitting a model, projecting a speed vector, or comparing predictive errors.

## What Figure 3 supports

We froze the source and the admission rule before reading Figure 3 marker coordinates. Each of the six walls needed at least six matched radial locations. At least three walls each needed two nodes above μs = 0.25 after graphical uncertainty. The published nominal material parameters are μs = 0.25, b = 1.1 and A = 0.22.

| Outer wall | Matched pairs | Maximum mean τ/P | Nodes above 0.25 |
|---|---:|---:|---:|
| Long outies | 10 | 0.252390 | 1 |
| Smooth | 10 | 0.243761 | 0 |
| Long innies | 10 | 0.237822 | 0 |
| Short innies | 10 | 0.224691 | 0 |
| Short outies | 10 | 0.236120 | 0 |
| Leafspring | 10 | 0.286073 | 2 |

We granted all 60 pairs, including endpoint stations whose two rendered radial coordinates differ by a fraction of a thousandth of a particle diameter. The second-highest leafspring ratio was 0.25538. All five other walls had fewer than two qualifying nodes even at the nominal plotted centers. At the lower published threshold of 0.24, leafspring alone retained two qualifying stations. At 0.26, no wall retained two. A separate graphical sensitivity moving each shear and pressure center independently by ±0.25 PDF points left all six counts unchanged at 0.25. This positional perturbation describes figure reading only. The authors’ much larger stress error bars describe physical spatial and temporal variability.

Figure 3 contains an earlier pressure drawing covered by an opaque rectangle. The replay identifies the final visible panel frames in painter order and reads both caps of each vertical uncertainty bar. Their midpoint gives the plotted mean. Linear axes run from 0 to 14 particle diameters and from 0 to 350 Pa or 0 to 1,000 Pa. The six color assignments were checked against the displayed legend. All six pairs of radial grids matched one-to-one within 0.001 particle diameters. A second PDF parser independently recovered the 120 plotted channel means. The supply of above-yield points, rather than the total number of plotted locations, stopped this comparison. We make no inference about unmeasured near-wall stresses, instantaneous yielding, absolute slip or the validity of the authors’ boundary-conditioned fit.

## Source and replay

Run `python3 replay.py` with Poppler's `pdftocairo` on PATH. The script authenticates the 29,266,278-byte versioned author source archive and reads only its Figure 3 PDF member. An existing copy can be supplied with `python3 replay.py stress_boundaries.pdf`. Use `--out result.json` to save all 120 recovered means, matched radii and 60 ratios. The replay verifies the plotted coordinates and the frozen decision against `observed.json`.

The archive SHA-256 is `8a35f75d3241cb74befdddfd2a65e73eadbdc49efc8d06ea136b42679364bfe2`. The figure SHA-256 is `8534c98a6169053f8ede138034839f0597323997f2122f4918f3b14b0162a62a`. The Dryad manifest authenticated six MAT-file identities. Public README access returned HTTP 401 through the API, 403 on the advertised download page and 422 for the text preview. The analysis concerns the published graphical means. It decoded no MAT fields. Input-only source recovery also retained a DNS failure and a first parser refusal when its JSON serializer encountered a rectangle object. The corrected parser retained the same file, panels and admission criterion.
