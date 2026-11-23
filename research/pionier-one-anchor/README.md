# Forecasting binary-star positions from one angular measurement

For three double-lined binaries, we used spectroscopy, a historical parallax and the first PIONIER position to predict two quantities at each later epoch: angular separation and signed displacement along the initial position vector. Marginalizing over inclinations passed all four registered comparisons on the 20 later published positions. A fixed positive perturbation of the parallax scale, registered as a sensitivity test, performed better on all four measures. These results describe three systems and their processed catalog positions. They do not establish a parallax correction or resolve the direction of the orbital motion on the sky.

| Predictor | Mean radial RMS | Worst radial RMS | Mean parallel RMS | Worst parallel RMS |
|---|---:|---:|---:|---:|
| edge_on | 0.681632 | 1.899085 | 1.111584 | 3.192359 |
| face_on | 3.695628 | 7.721091 | 4.964447 | 9.402262 |
| isotropic | 1.578444 | 3.160135 | 2.243582 | 4.148332 |
| marginal | 0.521631 | 0.918917 | 0.854353 | 1.487817 |
| parallax_minus_sigma | 0.940397 | 1.883717 | 1.499030 | 2.960038 |
| parallax_plus_sigma | 0.315873 | 0.489949 | 0.443117 | 0.630782 |
| physical_fit | 0.558770 | 0.988792 | 0.903812 | 1.642874 |
| stationary | 5.849645 | 11.724673 | 5.579709 | 10.535777 |

All entries are in milliarcseconds (mas). Each star contributes one RMS for each quantity. The mean gives the three systems equal weight. The primary marginal predictor had to improve all four aggregates versus each of five controls: stationary, face-on, edge-on, isotropic without distance information and the constrained physical fit. Both parallax-shift rows were registered diagnostics. A diagnostic is not an alternative winner of the registered comparison. HIP 14157 illustrates the limits of the aggregate result. Its constrained physical fit had lower parallel RMS than the marginal predictor (0.090829 versus 0.156066 mas).

## Source and input rights

Halbwachs et al. provide spectroscopy from HERMES (HIP 14157) or SOPHIE (HIP 20601 and 117186) combined with earlier radial velocities. Their separate spectroscopic-only solution supplies the observed period, orbital-clock origin, eccentricity, primary periastron angle and the components’ minimum semimajor axes. They use the systemic-velocity-corrected true period to derive minimum axes. We checked both axes’ sum against the two velocity amplitudes in the source units. The original single-star Hipparcos 2 parallaxes reproduced in their paper are 19.78±1.10, 15.20±1.35 and 6.94±0.57 mas. A separate reader checked all 54 published spectroscopic fields. The two direct CDS catalogue requests returned HTTP 404. The independent historical catalogue bytes and their three parallax entries remain unverified here. The source article explicitly identifies the values as single-star reductions that ignore the binary orbit. The later joint orbital parallax and the recalculated orbit-assisted Hipparcos parallax use different information and were excluded. [Article and author source](https://arxiv.org/abs/1510.07412) · [Hipparcos 2 catalogue description](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/311)

PIONIER provides one processed relative position per epoch. The chronological first observation supplied separation and position angle for each star. The remaining 9, 5 and 6 entire positions formed the held set. The first HIP 117186 position (MJD 56937.179, separation 2.28 mas) had appeared in a search excerpt before the study and is an anchor under the common rule. The authors had also reported the approximate edge-on orientation of HIP 14157. Four held positions used flux ratios fixed with information from other epochs. All three anchors had freely fitted flux ratios. Published error ellipses were scaled using a full visual-orbit fit; we used none of them as predictive weights or inputs. We used the timestamps as printed, adding 0.5 to convert MJD to the numerical origin of BJD−2400000. The exact barycentric light-time or time-scale conversion for each interferometric observation was not provided. Some spectra postdate some optical observations. This is an offline cross-instrument comparison.

## What one anchor determines

Let `(u,v)` be the normalized Kepler orbital-plane position after a rotation through the primary spectroscopic periastron angle. A rotation by another half-turn for the relative orbit cancels in the anchor-relative formulas. Let `a` be angular semimajor axis, `c=cos(i)`, and `A=a sin(i)`. Spectroscopy and external parallax supply `A`. For an anchor with radius `rho0`, the identity

```text
a² = (rho0² + A² v0²) / (u0² + v0²)
```

follows by projecting the orbit onto the sky. The physical plug-in solution requires `rho0² >= A² u0²`. For each future point, the radius and its signed projection along the anchor direction are invariant under a common reflection in that axis. The perpendicular coordinates have one unresolved global sign. The original diagnostic reports both whole-trajectory mirror RMS values for each system and arm. Selecting a different sign at each epoch would use more information than the model provides.

The `physical_fit` forecast is the same-information constrained least-squares version of the source's projected binary geometry, independently checked by a one-dimensional numerical solution. When the measured anchor undershoots the smallest model radius, the fit stays at the edge-on physical boundary and retains the anchor mismatch. For HIP 14157 the unconstrained cosine squared was −0.02515. The authors’ full 13-parameter combined solution fits the optical positions themselves and cannot serve as an unseen-position predictor. At fixed measured anchor radius, a log-uniform scale prior and isotropic orientations give a uniform prior for `|cos(i)|`. The marginal arm updates this prior with an approximate Gaussian likelihood for `A`. It averages the observable radius and signed projection separately. The two marginal source uncertainties of the minimum axes are added; the independent parallax term enters in quadrature. A full joint spectroscopic covariance and a calibrated single-star parallax error model were unavailable.

## Where prediction failed

| HIP | Held positions | Marginal radial RMS | Marginal parallel RMS |
|---|---:|---:|---:|
| 14157 | 9 | 0.077661 | 0.156066 |
| 20601 | 5 | 0.918917 | 1.487817 |
| 117186 | 6 | 0.568315 | 0.919174 |

The largest residual in each scored quantity occurred at HIP 20601, MJD 57006.187. The published 19.32 mas at 157.20° projects to +17.721632 mas along the 133.73° anchor. The marginal arm predicted 18.167296 and +15.862628 mas, respectively. Its signed residuals were −1.152704 and −1.859004 mas. This epoch's flux ratio was freely fitted. Across the 32 locked corners of the period, time, eccentricity, periastron and clock inputs, its predictions ranged from 18.15948 to 18.17508 mas radially and 15.78886 to 15.93698 mas along the anchor. Those perturbations share parameters across a given trajectory. They do not give a continuous or statistical error bound.

If parallax is withheld, the squared radius ratio is a fractional-linear function of `cos²(i)` on [0,1]. For a nonsingular anchor, the face-on and edge-on values are the endpoints of the full noiseless interval. Only 14 of 20 measured separations lay inside. The largest miss above that interval was 0.123220 mas for HIP 14157 at MJD 57049.045. Recorded positions, RV elements and timing are imperfect, so this count cannot identify which input or physical assumption caused a miss. The shifted-distance diagnostic substantially improves HIP 20601 but worsens the radial prediction for HIP 14157. No distance or model was changed after scoring.

## Reproduce

Run the following command in a clean checkout. Python 3.10 or newer and its standard library suffice. The command authenticates the 50,407-byte author source tar, rebuilds all nominal and discrete stress forecasts, scores all measured positions and executes a separate complex-plane receiver. The independent original acquired fresh source bytes on a separate worker and reproduced all 480 nominal and 3,840 stress components with a largest absolute difference of 1.67×10⁻¹² mas.

```sh
python3 research/pionier-one-anchor/replay.py --archive /tmp/halbwachs-1510.07412.tar
```

The first native forecast attempt stopped before producing a bank because the author stored a negative angle using a TeX minus sign. The isolated source repair decodes that spelling. The successful 109,981-byte bank was fixed in commit 28de32e188956ca504c6b396ebb067b962068beb before the later positions were read. The original failures, signed gate outcomes and fully evaluated alternatives are retained in `receipt.json`, `forecast.json`, `result.json` and `independent-receipt.json`.
