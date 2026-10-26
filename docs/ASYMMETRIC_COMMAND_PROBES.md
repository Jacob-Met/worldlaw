# Ask where retained command mappings disagree

After a complete separate-threshold comparison in the Studio's existing command
instrument, choose **Compare original offered states**. The calculation reuses
the Studio's original candidate course and its original source indices. Explicit
versioned observation inputs retain their declared offered states; other sessions
retain the existing bounded candidate course. Already observed states are removed
by the existing session helper. No new future torque readings are constructed.

For every mapping, retain every fitted structure whose training score differs
from the overall best score by at most the declared ambiguity allowance. This
includes competitive nonwinning structures within a mapping. Each model evaluates
the original offered command through its own negative/positive threshold map.
The ordinary scalar planner and this mapped comparison share the same maximum
minus minimum prediction-range ranking and stable original-index tie ordering.

The table preserves every original unobserved offer, every prediction and its
extrapolated coordinates. A range exceeding twice the declared noise scale is
labelled proposed under the existing heuristic; smaller ranges remain
uninformative. This is not information gain, calibrated uncertainty, physical
feasibility, an acquisition command or a guarantee of model identification.

The original source notebook already retains explicitly offered inputs. The
asymmetric comparison's existing source-only export therefore preserves offers
without a new result envelope. Reopen and recompute to recover the comparison.
Changing source or mapping declarations retires the old calculation. Inspecting a
different plotted candidate does not alter the full training-competitive ensemble.
A separately supplied new observation changes the training source and removes its
matching original state from the unobserved course; old predictions are not shown
as current evidence. The ordinary Studio law and selected measurement state are
not silently replaced by this conditional comparison.

## Scope and ownership

This is static mapping-by-structure ensemble support. It leaves the separately
owned known-inertia timing/response command-course planner (#198), fixed-basis
multi-input sensitivity courses (#280), scalar feasible-law bounds (#75), and
frozen acquisition pipelines unchanged.

## Verification

    node --test tests/asymmetric-command-probe.test.mjs
    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/mapped-probe node scripts/asymmetric-command-probe-browser.mjs

An executed authored feasibility course used97 positive-command training rows.
Three globally competitive explanations predicted1.4097 N·m at offered command+1,
while offered command−1 produced−1.44,−1.0697 and−0.2969 N·m: range1.1431 N·m.
No future outcomes entered that calculation. The ordinary consumer's exact source
pins, browser receipts and later integration results belong to native issue332.

## Ordinary Studio receiving

The [browser receipt](receipts/asymmetric-probes-332/receipt.json) records eight exercised consumer groups using [original offered inputs](receipts/asymmetric-probes-332/mapped-offers-inputs.json). This includes the positive disagreement, agreed-only uninformative course, source-only save/reopen, declaration retirement, rejection of a supplied future outcome without losing the accepted source, and a separately supplied new reading removing its original offer without renumbering. The 1440 and 390 pixel views were inspected. At narrow width the labelled, keyboard-focusable table scrolls horizontally; headers remain whole and the document does not overflow. The existing Studio law and selected measurement state remain independent. Exact prospective and published receiving pins are recorded on issue #332 and its integration PR.
