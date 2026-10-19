# WORLDLAW Trajectory Challenge

The challenge learns from complete training runs and predicts separate angular
recordings forward through time. It compares observed motion with an executable
model without resetting the simulated state to later observations. The first
release is an additive route beside the existing torque-discovery studio.

## Open the application

With Node.js 20 or newer, from the repository root:

```sh
node scripts/trajectory-server-92be.mjs
```

Open **http://127.0.0.1:4194/trajectory.html**. The original studio is served at
`/index.html` through its existing server implementation. No npm installation is
needed for these application routes. Ctrl+C stops the server. To select another
port, use `PORT=4200 node scripts/trajectory-server-92be.mjs` on macOS/Linux, or
`$env:PORT=4200; node scripts/trajectory-server-92be.mjs` in PowerShell.

The optional standalone build opens directly as an HTML file; its build and
source manifest are described in `TRAJECTORY_STANDALONE_92be.md`. It embeds the
same application and scientific modules, without requiring a local server.

## Use the challenge

1. Start with the driven-pendulum example or import a JSON bundle. The two
   supplied examples are explicitly synthetic observations from a separate
   fine-step numerical reference.
2. Fit the training runs using integral or derivative fitting. Only training
   evidence determines coefficients and model order.
3. Inspect the separate challenge run: the observed and predicted angles,
   residuals, initial-state schematic replay, and forward error metrics.
4. Select another candidate or challenge run without refitting. The candidate
   list preserves training-derived order even when an alternative predicts the
   challenge better.
5. Set an angle tolerance to see the first **sampled** exceedance and how many
   evaluated samples remain within it. The default 0.05 rad is a visible display
   choice, not a physical acceptance threshold or a continuous guarantee.
6. Export a portable notebook before changing devices or browser origins.
   Reopening recomputes models and trajectories from source evidence and settings;
   stored derived scores are not accepted as proof. Model/run selection and the
   displayed tolerance survive reopening.

Browser storage is a convenience. Imports and fitting run in the browser; no
provider upload or physical actuation occurs. A storage failure is shown, and
the current in-memory notebook can still be exported.

## Evidence contract

`src/trajectory/data.mjs` validates `worldlaw.trajectory-bundle/v1`:

```json
{
  "schema": "worldlaw.trajectory-bundle/v1",
  "label": "My separately acquired recordings",
  "units": {
    "time": "s", "position": "rad", "command": "N·m",
    "inertia": "kg·m²", "initialRate": "rad/s"
  },
  "trainingRuns": [],
  "challengeRuns": []
}
```

Each array must contain 1–4 runs. A run has a unique `id`, `label`, source `kind`
(`synthetic`, `measured`, or `unknown`), known positive constant `inertia`, supplied
`initialRate`, `samples`, and `source` metadata with a label. A sample contains
finite `time`, unwrapped angular `position`, and torque `command`. The complete
ready-to-import examples are in `examples/trajectory-pendulum-92be.json` and
`examples/trajectory-ambiguous-92be.json`.

Time must increase strictly; input is never silently reordered, interpolated,
unwrapped, converted from degrees, or assigned a zero starting rate. The command
at each sample is held until the next timestamp. Known inertia is essential for
an absolute torque-law claim. Missing inertia, initial velocity, actuation or
calibration must be resolved from evidence or represented by an explicitly
different model contract.

Limits: at least 17 samples in each training run, at least 2 in each challenge,
4096 per run, 8192 total, 300 seconds per run, and 3 MB JSON notebooks. Derivative
fitting also limits derived training rows to 4096. Source metadata is copied and
preserved. Source kinds and recording identities remain input-author claims.

The importer rejects repeated run IDs, shared declared recording IDs across
training/challenge, whole copied runs including representable clock shifts,
and matching contiguous raw windows of at least five samples across roles.
These checks prevent common accidental leakage; they do not authenticate
acquisition independence or detect every possible transformation of copied data.
Separating a trajectory into files does not make it a new apparatus or
statistically independent physical experiment.

## What the methods establish

Integral fitting targets accumulated angular displacement in **radians** and
avoids a second-derivative target. Derivative fitting uses the existing local
cubic telemetry adapter and targets net torque in **N·m**. Their noise fields
therefore have different units, and their raw fit scores are not comparable
across methods. Both search bounded subsets of the same declared basis library.

Numerical resolution runs the same forward problem at the requested maximum
step and at half that step within one combined budget. Its displayed RMS
prediction difference is separated from observation RMSE. A small difference is
not an accuracy bound; a finite trajectory is not proof of physical correctness.
If refinement cannot fit the budget, the coarse result remains usable and the
missing comparison is explicit.

The initialized first sample is excluded from error and tolerance statistics.
The first sampled breach does not locate an unobserved continuous crossing.
An inspected model may later return inside the tolerance after an earlier
breach; this does not imply uninterrupted agreement.

## Measured results on the supplied synthetic examples

On Node 24.19.0 with default settings, the driven-pendulum example selected
`command+rate+gravity+bias`. Across its two held-out recordings, aggregate angular
RMSE was 0.000656174818 rad with integral fitting and 0.059776935356 rad with derivative
fitting. These numbers are observations from these fixtures, not a general
performance guarantee or measured-apparatus validation.

In the small-angle example, the training-leading `rate+spring` model had
0.564395805012 rad challenge RMSE. At 0.05 rad display tolerance, 9 of 160 evaluated
samples lay within tolerance, and the first sampled breach occurred at 0.20 s
(preceding sample 0.16 s). The inspected sinusoidal alternative predicted the
challenge far better, but the application correctly retains the original
training ranking. Viewing and repeatedly tuning against that challenge is
exploratory reuse, not a fresh blind test.

The separate 24-case synthetic study favors integral forward prediction in all
24 cases but includes 23 selections with a spurious fourth term. Wrong initial
rate, coarse sampling, omitted physics and unknown inertia scale are retained
counterexamples. See `INTEGRAL_DISCOVERY.md`, `TRAJECTORY_FORWARD.md`, and
`TRAJECTORY_REVIEW-92be.md` for algorithms, receiving evidence and limitations.

## Reproduce and receive

```sh
npm test
node scripts/trajectory-smoke-92be.mjs
node experiments/integral-discovery-92be.mjs
node experiments/integral-stability-92be.mjs
```

The smoke command starts the real product server, fetches actual application
and example bytes, fits the input, executes forward predictions, reopens the
portable notebook, and checks relevant failure paths. Real browser receiving
uses `scripts/trajectory-browser-92be.mjs` with separately installed Playwright
and Chromium. Exact published revision, source tree, artifact hashes and browser
receipts belong in the PR/distribution record. No GitHub Actions runner is used.

## Source and ownership

The original studio/science producer is team `288492d6ffef`; this team's initial
working composition borrowed its unpublished candidate read-only. Team
`92be8b055703` owns the additive trajectory modules, route, matching scripts,
fixtures, tests and documentation. Team`15cc377ad586` independently owns Motion
Lab acquisition. Coordination and published heads are recorded in
[WORLDLAW issue 1](https://github.com/Jacob-Met/worldlaw/issues/1).

Full physical acquisition, unknown topology, general law discovery, transfer to
unseen apparatus and final human/product acceptance remain open. This increment
improves the runnable product without closing those research obligations.
