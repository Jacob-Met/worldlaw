# Executed scalar-model energy accounting

Historical native outcome: #208, hamon-8d076f-20261024/worldlaw. That historical candidate was based on main `222b821ccbec62ae77898c812a9e4f1a0eb00800`; this attribution does not identify the base or integration state of the current correction.

Open the existing Studio, expand **Run the dynamics**, and inspect **Where the predicted energy goes** below the trajectory. It recomputes when the inspected model or dynamics changes. Refused dynamics clear the previous accounting. The observations, ranking, executable law, solver and notebook format are unchanged.

## Mechanism

For the maintained torque library, split torque into angle-only terms, command-dependent terms and rate-dependent terms. Integrate the angle-only part analytically into a potential relative to the starting angle. Kinetic energy is Iω²/2. For spring coefficient s, gravity g, cubic c and bias b, potential is

`U(θ)−U(θ₀) = −s(θ²−θ₀²)/2 + g(cos θ−cos θ₀) − c(θ⁴−θ₀⁴)/4 − b(θ−θ₀)`.

Difference products and the cosine-difference identity reduce avoidable cancellation. Command power is `u(a + a_position θ)ω`; rate power is `d ω² + f |ω| + q |ω|³`. For a fixed command `u`, command work from the initial angle to each supplied state is evaluated from the exact displacement primitive:

`W_command(θ) = u (θ − θ₀) [a + a_position (θ + θ₀)/2]`.

This identity follows by integrating `u(a + a_position θ)` with respect to angle. It remains valid when the trajectory reverses direction: displacement backtracks through the same primitive. It does not require monotone angles. “Exact” describes the analytic integral of this model term; its floating-point evaluation still incurs rounding and can lose relative accuracy when the affine torque terms nearly cancel. It does require the same fixed command throughout the trajectory; varying command histories are unsupported. Rate work and positive-rate-work remain sampled trapezoidal quadratures over the supplied executed states. The residual is change in kinetic-plus-potential energy minus command work minus rate work. Positive-rate-work quadrature uses the positive part of net rate power at each sample; it does not sum positive coefficients independently.

This is model-relative accounting under declared inertia and fixed command. It does not measure physical energy, impose dissipativity during fitting, resolve sticking friction, certify between-sample behavior, or establish global passivity. Negative stiffness can release potential energy without an active rate term. Bias potential is local to the scalar unwrapped angle; this does not establish a globally single-valued potential on a closed rotational coordinate. Double-precision arithmetic and sampled solver/quadrature error remain explicit; refinement controls are evidence for those controls, not a numerical certificate.

## Fixed-command correction: recorded receiving

The correction was committed as `59c2119`, then composed with current main `4f77360` without conflicts. The resulting candidate is `b674ee553bc2b6195b3d75c45e01c48410e0d631`, tree `1cada0ea2fe3f5700df54fc1abddcc16f03fd013`. These are candidate integration receipts, not a claim that the correction has shipped on main.

The retained team lead executed the following native checks:

- Before composition with current main: full verification reported 1,529 passes, one skip and zero failures; Studio and Trajectory smoke checks passed. These full-suite results apply to the precomposition candidate.
- From a fresh extracted package of exact candidate `b674ee553bc2b6195b3d75c45e01c48410e0d631`: all 1,584 packaged files matched their manifest hashes, and the five changed files were verified. Seven policy tests, 33 focused tests, and Studio and Trajectory smoke checks passed.

The exact candidate package SHA256 is `2d4ed4fee0aec128913da7512afcde2c3e0d3a05844d92710d2dc99442182cff`. Package verification and smoke checks establish only the checks described above; the precomposition full-suite result is not represented as a full-suite run on the composed candidate.

Browser functional receiving passed on the exact `b674ee553bc2b6195b3d75c45e01c48410e0d631` package. The recorded browser run completed with exit code 0 on October 28, 2026, in 15.99 seconds, using Chromium `153.0.8010.47` and Playwright `1.55.0`. The sandbox helper admitted execution with SUID, PID namespace, network namespace, Seccomp and TSYNC protections active.

The receiver uploaded 79 authored observation rows, executed a negative command through the keyboard, and observed displayed command work of 0.13795 J. The independent analytic control gave 0.1379509648659341 J, within the stated 0.002 J tolerance; the former analytic time-trapezoid control gave −0.17637367918076927 J. Invalid inertia cleared stale accounting without changing the notebook. A saved notebook reopened in a fresh context at 390 px with the original 79 observation rows preserved exactly. The receiver reported zero page errors and zero external requests within its instrumentation.

Two earlier attempts stopped on launch-permission and dependency-layout failures. They remain environment setup failures, not product passes. The lead and an independent retained reviewer inspected the actual desktop and narrow screenshots. All six accounting rows, signed values and qualifications were readable; the sampled-state label wrapped cleanly without hiding its value. This is affected-panel visual receiving, not a new whole-product design review.

These checks qualify a correction to fixed-command model-work accounting. They do not establish improved solver accuracy, a global numerical error bound, physical energy measurements, or physical-law certification. Rate-work quadrature and the solver remain unchanged.

Receipts, the saved authored-source notebook, and the inspected screenshots are retained under [`docs/receipts/fixed-command-work-3e8effdbdffd`](receipts/fixed-command-work-3e8effdbdffd/receiving.json). The receiver is `node scripts/energy-command-work-browser.mjs` with `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and `BROWSER_ARTIFACT_DIR` pointing to the installed sandbox-capable test runtime and an output directory outside the product.

## Historical receiving

The receiving below belongs to the earlier candidate and preserves its original attribution and results. It is not receiving evidence for the fixed-command correction above.

Local Linux, Node v24.19.0; pinned Studio dependency closure and smoke assets were materialized from connector source and60 unchanged files checked against Git blob SHA1. No replacement source was treated as repository history.

Executed directly (to retain individual test names):

- `node tests/energy-budget.test.mjs`:6 pass. Independent analytic oscillator and driven acceleration; finite-difference gravity/cubic/bias potential identity; command-position work; antidamping versus conservative instability; maintained RK4 step refinement; invalid model/state/time/inertia refusal.
- `node tests/torque-discovery.test.mjs`:13 pass.
- `node tests/session.test.mjs`:7 pass, including imported fixtures and input-only replay. Initial execution identified two missing local fixture files; after fetching their pinned bytes, all7 passed.
- `node scripts/smoke.mjs`: launched maintained product assets, HTTP refusal and discovery→measurement→revision→reopen pass.
- `scripts/energy-budget-browser.mjs`:7 actual Chrome receiving groups pass, including1440px/390px layouts, keyboard Enter, reduced motion, stale-result clearing, source import of an authored antidamping law and fresh reopen. Screenshots were visually inspected; narrow numeric wrapping was repaired and received again.

Default existing virtual example: final energy change approximately−0.47336J, rate work approximately−0.47336J, command work0J, final residual6.3074e−7J, largest sampled residual1.4279e−5J. These describe the executed model, not a new physical experiment.

To reproduce browser receiving, start `npm start`, set `PLAYWRIGHT_MODULE` to an installed Playwright module and `CHROME_BIN` to a usable Chrome executable, then run `node scripts/energy-budget-browser.mjs`. `BASE_URL` defaults to `http://127.0.0.1:4193`; `ARTIFACT_DIR` defaults to `evidence/energy-budget`. The receiver creates its own browser context and only uses authored observations. Screenshots and logs are local receiving artifacts; this receipt does not claim a deployed release or whole-repository test execution.

The visual choice keeps accounting attached to the actual existing dynamics instrument instead of introducing a separate dashboard or simulator. A compact ledger suits the precise energy identity. A fuller time-linked energy view remains an unimplemented follow-on; the existing trajectory remains the primary animated apparatus.
