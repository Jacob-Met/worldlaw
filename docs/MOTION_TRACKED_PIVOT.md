# Measure a visible pivot as well as a marker

Motion Lab can now follow a translating image reference. Open `/motion.html`,
load a local video, choose **Track its visible patch in each frame**, observe
the pivot, then observe the marker on that same frame. Both patches must have
distinctive visible texture. **Track** runs the maintained fixed-template NCC
matcher twice against the exact same decoded raster and timestamp. The original
fixed-image-point mode remains available.

The source canvas shows the tracked pivot in cyan and the marker separately.
The connecting line and angular chart use their measured difference. The
ledger and inspection display both statuses and independent match diagnostics.
If either patch is lost or ambiguous, the run pauses. An accepted observation
of the other point remains in the notebook, but there is no angular value for
that frame. A diagnostic candidate, initial calibration or last known point is
never substituted for an observed pivot.

To continue after a loss, seek a clear frame, use **Set pivot** and **Set marker**
to observe both points, then track again. A later successful run does not fill
earlier gaps. Correcting the same frame retains the previous pivot observation
in the edit history; retracking retains the replaced suffix as before.

## Interpretation

The angle is computed from the marker-minus-pivot vector with the existing
declared zero, sign and continuous-segment unwrapping. Common image translation
cancels. This is not camera-pose recovery: camera rotation, perspective,
out-of-plane motion, patch appearance changes and wrong-but-unique matches can
still bias the observation. Both points must refer to the intended planar
mechanism. No image score is a calibrated probability or physical uncertainty
certificate.

The point-error controls are caller assumptions in decoded pixels. For marker
standard error `s_m`, pivot standard error `s_p`, and observed separation `r`,
the reported first-order angular standard error is
`sqrt(s_m² + s_p²) / r`. This assumes independent, isotropic errors and a locally
linear approximation; correlated errors and large errors are not qualified by
that formula. A separation below two pixels remains missing evidence.

**Tracked-pivot measurements export as angular evidence.** The existing studio
torque conversion assumes fixed-pivot scalar dynamics. A physically translating
pivot can introduce additional inertial terms, so that conversion refuses
tracked-pivot input even when a caller supplies inertia. Image translation alone
does not establish whether the camera or apparatus moved. Export the angular
notebook for an explicitly appropriate downstream model instead.

## Portable source evidence

Fixed-pivot notebooks retain `worldlaw.motion-notebook/v1`. Selecting tracked
mode upgrades to `worldlaw.motion-notebook/v2`; the old reader refuses this
schema instead of silently treating all pivots as fixed. The new reader opens
both versions. An explicit switch back to fixed mode retains v2 if the notebook
has already been upgraded, keeping its pivot evidence and history portable.

Each row can retain `pivotMeasurement` with its own status, observed point,
diagnostic candidate, reason, quality and template anchor. The enclosing row
owns the source timestamp and frame index for both points; conflicting nested
clock declarations refuse. The displayed raster uses an exact timestamp match;
a nearby imported timestamp cannot lend its observation to that frame.
Existing fixed-pivot rows are never retroactively
given measured pivots when a mode changes. Missing pivot evidence leaves an
angular gap. Source hashes, reconnect checks and actual source measurements
survive export/reopen. Provenance remains a supplied declaration, not evidence
that a recording is independent or physically authentic.

The complete two-patch search is conservatively reserved against the UI's
20-million patch-sample budget before tracking. Source dimensions, total
measurements and portable JSON limits remain bounded by the maintained
measurement and tracker contracts.

## Reproduce receiving

Node 20+ runs the native tests and the ordinary application; graphical receiving
uses a separately installed Playwright package and Chrome, and fixture encoding
uses `ffmpeg` with VP9 support. The new browser receiver requests the Linux
Chromium sandbox rather than disabling it.

```sh
npm run verify
node scripts/generate-tracked-pivot-fixtures.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/google-chrome \
node scripts/motion-tracked-pivot-browser.mjs
```

The generator creates original authored synthetic movies with common
translation and changing angle, plus independent pivot-hidden and marker-hidden
variants. These are encoded image inputs, not mocked tracking results or filmed
physical mechanisms. The browser course checks the actual file chooser,
decoding, paired tracking, both occlusions, re-anchoring, source identity,
portable reopen, atomic schema refusal, angular export, keyboard correction and
1440/390-pixel layout. Outputs are under `.receipts/tracked-pivot-browser` and
include screenshots, original downloaded notebooks and an exact numerical
receipt. Do not treat these controlled results as general video accuracy.

The first received clean course measured 29 decoded frames: maximum pixel
error for the pivot was 0 on these integer-stamped lossless images, and maximum
angular difference from their authored pixel coordinates was
`5.551115123125783e-17` rad. Reusing a fixed origin on the same observations
produced a maximum `0.24391673640777323` rad error. These values describe this
specific synthetic control, not a physical accuracy claim. Exact published
source and fresh receiving evidence are recorded on the integration PR.

The original fixed-pivot browser receiver remains the regression course. The
maintained tracker is unchanged; its documented rotation and real-video
ambiguity counterexamples remain applicable to both patches.
