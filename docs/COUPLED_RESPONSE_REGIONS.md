# Joint receiving under shared training-reading perturbations

The circulation consumer can inspect each supplied **pair** of torque readings under a declared perturbation allowance for its retained training readings. It keeps the same coordinates, model structures, and observations. Receiving values never train the model.

This is a fixed-structure least-squares sensitivity calculation, not a confidence region or the set of all physical laws consistent with measurements. The declared training radius is distinct from the notebook's noise-floor scoring assumption. It applies independently to each scalar training torque reading, in N·m; the supplied loop already declares the two receiving-reading bounds. Coordinates remain exact under the inherited declaration.

## Why joint receiving matters

Both output coordinates use the same fitted coefficients and training readings. Independent scalar intervals discard that relationship. For the maintained default authored course, at `[-1,-1]` rad and a training radius of `0.05` N·m, the reciprocal model has marginal radii approximately `4.38884` and `4.19949` N·m. Authored residuals `[+3.77954,-3.77954]` lie inside both marginal bands, yet cannot arise together from one permitted training-reading change. With receiving radii `0.01` N·m, the computed joint projection separates them by approximately `1.45604` N·m.

This is an explicitly authored discriminating control. It does not qualify any physical mechanism or the separately screened NAD recording.

## Maintained fit and planar geometry

For fixed design matrix `X`, the maintained normalized QR solver computes the least-squares coefficient response to each scalar training-reading unit perturbation. These influence columns are projected through the existing coupling predictor's basis at the receiving angle pair. This reuses `STRUCTURES`, `predictCoupling`, and `fitLinearColumns`; no second fitting algorithm is introduced.

For the receiving pair, let `c` be its refitted prediction and `g_i` the two-component response to training-reading perturbation `i` at its declared bound. The computed sensitivity region is

`c + sum_i g_i u_i`, with every `u_i` in `[-1,1]`.

This sum of line segments is a planar zonotope. Along unit direction `n`, its support relative to the centre is `sum_i |n·g_i|`. The receiving-error rectangle adds two axis-aligned generators. A supplied reading is separated when its projection exceeds that combined support beyond the numerical screen.

For a planar region, every nondegenerate edge is parallel to a generator. Testing both orientations of every generator normal therefore covers the polygon's support inequalities in exact arithmetic. Axis directions also bound point and line degeneracies. The implementation uses floating-point arithmetic and an engineering cancellation screen, **not outward-rounded certificates or a bound on QR error**. A point on a lower-dimensional region remains a numerical boundary.

The selected witness retains the signs of the training-reading offsets that attain the prediction support in its direction under the computed linear map. It is an extremal support witness; it need not reproduce the supplied pair. A native control refits these actual bounded offsets through the maintained fitter and verifies the reported support.

Background on the sum-of-segments representation: [Zonotopes as Bounding Volumes](https://graphics.stanford.edu/~anguyen/papers/zonotope.pdf). The formula and two-dimensional construction above specify this implementation directly.

## The scope of an outcome

Every receiving row gets its own computed region. An outside result is a conditional contradiction for that row under this sensitivity model. Passing every row does **not** establish one common training perturbation explaining the entire course. The consumer repeats this distinction in the result and status text. Model mismatch, coordinate error, unmodeled dynamics, calibration error and physical identification remain outside this calculation.

All retained fitted candidates remain listed. A numerical failure marks the affected candidate unavailable with its reason. It never silently removes the candidate or truncates the course.

## Instrument and source lifecycle

Two presentations were considered: perturbation timelines with separate output bands, and the actual joint torque plane. The joint plane is used because the scientific distinction is the relationship between outputs. It overlays:

- The teal computed response region and centre.
- The dashed rectangle formed by independent marginal bands.
- The pink supplied reading and its declared rectangle.
- A separating line when the joint result is outside.

The selected original row, source labels, extrapolation, numerical diagnostics, and source-reading witness ledger remain inspectable. No animation or stylized physical mechanism is substituted for the calculation.

The input-only region file contains exactly `schema`, `notebook`, `path`, and `trainingRadius`. Reopening recomputes the original source and setting without replacing the parent loop or active training notebook. Stored verdicts and unknown top-level fields refuse. Invalid files preserve a previously valid region. Setting edits clear stale results; parent source changes remove the inspector; late file reads cannot revive a removed inspection. A source/settings file is limited to 4 MiB.

## Bounded execution and receiving

Before model analysis or influence construction, the consumer admits at most 128 fitting rows and 128 receiving rows. It reserves all three offered structures using a conservative deterministic work score based on scalar training-reading count, parameter count and complete support-direction count; the score limit is 16 million. This is a scheduling bound, not a literal processor-instruction count. Oversized courses refuse as a whole.

Six native groups cover the joint-only contradiction, an attainable extremal witness, wide/zero-radius behavior, complete input/work refusal, point/line boundaries, and input-only replay/custody. The real-browser receiver covers trusted keyboard selection, source/setting invalidation, original-input download/reopen with unchanged active notebook, cached-verdict refusal, stale reads, complete-course refusal, and desktop/narrow captures. Browser success and visual acceptance must be established on the composed source before publication.
