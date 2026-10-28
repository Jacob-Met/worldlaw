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

## Explaining a changed sampled peak

Each transition now separates the fine execution's peak over the original reporting times from its peak over all finer times. The signed shared-grid peak shift is the former minus the coarse execution's peak. The additional-sample gain is the fine all-times peak minus its own original-time subset peak, so it is nonnegative. These two terms sum to the total sampled-peak shift up to floating-point rounding. An unchanged total can hide equal and opposite contributions.

The shared-grid shift reflects changes between numerical executions; it is not a physical error estimate. The additional-sample gain isolates the effect of including extra times in the same fine execution; it does not locate a continuous-time maximum. Both signs of the declared release are included, with exact sample-time matching and retained peak witnesses. The calculation uses existing completed samples and adds no solver evaluations, source fields or work-budget changes.


## Comparing finite release magnitudes

The optional magnitude comparison executes the declared signed displacement and a second displacement divided by 2, 4, or 8. Both retain every original competitive law, identical numerical settings and exact reporting times. Each positive and negative path is normalized by its own represented starting distance. The chart overlays both magnitudes; per-law witnesses identify the largest normalized response difference at a common sampled time.

This inquiry reserves at most 240,000 model evaluations across both complete three-path courses and admits at most 20,000 returned path samples in total. A failed competitor prevents a summary verdict. Both represented releases must be nonzero and resolvable before any course runs. Smaller magnitudes do not automatically give better evidence: numerical error and floating-point changes in direction can affect the comparison. Agreement does not establish an infinitesimal derivative or stability, and disagreement alone does not establish nonlinear physical behavior.

Source-only investigation v4 stores the original notebook, release inputs, `release-magnitudes` mode and shrink factor; reopening recomputes original fits and all courses. It refuses derived results and incompatible mode fields. Earlier v1, v2 and v3 declarations retain their original interpretation.

## Two finite release directions

The optional perpendicular-release comparison executes the declared signed release and a quarter-turn in the declared scaled position/rate plane. For angle scale `a`, rate scale `b`, and displacement `(q,v)`, the second requested displacement is `(-v*a/b, q*b/a)` (evaluated as scaled coordinates before multiplication). Their scaled lengths agree in exact arithmetic. Each executed positive and negative start is normalized by its own represented distance; rounding can alter the represented direction or magnitude.

Every original competing law is retained in both three-path courses. The inquiry reserves at most 240000 derivative evaluations across the complete six-path-per-law comparison and refuses more than 20000 total requested path samples. An incomplete law prevents a complete directional verdict. The displayed difference compares normalized separation at exactly identical reporting times. It includes integration error and represented-start rounding. It is neither a derivative nor a maximum or bound across all release directions. The declared scales define the comparison geometry; changing them changes the question.

Direction questions save as strict input-only `worldlaw.release-investigation/v5`, with `refinement: "release-directions"` and `screen: true`. Reopening restores the original notebook, refits its laws and executes both directions. Derived results, mixed mode fields and disabled v5 questions are refused. Earlier v1–v4 input formats retain their behavior.
