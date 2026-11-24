# Free-support state discovery

This optional path fits independently weighted atoms from noisy state recordings. It does not restrict a fit to a named two-coefficient law. The same public discovery endpoint can now fit scalar oscillators, two first-order kinetic channels, and scalar periodic fields with exact third- and fourth-order semidiscrete operators.

This branch has no new held-cohort discovery score yet. The previous continuous-input release and its negative discovery boundary remain in [CONTINUOUS_EXCITATION.md](CONTINUOUS_EXCITATION.md). Analytic component checks are not a substitute for the full 22-law and independent 20-law comparison.

## Public request

POST ordinary disjoint training and selection recordings to `/api/trajectory/operator-discovery`, with:

```json
{
  "options": {
    "method": "weak",
    "estimator": "free-stlsq",
    "grammar": {"basis": "extended-state"},
    "windowPoints": 33,
    "stride": 8,
    "thresholds": [0.025, 0.05, 0.1, 0.2],
    "ridges": [0.000001, 0.001, 0.1],
    "selectionScaling": "channel-noise"
  }
}
```

For `kind: "kinetic"`, each observed state and command is a two-element numeric array. Both state derivatives are fitted independently. There is no imposed q-prime-equals-v relation. The executable model uses the existing symbolic-evolution schema with `channel: 0` or `channel: 1` on each term. Oscillators retain their declared q-prime-equals-v geometry. Periodic records retain their complete spatial grid and spacing.

The old default beam and capped STLSQ paths remain available. The new `free-stlsq` path has no top-k support truncation: `maxTerms` does not constrain it. Its finite feature bank and explicit arithmetic budgets are the bounds. It may return an unlisted combination of terms or a rank-deficient predictive model. It does not look up a generating family or enforce paired coefficient ratios.

## Actual sparse solver contract

Each threshold/ridge pair begins from every nonzero feature column. Features and response are independently normalized to unit L2 norm without centering; a constant needs its own offered column. A positive ridge penalty is appended before the maintained column-normalized QR solve.

The solver deletes coefficients below the normalized threshold, refits the retained support and repeats until every retained coefficient on that exact refitted support meets the threshold. Supports decrease strictly, so cycles cannot occur. There is no final unpenalized refit that could invalidate the last threshold check. An unfinished deletion sequence is refused explicitly.

Zero response, all-zero library, threshold-empty support, rank failure, nonfinite arithmetic, exhausted work and iteration limits are distinct results. A refused solve is never replaced with an empty model. Positive ridge permits more features than equations, but rank is also measured on the unaugmented data. Ridge does not create observational identifiability.

For two kinetic response rows, each output has its own coefficients and support at one shared threshold/ridge pair. A complete joint free forecast on the separate selection recording chooses among those pairs. Selection never chooses a different hyperparameter menu for each output using the final test.

Default maximums are 256 offered features per output, 4,096 equations per output, 257 solves per row, and 50 million declared QR work units per candidate row. Work units are (equations + augmentation rows) times active-feature-count squared, with separate rank work charged. They are arithmetic accounting, not wall time or a kernel resource reservation. Observation, expression evaluation, forecast and API worker budgets remain separate.

## Geometry and atoms

The explicit extended-state basis contains 34 oscillator atoms, 31 kinetic atoms per output, and 27 periodic atoms. It includes polynomial products through degree three, trigonometric and saturating functions, exponential restoring atoms, input/state interactions, cross-channel rational terms, and conservative spatial fluxes. Public nonlinear atom scales such as exp(-2q), tanh(4v) and the denominator 0.25 + abs(x) are deliberate basis choices, not learned constants or blind family discovery.

The kinetic library includes both command channels and their state products. A recording with one identically zero command direction cannot identify that direction's gain. Independent profiles or an explicit restricted excitation subspace are required before claiming those coefficients were recovered. FitzHugh-Nagumo's first kinetic row requires five independent terms when its input coefficient is fitted; a four-term-per-output cap would exclude its true equation.

For periodic arrays, D1 is the centered first difference, D2 the centered Laplacian, D3 = D1 D2, and D4 = D2 squared. These are lattice operators with the recording's actual spacing. The adjoints satisfy D3-transpose = -D3 and D4-transpose = D4. Weak equations evaluate the complete nonlinear expression before applying the common linear observation filter and moving its outer spatial operator onto test weights. No continuum product rule substitutes for a discrete flux: D1(a cubed) need not equal 3 a squared D1(a).

The 129-sample producer requires an adequate weak-window schedule. Window 33 with stride 8 supplies 13 windows per recording. The previous window 61 / stride 15 supplies only five, below the 12-equation minimum even after combining two recordings. Overlapping windows remain statistically dependent.

## Selection and interpretation

`selectionScaling: "channel-noise"` estimates each channel's scale from the median absolute second difference on the separate selection recording, with a declared numerical floor of 1e-8. It scores complete free-rollout errors in those units. This is an estimated scale, not a calibrated likelihood or confidence level. The default raw scoring remains unchanged.

Forecast initialization consumes a declared noisy prefix. All later observed states enter scoring only; no forecast resets from later observations. Continuous experiments use the same serialized input at each integration stage and support a complete two-channel kinetic actuator profile.

A low forecast residual, stable winning support or a full-rank winning submatrix does not exclude a different compatible support. Named-law reconstruction needs coefficient signs and ratios as well as terms: Duffing and double-well share support. Toda and quadratic drag can be difficult to distinguish on a weakly informative trajectory despite different expressions. Any future structural admission rule must account for rival supports, freeze its tolerances before held scoring and keep ambiguous results in the denominator.

The enlarged D3 library exactly represents Nullgarden's old dispersion control. It remains outside that producer's named 20-law roster, but is no longer a missing-library mechanism. Delay, hidden-state and nonlocal controls require separate interpretation. The API continues to report `structuralIdentification: false`.

## Verification

```sh
node --test tests/free-weak-stlsq.test.mjs tests/extended-state-operators.test.mjs tests/kinetic-weak-http.test.mjs
npm run verify
```

The focused checks include coefficient units, more-than-four-term support, a coefficient crossing threshold after refit, explicit rank/work failures, both producer-grid adjoint identities, constant/Nyquist modes, an independent Fourier evolution, two distinct kinetic rates, prefix causality and an actual launched HTTP worker. Hosted qualification and the full prospective scientific course remain to be recorded.
