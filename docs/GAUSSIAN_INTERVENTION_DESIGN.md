# Noise-aware prospective intervention design (Worldlaw)

**Scope:** opt-in analytical decision support for the maintained known-inertia
trajectory models, not a claim of discovered causal truth. A law is an *offered
training-derived hypothesis*. A proposed reading is a future, unobserved sensor
sample. This method never sees challenge observations, oracle coefficients, or
actual acquired sensor values.

## Why the old ranking was insufficient

The incumbent scores the RMS difference between whole model trajectories in
radians, silently treating each sampled time as equally informative. That can
waste a scarce read budget. In an authored four-time control, one candidate
pair differs by [2,2,2,2] rad (full-grid RMS 2 rad) while another differs by
[0,0,0,3] rad (RMS 1.5 rad). An RMS-only release decision favors the first.
With independent Gaussian position noise sigma=1 rad, target separation Z=2.5,
and **one** permitted future reading, the first is insufficient: its best
single-time Z=2, and it needs at least two readings. The second has a
one-reading verified witness: Z=3 at its last scheduled timestamp. This is an
authored design-control counterexample, not a physical or held-out model fit.

## Definition, proof boundary and receiving outputs

For offered models a and b, prospective times t and independent Gaussian
position noise of **known, fixed** standard deviation sigma, define

    w_ab(t) = (theta_a(t) - theta_b(t))^2 / sigma^2
    Z_ab(S) = sqrt(sum_{t in S} w_ab(t))
    Z_worst(S) = min_{a<b} Z_ab(S)

The planned readings S are distinct post-initial timestamps drawn only from
the existing finite integration/sampling grid. The planner searches for
Z_worst >= caller-declared targetZ subject to a caller-declared maximum
number of readings. For each candidate release it uses a bounded maximin
greedy selection, ranks releases with a verified distinguishing witness above
ones that cannot reach target, and favors lower reading count among successful
designs.

For **two models**, taking timestamps in decreasing w is exactly
minimum-cardinality on this finite grid. This is an elementary exchange
argument: no k-element subset can have more squared separation than the k
largest nonnegative weights. The implementation returns the exact certified
minimum only if the constructed witness reaches target.

For **three or more models**, the greedy schedule is not advertised as
globally optimal. Independently sorting each pair yields a valid lower bound
on the number of readings needed simultaneously for *all* model pairs.
The implementation certifies optimality only when the witness matches this
bound. It exposes both the bound and the actual selected count; otherwise
`certifiedMinimumReadings` is null. The exactness contract is for a fixed
discretized time grid, fixed offered hypotheses and stated noise model,
**not** a globally optimal physical intervention, posterior-optimal design,
adaptive sequential design, or unique symbolic/PDE discovery.

The result separates four distinct states:

- `distinguishable`: a concrete set of timestamps satisfies the declared
  worst-pair Z threshold within the reading budget.
- `budget_insufficient`: the pairwise cardinality lower bound **proves** the
  declared count is insufficient, even though more scheduled times could
  distinguish the offered laws.
- `search_inconclusive`: a bounded greedy search did not find a satisfying
  reading subset, but the lower bound does not rule out a different subset
  satisfying the target *within the very same budget*. For example, two
  complementary time samples distinguish three hypotheses where a greedy
  maximin first step chooses an attractive decoy and fails with its second.
- `threshold_unreachable_on_grid`: even all scheduled post-initial readings
  cannot meet the target under the declared noise.
- `observationally_equivalent_on_grid`: at least one offered pair has
  exactly equal predictions at all scheduled times. This does *not* establish
  physical equivalence outside this experiment or under other inputs.

The returned reading times are sorted chronologically and retain the original
time-sample indices. For two equally likely Gaussian hypotheses with exactly
known means and equal fixed variance, classification error is
Phi(-Z/2). This conditional relation is **not** a calibrated experimental
power or a warranty that either offered model is true.

## Existing controller + numerical screen

Opt in from the Studio experiment panel by declaring sensor position sigma,
pairwise Z target and reading budget; the legacy RMS path remains unchanged
when noise mode is off. The default Z target is 3.29 and the default reading
budget is up to eight post-initial timestamps. The virtual pendulum accepts
sigma in (0,.05] rad, so the experiment controller refuses an incompatible
noise plan before acquisition. A later acquisition of a noise-aware plan uses
the *same* declared sigma (and refuses a conflicting override). The seed,
full independent instrument run and existing evidence/replay rules remain
owned by the maintained experiment controller.

The independent numerical gate recomputes the full existing grid at the
original and half RK4 step, recalculates all Gaussian reading schedules and
pairwise Z scores, checks the retained plan against independently derived
scores, and refuses a selected release if its reading schedule/status changes
or its Z margin cannot dominate a rigorous **two-run sensitivity bound**.
The bound uses the maximum sampled per-model numerical discrepancy at the
two step sizes and triangle inequality; it is not a numerical error bound
on the underlying physical dynamics. Existing RMS numerical checks and
controller behavior are unchanged when noise is not declared.

The current virtual instrument **still records its entire scheduled run**.
Thus the reported reading budget is a prospective discrimination subset,
not a claim that the instrument or the downstream estimator already saves
sampling, bandwidth, compute or lab time. Physical sparse acquisition and a
sparse-evidence-compatible refitter remain a separate unsolved end-to-end
bottleneck. This capability does not directly address unobserved/latent
state, posterior uncertainty, correlated or heteroscedastic sensor noise,
multi-step decisions, arbitrary PDEs, or hypotheses missing from the learned
library.

## Locked falsification controls

`tests/trajectory-gaussian-discriminator.test.mjs` includes:

1. Independent exhaustive subset oracles over 250 deterministic two-law
   instances with 3–7 timestamps; every claimed exact minimum is compared
   with all nonempty subsets.
2. Another 100 three-law instances: every emitted cardinality certificate
   must match the independently enumerated global optimum.
3. The authored RMS-versus-single-reading counterexample above.
4. A three-law counterexample where greedy fails *despite* a feasible
   two-reading schedule; this must produce `search_inconclusive` rather than a
   false impossibility claim. Also identical predictions, insufficient count,
   finite-noise ceiling, immutable inputs, and full-grid work preflight/refusal.
5. The actual maintained trajectory planner and independent numerical gate,
   including negative control with a tampered cached power score.
6. A separately seeded, unobserved Gaussian measurement classification
   control plus an independent random-label negative control. The latter
   deliberately has no relationship to sensor truth.

These are reproducible **software and synthetic controls**, not independent
hardware validation or an external Nullgarden benchmark. They deliberately
keep the offered model hypotheses and reading-selection rule fixed before
the held-out labels are generated. They do not authorize post-hoc tuning on
held-out outcomes.

Reproduce:

    node --test tests/trajectory-gaussian-discriminator.test.mjs
    node --test tests/trajectory-planner-92be.test.mjs tests/trajectory-plan-qualification.test.mjs
    npm run verify

The repository's GitHub Actions PR/main workflow now runs `npm run verify`
on Node 22. An incomplete, unavailable or failing job must not be represented
as passing evidence.
