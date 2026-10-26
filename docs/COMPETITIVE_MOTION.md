# Compare competitive scalar laws as motion

In the ordinary Discovery Studio, **Compare competitive laws** executes every
current training-competitive scalar torque law under one declared release:
initial angle, initial angular rate, constant inertia, constant command,
duration and the maintained 20 ms output grid. The current inspected law does
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

The two compositions serve different questions. The shared joint makes
divergence under one release immediately visible; its angles wrap in the
schematic. The angle–rate view retains full rotations and the shape of the
executed trajectories. Neither composition invents observations or interpolates
a hidden physical trajectory between samples.

## Execution and evidence boundary

The comparison calls the maintained `executeStudioDynamics` for each original
law. Smooth models retain adaptive RK4 step doubling and its local estimates.
A nonzero sign-rate term retains the labelled fixed-step RK4 route without
local error control. The comparison does not duplicate fitting, select a law
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

Changing the evidence, discovery, inspected law or dynamics inputs retires the
derived comparison. Invalid dynamics cannot leave a successful old plot behind.
Comparison is explicit and does not create measurement events or change the
input-only notebook. Download/reopen replays the existing source evidence; run
the comparison again to derive paths from the current release controls.

All motion is conditional on the declared constant scalar inertia and command.
A path may leave the observed input range. Numerical agreement is not physical
validation, and disagreement is not calibrated uncertainty. Local error
estimates are not rigorous global bounds. The sampled 20 ms display can alias
fast motion even when the internal integrator refines its steps.

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
