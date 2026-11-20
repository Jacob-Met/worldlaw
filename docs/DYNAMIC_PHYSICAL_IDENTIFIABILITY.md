# Exact future-readout design under declared latent dynamics

WORLDLAW's static physical-identifiability compiler finds that the original MAGF-ID Conf2 five-gyro geometry has five independent source-declared observation equations for seven latent quantities (physical rate, DOT-shared disturbance, four private DOT errors, and MRU-P error). Two invisible gauge directions survive any same-state duplicate reading.

## New deterministic mechanism

For a **declared** time-invariant linear transition A and latent initial state x0, readout j at future tick t is y(j,t) = C(j) A^t x0 + known_affine_input + noise. Known forcing does not change row rank. A genuinely unknown stochastic innovation, unknown drifting sensor error, unverified dynamics, misaligned clocks or unresolved physical nuisance invalidates this finite-dimensional model. No trajectory is fit, no physical measurement is acquired, and no error covariance is calibrated.

The compiler expands every offered sensor/tick pair with exact rational BigInt covector propagation, then calls the existing exact structural rank/minimum-cardinality search and its nullspace-witness engine. The first priority is minimum count of future readings, with minimum declared integer cost among schedules with that count. It does *not* optimize total cost across unequal counts, and it does not establish which candidate law is true. Exhausted search never masquerades as a global optimum.

## Original-source geometry with a hypothetical transition

`examples/dynamic-gyro-identifiability.json` retains the five original sensor channel coefficient rows but assumes, **hypothetically**, the true physical rate multiplies by 1/2 per tick, the DOT-common disturbance by 1/3, and four private DOT and one MRU-P error remain fixed. This transition has **not** been measured or validated on MAGF-ID. Under these assumptions the initial rank 5 increases to 7 after two DOT readings at distinct future ticks (1 and 2); their differing decay combinations separate both latent gauge modes even without a future MRU-P reading. Both target functionals become conditionally observable. The prior stationary MRU-P does **not** independently calibrate its own private error. This is a source-only counterfactual, never a calibration success.

Changed-input and negative controls: identical transition leaves both gauges; physical-rate-only decay leaves the DOT-shared gauge; DOT-common-only decay leaves the rate/MRU-P gauge; arbitrary held-out outcome fields cannot change prospective design; mutated transitions invalidate exact replay; malformed fractional inputs and oversized search menus fail; and an independent dense-matrix oracle checks 25 transition pairs against the exact solver.

## Reproduce from a checkout

```sh
node --test tests/physical-identifiability.test.mjs tests/dynamic-physical-design.test.mjs
node scripts/physical-identifiability.mjs --input examples/dynamic-gyro-identifiability.json --output /workspace/dynamic-gyro-source-certificate.json
node scripts/physical-identifiability.mjs --input examples/dynamic-gyro-identifiability.json --replay /workspace/dynamic-gyro-source-certificate.json
```

The original static CLI route is unchanged. A useful future *physical* result requires a separately measured, independently referenced transition with synchronized excitation, source-disjoint validation and held-out recordings. The consumed Conf2 physical test already failed; it is not a fresh source of independent calibration evidence.

Background primary studies distinguish optimized input design from identifiable physical mechanisms: Bania & Wojcik, Entropy 27 (2025) 1041, DOI 10.3390/e27101041; Liu, Maini & Baker (2025), arXiv:2506.11311.
