# WORLDLAW finite-time initial-state transition — isolated receiving

Run from repository root:

```bash
node scripts/inspect-finite-time.mjs examples/finite-time/authored-model.json examples/finite-time/authored-course.json > /tmp/worldlaw-finite-time-study.json
node --test tests/finite-time-variational-fd005364.test.mjs tests/finite-time-cli-fd005364.test.mjs
```

This reads original JSON input bytes, preserves their SHA-256 digests, and executes the same smooth angular model and sample clock as the maintained WORLDLAW rollout. It returns one state transition matrix per retained time. A matrix `[[a,b],[c,d]]` answers the local question: a sufficiently small declared starting perturbation `(delta angle, delta rate)` induces, in the linearized model, `(a*delta angle+b*delta rate,c*delta angle+d*delta rate)` at that time.

This is **not** a guaranteed nonlinear enclosure, evidence for actual physical mechanism, measured parameter uncertainty or physical torque/inertia identification. Models with Coulomb discontinuities refuse. Step work for both the original reference integration and tangent integration is budgeted before execution. All examples are authored synthetic data, not site/person observations.

Current work is an isolated private owner-review candidate; no existing UI, production service or model/provider credential is changed. The scientific receiving owner must separately qualify comparisons with real source data, uncertainty interpretations, step resolution, and any browser consumer.



## Use an original measured or authored angular bundle directly

The additional read-only bundle command applies WORLDLAW's **maintained training-only**
weak/integral model selection before computing the finite-time transition for the
chosen original challenge. It does not ask the user to export intermediate model
and run files.

```bash
node scripts/inspect-finite-time-bundle.mjs examples/physical-pasco-92be.json --method weak > /tmp/finite-time-pasco-study.json
```

The repository's historical PASCO example contains two prior measured training
recordings and one separate measured challenge recording. Its original bundle
file SHA-256, source label, chosen law and input kind remain visible. They are
not independently authenticated by this code, and the existing source has
been reused for exploratory studies: this is not fresh blind validation.
The path is local and read-only; the command does not upload recordings or
request tokens. With multiple challenge recordings, supply `--challenge-id ID`
explicitly; an unknown ID refuses without silently switching recordings.
Only bounded smooth laws can produce the transition.

