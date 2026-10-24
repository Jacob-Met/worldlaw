# Check every pixel at the selected sampled-search candidate

Motion Lab offers **Patch samples → 2 px spacing + full candidate check**.
It retains the wider sampled search, then checks the complete original patch at
the selected candidate before accepting a position. The dense default and the
existing unchecked two-pixel profile remain available and retain their versions.

## What the additional evidence means

The maintained tracker first applies its existing sampled texture, score,
competing-match and search-boundary gates. If those gates would accept a
candidate, it uses the same scoring implementation with a separately captured
full-pixel template at that candidate's actual coordinates, including any
subpixel refinement. Full-patch texture and score must meet the same thresholds
as the sampled search. Failure records a gap with a null observed point; the
candidate remains diagnostic only. No alternative candidate is substituted.

This is a selected-candidate check. Other candidates are not rescored with full
patches, so it does not establish full-pixel uniqueness. A single exact visual
copy can pass both checks without being the intended physical object. Sparse
ambiguity or a boundary winner still refuses before confirmation. The UI explains
these limits beside the sampling choice and in measurement diagnostics.

Both luminance and color profiles are supported:

| Appearance | Confirmed profile |
| --- | --- |
| Brightness texture | `worldlaw.patch-grid-confirmed-ncc/v1` |
| Brightness + color | `worldlaw.patch-color-grid-confirmed-ncc/v1` |

The template retains `sampleStep: 2`, `confirmFullPixel: true` and a nested dense
`confirmationTemplate`. Validation binds its original support, source position,
raster, appearance and texture requirement to the sampled template. Every
tracked row retains its own version and separate confirmation status, score and
texture. An unevaluated check has null diagnostics. Older unchecked rows remain
unchecked when reopened or when the next-run control changes. A manually marked
anchor can precede confirmed tracked rows without being relabeled.

The same profile applies independently to a tracked marker and pivot. Either
failure preserves an angular gap. Notebook export/reopen restores the recorded
profile and requires normal matching-source reattachment.

## Bounded work

The existing 20,000,000 sample-pair cap includes one complete confirmation patch
in addition to the sampled search and its possible subpixel rescore. The browser
reserves the combined cost of both tracked points before starting a run. The
even-radius rule preserves a symmetric sampled lattice through the anchor.

With radius 14, a sampled patch has 225 positions and the full patch has 841.
Search radius 128 costs at most 14,862,091 pairs for one confirmed point. Two
points at search radius 96 cost 16,764,182 pairs. Two points at radius 128 exceed
the shared limit and refuse atomically. These are sample-pair bounds; color uses
three features per pair and preprocessing remains separate.

## Executed source evidence

The original source is
[Double-pendulum-metastable-mode.webm](https://commons.wikimedia.org/wiki/File:Double-pendulum-metastable-mode.webm),
by Frank Stollmeier and Manuel Schottdorf, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Its unchanged SHA-256 is
`fbec4761d153c6a5bf486e88ff333aef9cd32b64e1fc87488a594d22b18c9bad`.
The existing `examples/motion-fixtures-15cc.json` retains source metadata. Video
bytes are supplied locally and are not bundled in the product.

Sandboxed Chrome receiving retains the established dense-color loss at 0.20 s
with search radius 64. Explicit confirmed color, patch radius 14 and search
radius 128 retains all 40 source observations from 0.00 to 1.56 s: one manual
anchor and 39 tracked positions. The lowest full-pixel score is 0.904216, above
the unchanged 0.75 threshold; the sampled margin requirement remains 0.06.
Decoded media times remain recorded even where successive frames share pixels.

Those frames informed development. The separately inspected marker regions are
not independent center truth, and this result does not establish complete-clip
tracking or accuracy under occlusion, camera motion, deformation or arbitrary
lighting. Full-patch agreement supplies additional image evidence, not an object
identity certificate or physical parameter validation.

An authored lossless VP9 negative control changes only pixels omitted by the
sampled lattice. The unchecked sampled profile accepts it at score 1. The
confirmed profile refuses it with full-pixel score -0.453241, keeps its candidate
only as a diagnostic, and supplies no finite angular sample for that failed row.
The complete check therefore catches an actual decoded-pixel disagreement that
the wider sampled search alone cannot see.

The paired-pivot authored course also passed all eight receiving groups: both
independent loss directions, reanchoring after gaps, paired raw save/reopen,
source mismatch, nearby-time refusal, downgrade refusal and narrow inspection.
Its 29-frame maximum angular error is 0.000943 rad and maximum pivot error is
0.101205 px against that course's authored oracle; these are fixture results.

## Receiving and reproduction

The initial full source based on `65005bb1c3e422d2d14e90293c1e16746c801aea`
plus this implementation passed 637 native tests (636 passed, no failures, one
inherited optional skip), both launched product smokes, seven original-video/
alias browser groups, and the eight paired-pivot browser groups. Six new native
groups include an independent fractional-coordinate feature oracle, low-texture
confirmation refusal, aliasing, sparse ambiguity, exact budget admission and
template/source custody. Exact published/current-main receiving is recorded in
the pull request rather than treating this initial composition as current.

```sh
node --test tests/motion-confirmed-tracker.test.mjs
MOTION_GRID_VIDEO=/path/to/original.webm node scripts/motion-confirmed-browser.mjs
MOTION_SAMPLE_STEP=2 MOTION_APPEARANCE=color MOTION_FULL_CONFIRMATION=1 node scripts/motion-tracked-pivot-browser.mjs
```

The browser courses accept the maintained `PLAYWRIGHT_MODULE`,
`BROWSER_EXECUTABLE_PATH`, `BROWSER_ARTIFACT_DIR` and paired `MOTION_FIXTURE_DIR`
overrides. FFmpeg encodes the authored alias course. Browser sandboxing remains
enabled. Desktop and 390 px source overlays and the refused-alias view were
visually inspected; the established tall control column remains unchanged.
