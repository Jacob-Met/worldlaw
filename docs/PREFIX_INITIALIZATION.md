# Frozen-law initialization from an original prefix

This experiment estimates two model initialization parameters from a declared original first-second prefix. It never changes shared coefficients or replaces the first observation. The complete prefix position residual includes the first row. Both coarse/refined position and rate screens must pass. All later values are scoring-only, and the full forecast continues from original time without a reset.

The fixed grid/local search bounds (position±0.1rad, rate±0.5rad/s) are computational parameter bounds, not calibrated sensor uncertainty. Nine grid points per axis and eight local sweeps are reserved completely before execution. Five previously frozen laws are evaluated in fixed order. The source-only session recomputes those laws from original training data and ignores saved results.

All three measured courses used here were already consumed by development. No independent validation is claimed. The third-course suffix results (fixed observed start → estimated model start) are:

- weak:0.04657553→0.06836565rad (worse)
- predictive selected:0.02361300→0.00765024rad
- maintained coordinate refinement:0.02285303→0.01624338rad
- position-only sensitivity:0.02342802→0.01135461rad
- joint position/rate:0.02357663→0.01145968rad

Several training-course results also worsen; result.json retains all15 comparisons. This supports initialization sensitivity, not identification of a physical sensor error or proof of the correct law. A conditional initial parameter can compensate for law error. The original first rate may derive from a different acquisition/filter definition; no calibration correction is inferred.

The public source-only session retains original incumbents if additional work refuses. The lower-level forecast receiver accepts only computed fits and requires the same normalized original identity/provenance and exact original prefix. It is not a saved-fit admission API.
