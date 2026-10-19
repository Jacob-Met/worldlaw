# Local video patch tracking contract

`src/motion/tracker.mjs` supplies browser-safe, dependency-free image measurements for Motion Lab. It searches a fixed user-selected image patch in each decoded frame. It does not discover a mechanism, identify an object semantically, infer invisible motion, or establish a physical law. Pixel tracking and downstream angular differentiation are distinct sources of error.

## Coordinates and inputs

A frame is `{width, height, data}`, where dimensions are positive integers and `data` is an RGBA `Uint8ClampedArray` or `Uint8Array` of exactly `width * height * 4` bytes. Width and height must remain identical after capture. There is no image rescaling inside the tracker. Pixel `(0, 0)` is the upper-left pixel center; x increases rightward and y downward. Fractional coordinates are permitted. The caller owns decoded timestamps and the conversion between original-video, decoded-image, and displayed-canvas coordinates.

Pixel intensity is `0.299 R + 0.587 G + 0.114 B`, composited onto black using alpha. These are intensity samples, not calibrated radiometry. Fractional sampling is bilinear. A patch must fit completely inside the image; the tracker never pads an image, clamps the measured center, or supplies a predicted point as an observation.

```js
import { createTemplate, trackTemplate, TRACKER_VERSION } from './tracker.mjs';

const initialization = createTemplate(firstFrame, clickedPoint, {
  patchRadius: 7, minTextureStd: 5,
});
if (initialization.status !== 'ready') {
  // Request a visible, textured patch fully inside the decoded frame.
} else {
  const measurement = trackTemplate(nextFrame, initialization.template, predictedPoint, {
    searchRadius: 24, minScore: 0.75, minMargin: 0.06,
    exclusionRadius: 3, subpixel: true,
  });
  if (measurement.status === 'accepted') {
    // Only measurement.point is accepted image evidence.
  } else {
    // Preserve an unmeasured sample; show reason and allow manual correction.
  }
}
```

`TRACKER_VERSION` is `worldlaw.patch-ncc/v1`. A ready template contains that version, capture dimensions and point, patch settings, intensity standard deviation, and immutable normalized sample values copied from the source. It is fixed throughout tracking. Manual correction may explicitly capture a new template; there is no hidden adaptation or automatic recovery across occlusion. Template values are implementation data; notebook provenance should retain version, capture point, capture frame/time, and actual settings.

## Initialization and measurement results

`createTemplate(frame, point, options)` returns `{status, template, point, textureStd, reason, settings}`. Its states are `ready`, `low-texture`, or `out-of-bounds`. Only `ready` has a non-null template. The returned initialization `point` is the requested capture point and is not an automatic measurement.

`trackTemplate(frame, template, predictedPoint, options)` returns:

| Field | Meaning |
| --- | --- |
| `status` | `accepted`, `ambiguous`, `lost`, or `low-texture` |
| `point` | Accepted image-derived `{x,y}` only; `null` in every rejected state |
| `candidatePoint` | Best evaluated match for diagnostic display, including rejected matches; otherwise `null` |
| `score` | Zero-mean normalized cross-correlation, bounded to `[-1,1]`; `null` if undefined |
| `runnerUpScore` | Best valid integer-grid candidate outside the exclusion disk; `null` when none exists |
| `ambiguityMargin` | Best score minus runner-up score; `null` when no comparison exists |
| `textureStd` | Intensity standard deviation of best candidate, or maximum searched contrast when all patches fail texture |
| `searchClipped` | Image bounds limited the requested search rectangle |
| `searchBoundary` | Integer-grid maximum lies on an artificial search limit |
| `subpixelRefined` | Fractional refinement was actually retained after improving directly sampled correlation |
| `candidateCount` | Number of evaluated integer-grid positions |
| `version`, `settings` | Algorithm version and resolved settings actually used |
| `reason` | `null` for acceptance; stable diagnostic code for rejection |

Rejected reason codes are `frame-size-changed`, `search-outside-image`, `search-has-no-texture`, `score-below-threshold`, `insufficient-alternative-patches`, `competing-match`, and `search-boundary`. An out-of-image search or changed geometry is `lost`; missing intensity variation is `low-texture`; inadequate score is `lost`; strong but insufficiently unique or boundary-limited matches are `ambiguous`.

Invalid program inputs throw `TypeError` or `RangeError` rather than producing a plausible point. This includes malformed frames/templates, nonfinite coordinates, and unsupported settings. Ordinary missing or ambiguous visual evidence returns the above explicit states.

## Numerical method and resolved defaults

The `(2r+1)²` template is mean-centered and normalized to unit Euclidean energy. Every fully contained integer-center patch in a square centered on `predictedPoint` is scored by its normalized correlation with that fixed template. Positive affine intensity changes preserve the score before quantization or clipping. Flat patches cannot produce a score.

| Setting | Default | Supported range / meaning |
| --- | --- | --- |
| `patchRadius` | 7 | Integer 2–24; capture-only, default 15×15 pixels |
| `minTextureStd` | 5 | 0–127.5 intensity levels; tracking defaults to template's capture setting; zero-energy patches always fail |
| `searchRadius` | 24 | Integer 2–128 pixels in each axis |
| `minScore` | 0.75 | 0–1; the best match must reach this score |
| `minMargin` | 0.06 | 0–2; score advantage must strictly exceed this, with numerical ties always rejected |
| `exclusionRadius` | `min(3, searchRadius−1)` | At least 1 and at most `searchRadius−1`; Euclidean disk around integer peak excluded from runner-up competition |
| `subpixel` | `true` | Boolean; enables conditional local refinement |

The runner-up test distinguishes separate plausible locations while excluding the immediate peak neighborhood. It is not a probability or uncertainty interval. A maximum at an artificial search edge is rejected because the unrestricted optimum might lie beyond the searched region. A fully visible match touching an image edge can be accepted when it is not also an artificial search-edge maximum. Matches with no valid alternative patch are rejected as ambiguous rather than assigned infinite confidence.

Optional refinement fits independent one-dimensional quadratics through the integer peak and its immediate neighbors. The offset is bounded to half a pixel per axis. The proposed fractional patch is then sampled again, and refinement is retained only when its actual correlation increases and its contrast remains usable. This is a heuristic location estimate, not calibrated subpixel accuracy. The runner-up neighborhood remains defined around the integer peak for reproducibility.

Frames are limited to 16,777,216 pixels. A call may evaluate at most 20 million patch-sample comparisons; oversized combinations of search and patch radii throw before the search loop. The default un-clipped search at an integer predicted point compares 2,401 candidate centers × 225 pixels = 540,225 sample pairs. Grayscale conversion and temporary pixel storage cover only the searched region plus patch support, at most 63×63 float samples (15,876 bytes) with these defaults, independently of full-frame dimensions. A fractional seed can reduce the candidate count by one row or column. The consumer should decode at bounded resolution and yield between frames to keep interaction responsive. No DOM, worker, codec, network, clock, mutable global cache, or hidden frame history is used in this module.

## Qualification and retained limitations

Run `node tests/motion-tracker-15cc.test.mjs`. Tests cover fixed-template immutability, integer translations, positive affine brightness changes, textured occlusion, flat and transparent images, duplicated distractors, artificial search boundaries, image edges, changed dimensions, an unidentifiable image ramp, fractional smooth-marker motion, fractional user capture, disabled refinement, compute-budget refusal, and invalid inputs. The smooth synthetic fractional translations are accepted within 0.15 decoded pixels; this tolerance is a fixture result, not an accuracy claim for video.

Every test image is generated in code and contains no real-world measurement. Real video can contain rotation, perspective changes, scale changes, blur, compression, illumination changes, occlusions, moving backgrounds, and visually identical objects. A translating template cannot reliably resolve these. A wrong but unique lookalike inside the search can pass these heuristics; a correct object that changes appearance can fail. A pure brightness ramp has high contrast but no unique position, and is deliberately retained as an ambiguity counterexample.

### Retained rotation counterexample

A high correlation does not bound error in a physical marker's center. In a 100×80 grayscale image, define a marker around `(cx,cy)` by intensity

`35 + 155 exp(−(u+1.2)²/6 − (v−0.7)²/11) + 75 exp(−(u−3)²/3 − (v+3)²/4)`.

For marker rotation `a`, use `u=cos(a)(x−cx)+sin(a)(y−cy)` and `v=−sin(a)(x−cx)+cos(a)(y−cy)`. Quantize RGB to `Uint8ClampedArray` and set alpha to 255. Capture with default settings at `(40,35)` and `a=0`; then track a marker centered at `(45,39)`, with the predicted point `(40,35)` and all default settings. On this implementation:

| Target rotation | State | Correlation | Center error (decoded pixels) |
| --- | --- | --- | --- |
| 0° | accepted | 1.0000 | 0.0000 |
| 45° | accepted | 0.8758 | 0.8426 |
| 90° | accepted | 0.8414 | 1.6995 |
| 180° | accepted | 0.8843 | 2.3877 |

This is an observed failure to preserve the geometric marker center under rotation, despite passing the translation match gates. A larger score threshold alone cannot establish geometric accuracy. Rotation-aware or affine image registration and real-marker receiving remain future work; the current consumer should require approximately stable marker appearance and allow overlay inspection and manual correction.

### Recorded two-marker ambiguity

The rights-declared double-pendulum excerpt in [the receiving source manifest](../examples/motion-fixtures-15cc.json) supplies a real-image negative case. Its SHA-256 is `552dac87ddb8ab171c951ae9cd8f3240937aa838436192260906b803f8247824`; decoded images are 476×476 pixels. At time 0, capture `(260,132)` with patch radius 14, then search the 0.04-second frame around that same point with search radius 64 and other default settings.

Independent inspection of the decoded PNG raster's full search map found the intended red-ring marker peak at `(304,155)`, correlation approximately `0.97334`, and the other yellow-ring marker at `(208,108)`, correlation `0.95316`. The latter remains the runner-up with exclusion radii 3, 8, and 16: it is a distinct marker, not merely the flank of the best peak. The score margin is below 0.06, so the correct current result is `ambiguous` with `point:null`. Browser-decoded raster scores differ slightly while preserving the same rejection.

The intended marker moves roughly `(44,23)` pixels between these frames, so reducing the search radius to 24 would exclude it. The smaller radius-7 capture lies inside its nearly uniform saturated center and is correctly refused for low texture. This case motivates future measured-motion prediction or validated color identity; relaxing the ambiguity threshold would hide a real association uncertainty. The movie supplies no independent position truth, and its coupled double-pendulum dynamics do not qualify the scalar known-constant-inertia torque assumption.

The intended consumer stops automatic continuation on rejection, keeps rejected samples unmeasured, and permits explicit user correction. It should display correlation as a match score, label generated demonstrations as synthetic, and retain source provenance. Pivot calibration, perspective assumptions, timestamp validity, angle unwrapping, derivatives, uncertainty propagation, and physical-model claims belong to separate consumer contracts.
