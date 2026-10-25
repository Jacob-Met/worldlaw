# Conditional recovery at a frozen readout population

UNKNOWN LAB's recovery instrument now includes **Bound readout-population changes when exact overlap is absent**. This optional inspection complements exact common-support selection. It retains every original observation and asks what recovery laws remain unexcluded at one explicitly chosen training population under declared sensitivity assumptions.

The original calculation and exact-support inspector remain unchanged. This option never changes a planner request, synthesizes observations, replaces the original notebook, or claims to calibrate a physical instrument.

## What the allowance means

Choose an original training recording as a reference **population of recorded states**, and declare nonnegative coordinate sensitivities L_command, L_position and L_rate for the preparation contrast. The hypothesis is that at each admitted delay t, its state-dependent response f_t obeys

`|f_t(x) - f_t(y)| <= sum_k L_k |x_k - y_k|`.

This is a declaration about the difference between preparation histories, not automatically a bound on the ordinary torque response or sensor noise. It must hold uniformly for the states and delays to which it is applied. A value of zero asserts independence from that coordinate; it is not an estimate obtained by leaving a field blank.

For each acquisition order separately, the original and reference recordings must have the same number of complete pairs, with at least four pairs in each order. Every pair needs exact equality of its two recorded state triples and recorded adjacent acquisition indices. Unsupported recordings remain unavailable. This increment does not round coordinates, discard pairs to fit counts, mix acquisition orders, or borrow the within-pair mismatch assumption of another inspector.

For a complete bijection pi between the current n states and the reference n states in one acquisition order, the change in their empirical mean response at the **same delay t** is no larger than

`(1/n) sum_i sum_k L_k |x_i,k - x_reference,pi(i),k|`.

The half-sum of the two acquisition-order costs bounds the change in the ordinary counterbalanced contrast. The reference recording's measured contrast at its own different delay is **not** the transported response. In a state-independent decaying-response control, every population allowance is zero while the observed contrast changes by more than 0.2 N·m between delays. The receiver explicitly retains this negative control.

## Source-bound computation

A bounded numerical assignment algorithm proposes a complete pairing for each order. Its optimum is not assumed or certified. The entire bijection is checked, then every coordinate difference, sensitivity product, sum and division is replayed over the original binary64 inputs using WORLDLAW's maintained exact rational arithmetic. The reported upper value is an outward binary64 enclosure of that exact source-replayed coupling cost. Thus numerical suboptimality may make an allowance unnecessarily wide; it cannot make that particular checked coupling's bound too small.

The inherited readout screening radius is added to the exact cost before outward rounding. The same maintained recovery fit and receiving calculations then use these conservative enlarged intervals. Original sampling errors still weight the illustrative representative coefficient; the larger intervals constrain its admissible range. No coefficient is fit from challenge outcomes. A training reference is mandatory, and no challenge coordinate, count or value can alter a previously computed training population, pairing or fit.

A missing challenge population is omitted from conditional scoring and retained as unavailable. It downgrades otherwise untested or compatible aggregate receiving to incomplete. A contradiction from another supported challenge is not hidden. Any unavailable training population leaves the entire conditional fit unavailable while preserving the full original result.

## Interpretation and observed controls

The displayed outcome is **not excluded by bounds**, never physical identification. The independent per-recording outer intervals do not exhibit a single jointly constructive response function through every original state and delay. They retain the original heuristic screening assumptions and do not establish calibrated coverage, authenticity, independence, causality, stationarity or true-coordinate accuracy.

The persistent state-response control from the exact-support work has full-course means 0.875, 0.125 and 0.5 N·m. With explicit rate sensitivity 1 and the first training population as reference, the checked allowances are exactly 0, 0.75 and 0.375 N·m. Persistence is no longer excluded, but several decay laws also survive. The method exposes confounding; it does not manufacture unique identification.

In the maintained authored continuous-coordinate recovery fixture, exact overlap is absent. With explicitly supplied sensitivities 0.01 on each coordinate, complete pairings produce approximately 0.00667, 0.00673 and 0.00621 N·m allowances for the other three recordings; the actual decaying-response control remains unexcluded. These values are conditional software demonstrations, not measurements or inferred physical bounds.

A separate joint-population counterexample uses states `(0,0),(1,1)` versus `(0,1),(1,0)`. Each coordinate marginal is identical, but the coordinatewise 1-Lipschitz response `abs(x-y)` changes in mean by 1. Independent coordinate sorting would incorrectly report zero; the complete joint-state coupling returns 1. Eighty deterministic independently generated SciPy assignments were replayed with Python Fraction and agree with the maintained JS candidate's exact costs. A positive subnormal product retains an outward upper bound of the smallest positive binary64 value rather than becoming zero.

## Actual consumer and replay

The optional panel lives beside the exact-support inspection in the existing recovery apparatus. An independent scatterplot would suggest unmeasured target-state observations; the selected experience instead shows the original mean, original screen, separately declared same-delay population allowance, and combined screen side by side. The unchanged recovery plot remains above. The model comparison preserves every offered law, and expandable per-recording receipts expose every original/target pair identity, state triple, order and exact mean-cost fraction.

Inputs are blank until explicitly declared, or populated through the clearly labeled authored control. Source or sensitivity changes clear old conclusions. A delayed file read cannot overwrite newer source or sensitivity intent. Failed imports preserve the accepted original case. **Save original case and assumptions** writes only the original recovery study, training reference and sensitivity declarations under `worldlaw.recovery-population-sensitivity/v1`; reopening recomputes all pairings and bounds. It does not serialize a trusted report.

## Receiving commands

```sh
node --test --test-isolation=none tests/recovery-transport.test.mjs tests/recovery-support.test.mjs tests/recovery-response.test.mjs tests/recovery-planner.test.mjs
BROWSER_SESSION_MODULE=/absolute/path/to/maintained/browser-session.mjs \
CHROME_BIN=/absolute/path/to/chrome node scripts/recovery-transport-browser.mjs
```

The browser course starts the real WORLDLAW product server and requires observed sandbox admission from the supplied maintained browser-session helper. It exercises blank-declaration refusal, keyboard expansion, continuous-state versus exact-support behavior, the zero-sensitivity temporal control, actual case import/download/reload, incomplete challenge refusal, invalid import preservation, delayed source replacement, and desktop/390px layouts. Local software receiving and source integration remain distinct from deployment or physical qualification.
