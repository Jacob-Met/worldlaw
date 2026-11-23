# M87 baseline averaging and station-coherence completion

The April 2017 M87 release does not supply the inputs needed to certify a missing complex visibility from positive semidefiniteness alone. The proposed held-baseline test ends at its input check. No complex visibility, precision weight, closure quantity or image was decoded or scored. The metadata counts below use whole archive bytes for authentication and baseline/date/integration/station fields for arithmetic.

## What the release contains

The collaboration supplies four observing dates and two bands. All eight files are HOPS network-calibrated Stokes I exports, averaged over a nominal 10 s and across 32 IFs. RR and LL duplicate Stokes I, with adjusted uncertainties. RL and LR are zero placeholders. The release README and inventory are authenticated separately from the UVFITS archive. The catalog redirected the source check to a human-verification page. The collaboration's public Git mirror supplied the complete pinned deposit. [Release](https://doi.org/10.25739/g85n-f134) · [Collaboration's files and README](https://github.com/eventhorizontelescope/2019-D01-01/tree/27ae76aacb9067a83388395c3826012b97aac371)

Paper III describes the earlier integration stages, redundant co-located baselines, and network calibration against the ALMA daily flux scale. A flux used in calibration is shared information. Its quoted systematic uncertainty and the reported scan-average residual nonclosing errors do not give hard per-integration bounds on an individual station power, phase history, or correlator weight. The deposited files do not include the preaveraged joint station samples or their powers. The total source flux and compact flux also depend on angular scale. [Calibration paper](https://research.chalmers.se/publication/509910/file/509910_Fulltext.pdf)

| Day | Band | UV groups | Complete four-station sets | Six equal durations | Spread >1 s | Maximum spread (s) |
|---|---|---:|---:|---:|---:|---:|
| 095 | hi | 6458 | 3547 | 2 | 2623 | 5.601846 |
| 095 | lo | 6453 | 3537 | 0 | 2577 | 6.971978 |
| 096 | hi | 9081 | 6820 | 3 | 5266 | 7.600000 |
| 096 | lo | 8645 | 6077 | 0 | 4362 | 9.535718 |
| 100 | hi | 2610 | 2670 | 0 | 2024 | 8.400000 |
| 100 | lo | 2367 | 2120 | 0 | 1613 | 9.200000 |
| 101 | hi | 8058 | 7188 | 2 | 5335 | 8.803136 |
| 101 | lo | 7447 | 6538 | 0 | 4615 | 8.800000 |

These 51,119 group records yield 38,497 four-station sets with all six baselines at exactly the same stored Julian date in one file. The sets overlap. 16,176 exclude both co-location pairs. Seven have six identical integration durations. None have all six at least 9.9 s. For 38,468 sets the spread exceeds 0.1 s and for 28,415 it exceeds 1 s. The largest spread is 9.535718 s on day 096, low band, for AP/AZ/LM/PV. The six recorded durations and exact Julian date for each file's worst case are in `metadata.json`. Flags and precision weights were kept sealed, so these are upper counts for a usable measured comparison.

## The conditional missing-entry disk

For a Hermitian station Gram matrix with known diagonal powers and positive-definite observed block K, the Schur complement restricts the missing entry z between stations i and j to a closed disk. Its center is hᵢO K⁻¹ hOj. Its squared radius is the product of the two nonnegative Schur-complement diagonal residuals. This disk is exact in the finite Gram-matrix class. Any physical sky satisfying additional Fourier and beam restrictions can yield a narrower set. Under station calibration H ↦ D H D*, the center and z acquire the same factor dᵢ conjugate(dⱼ); the radius acquires its modulus, provided the diagonal powers transform too. Fixing unit diagonals for a covariance reported in flux units requires an independently justified transformation.

If the true station powers have no upper bounds, any proposed missing complex edge passes the Gram-only existence check. Take the Hermitian off-diagonal matrix B including that proposal, then choose t at least the largest absolute off-diagonal row sum. The matrix tI+B is positive semidefinite. This argument concerns the Gram constraint alone and does not construct an astronomical sky.

## Two synthetic exact counterexamples

1. A point source has unit field amplitude and a station phase flip inside the integration bin. Combine one common slot with three pair-only slots so each cross pair has the same fractional overlap p. Pair normalization gives retained edges 1 and 1 and a held edge 2−1/p. With unit diagonals the determinant is −((1−p)/p)². At p=0.99 it is −1/9801. The underlying unnormalized weighted Gram remains positive semidefinite. A nominally short gap gives a small but nonzero failure of the exact certificate.
2. All stations are present in both equal slots. Their fields are (1,1), (1,1), (1,−1), and station weights are (1+e,1−e), (1−e,1+e), (1−e²,1−e²), with 0<e<1. All pair sums equal 2(1−e²). The normalized off-diagonal edges are 1, e and −e. A fabricated unit diagonal gives determinant −4e². After division by that same pair sum the true first two diagonals are (1+e²)/(1−e²) and the third is 1−e²; the raw rank-two Gram satisfies every principal-minor condition. Common positive pair weights and complete time support therefore cannot by themselves justify substituting a unit diagonal.

Both constructions concern possible within-bin phases and weighting. Neither assigns a phase flip, an invalid measured covariance, or a particular gain error to any telescope. A measured comparison would require a compatible station-level averaging law and powers, or bounds on departures that survive averaging at the observed scale. The proposed visibility forecast remains unscored.

## Reproduce

Run `python3 research/eht-m87-station-gram/replay.py` with Python 3 and access to the collaboration's pinned Git files. It reconstructs every duration count and worst witness from the authenticated archive, then verifies both synthetic examples with exact rational arithmetic. The archive SHA-256 is `f36f77fe4c0cf772625dcf424ed34ba3d1b5766475c64ed90319b0000f1ed463`.
