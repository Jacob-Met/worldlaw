# Predicting measured middle-load chord extensions in one DLR fatigue experiment

A load- and vertex-conditioned model missed its development gate. Its mean per-counter root-mean-square error was **2.349561 µm**, compared with **2.318404 µm** for carrying forward each material edge’s historical interpolation residual. It recovered part of a recurrent, localized displacement pattern while increasing error across ordinary edges. All 28 admission and 29 final middle-load displacement fields stayed unopened.

## What was measured

Strohmann and colleagues exported global 3D digital image correlation measurements of one AA2024-T3 specimen during fatigue loading. The archive contains 342 global node maps and 342 triangle tables with matching stage numbers. The inclusive stage range 7–803 has 797 possible positions, of which 455 are absent. Each of the 114 recorded cycle-counter values has exactly three stages, one each near 4.5, 9.75 and 15 kN, acquired in that order. The three measurements share a recorded counter. They cannot establish that the crack remained microscopically unchanged throughout acquisition. [Original dataset](https://doi.org/10.5281/zenodo.11945905) · [Experiment paper](https://doi.org/10.1038/s41598-024-63915-x)

For each native triangle edge, the target was the change in its three-dimensional length from unloaded reference to the measured middle-load frame. Low and high measurements were both available for interpolation. Shape estimates use the complete measured motion, including out-of-plane displacement. This study concerns the recorded DIC observable on one specimen. Every counter has three distinct loads, so these measurements do not provide repeat observations of a stationary state for an independent noise-floor estimate.

The node map prints facet indices starting at one. The triangle table uses zero-based vertex indices. The exporter’s VTK path skips missing triangles marked by a first vertex of −1. An initial reader failed on this distinction before scoring. The repaired reader retains an edge only when both material IDs match the first stage within 0.00001 mm in unloaded reference geometry, have finite displacements, and form an active edge in the first and all three current meshes. Seven counters spanning the chronology qualified 98.65–99.46% of 118,401 reference edges. The maximum observed coordinate drift for common IDs was 3.30 × 10⁻⁸ mm. Each arm used identical finite edge support in each counter. [DLR exporter source](https://github.com/dlr-wf/aramis-data-exporter/tree/5b72858b0b7663461979f6e94b0b3f6ae4ce40fb)

## Development comparison

The first 57 counters in acquisition order provided one initial historical calibration group and 56 subsequent expanding-history predictions. The scorer took the RMSE over common edges in each counter, then the arithmetic mean across counters. The 6,580,329 edge-counter observations share one physical specimen and overlapping meshes.

| Method | Mean group RMSE, µm | 95th percentile of group RMSE, µm |
| --- | ---: | ---: |
| Scalar interpolation of endpoint chord lengths | 2.449722 | 3.508140 |
| Interpolation of rigid-registered endpoint vectors, then chord norm | 2.402183 | 3.435999 |
| Global historical curvature | 2.402107 | 3.435996 |
| Historical effective load fraction | 2.403832 | 3.466763 |
| Historical residual on the same material edge | **2.318404** | **3.091818** |
| Spatially smoothed, orientation-matched historical curvature | 2.394801 | 3.424011 |
| Vector interpolation after replacing flagged endpoint displacements | 3.099859 | 5.103430 |
| Reported-value model with an unconditional edge correction | 2.348056 | 3.323070 |
| Reported-value model with an endpoint-conditioned edge correction | 2.349561 | 3.323905 |

The vector comparator removes a distinct geometric effect. Even a displacement vector affine in force can produce a nonlinear oblique chord length. Each endpoint undergoes a proper least-squares rigid fit to the same reference using common endpoint facets, followed by force interpolation and the norm. Individual chord lengths are invariant to these rigid fits.

The conditional model flags a vertex when its three-component displacement differs by more than 0.15 mm from the component-wise median of at least three finite active mesh neighbours. It replaces flagged endpoint displacements with their neighbourhood medians for an auxiliary interpolation. It then adds historical clean curvature smoothed on a 2-mm grid by axial orientation, and estimates the original reported chord contribution for that edge. The contribution is conditioned on the low/high flags of both vertices, using four pseudo-observations centred on the edge’s unconditional mean. The target always remains the original measured chord. Each forecast is locked before processing that counter’s middle field.

The registered development gate required at least a 5% mean-RMSE reduction against the strongest of the first six controls, no increase in the 95th-percentile group error, and at least 32 wins in the 56 paired comparisons with same-edge history. The conditional model increased mean error by 1.34%, raised the 95th percentile and won 27 comparisons. The development panel also informed the mechanism, so these numbers describe development performance.

## Where the error came from

The worst vector interpolation error was **570.285 µm** on edge 9979–9980 at stages 354, 355 and 356. The observed low, middle and high chord extensions were −4.119, +566.454 and −3.541 µm. Vector interpolation predicted −3.831 µm. An independent scan of the original ASCII rows verified both IDs, their full displacement vectors, immutable row hashes and active incident triangle numbers. Node 9980’s out-of-plane displacements were −0.013695, +0.822068 and −0.014577 mm. Its middle displacement relative to its active neighbours’ component medians was approximately (0.13185, 0.27803, 0.82569) mm. These readings establish a recorded isolated excursion. Its physical or optical cause remains undetermined.

On 54 training counters, node 9980’s two endpoint departures were below the 0.15-mm flag threshold. Its middle vertex exceeded the threshold in 13 of those counters and remained below it in 41. A classifier limited to that one quiet-endpoint category makes at least 13 mistakes on these 54 observations. Continuous endpoint fields can contain additional information. No independent-trial uncertainty interval or general predictability bound follows.

Relative to same-edge history, the conditional model reduced summed squared error by **630,814 µm²** on the 336 scored observations incident to node 9980. It added **113,367 µm²** on 26,080 other edges incident to vertices previously flagged in training, and **1,758,889 µm²** on the remaining 6,553,913 edge-counter observations. The three disjoint categories retain every scored observation. These are sums of squared errors. The headline gate weights per-counter RMSE equally.

## Partial source crosswalk to CrackMNIST

The separately authenticated 28-pixel L release has 5,104 training rows on each side of MT160_2024_LT_2. Each side contains 633 distinct recorded float32 force values. An exact comparison of the raw measured forces cast once to float32 matches **271** distinct values and 2,200 augmented rows per side. A stricter rule requires a unique raw stage and exactly eight augmented rows per released value. It retains **266** matches on each side. Of the 114 raw counters, 82 match all three loads, 10 match two, and 22 match none. The 12 preregistered early and late source anchors all miss, illustrating why these anchors could not substitute for the full roster.

This supports a partial acquisition crosswalk. A matching force cannot independently authenticate an individual crop or its coordinate transform. Tagged software 2.0.1 defaults to a raw input transform, offers optional per-image normalization, and contains no trained SIF regressor in the inspected release tree. Its stress-intensity labels are derived from displacement-field analysis. The replay reads only training experiment IDs, names and forces from the L release. [CrackMNIST dataset](https://doi.org/10.5281/zenodo.18454958) · [Tagged source](https://github.com/dlr-wf/crackmnist/tree/df3564821cad725e74d26fc19e332afe74b8627c)

## Replay

Supply the original `multiscale_digital_image_correlation.zip` from Zenodo record 11945905 and `crackmnist_28_L.h5` from record 18454958. Python 3.12, NumPy, SciPy and h5py are required.

```bash
python replay.py /path/to/multiscale_digital_image_correlation.zip /path/to/crackmnist_28_L.h5
```

The entry point verifies both archive sizes and published MD5s, repeats the 342-stage metadata census, checks the 266 doubly unique force matches and their stage identities separately on each side, and rereads all six raw rows of the worst edge. It refits earlier-history state, checks 56 × 9 per-counter RMSEs, verifies all three additive squared-error slices for every method and counter, and enforces the failed admission decision. The final 57 middle-displacement fields are outside the scientific replay.
