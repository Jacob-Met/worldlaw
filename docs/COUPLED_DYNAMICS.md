# Conditional coupled motion

The Coupling Lab now executes its fitted response hypotheses as two-coordinate
motion, under additional assumptions explicitly supplied by the investigator.
Open `/coupling.html`, find **Let the laws move**, enter the inertias, damping
and initial state, declare the interpretation, and select **Compare the motion**.

The original diagonal interpretation below remains the default. An explicit
[constant symmetric inertia extension](COUPLED_INERTIA.md) also executes
cross-coordinate acceleration coupling in the same solver.

## What is executed

For each current fitted candidate, the maintained `predictCoupling` supplies
the two torque values. The dynamical hypothesis is:

```text
dq_i / dt = v_i
dv_i / dt = (predictedTorque_i(q) - damping_i * v_i) / inertia_i
```

Inertias are constant, positive and diagonal, in kg·m². Damping is independently
declared nonnegative viscous damping in N·m·s/rad. Position is in radians, angular
velocity in rad/s, and time in seconds. The fitted response must be interpreted
as a net position-dependent driving torque *before* that damping. A force needed
to hold an apparatus still may have the opposite sign and is not automatically
a driving-torque model.

**Quasi-static observations do not identify this dynamic equation, inertia,
damping, rate effects, constraints or physical topology.** The application does
not infer those assumptions, actuate hardware, or promote a finite simulation to
physical evidence. Supplied source/declaration text records the investigator's
assumptions; it does not authenticate them.

## Common-input comparison

Every estimable candidate receives the identical initial angles/rates, inertias,
damping and duration. All fitted candidates remain visible, including lower
training-ranked models. A model that already has substantial training mismatch
keeps that warning. Refused response fits remain listed without an invented
trajectory. No held-aside check value selects, tunes or resets the trajectories.

The first composition, **Coupled path**, plots angle 2 against angle 1 to expose
the relationship between the coordinates. **Angle traces** places their separate
time courses on aligned plots. Both are actual solver outputs; neither depicts
reconstructed bodies. The phase view is the default because coupling is the
question being investigated, while traces make timing and sign reversals easier
to inspect. Shared-time markers and explicit Play/Pause traverse retained output
samples. Reduced-motion mode retains the time slider and disables playback.

Changing evidence or numerical/physical inputs invalidates the old comparison.
Acquiring new response evidence requires the dynamic interpretation to be
declared again. The application does not leave the earlier forecast visible as
a result of the new inputs.

## Numerical contract and limits

The implementation uses classical fixed-step RK4 on the simultaneous
four-component state. It follows the scale-before-sum arithmetic convention in
the maintained scalar trajectory solver, while using the maintained coupled
predictor at every RK stage. Independently integrating each coordinate would
not preserve coupling at intermediate stages.

For every candidate, run one grid and a nested grid with twice as many
integration steps. The common output timestamps include exactly zero and the
declared duration. The maximum per-coordinate position and velocity differences
are compared separately with the declared tolerances. The result is:

- **Met both tolerances:** both sampled differences are within the declared
  thresholds.
- **Step-sensitive:** completed curves remain available, visibly dashed, along
  with their failed comparison. They are not relabeled as screened results.
- **Failed:** nonfinite or runaway states retain a reason, stage, time and last
  completed output; there is no completed refined trajectory.

Two-step agreement is not an error bound, convergence proof or physical
validation. Both resolutions can miss unresolved behavior. No automatic
stiffness detection or adaptive error estimation is claimed.

Before any candidate runs, the complete coarse/refined work for all candidates
is reserved against a 120,000-step budget. The module supports up to six model
identities, 2–1,001 output samples, duration at most 100 s and an executable
position/rate magnitude bound of 10⁶. A resource refusal does not silently omit
models or shorten the requested experiment. The UI normally uses 241 output
samples; imported valid sample counts are retained.

Observed coordinate ranges are carried from fitting. Every evaluated RK stage
and accepted step is checked against those ranges, without clamping. The first
evaluated outside-range state is retained. These checks are neither a continuous
trajectory containment guarantee nor evidence that the rectangular observation
range is fully supported by measurements.

## Portable inputs and isolation

**Save motion inputs** downloads `worldlaw.coupling-dynamics-notebook/v1`:

- The existing evidence notebook, including source, raw training/check rows,
  acquisition events and assumptions.
- `worldlaw.coupling-dynamics-input/v1` with the explicit interpretation,
  declaration, exact units, inertias, damping, initial state and numerical inputs.

No fitted coefficients, trajectory arrays or claimed pass flags are stored.
Unknown outer/input fields are refused. Reopen runs the maintained evidence
analysis and recomputes the comparison. Failed input imports retain the current
valid evidence. A delayed file read cannot replace newer source or form input.
Imported evidence never acquires a virtual instrument from its source label.

## Verification

```sh
node --test tests/coupling-dynamics.test.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-motion-receiving node scripts/coupling-dynamics-browser.mjs
node scripts/coupling-browser.mjs
npm run verify
```

The native course checks independent analytic oscillators, normal-mode coupling,
unequal inertia, nonzero-bias equilibrium, damped response, a directional
polynomial solution, step disagreement, runaway refusal, complete work budgets,
range departure, input nonmutation, held-aside isolation and input-only replay.
These are authored numerical controls, not measured apparatus validation.

The actual Chrome course receives declaration, changed inputs, invalid inertia,
acquisition invalidation, trusted keyboard activation, download/reopen,
held-aside changes, delayed files, explicit playback and reduced motion. Both
compositions are inspected at 1440 and 390 CSS pixels. The existing Coupling Lab
and scalar Studio acquisition course remains a separate regression.

The receiving evidence is kept in `docs/receipts/coupled-motion-20261024/`.
Screenshots were inspected, leading to shorter axis tick labels and stacked
comparison details at narrow widths so numerical/range outcomes remain readable.
No cloud/provider integration, physical validity or installed deployment is
asserted by this increment.
