# A real selected-only virtual sensor path

Worldlaw's experiment Studio offers two genuinely different acquisition paths
for a successful, independently screened noise-aware release:

* **Acquire full virtual run** preserves the original full-grid 17–2001-row
  source recording. The ordinary integral/weak regression pipeline can
  refit its coefficients and compare the revision on the unchanged original
  challenge recording.
* **Measure selected readings** records only the post-initial sensor
  timestamps previously selected by the Gaussian intervention planner. The
  receiver ranks the *original frozen hypotheses*, without pretending to fit
  new coefficients from one to eight irregular observations. It preserves
  the actual sparse sensor output in the notebook, and refuses a second
  acquisition or a refit from that sparse record.

The distinction is material: for a 2 s experiment sampled at 0.04 s, the
full grid has 51 timestamps. When a valid prospectively chosen sample budget
is one, **one** noisy position is measured and serialized instead of fifty
post-initial noisy positions. The supplied initial angle and initial angular
rate are controlled initial conditions, *not* acquired sensor samples.

## Interfaces and source

`src/trajectory/virtual-experiment.mjs` exports
`acquireVirtualPendulumReadings(request,{existingRuns})` alongside the
unchanged `acquireVirtualPendulum`. The sparse request declares normal
release, seed and Gaussian position sigma plus a **strictly increasing set**
of 1–128 post-initial `sampleIndices` on the exact preexisting time grid.
The virtual apparatus always integrates the physical dynamics at every
intermediate RK4 step. It calls the position observation/noise generator
*only* at the selected indices. No unselected position is read, synthesized
as evidence, or retained in the sparse result. Its independently seeded
noise stream is explicitly tagged `selected_samples_box_muller_cosine_v1`.
The source includes the prescribed sensor sigma, observed sample count,
full integration grid size, ordered indices and source recording identity.
It contains synthetic apparatus truth for provenance; that metadata is never
allowed into model selection.

`src/trajectory/sparse-discrimination.mjs` exports:

* `receiveSparseReadings(plan,evidence)`: validate exact prospective
  time/index, fixed release, declared sensor noise, evidence budget and
  offered model predictions, then compute the pairwise Gaussian residual
  energy against **only the actually observed** selected positions. Return
  the maximum conditional-likelihood frozen model and normalized
  **equal-prior conditional weights** for all offered laws, with all the
  model-misspecification limitations stated.
* `runSparseExperiment(discovery,settings,{seed,existingRuns})`: perform
  the complete independent Gaussian intervention planning, all-model
  two-resolution RK4 qualification and refusal **before** invoking the
  selected-only sensor, then return the original plan, actual sensor receipt
  and conditional receiver result.
* `experiment-session.mjs::acquireSelectedReadings`: integrate the same
  guarded mechanism with the maintained Studio notebook, provenance and
  source replay. A changed seed, recorded position, index, source parameter,
  selected reading budget or cached plan can never silently become a
  new accepted acquisition after reopen. The evidence remains a distinct
  `experiment.sparse` receipt, *not* a training run.

This is still a **synthetic** apparatus, not a physical sensor connected
to any desktop, device, or laboratory. It saves sensor measurement operations
and stored observations, not the cost of simulating physical dynamics. The
source recording ID and reproducible pseudorandom seed are not cryptographic
authentication of the apparatus or proof of statistical independence across
different experiments.

## Mathematical receiver

For a fixed candidate model `m`, scheduled observed indices `S`,
measured angle `y_t` and a declared iid sensor noise sigma:

    RSS_m = sum_{t in S} ((y_t - theta_m(t)) / sigma)^2
    weight_m = exp(-0.5 * (RSS_m - min_j RSS_j))
    conditional_equal_prior_weight_m = weight_m / sum_j weight_j

The receiver never reads unobserved times or the source's oracle
coefficients. The sum is evaluated with a minimum-energy offset to avoid
underflow. The strongest available original model is a *conditional best
explanation among the offered set*, not necessarily the true physical
mechanism. In particular, a large conditional weight **does not** establish
calibrated posterior probability when the model library, time grid, noise
assumptions, initial state or integrator are imperfect.

The existing Gaussian intervention planner remains responsible for
prospectively selecting the release and timestamps; it cannot revise its
selected schedule after seeing any readings. For a model pair it certifies
minimum reading count exactly on the offered finite time grid. For larger
sets, heuristic failure is reported as `search_inconclusive` unless a
correct lower bound proves the budget impossible.

## Cold acceptance and falsification controls

* Exact zero-noise comparison to the original **full** simulator at four
  nonconsecutive timestamps, proving identical physical states and that the
  other 47 timestamps are not measured.
* Declared time-index, sigma, evidence-count, initial-state and
  seed-reuse/protocol tampering refused, before or during source replay.
* The same Gaussian numerical qualification gate continues to refuse
  unstable proposed readings, and the source recorder cannot be invoked
  for unqualified designs.
* One complete Studio session and exported portable notebook reopened
  twice with source-bound observation identities unchanged; raw training
  sample count and prior learned model unchanged.
* A fixed two-law physical-source comparison on 128 independent synthetic
  sensor noise seeds, with an *independent random-label negative control*.
  These are authored synthetic black-box checks, not external hardware
  benchmarks or genuine unseen-law recovery.
* Native Chrome viewport receiving: selected sensor positions plotted
  as **individual circles**, not an interpolated observed trajectory;
  source-bound model ranking visible at 1920 px desktop and 390 px mobile,
  with exported/reopened source evidence and no extra training samples.

Commands:

    node --test tests/trajectory-sparse-discrimination.test.mjs
    node --test tests/trajectory-sparse-session.test.mjs
    npm run verify
    TRAJECTORY_BROWSER_FOCUS=sparse PLAYWRIGHT_MODULE=playwright-core \
      BROWSER_EXECUTABLE_PATH=/path/to/chrome node scripts/trajectory-browser-92be.mjs

These controls are installed in the repository's PR/main CI. CI cold pixels,
serialized scientific data, exact code commit and running browser receipts
are retained as short-lived GitHub Actions artifacts rather than committed
bulk outputs.

## Remaining physical-law research problems

A selected sparse sensor observation **cannot yet be promoted to a
full-grid coefficient refit**, and the Studio intentionally prohibits that
transition. The field-practical extension is a native sparse-observation
parameter estimator with its own identifiability and numerical conditioning
tests; simply interpolating absent positions and claiming they were measured
would invalidate the whole evidence protocol. Other serious open constraints
are a genuine actuator/sensor gateway and cost model; correlated/time-varying
noise; model inadequacy/out-of-library laws; hidden states; adaptive
multi-run interventions; conservation laws and unknown PDE systems;
and held-out independent physical or simulated environments spanning
different dynamics.
