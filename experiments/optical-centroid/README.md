# Ideal optical centroid and angle averaging (#449)

## Question and declared optics

This bounded authored study asks whether deriving an angle from the integrated image centroid is equivalent to averaging angle. It uses a fixed front-facing circular projection, a fixed pivot, a translated normalized square point-spread function with zero spatial first moment, uniform declared exposure on [0, 1] seconds, constant brightness and complete support. These are explicit assumptions, not facts inferred from a camera or sample cadence.

The five exploratory trajectories were retained before the subsequent proof controls: a symmetric constant-rate course, quadratic courses with amplitudes 1.8, 2.4 and 3 rad, and a complete uniform turn. The protocol was frozen after the exploratory discrepancy was found and before the independent Fresnel/spatial/brightness/clipping calculations. This is not a blind predeclared discovery test.

The maintained Motion module derives angle from `atan2(marker.x-pivot.x, marker.y-pivot.y)` before its existing reference, continuity and radius checks. Its normalized patch-correlation tracker does not promise a centroid. This experiment supplies an explicitly authored ideal centroid directly to the unchanged point-to-angle contract. It neither executes nor improves the tracker.

## Executed outcome

| Course | Scalar angle average | Angle of projected centroid |
| --- | ---: | ---: |
| Symmetric constant rate | 0.4 rad | 0.40000000000000085 rad |
| Quadratic amplitude 1.8 | 0.6 rad | 0.5821503293602336 rad |
| Quadratic amplitude 2.4 | 0.8 rad | 0.7547596861408152 rad |
| Quadratic amplitude 3 | 1 rad | 0.9032312020211886 rad |
| Complete uniform turn | pi rad | Missing: centroid collapses to pivot |

The quadratic cases demonstrate that `atan2(mean sin(q), mean cos(q))` generally differs from `mean(q)`. The complete-turn negative result is more severe: the maintained radius admission refuses an angle rather than treating a nearly zero centroid vector as a meaningful direction. No branch-unwrapping assumption repairs that loss of direction.

## Independent controls and boundaries

An independent SciPy Fresnel calculation verifies each quadratic integral. Its angle differs from maintained receiving by at most 3.22e-15 rad. The constant-rate centroid radius also agrees with the analytic sinc factor. Both 1,024- and 4,096-interval temporal quadratures are retained.

A separate spatial first-moment calculation integrates the declared translated square profile using 9 by 9 spatial nodes at 512 temporal midpoints. Its centroid matches the direct mean projected coordinates to approximately 1.6e-12 pixels. This is spatial quadrature of an ideal continuous profile, not a rendered raster, decoded image or camera measurement.

The assumptions materially affect the result. For the 2.4-rad quadratic course, brightness proportional to `1+t` changes the centroid angle from 0.7547596861408185 to 0.9033253871713288 rad. A square profile centered at x=0.5 pixels and clipped to nonnegative x retains 62.5% of its mass and has centroid x=1.25 pixels, a 0.75-pixel shift. Uniform weighting or complete-support formulas cannot be used after those assumptions fail.

This does not establish a real sensor model, physical motion law, calibrated uncertainty or camera correction. No shutter metadata has been admitted. Perspective, background, occlusion, nonlinear response, changing point-spread functions and tracker-specific behavior remain outside the declared model. No physical or PASCO conclusion follows.

## Reproduction and preservation

`node experiments/optical-centroid/run.mjs` reproduces all original probe rows through the maintained Motion module and deep-compares them against frozen results without writing. `python experiments/optical-centroid/independent-reference.py` executes the independent references and compares the retained values without writing; it requires NumPy and SciPy. The executed environment used SciPy 1.17.0. Original writing runners are retained as provenance text, not recommended entrypoints.

The original exploratory results and frozen protocol remain intact. Exact maintained source identities are recorded in dependency-provenance.json. Repository adaptation changes only the maintained import path and uses the actual repository module without copying those dependencies into the publication source. No UI, acquisition schema or owner source changes are included.
