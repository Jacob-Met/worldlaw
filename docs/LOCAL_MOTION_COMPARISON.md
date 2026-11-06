# Compare local responses on the shared executed clock

This source increment composes the maintained competitive-motion executor with
`localMotionResponse` from the unchanged PR421 producer. It adds no numerical
integrator, derivative formula or model-selection algorithm. The producer's
original merge remains unresolved; this composition is not a claim of adoption
or launched-product qualification.

## Use an ordinary saved notebook

Save a session from the existing Discovery Studio, then run:

```sh
node scripts/local-motion-comparison.mjs --notebook notebook.json \
  --position 1.3 --rate 0.2 --inertia 1 --command 0 \
  --duration 0.1 --interval 0.01 --sample-index 5
```

Omit `--sample-index` for the complete executed and local-response courses.
Use `--history-index N` only for a maintained history entry containing its
original earlier experiment models. The index has the same meaning as the
Studio comparison's history-array index, not the serialized events-array index. History includes the initial state; it can therefore differ from the serialized event offset. An options-only entry or an absent
receipt refuses. Earlier coefficients are never looked up in the current fit by
model ID. These calculations are made now, not authenticated earlier forecasts.

The CLI uses maintained `restoreSession` to reconstruct models from bounded
UTF-8 notebook bytes and original events. It records the original byte SHA-256,
byte count, event count, current/historical selection and original law count.
It does not trust cached fitted models in an external report, mutate the
notebook, add evidence or revise ranking. Observation datasets are not saved
notebook envelopes and must enter through the existing import/save workflow.

Position is radians, rate radians/second, inertia kg·m² and fixed command N·m.
Duration defaults to 4 seconds and output interval to 0.01 seconds. Integer options
`--sample-index`, `--history-index` and `--max-trials` require decimal digits and a
safe integer; fractional or exponent notation is refused. The maximum trial
count defaults to 50000 and permits 1–100000. Physical declaration bounds match
the maintained Studio executor and are checked before notebook replay.

JSON is written to stdout. Exit0 means every law executed and its local course
was computed; that course can still contain explicitly nonsmooth or numerically
unresolved states. Exit2 preserves incomplete or refused laws in JSON. Exit1
reports malformed arguments/notebooks, invalid release declarations or an
unavailable exact sample on stderr, without a JSON success report.

## API and source binding

`compareLocalMotion(discovery, initial, settings={}, policy={})` snapshots the
ordered original candidate data before invoking `compareStudioDynamics` once.
For every completed original index it calls unchanged `localMotionResponse`
with that model and its own returned trajectory. IDs and equation labels are
not join keys. Duplicate labels therefore cannot attach another law's
coefficients or state. The owned output is recursively frozen.

The original motion result, whole-population work reservation, trajectories and
individual failures remain under `motion`. Parallel `results` retain every
original index/model and either a computed local course or an explicit response
refusal. A response refusal does not erase a completed motion trajectory.
`responseCounts` separately totals computed/refused laws, executed states,
available derivatives, nonsmooth states, numerically unresolved states and
stationary-equation observations. Nonsmooth states remain present, not silently
removed from the denominator. Existing motion admission bounds the complete
course to 20,000 returned samples; this wrapper does not borrow solver budgets or
reallocate work to surviving laws.

`sampleLocalMotionComparison(report,index)` selects the exact common returned
sample index. It refuses negative, fractional, out-of-range or entirely
unavailable grids. Every original law remains in the selected report; refused
laws have no invented state. The selected report carries execution declarations,
normalized inertia/command, solver work/counts and each computed response's own
model/inertia/command source. Its `responseCounts` describe the full course,
not just the selected instant. There is no interpolation, nearest-time match,
second clock or fresh integration during sample selection.

## Interpretation and receiving boundary

Angle/rate torque partials and frozen modes describe the declared executable
law at its own numerical state. They do not establish finite-time growth,
nonlinear stability, physical truth, calibrated uncertainty or a bound between
sampled times. Numerically unresolved and Coulomb-nonsmooth rows retain the
producer's exact statuses and reasons.

Source review and test authorship are separate from executed receiving. No
passing tests, launched application, installed-package qualification or browser
acceptance is asserted by this document. This first increment supplies an
ordinary Node consumer and reusable API; the existing browser clock/readout is
unchanged. Existing variational, stage-Jacobian, affine, stiffness and UI owners
retain their scopes.
