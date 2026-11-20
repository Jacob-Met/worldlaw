# Hidden-state experiment

Open the Hidden state lab from the main workbench, or visit /active.html.
This apparatus connects the existing exact active-family solver to a prospective
plan, a separate reading operation and a portable notebook.

## Run an experiment

1. Inspect the coupled-track source, error bound, competing forecasts and proposed
   reading ticks. The forecasts use a labeled illustrative start. The exact test
   permits independent arbitrary initial states for every candidate.
2. Freeze the plan. This saves its original source text and exact certificate
   before the lab admits a reading set.
3. Acquire a separately generated synthetic response, supply exact readings, or
   import a readout file already bound to the source and plan. Missing ticks stay
   missing. Each received set remains separate.
4. Inspect which candidates are conditionally consistent, falsified within the
   declared bound, or inconclusive. Multiple survivors and no survivors are
   meaningful results.
5. Export the notebook. Reopening it replays every scientific claim from the
   original source and reading text. Use a separate process to verify it:

~~~sh
npm run active:family -- --notebook worldlaw-active-experiment.json
~~~

The source, frozen plan, original readings and checked result can also be exported
individually. The existing CLI modes still accept their original files:

~~~sh
npm run active:family -- \
  --input worldlaw-active-source.json \
  --replay worldlaw-active-plan.json \
  --readings worldlaw-active-readings.json \
  --replay-readings worldlaw-active-result.json
~~~

Previously saved circuit-enumeration certificates retain their original digests,
work counters and outcomes. New designs use the current rank-complete search.
Opening a CLI plan first requires its exact source bytes as the accepted draft.

## What the apparatus establishes

For the unchanged coupled example, the selected velocity pulse and ticks 0, 1, 2
give the exact combination y[0] − 2y[1] + y[2]. The two candidates predict 1 and 2
for this combination regardless of their independent unknown starting states.
With error at most 1/100 per reading, the combination's error radius is 1/25 and
the exact per-reading separation distance is 1/4.

The attached synthetic mechanism uses its own closed response,
p[t] = 3 + g(−2t + max(0,t−1)). It does not obtain measured values from a candidate
forecast or invoke the planner to select an outcome. It is attached only to the
unchanged coupled source and certified pulse. Other source files require
independently supplied readings.

Only source declarations, finite offered controls and a declared error bound
are certified. A compatible candidate is not an identified physical law. Hashes
and replay do not authenticate hardware, actuation, calibration, planning time
or the physical origin of values. The display is approximate; rational
arithmetic determines the decision. Numerical display overflow refuses a plot
while leaving the exact record available.

## Custody and interaction

The browser uses a dedicated worker and commits a replacement only after full
replay succeeds. A newer accepted file takes precedence over an older delayed
read. Imported source and readout bytes must be valid UTF-8; the UI preserves
the text without silently stripping a BOM or changing whitespace. Every
notebook retains at most 16 separate reading sets, with a 512 KiB source or
reading limit and an 8 MiB notebook limit.

Each newly frozen notebook receives a separate local key. New drafts preserve
earlier notebooks and the other labs' storage. An unreadable earlier original
is retained. Local storage failures are visible and the current accepted state
remains exportable.

Autosave reuses the Studio's established original-text comparison. If another
tab has already changed the same notebook, the older tab pauses saving and
keeps its current state exportable. Reopen the stored notebook or import an
export as a separate notebook to continue saving. This detects completed
external changes; localStorage does not provide an atomic cross-tab lock.

All controls support keyboard input. Reduced-motion mode advances a single
discrete prediction step. The measured lane draws only supplied ticks; gaps are
not interpolated. Generic linear sources use output markers rather than a
claim about the physical shape of their mechanism.

## Composition and receiving

Two materially different compositions were rendered by sandboxed Chrome at
1920 and 390 pixels before the final choice: dark parallel mechanism rails and
a light time-output field. The rails were selected because they made the
competing mechanisms concrete alongside the unknown-state invariant. The
comparison exposed unreadably scaled SVG labels at narrow widths in both
studies. The application instead lays out the scene at its actual available
width, with fixed-size text and stacked controls.

The actual receiver is scripts/active-experiment-browser.mjs. It exercises the
live route, keyboard freeze, all three readout outcomes, original byte downloads,
independent CLI replay, exact decimal input, atomic rejection, delayed-file
precedence, reload and back navigation, 320–1920 pixel layouts, reduced motion,
historical plans, a five-state source, and storage failure. The existing Studio
receiver runs alongside it. Browser launch and preflight require the Chromium
sandbox; an unavailable renderer does not qualify as a visual pass.

~~~sh
PLAYWRIGHT_MODULE=playwright-core \
BROWSER_EXECUTABLE_PATH=/path/to/chrome \
node scripts/active-experiment-browser.mjs
~~~

This finite declared-family apparatus does not close the broader held-out
hidden-world research mandate.
