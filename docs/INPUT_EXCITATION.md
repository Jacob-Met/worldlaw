# Choosing an input that restores missing excitation

The Studio can now ask for an input direction that the existing observations do
not contain. This is useful when fitted models agree because the data never
varied a command, or varied two inputs only together. More measurements on that
same relation need not resolve the missing effect.

Select **Missing input excitation** under **Ask a better question → Plan by**.
The existing model-disagreement objective remains the default. Changing the
objective changes neither observations nor fitted laws. **Use suggested state**
copies coordinates; the ordinary measured-outcome control is still the only
way an imported notebook acquires a new torque observation.

## Source contract and retained choices

Existing CSV, unversioned JSON, and `worldlaw.observations/v1` sources keep their
existing behavior. Their candidate grid remains within the original observed
ranges. Such a grid cannot restore a command direction if every original command
was zero.

To offer a deliberate acquisition course, use `worldlaw.observations/v2` with
an `offeredInputs` array alongside the original observations, optional held-out
rows and source declarations. See the complete
[authored example](../examples/scalar-unexcited-command.json).

Each offered entry contains exactly three finite numeric fields:

| Field | Unit | Meaning |
| --- | --- | --- |
| `command` | N·m | Applied command coordinate |
| `position` | rad | Angular position coordinate |
| `rate` | rad/s | Angular rate coordinate |

There are at most128 unique entries, bounded in magnitude by10⁶ as for existing
observation inputs. An empty array explicitly offers no states. No torque,
prediction, weight, ranking or other extra field is accepted. The newer source
schema is required so an older reader cannot silently discard this acquisition
course. Seeded virtual notebooks retain their own fixed instrument course and
refuse this override.

Both planning objectives use the complete supplied course. States already
observed at exactly the same coordinates are excluded; full floating-point
precision is retained when copying a supplied state to the acquisition controls.
An extension beyond an observed coordinate range is labeled. Availability,
instrument limits and physical suitability remain the supplier's declarations;
the app operates no hardware.

The notebook retains original offers and observations, plus later measurement,
feature-library and fitting-option events. It recomputes the plan when reopened;
it does not serialize a trusted pilot verdict. Nested observation source v2
composes with ordinary notebook v1, interaction-history v2 and robust-loss v3.
Undo restores the earlier evidence and therefore the earlier available course.

## Maintained mechanism

The planner obtains every feature column through the maintained scalar
`predict` evaluator, and measures numerical column rank using the maintained
scaled QR routine and its existing threshold. It uses the whole currently
offered finite feature library, including explicitly admitted interaction terms,
rather than only terms that the current fit happened to select.

It compares current rank with the rank after each offered coordinate row. One
row can add at most one independent direction. A gain of one qualifies; all
such offers tie, and the original offered order breaks that tie. Every examined
offer and its rank remains visible. A rank loss or jump greater than one is a
numerical-rescaling outcome and cannot qualify. This floating-point test is not
a certified conditioning bound.

No future torque, held-out coordinate, held-out reading, prediction error or
model probability enters selection. The complete comparison has an explicit
8,000,000 estimated rank-work limit. If the course exceeds it, no prefix is
ranked. Empty offers, no rank gain, an already complete design, numerical
rescaling and work refusal remain distinct outcomes.

Rank is conditional on a fixed finite library and numeric threshold. It does
not certify a correct law, good physical identifiability, useful precision, a
reliable instrument or predictive adequacy. One added row may leave other
directions unresolved. The ordinary fitted-model diagnostics remain visible.

## Executed baseline comparison

The supplied development example contains40 authored fitting rows with command
zero,31 separately evaluated rows and3 input-only offers. The default7-column
library has numerical rank6. The ordinary model-disagreement planner is
uninformative and chooses the first offered zero-command state. Its new reading
leaves independent receiving RMSE about0.8265 N·m.

The pilot selects the second offered state:
command1.2 N·m, position0.3 rad, rate0.4 rad/s. It predicts only a change in
input rank6→7, without a torque prediction. Entering the independently authored
outcome1.25 N·m through **Record measured outcome** lets the unchanged fitter
select command, rate and spring. Receiving RMSE falls to floating-point
roundoff. These are authored numerical controls, not physical observations.

The separately seeded course in
[`input-excitation-study.mjs`](../scripts/input-excitation-study.mjs) fixes
six previously unused seeds,96 training coordinates and83 independent
receiving coordinates per case. Both planners receive the same offered states;
the receiving rows stay outside the notebook and are evaluated after selection.

| Course | Cases | Observed outcome |
| --- | ---: | --- |
| Exact additive law | 6 | Receiving RMSE at least0.8528 before; at most1.1×10⁻¹⁵ after the pilot |
| Additive law with small authored reading noise | 6 | Receiving RMSE at least0.8334 before; at most0.001357 after |
| Omitted cubic contribution | 6 | Rank restored and receiving error reduced, but all6 fits remain residual mismatches |
| No offered independent command | 6 | No acquisition or rank-restoring suggestion; original evidence unchanged |

The receipt retains every course and raw metric. Its improvement counter
requires an actual pilot acquisition and a reduction above
`max(1e-9, 1e-8 × baseline RMSE)`; no-action roundoff is never counted as a
capability gain. The omitted-law cases are not counted as reductions without
residual mismatch. The source-only replay also composes with the independently
maintained soft-L1 fitting history.

## Reproduce and receive the application

```sh
node tests/input-excitation.test.mjs
node scripts/input-excitation-study.mjs /tmp/input-excitation-study.json
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/path/to/chrome \
BROWSER_ARTIFACT_DIR=/tmp/input-excitation-browser \
node scripts/input-excitation-browser.mjs
```

The direct native groups cover output poisoning, nonzero confounding, incomplete
excitation, omitted physics, numerical rescaling, complete-work refusal,
admission, aliases, full precision, source versioning, virtual-course boundaries,
and history/reopen behavior.

The actual sandboxed Chromium receiver imports the original source, switches
objectives, inspects every offered state, uses keyboard acquisition, refuses an
empty measurement, enters the independent reading, downloads original inputs
and reopens them. Old-format offers and a fabricated future torque must refuse
without replacing the accepted notebook. A wrong-library control must keep its
residual mismatch after full rank. Desktop and390px views, reduced-motion
preference, exact input precision, script exceptions and external requests are
checked through the maintained application.

