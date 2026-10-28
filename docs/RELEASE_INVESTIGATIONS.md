# Finite release investigations in Studio

After importing original torque observations and comparing the competitive laws, open **How sensitive are these paths to the release?** Declare signed angle/rate changes and the angle/rate scales used to measure separation. Every original law executes the baseline and both signed releases; the denominator is the actual represented starting distance for each side.

Optional numerical investigations answer different questions:
- Tolerance comparison changes smooth adaptive tolerances. Fixed-step Coulomb laws supply no tolerance-refinement evidence.
- Fourfold step refinement executes dt and dt/4 and compares amplification at exact original reporting times, without interpolation.
- Sampled-peak investigation executes 2–4 complete grids, each fourfold finer, and progressively tighter smooth tolerances down to 1e-14. It reports changes in sampled maxima separately from discrepancies at shared times.

For example, a spring whose period matches the coarse interval can return nearly the same release gain at every original sample while finer grids reveal large intervening sampled gains. Shared-time agreement therefore does not establish resolved peaks. Neither method establishes a continuous-time maximum, convergence, numerical error bound, asymptotic stability, calibrated uncertainty or physical validity.

All competitors and both signs remain present. The peak investigation preflights at most 20000 total returned baseline/positive/negative path samples across all laws and grids, and reserves at most 240000 model evaluations across the complete grid set. A capacity refusal executes no partial inquiry; an exhausted or failed law leaves the complete inquiry incomplete, with no survivor maximum verdict.

**Save release investigation** stores the maintained original input notebook plus release settings. Reopening replays observations and events, refits the original laws and recomputes paths before adoption. File fingerprints bind the notebook bytes; they are not authentication. Strict schemas refuse injected derived results and mismatched notebook sources. New input intents retire pending reads and derived displays.

Typed v1 preserves the original tolerance-only question. Typed v2 declares step-and-tolerances. Typed v3 declares peak-grids and an integer levels field from 2 through 4. Existing v1/v2 saves retain their formats and replay behavior.

## Executed receiving

The current stack was composed on 81fd35e1b2cf60eaad0246c459c48afe7dee5ca5. All59 relevant native tests and both maintained launched-product smokes passed on a full archive checkout using Node22.23.4. Eight independent controls compared exact v1/v2 saved bytes and whole reopened reports with the frozen predecessor. Independent peer controls checked actual sample counts, total reservations, numerical reducers, strict typed replay and failed-set preservation.

Actual sandboxed Chrome156 Studio receiving imported64 authored spring observations, fitted seven competitive laws, compared shared-time and sampled-peak results, operated keyboard controls, reopened v3 on a fresh page, retained a nondefault two-grid selection, refused forged results and preserved budget-incomplete outcomes without a chart. Explicit1280px desktop and390px narrow views were inspected. These are authored numerical observations, not physical measurements.

Native regression command:
`node --test tests/release*.test.mjs tests/studio-endpoint.test.mjs tests/studio-dynamics*.test.mjs tests/torque-discovery.test.mjs`

Maintained launched routes:
`node scripts/smoke.mjs` and `node scripts/trajectory-smoke-92be.mjs`.
