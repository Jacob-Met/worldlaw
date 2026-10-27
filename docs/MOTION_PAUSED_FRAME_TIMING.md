# Motion paused-frame timestamp receiving

## Behavior

Selecting the currently displayed local-video measurement and correcting its marker must preserve the decoded timestamp already supported by that unchanged paused frame. Previously, the repeated request could wait for the 1.8-second callback timeout and replace `decoded-media-time` with nominal `requested-seek-time`; Studio then correctly refused to derive acceleration from that clock.

`loadVideo().frameAt()` retains one completed exact sample privately. Reuse requires an unchanged, paused, non-seeking decoder with readable data and an exact match to either its canonical requested time or its reported media time. It returns independent pixels and preserves the decoded clock. It does not infer an interval from equal-looking frames. Seeking, playing, media reset, decoder error, an uncached request, or disposal retires the snapshot. Nominal fallback is never retained as exact evidence. Existing cancellation, range, concurrency, and end-time behavior remains in force.

The private pixel snapshot costs at most one additional 960 × 720 RGBA buffer (about 2.64 MiB). This changes timestamp custody during correction, not tracking, calibration, the differentiation method, or scientific admission rules.

## Reproduce through the application

Use Linux, Node.js 22 or newer (built-in WebSocket), an installed Chrome/Chromium accepted by the maintained namespace/seccomp sandbox check, and `ffmpeg` on `PATH` with lossless VP9 encoding. No Playwright or package installation is required for this receiver.

```sh
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chromium \
BROWSER_ARTIFACT_DIR=/absolute/path/to/receiving-output \
node scripts/motion-paused-frame-browser.mjs
```

The course generates a three-second, 20 Hz authored diagnostic clip, starts the maintained product server, and uses `/motion.html`: actual file input, pivot/marker controls, tracking, current-row reselection, desktop Enter-key correction, Studio export, saved notebook reopening, and original-file reattachment. It retains the encoded input, source blob identity, receipt, notebooks, exported observations, sandbox receipt, and desktop/390-pixel screenshots. An explicit artifact directory retains those results while the receiver removes its own temporary browser profile. Without that variable, the temporary directory is retained with its results.

`MOTION_FIXTURE` may reuse the retained `authored-input.webm` for an exact-input comparison. It is not an arbitrary-video acceptance test: the course requires the authored marker, dimensions, frame schedule, and duration.

Boundary checks separately exercise independent pixel/scalar copies, the exact decoded-time alias, a distinct nearby request, one-entry replacement, real external seeking, cancellation/concurrency/range guards, end clamping, and disposal. Callback delivery is deliberately withheld for the nominal-fallback control. The `seeking`, `play`, `emptied`, and `error` listener controls deliberately dispatch DOM events on a warm snapshot. These controlled conditions are identified in the receipt; they are not claims about naturally observed browser event schedules.

## Paired receiving evidence

The paired runs used the same source fixture SHA-256 `d5502d854a842aac6f8cc6645a132cd1c4651e3af4aaab797c91b7f8e2499a80` and frozen receiving course. Baseline `video.mjs` blob: `a3ace0df2be12a8fb846707a64f12815aa52d25d`; repaired blob: `07d1db01c035ac7c8b7f8024c2eb07f89884bd0a`.

| Observation | Baseline | Repaired |
|---|---|---|
| Tracked source rows | 26 | 26 |
| Initial Studio export | 12 fitting + 2 held-out | 12 fitting + 2 held-out |
| Paused-row reselection latency | 1,832.61 ms | 3.012 ms |
| Subsequent corrected sample at 2.5 s | Nominal clock | Decoded clock |
| Studio export after correction | Refused | 12 fitting + 2 held-out |

The timing measurement covers row reselection, before the subsequent correction. These are individual receiving observations, not a performance benchmark. Both runs passed the maintained Chromium sandbox admission. Save/reopen/reattach preserved the saved measurement rows. Desktop Enter correction passed; the 390-pixel course covers visual inspection and subsequent reopening/reattachment, not a separate narrow-keyboard or mobile-device claim.

Original Renpō execution: owner `node-72e09d180ec675855992b3cbfb59e9e8`, command `c8ff239e-motion-paired-repair-receiving-20261027`; paired artifacts are retained under `/home/ubuntu/hamon-work/estate-c8ff239e-20261027/timing-probe/paired-{baseline,candidate}`. The enclosing command exited 0 while retaining the expected baseline failure and repaired pass. A separate self-generated-fixture course, `c8ff239e-motion-final-boundary-v2-20261027`, passed all 12 checks and observed 4.828 ms reselection; it is not the paired timing sample.

An earlier hypothesis that identical pixels could authenticate a stale callback was not reproduced in the exercised browser courses. A valid target callback before `seeked` was observed and remains supported. An initial boundary assertion also incorrectly demanded nominal fallback for every nearby seek; the retained failed receipt was superseded by a native-decode assertion and an explicitly withheld-callback control. Neither result is presented as a new product failure.

## Claim limits

Authored diagnostic pixels and declared model inputs establish timestamp preservation and Studio export eligibility. They do not establish physical measurement accuracy, finite-angle matcher correctness, calibrated torque, or a validated physical law. Source, packaged-source, and merged-source receiving are separate results; the integration record names the exact package mode and checks actually run. See [distribution instructions](DISTRIBUTION.md) for building and receiving an extracted source package.
