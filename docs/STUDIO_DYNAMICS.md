# Automatic refinement in the Studio dynamics instrument

The ordinary **Let the model move** instrument now refines internal integration
steps automatically for smooth learned torque laws. It still displays the
original 20 ms output grid and uses the declared initial angle, initial rate,
inertia and fixed command. Fitting, observation admission, ranking, notebook
history and the existing fixed-step public API are unchanged.

The purpose is numerical execution. A valid fast oscillator can lose its
amplitude or diverge under the old fixed 20 ms step. That numerical failure
does not falsify the physical hypothesis.

## Method and limits

The additive executor in src/science/studio-dynamics.mjs reuses
prepareTorquePredictor; it does not duplicate the feature library. One
classical RK4 step is compared with two half steps. For sufficiently smooth,
resolved dynamics, their difference divided by 15 estimates the local error
of the fine result. The accepted state is the two-half-step result.

Each coordinate has its own scale: absolute position tolerance 1e-10 rad,
absolute rate tolerance 1e-10 rad/s, plus relative tolerance 1e-8 times the
larger magnitude before/after the trial. The maximum of the two normalized
estimates must not exceed one. An accepted trial grows or shrinks the next
step with a bounded fifth-root controller; a rejected trial shrinks it.
A small final remainder forced by an output boundary does not reset the next
interval to that tiny step.

These estimates are **not** rigorous error enclosures, calibrated uncertainty,
a global error guarantee, a stiffness certificate or evidence of physical
correctness. An omitted force, bad measurement or wrong law remains wrong
even if integrated accurately. The 20 ms displayed samples can alias fast
motion; refined internal integration does not qualify continuous-time display
or energy quadrature between those samples.

At most 50,000 trials are allowed by the ordinary policy. One complete trial
uses 12 derivative evaluations. The optional direct API permits a smaller
budget, with an absolute maximum of 100,000 trials. Nonfinite/unbounded
intermediate trials can be retried at smaller steps, but exhausted work or
nonadvancing steps refuse the **entire** prediction. The UI then removes the
old plot, method label and animated prediction. A failed adaptive run never
silently substitutes a fixed-step result.

Nonzero Coulomb sign-rate terms retain the original fixed-step solver and are
explicitly labelled **no local error control**. This preserves the original
discontinuous hypothesis; it neither changes it into sticking friction nor
takes over the separate trajectory contact mechanism. Zero-valued Coulomb
terms do not require that fallback.

The existing conditional nonpositive-rate-power comparison uses the same
Studio policy for its alternative and names its method. It does not replace
the selected law. The ordinary trajectory and acquisition solvers remain with
their existing owners and interfaces.

## Reproduced baseline and accuracy

The independent analytic controls use position cos(omega × time), initial
position 1 rad, initial rate zero, unit inertia, torque −omega² × position,
2 s duration and the unchanged 20 ms displayed grid. They contain no physical
measurements and no fitted receiving values.

| Angular frequency (1/s) | Fixed-step position RMSE (rad) | Refined position RMSE (rad) | Complete refined trials |
| --- | ---: | ---: | ---: |
| 10 | 1.0577086e-4 | 2.2825263e-7 | 393 |
| 40 | 0.1034663 | 9.7718027e-7 | 1,213 |
| 100 | 0.6872845 | 2.4987275e-6 | 2,797 |
| 200 | Numerical state-bound refusal | 5.0355709e-6 | 5,502 |

This improvement costs more derivative evaluations than the inaccurate
100-step incumbent. It is an accuracy improvement, not a claim of lower
compute cost. Resolved low-frequency controls also retain a bounded overhead.

The native course additionally checks independent damped/forced analytic
solutions at changed inertias, initial states and nonmultiple durations; the
nonlinear tanh cubic solution; both directions of analytic quadratic drag;
a held-back frequency; exact fixed-step sign-law parity; source immutability;
invalid inputs; runaway/work/precision refusals; and stricter tolerance with
explicitly increased work.

The first low-frequency control exposed a controller defect: a tiny forced
output remainder seeded many unnecessary subsequent steps. That defect was
repaired rather than loosening the work check. A separate drag control showed
that local tolerance is not a global bound; the final ordinary scales above
were selected before the final receiving course.

## Receiving and reproduction

    node --test tests/studio-dynamics.test.mjs tests/torque-discovery.test.mjs
    npm run verify

    PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
    BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
    BROWSER_ARTIFACT_DIR=/absolute/path/to/receipts \
    node scripts/studio-dynamics-browser.mjs

The browser course launches the actual maintained server and requires an
observed active Chromium sandbox. It imports an independently authored torque
course through the normal file control, discovers its spring law, runs the
normal keyboard-triggered instrument and compares the actual rendered
polyline with an independently computed analytic line. It also receives
changed inertia, moving pixels, source-only save/reload/reopen, invalid
inertia retirement, the labelled sign-law route, the existing conditional
comparison, reduced motion and a 390 px layout. No external source transfer
is used. Screenshots are produced for actual desktop/narrow inspection.

Source base 9326de97e32730bbfb3c72ea9ce6b9f5b303f892 was obtained through an
authenticated archive, with all 1,182 blobs and the complete Git tree checked.
The candidate then composes the 17 exact published changes through
59e9c692cfc36fcdc8a4fd9ca6e54dc8e2f5e8ff, preserving concurrent position-noise
covariance work. Native and browser results, final source/tree pins and
post-merge receiving belong to the linked integration PR for issue #302.

Independent team review checked the step-doubling rule, dimensional scaling,
failure paths and substantive controls. It did not invent a separate runtime
pass. Final code/runtime verification remains explicitly recorded on the PR.

The final composed distribution exposed two newly tracked covariance source
dependencies missing from the maintained package allowlist. Integration adds
only experiments/position-covariance-oracle.py and
tests/fixtures/covariance-course.mjs; unrelated scripts, fixtures, secret-like
files, archives and traversal paths continue to refuse. The original failure
and fresh-package receiving are recorded on PR #304.
