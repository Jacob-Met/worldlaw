# Exact active-law discrimination under unknown initial conditions

Worldlaw can now design a **prospective unit-input experiment that proves which measurements could separate competing finite linear dynamical laws**, even when each law is allowed a different, completely unknown initial state. This is a source-only experiment compiler, not a sensor, data fit, actuator or discovery of the actual law.

## Why ordinary prediction-distance designs can be wrong

For declared hypothesis h:
- latent state: x(t+1) = A_h x(t) + B_h u(t)
- scalar reading: y_h(t) = C_h x(t)
- initial x_h(0) is unbounded and *unknown*, and may differ between hypotheses.

The input sequence u(t) must be frozen **before observing any outcomes**. At each offered time t, Worldlaw computes exact rational O_h(t)=C_h A_h^t and forced response f_h(t). For a selected sequence S, two hypotheses are indistinguishable for some allowed initial states iff

    f_j(S) - f_i(S) is in column_space([O_i(S), -O_j(S)]).

This is a stronger, physically meaningful test than checking whether the two laws' forecasts differ when arbitrarily initialized to zero. A proposed course is **certifiably structurally separating** if the exact augmented column rank grows. A left-nullspace dual vector w then has wᵀO_i = wᵀO_j = 0 and wᵀ(f_j-f_i) ≠ 0, so no choice of either initial state can explain the same noiseless readouts.

When each prospective reading has independent-or-correlated but **componentwise bounded** error |e(t)| ≤ ε (the errors need *not* be stochastic or independent), the same witness proves robust separation if

    |wᵀ(f_j-f_i)| / ||w||₁ > 2 ε.

This is a rigorous sufficient condition in declared scalar output units, not an optimal margin. If no searched left-nullspace basis witness passes it, Worldlaw says **not certified** rather than falsely proving impossibility under noise. Exact structural no-go certificates use the complete offered schedule and do prove impossibility within that model/menu.

## A falsifiable cold case

    node scripts/active-linear-family.mjs \
      --input examples/active-linear-family-decays.json \
      --output /workspace/active-decays-certificate.json

The hypothetical candidates are scalar decays A=1/2 versus A=1/3, each with a unit input gain and arbitrary unknown initial state. The input is a unit impulse followed by zeros. Ordinary future predictions differ if both states are set to zero, but with *unobserved* initial state, either model can fit two measurements. The exact controller finds **three readings** sufficient, including an initial-state anchoring observation at t=0, and a noise-bounded separating witness. It enumerates all smaller cardinalities and then minimizes declared integer cost among equal-cardinality choices.

    node scripts/active-linear-family.mjs \
      --input examples/active-linear-family-decays.json \
      --replay /workspace/active-decays-certificate.json

The replay checks the **exact original input byte digest** and recomputes the full rational certificate. A changed input, forged margin, or altered selected schedule fails closed.

## Independent controls and limits

    node --test tests/active-linear-family.test.mjs
    npm run verify

The unit tests independently compare 64 held-out law/input cases with a dense numerical augmented-rank oracle, verify a genuinely zero-input negative control, same-law equivalence, mutated inputs and certificates, a high-noise refusal, and an insufficient-budget outcome.

The exact finite enumeration accepts 2–5 named hypotheses, 1–5 latent variables per hypothesis, 1–4 input channels, 2–10 control ticks, at most 12 candidate reading ticks and up to eight selected measurements. Costs are positive integer declarations. The 50,000-node default hard ceiling cannot be waived into a claim of optimality. Rational input coefficients must be literal exact integers or fractions; there is no approximate decimal parser.

**What this does not establish:** a real experimental channel exists, input actuation is safe or achievable, a model's A/B/C is correct, noise is actually bounded by ε, or the world fits these linear laws. Actual physical qualification requires independently acquired source measurements, calibrated error bounds and a prospective unseen-source intervention. Evidence-level labels in the CLI are intentional; the source-only proof cannot be promoted to empirical causal identification.


## Joint active choice: change the physical input before choosing readings

The higher-order source schema **worldlaw.active-linear-interventions/v1** accepts a finite prospective intervention menu. Each item supplies a named, ordered control-vector sequence and a nonnegative declared action cost. Every model receives exactly that same control sequence, but retains its own independent unconstrained initial state. The optimizer compares pairwise law-separating rank under each control course and searches minimum observation times with exact dual witnesses. Ties among certified courses use action cost plus sensor reading cost. It neither reads outcomes nor performs actions.

Cold source-only example:

    npm run active:family -- --input examples/active-intervention-family-decays.json --output /workspace/active-intervention-source-certificate.json
    node scripts/active-linear-family.mjs --input examples/active-intervention-family-decays.json --replay /workspace/active-intervention-source-certificate.json
    node --test tests/active-intervention-family.test.mjs

The original and dynamic source-identifiability compilers address the row space of a single declared law. Joint intervention design instead separates **two independent unknown-state latent laws**. A no-actuation option is retained as a negative control: in the two-decay example its whole trajectory remains observationally ambiguous, while an early declared impulse permits an exact three-reading certificate. Later excitation is an independently priced alternative, not a strawman.

The optimum is explicitly finite: up to eight named interventions, each with up to ten control ticks, five-dimensional latent laws, up to twelve candidate readout ticks, and 50,000 exact search nodes per intervention. Each offered intervention is evaluated; exhaustion prevents globally certified optimality. Bounded noise uses sufficient canonical nullspace witnesses rather than an unsupported claim of maximum statistical power.

This is **not** an automated physical laboratory. Actual actuation requires source-bound hardware calibration, verified noise, actuator safety, and independent held-out real-world interventions. No certificate on the offered menu is never a proof that no different physical action could separate models.
