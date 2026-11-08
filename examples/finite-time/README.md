# WORLDLAW finite-time initial-state transition — isolated receiving

Run from repository root:

```bash
node scripts/inspect-finite-time.mjs examples/finite-time/authored-model.json examples/finite-time/authored-course.json > /tmp/worldlaw-finite-time-study.json
node --test tests/finite-time-variational-fd005364.test.mjs tests/finite-time-cli-fd005364.test.mjs
```

This reads original JSON input bytes, preserves their SHA-256 digests, and executes the same smooth angular model and sample clock as the maintained WORLDLAW rollout. It returns one state transition matrix per retained time. A matrix `[[a,b],[c,d]]` answers the local question: a sufficiently small declared starting perturbation `(delta angle, delta rate)` induces, in the linearized model, `(a*delta angle+b*delta rate,c*delta angle+d*delta rate)` at that time.

This is **not** a guaranteed nonlinear enclosure, evidence for actual physical mechanism, measured parameter uncertainty or physical torque/inertia identification. Models with Coulomb discontinuities refuse. Step work for both the original reference integration and tangent integration is budgeted before execution. All examples are authored synthetic data, not site/person observations.

Current work is an isolated private owner-review candidate; no existing UI, production service or model/provider credential is changed. The scientific receiving owner must separately qualify comparisons with real source data, uncertainty interpretations, step resolution, and any browser consumer.

