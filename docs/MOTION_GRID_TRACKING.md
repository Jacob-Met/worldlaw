# Wider image search with explicit patch sampling

Motion Lab offers **Patch samples → 2 px spacing** beside the unchanged
**Every pixel** default. Choose an even point patch radius, then increase the
search radius if the local comparison budget permits it. The same setting applies
to each independently measured marker and pivot. A failed point still records a
gap and pauses the run.

## What changes in the maintained tracker

`src/motion/tracker.mjs` remains the owner of capture, actual image search,
normalization, texture/score/uniqueness gates, boundary refusal and optional
subpixel refinement. This is a deliberately different evidence profile: its
template samples every second source-pixel offset inside the original square
support. It does not shrink the image, move the patch anchor to a decimated raster,
or skip candidate locations. Every original integer candidate center is searched.

The radius must be divisible by the spacing. Thus the sampled lattice includes
the center and symmetric offsets on each axis. A radius 14 patch has 225 sampled
positions instead of 841 dense positions. Fractional manual capture and optional
refinement still use bilinear samples at the same original image coordinates.
Independent byte-feature oracles check both color and luminance capture/scoring.

| Appearance | Every pixel | 2 px spacing |
| --- | --- | --- |
| Brightness texture | `worldlaw.patch-ncc/v1` | `worldlaw.patch-grid-ncc/v1` |
| Brightness + color | `worldlaw.patch-color-ncc/v1` | `worldlaw.patch-color-grid-ncc/v1` |

`sampleStep` is 1 or 2 and must agree with the template version and dimensions.
Unsupported profiles, asymmetric support and conflicting provenance refuse.
Existing dense versions, default choices and score gates remain unchanged.
Flat saturated color and transparent hidden texture still cannot satisfy the
spatial texture requirement.

The 20,000,000 sampled-pixel-pair cap reserves one extra patch for potential
subpixel rescoring. Color uses exactly three features per pair; preprocessing is
separate and retains the existing bounded source/search regions. The browser
admits the combined cost of both tracked points before a run. Radius14 with
spacing 2 and search 128 costs at most 14,861,250 pairs for one point. Two such
points exceed the shared limit; search 96 costs at most 16,762,500 for both.
A native control admits exactly 20,000,000 integer-search pairs with refinement
disabled and refuses the same request with refinement enabled.

## Why the sampling choice is explicit

Skipped pixels can carry the difference that identifies an object. A retained
native counterexample inverts only unsampled pixels: the dense profile rejects
the changed patch (score about 0.147), while the sampled profile still accepts
the unchanged sampled center at score 1. Another counterexample supplies two
patches agreeing only on the sampled lattice; both score equally and the normal
ambiguity gate refuses either as an observation, even with requested margin 0.

A high sampled score therefore does not establish full-patch agreement or object
identity. The UI explains the skipped-detail tradeoff, and every captured/tracked
point records its actual version, spacing and other settings. Diagnostics show
the recorded profile. Raw notebook reopening and source reattachment restore the
latest measured appearance, spacing, radius and search radius. Changing controls
does not rewrite earlier rows; a new source defaults to dense brightness texture.

## Original-video investigation and negative result

The maintained source is
[Double-pendulum-metastable-mode.webm](https://commons.wikimedia.org/wiki/File:Double-pendulum-metastable-mode.webm),
by Frank Stollmeier and Manuel Schottdorf, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The unchanged original SHA-256 is
`fbec4761d153c6a5bf486e88ff333aef9cd32b64e1fc87488a594d22b18c9bad`.
Its manifest stays in `examples/motion-fixtures-15cc.json`; media is supplied
locally and is not bundled. Screenshots here adapt its pixels within the app and
retain the same source attribution and share-alike license for that media.

The preceding dense color run loses the selected marker at 0.20s under a 64px
last-point search: the inspected marker has moved beyond that neighborhood.
A last-two-point velocity seed was tried first. It recovered 0.20 and 0.24s but
accepted the wrong visible marker at 0.28s near (309.98,391.05), with score 0.8231
and margin 0.2071. The selected red marker was in the separately inspected region
near (216,342), outside that predicted neighborhood. Prediction-only search
steering was therefore not promoted.

The explicit spacing 2, radius 14, search 128 profile keeps last-observed-point
centering and measures the original eight frames 0.00–0.28s. Browser receiving
finds the selected visible region near (341,274) at 0.20s, (315.98,317.00) at 0.24s,
and(216.00,341.97) at 0.28s with the same 0.75 score /0.06 uniqueness gates.
The 0.04 and 0.08s original rasters contain the same pixels; their distinct media
times remain correctly recorded. The first anchor stays an explicit manual
observation; seven later observations retain the sampled color version.

This is a development-window association result. Those frames informed the
sampling experiment; it is not a blind evaluation. The inspected broad marker
regions are not independent center ground truth. The reference point is manually
declared. This does not qualify physical parameters, a moving camera, complete
clip tracking, occlusion recovery, deforming patterns or arbitrary lighting.

## Receiving

On current main 3a88ed83 plus the implementation:

- Full `npm run verify`: 603 tests, 602 passed, 0 failed, 1 inherited optional skip;
  both launched Motion/trajectory consumer smoke paths passed.
- Eight new native groups include independent sampled-feature and fractional
  coordinate oracles, large odd-coordinate displacement, explicit aliasing,
  duplicate ambiguity, source/texture/alpha/boundary refusal, version admission
  and the exact work-limit boundary. The prior 14 dense and 7 color groups pass.
- Five actual original-video browser groups retain dense loss, sampled eight-frame
  association, desktop/390px/keyboard diagnostics, completed raw download/reopen/
  matching-video reattachment and atomic budget/asymmetric-grid refusals.
- Eight actual paired-pivot browser groups with sampled color pass unchanged
  angular/pivot error limits, both independent loss directions, later re-anchor,
  raw paired evidence, source mismatch and nearby-time/downgrade refusal.
- Nine maintained full-pixel browser groups also pass: decoded timestamp/pixel agreement, real torque-studio import, correction/reopen, occlusion, blank-source refusal, rapid seeking and 320–1440px layouts.
- Lead inspected original-video desktop/narrow screenshots. The long existing
  control column remains a layout limitation; no broader Motion Lab redesign is
  claimed.

The real-video receipt and attributed screenshots are in
`docs/receipts/grid-tracking-e898/`. The source test media stays outside the
repository. Exact published and merged-tree receiving is recorded in the PR.

Run using existing local media and browser installation:

```sh
node --test tests/motion-grid-tracker.test.mjs
MOTION_GRID_VIDEO=/path/to/original.webm node scripts/motion-grid-browser.mjs
MOTION_SAMPLE_STEP=2 MOTION_APPEARANCE=color node scripts/motion-tracked-pivot-browser.mjs
```

The browser scripts accept the maintained `PLAYWRIGHT_MODULE`,
`BROWSER_EXECUTABLE_PATH`, `BROWSER_ARTIFACT_DIR` and paired-fixture
`MOTION_FIXTURE_DIR` overrides. Browser sandboxing remains enabled.

