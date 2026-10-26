# Compare competitive scalar laws as motion

In the ordinary Discovery Studio, **Compare competitive laws** executes every
current training-competitive scalar torque law under one declared release:
initial angle, initial angular rate, constant inertia, constant command,
duration and a common output grid, initially 20 ms. The current inspected law does
not replace the competitive ensemble or become a winner through this view.

## Use the apparatus

1. Import observations or keep the explicitly synthetic virtual instrument.
2. Set the release in **Let the model move**, then choose **Compare competitive
   laws**.
3. Use **Shared joint** to see the predicted mechanisms separate. Switch to
   **Angle–rate paths** to inspect full signed positions and rates without
   wrapping the angle.
4. Pause or scrub **Prediction time**. Every visible law uses the same sampled
   time. The legend names the original law and its current numerical angle. Select a
   legend button to highlight that law without removing any other path.
5. Open **Inspect all laws and sampled angle traces** for every original
   equation, numerical outcome and sampled angle path. A refused law remains
   in the table. An incomplete comparison is explicitly labelled.
6. **Return to inspected law** restores the existing single-law instrument.

### Inspect motion between coarse samples

**Sample interval** offers 20, 10, 5, 2.5, 1.25 and 0.625 ms. Changing it retires
the previous comparison; choose **Compare competitive laws** again to execute
every original law on the finer common grid. The actual interval and number of
samples are shown with the result. A finer choice never silently shortens the
duration, removes a competitor or raises the shared work limit. If the complete
request does not fit, every original law retains an explicit refusal.

Use **Playback** to select 1×, 0.25×, 0.05× or 0.01× speed. This changes only the
presentation clock, preserving the current instant and computed results. It
does not calculate additional states. Pause and use the prediction-time slider
or its arrow keys to inspect one exact returned sample at a time. Reduced-motion
preferences still start every new comparison paused. The initial 20 ms interval
and 1× speed are restored on page reload; presentation choices are not added to
the input-only notebook.

Sampling and playback solve different inspection problems. A spring law can
complete a whole oscillation between displayed samples. Finer samples can reveal
the intermediate states, but fast playback can still skip those states at the
screen's frame rate. Slow playback and deliberate scrubbing help inspect the
returned states. Neither establishes what happens between them. Two grids that
look alike do not certify that the motion is resolved.

The angle plot scales to its returned values. A complete comparison therefore
also states the maximum sampled angle difference and its sampled time, retaining
scientific notation for tiny differences. This readout distinguishes a large
physical-unit difference from a magnified small numerical drift; it is not a
continuous-time bound. Incomplete comparisons do not produce that whole-set
summary. Near-zero axis tick labels may round to zero at the plot's display
precision; sample values, tick positions and plotted paths remain unchanged.

The two compositions serve different questions. The shared joint makes
divergence under one release immediately visible; its angles wrap in the
schematic. The angle–rate view retains full rotations and the shape of the
executed trajectories. Neither composition invents observations or interpolates
a hidden physical trajectory between samples.

## Execution and evidence boundary

The comparison calls the maintained `executeStudioDynamics` for each original
law. Smooth models retain adaptive RK4 step doubling and its local estimates.
A nonzero sign-rate term retains the labelled fixed-step RK4 route without
local error control. For that route, the selected output interval is also the
integration step. Changing the grid therefore reruns the maintained executor
for every law; it never interpolates or downsamples a previous trajectory.
The comparison does not duplicate fitting, select a law
from its dynamics, alter coefficients or treat surviving numerical runs as a
smaller successful ensemble.

The complete requested set reserves at most 240,000 model evaluations and
20,000 returned samples. Each original candidate receives an equal evaluation
ceiling; unused shares are not borrowed. An adaptive trial reserves 12 derivative
evaluations, a fixed-step interval reserves four, and returned-sample torque
evaluations count as well. These are operation counts, not a wall-clock promise.
The complete grid must fit every original candidate's share before any law runs.
Numerical failures are retained individually, with no truncated path labelled
complete and no silent substitute solver. The numerical policy and its
whole-request reservation are implemented in
`src/science/studio-dynamics-comparison.mjs`.

Changing the evidence, discovery, inspected law, dynamics inputs or sample interval retires the
derived comparison. Invalid dynamics cannot leave a successful old plot behind.
Comparison is explicit and does not create measurement events or change the
input-only notebook. Download/reopen replays the existing source evidence; run
the comparison again to derive paths from the current release controls.

All motion is conditional on the declared constant scalar inertia and command.
A path may leave the observed input range. Numerical agreement is not physical
validation, and disagreement is not calibrated uncertainty. Local error
estimates are not rigorous global bounds. Any finite output grid can alias
fast motion even when the internal integrator refines its steps.

## Why the sampling control exists

An independently authored numerical countercourse compares valid 50/100 Hz
spring laws, with a separate 150/250 Hz course and a low-frequency control.
At the initial 20 ms grid, the first pair's sampled angles nearly coincide,
although their exact harmonic solutions differ by 2 rad at an intermediate
instant. The held-back pair defeats both 20 ms and 10 ms grids before finer
sampling reveals a large difference. Independent analytic solutions distinguish
this sampling failure from integration error. These are hypothetical scalar
models, not a claim that ordinary fitting produces two different coefficients
for one identical spring structure.

A separate source course exercises ordinary fitting. It supplies 512 authored
torque-reading rows with command numerically correlated with angle, independently
varying angular rate and a known linear torque response. Default fitting retains
two training-competitive one-term explanations: command and spring. Under zero
command and a released angle, their predicted motions differ, but a 50 Hz spring
returns to its starting position at every 20 ms output. A held-back 100 Hz source
also defeats 10 ms. These are synthetic receiving inputs, with no physical
acquisition or held-out measurement claim. The ambiguity is preserved; refined
motion does not determine which law is physically correct.

## Receiving course

The focused numerical course is:

```sh
node --test tests/studio-dynamics-comparison.test.mjs tests/studio-dynamics.test.mjs tests/torque-discovery.test.mjs
```

For the actual application, with a separately installed Playwright module and
Chromium-compatible browser:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/absolute/path/to/receipts \
node scripts/studio-comparison-browser.mjs
```

The sampling investigation and its ordinary fitted source can be reproduced with:

```sh
node experiments/studio-comparison-sampling-v2.mjs --out /absolute/path/to/analytic-sampling
node experiments/studio-fitted-sampling.mjs --out /absolute/path/to/fitted-sampling
```

With the same browser environment variables, run
`node scripts/studio-comparison-sampling-browser.mjs` for the ordinary-import
sampling and playback course. It checks the actual fitted command/spring paths,
finer grids, phase-preserving speed changes, keyboard scrubbing, retirement,
complete-set refusal and desktop/narrow rendering. Run it from the extracted
maintained package as well as the receiving source.

The browser course imports an independently authored small-angle source that
leaves competing scalar structures, executes the ordinary control, and checks
the actual rendered angle traces against separate calls to the incumbent
executor. It exercises both canvas compositions, moving playback, a still
paused frame, synchronized scrubbing, changed inputs, invalid inertia,
input-only download/reopen, a 390 px viewport, keyboard controls and reduced
motion. It requires observed active Chromium sandbox protections.

Run the same browser course from a freshly extracted maintained source package
to verify that the new modules are included and served. Exact source pins,
executed results, captured views and remaining limitations belong to the
integration receipt for issue #336. This document describes the contract and
reproduction commands; it does not assert an unrecorded test result.
