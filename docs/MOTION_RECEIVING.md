# Motion Lab independent receiving

This record keeps five claims separate: a pixel tracker works on controlled
frames; real encoded video is decoded and tracked; the actual browser workflow
receives it; the existing torque studio accepts derived observations; and a
physical model explains real observations. Passing an earlier claim does not
establish a later one. Arbitrary mechanism reconstruction, topology discovery,
unknown inertia, applied-force inference and physical-law validation remain open.

## Reproduce the controlled input

Requirements for the optional video receiving harness are Python 3 with Pillow,
FFmpeg, a separately installed Playwright module, and a Chromium-compatible
browser. The maintained application itself does not require these packages.

```sh
python3 scripts/generate-motion-fixtures-15cc.py --output .receipts/motion-fixtures
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
node scripts/motion-browser-15cc.mjs
```

`MOTION_FIXTURE_DIR` selects a different generated fixture directory.
`BROWSER_ARTIFACT_DIR` selects screenshots, downloads and the JSON receipt.
`WORLDLAW_RECEIVE_ROOT` lets this independent harness exercise another controlled
checkout, including its actual server and scientific modules. Set
`MOTION_RECORD_VIDEO=1` when Playwright's FFmpeg recording runtime is available.
The normal course selects an actual local `File`; it does not substitute a
canvas demo, intercept media decoding, or inject tracker observations.

The generator renders a 640 × 480 film at 30 frames/s for eight seconds. A
translated, asymmetric marker follows

\[
\theta(t)=0.60 e^{-0.08t}\cos(2.8t),\quad
x=320+230\sin\theta,\quad y=90+230\cos\theta.
\]

The pivot is (320, 90) in original source pixels. Angles are radians, time is
seconds, zero points downward in the image, and positive angles point toward
image right. Exact analytic angle, angular rate, acceleration-derived torque,
and marker coordinates are included in `truth.json`. The declared synthetic
inertia is 0.8 kg·m² and applied command is zero N·m. This is prescribed damped
harmonic motion, not a physical recording or the exact nonlinear pendulum law.
The implied scalar coefficients are −6.27712 N·m/rad for angle and
−0.128 N·m·s/rad for angular rate.

`clean`, `occluded`, and `blank` movies share the same dimensions and clock. The
occlusion removes visible mechanism pixels for frames 60–74 (2.0–2.5 seconds).
An optional `noise` movie adds repeatable independent ±7-channel noise. The
generator uses Pillow graphics and FFmpeg encoding, not generative images. A
fresh manifest records hashes of the actual encoded files; hashes can differ
across FFmpeg builds or container metadata even when rendered coordinates agree.

## Input provenance

`examples/motion-fixtures-15cc.json` maintains the synthetic recipe and the real
recording's creator attribution, source revision, media URL, license, and file
digest. The 15 MB original recording is deliberately not bundled in Git.

The real source is **Double-pendulum-metastable-mode.webm**, by **Frank Stollmeier
and Manuel Schottdorf**, uploaded as their own work and licensed **CC BY-SA 4.0**.
The creator's file description is the primary provenance record:

- [Source description and history](https://commons.wikimedia.org/wiki/File:Double-pendulum-metastable-mode.webm)
- [Inspected page revision 1211663781](https://commons.wikimedia.org/w/index.php?title=File:Double-pendulum-metastable-mode.webm&oldid=1211663781)
- [Original media](https://upload.wikimedia.org/wikipedia/commons/9/9c/Double-pendulum-metastable-mode.webm)
- [CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/)

Retrieved 2026-10-19: 15,764,266 bytes; SHA-256
`fbec4761d153c6a5bf486e88ff333aef9cd32b64e1fc87488a594d22b18c9bad`.
FFprobe reports VP9, 476 × 476, 25 frames/s, 182.6 seconds. Receiving uses the
first four seconds with audio removed and VP9 re-encoding at CRF18, with no crop,
retiming, stabilization, or synthesized frames. This excerpt is 275,792 bytes;
SHA-256 `552dac87ddb8ab171c951ae9cd8f3240937aa838436192260906b803f8247824`.
Any delivered excerpt or source-containing screenshot/recording retains the
attribution, source and license links, and identifies the transformation. The
adapted media remains under CC BY-SA 4.0; this does not claim relicensing of
unrelated application code.

The real recording is a **point-tracking inspection input**. A coupled double
pendulum does not meet the known constant scalar inertia assumption, and this
record provides no torque, inertia or exact trajectory ground truth. It is not
exported as validated scalar torque evidence.

## Recorded component findings

The independent receiving worker rendered the film, decoded its actual WebM
bytes with FFmpeg to RGBA, and applied the tracker from commit `06152a6`, using
the default patch radius 7 and search radius 24. The first point came from the
declared calibration; later accepted points came from the tracker. One explicit
manual re-anchor was supplied at frame 75 in the occlusion course.

| Input | Accepted tracked frames | Refused frames | Pixel RMS error | Largest pixel error |
|---|---:|---:|---:|---:|
| Clean analytic film | 239 / 239 | 0 | 0.268209 | 0.462281 |
| Occluded analytic film | 223 / 223 visible automated frames | All 15 blank interval frames | 0.230771 | 0.446364 |
| Blank film | 0 | Initial template is low-texture | Not applicable | Not applicable |

The occlusion test recorded **zero false accepted points** within the removed
interval. Rejected candidates remained diagnostic coordinates with a null
observation point. The browser product pauses on the first rejected match;
the full-frame component course continues examining the known blank interval
to measure all 15 failures. Those are intentionally different control flows.

The clean decoded coordinates produced angular RMS error **0.000606328 rad**
and maximum error **0.001702725 rad** against exact analytic truth. A deliberately
wrong but plausible pivot displaced 40 pixels to the right produced angular RMS
error **0.164455726 rad**. A finite in-bounds pivot cannot be authenticated from
its coordinates alone. Input validation rejects malformed calibration, while
physical calibration remains a supplied assumption with this retained failure.

## Derived-data fit is not torque truth

The independently measured clean trajectory was passed to the existing
`deriveTorqueObservations` and `splitTrajectoryEvidence` consumers with inertia
0.8 and assumed angle sigma 0.0012 rad. Each split uses disjoint raw source
windows and drops windows crossing the 70% raw-time cut.

| Local derivative window | True torque RMS error, N·m | Held-out error on derived rows, N·m | Fitted angle coefficient |
|---|---:|---:|---:|
| 7 samples | 0.077762 | 0.081654 | −6.23050 |
| 15 samples | 0.068585 | 0.010088 | −6.06910 |
| 31 samples | 0.277514 | 0.002050 | −5.47500 |

The true angle coefficient is −6.27712. The largest window gives the smallest
held-out regression residual while introducing the largest torque error and
coefficient bias in this comparison. Smoothing bias and correlated derived
errors explain why such residuals cannot establish physical-law recovery.
The supplied angle sigma is an assumption, not calibrated uncertainty.

The seven-sample split contains 162 training and 66 held-out rows, excludes six
crossing derivative windows, and uses raw indices 0–167 versus 168–239. Disjoint
source windows do not establish independent physical runs or new mechanisms.

## Real-video findings retained as limitations

The saturated white marker near (260, 132) in the first real frame has only
about 1.58 brightness standard deviation inside the default 15 × 15 patch.
Rejecting that template is correct. A 29 × 29 patch includes its boundary, but
the marker moves roughly 50 pixels between the first two frames. A bounded
search radius of 64 with the larger patch accepted 41 of 99 subsequent frames,
rejected 42 as lost and 16 as ambiguous in the independent full-frame course.
No exact marker ground truth is available, so accepted matches are inspected
measurements, not a proven 41-frame accuracy result. The source is not qualified
as a continuous successful track. Motion blur, rotation, local patch texture and
frame displacement remain real constraints; thresholds were not weakened.

## Browser acceptance status — independently received

The harness checks real video selection, decoded-frame timestamps, calibration,
truth comparison, existing-studio import, manual correction, notebook reopen,
source-hash mismatch refusal, occlusion pause/re-anchor, missing segments, blank
template refusal, and responsive layouts. It records screenshots, downloaded
evidence and observed metrics in `receipt.json`. A recording can be enabled
when the Playwright recording runtime is present. The repaired assembled product
passed all **ten browser receiving phases** in Chrome 155.0.8059.84 on 2026-10-19.
Every one of the 16 served application files was hashed before the course,
asserted unchanged after it, and independently compared byte-for-byte with
commit **`b7e28dbe26080636774ae4f810b91133e5004564`**, tree
`e7990daff1dbb54d71fe221e9f70097e4a7c408b`. All matched.

| Receiving boundary | Observed result |
|---|---|
| Actual WebM `File` → decoded pixels → tracked angles | 161 points, all using `decoded-media-time`; angular RMS error 0.000638061 rad, largest error 0.001593120 rad |
| Derived JSON → existing torque studio | 106 training rows and 43 held-out rows imported; real model-comparison chart rendered |
| Correction and reopening | Manual correction preserved; incompatible video digest refused; original media reconnected with identical measurements and calibration |
| Occlusion and continuation | Explicit null-point rejection pauses; manual re-anchor preserves two segments, 152 total ledger rows |
| Blank source | Low-texture marker initialization refused |
| Real recorded source | Video decoded; default saturated marker refused; larger patch paused at the first ambiguous match with a null observation point |
| Physical assumptions | New video and notebook reopening clear inertia, command, noise override and acknowledgement; evidence correction invalidates acknowledgement and old export status |
| Video clock and cancellation | 60 returned frames; twelve abort/recover sequences; zero nominal timestamp fallbacks; largest independent marker/time discrepancy 0.828633 pixels |
| Rapid interaction and built-in example | Rapid seeks settle on the newest requested video frame; the clear synthetic example tracks 120 frames plus its manual anchor with no rejected rows |
| Layout and runtime | No horizontal overflow at 320, 390, 768 or 1440 pixels; no JavaScript page errors |

The first course used reference commit `0193bef` plus uncommitted video,
measurement and server changes. Its inspection found the cross-source physics
acknowledgement problem. The second course checked the repair and retained
`source-manifest.json` plus `exact-source-association.json`: the manifest started
at reference `124ab33` with pending files, then the exact tested bytes were
confirmed in the clean pinned commit above. The record does not misattribute
uncommitted bytes to an older commit.

The second course retains `receipt.json`, `clock-probe.json`, source hashes,
input hashes, downloaded angular evidence and notebooks, screenshots, and
`motion-lab-browser-course.webm` (42.92 seconds, 5,519,325 bytes) plus a separate
`motion-studio-import.webm`. The optional real-source course requires the
documented excerpt SHA-256 and writes `real-media-attribution.json` alongside
its media-containing screenshots and recording. The fixture remains attributed
CC BY-SA 4.0; synthetic and real evidence are explicitly distinguished.

The actual browser's 161 timestamped angles, processed with the seven-sample
window, produced true-torque RMS error **0.049947 N·m** and largest error
**0.118601 N·m** against the declared synthetic truth. The selected fit was
`τ = −0.124·ω − 6.1929·θ`, with held-out error **0.046671 N·m** on derived rows.
Training used raw indices 0–111, held-out used 112–160, and six crossing windows
were excluded. These are pipeline measurements, not physical-model validation.

`node tests/motion-acceptance-15cc.test.mjs` separately passes eight independent
contract tests, covering source/session receiving, malformed calibration and
units, immutable correction and reopening, rejected/time/angular-step gaps,
explicit segment selection, required dynamics acknowledgement and command,
nominal-clock torque refusal, a plausible wrong-pivot counterexample, and the
smoothing-bias counterexample. Procedural-coordinate tests are kept separate
from the actual encoded-video and graphical receiving results above.

### Native video-clock investigation

A separate actual-Chrome test performed twelve fresh loads, four seeks per
load, and twelve seek → abort → seek sequences: 60 returned frames and twelve
confirmed cancellations. A color centroid of the synthetic yellow dot,
independent of the patch tracker, checked image coordinates against analytic
truth at the reported timestamp. The largest decoded-time pixel discrepancy
was 0.829 pixels; no timestamp/image mismatch was observed in that course.

A native callback observer saw 22 callbacks before the `seeked` event while
`video.seeking` was still true, among 61 callbacks including the UI's initial
source callback. These early callbacks already carried matching target-frame
evidence in this run. A separate deterministic event-order test identified a
possible stale-callback association bug. Both results must be retained: the
logic risk requires repair, while refusing every callback before `seeked`
would discard valid timestamps in this Chrome version. The repaired adapter
captures pixels inside the frame callback and checks an early callback's raster
against the completed seek. The final browser course retained 20 native
callbacks before `seeked`, with zero nominal fallbacks and the same 0.829-pixel
maximum discrepancy across sixty returned frames. The maintained browser
harness includes this independent marker-clock test; deterministic event-order
regressions separately verify stale-frame rejection.

No provider qualification, human acceptance, real scalar torque validation,
unknown topology discovery, or contest submission is claimed by this receiving.
