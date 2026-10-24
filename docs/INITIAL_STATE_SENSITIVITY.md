# Starting measurement sensitivity in Trajectory Challenge

The existing angular solver starts at one supplied angle and angular rate.
Weak-window discovery does not use the initial rate for fitting, so a poor
separate trajectory prediction can reflect that starting measurement as well
as a deficient law. The new instrument holds the learned law fixed and executes
a caller-declared grid of starting states using the maintained angular solver.

Load an angular bundle (including the measured PASCO example) in **Trajectory
Challenge**. Under the existing motion comparison, declare angle and rate
half-widths, then select **Compare declared starts**. The orange trajectories
come from those explicit starting states; the dark blue trace is the separate
recording. The model and training ranking are unchanged. Changing a width,
model or recording clears the old result. This is supplemental diagnosis within
the existing workbench, not a new fitting method or application.

Two alternative presentations were considered: a filled uncertainty ribbon and
explicit ghost trajectories. Ghost trajectories were chosen because a finite
three-point-per-axis grid does not justify a continuous envelope or a probability
interval. The instrument labels that distinction next to the actual paths.

## What is computed

For each nonzero half-width the offsets are `[-width, 0, width]`; a zero width
uses only `[0]`. This yields one, three or nine starts. Every start uses the same
model, timestamps and declared unforced scalar dynamics. Only the starting angle
and supplied rate enter prediction: later observed positions are replaced with
placeholders before calling `rolloutAngularWithResolution`. Receiving errors
are computed separately after every forecast is complete. Grid members stay in
their declaration order; no best initial state is selected or fitted.

Every path uses coarse and half-step RK4 predictions. The whole grid reserves
its exact combined integration work before any execution, with a default total
limit of 300,000 steps. A path is screened only if the existing resolution
comparison completes and its maximum angular difference is at most the declared
numerical tolerance (default 0.001 rad). All failures and step-sensitive paths
are retained. A sampled range is emitted only when every declared start is
screened: surviving variants cannot silently narrow the range.

The reported outside count excludes the initial measurement. It is descriptive,
not a statistical rejection threshold. Even a complete sampled range is neither
a guaranteed bound between grid points nor a confidence interval. The widths
are declarations; the software does not authenticate their measurement basis.
Two-resolution agreement does not prove convergence. The grid excludes model,
sensor timing and forcing uncertainty. Physical inertia and torque remain unknown.

## Reproduction and receiving

```sh
node tests/initial-state-sensitivity.test.mjs
node experiments/initial-state-sensitivity.mjs > sensitivity-pasco.json
npm run verify
```

Seven independent native controls cover the analytic oscillator, zero-width
nominal equivalence, future-observation invariance, incorrect supplied rate,
complete budget refusal, retained numerical failure and wrong-physics mismatch.
The existing launched studio and trajectory smoke paths remain part of verify.

`node scripts/initial-state-browser.mjs /absolute/repository /absolute/receipts`
uses an installed `google-chrome` (or `CHROME` path) with Node's built-in CDP
transport. It starts the actual product server, imports an analytic bundle,
executes by keyboard, downloads a receipt and recomputes it, tests stale-result
invalidation and invalid input, and captures 320/390/1440-pixel layouts.

**Export sensitivity inputs and results** saves the exact model, run, settings
and computed results. It is a diagnostic receipt, not a standard trajectory
notebook; reproduce it with `initialStateSensitivity(receipt.model, receipt.run,
receipt.options)`. The standard notebook remains unchanged and does not persist
these supplemental width controls.

## Retained physical counterexample

The existing PASCO data have already been inspected during model development.
The reproducible experiment uses weak fitting with unchanged default noise and
one training-selected model (`gravity+bias`). Its training residual remains
7.55235 noise units. For caller-declared ±0.001 rad and ±0.01 rad/s starting
widths, all nine paths pass the numerical screen; their challenge RMSE spans
approximately 0.31720–0.32876 rad versus 0.32297 rad nominal. 1,974 of 2,000 later
observations lie outside the sampled range. Thus this particular small grid
does not explain the known prediction failure. This is not a calibrated
physical exclusion of initial-state error, nor a new blind validation.

The instrument uses scoped spacing and responsive controls around the forecast
traces. Its chart resizes its SVG coordinate system to preserve text size on
narrow screens. The vertical axis shows angle in radians; the horizontal axis
shows elapsed seconds from this recording's first sample. Separate label rows
keep the minimum-angle and zero-time labels apart. The browser receiver verifies
that separation at 320, 390 and 1440 pixels.
