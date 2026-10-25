# Infer a fixed image reference from marker motion

Motion Lab can now acquire a marker before the user knows the image pivot.
Open the existing Motion Lab, choose a local video and mark one distinctive
visible texture. Track it with the maintained image matcher. The point ledger
and original source remain available while angular export stays unavailable.

Under **Infer a fixed reference from the marker path**, choose one continuous
course and declare its largest permitted time gap and radial discrepancy.
**Compare the observed path** compares a circle with a straight line. A supported
circular candidate appears directly on the original image; **Use this fixed
image reference** explicitly applies it to the existing angle/export pipeline.
The visible-pivot and separately tracked-pivot routes remain available.

## Maintained mechanism and original observations

The adapter consumes the unchanged MECHANISM path-classification module:
repository Jacob-Met/mechanism, source src/core.js, commit
0b93c8e828ed40a2bb795bbe8a2869d382f24590, Git blob
792f876916b5323510c2e8d7ce1f0a2377515afe. Its exact source is retained under
src/motion/vendor/mechanism-core.mjs, with a machine-readable source manifest.
MECHANISM remains its natural owner; this is a concrete second consumer, not a
new geometry fitter or shared platform.

The unchanged classifier fits three of every four accepted points and checks
the remaining points. Its declared defaults require at least eight source
points, 12 pixels of image spread, 0.65 radians of fitted arc coverage, adequate
fit/check discrepancy and separation from the line alternative. Motion Lab
additionally tests **every original point** against the caller's radial
discrepancy limit and requires the proposed center to lie inside the decoded
image. It applies the training-fitted center without refitting on check points.

A deterministic split of one recorded course is not an independently acquired
physical validation set. A circular image path can arise without the inferred
center being a physical revolute joint. Perspective, camera motion, nonrigid
motion, wrong-but-unique image matches, limited arcs and correlated pixel errors
remain limitations. This operation does not recover camera pose or depth.

## Custody and interpretation

Rejected rows and excessive source-time gaps split the course before fitting.
The investigator must choose a course explicitly when more than one exists.
The source points, timestamps, rejection states, supplied hash and existing
calibration are unchanged by comparison.

Any source, observation or calibration change invalidates an earlier proposal.
Applying a proposal recomputes the classifier from its original inputs; changing
a cached result cannot insert a forged pivot. Application records the original
source declaration, all contributing source observations and original indices,
fit/check membership, settings, method pin and accepted point in notebook
history. Angular and derived-torque exports carry this reference history.
Reopening preserves the evidence and accepted point; it does not silently
re-fit a new point or substitute media.

The accepted point has the same mathematical meaning as the existing explicitly
chosen fixed image reference. Angular noise propagation conditions on that point
as exact. It **does not include fitted-center uncertainty or its correlation with
the same marker observations**. The product states this beside application and
in angle diagnostics. Fixed camera, planar rigid motion, known inertia and
applied torque remain separate caller assumptions where relevant.

## Reproduce the actual consumer

Node 20+ runs the ordinary product and native checks. The original-source
browser course additionally needs FFmpeg, Playwright and sandbox-capable Chrome.

~~~sh
npm run verify
node scripts/generate-path-reference-fixtures.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/google-chrome \
node scripts/motion-path-reference-browser.mjs
~~~

The generator creates two distinct original circular pixel movies and a
straight-path movie, with independent authored coordinates. The browser uses
the actual maintained local HTTP server, file chooser, decoder, pixel matcher,
reference controls, keyboard application, downloads and source reattachment.
It never injects synthetic tracking results into application state.

Initial receiving on Linux / Node 22.23.4 and sandboxed Chrome retained 40
decoded observations for each circular movie. The inferred centers differed
from the authored centers by approximately 0.992 and 0.652 pixels; maximum
angular errors were 0.00807 and 0.00782 radians. The actual straight movie
produced no applicable circular reference and no angular export. These are
controlled synthetic-image results, not physical-mechanism accuracy.

Native checks cover twenty additional noisy arcs, a straight path, stationary
points, short arcs, a displaced check observation, noncircular motion, gaps,
off-image centers, source/calibration mutation, forged cached pivots and exact
upstream dependency identity. Actual desktop/390px captures and numerical
receipts accompany the integration. The older fixed and tracked-pivot browser
courses remain regression receivers.
